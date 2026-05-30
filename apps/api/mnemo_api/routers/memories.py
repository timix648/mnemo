"""List captured memories (paginated) for the chat-browser UI.

Three routes:
- GET  /memories         — paginated list, metadata only, no decryption.
- GET  /memories/{id}    — fetch one memory's full decrypted text. Goes through
                           the sidecar's /memwal/fetch which wraps the relayer's
                           engine.fetch_one primitive (cache → Walrus → Seal
                           decrypt). Deterministic — NOT a semantic search.
- DELETE /memories/{id}  — soft delete (sets deleted_at on the metadata row).
                           The encrypted blob stays on Walrus + in the relayer.
"""
from typing import Optional
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text

from mnemo_api.auth import CurrentUser, require_user
from mnemo_api.config import settings
from mnemo_api.db import session

router = APIRouter(prefix="/memories", tags=["memories"])


@router.get("")
async def list_memories(
    user: CurrentUser = Depends(require_user),
    namespace_id: Optional[UUID] = Query(
        default=None,
        description="Filter to one namespace. Omit to list across all the user's namespaces.",
    ),
    source_app: Optional[str] = Query(
        default=None,
        description="Filter by source-app label (e.g. 'cursor', 'bolt_ai'). Case-sensitive.",
    ),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    """Return paginated metadata for captured memories, newest first.

    Filters out soft-deleted rows. Sorted by `ts DESC` to match the
    `entries_user_ns_ts` index for efficient pagination.
    """
    # Optional namespace ownership check — only when a namespace_id is provided.
    if namespace_id is not None:
        async with session() as s:
            ns = (await s.execute(
                text("SELECT id FROM namespaces WHERE id = :id AND user_id = :uid"),
                {"id": namespace_id, "uid": user.id},
            )).first()
        if not ns:
            raise HTTPException(status_code=404, detail="namespace not found")

    # Build the query — same shape whether or not namespace_id is set.
    where_clauses = ["user_id = :uid", "deleted_at IS NULL"]
    params: dict = {"uid": user.id, "limit": limit, "offset": offset}
    if namespace_id is not None:
        where_clauses.append("namespace_id = :ns")
        params["ns"] = namespace_id
    if source_app is not None:
        where_clauses.append("source_app = :sapp")
        params["sapp"] = source_app

    where_sql = " AND ".join(where_clauses)

    async with session() as s:
        rows = (await s.execute(
            text(
                f"""
                SELECT id, namespace_id, walrus_blob_id, model, preview,
                       token_input, token_output, source_app, source_app_raw, ts
                  FROM entries
                 WHERE {where_sql}
                 ORDER BY ts DESC
                 LIMIT :limit OFFSET :offset
                """
            ),
            params,
        )).all()

        total = (await s.execute(
            text(f"SELECT COUNT(*) AS c FROM entries WHERE {where_sql}"),
            {k: v for k, v in params.items() if k not in ("limit", "offset")},
        )).scalar() or 0

    results = [
        {
            "id": str(r.id),
            "namespace_id": str(r.namespace_id),
            "walrus_blob_id": r.walrus_blob_id,
            "model": r.model,
            "preview": r.preview,
            "token_input": r.token_input,
            "token_output": r.token_output,
            "source_app": r.source_app,
            "source_app_raw": r.source_app_raw,
            "ts": r.ts.isoformat() if r.ts else None,
        }
        for r in rows
    ]

    return {
        "results": results,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/{memory_id}")
async def get_memory(
    memory_id: UUID,
    user: CurrentUser = Depends(require_user),
):
    """Fetch one captured memory's FULL decrypted text by id.

    Deterministic: looks up the entry row (Postgres metadata), then asks the
    sidecar to fetch + decrypt the blob from Walrus via the relayer's
    engine.fetch_one primitive. Does NOT run a vector search — this is a
    direct by-id lookup so the chats UI can reliably load a specific
    conversation without depending on semantic match quality.

    Ownership is enforced by the WHERE clause (user_id = :uid). Returns
    404 if the memory doesn't exist, belongs to a different user, has been
    soft-deleted, or the blob is no longer retrievable (Walrus 404 / Seal
    decrypt failure / UTF-8 error — the relayer's engine returns Ok(None)
    in all those cases and the sidecar surfaces it as a 404).

    Namespace label resolution mirrors what the capture worker sends to the
    relayer, so the fetch lands in the same partition the capture wrote to:
        sui_object_id  →  name  →  "default"
    (The relayer's vector_entries column shows real captures live under
    sui_object_id when set — that's the source of truth.)
    """
    # 1. Look up the entry. The WHERE clause enforces ownership +
    #    not-soft-deleted, so a malformed/foreign id falls through to 404.
    async with session() as s:
        row = (await s.execute(
            text(
                """
                SELECT e.id, e.namespace_id, e.walrus_blob_id, e.model,
                       e.preview, e.token_input, e.token_output,
                       e.source_app, e.source_app_raw, e.ts,
                       n.name AS namespace_name, n.sui_object_id
                  FROM entries e
                  JOIN namespaces n ON n.id = e.namespace_id
                 WHERE e.id = :mid
                   AND e.user_id = :uid
                   AND e.deleted_at IS NULL
                """
            ),
            {"mid": memory_id, "uid": user.id},
        )).first()

    if not row:
        raise HTTPException(status_code=404, detail="memory not found")

    # Match the relayer's actual stored partition: sui_object_id first
    # (that's what the index has for current captures), name as fallback,
    # "default" last-ditch.
    namespace_label = row.sui_object_id or row.namespace_name or "default"

    # 2. Ask the sidecar to fetch + decrypt the blob.
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{settings.sidecar_url}/memwal/fetch",
                json={
                    "ownerAddress": user.sui_address,
                    "namespaceObjectId": namespace_label,
                    "walrusBlobId": row.walrus_blob_id,
                },
            )
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"sidecar unreachable: {e}")

    if resp.status_code == 404:
        # Metadata exists but the blob isn't retrievable. Surfaces as 404
        # so the frontend can show its "couldn't load" state cleanly.
        raise HTTPException(status_code=404, detail="memory text unavailable")
    if resp.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail=f"fetch failed: {resp.status_code} {resp.text[:300]}",
        )

    payload = resp.json()

    return {
        "id": str(row.id),
        "namespace_id": str(row.namespace_id),
        "walrus_blob_id": row.walrus_blob_id,
        "text": payload.get("text"),
        "model": row.model,
        "preview": row.preview,
        "token_input": row.token_input,
        "token_output": row.token_output,
        "source_app": row.source_app,
        "source_app_raw": row.source_app_raw,
        "ts": row.ts.isoformat() if row.ts else None,
    }


@router.delete("/{memory_id}")
async def delete_memory(memory_id: UUID, user: CurrentUser = Depends(require_user)):
    """Soft-delete a memory (sets deleted_at). The encrypted blob remains
    on Walrus and in the relayer's vector_entries — only the user-facing
    metadata row is hidden. For full deletion, the relayer would need a
    separate purge call (future)."""
    async with session() as s:
        row = (await s.execute(
            text(
                "SELECT id FROM entries WHERE id = :id AND user_id = :uid "
                "AND deleted_at IS NULL"
            ),
            {"id": memory_id, "uid": user.id},
        )).first()
        if not row:
            raise HTTPException(status_code=404, detail="memory not found")
        await s.execute(
            text("UPDATE entries SET deleted_at = NOW() WHERE id = :id"),
            {"id": memory_id},
        )
        await s.commit()
    return {"ok": True}