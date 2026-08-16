import re
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request, status

import database as db
from auth import client_ip, create_access_token, get_password_hash, verify_password
from schemas import LoginRequest, RegisterRequest, TokenResponse

router = APIRouter()


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
    return TokenResponse(token=token)


@router.post('/login', response_model=TokenResponse)
async def login(data: LoginRequest):
    user = db.find_user_by_email(data.email.strip().lower())
    if not user or not verify_password(data.password, user['passwordHash']):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid credentials')

    token = create_access_token(user['id'], user['tenantId'], user['role'])
    return TokenResponse(token=token)
