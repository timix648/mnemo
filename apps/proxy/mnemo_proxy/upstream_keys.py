"""
Resolve the user's upstream provider key (OpenAI/Anthropic).

Order:
  1. The user's OWN key stored in provider_keys.key_material (bring-your-own-key).
     This is what bills each user's own provider account.
  2. Fallback: the env-supplied DEV_*_KEY, if set. Useful for the seeded dev
     user and for local testing without pasting a key.

SECURITY (testnet beta): key_material is read as stored (currently plaintext).
Before mainnet, swap step (1) for a Seal-decrypt via the sidecar (Use #2) so the
server never holds plaintext keys. The function signature stays identical.
"""
import logging
from typing import Optional

from sqlalchemy import text

from mnemo_proxy.auth import AuthedUser
from mnemo_proxy.config import settings
from mnemo_proxy.db import session

log = logging.getLogger("mnemo.proxy.keys")


async def _user_key(user_id, provider: str) -> Optional[str]:
    """Return the user's own stored key for this provider, or None."""
    async with session() as s:
        row = (await s.execute(
            text(
                """
                SELECT key_material
                  FROM provider_keys
                 WHERE user_id = :uid AND provider = :p
                """
            ),
            {"uid": user_id, "p": provider},
        )).first()
    if row and row.key_material:
        return row.key_material
    return None


async def get_upstream_key(user: AuthedUser, provider: str) -> Optional[str]:
    # 1. The user's own key (bring-your-own-key) takes precedence.
    try:
        own = await _user_key(user.id, provider)
    except Exception as e:
        # DB hiccup shouldn't hard-fail the call if a dev key can cover it.
        log.warning("provider_keys lookup failed for user=%s: %s", user.id, e)
        own = None
    if own:
        return own

    # 2. Fallback to the env dev key (seeded dev user / local testing).
    if provider == "openai" and settings.dev_openai_key:
        return settings.dev_openai_key
    if provider == "anthropic" and settings.dev_anthropic_key:
        return settings.dev_anthropic_key

    log.warning("no upstream key for user=%s provider=%s", user.id, provider)
    return None
