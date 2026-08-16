from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

import database as db
from auth import AuthContext, authenticate_request, client_ip
from schemas import ApiKeyCreate
from services.utils import generate_api_key, hash_api_key

router = APIRouter()


@router.get('/')
async def list_keys(auth: AuthContext = Depends(authenticate_request)):
    return {'apiKeys': db.list_api_keys(auth.tenant_id)}


@router.post('/', status_code=status.HTTP_201_CREATED)
async def create_key(payload: ApiKeyCreate, request: Request, auth: AuthContext = Depends(authenticate_request)):
    if not auth.user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='API key has no user; sign in to create keys')

    key_name = (payload.name or 'CLI key').strip()
    if not key_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Name is required')

    scopes = payload.scopes if payload.scopes else ['deploy', 'read']
    expiry = None
    if payload.expiresAt:
        expiry = datetime.fromisoformat(payload.expiresAt.replace('Z', '+00:00'))
        if expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)

    key, prefix = generate_api_key()
    record = db.create_api_key({
        'tenantId': auth.tenant_id,
        'userId': auth.user_id,
        'name': key_name,
        'keyHash': hash_api_key(key),
        'prefix': prefix,
        'scopes': scopes,
        'expiresAt': expiry,
    })

    db.write_audit_log({
        'tenantId': auth.tenant_id,
        'userId': auth.user_id,
        'action': 'api_key.create',
        'resourceType': 'api_key',
        'resourceId': record['id'],
        'changes': {'name': key_name, 'scopes': scopes},
        'ipAddress': client_ip(request),
    })

    return {'apiKey': record, 'key': key}


@router.delete('/{key_id}', status_code=status.HTTP_204_NO_CONTENT)
async def delete_key(key_id: str, request: Request, auth: AuthContext = Depends(authenticate_request)):
    if not auth.user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Unauthorized')

    if not db.delete_api_key(key_id, auth.tenant_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='API key not found')

    db.write_audit_log({
        'tenantId': auth.tenant_id,
        'userId': auth.user_id,
        'action': 'api_key.delete',
        'resourceType': 'api_key',
        'resourceId': key_id,
        'ipAddress': client_ip(request),
    })
    return Response(status_code=status.HTTP_204_NO_CONTENT)
