from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text

from mnemo_api.auth import CurrentUser, require_user
from mnemo_api.db import session

router = APIRouter(prefix="/keys", tags=["keys"])


class SaveKey(BaseModel):
    provider: str
    walrus_blob_id: str
    seal_policy_id: str


@router.get("")
async def list_keys(user: CurrentUser = Depends(require_user)):
    async with session() as s:
        rows = (await s.execute(
            text(
                """
                SELECT id, provider, walrus_blob_id, seal_policy_id, created_at
                  FROM provider_keys WHERE user_id = :uid
                """
            ),
            {"uid": user.id},
        )).all()
    return [
        {
            "id": str(r.id),
            "provider": r.provider,
            "walrus_blob_id": r.walrus_blob_id,
            "seal_policy_id": r.seal_policy_id,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]


@router.post("")
async def save_key(body: SaveKey, user: CurrentUser = Depends(require_user)):
    if body.provider not in ("openai", "anthropic"):
        raise HTTPException(status_code=400, detail="provider must be openai or anthropic")

    async with session() as s:
        row = (await s.execute(
            text(
                """
                INSERT INTO provider_keys (user_id, provider, walrus_blob_id, seal_policy_id)
                VALUES (:uid, :p, :bid, :sid)
                ON CONFLICT (user_id, provider)
                DO UPDATE SET walrus_blob_id = EXCLUDED.walrus_blob_id,
                              seal_policy_id = EXCLUDED.seal_policy_id
                RETURNING id, provider, walrus_blob_id, seal_policy_id, created_at
                """
            ),
            {"uid": user.id, "p": body.provider, "bid": body.walrus_blob_id, "sid": body.seal_policy_id},
        )).first()
        await s.commit()

    return {
        "id": str(row.id),
        "provider": row.provider,
        "walrus_blob_id": row.walrus_blob_id,
        "seal_policy_id": row.seal_policy_id,
        "created_at": row.created_at.isoformat(),
    }


@router.delete("/{provider}")
async def delete_key(provider: str, user: CurrentUser = Depends(require_user)):
    async with session() as s:
        await s.execute(
            text("DELETE FROM provider_keys WHERE user_id = :uid AND provider = :p"),
            {"uid": user.id, "p": provider},
        )
        await s.commit()
    return {"ok": True}
