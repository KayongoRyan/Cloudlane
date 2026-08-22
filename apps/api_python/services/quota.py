from __future__ import annotations

from typing import Any

import database as db
from fastapi import HTTPException, status


def _limits_for_tenant(tenant_id: str) -> dict[str, int]:
    tenant = db.find_tenant(tenant_id)
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Tenant not found')
    return tenant['limits']


def build_quota_report(tenant_id: str) -> dict[str, Any]:
    limits = _limits_for_tenant(tenant_id)
    usage = db.summarize_tenant_usage(tenant_id)
    return {
        'limits': limits,
        'usage': usage,
        'available': {
            'deployments': max(0, limits['maxDeployments'] - int(usage['deployments'])),
            'cpu': round(max(0.0, float(limits['maxCpu']) - float(usage['totalCpu'])), 3),
            'memoryMb': max(0, int(limits['maxMemoryMb']) - int(usage['totalMemoryMb'])),
            'buckets': max(0, int(limits['maxBuckets']) - int(usage['buckets'])),
            'maxInstancesPerDeployment': limits['maxInstances'],
        },
    }


def assert_deployment_allowed(
    tenant_id: str,
    cpu: float,
    memory_mb: int,
    max_instances: int,
) -> None:
    limits = _limits_for_tenant(tenant_id)
    usage = db.summarize_tenant_usage(tenant_id)

    if int(usage['deployments']) >= limits['maxDeployments']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f'Deployment limit reached ({limits["maxDeployments"]} max)',
        )

    if max_instances > limits['maxInstances']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f'maxInstances exceeds tenant limit ({limits["maxInstances"]} max per deployment)',
        )

    requested_cpu = cpu * max_instances
    requested_memory = memory_mb * max_instances
    next_cpu = float(usage['totalCpu']) + requested_cpu
    next_memory = int(usage['totalMemoryMb']) + requested_memory

    if next_cpu > limits['maxCpu']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f'CPU quota exceeded — requested {requested_cpu} vCPU at max scale, '
                f'limit {limits["maxCpu"]} vCPU (in use {usage["totalCpu"]})'
            ),
        )

    if next_memory > limits['maxMemoryMb']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f'Memory quota exceeded — requested {requested_memory} MB at max scale, '
                f'limit {limits["maxMemoryMb"]} MB (in use {usage["totalMemoryMb"]})'
            ),
        )


def assert_bucket_allowed(tenant_id: str) -> None:
    limits = _limits_for_tenant(tenant_id)
    usage = db.summarize_tenant_usage(tenant_id)
    if int(usage['buckets']) >= limits['maxBuckets']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f'Bucket limit reached ({limits["maxBuckets"]} max)',
        )
