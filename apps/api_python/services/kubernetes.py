from kubernetes import client, config as kube_config
from kubernetes.client.rest import ApiException

from config import get_settings

settings = get_settings()


class KubernetesService:
    def __init__(self) -> None:
        self.apps_api: client.AppsV1Api | None = None
        self.core_api: client.CoreV1Api | None = None
        self.networking_api: client.NetworkingV1Api | None = None
        self.custom_api: client.CustomObjectsApi | None = None
        try:
            if settings.kubernetes_config_path:
                kube_config.load_kube_config(settings.kubernetes_config_path)
            else:
                kube_config.load_kube_config()
            self.apps_api = client.AppsV1Api()
            self.core_api = client.CoreV1Api()
            self.networking_api = client.NetworkingV1Api()
            self.custom_api = client.CustomObjectsApi()
        except Exception:
            self.apps_api = None
            self.core_api = None
            self.networking_api = None
            self.custom_api = None

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
            replicas=max(int(replicas), 0),
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

    def create_scaled_object(
        self,
        namespace: str,
        name: str,
        deployment_name: str,
        min_replicas: int,
        max_replicas: int,
        *,
        cooldown_seconds: int | None = None,
        cpu_threshold: str | None = None,
    ) -> None:
        """KEDA ScaledObject — CPU utilization between min and max replicas."""
        if not self.custom_api:
            raise RuntimeError('Kubernetes custom objects API not configured')
        cfg = get_settings()
        min_r = max(int(min_replicas), 0)
        max_r = max(int(max_replicas), min_r if min_r > 0 else 1)
        # Admission webhook denies CPU/memory-only + minReplicaCount=0
        if min_r == 0:
            min_r = 1
            if max_r < 1:
                max_r = 1
        body = {
            'apiVersion': 'keda.sh/v1alpha1',
            'kind': 'ScaledObject',
            'metadata': {
                'name': f'{name}-scaler',
                'namespace': namespace,
                'labels': {
                    'app': deployment_name,
                    'cloudlane.io/managed': 'true',
                },
            },
            'spec': {
                'scaleTargetRef': {
                    'name': deployment_name,
                },
                'pollingInterval': 15,
                'cooldownPeriod': (
                    cooldown_seconds if cooldown_seconds is not None else cfg.keda_cooldown_seconds
                ),
                'minReplicaCount': min_r,
                'maxReplicaCount': max_r,
                'triggers': [
                    {
                        'type': 'cpu',
                        'metricType': 'Utilization',
                        'metadata': {
                            'value': cpu_threshold or cfg.keda_cpu_threshold,
                        },
                    },
                ],
            },
        }
        try:
            self.custom_api.create_namespaced_custom_object(
                group='keda.sh',
                version='v1alpha1',
                namespace=namespace,
                plural='scaledobjects',
                body=body,
            )
        except ApiException as exc:
            if exc.status == 409:
                return
            raise

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
        """KEDA HTTP Add-on — request-driven scale-from-zero."""
        if not self.custom_api:
            raise RuntimeError('Kubernetes custom objects API not configured')
        min_r = max(int(min_replicas), 0)
        max_r = max(int(max_replicas), 1)
        body = {
            'apiVersion': 'http.keda.sh/v1alpha1',
            'kind': 'HTTPScaledObject',
            'metadata': {
                'name': f'{name}-http',
                'namespace': namespace,
                'labels': {
                    'app': deployment_name,
                    'cloudlane.io/managed': 'true',
                },
            },
            'spec': {
                'hosts': [host_fqdn],
                'pathPrefixes': ['/'],
                'scaleTargetRef': {
                    'name': deployment_name,
                    'kind': 'Deployment',
                    'apiVersion': 'apps/v1',
                    'service': service_name,
                    'port': port,
                },
                'replicas': {
                    'min': min_r,
                    'max': max_r,
                },
            },
        }
        try:
            self.custom_api.create_namespaced_custom_object(
                group='http.keda.sh',
                version='v1alpha1',
                namespace=namespace,
                plural='httpscaledobjects',
                body=body,
            )
        except ApiException as exc:
            if exc.status == 409:
                return
            raise

    def delete_scaled_objects(self, namespace: str, name: str) -> None:
        """Best-effort remove Cloudlane ScaledObject / HTTPScaledObject."""
        if not self.custom_api:
            return
        for group, version, plural, obj_name in (
            ('keda.sh', 'v1alpha1', 'scaledobjects', f'{name}-scaler'),
            ('http.keda.sh', 'v1alpha1', 'httpscaledobjects', f'{name}-http'),
        ):
            try:
                self.custom_api.delete_namespaced_custom_object(
                    group=group,
                    version=version,
                    namespace=namespace,
                    plural=plural,
                    name=obj_name,
                )
            except ApiException as exc:
                if exc.status not in (404, 403):
                    print(f'keda delete {plural}/{obj_name} failed: {exc}')

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
