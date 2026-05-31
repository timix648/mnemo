"""Envelope encryption for provider API keys (encrypt-at-rest).

Provider keys must be decrypted unattended by the server on every AI call,
so Seal is deliberately not used here. Memories use real Seal via the relayer;
provider keys use server-side envelope encryption (FERNET_KEY). Stored format:
"fernet:v1:<token>".
"""
import os
import logging

from cryptography.fernet import Fernet, InvalidToken

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

log = logging.getLogger("mnemo.keycrypto")

_PREFIX = "fernet:v1:"
_fernet = None


def _get():
    global _fernet
    if _fernet is None:
        key = os.environ.get("FERNET_KEY", "").strip()
        if not key:
            raise RuntimeError("FERNET_KEY is not set")
        _fernet = Fernet(key.encode())
    return _fernet


def encrypt_key(plaintext):
    token = _get().encrypt(plaintext.encode()).decode()
    return _PREFIX + token


def decrypt_key(stored):
    if not stored:
        return ""
    if not stored.startswith(_PREFIX):
        return stored
    token = stored[len(_PREFIX):]
    try:
        return _get().decrypt(token.encode()).decode()
    except InvalidToken:
        log.error("provider key failed to decrypt (wrong FERNET_KEY?)")
        raise