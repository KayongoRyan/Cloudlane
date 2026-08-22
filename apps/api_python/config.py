import os
from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


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

    @property
    def is_netlify(self) -> bool:
        return bool(os.getenv('NETLIFY') or os.getenv('AWS_LAMBDA_FUNCTION_NAME'))


@lru_cache()
def get_settings() -> Settings:
    overrides: dict[str, str | int] = {}
    if os.getenv('DATABASE_URL'):
        overrides['database_url'] = os.getenv('DATABASE_URL')
    elif os.getenv('MONGODB_URI'):
        overrides['database_url'] = os.getenv('MONGODB_URI')
    if os.getenv('NETLIFY') or os.getenv('AWS_LAMBDA_FUNCTION_NAME'):
        if 'database_url' not in overrides:
            overrides['database_url'] = os.getenv('DATABASE_URL') or os.getenv('MONGODB_URI') or ''
    return Settings(**overrides)
