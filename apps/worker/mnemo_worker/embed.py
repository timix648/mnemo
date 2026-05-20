import logging
from openai import AsyncOpenAI

from mnemo_worker.config import settings

log = logging.getLogger("mnemo.worker.embed")
_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        if not settings.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY not configured for worker embeddings")
        _client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _client


async def embed_text(text: str) -> list[float]:
    """Return a 1536-dim embedding for `text` (text-embedding-3-small default)."""
    if not text.strip():
        text = "(empty)"
    # Cap input length to model limit (8192 tokens ~ 32k chars; we cap at 24k chars to be safe).
    if len(text) > 24000:
        text = text[:24000]
    client = _get_client()
    resp = await client.embeddings.create(model=settings.embedding_model, input=text)
    return resp.data[0].embedding
