"""Data encryption helpers — transit TLS posture + at-rest vault crypto."""

from __future__ import annotations

from typing import Any
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from config import get_settings


def mongo_url_uses_tls(url: str) -> bool:
    if not url:
        return False
    if url.startswith('mongodb+srv://'):
        return True
    lower = url.lower()
    if 'ssl=true' in lower or 'tls=true' in lower:
        return True
    return False


def ensure_mongo_tls_params(url: str) -> str:
    """Append tls=true for mongodb:// URLs when TLS is required and not already set."""
    if not url or url.startswith('mongodb+srv://'):
        return url
    if mongo_url_uses_tls(url):
        return url
    settings = get_settings()
    if not settings.require_mongo_tls:
        return url
    # Skip local docker
    if 'localhost' in url or '127.0.0.1' in url:
        if settings.is_production:
            raise RuntimeError('Production DATABASE_URL cannot use localhost without TLS')
        return url
    parsed = urlparse(url)
    qs = parse_qs(parsed.query, keep_blank_values=True)
    qs['tls'] = ['true']
    new_query = urlencode({k: v[0] if len(v) == 1 else v for k, v in qs.items()}, doseq=True)
    return urlunparse(parsed._replace(query=new_query))


def encryption_status() -> dict[str, Any]:
    """Report encryption posture for health / ops (no secret values)."""
    settings = get_settings()
    url = settings.database_url or ''
    return {
        'inTransit': {
            'edgeTls': 'TLS 1.3 expected at Cloudflare / Netlify / Vercel edge',
            'originHttps': settings.enable_hsts or settings.is_production,
            'hstsEnabled': settings.enable_hsts,
            'mongoTls': mongo_url_uses_tls(url) or (
                settings.require_mongo_tls and 'localhost' not in url
            ),
            'mongoTlsRequired': settings.require_mongo_tls,
        },
        'atRest': {
            'tenantSecrets': 'Fernet (SECRETS_MASTER_KEY / JWT_SECRET)',
            'opsSecrets': 'Fernet in system_secrets collection',
            'passwords': 'bcrypt',
            'apiKeys': 'SHA-256 hashed (prefix stored plaintext for lookup)',
        },
        'bootstrap': {
            'databaseUrlInEnv': bool(url),
            'secretsMasterKeyConfigured': bool(settings.secrets_master_key),
            'environment': settings.environment,
            'productionMode': settings.is_production,
        },
    }
