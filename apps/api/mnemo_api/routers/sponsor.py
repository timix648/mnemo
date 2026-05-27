"""Sponsor and execute Sui transactions on behalf of the signed-in user.

The frontend builds a Transaction with onlyTransactionKind:true, base64s the
bytes, and POSTs them here. We forward to Enoki using our PRIVATE API key
(the only kind that can sponsor), get back tx bytes + digest, return them.
The frontend signs the bytes with its zkLogin keypair and POSTs the signature
to /sponsor/execute to actually submit.

We enforce two things on top of the Enoki Portal allowlist:
  1. sender must equal the authenticated user's sui_address.
  2. Every allowedMoveCallTarget must be in our hardcoded allowlist
     (defense in depth in case the portal key is ever scoped too broadly).
"""
import logging
from typing import List

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from mnemo_api.auth import CurrentUser, require_user
from mnemo_api.config import settings

log = logging.getLogger("mnemo.api.sponsor")
router = APIRouter(prefix="/sponsor", tags=["sponsor"])

ENOKI_BASE = "https://api.enoki.mystenlabs.com/v1"


def _allowed_targets() -> set[str]:
    pkg = settings.mnemo_package_id
    if not pkg:
        return set()
    return {
        f"{pkg}::account::create_account",
        f"{pkg}::account::set_heir",
        f"{pkg}::account::set_dormancy",
        f"{pkg}::account::touch_activity",
    }


class SponsorRequest(BaseModel):
    transaction_kind_bytes: str  # base64
    sender: str                  # 0x...
    allowed_move_call_targets: List[str]


class SponsorResponse(BaseModel):
    bytes: str
    digest: str


@router.post("", response_model=SponsorResponse)
async def sponsor(req: SponsorRequest, user: CurrentUser = Depends(require_user)):
    if not settings.enoki_secret_key:
        raise HTTPException(500, "ENOKI_SECRET_KEY not configured")

    # Hardening: sender must be the authenticated user.
    if req.sender.lower() != user.sui_address.lower():
        raise HTTPException(403, "sender does not match authenticated user")

    # Hardening: every requested target must be in our static allowlist.
    allow = _allowed_targets()
    bad = [t for t in req.allowed_move_call_targets if t not in allow]
    if bad:
        raise HTTPException(400, f"unsupported move-call targets: {bad}")

    payload = {
        "network": settings.enoki_network,
        "transactionBlockKindBytes": req.transaction_kind_bytes,
        "sender": req.sender,
        "allowedAddresses": [req.sender],
        "allowedMoveCallTargets": req.allowed_move_call_targets,
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.post(
            f"{ENOKI_BASE}/transaction-blocks/sponsor",
            headers={
                "Authorization": f"Bearer {settings.enoki_secret_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
    if r.status_code >= 300:
        log.error("enoki sponsor failed: %s %s", r.status_code, r.text)
        raise HTTPException(502, f"enoki sponsor failed: {r.status_code} {r.text}")
    data = r.json().get("data", {})
    return SponsorResponse(bytes=data["bytes"], digest=data["digest"])


class ExecuteRequest(BaseModel):
    digest: str
    signature: str


class ExecuteResponse(BaseModel):
    digest: str


@router.post("/execute", response_model=ExecuteResponse)
async def execute(req: ExecuteRequest, user: CurrentUser = Depends(require_user)):
    if not settings.enoki_secret_key:
        raise HTTPException(500, "ENOKI_SECRET_KEY not configured")

    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(
            f"{ENOKI_BASE}/transaction-blocks/sponsor/{req.digest}",
            headers={
                "Authorization": f"Bearer {settings.enoki_secret_key}",
                "Content-Type": "application/json",
            },
            json={"signature": req.signature},
        )
    if r.status_code >= 300:
        log.error("enoki execute failed: %s %s", r.status_code, r.text)
        raise HTTPException(502, f"enoki execute failed: {r.status_code} {r.text}")
    data = r.json().get("data", {})
    return ExecuteResponse(digest=data["digest"])