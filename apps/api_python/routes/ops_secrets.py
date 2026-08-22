from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field

from auth import AuthContext, authenticate_request, client_ip, require_admin
import database as db
from services.ops_vault import (
    OPS_SECRET_CATALOG,
    get_ops_secret_value,
    list_ops_secrets,
    migrate_from_env,
    upsert_ops_secret,
    apply_ops_secrets_to_runtime,
)

router = APIRouter()


class OpsSecretUpsert(BaseModel):
    value: str = Field(..., min_length=1, max_length=65536)


@router.get('/')
async def list_control_plane_secrets(auth: AuthContext = Depends(authenticate_request)):
    require_admin(auth)
    return {
        'secrets': list_ops_secrets(),
        'note': (
            'Cloudlane secret migration: ops secrets live in Mongo system_secrets (encrypted). '
            'DATABASE_URL and SECRETS_MASTER_KEY stay in env as bootstrap / root of trust.'
        ),
    }


@router.post('/migrate', status_code=status.HTTP_200_OK)
async def migrate_env_to_vault(
    request: Request,
    auth: AuthContext = Depends(authenticate_request),
):
    """Copy current env/settings values into the ops vault (Cloudlane secret migration)."""
    require_admin(auth)
    result = migrate_from_env()
    db.write_audit_log({
        'tenantId': auth.tenant_id,
        'userId': auth.user_id,
        'action': 'ops_secret.migrate',
        'resourceType': 'system_secret',
        'resourceId': None,
        'changes': result,
        'ipAddress': client_ip(request),
    })
    return result


@router.get('/{name}')
async def get_control_plane_secret(
    name: str,
    reveal: bool = Query(default=False),
    auth: AuthContext = Depends(authenticate_request),
):
    require_admin(auth)
    name = name.upper()
    if name not in OPS_SECRET_CATALOG:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Unknown ops secret')
    rows = [r for r in list_ops_secrets(include_bootstrap=False) if r['name'] == name]
    row = rows[0] if rows else {'name': name, 'inVault': False}
    if reveal:
        value = get_ops_secret_value(name)
        if value is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Secret not set')
        return {'secret': {**row, 'value': value}}
    return {'secret': row}


@router.put('/{name}')
async def upsert_control_plane_secret(
    name: str,
    payload: OpsSecretUpsert,
    request: Request,
    auth: AuthContext = Depends(authenticate_request),
):
    require_admin(auth)
    name = name.upper()
    try:
        secret = upsert_ops_secret(name, payload.value)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    apply_ops_secrets_to_runtime()
    db.write_audit_log({
        'tenantId': auth.tenant_id,
        'userId': auth.user_id,
        'action': 'ops_secret.upsert',
        'resourceType': 'system_secret',
        'resourceId': secret.get('id'),
        'changes': {'name': name, 'version': secret.get('version')},
        'ipAddress': client_ip(request),
    })
    return {'secret': {k: v for k, v in secret.items() if k != 'value'}}
