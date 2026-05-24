"""
Mnemo capture worker (Architecture 1).

Pulls capture jobs off the Redis queue and forwards the conversation TEXT to
the sidecar -> live MemWal relayer, which owns the heavy pipeline: embed ->
Seal-encrypt -> Walrus upload -> on-chain semantic index.

The worker no longer embeds or encrypts. It keeps a LIGHTWEIGHT row in the
`entries` table (no embedding vector) purely as a metadata index so the UI can
list conversations and map blob_id -> model/preview/tokens/ts. Semantic search
and recall go through the relayer, not this table.

Resilience: the relayer call can fail transiently (testnet RPC/DNS blips,
Walrus hiccups, 5xx). Such failures are retried with backoff. If a job still
fails after retries, it is moved to a dead-letter list (mnemo:captures:dlq)
rather than dropped, so no capture is ever silently lost.
"""
import asyncio
import json
import logging
import signal
from typing import Any

import httpx
import redis.asyncio as aioredis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from mnemo_worker.config import settings
from mnemo_worker.payload import build_payload, preview_of

logging.basicConfig(
    level=settings.log_level,
    format="%(asctime)s %(levelname)s %(name)s - %(message)s",
)
log = logging.getLogger("mnemo.worker")

QUEUE_KEY = "mnemo:captures"
DLQ_KEY = "mnemo:captures:dlq"
POP_TIMEOUT_SECONDS = 5

# Transient-failure retry policy for the relayer remember call.
MAX_REMEMBER_ATTEMPTS = 4
BACKOFF_BASE_SECONDS = 3.0  # 3s, 6s, 12s between attempts

_engine = None
_SessionMaker: async_sessionmaker | None = None
_running = True


def _handle_shutdown(*_):
    global _running
    log.info("shutdown signal received")
    _running = False


class PermanentJobError(Exception):
    """Job is malformed / unprocessable — do NOT retry, dead-letter it."""


def _conversation_text(payload: dict[str, Any]) -> str:
    """Flatten the conversation into the text the relayer will embed + store.

    This is what the user searches against, so we send the natural-language
    prompt + response, not the JSON envelope. Structured metadata is kept in
    the entries row instead.
    """
    lines: list[str] = []
    for m in payload.get("prompt_messages", []):
        content = m.get("content", "")
        if isinstance(content, str) and content.strip():
            role = m.get("role", "user")
            lines.append(f"{role}: {content}")
    resp = payload.get("response_text", "")
    if isinstance(resp, str) and resp.strip():
        lines.append(f"assistant: {resp}")
    return "\n".join(lines).strip() or "(empty conversation)"


async def _remember_with_retry(http: httpx.AsyncClient, body: dict[str, Any]) -> str:
    """POST to the sidecar remember endpoint, retrying transient failures.

    Returns the walrus blob id. Raises PermanentJobError on unprocessable
    input, or RuntimeError after the retry budget is exhausted (caller
    dead-letters in both cases).
    """
    last_err: Exception | None = None
    for attempt in range(1, MAX_REMEMBER_ATTEMPTS + 1):
        try:
            resp = await http.post(
                f"{settings.sidecar_url}/memwal/remember",
                json=body,
                timeout=120.0,  # relayer remember can take ~30-90s
            )
        except (httpx.TimeoutException, httpx.TransportError) as e:
            # network-level failure (DNS, connection reset, timeout) — transient
            last_err = e
            log.warning("remember attempt %d/%d network error: %s",
                        attempt, MAX_REMEMBER_ATTEMPTS, e)
        else:
            if resp.status_code >= 500:
                # relayer/sidecar 5xx — transient (RPC blip, Walrus hiccup)
                last_err = RuntimeError(f"sidecar {resp.status_code}: {resp.text[:300]}")
                log.warning("remember attempt %d/%d got %d (transient)",
                            attempt, MAX_REMEMBER_ATTEMPTS, resp.status_code)
            elif resp.status_code >= 400:
                # 4xx — client/data problem, not worth retrying
                raise PermanentJobError(f"sidecar {resp.status_code}: {resp.text[:300]}")
            else:
                data = resp.json()
                blob_id = data.get("walrusBlobId")
                if not blob_id:
                    raise PermanentJobError(f"sidecar 200 but no walrusBlobId: {data}")
                return blob_id

        # transient path: back off before retrying (unless that was the last try)
        if attempt < MAX_REMEMBER_ATTEMPTS:
            await asyncio.sleep(BACKOFF_BASE_SECONDS * (2 ** (attempt - 1)))

    raise RuntimeError(f"remember failed after {MAX_REMEMBER_ATTEMPTS} attempts: {last_err}")


async def _process_one(job: dict[str, Any], http: httpx.AsyncClient) -> None:
    try:
        user_id = job["user_id"]
        namespace_id = job["namespace_id"]          # Postgres UUID (entries FK)
        namespace_label = job.get("namespace_label") or "default"
        sui_address = job["sui_address"]
        provider = job["provider"]
        request_body = job["request_body"]
        response_body = job["response_body"]
    except (KeyError, TypeError) as e:
        raise PermanentJobError(f"malformed job, missing field: {e}")

    # Optional source-app classification from the proxy. Missing on old jobs
    # and on jobs from pre-source_app proxy versions — both fine, stored NULL.
    source_app = job.get("source_app")
    source_app_raw = job.get("source_app_raw")

    payload = build_payload(provider=provider, request_body=request_body, response_body=response_body)
    preview = preview_of(payload)
    convo_text = _conversation_text(payload)

    # Architecture 1: send TEXT to the relayer (via sidecar). The relayer
    # embeds, Seal-encrypts, uploads to Walrus, and indexes on-chain.
    blob_id = await _remember_with_retry(http, {
        "ownerAddress": sui_address,
        "namespaceObjectId": namespace_label,
        "text": convo_text,
        "metadata": {
            "ts": payload["ts"],
            "model": payload["model"],
            "provider": payload["provider"],
        },
    })

    # Lightweight metadata row for the UI (NO embedding — relayer owns search).
    async with _SessionMaker() as s:
        await s.execute(
            text(
                """
                INSERT INTO entries
                       (user_id, namespace_id, walrus_blob_id,
                        model, preview, token_input, token_output,
                        source_app, source_app_raw, ts)
                VALUES (:uid, :ns, :bid,
                        :model, :prev, :tin, :tout,
                        :sapp, :sapp_raw, NOW())
                """
            ),
            {
                "uid": user_id,
                "ns": namespace_id,
                "bid": blob_id,
                "model": payload["model"],
                "prev": preview,
                "tin": payload["token_counts"]["input"],
                "tout": payload["token_counts"]["output"],
                "sapp": source_app,
                "sapp_raw": source_app_raw,
            },
        )
        await s.commit()

    log.info("captured entry: blob=%s ns=%s model=%s source=%s preview=%r",
             blob_id, namespace_id, payload["model"], source_app, preview[:80])


async def _run():
    global _engine, _SessionMaker
    signal.signal(signal.SIGINT, _handle_shutdown)
    signal.signal(signal.SIGTERM, _handle_shutdown)

    _engine = create_async_engine(settings.database_url, echo=False, pool_pre_ping=True)
    _SessionMaker = async_sessionmaker(_engine, expire_on_commit=False, class_=AsyncSession)

    redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    await redis.ping()
    log.info("worker started - polling %s", QUEUE_KEY)

    async with httpx.AsyncClient() as http:
        while _running:
            try:
                item = await redis.blpop(QUEUE_KEY, timeout=POP_TIMEOUT_SECONDS)
                if item is None:
                    continue
                _, raw = item
                try:
                    job = json.loads(raw)
                except json.JSONDecodeError:
                    log.error("undecodable job, dead-lettering raw payload")
                    await redis.rpush(DLQ_KEY, raw)
                    continue

                try:
                    await _process_one(job, http)
                except PermanentJobError as e:
                    log.error("permanent failure, dead-lettering: %s", e)
                    await redis.rpush(DLQ_KEY, raw)
                except Exception:
                    # transient failure survived all retries — preserve the job
                    log.exception("processing failed after retries, dead-lettering")
                    await redis.rpush(DLQ_KEY, raw)
            except asyncio.CancelledError:
                break
            except Exception:
                log.exception("worker loop error")
                await asyncio.sleep(1.0)

    await redis.close()
    if _engine is not None:
        await _engine.dispose()
    log.info("worker stopped")


def main():
    asyncio.run(_run())


if __name__ == "__main__":
    main()
