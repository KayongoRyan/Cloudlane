from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

import database as db
from auth import AuthContext, authenticate_request, client_ip, require_scopes
from schemas import SecretCreate, SecretUpdate
from services.providers import get_secret_vault_provider
from services.quota import assert_secret_allowed

router = APIRouter()


@router.get('')
async def list_secrets(
    auth: AuthContext = Depends(authenticate_request),
    projectId: str | None = Query(default=None),
):
    require_scopes(auth, 'read')
    return {'secrets': db.list_secrets(auth.tenant_id, projectId)}


@router.post('', status_code=status.HTTP_201_CREATED)
async def create_secret(
    payload: SecretCreate,
    request: Request,
    auth: AuthContext = Depends(authenticate_request),
):
    require_scopes(auth, 'deploy')
    assert_secret_allowed(auth.tenant_id)

    name = payload.name.strip()
    if db.find_secret_by_name(name, auth.tenant_id):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='Secret already exists')

    project = db.get_or_create_default_project(auth.tenant_id)
    if payload.projectId:
        found = db.find_project_by_id(payload.projectId, auth.tenant_id)
        if not found:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Project not found')
        project = found

    vault = get_secret_vault_provider()
    secret = db.create_secret({
        'tenantId': auth.tenant_id,
        'projectId': project['id'],
        'name': name,
        'ciphertext': vault.seal(payload.value),
    })
    db.write_audit_log({
        'tenantId': auth.tenant_id,
        'userId': auth.user_id,
        'action': 'secret.create',
        'resourceType': 'secret',
        'resourceId': secret['id'],
        'changes': {'name': name},
        'ipAddress': client_ip(request),
    })
    return {'secret': secret}


@router.get('/{secret_id}')
async def get_secret(
    secret_id: str,
    reveal: bool = Query(default=False),
    auth: AuthContext = Depends(authenticate_request),
):
    require_scopes(auth, 'deploy' if reveal else 'read')
    secret = db.find_secret_by_id(secret_id, auth.tenant_id, include_value=reveal)
    if not secret:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Secret not found')
    return {'secret': secret}


@router.put('/{secret_id}')
async def rotate_secret(
    secret_id: str,
    payload: SecretUpdate,
    request: Request,
    auth: AuthContext = Depends(authenticate_request),
):
    require_scopes(auth, 'deploy')
    vault = get_secret_vault_provider()
    secret = db.update_secret_value(secret_id, auth.tenant_id, vault.seal(payload.value))
    if not secret:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Secret not found')
    db.write_audit_log({
        'tenantId': auth.tenant_id,
        'userId': auth.user_id,
        'action': 'secret.rotate',
        'resourceType': 'secret',
        'resourceId': secret['id'],
        'changes': {'version': secret['version']},
        'ipAddress': client_ip(request),
    })
    return {'secret': secret}


@router.delete('/{secret_id}', status_code=status.HTTP_204_NO_CONTENT)
async def delete_secret(
    secret_id: str,
    request: Request,
    auth: AuthContext = Depends(authenticate_request),
):
    require_scopes(auth, 'deploy')
    if not db.delete_secret(secret_id, auth.tenant_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Secret not found')
    db.write_audit_log({
        'tenantId': auth.tenant_id,
        'userId': auth.user_id,
        'action': 'secret.delete',
        'resourceType': 'secret',
        'resourceId': secret_id,
        'ipAddress': client_ip(request),
    })
    return None
