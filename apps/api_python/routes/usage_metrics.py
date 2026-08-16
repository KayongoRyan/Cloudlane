from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

import database as db
from auth import AuthContext, authenticate_request
from schemas import UsageMetricCreate

router = APIRouter()

METRIC_TYPES = {
    'cpu_seconds',
    'memory_mb_seconds',
    'requests',
    'idle_seconds',
    'compute_seconds',
}


@router.get('/')
async def list_metrics(
    auth: AuthContext = Depends(authenticate_request),
    deploymentId: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
):
    return {'usageMetrics': db.list_usage_metrics(auth.tenant_id, deploymentId, limit)}


@router.post('/', status_code=status.HTTP_201_CREATED)
async def create_metric(payload: UsageMetricCreate, request: Request, auth: AuthContext = Depends(authenticate_request)):
    if not auth.user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Unauthorized')

    if payload.metricType not in METRIC_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'metricType must be one of: {", ".join(sorted(METRIC_TYPES))}',
        )

    if payload.value < 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='value must be a non-negative number')

    start = datetime.fromisoformat(payload.windowStart.replace('Z', '+00:00'))
    end = datetime.fromisoformat(payload.windowEnd.replace('Z', '+00:00'))
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    if end <= start:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='windowStart/windowEnd must be valid ISO dates with end > start')

    deployment = db.find_deployment_by_id(payload.deploymentId, auth.tenant_id)
    if not deployment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Deployment not found')

    metric = db.create_usage_metric({
        'tenantId': auth.tenant_id,
        'deploymentId': payload.deploymentId,
        'metricType': payload.metricType,
        'value': payload.value,
        'windowStart': start,
        'windowEnd': end,
    })

    db.write_audit_log({
        'tenantId': auth.tenant_id,
        'userId': auth.user_id,
        'action': 'usage_metric.create',
        'resourceType': 'usage_metric',
        'resourceId': metric['id'],
        'changes': {
            'deploymentId': payload.deploymentId,
            'metricType': payload.metricType,
            'value': payload.value,
        },
    })

    return {'usageMetric': metric}
