from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text

from mnemo_api.auth import CurrentUser, require_user
from mnemo_api.db import session

router = APIRouter(prefix="/namespaces", tags=["namespaces"])


class CreateNamespace(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    sui_object_id: str = Field(..., min_length=3, max_length=66)


@router.get("")
async def list_namespaces(user: CurrentUser = Depends(require_user)):
    async with session() as s:
        rows = (await s.execute(
            text(
                """
                SELECT id, sui_object_id, name, is_default, created_at
                  FROM namespaces WHERE user_id = :uid
                 ORDER BY is_default DESC, created_at ASC
                """
            ),
            {"uid": user.id},
        )).all()
    return [
        {
            "id": str(r.id),
            "sui_object_id": r.sui_object_id,
            "name": r.name,
            "is_default": r.is_default,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]


@router.post("")
async def create_namespace(body: CreateNamespace, user: CurrentUser = Depends(require_user)):
    async with session() as s:
        existing = (await s.execute(
            text("SELECT COUNT(*) AS c FROM namespaces WHERE user_id = :uid"),
            {"uid": user.id},
        )).scalar() or 0
        is_default = existing == 0

        row = (await s.execute(
            text(
                """
                INSERT INTO namespaces (user_id, sui_object_id, name, is_default)
                VALUES (:uid, :oid, :name, :is_default)
                RETURNING id, sui_object_id, name, is_default, created_at
                """
            ),
            {"uid": user.id, "oid": body.sui_object_id, "name": body.name, "is_default": is_default},
        )).first()
        await s.commit()

    return {
        "id": str(row.id),
        "sui_object_id": row.sui_object_id,
        "name": row.name,
        "is_default": row.is_default,
        "created_at": row.created_at.isoformat(),
    }


@router.delete("/{ns_id}")
async def delete_namespace(ns_id: UUID, user: CurrentUser = Depends(require_user)):
    async with session() as s:
        row = (await s.execute(
            text("SELECT id FROM namespaces WHERE id = :id AND user_id = :uid"),
            {"id": ns_id, "uid": user.id},
        )).first()
        if not row:
            raise HTTPException(status_code=404, detail="namespace not found")
        await s.execute(text("DELETE FROM namespaces WHERE id = :id"), {"id": ns_id})
        await s.commit()
    return {"ok": True}
