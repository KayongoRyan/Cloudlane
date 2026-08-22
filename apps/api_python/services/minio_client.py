from config import get_settings


class MinioService:
    def __init__(self) -> None:
        self._client = None
        self._refresh_creds()

    def _refresh_creds(self) -> None:
        settings = get_settings()
        self.endpoint = settings.minio_endpoint
        self.access_key = settings.minio_access_key
        self.secret_key = settings.minio_secret_key

    def reset(self) -> None:
        self._client = None
        self._refresh_creds()

    def _get_client(self):
        if self._client is not None:
            return self._client
        self._refresh_creds()
        try:
            from minio import Minio
            self._client = Minio(
                self.endpoint,
                access_key=self.access_key,
                secret_key=self.secret_key,
                secure=False,
            )
            return self._client
        except Exception:
            return None

    def is_ready(self) -> bool:
        return self._get_client() is not None

    def ensure_bucket(self, name: str) -> None:
        client = self._get_client()
        if not client:
            return
        if not client.bucket_exists(name):
            client.make_bucket(name)

    def list_objects(self, bucket_name: str) -> list[str]:
        client = self._get_client()
        if not client:
            return []
        try:
            return [obj.object_name for obj in client.list_objects(bucket_name)]
        except Exception:
            return []

    def presigned_upload(self, bucket_name: str, object_name: str, expires_seconds: int = 3600) -> str | None:
        client = self._get_client()
        if not client:
            return None
        from datetime import timedelta
        try:
            return client.presigned_put_object(bucket_name, object_name, expires=timedelta(seconds=expires_seconds))
        except Exception:
            return None

    def presigned_download(self, bucket_name: str, object_name: str, expires_seconds: int = 3600) -> str | None:
        client = self._get_client()
        if not client:
            return None
        from datetime import timedelta
        try:
            return client.presigned_get_object(bucket_name, object_name, expires=timedelta(seconds=expires_seconds))
        except Exception:
            return None


minio_service = MinioService()
