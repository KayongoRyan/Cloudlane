from kubernetes import client, config as kube_config
from kubernetes.client.rest import ApiException

from config import get_settings

settings = get_settings()


class KubernetesService:
    def __init__(self) -> None:
        self.apps_api: client.AppsV1Api | None = None
        self.core_api: client.CoreV1Api | None = None
        self.networking_api: client.NetworkingV1Api | None = None
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
            raise RuntimeError('Kubernetes client not configured')
        try:
            self.core_api.read_namespace(namespace)
        except ApiException as exc:
            if exc.status != 404:
                raise
            body = client.V1Namespace(metadata=client.V1ObjectMeta(name=namespace, labels=labels or {}))
            self.core_api.create_namespace(body)

    def create_deployment(
        self,
        namespace: str,
        name: str,
        image: str,
        port: int,
        replicas: int = 1,
    ) -> None:
        if not self.apps_api:
            raise RuntimeError('Kubernetes client not configured')
        container = client.V1Container(
            name=name,
            image=image,
            ports=[client.V1ContainerPort(container_port=port, protocol='TCP')],
            resources=client.V1ResourceRequirements(
                requests={'memory': '128Mi', 'cpu': '100m'},
                limits={'memory': '512Mi', 'cpu': '500m'},
            ),
        )
        template = client.V1PodTemplateSpec(
            metadata=client.V1ObjectMeta(labels={'app': name}),
            spec=client.V1PodSpec(containers=[container]),
        )
        spec = client.V1DeploymentSpec(
            replicas=max(replicas, 0),
            selector=client.V1LabelSelector(match_labels={'app': name}),
            template=template,
        )
        deployment = client.V1Deployment(
            metadata=client.V1ObjectMeta(
                name=name,
                namespace=namespace,
                labels={'app': name, 'cloudlane.io/deployment': 'true'},
            ),
            spec=spec,
        )
        self.apps_api.create_namespaced_deployment(namespace, deployment)

    def create_service(self, namespace: str, name: str, port: int, target_port: int) -> None:
        if not self.core_api:
            raise RuntimeError('Kubernetes client not configured')
        body = client.V1Service(
            metadata=client.V1ObjectMeta(name=name, namespace=namespace, labels={'app': name}),
            spec=client.V1ServiceSpec(
                type='ClusterIP',
                ports=[client.V1ServicePort(port=port, target_port=target_port, protocol='TCP')],
                selector={'app': name},
            ),
        )
        self.core_api.create_namespaced_service(namespace, body)

    def create_ingress(self, namespace: str, ingress_name: str, service_name: str, host: str, port: int) -> None:
        if not self.networking_api:
            raise RuntimeError('Kubernetes client not configured')
        host_fqdn = f'{host}.{settings.base_domain}'
        path = client.V1HTTPIngressPath(
            path='/',
            path_type='Prefix',
            backend=client.V1IngressBackend(
                service=client.V1IngressServiceBackend(
                    name=service_name,
                    port=client.V1ServiceBackendPort(number=port),
                )
            ),
        )
        rule = client.V1IngressRule(
            host=host_fqdn,
            http=client.V1HTTPIngressRuleValue(paths=[path]),
        )
        body = client.V1Ingress(
            metadata=client.V1ObjectMeta(
                name=ingress_name,
                namespace=namespace,
                annotations={
                    'kubernetes.io/ingress.class': 'nginx',
                    'cert-manager.io/cluster-issuer': 'letsencrypt-prod',
                },
            ),
            spec=client.V1IngressSpec(
                rules=[rule],
                tls=[client.V1IngressTLS(hosts=[host_fqdn], secret_name=f'{ingress_name}-tls')],
            ),
        )
        self.networking_api.create_namespaced_ingress(namespace, body)

    def get_deployment_logs(self, namespace: str, deployment_name: str, tail_lines: int = 100) -> str:
        if not self.core_api:
            raise RuntimeError('Kubernetes client not configured')
        pods = self.core_api.list_namespaced_pod(namespace, label_selector=f'app={deployment_name}')
        logs = ''
        for pod in pods.items:
            pod_name = pod.metadata.name if pod.metadata else None
            if not pod_name:
                continue
            try:
                pod_logs = self.core_api.read_namespaced_pod_log(
                    pod_name, namespace, tail_lines=tail_lines
                )
                logs += f'[{pod_name}]\n{pod_logs}\n'
            except ApiException:
                continue
        return logs or 'No logs available yet.'


kubernetes_service = KubernetesService()
