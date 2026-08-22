"""MinIO object-storage provider — wraps services.minio_client."""

from __future__ import annotations

from services.minio_client import minio_service


class MinioObjectStorageProvider:
    def is_ready(self) -> bool:
        return minio_service.is_ready()

    def ensure_bucket(self, name: str) -> None:
        minio_service.ensure_bucket(name)

    def list_objects(self, bucket_name: str) -> list[str]:
        return minio_service.list_objects(bucket_name)

    def presigned_upload(
        self,
        bucket_name: str,
        object_name: str,
        expires_seconds: int = 3600,
    ) -> str | None:
        return minio_service.presigned_upload(bucket_name, object_name, expires_seconds)

    def presigned_download(
        self,
        bucket_name: str,
        object_name: str,
        expires_seconds: int = 3600,
    ) -> str | None:
        return minio_service.presigned_download(bucket_name, object_name, expires_seconds)


def get_object_storage_provider() -> MinioObjectStorageProvider:
    return MinioObjectStorageProvider()
