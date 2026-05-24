"""Mnemo management API consumed by the web app."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from mnemo_api.config import settings
from mnemo_api.db import init_db, close_db
from mnemo_api.routers import health, me, namespaces, keys, search, memories

logging.basicConfig(
    level=settings.log_level,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
log = logging.getLogger("mnemo.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("mnemo-api starting up")
    await init_db()
    yield
    await close_db()
    log.info("mnemo-api shut down")


app = FastAPI(title="Mnemo API", version="0.0.1", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_allowed_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(me.router)
app.include_router(namespaces.router)
app.include_router(keys.router)
app.include_router(search.router)
app.include_router(memories.router)
