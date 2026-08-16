import re

from fastapi import APIRouter, Depends, HTTPException, Request, status

import database as db
from auth import AuthContext, authenticate_request, client_ip, require_scopes
from schemas import ProjectCreate

router = APIRouter()


@router.get('/')
async def list_projects(auth: AuthContext = Depends(authenticate_request)):
    require_scopes(auth, 'read')
    projects = db.list_projects(auth.tenant_id)
    if not projects:
        default = db.get_or_create_default_project(auth.tenant_id)
        db.migrate_deployments_to_default_project(auth.tenant_id, default['id'])
        projects = [default]
    return {'projects': projects}


@router.post('/', status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: ProjectCreate,
    request: Request,
    auth: AuthContext = Depends(authenticate_request),
):
    require_scopes(auth, 'deploy')
    slug = re.sub(r'[^a-z0-9-]', '', payload.name, flags=re.I).lower() or 'project'
    try:
        project = db.create_project(auth.tenant_id, payload.name.strip(), slug)
    except Exception as exc:
        if getattr(exc, 'code', None) == 11000:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='Project slug already exists') from exc
        raise
    db.write_audit_log({
        'tenantId': auth.tenant_id,
        'userId': auth.user_id,
        'action': 'project.create',
        'resourceType': 'project',
        'resourceId': project['id'],
        'ipAddress': client_ip(request),
    })
    return {'project': project}
