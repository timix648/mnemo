"""Provider API keys (bring-your-own-key).

POST /keys           store the user's provider key (used by the proxy to bill
                     that user's own provider account).
POST /keys/validate  check a key against the provider (OpenAI / Anthropic)
                     WITHOUT storing it — pings a cheap authenticated endpoint
                     and reports whether the key actually works. The onboarding
                     UI calls this before saving so a typo'd or revoked key is
                     caught immediately instead of failing capture silently.

SECURITY (testnet beta): key_material currently holds the key as provided.
This is acceptable for a closed beta among known testers. Before opening wider
or going to mainnet, replace this with Seal-encrypted storage (the blueprint's
intended design) so the server never holds plaintext keys. The list/return
paths NEVER echo the key back — only metadata (provider, a masked hint).
"""
import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text

from mnemo_api.auth import CurrentUser, require_user
from mnemo_api.db import session

log = logging.getLogger("mnemo.api.keys")
router = APIRouter(prefix="/keys", tags=["keys"])


class SaveKey(BaseModel):
    provider: str
    key: str  # the user's real provider API key (plaintext over local/TLS)


class ValidateKey(BaseModel):
    provider: str
    key: str


class ValidateResult(BaseModel):
    valid: bool
    detail: str = ""
    unreachable: bool = False


def _mask(key: str) -> str:
    """A safe hint to show in the UI without revealing the key."""
    if not key:
        return ""
    if len(key) <= 8:
        return "•" * len(key)
    return f"{key[:4]}…{key[-4:]}"


async def _check_provider_key(provider: str, key: str) -> ValidateResult:
    """Ping the provider's cheapest authenticated endpoint and interpret the
    status. 2xx / 429 => the key authenticated (429 means it got far enough to
    be rate-limited). 401 / 403 => the key is bad. Anything else / network
    error => inconclusive, let the user retry."""
    if provider == "openai":
        url = "https://api.openai.com/v1/models"
        headers = {"Authorization": f"Bearer {key}"}
        label = "OpenAI"
    elif provider == "anthropic":
        url = "https://api.anthropic.com/v1/models"
        headers = {"x-api-key": key, "anthropic-version": "2023-06-01"}
        label = "Anthropic"
    else:
        return ValidateResult(valid=False, detail="provider must be openai or anthropic")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(url, headers=headers)
    except Exception as e:
        log.warning("key validation could not reach %s: %s", label, e)
        return ValidateResult(
            valid=False,
            unreachable=True,
            detail=f"Couldn't reach {label} to verify the key. Check your connection and try again.",
        )

    if r.status_code < 300 or r.status_code == 429:
        return ValidateResult(valid=True)
    if r.status_code in (401, 403):
        return ValidateResult(
            valid=False,
            detail=f"{label} rejected this key ({r.status_code}). Double-check it's correct and active.",
        )
    return ValidateResult(
        valid=False,
        unreachable=True,
        detail=f"Couldn't confirm the key with {label} ({r.status_code}). Try again in a moment.",
    )


@router.post("/validate", response_model=ValidateResult)
async def validate_key(body: ValidateKey, user: CurrentUser = Depends(require_user)):
    if body.provider not in ("openai", "anthropic"):
        raise HTTPException(status_code=400, detail="provider must be openai or anthropic")
    if not body.key or not body.key.strip():
        raise HTTPException(status_code=400, detail="key is required")
    return await _check_provider_key(body.provider, body.key.strip())


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
