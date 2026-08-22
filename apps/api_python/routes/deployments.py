import re
import secrets

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

import database as db
from auth import AuthContext, authenticate_request, client_ip, require_scopes
from config import get_settings
from schemas import DeploymentCreate
from services.quota import assert_deployment_allowed

router = APIRouter()


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


@router.post('/', status_code=status.HTTP_202_ACCEPTED)
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

    min_instances = payload.minInstances if payload.minInstances is not None else 0
    max_instances = payload.maxInstances if payload.maxInstances is not None else 3
    cpu = payload.cpu if payload.cpu is not None else 0.5
    memory = payload.memory if payload.memory is not None else 256

    # Enforce count / CPU / memory / per-deploy instance caps before enqueue.
    assert_deployment_allowed(auth.tenant_id, cpu, memory, max_instances)

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

    deployment = db.create_deployment({
        'tenantId': auth.tenant_id,
        'projectId': project['id'],
        'name': deployment_name,
        'slug': slug,
        'image': payload.image,
        'cpu': cpu,
        'memory': memory,
        'minInstances': min_instances,
        'maxInstances': max_instances,
        'status': 'provisioning',
        'statusMessage': 'Queued for provisioning',
        'publicUrl': public_url,
        'k8sNamespace': k8s_namespace,
        'port': payload.port,
    })

    job = db.create_provision_job({
        'tenantId': auth.tenant_id,
        'deploymentId': deployment['id'],
        'type': 'deployment.create',
        'payload': {
            'deploymentName': deployment_name,
            'image': payload.image,
            'port': payload.port,
            'k8sNamespace': k8s_namespace,
            'host': host,
            'minInstances': min_instances,
            'cpu': cpu,
        },
    })

    db.write_audit_log({
        'tenantId': auth.tenant_id,
        'userId': auth.user_id,
        'action': 'deployment.create',
        'resourceType': 'deployment',
        'resourceId': deployment['id'],
        'changes': {
            'name': deployment_name,
            'image': payload.image,
            'publicUrl': public_url,
            'jobId': job['id'],
        },
        'ipAddress': client_ip(request),
    })

    return {'deployment': deployment, 'jobId': job['id']}


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
    from services.kubernetes import kubernetes_service

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
