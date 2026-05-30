from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text

from mnemo_api.auth import CurrentUser, require_user
from mnemo_api.config import settings
from mnemo_api.db import session

router = APIRouter(tags=["me"])


class ProfileUpdate(BaseModel):
    display_name: str | None = None
    avatar_id: str | None = None


@router.get("/me")
async def me(user: CurrentUser = Depends(require_user)):
    async with session() as s:
        ns = (await s.execute(
            text(
                """
                SELECT id FROM namespaces
                 WHERE user_id = :uid
                 ORDER BY is_default DESC, created_at ASC LIMIT 1
                """
            ),
            {"uid": user.id},
        )).first()
        prof = (await s.execute(
            text("SELECT display_name, avatar_id FROM users WHERE id = :uid"),
            {"uid": user.id},
        )).first()

    return {
        "user_id": str(user.id),
        "sui_address": user.sui_address,
        "proxy_token": user.proxy_token,
        "proxy_base_url": f"{settings.proxy_base_url}/u/{user.id}",
        "default_namespace_id": str(ns.id) if ns else None,
        "display_name": prof.display_name if prof else None,
        "avatar_id": prof.avatar_id if prof else None,
    }


@router.patch("/me")
async def update_me(
    body: ProfileUpdate,
    user: CurrentUser = Depends(require_user),
):
    """Update the signed-in user's profile. COALESCE means a null field leaves
    the existing value untouched, so partial updates are safe."""
    async with session() as s:
        await s.execute(
            text(
                """
                UPDATE users
                   SET display_name = COALESCE(:dn, display_name),
                       avatar_id    = COALESCE(:av, avatar_id)
                 WHERE id = :uid
                """
            ),
            {"dn": body.display_name, "av": body.avatar_id, "uid": user.id},
        )
        await s.commit()
    return {"ok": True}


@router.delete("/me")
async def delete_me(user: CurrentUser = Depends(require_user)):
    """Delete the signed-in user. ON DELETE CASCADE removes their namespaces,
    provider keys, and entry metadata. On-chain objects and Walrus blobs are
    not (and cannot be) destroyed here; they simply become orphaned and
    inaccessible from the app."""
    async with session() as s:
        await s.execute(text("DELETE FROM users WHERE id = :uid"), {"uid": user.id})
        await s.commit()
    return {"deleted": True}