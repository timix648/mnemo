"""
Management API auth. We accept two kinds of credentials for Week 1:

  1. A bearer session token that maps to users.proxy_token (simple, matches
     what the web app gets after Enoki sign-in).
  2. A dev override header X-Dev-User: <uuid> for local testing.

Week 2 swaps (1) for proper Enoki JWT verification.
"""
import os
import logging
from dataclasses import dataclass
from typing import Optional
from uuid import UUID

from fastapi import Header, HTTPException
from sqlalchemy import text

from mnemo_api.db import session

log = logging.getLogger("mnemo.api.auth")


@dataclass
class CurrentUser:
    id: UUID
    sui_address: str
    proxy_token: str


async def require_user(
    authorization: Optional[str] = Header(None),
    x_dev_user: Optional[str] = Header(None),
) -> CurrentUser:
    if x_dev_user and os.environ.get("ALLOW_DEV_HEADER", "true").lower() == "true":
        try:
            uid = UUID(x_dev_user)
        except ValueError:
            raise HTTPException(status_code=401, detail="invalid X-Dev-User")
        async with session() as s:
            row = (await s.execute(
                text("SELECT id, sui_address, proxy_token FROM users WHERE id = :uid"),
                {"uid": uid},
            )).first()
            if not row:
                raise HTTPException(status_code=401, detail="X-Dev-User not found")
            return CurrentUser(id=row.id, sui_address=row.sui_address, proxy_token=row.proxy_token)

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="missing bearer token")
    token = authorization[len("Bearer "):].strip()
    async with session() as s:
        row = (await s.execute(
            text("SELECT id, sui_address, proxy_token FROM users WHERE proxy_token = :t"),
            {"t": token},
        )).first()
        if not row:
            raise HTTPException(status_code=401, detail="invalid token")
        return CurrentUser(id=row.id, sui_address=row.sui_address, proxy_token=row.proxy_token)
