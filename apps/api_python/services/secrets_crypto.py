"""Fernet-backed secret encryption for tenant secret vaults."""

from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from config import get_settings


def _fernet() -> Fernet:
    settings = get_settings()
    raw = (settings.secrets_master_key or settings.jwt_secret or 'dev-secret-change-in-production').encode('utf-8')
    key = base64.urlsafe_b64encode(hashlib.sha256(raw).digest())
    return Fernet(key)


def encrypt_secret(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode('utf-8')).decode('utf-8')


def decrypt_secret(ciphertext: str) -> str:
    try:
        return _fernet().decrypt(ciphertext.encode('utf-8')).decode('utf-8')
    except InvalidToken as exc:
        raise ValueError('Unable to decrypt secret — master key may have changed') from exc
