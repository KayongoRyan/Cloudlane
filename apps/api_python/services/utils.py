import hashlib
import secrets
import uuid


def generate_subdomain_suffix() -> str:
    return secrets.token_hex(2)


def hash_api_key(api_key: str) -> str:
    return hashlib.sha256(api_key.encode('utf-8')).hexdigest()


def generate_api_key() -> tuple[str, str]:
    key = f"cl_{uuid.uuid4().hex}"
    return key, key[:8]
