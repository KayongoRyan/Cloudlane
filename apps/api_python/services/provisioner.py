from __future__ import annotations

from datetime import datetime, timedelta, timezone

import database as db
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
    min_instances = payload.get('minInstances', 0) or 1
    host = payload['host']
    cpu = payload.get('cpu', 0.5)

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

    db.update_deployment_status(deployment_id, 'running', 'Deployment is live')
    record_deploy_usage(tenant_id, deployment_id, cpu)
