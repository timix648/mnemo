"""
Mnemo Proxy — transparent OpenAI/Anthropic-compatible HTTP gateway.

AI tools point their base URL at https://proxy.mnemo.app/u/<user_id>/v1.
We authenticate via a session bearer token, decrypt the user's stored
provider key on demand (Week 2+ via Seal; Week 1 falls back to env),
forward the request, stream the response back, and asynchronously enqueue
a capture job for the worker.
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from mnemo_proxy.config import settings
from mnemo_proxy.db import init_db, close_db
from mnemo_proxy.queue import init_redis, close_redis
from mnemo_proxy.routers import health, openai, anthropic

logging.basicConfig(
    level=settings.log_level,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
log = logging.getLogger("mnemo.proxy")


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("mnemo-proxy starting up")
    await init_db()
    await init_redis()
    yield
    await close_redis()
    await close_db()
    log.info("mnemo-proxy shut down cleanly")


app = FastAPI(
    title="Mnemo Proxy",
    description="OpenAI/Anthropic-compatible memory-capturing proxy",
    version="0.0.1",
    lifespan=lifespan,
)

app.include_router(health.router)
app.include_router(openai.router)
app.include_router(anthropic.router)
