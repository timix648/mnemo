"""Redis-backed capture-job queue. Producer side (the proxy)."""
import json
import logging
from typing import Any

import redis.asyncio as aioredis
from mnemo_proxy.config import settings

log = logging.getLogger("mnemo.proxy.queue")
_redis: aioredis.Redis | None = None
QUEUE_KEY = "mnemo:captures"


async def init_redis() -> None:
    global _redis
    _redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    await _redis.ping()
    log.info("redis connected")


async def close_redis() -> None:
    global _redis
    if _redis is not None:
        await _redis.close()
        _redis = None


async def enqueue_capture(job: dict[str, Any]) -> None:
    """Push a capture job onto the queue. Fire-and-forget from the proxy's perspective."""
    if _redis is None:
        raise RuntimeError("redis not initialized")
    await _redis.rpush(QUEUE_KEY, json.dumps(job))
    log.debug("enqueued capture job: ns=%s provider=%s", job.get("namespace_id"), job.get("provider"))
