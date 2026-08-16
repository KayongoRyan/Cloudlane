import re
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status

import database as db
from auth import AuthContext, authenticate_request, client_ip
from config import get_settings
from schemas import DeploymentCreate
from services.kubernetes import kubernetes_service

router = APIRouter()


@router.get('/')
async def list_deployments(auth: AuthContext = Depends(authenticate_request)):
    deployments = db.list_deployments(auth.tenant_id)
    return {'deployments': deployments}


@router.post('/', status_code=status.HTTP_201_CREATED)
async def create_deployment(
    payload: DeploymentCreate,
    request: Request,
    auth: AuthContext = Depends(authenticate_request),
):
    settings = get_settings()
    slug = re.sub(r'[^a-z0-9-]', '', payload.name, flags=re.I).lower() or 'app'
    host = f'{slug}-{secrets.token_hex(3)}'
    public_url = f'https://{host}.{settings.base_domain}'
    k8s_namespace = f'tenant-{auth.tenant_id}'[:63]
    deployment_name = payload.name.replace(' ', '-').lower()
    min_instances = payload.minInstances if payload.minInstances is not None else 0
    max_instances = payload.maxInstances if payload.maxInstances is not None else 3

    deployment = db.create_deployment({
        'tenantId': auth.tenant_id,
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

    try:
        kubernetes_service.create_namespace(k8s_namespace, {'tenant-id': auth.tenant_id, 'cloudlane.io/managed': 'true'})
        kubernetes_service.create_deployment(
            k8s_namespace,
            deployment_name,
            payload.image,
            payload.port,
            min_instances or 1,
        )
        running = db.update_deployment_status(deployment['id'], 'running')
        return {'deployment': running}
    except Exception as exc:
        db.update_deployment_status(deployment['id'], 'failed')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
