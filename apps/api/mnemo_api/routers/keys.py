"""Provider API keys (bring-your-own-key).

POST /keys stores the user's own provider key so the proxy can bill that user's
own account instead of a shared dev key. The key is stored in `key_material`.

SECURITY (testnet beta): key_material currently holds the key as provided.
This is acceptable for a closed beta among known testers. Before opening wider
or going to mainnet, replace this with Seal-encrypted storage (Use #2) so the
server never holds plaintext keys. The list/return paths NEVER echo the key
back — only metadata (provider, a masked hint, created_at).
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text

from mnemo_api.auth import CurrentUser, require_user
from mnemo_api.db import session

router = APIRouter(prefix="/keys", tags=["keys"])


class SaveKey(BaseModel):
    provider: str
    key: str  # the user's real provider API key (plaintext over local/TLS)


def _mask(key: str) -> str:
    """A safe hint to show in the UI without revealing the key."""
    if not key:
        return ""
    if len(key) <= 8:
        return "•" * len(key)
    return f"{key[:4]}…{key[-4:]}"


@router.get("")
async def list_keys(user: CurrentUser = Depends(require_user)):
    async with session() as s:
        rows = (await s.execute(
            text(
                """
                SELECT id, provider, key_material, created_at
                  FROM provider_keys WHERE user_id = :uid
                """
            ),
            {"uid": user.id},
        )).all()
    # NEVER return key_material itself — only a masked hint.
    return [
        {
            "id": str(r.id),
            "provider": r.provider,
            "key_hint": _mask(r.key_material or ""),
            "has_key": bool(r.key_material),
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]


@router.post("")
async def save_key(body: SaveKey, user: CurrentUser = Depends(require_user)):
    if body.provider not in ("openai", "anthropic"):
        raise HTTPException(status_code=400, detail="provider must be openai or anthropic")
    if not body.key or not body.key.strip():
        raise HTTPException(status_code=400, detail="key is required")

    key = body.key.strip()
    async with session() as s:
        row = (await s.execute(
            text(
                """
                INSERT INTO provider_keys (user_id, provider, key_material)
                VALUES (:uid, :p, :k)
                ON CONFLICT (user_id, provider)
                DO UPDATE SET key_material = EXCLUDED.key_material
                RETURNING id, provider, key_material, created_at
                """
            ),
            {"uid": user.id, "p": body.provider, "k": key},
        )).first()
        await s.commit()

    return {
        "id": str(row.id),
        "provider": row.provider,
        "key_hint": _mask(row.key_material or ""),
        "has_key": True,
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
