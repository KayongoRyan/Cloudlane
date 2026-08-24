import os
from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Overlays from Cloudlane ops vault (system_secrets) applied after DB connect.
_RUNTIME_OVERRIDES: dict[str, str] = {}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

    port: int = 8001
    database_url: str = 'mongodb://cloudlane:cloudlane@localhost:27017/cloudlane?authSource=admin'
    jwt_secret: str = 'dev-secret-change-in-production'
    jwt_algorithm: str = 'HS256'
    jwt_expire_minutes: int = 1440
    base_domain: str = 'cloudlane.run'
    kubernetes_config_path: str | None = Field(default=None, validation_alias='KUBECONFIG')
    environment: str = 'development'
    minio_endpoint: str = 'localhost:9010'
    minio_access_key: str = 'cloudlane'
    minio_secret_key: str = 'cloudlane-secret'
    irembopay_api_key: str = ''
    irembopay_api_url: str = 'https://api.irembopay.com'
    gateway_base_domain: str = 'gateway.cloudlane.run'
    redis_url: str = 'redis://localhost:6380/0'
    gateway_config_dir: str = 'infra/nginx/gateways'
    control_plane_rate_limit_rpm: int = 1000
    gateway_default_rate_limit_rpm: int = 1000
    worker_poll_interval_seconds: int = 2
    provision_max_attempts: int = 3
    secrets_master_key: str = ''
    # Data encryption / TLS posture
    force_https: bool = False
    mongo_tls_required: bool = False
    hsts_max_age_seconds: int = 31536000

    @property
    def is_netlify(self) -> bool:
        return bool(os.getenv('NETLIFY') or os.getenv('AWS_LAMBDA_FUNCTION_NAME'))

    @property
    def is_production(self) -> bool:
        return self.environment.lower() in ('production', 'prod') or self.is_netlify

    @property
    def require_mongo_tls(self) -> bool:
        """Atlas / production must use TLS; local docker mongo may stay plaintext."""
        if self.mongo_tls_required:
            return True
        if self.is_production:
            return True
        return False

    @property
    def enable_hsts(self) -> bool:
        return self.force_https or self.is_production


def set_runtime_overrides(values: dict[str, str]) -> None:
    """Merge vault-backed settings and bust the settings cache."""
    cleaned = {k: v for k, v in values.items() if v is not None and str(v) != ''}
    _RUNTIME_OVERRIDES.update(cleaned)
    get_settings.cache_clear()


def clear_runtime_overrides() -> None:
    _RUNTIME_OVERRIDES.clear()
    get_settings.cache_clear()


@lru_cache()
def get_settings() -> Settings:
    overrides: dict[str, str | int] = dict(_RUNTIME_OVERRIDES)
    if os.getenv('DATABASE_URL'):
        overrides['database_url'] = os.getenv('DATABASE_URL')  # type: ignore[assignment]
    elif os.getenv('MONGODB_URI'):
        overrides['database_url'] = os.getenv('MONGODB_URI')  # type: ignore[assignment]
    if os.getenv('NETLIFY') or os.getenv('AWS_LAMBDA_FUNCTION_NAME'):
        if 'database_url' not in overrides:
            overrides['database_url'] = os.getenv('DATABASE_URL') or os.getenv('MONGODB_URI') or ''
    return Settings(**overrides)
