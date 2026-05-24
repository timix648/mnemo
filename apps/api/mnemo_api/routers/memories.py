"""List captured memories (paginated) for the chat-browser UI.

This is the "list" companion to /search. Unlike /search, this does NOT call
the relayer or decrypt anything — it returns lightweight metadata rows from
the local `entries` table, which the worker populated when each conversation
was captured. The frontend uses this to render the chats page (a list of
prior conversations); clicking one can then fetch the decrypted text via
/search or a dedicated /memories/{id} endpoint (future).
"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text

from mnemo_api.auth import CurrentUser, require_user
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
