from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

import database as db
from auth import AuthContext, authenticate_request, client_ip, require_scopes
from config import get_settings
from schemas import LoadBalancerCreate, LoadBalancerUpdate
from services.lb_config import sync_lb_configs
from services.providers import get_load_balancer_provider
from services.quota import assert_load_balancer_allowed

router = APIRouter()


def _validate_tcp_port(port: int, *, exclude_lb_id: str | None = None) -> None:
    settings = get_settings()
    if not (settings.lb_tcp_port_min <= port <= settings.lb_tcp_port_max):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f'TCP listen port must be between {settings.lb_tcp_port_min} '
                f'and {settings.lb_tcp_port_max} (gateway-proxy published range)'
            ),
        )
    if db.is_tcp_lb_port_taken(port, exclude_lb_id=exclude_lb_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f'TCP port {port} is already allocated',
        )


def _sync_configs() -> None:
    try:
        sync_lb_configs()
    except Exception as exc:
        print(f'lb config sync failed: {exc}')


@router.get('')
async def list_load_balancers(
    auth: AuthContext = Depends(authenticate_request),
    projectId: str | None = Query(default=None),
):
    require_scopes(auth, 'read')
    return {'loadBalancers': db.list_load_balancers(auth.tenant_id, projectId)}


@router.post('', status_code=status.HTTP_201_CREATED)
async def create_load_balancer(
    payload: LoadBalancerCreate,
    request: Request,
    auth: AuthContext = Depends(authenticate_request),
):
    require_scopes(auth, 'deploy')
    assert_load_balancer_allowed(auth.tenant_id)

    project = db.get_or_create_default_project(auth.tenant_id)
    if payload.projectId:
        found = db.find_project_by_id(payload.projectId, auth.tenant_id)
        if not found:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Project not found')
        project = found

    if payload.targetDeploymentId:
        dep = db.find_deployment_by_id(payload.targetDeploymentId, auth.tenant_id)
        if not dep:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Target deployment not found')

    protocol = (payload.protocol or 'HTTP').upper()
    if protocol == 'TCP':
        _validate_tcp_port(payload.port)

    name = payload.name.replace(' ', '-').lower()
    provider = get_load_balancer_provider()
    provisioned = provider.provision(name, payload.scheme, payload.protocol, payload.port)

    lb = db.create_load_balancer({
        'tenantId': auth.tenant_id,
        'projectId': project['id'],
        'name': name,
        'scheme': payload.scheme,
        'protocol': payload.protocol,
        'port': payload.port,
        'targetDeploymentId': payload.targetDeploymentId,
        'dnsName': provisioned['dnsName'],
        'status': provisioned['status'],
        'statusMessage': provisioned['statusMessage'],
    })
    db.write_audit_log({
        'tenantId': auth.tenant_id,
        'userId': auth.user_id,
        'action': 'load_balancer.create',
        'resourceType': 'load_balancer',
        'resourceId': lb['id'],
        'changes': {'name': name, 'dnsName': lb.get('dnsName')},
        'ipAddress': client_ip(request),
    })
    _sync_configs()
    return {'loadBalancer': lb}


@router.get('/{lb_id}')
async def get_load_balancer(lb_id: str, auth: AuthContext = Depends(authenticate_request)):
    require_scopes(auth, 'read')
    lb = db.find_load_balancer_by_id(lb_id, auth.tenant_id)
    if not lb:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Load balancer not found')
    return {'loadBalancer': lb}


@router.patch('/{lb_id}')
async def update_load_balancer(
    lb_id: str,
    payload: LoadBalancerUpdate,
    auth: AuthContext = Depends(authenticate_request),
):
    require_scopes(auth, 'deploy')
    updates = payload.model_dump(exclude_none=True)
    if 'targetDeploymentId' in updates and updates['targetDeploymentId']:
        dep = db.find_deployment_by_id(updates['targetDeploymentId'], auth.tenant_id)
        if not dep:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Target deployment not found')
    if 'port' in updates:
        existing = db.find_load_balancer_by_id(lb_id, auth.tenant_id)
        if not existing:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Load balancer not found')
        protocol = (existing.get('protocol') or 'HTTP').upper()
        if protocol == 'TCP':
            _validate_tcp_port(int(updates['port']), exclude_lb_id=lb_id)
    lb = db.update_load_balancer(lb_id, auth.tenant_id, updates)
    if not lb:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Load balancer not found')
    _sync_configs()
    return {'loadBalancer': lb}


@router.delete('/{lb_id}', status_code=status.HTTP_204_NO_CONTENT)
async def delete_load_balancer(
    lb_id: str,
    request: Request,
    auth: AuthContext = Depends(authenticate_request),
):
    require_scopes(auth, 'deploy')
    if not db.delete_load_balancer(lb_id, auth.tenant_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Load balancer not found')
    db.write_audit_log({
        'tenantId': auth.tenant_id,
        'userId': auth.user_id,
        'action': 'load_balancer.delete',
        'resourceType': 'load_balancer',
        'resourceId': lb_id,
        'ipAddress': client_ip(request),
    })
    _sync_configs()
    return None
