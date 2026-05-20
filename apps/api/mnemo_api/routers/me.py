from fastapi import APIRouter, Depends
from sqlalchemy import text

from mnemo_api.auth import CurrentUser, require_user
from mnemo_api.config import settings
from mnemo_api.db import session

router = APIRouter(tags=["me"])


@router.get("/me")
async def me(user: CurrentUser = Depends(require_user)):
    async with session() as s:
        row = (await s.execute(
            text(
                """
                SELECT id FROM namespaces
                 WHERE user_id = :uid
                 ORDER BY is_default DESC, created_at ASC LIMIT 1
                """
            ),
            {"uid": user.id},
        )).first()
    default_ns = str(row.id) if row else None
    return {
        "user_id": str(user.id),
        "sui_address": user.sui_address,
        "proxy_token": user.proxy_token,
        "proxy_base_url": f"{settings.proxy_base_url}/u/{user.id}",
        "default_namespace_id": default_ns,
    }
