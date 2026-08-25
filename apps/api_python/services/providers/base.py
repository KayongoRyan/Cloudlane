"""Provider driver interfaces — thin adapters over K8s, MinIO, etc."""

from __future__ import annotations

from typing import Protocol, runtime_checkable


@runtime_checkable
class ComputeProvider(Protocol):
    """Cloud Run-style workload provisioning."""

    def is_ready(self) -> bool: ...

    def create_namespace(self, namespace: str, labels: dict[str, str] | None = None) -> None: ...

    def create_deployment(
        self,
        namespace: str,
        name: str,
        image: str,
        port: int,
        replicas: int = 1,
    ) -> None: ...

    def create_service(self, namespace: str, name: str, port: int, target_port: int) -> None: ...

    def create_ingress(
        self,
        namespace: str,
        name: str,
        service_name: str,
        host: str,
        port: int,
    ) -> None: ...

    def create_scaled_object(
        self,
        namespace: str,
        name: str,
        deployment_name: str,
        min_replicas: int,
        max_replicas: int,
    ) -> None: ...

    def create_http_scaled_object(
        self,
        namespace: str,
        name: str,
        deployment_name: str,
        service_name: str,
        host_fqdn: str,
        port: int,
        min_replicas: int,
        max_replicas: int,
    ) -> None: ...

    def delete_scaled_objects(self, namespace: str, name: str) -> None: ...


@runtime_checkable
class ObjectStorageProvider(Protocol):
    """S3-compatible object storage."""

    def is_ready(self) -> bool: ...

    def ensure_bucket(self, name: str) -> None: ...

    def list_objects(self, bucket_name: str) -> list[str]: ...

    def presigned_upload(
        self,
        bucket_name: str,
        object_name: str,
        expires_seconds: int = 3600,
    ) -> str | None: ...

    def presigned_download(
        self,
        bucket_name: str,
        object_name: str,
        expires_seconds: int = 3600,
    ) -> str | None: ...
