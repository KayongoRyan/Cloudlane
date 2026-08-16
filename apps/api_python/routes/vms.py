from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

import database as db
from auth import AuthContext, authenticate_request, client_ip, require_scopes
from schemas import VmCreate

router = APIRouter()


@router.get('/')
async def list_vms(
    auth: AuthContext = Depends(authenticate_request),
    projectId: str | None = Query(default=None),
):
    require_scopes(auth, 'read')
    return {'vms': db.list_vms(auth.tenant_id, projectId)}


@router.post('/', status_code=status.HTTP_201_CREATED)
async def create_vm(
    payload: VmCreate,
    request: Request,
    auth: AuthContext = Depends(authenticate_request),
):
    require_scopes(auth, 'deploy')
    project = db.get_or_create_default_project(auth.tenant_id)
    if payload.projectId:
        found = db.find_project_by_id(payload.projectId, auth.tenant_id)
        if not found:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Project not found')
        project = found

    vm = db.create_vm({
        'tenantId': auth.tenant_id,
        'projectId': project['id'],
        'name': payload.name.replace(' ', '-').lower(),
        'cpu': payload.cpu,
        'memoryMb': payload.memoryMb,
    })
    db.write_audit_log({
        'tenantId': auth.tenant_id,
        'userId': auth.user_id,
        'action': 'vm.create',
        'resourceType': 'vm',
        'resourceId': vm['id'],
        'ipAddress': client_ip(request),
    })
    return {'vm': vm}


@router.post('/{vm_id}/stop')
async def stop_vm(vm_id: str, auth: AuthContext = Depends(authenticate_request)):
    require_scopes(auth, 'deploy')
    vm = db.update_vm_status(vm_id, auth.tenant_id, 'stopped')
    if not vm:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='VM not found')
    return {'vm': vm}


@router.post('/{vm_id}/start')
async def start_vm(vm_id: str, auth: AuthContext = Depends(authenticate_request)):
    require_scopes(auth, 'deploy')
    vm = db.update_vm_status(vm_id, auth.tenant_id, 'running')
    if not vm:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='VM not found')
    return {'vm': vm}
