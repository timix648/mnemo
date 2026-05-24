"""
Mnemo capture worker (Architecture 1).

Pulls capture jobs off the Redis queue and forwards the conversation TEXT to
the sidecar -> live MemWal relayer, which owns the heavy pipeline: embed ->
Seal-encrypt -> Walrus upload -> on-chain semantic index.

The worker no longer embeds or encrypts. It keeps a LIGHTWEIGHT row in the
`entries` table (no embedding vector) purely as a metadata index so the UI can
list conversations and map blob_id -> model/preview/tokens/ts. Semantic search
and recall go through the relayer, not this table.
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
POP_TIMEOUT_SECONDS = 5

_engine = None
_SessionMaker: async_sessionmaker | None = None
_running = True


def _handle_shutdown(*_):
    global _running
    log.info("shutdown signal received")
    _running = False


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


async def _process_one(job: dict[str, Any], http: httpx.AsyncClient) -> None:
    user_id = job["user_id"]
    namespace_id = job["namespace_id"]          # Postgres UUID (entries FK)
    # Relayer groups memories by an opaque string. The proxy/API supplies it as
    # `namespace_label` (e.g. the namespace name or its sui_object_id). Fall back
    # to "default" — the grouping key we proved in the round-trip tests.
    namespace_label = job.get("namespace_label") or "default"
    sui_address = job["sui_address"]
    provider = job["provider"]
    request_body = job["request_body"]
    response_body = job["response_body"]

    payload = build_payload(provider=provider, request_body=request_body, response_body=response_body)
    preview = preview_of(payload)
    convo_text = _conversation_text(payload)

    # Architecture 1: send TEXT to the relayer (via sidecar). The relayer
    # embeds, Seal-encrypts, uploads to Walrus, and indexes on-chain.
    rem_resp = (await http.post(
        f"{settings.sidecar_url}/memwal/remember",
        json={
            "ownerAddress": sui_address,
            "namespaceObjectId": namespace_label,
            "text": convo_text,
            "metadata": {
                "ts": payload["ts"],
                "model": payload["model"],
                "provider": payload["provider"],
            },
        },
        timeout=120.0,  # relayer remember can take ~30-90s (embed+seal+walrus+chain)
    )).json()
    blob_id = rem_resp["walrusBlobId"]

    # Lightweight metadata row for the UI (NO embedding — relayer owns search).
    async with _SessionMaker() as s:
        await s.execute(
            text(
                """
                INSERT INTO entries
                       (user_id, namespace_id, walrus_blob_id,
                        model, preview, token_input, token_output, ts)
                VALUES (:uid, :ns, :bid,
                        :model, :prev, :tin, :tout, NOW())
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
            },
        )
        await s.commit()

    log.info("captured entry: blob=%s ns=%s model=%s preview=%r",
             blob_id, namespace_id, payload["model"], preview[:80])


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
                job = json.loads(raw)
                try:
                    await _process_one(job, http)
                except Exception:
                    log.exception("failed to process capture job; dropping")
                    # TODO: route to dead-letter list mnemo:captures:dlq
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
