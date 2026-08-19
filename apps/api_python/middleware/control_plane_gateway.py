from __future__ import annotations

import uuid

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from auth import AuthContext
from config import get_settings
from services.redis_client import check_rate_limit


class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get('X-Request-Id') or str(uuid.uuid4())
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers['X-Request-Id'] = request_id
        return response


class ControlPlaneRateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if not path.startswith('/api/') or path.startswith('/internal/'):
            return await call_next(request)

        settings = get_settings()
        tenant_id = getattr(request.state, 'tenant_id', None)
        api_key_prefix = request.headers.get('X-API-Key', '')[:8]
        if tenant_id:
            key = f'cprl:tenant:{tenant_id}'
        elif api_key_prefix:
            key = f'cprl:key:{api_key_prefix}'
        else:
            key = f'cprl:ip:{request.client.host if request.client else "unknown"}'

        allowed, _ = check_rate_limit(key, settings.control_plane_rate_limit_rpm, 60)
        if not allowed:
            return Response(content='Rate limit exceeded', status_code=429)

        return await call_next(request)


class ApiVersionMiddleware(BaseHTTPMiddleware):
    """Rewrite /api/v1/* to /api/* so existing routers serve versioned paths."""

    async def dispatch(self, request: Request, call_next):
        path = request.scope.get('path', '')
        if path.startswith('/api/v1/'):
            request.scope['path'] = '/api/' + path[len('/api/v1/'):]
        return await call_next(request)
