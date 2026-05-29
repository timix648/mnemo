"""Semantic search across a user's memory (Architecture 1).

Search no longer runs a local pgvector query — the live MemWal relayer owns the
vector index and decryption. We call the relayer's recall (via the sidecar),
then enrich each hit with the lightweight metadata row in `entries`
(model / preview / token counts / source_app / ts) for display.
"""
from uuid import UUID

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


@router.post("/search")
async def search(body: SearchRequest, user: CurrentUser = Depends(require_user)):
    # 1. Verify the namespace belongs to the user, and get its relayer label.
    #    The relayer groups memories by an opaque string; we use the namespace
    #    name (falling back to sui_object_id) as that label, matching what the
    #    capture worker sends.
    async with session() as s:
        ns = (await s.execute(
            text(
                "SELECT name, sui_object_id FROM namespaces "
                "WHERE id = :id AND user_id = :uid"
            ),
            {"id": body.namespace_id, "uid": user.id},
        )).first()
    if not ns:
        raise HTTPException(status_code=404, detail="namespace not found")

    namespace_label = ns.name or ns.sui_object_id or "default"

    # 2. Ask the relayer (via the sidecar) for semantic matches + decrypted text.
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{settings.sidecar_url}/memwal/recall",
                json={
                    "ownerAddress": user.sui_address,
                    "namespaceObjectId": namespace_label,
                    "query": body.query,
                    "topK": body.top_k,
                },
            )
            resp.raise_for_status()
            recall = resp.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"recall failed: {e}")

    relayer_results = recall.get("results", [])
    if not relayer_results:
        return {"results": []}

    # 3. Enrich each hit with display metadata from `entries` (by blob_id).
    blob_ids = [r.get("blob_id") for r in relayer_results if r.get("blob_id")]
    meta_by_blob: dict[str, dict] = {}
    if blob_ids:
        async with session() as s:
            rows = (await s.execute(
                text(
                    """
                    SELECT id, walrus_blob_id, model, preview,
                           token_input, token_output, source_app, source_app_raw, ts
                      FROM entries
                     WHERE user_id = :uid
                       AND namespace_id = :ns
                       AND walrus_blob_id = ANY(:blobs)
                       AND deleted_at IS NULL
                    """
                ),
                {"uid": user.id, "ns": body.namespace_id, "blobs": blob_ids},
            )).all()
        for row in rows:
            meta_by_blob[row.walrus_blob_id] = {
                "id": str(row.id),
                "model": row.model,
                "preview": row.preview,
                "token_input": row.token_input,
                "token_output": row.token_output,
                "source_app": row.source_app,
                "source_app_raw": row.source_app_raw,
                "ts": row.ts.isoformat() if row.ts else None,
            }

    # 4. Merge: relayer gives match + decrypted text + distance; entries gives
    #    display metadata. distance is cosine distance (smaller = closer);
    #    expose score = 1 - distance for UI consistency.
    out = []
    for r in relayer_results:
        blob = r.get("blob_id")
        meta = meta_by_blob.get(blob, {})
        distance = r.get("distance")
        score = (1.0 - float(distance)) if distance is not None else None
        out.append({
            "id": meta.get("id"),
            "namespace_id": str(body.namespace_id),
            "walrus_blob_id": blob,
            "text": r.get("text"),          # decrypted memory from the relayer
            "model": meta.get("model"),
            "preview": meta.get("preview"),
            "token_input": meta.get("token_input"),
            "token_output": meta.get("token_output"),
            "source_app": meta.get("source_app"),
            "source_app_raw": meta.get("source_app_raw"),
            "ts": meta.get("ts"),
            "score": score,
        })

    return {"results": out}
