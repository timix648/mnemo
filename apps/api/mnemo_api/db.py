from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from mnemo_api.config import settings

_engine = None
_SessionMaker: async_sessionmaker | None = None


async def init_db() -> None:
    global _engine, _SessionMaker
    _engine = create_async_engine(settings.database_url, echo=False, pool_pre_ping=True)
    _SessionMaker = async_sessionmaker(_engine, expire_on_commit=False, class_=AsyncSession)


async def close_db() -> None:
    global _engine
    if _engine is not None:
        await _engine.dispose()
        _engine = None


def session() -> AsyncSession:
    if _SessionMaker is None:
        raise RuntimeError("db not initialized")
    return _SessionMaker()
