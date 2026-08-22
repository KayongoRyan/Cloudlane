from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

import database as db
from auth import AuthContext, authenticate_request, client_ip, require_scopes
from schemas import DatabaseInstanceCreate, DatabaseInstanceUpdate
from services.providers import get_database_provider
from services.quota import assert_database_allowed

router = APIRouter()


@router.get('/')
async def list_database_instances(
    auth: AuthContext = Depends(authenticate_request),
    projectId: str | None = Query(default=None),
):
    require_scopes(auth, 'read')
    return {'instances': db.list_database_instances(auth.tenant_id, projectId)}


@router.post('/', status_code=status.HTTP_201_CREATED)
async def create_database_instance(
    payload: DatabaseInstanceCreate,
    request: Request,
    auth: AuthContext = Depends(authenticate_request),
):
    require_scopes(auth, 'deploy')
    assert_database_allowed(auth.tenant_id)

    project = db.get_or_create_default_project(auth.tenant_id)
    if payload.projectId:
        found = db.find_project_by_id(payload.projectId, auth.tenant_id)
        if not found:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Project not found')
        project = found

    name = payload.name.replace(' ', '-').lower()
    provider = get_database_provider()
    provisioned = provider.provision(name, payload.engine, payload.version, payload.sizeGb)

    instance = db.create_database_instance({
        'tenantId': auth.tenant_id,
        'projectId': project['id'],
        'name': name,
        **provisioned,
    })
    db.write_audit_log({
        'tenantId': auth.tenant_id,
        'userId': auth.user_id,
        'action': 'database.create',
        'resourceType': 'database_instance',
        'resourceId': instance['id'],
        'changes': {'name': name, 'engine': payload.engine},
        'ipAddress': client_ip(request),
    })
    return {'instance': instance}


@router.get('/{instance_id}')
async def get_database_instance(
    instance_id: str,
    reveal: bool = Query(default=False),
    auth: AuthContext = Depends(authenticate_request),
):
    require_scopes(auth, 'deploy' if reveal else 'read')
    instance = db.find_database_instance_by_id(
        instance_id,
        auth.tenant_id,
        include_connection=reveal,
    )
    if not instance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Database instance not found')
    return {'instance': instance}


@router.patch('/{instance_id}')
async def update_database_instance(
    instance_id: str,
    payload: DatabaseInstanceUpdate,
    auth: AuthContext = Depends(authenticate_request),
):
    require_scopes(auth, 'deploy')
    updates = payload.model_dump(exclude_none=True)
    instance = db.update_database_instance(instance_id, auth.tenant_id, updates)
    if not instance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Database instance not found')
    return {'instance': instance}


@router.delete('/{instance_id}', status_code=status.HTTP_204_NO_CONTENT)
async def delete_database_instance(
    instance_id: str,
    request: Request,
    auth: AuthContext = Depends(authenticate_request),
):
    require_scopes(auth, 'deploy')
    if not db.delete_database_instance(instance_id, auth.tenant_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Database instance not found')
    db.write_audit_log({
        'tenantId': auth.tenant_id,
        'userId': auth.user_id,
        'action': 'database.delete',
        'resourceType': 'database_instance',
        'resourceId': instance_id,
        'ipAddress': client_ip(request),
    })
    return None
