"""
Mnemo capture worker.

Pulls capture jobs off the Redis queue, embeds the conversation, asks the
sidecar to encrypt + write to Walrus via MemWal, and inserts a row in
Postgres with the embedding for later semantic search.
"""
import asyncio
import base64
import json
import logging
import signal
from typing import Any

import httpx
import redis.asyncio as aioredis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from mnemo_worker.config import settings
from mnemo_worker.embed import embed_text
from mnemo_worker.payload import build_payload, preview_of

logging.basicConfig(
    level=settings.log_level,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
log = logging.getLogger("mnemo.worker")

QUEUE_KEY = "mnemo:captures"
POP_TIMEOUT_SECONDS = 5

# Engine + session maker created lazily inside the event loop in _run().
_engine = None
_SessionMaker: async_sessionmaker | None = None
_running = True


def _handle_shutdown(*_):
    global _running
    log.info("shutdown signal received")
    _running = False


async def _process_one(job: dict[str, Any], http: httpx.AsyncClient) -> None:
    user_id = job["user_id"]
    namespace_id = job["namespace_id"]
    sui_address = job["sui_address"]
    provider = job["provider"]
    request_body = job["request_body"]
    response_body = job["response_body"]

    payload = build_payload(provider=provider, request_body=request_body, response_body=response_body)
    preview = preview_of(payload)

    # Embed (prompt + response concatenated)
    text_for_embedding = (
        "\n".join(m.get("content", "") for m in payload["prompt_messages"] if isinstance(m.get("content"), str))
        + "\n\n"
        + payload["response_text"]
    )
    embedding = await embed_text(text_for_embedding)

    # Sidecar: encrypt -> remember
    payload_json = json.dumps(payload).encode("utf-8")
    plaintext_b64 = base64.b64encode(payload_json).decode("ascii")

    # WEEK 1 NOTE: pass the namespace UUID as a placeholder policy ID; mocks ignore it.
    enc_resp = (await http.post(
        f"{settings.sidecar_url}/seal/encrypt",
        json={"policyObjectId": namespace_id, "plaintext": plaintext_b64},
        timeout=20.0,
    )).json()
    ciphertext_b64 = enc_resp["ciphertext"]

    rem_resp = (await http.post(
        f"{settings.sidecar_url}/memwal/remember",
        json={
            "ownerAddress": sui_address,
            "namespaceObjectId": namespace_id,
            "ciphertext": ciphertext_b64,
            "metadata": {"ts": payload["ts"], "model": payload["model"]},
        },
        timeout=30.0,
    )).json()
    blob_id = rem_resp["walrusBlobId"]

    async with _SessionMaker() as s:
        await s.execute(
            text(
                """
                INSERT INTO entries
                       (user_id, namespace_id, walrus_blob_id, embedding,
                        model, preview, token_input, token_output, ts)
                VALUES (:uid, :ns, :bid, CAST(:emb AS vector),
                        :model, :prev, :tin, :tout, NOW())
                """
            ),
            {
                "uid": user_id,
                "ns": namespace_id,
                "bid": blob_id,
                "emb": str(embedding),
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

    # Create engine inside the event loop so asyncpg binds correctly
    _engine = create_async_engine(settings.database_url, echo=False, pool_pre_ping=True)
    _SessionMaker = async_sessionmaker(_engine, expire_on_commit=False, class_=AsyncSession)

    redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    await redis.ping()
    log.info("worker started — polling %s", QUEUE_KEY)

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
                    log.exception("failed to process capture job; dropping (Week 1)")
                    # Week 3 TODO: route to a dead-letter list mnemo:captures:dlq
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