"""
Proxy authentication.

The user_id in the URL path is public. Real auth is the bearer token in
Authorization, which must match the user's `proxy_token` column. We also
load the user's default namespace (id + label) for capture jobs — the label
is the grouping string the relayer indexes under.
"""
import logging
from dataclasses import dataclass
from typing import Optional
from uuid import UUID

from sqlalchemy import text

from mnemo_proxy.db import session

log = logging.getLogger("mnemo.proxy.auth")


@dataclass
class AuthedUser:
    id: UUID
    sui_address: str
    default_namespace_id: Optional[UUID]
    default_namespace_label: Optional[str] = None


async def authenticate(user_id: str, bearer: Optional[str]) -> Optional[AuthedUser]:
    if not bearer or not bearer.startswith("Bearer "):
        return None
    token = bearer[len("Bearer "):].strip()
    if not token:
        return None

    try:
        uid = UUID(user_id)
    except ValueError:
        return None

    async with session() as s:
        row = await s.execute(
            text(
                """
                SELECT u.id, u.sui_address, u.proxy_token,
                       n.id   AS default_namespace_id,
                       n.name AS default_namespace_label
                  FROM users u
                  LEFT JOIN LATERAL (
                       SELECT id, name FROM namespaces
                        WHERE user_id = u.id
                        ORDER BY is_default DESC, created_at ASC
                        LIMIT 1
                  ) n ON TRUE
                 WHERE u.id = :uid
                """
            ),
            {"uid": uid},
        )
        rec = row.first()
        if not rec:
            return None
        if rec.proxy_token != token:
            return None
        return AuthedUser(
            id=rec.id,
            sui_address=rec.sui_address,
            default_namespace_id=rec.default_namespace_id,
            default_namespace_label=rec.default_namespace_label,
        )
