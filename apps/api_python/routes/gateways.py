from __future__ import annotations

import re
import secrets

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

import database as db
from auth import AuthContext, authenticate_request, client_ip, require_scopes
from config import get_settings
from schemas import (
    GatewayCreate,
    GatewayKeyCreate,
    GatewayRouteCreate,
    GatewayRouteUpdate,
    GatewayUpdate,
)
from services.gateway_config import generate_deploy_preview, sync_gateway_configs
from services.utils import generate_gateway_key, hash_api_key

router = APIRouter()


def _sync_configs() -> None:
    try:
        sync_gateway_configs()
    except Exception as exc:
        print(f'gateway config sync failed: {exc}')


def _gateway_hostname(slug: str, project_slug: str) -> str:
    settings = get_settings()
    return f'{slug}-{project_slug}.{settings.gateway_base_domain}'


def _validate_route_target(tenant_id: str, project_id: str | None, deployment_id: str) -> dict:
    deployment = db.find_deployment_by_id(deployment_id, tenant_id)
    if not deployment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Target deployment not found')
    if deployment.get('status') != 'running':
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Target deployment must be running')
    if not deployment.get('publicUrl'):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Target deployment has no public URL')
    if project_id and deployment.get('projectId') and deployment['projectId'] != project_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Deployment must belong to the same project')
    return deployment


def _validate_path(path: str) -> str:
    if not path.startswith('/'):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Path must start with /')
    return path


@router.get('')
async def list_gateways(
    auth: AuthContext = Depends(authenticate_request),
    projectId: str | None = Query(default=None),
):
    require_scopes(auth, 'read', 'gateway:read')
    gateways = db.list_gateways(auth.tenant_id, projectId)
    enriched = []
    for gw in gateways:
        enriched.append({**gw, 'routeCount': db.count_gateway_routes(gw['id'])})
    return {'gateways': enriched}


@router.post('', status_code=status.HTTP_201_CREATED)
async def create_gateway(
    payload: GatewayCreate,
    request: Request,
    auth: AuthContext = Depends(authenticate_request),
):
    require_scopes(auth, 'deploy', 'gateway:write')
    project = db.get_or_create_default_project(auth.tenant_id)
    if payload.projectId:
        found = db.find_project_by_id(payload.projectId, auth.tenant_id)
        if not found:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Project not found')
        project = found

    slug = re.sub(r'[^a-z0-9-]', '', payload.name, flags=re.I).lower() or 'gateway'
    slug = f'{slug}-{secrets.token_hex(2)}'
    if db.find_gateway_by_slug(slug, auth.tenant_id):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='Gateway slug already exists')

    hostname = _gateway_hostname(slug, project['slug'])
    gateway = db.create_gateway({
        'tenantId': auth.tenant_id,
        'projectId': project['id'],
        'name': payload.name.strip(),
        'slug': slug,
        'hostnames': [hostname],
        'defaultStage': payload.defaultStage,
        'status': 'active',
    })
    db.write_audit_log({
        'tenantId': auth.tenant_id,
        'userId': auth.user_id,
        'action': 'gateway.create',
        'resourceType': 'gateway',
        'resourceId': gateway['id'],
        'ipAddress': client_ip(request),
    })
    _sync_configs()
    return {'gateway': {**gateway, 'routeCount': 0}}


@router.get('/{gateway_id}')
async def get_gateway(gateway_id: str, auth: AuthContext = Depends(authenticate_request)):
    require_scopes(auth, 'read', 'gateway:read')
    gateway = db.find_gateway_by_id(gateway_id, auth.tenant_id)
    if not gateway:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Gateway not found')
    return {'gateway': {**gateway, 'routeCount': db.count_gateway_routes(gateway_id)}}


@router.patch('/{gateway_id}')
async def update_gateway(
    gateway_id: str,
    payload: GatewayUpdate,
    request: Request,
    auth: AuthContext = Depends(authenticate_request),
):
    require_scopes(auth, 'deploy', 'gateway:write')
    gateway = db.find_gateway_by_id(gateway_id, auth.tenant_id)
    if not gateway:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Gateway not found')

    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        return {'gateway': gateway}

    updated = db.update_gateway(gateway_id, auth.tenant_id, updates)
    db.write_audit_log({
        'tenantId': auth.tenant_id,
        'userId': auth.user_id,
        'action': 'gateway.update',
        'resourceType': 'gateway',
        'resourceId': gateway_id,
        'changes': updates,
        'ipAddress': client_ip(request),
    })
    _sync_configs()
    return {'gateway': updated}


@router.delete('/{gateway_id}', status_code=status.HTTP_204_NO_CONTENT)
async def delete_gateway(
    gateway_id: str,
    request: Request,
    auth: AuthContext = Depends(authenticate_request),
):
    require_scopes(auth, 'deploy', 'gateway:write')
    gateway = db.find_gateway_by_id(gateway_id, auth.tenant_id)
    if not gateway:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Gateway not found')
    db.delete_gateway(gateway_id, auth.tenant_id)
    db.write_audit_log({
        'tenantId': auth.tenant_id,
        'userId': auth.user_id,
        'action': 'gateway.delete',
        'resourceType': 'gateway',
        'resourceId': gateway_id,
        'ipAddress': client_ip(request),
    })
    _sync_configs()
    return None


@router.get('/{gateway_id}/routes')
async def list_routes(gateway_id: str, auth: AuthContext = Depends(authenticate_request)):
    require_scopes(auth, 'read', 'gateway:read')
    gateway = db.find_gateway_by_id(gateway_id, auth.tenant_id)
    if not gateway:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Gateway not found')
    return {'routes': db.list_gateway_routes(gateway_id)}


@router.post('/{gateway_id}/routes', status_code=status.HTTP_201_CREATED)
async def create_route(
    gateway_id: str,
    payload: GatewayRouteCreate,
    request: Request,
    auth: AuthContext = Depends(authenticate_request),
):
    require_scopes(auth, 'deploy', 'gateway:write')
    gateway = db.find_gateway_by_id(gateway_id, auth.tenant_id)
    if not gateway:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Gateway not found')

    path = _validate_path(payload.path.strip())
    _validate_route_target(auth.tenant_id, gateway.get('projectId'), payload.targetDeploymentId)

    try:
        route = db.create_gateway_route({
            'gatewayId': gateway_id,
            'stage': payload.stage,
            'method': payload.method.upper(),
            'path': path,
            'targetDeploymentId': payload.targetDeploymentId,
            'stripPathPrefix': payload.stripPathPrefix,
            'timeoutMs': payload.timeoutMs,
        })
    except Exception as exc:
        if 'duplicate key' in str(exc).lower():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='Route already exists for this stage') from exc
        raise

    db.write_audit_log({
        'tenantId': auth.tenant_id,
        'userId': auth.user_id,
        'action': 'gateway.route.create',
        'resourceType': 'gateway_route',
        'resourceId': route['id'],
        'ipAddress': client_ip(request),
    })
    _sync_configs()
    return {'route': route}


@router.patch('/{gateway_id}/routes/{route_id}')
async def update_route(
    gateway_id: str,
    route_id: str,
    payload: GatewayRouteUpdate,
    request: Request,
    auth: AuthContext = Depends(authenticate_request),
):
    require_scopes(auth, 'deploy', 'gateway:write')
    gateway = db.find_gateway_by_id(gateway_id, auth.tenant_id)
    if not gateway:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Gateway not found')
    existing = db.find_gateway_route_by_id(route_id, gateway_id)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Route not found')

    updates = payload.model_dump(exclude_unset=True)
    if 'path' in updates:
        updates['path'] = _validate_path(updates['path'].strip())
    if 'method' in updates:
        updates['method'] = updates['method'].upper()
    if payload.targetDeploymentId:
        _validate_route_target(auth.tenant_id, gateway.get('projectId'), payload.targetDeploymentId)

    route = db.update_gateway_route(route_id, gateway_id, updates)
    db.write_audit_log({
        'tenantId': auth.tenant_id,
        'userId': auth.user_id,
        'action': 'gateway.route.update',
        'resourceType': 'gateway_route',
        'resourceId': route_id,
        'changes': updates,
        'ipAddress': client_ip(request),
    })
    _sync_configs()
    return {'route': route}


@router.delete('/{gateway_id}/routes/{route_id}', status_code=status.HTTP_204_NO_CONTENT)
async def delete_route(
    gateway_id: str,
    route_id: str,
    request: Request,
    auth: AuthContext = Depends(authenticate_request),
):
    require_scopes(auth, 'deploy', 'gateway:write')
    gateway = db.find_gateway_by_id(gateway_id, auth.tenant_id)
    if not gateway:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Gateway not found')
    if not db.delete_gateway_route(route_id, gateway_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Route not found')
    db.write_audit_log({
        'tenantId': auth.tenant_id,
        'userId': auth.user_id,
        'action': 'gateway.route.delete',
        'resourceType': 'gateway_route',
        'resourceId': route_id,
        'ipAddress': client_ip(request),
    })
    _sync_configs()
    return None


@router.get('/{gateway_id}/keys')
async def list_keys(gateway_id: str, auth: AuthContext = Depends(authenticate_request)):
    require_scopes(auth, 'read', 'gateway:read')
    gateway = db.find_gateway_by_id(gateway_id, auth.tenant_id)
    if not gateway:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Gateway not found')
    return {'keys': db.list_gateway_keys(gateway_id, auth.tenant_id)}


@router.post('/{gateway_id}/keys', status_code=status.HTTP_201_CREATED)
async def create_key(
    gateway_id: str,
    payload: GatewayKeyCreate,
    request: Request,
    auth: AuthContext = Depends(authenticate_request),
):
    require_scopes(auth, 'deploy', 'gateway:write')
    gateway = db.find_gateway_by_id(gateway_id, auth.tenant_id)
    if not gateway:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Gateway not found')

    raw_key, prefix = generate_gateway_key()
    record = db.create_gateway_key({
        'gatewayId': gateway_id,
        'tenantId': auth.tenant_id,
        'name': payload.name or 'Consumer key',
        'keyHash': hash_api_key(raw_key),
        'prefix': prefix,
        'scopes': payload.scopes or ['invoke'],
        'rateLimitRpm': payload.rateLimitRpm,
    })
    db.write_audit_log({
        'tenantId': auth.tenant_id,
        'userId': auth.user_id,
        'action': 'gateway.key.create',
        'resourceType': 'gateway_key',
        'resourceId': record['id'],
        'ipAddress': client_ip(request),
    })
    _sync_configs()
    return {'key': raw_key, 'gatewayKey': record}


@router.delete('/{gateway_id}/keys/{key_id}', status_code=status.HTTP_204_NO_CONTENT)
async def revoke_key(
    gateway_id: str,
    key_id: str,
    request: Request,
    auth: AuthContext = Depends(authenticate_request),
):
    require_scopes(auth, 'deploy', 'gateway:write')
    gateway = db.find_gateway_by_id(gateway_id, auth.tenant_id)
    if not gateway:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Gateway not found')
    if not db.revoke_gateway_key(key_id, gateway_id, auth.tenant_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Key not found')
    db.write_audit_log({
        'tenantId': auth.tenant_id,
        'userId': auth.user_id,
        'action': 'gateway.key.revoke',
        'resourceType': 'gateway_key',
        'resourceId': key_id,
        'ipAddress': client_ip(request),
    })
    _sync_configs()
    return None


@router.get('/{gateway_id}/deploy')
async def deploy_preview(gateway_id: str, auth: AuthContext = Depends(authenticate_request)):
    require_scopes(auth, 'read', 'gateway:read')
    gateway = db.find_gateway_by_id(gateway_id, auth.tenant_id)
    if not gateway:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Gateway not found')
    routes = db.list_gateway_routes(gateway_id)
    config = generate_deploy_preview(gateway, routes)
    return {'config': config, 'hostnames': gateway.get('hostnames') or []}
