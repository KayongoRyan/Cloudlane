from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Annotated

import bcrypt
from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from config import get_settings
from database import find_api_key, find_user_by_id_and_tenant, mark_api_key_used
from services.utils import hash_api_key

settings = get_settings()
bearer_scheme = HTTPBearer(auto_error=False)


@dataclass
class AuthContext:
    tenant_id: str
    user_id: str | None = None
    role: str | None = None


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return plain_password == hashed_password


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def create_access_token(user_id: str, tenant_id: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {
        'userId': user_id,
        'tenantId': tenant_id,
        'role': role,
        'exp': expire,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


async def authenticate_request(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)] = None,
    x_api_key: Annotated[str | None, Header(alias='X-API-Key')] = None,
) -> AuthContext:
    if x_api_key:
        prefix = x_api_key[:8]
        record = find_api_key(prefix, hash_api_key(x_api_key))
        if not record:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid API key')
        mark_api_key_used(record['id'])
        return AuthContext(tenant_id=record['tenantId'], user_id=record.get('userId'))

    if not credentials or credentials.scheme.lower() != 'bearer':
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Missing or invalid authorization header')

    try:
        payload = jwt.decode(credentials.credentials, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        user_id = payload.get('userId')
        tenant_id = payload.get('tenantId')
        role = payload.get('role')
        if not user_id or not tenant_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid or expired token')
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid or expired token') from exc

    user = find_user_by_id_and_tenant(user_id, tenant_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='User not found')

    return AuthContext(tenant_id=tenant_id, user_id=user_id, role=role or user['role'])


def client_ip(request: Request) -> str | None:
    forwarded = request.headers.get('x-forwarded-for')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.client.host if request.client else None
