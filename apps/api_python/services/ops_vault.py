"""Cloudlane ops vault — control-plane secrets migrated off flat .env into Mongo.

Bootstrap / root-of-trust (must stay in env or host secret store):
  - DATABASE_URL  (needed to reach Mongo)
  - SECRETS_MASTER_KEY or JWT_SECRET (Fernet key material)

Migratable keys (stored encrypted in system_secrets):
  JWT_SECRET, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, IREMBOPAY_API_KEY, REDIS_URL
"""

from __future__ import annotations

from typing import Any

import database as db
from config import get_settings, set_runtime_overrides
from services.providers import get_secret_vault_provider

# env / vault name → Settings field
OPS_SECRET_CATALOG: dict[str, dict[str, str]] = {
    'JWT_SECRET': {
        'settings_key': 'jwt_secret',
        'description': 'JWT signing secret for control-plane auth',
    },
    'MINIO_ACCESS_KEY': {
        'settings_key': 'minio_access_key',
        'description': 'MinIO / S3 access key',
    },
    'MINIO_SECRET_KEY': {
        'settings_key': 'minio_secret_key',
        'description': 'MinIO / S3 secret key',
    },
    'IREMBOPAY_API_KEY': {
        'settings_key': 'irembopay_api_key',
        'description': 'IremboPay API key',
    },
    'REDIS_URL': {
        'settings_key': 'redis_url',
        'description': 'Redis connection URL (may include password)',
    },
}

BOOTSTRAP_ONLY = {
    'DATABASE_URL': 'Mongo connection string — must stay in env to bootstrap the vault',
    'SECRETS_MASTER_KEY': 'Fernet master key — root of trust for encrypting vault values',
}


def _env_value_for(name: str) -> str:
    settings = get_settings()
    meta = OPS_SECRET_CATALOG[name]
    return str(getattr(settings, meta['settings_key'], '') or '')


def list_ops_secrets(*, include_bootstrap: bool = True) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    if include_bootstrap:
        settings = get_settings()
        for name, description in BOOTSTRAP_ONLY.items():
            if name == 'DATABASE_URL':
                set_ = bool(settings.database_url)
            else:
                set_ = bool(settings.secrets_master_key or settings.jwt_secret)
            rows.append({
                'name': name,
                'description': description,
                'scope': 'bootstrap',
                'inVault': False,
                'inEnv': set_,
                'version': None,
                'updatedAt': None,
            })

    for name, meta in OPS_SECRET_CATALOG.items():
        stored = db.find_system_secret_by_name(name)
        env_val = _env_value_for(name)
        rows.append({
            'name': name,
            'description': meta['description'],
            'scope': 'ops',
            'inVault': stored is not None,
            'inEnv': bool(env_val),
            'version': stored.get('version') if stored else None,
            'updatedAt': stored.get('updatedAt') if stored else None,
        })
    return rows


def get_ops_secret_value(name: str) -> str | None:
    if name not in OPS_SECRET_CATALOG:
        return None
    stored = db.find_system_secret_by_name(name, include_value=True)
    if stored and stored.get('value'):
        return stored['value']
    return _env_value_for(name) or None


def upsert_ops_secret(name: str, plaintext: str) -> dict[str, Any]:
    if name not in OPS_SECRET_CATALOG:
        raise ValueError(f'Unknown ops secret: {name}')
    if not plaintext:
        raise ValueError('Secret value required')
    vault = get_secret_vault_provider()
    ciphertext = vault.seal(plaintext)
    return db.upsert_system_secret(name, ciphertext)


def migrate_from_env() -> dict[str, Any]:
    """Copy current env/settings values into the ops vault (skip empty)."""
    migrated: list[str] = []
    skipped: list[str] = []
    for name in OPS_SECRET_CATALOG:
        value = _env_value_for(name)
        if not value:
            skipped.append(name)
            continue
        existing = db.find_system_secret_by_name(name)
        if existing:
            skipped.append(name)
            continue
        upsert_ops_secret(name, value)
        migrated.append(name)
    apply_ops_secrets_to_runtime()
    return {'migrated': migrated, 'skipped': skipped}


def apply_ops_secrets_to_runtime() -> list[str]:
    """Load vault values into runtime settings overlays. Returns applied names."""
    applied: list[str] = []
    overlays: dict[str, str] = {}
    for name, meta in OPS_SECRET_CATALOG.items():
        stored = db.find_system_secret_by_name(name, include_value=True)
        if not stored or not stored.get('value'):
            continue
        overlays[meta['settings_key']] = stored['value']
        applied.append(name)
    if overlays:
        set_runtime_overrides(overlays)
        _reset_dependent_clients()
    return applied


def _reset_dependent_clients() -> None:
    try:
        from services.minio_client import minio_service
        minio_service.reset()
    except Exception:
        pass
    try:
        from services import redis_client
        if hasattr(redis_client, 'reset_client'):
            redis_client.reset_client()
    except Exception:
        pass
