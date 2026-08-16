from fastapi import APIRouter, Depends, Query

import database as db
from auth import AuthContext, authenticate_request, require_scopes

router = APIRouter()


@router.get('/summary')
async def monitoring_summary(auth: AuthContext = Depends(authenticate_request)):
    require_scopes(auth, 'read')
    deployments = db.list_deployments(auth.tenant_id)
    metrics = db.list_usage_metrics(auth.tenant_id, limit=200)
    by_type: dict[str, float] = {}
    for m in metrics:
        by_type[m['metricType']] = by_type.get(m['metricType'], 0) + m['value']
    return {
        'deployments': {
            'total': len(deployments),
            'running': sum(1 for d in deployments if d['status'] == 'running'),
            'failed': sum(1 for d in deployments if d['status'] == 'failed'),
        },
        'metricsByType': by_type,
        'recentMetrics': metrics[:20],
    }


@router.get('/metrics')
async def monitoring_metrics(
    auth: AuthContext = Depends(authenticate_request),
    deploymentId: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
):
    require_scopes(auth, 'read')
    return {'usageMetrics': db.list_usage_metrics(auth.tenant_id, deploymentId, limit)}
