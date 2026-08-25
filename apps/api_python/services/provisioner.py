from __future__ import annotations

from datetime import datetime, timedelta, timezone

import database as db
from config import get_settings
from services.providers import get_compute_provider


def record_deploy_usage(tenant_id: str, deployment_id: str, cpu: float) -> None:
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(minutes=1)
    db.create_usage_metric({
        'tenantId': tenant_id,
        'deploymentId': deployment_id,
        'metricType': 'compute_seconds',
        'value': max(cpu * 60, 1),
        'windowStart': window_start,
        'windowEnd': now,
    })


def provision_deployment(job: dict) -> None:
    """Run compute-provider provisioning for a deployment.create job. Raises on hard failure."""
    payload = job.get('payload') or {}
    deployment_id = job['deploymentId']
    tenant_id = job['tenantId']
    compute = get_compute_provider()
    settings = get_settings()

    if not compute.is_ready():
        db.update_deployment_status(
            deployment_id,
            'pending',
            'Kubernetes not configured — deployment recorded; connect a cluster to go live.',
        )
        return

    k8s_namespace = payload['k8sNamespace']
    deployment_name = payload['deploymentName']
    image = payload['image']
    port = payload['port']
    # Allow true scale-to-zero (0). Do not coerce with `or 1`.
    min_instances = int(payload.get('minInstances', 0) or 0)
    max_instances = int(payload.get('maxInstances', 3) or 3)
    if max_instances < min_instances:
        max_instances = min_instances if min_instances > 0 else 1
    host = payload['host']
    cpu = payload.get('cpu', 0.5)
    host_fqdn = f'{host}.{settings.base_domain}'

    compute.create_namespace(
        k8s_namespace,
        {'tenant-id': tenant_id, 'cloudlane.io/managed': 'true'},
    )
    compute.create_deployment(k8s_namespace, deployment_name, image, port, min_instances)
    compute.create_service(k8s_namespace, deployment_name, port, port)
    compute.create_ingress(
        k8s_namespace,
        f'{deployment_name}-ingress',
        deployment_name,
        host,
        port,
    )

    status_message = 'Deployment is live'
    if settings.keda_enabled:
        keda_notes: list[str] = []
        # KEDA admission rejects CPU/memory-only ScaledObjects with minReplicaCount=0.
        scaled_min = min_instances
        if scaled_min == 0 and not settings.keda_http_addon_enabled:
            scaled_min = 1
            keda_notes.append(
                'ScaledObject min forced to 1 (CPU scaler cannot scale from 0 — enable KEDA_HTTP_ADDON_ENABLED for true zero)'
            )
        try:
            compute.create_scaled_object(
                k8s_namespace,
                deployment_name,
                deployment_name,
                scaled_min,
                max_instances,
            )
            keda_notes.append(f'KEDA ScaledObject {scaled_min}→{max_instances}')
        except Exception as exc:
            keda_notes.append(f'KEDA ScaledObject skipped ({exc})')

        if settings.keda_http_addon_enabled and min_instances == 0:
            try:
                compute.create_http_scaled_object(
                    k8s_namespace,
                    deployment_name,
                    deployment_name,
                    deployment_name,
                    host_fqdn,
                    port,
                    min_instances,
                    max_instances,
                )
                keda_notes.append('HTTP scale-from-zero')
            except Exception as exc:
                keda_notes.append(f'HTTPScaledObject skipped ({exc})')

        status_message = 'Deployment is live — ' + '; '.join(keda_notes)

    db.update_deployment_status(deployment_id, 'running', status_message)
    record_deploy_usage(tenant_id, deployment_id, cpu)
