"""
Management API auth — identity resolution + first-sign-in auto-provisioning.

Resolution order:
  1. X-Sui-Address: 0x...   The signed-in zkLogin address. If no user row
     exists for it yet, we AUTO-PROVISION one (user row + a default namespace)
     on first use. This is what gives each real tester their own isolated data.
  2. Authorization: Bearer <proxy_token>   Maps to users.proxy_token.
  3. X-Dev-User: <uuid>     Local dev override; looks up by primary key.

==============================================================================
SECURITY — READ BEFORE MAINNET
------------------------------------------------------------------------------
Path (1) TRUSTS the address in the header. A client could put someone else's
address there and read their data. This is acceptable for a CLOSED TESTNET BETA
among known testers; it is NOT acceptable for mainnet.

The upgrade to mainnet is small and surgical: replace path (1)'s
"read address from the header" with "verify the Enoki / zkLogin JWT and read
the address from the verified claims." Everything below — provisioning,
namespace creation, isolation by user_id — stays EXACTLY the same; only the
source of the trusted address changes. Disable path (1) entirely in production
by setting ALLOW_ADDRESS_AUTH=0 once JWT verification is in place.
==============================================================================
"""
import os
import logging
import secrets
from dataclasses import dataclass
from typing import Optional
from uuid import UUID

from fastapi import Header, HTTPException
from sqlalchemy import text

from mnemo_api.db import session

log = logging.getLogger("mnemo.api.auth")

_SUI_ADDR_LEN = 66  # "0x" + 64 hex chars


@dataclass
class CurrentUser:
    id: UUID
    sui_address: str
    proxy_token: str


def _looks_like_sui_address(addr: str) -> bool:
    return (
        isinstance(addr, str)
        and addr.startswith("0x")
        and len(addr) == _SUI_ADDR_LEN
        and all(c in "0123456789abcdef" for c in addr[2:])
    )


async def _get_or_provision(s, sui_address: str) -> CurrentUser:
    """Return the user for this address, creating it (and a default namespace)
    on first sight. Race-safe via ON CONFLICT: if two requests provision the
    same brand-new address simultaneously, one INSERT wins and the other
    re-reads the existing row."""
    row = (await s.execute(
        text("SELECT id, sui_address, proxy_token FROM users WHERE sui_address = :addr"),
        {"addr": sui_address},
    )).first()
    if row:
        return CurrentUser(id=row.id, sui_address=row.sui_address, proxy_token=row.proxy_token)

    proxy_token = secrets.token_hex(16)  # 32 chars, fits VARCHAR(64)
    row = (await s.execute(
        text(
            """
            INSERT INTO users (sui_address, proxy_token)
            VALUES (:addr, :tok)
            ON CONFLICT (sui_address) DO NOTHING
            RETURNING id, sui_address, proxy_token
            """
        ),
        {"addr": sui_address, "tok": proxy_token},
    )).first()

    if row is None:
        # Lost the race — someone else just created it. Read it back.
        await s.commit()
        row = (await s.execute(
            text("SELECT id, sui_address, proxy_token FROM users WHERE sui_address = :addr"),
            {"addr": sui_address},
        )).first()
        return CurrentUser(id=row.id, sui_address=row.sui_address, proxy_token=row.proxy_token)

    # New user — give them a default namespace so the UI always has somewhere
    # to read/write. sui_object_id is seeded with the address as a placeholder;
    # the onboarding flow's on-chain MemWalAccount id can replace it later.
    await s.execute(
        text(
            """
            INSERT INTO namespaces (user_id, sui_object_id, name, is_default)
            VALUES (:uid, :oid, :name, TRUE)
            """
        ),
        {"uid": row.id, "oid": sui_address, "name": "Default"},
    )
    await s.commit()
    log.info("provisioned new user %s for %s", row.id, sui_address)
    return CurrentUser(id=row.id, sui_address=row.sui_address, proxy_token=row.proxy_token)


async def require_user(
    authorization: Optional[str] = Header(None),
    x_dev_user: Optional[str] = Header(None),
    x_sui_address: Optional[str] = Header(None),
) -> CurrentUser:
    # --- Path 1: zkLogin address (auto-provisioning) ---
    if x_sui_address and os.environ.get("ALLOW_ADDRESS_AUTH", "true").lower() == "true":
        addr = x_sui_address.strip().lower()
        if not _looks_like_sui_address(addr):
            raise HTTPException(status_code=401, detail="invalid X-Sui-Address")
        async with session() as s:
            return await _get_or_provision(s, addr)

    # --- Path 2: dev override (local only) ---
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

    # --- Path 3: bearer proxy_token ---
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="missing credentials")
    token = authorization[len("Bearer "):].strip()
    async with session() as s:
        row = (await s.execute(
            text("SELECT id, sui_address, proxy_token FROM users WHERE proxy_token = :t"),
            {"t": token},
        )).first()
        if not row:
            raise HTTPException(status_code=401, detail="invalid token")
        return CurrentUser(id=row.id, sui_address=row.sui_address, proxy_token=row.proxy_token)
