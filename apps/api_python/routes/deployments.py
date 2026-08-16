import re
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

import database as db
from auth import AuthContext, authenticate_request, client_ip, require_scopes
from config import get_settings
from schemas import DeploymentCreate
from services.kubernetes import kubernetes_service

router = APIRouter()


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


@router.get('/')
async def list_deployments(
    auth: AuthContext = Depends(authenticate_request),
    projectId: str | None = Query(default=None),
):
    require_scopes(auth, 'read')
    deployments = db.list_deployments(auth.tenant_id)
    if projectId:
        deployments = [d for d in deployments if d.get('projectId') == projectId]
    return {'deployments': deployments}


@router.get('/{deployment_id}')
async def get_deployment(deployment_id: str, auth: AuthContext = Depends(authenticate_request)):
    require_scopes(auth, 'read')
    deployment = db.find_deployment_by_id(deployment_id, auth.tenant_id)
    if not deployment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Deployment not found')
    return {'deployment': deployment}


@router.post('/', status_code=status.HTTP_201_CREATED)
async def create_deployment(
    payload: DeploymentCreate,
    request: Request,
    auth: AuthContext = Depends(authenticate_request),
    projectId: str | None = Query(default=None),
):
    require_scopes(auth, 'deploy')
    settings = get_settings()

    tenant = db.find_tenant(auth.tenant_id)
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Tenant not found')

    limits = tenant['limits']
    if db.count_deployments(auth.tenant_id) >= limits['maxDeployments']:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Deployment limit reached for tenant')

    project = db.get_or_create_default_project(auth.tenant_id)
    if projectId:
        found = db.find_project_by_id(projectId, auth.tenant_id)
        if not found:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Project not found')
        project = found

    slug = re.sub(r'[^a-z0-9-]', '', payload.name, flags=re.I).lower() or 'app'
    host = f'{slug}-{secrets.token_hex(3)}'
    public_url = f'https://{host}.{settings.base_domain}'
    k8s_namespace = f'tenant-{auth.tenant_id}'[:63]
    deployment_name = payload.name.replace(' ', '-').lower()
    min_instances = payload.minInstances if payload.minInstances is not None else 0
    max_instances = min(payload.maxInstances if payload.maxInstances is not None else 3, limits['maxInstances'])

    deployment = db.create_deployment({
        'tenantId': auth.tenant_id,
        'projectId': project['id'],
        'name': deployment_name,
        'slug': slug,
        'image': payload.image,
        'cpu': payload.cpu if payload.cpu is not None else 0.5,
        'memory': payload.memory if payload.memory is not None else 256,
        'minInstances': min_instances,
        'maxInstances': max_instances,
        'status': 'deploying',
        'publicUrl': public_url,
        'k8sNamespace': k8s_namespace,
        'port': payload.port,
    })

    db.write_audit_log({
        'tenantId': auth.tenant_id,
        'userId': auth.user_id,
        'action': 'deployment.create',
        'resourceType': 'deployment',
        'resourceId': deployment['id'],
        'changes': {'name': deployment_name, 'image': payload.image, 'publicUrl': public_url},
        'ipAddress': client_ip(request),
    })

    if not kubernetes_service.is_ready():
        failed = db.update_deployment_status(deployment['id'], 'pending')
        return {
            'deployment': failed,
            'warning': 'Kubernetes not configured — deployment recorded; connect a cluster to go live.',
        }

    try:
        kubernetes_service.create_namespace(
            k8s_namespace,
            {'tenant-id': auth.tenant_id, 'cloudlane.io/managed': 'true'},
        )
        kubernetes_service.create_deployment(
            k8s_namespace, deployment_name, payload.image, payload.port, min_instances or 1
        )
        kubernetes_service.create_service(k8s_namespace, deployment_name, payload.port, payload.port)
        kubernetes_service.create_ingress(
            k8s_namespace, f'{deployment_name}-ingress', deployment_name, host, payload.port
        )
        running = db.update_deployment_status(deployment['id'], 'running')
        record_deploy_usage(auth.tenant_id, deployment['id'], deployment.get('cpu', 0.5))
        return {'deployment': running}
    except Exception as exc:
        db.update_deployment_status(deployment['id'], 'failed')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc


@router.delete('/{deployment_id}', status_code=status.HTTP_204_NO_CONTENT)
async def delete_deployment(
    deployment_id: str,
    request: Request,
    auth: AuthContext = Depends(authenticate_request),
):
    require_scopes(auth, 'deploy')
    if not db.soft_delete_deployment(deployment_id, auth.tenant_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Deployment not found')
    db.write_audit_log({
        'tenantId': auth.tenant_id,
        'userId': auth.user_id,
        'action': 'deployment.delete',
        'resourceType': 'deployment',
        'resourceId': deployment_id,
        'ipAddress': client_ip(request),
    })
    return None


@router.get('/{deployment_name}/logs')
async def deployment_logs(
    deployment_name: str,
    auth: AuthContext = Depends(authenticate_request),
    tail: int = Query(default=100, ge=1, le=1000),
):
    require_scopes(auth, 'read')
    deployment = db.find_deployment_by_name(deployment_name, auth.tenant_id)
    if not deployment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Deployment not found')

    if not kubernetes_service.is_ready():
        return {'logs': f'[{deployment_name}] Kubernetes not configured — no live logs available.'}

    try:
        logs = kubernetes_service.get_deployment_logs(
            deployment['k8sNamespace'], deployment['name'], tail
        )
        return {'logs': logs}
    except Exception as exc:
        return {'logs': f'Could not fetch logs: {exc}'}
