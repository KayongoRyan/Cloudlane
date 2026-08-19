import os
from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

    port: int = 8001
    database_url: str = 'mongodb://localhost:27017/cloudlane'
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

    @property
    def is_netlify(self) -> bool:
        return bool(os.getenv('NETLIFY') or os.getenv('AWS_LAMBDA_FUNCTION_NAME'))


@lru_cache()
def get_settings() -> Settings:
    database_url = os.getenv('DATABASE_URL') or os.getenv('MONGODB_URI') or 'mongodb://localhost:27017/cloudlane'
    if not database_url and (os.getenv('NETLIFY') or os.getenv('AWS_LAMBDA_FUNCTION_NAME')):
        database_url = ''
    return Settings(
        database_url=database_url,
        minio_endpoint=os.getenv('MINIO_ENDPOINT', 'localhost:9010'),
        minio_access_key=os.getenv('MINIO_ACCESS_KEY', 'cloudlane'),
        minio_secret_key=os.getenv('MINIO_SECRET_KEY', 'cloudlane-secret'),
        irembopay_api_key=os.getenv('IREMBOPAY_API_KEY', ''),
        irembopay_api_url=os.getenv('IREMBOPAY_API_URL', 'https://api.irembopay.com'),
        gateway_base_domain=os.getenv('GATEWAY_BASE_DOMAIN', 'gateway.cloudlane.run'),
        redis_url=os.getenv('REDIS_URL', 'redis://localhost:6380/0'),
        gateway_config_dir=os.getenv('GATEWAY_CONFIG_DIR', 'infra/nginx/gateways'),
    )
