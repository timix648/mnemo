"""Semantic search across a user's memory."""
from uuid import UUID
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text

from mnemo_api.auth import CurrentUser, require_user
from mnemo_api.config import settings
from mnemo_api.db import session

router = APIRouter(tags=["search"])


class SearchRequest(BaseModel):
    namespace_id: UUID
    query: str = Field(..., min_length=1, max_length=2000)
    top_k: int = Field(default=10, ge=1, le=50)


async def _embed(text_in: str) -> list[float]:
    if not settings.openai_api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured in API service")
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(
            "https://api.openai.com/v1/embeddings",
            headers={"Authorization": f"Bearer {settings.openai_api_key}"},
            json={"model": settings.embedding_model, "input": text_in},
        )
        r.raise_for_status()
        data = r.json()
    return data["data"][0]["embedding"]


@router.post("/search")
async def search(body: SearchRequest, user: CurrentUser = Depends(require_user)):
    # Verify the namespace belongs to the user
    async with session() as s:
        owns = (await s.execute(
            text("SELECT 1 FROM namespaces WHERE id = :id AND user_id = :uid"),
            {"id": body.namespace_id, "uid": user.id},
        )).scalar()
        if not owns:
            raise HTTPException(status_code=404, detail="namespace not found")

    query_emb = await _embed(body.query)

    async with session() as s:
        # pgvector cosine distance: smaller is closer; score = 1 - distance
        rows = (await s.execute(
            text(
                """
                SELECT id, walrus_blob_id, model, preview, token_input, token_output, ts,
                       1 - (embedding <=> CAST(:q AS vector)) AS score
                  FROM entries
                 WHERE user_id = :uid
                   AND namespace_id = :ns
                   AND deleted_at IS NULL
                   AND embedding IS NOT NULL
                 ORDER BY embedding <=> CAST(:q AS vector)
                 LIMIT :k
                """
            ),
            {"uid": user.id, "ns": body.namespace_id, "q": str(query_emb), "k": body.top_k},
        )).all()

    return {
        "results": [
            {
                "id": str(r.id),
                "namespace_id": str(body.namespace_id),
                "walrus_blob_id": r.walrus_blob_id,
                "model": r.model,
                "preview": r.preview,
                "token_input": r.token_input,
                "token_output": r.token_output,
                "ts": r.ts.isoformat(),
                "score": float(r.score) if r.score is not None else 0.0,
            }
            for r in rows
        ]
    }
