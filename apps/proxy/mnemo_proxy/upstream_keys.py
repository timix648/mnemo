"""
Resolve the user's upstream provider key (OpenAI/Anthropic).

WEEK 1: returns the env-supplied DEV_*_KEY if set. This lets us prove the
end-to-end proxy flow before we wire Seal.

WEEK 2: calls the sidecar to Seal-decrypt the stored provider_keys row.
"""
import logging
from typing import Optional

from mnemo_proxy.auth import AuthedUser
from mnemo_proxy.config import settings

log = logging.getLogger("mnemo.proxy.keys")


async def get_upstream_key(user: AuthedUser, provider: str) -> Optional[str]:
    if provider == "openai" and settings.dev_openai_key:
        return settings.dev_openai_key
    if provider == "anthropic" and settings.dev_anthropic_key:
        return settings.dev_anthropic_key

    # WEEK 2 TODO: replace with sidecar-mediated Seal decrypt:
    #
    #   resp = await sidecar_client.post("/seal/decrypt", json={
    #       "policyObjectId": pk.seal_policy_id,
    #       "ciphertext": pk.walrus_blob_id_encrypted_key,
    #       "requesterAddress": user.sui_address,
    #   })
    #   return base64.b64decode(resp["plaintext"]).decode()
    log.warning("no upstream key configured for user=%s provider=%s", user.id, provider)
    return None
