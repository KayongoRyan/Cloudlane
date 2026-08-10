from typing import Any
from kubernetes import client, config as kube_config
from config import get_settings

settings = get_settings()


class KubernetesService:
    def __init__(self) -> None:
        try:
            if settings.kubernetes_config_path:
                kube_config.load_kube_config(settings.kubernetes_config_path)
            else:
                kube_config.load_kube_config()
            self.apps_api = client.AppsV1Api()
            self.core_api = client.CoreV1Api()
            self.networking_api = client.NetworkingV1Api()
        except Exception:
            self.apps_api = None
            self.core_api = None
            self.networking_api = None

    def is_ready(self) -> bool:
        return bool(self.apps_api and self.core_api and self.networking_api)

    def create_namespace(self, namespace: str, labels: dict[str, str] | None = None) -> None:
        if not self.core_api:
            return
        metadata = client.V1ObjectMeta(name=namespace, labels=labels or {})
        body = client.V1Namespace(metadata=metadata)
        try:
            self.core_api.create_namespace(body)
        except Exception:
            pass

    def create_deployment(self, namespace: str, name: str, image: str, port: int, replicas: int = 1) -> None:
        if not self.apps_api:
            return
        container = client.V1Container(
            name=name,
            image=image,
            ports=[client.V1ContainerPort(container_port=port)],
        )
        template = client.V1PodTemplateSpec(
            metadata=client.V1ObjectMeta(labels={'app': name}),
            spec=client.V1PodSpec(containers=[container]),
        )
        spec = client.V1DeploymentSpec(
            replicas=replicas,
            selector=client.V1LabelSelector(match_labels={'app': name}),
            template=template,
        )
        deployment = client.V1Deployment(
            metadata=client.V1ObjectMeta(name=name, namespace=namespace),
            spec=spec,
        )
        try:
            self.apps_api.create_namespaced_deployment(namespace, deployment)
        except Exception:
            pass


kubernetes_service = KubernetesService()
