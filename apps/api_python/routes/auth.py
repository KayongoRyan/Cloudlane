import re
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request, status

import database as db
from auth import client_ip, create_access_token, get_password_hash, verify_password
from schemas import LoginRequest, RegisterRequest, TokenResponse
from services.utils import generate_api_key, hash_api_key

router = APIRouter()


def issue_cli_api_key(tenant_id: str, user_id: str) -> str:
    key, prefix = generate_api_key()
    db.create_api_key({
        'tenantId': tenant_id,
        'userId': user_id,
        'name': 'CLI login key',
        'keyHash': hash_api_key(key),
        'prefix': prefix,
        'scopes': ['deploy', 'read'],
        'expiresAt': None,
    })
    return key


@router.post('/register', response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(data: RegisterRequest, request: Request):
    normalized_email = data.email.strip().lower()
    if db.find_user_by_email(normalized_email):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='A user with this email already exists')

    slug_base = re.sub(r'[^a-z0-9]+', '-', data.organization.strip().lower()).strip('-') or 'organization'
    slug = f'{slug_base}-{int(datetime.now(timezone.utc).timestamp() * 1000)}'
    hashed = get_password_hash(data.password)

    try:
        user = db.create_user_and_tenant(data.organization.strip(), slug, normalized_email, hashed)
    except Exception as exc:
        if getattr(exc, 'code', None) == 11000:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='A user with this email already exists') from exc
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc

    default_project = db.get_or_create_default_project(user['tenantId'])
    db.migrate_deployments_to_default_project(user['tenantId'], default_project['id'])

    db.write_audit_log({
        'tenantId': user['tenantId'],
        'userId': user['id'],
        'action': 'user.register',
        'resourceType': 'user',
        'resourceId': user['id'],
        'changes': {'email': normalized_email, 'organization': data.organization.strip()},
        'ipAddress': client_ip(request),
    })

    token = create_access_token(user['id'], user['tenantId'], user['role'])
    api_key = issue_cli_api_key(user['tenantId'], user['id'])
    return TokenResponse(token=token, apiKey=api_key)


@router.post('/login', response_model=TokenResponse)
async def login(data: LoginRequest):
    user = db.find_user_by_email(data.email.strip().lower())
    if not user or not verify_password(data.password, user['passwordHash']):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid credentials')

    token = create_access_token(user['id'], user['tenantId'], user['role'])
    api_key = issue_cli_api_key(user['tenantId'], user['id'])
    return TokenResponse(token=token, apiKey=api_key)
