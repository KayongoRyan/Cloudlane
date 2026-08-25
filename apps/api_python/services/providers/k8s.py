"""Kubernetes compute provider — wraps services.kubernetes."""

from __future__ import annotations

from services.kubernetes import kubernetes_service


class KubernetesComputeProvider:
    def is_ready(self) -> bool:
        return kubernetes_service.is_ready()

    def create_namespace(self, namespace: str, labels: dict[str, str] | None = None) -> None:
        kubernetes_service.create_namespace(namespace, labels)

    def create_deployment(
        self,
        namespace: str,
        name: str,
        image: str,
        port: int,
        replicas: int = 1,
    ) -> None:
        kubernetes_service.create_deployment(namespace, name, image, port, replicas)

    def create_service(self, namespace: str, name: str, port: int, target_port: int) -> None:
        kubernetes_service.create_service(namespace, name, port, target_port)

    def create_ingress(
        self,
        namespace: str,
        name: str,
        service_name: str,
        host: str,
        port: int,
    ) -> None:
        kubernetes_service.create_ingress(namespace, name, service_name, host, port)

    def create_scaled_object(
        self,
        namespace: str,
        name: str,
        deployment_name: str,
        min_replicas: int,
        max_replicas: int,
    ) -> None:
        kubernetes_service.create_scaled_object(
            namespace, name, deployment_name, min_replicas, max_replicas
        )

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
    ) -> None:
        kubernetes_service.create_http_scaled_object(
            namespace,
            name,
            deployment_name,
            service_name,
            host_fqdn,
            port,
            min_replicas,
            max_replicas,
        )

    def delete_scaled_objects(self, namespace: str, name: str) -> None:
        kubernetes_service.delete_scaled_objects(namespace, name)


def get_compute_provider() -> KubernetesComputeProvider:
    return KubernetesComputeProvider()
