from functools import lru_cache
from pydantic import BaseSettings


class Settings(BaseSettings):
    port: int = 8001
    mongodb_uri: str = 'mongodb://localhost:27017/cloudlane'
    jwt_secret: str = 'dev-secret-change-in-production'
    jwt_algorithm: str = 'HS256'
    jwt_expire_minutes: int = 1440
    base_domain: str = 'cloudlane.run'
    kubernetes_config_path: str | None = None
    environment: str = 'development'

    class Config:
        env_file = '.env'
        env_file_encoding = 'utf-8'


@lru_cache()
def get_settings() -> Settings:
    return Settings()
