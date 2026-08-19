from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from database import ensure_indexes, get_db
from routes.auth import router as auth_router
from routes.deployments import router as deployments_router
from routes.api_keys import router as api_keys_router
from routes.audit_logs import router as audit_logs_router
from routes.usage_metrics import router as usage_metrics_router
from routes.health import router as health_router
from routes.projects import router as projects_router
from routes.buckets import router as buckets_router
from routes.billing import router as billing_router
from routes.monitoring import router as monitoring_router
from routes.vms import router as vms_router
from routes.gateways import router as gateways_router
from routes.gateway_internal import router as gateway_internal_router
from middleware.control_plane_gateway import (
    ApiVersionMiddleware,
    ControlPlaneRateLimitMiddleware,
    RequestIdMiddleware,
)

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if settings.database_url:
        try:
            get_db()
            ensure_indexes()
            from services.gateway_config import sync_gateway_configs
            sync_gateway_configs()
        except Exception as exc:
            print(f'Database not ready at startup: {exc}')
    yield


app = FastAPI(
    title='Cloudlane API',
    description='FastAPI control plane for Cloudlane deployments and authentication.',
    version='0.2.0',
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r'https://.*\.vercel\.app|http://localhost:\d+|http://127\.0\.0\.1:\d+',
    allow_origins=['https://cloudlane-dashboard.vercel.app'],
    allow_credentials=False,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.add_middleware(ControlPlaneRateLimitMiddleware)
app.add_middleware(RequestIdMiddleware)
app.add_middleware(ApiVersionMiddleware)

app.include_router(auth_router, prefix='/api/auth', tags=['auth'])
app.include_router(deployments_router, prefix='/api/deployments', tags=['deployments'])
app.include_router(projects_router, prefix='/api/projects', tags=['projects'])
app.include_router(api_keys_router, prefix='/api/api-keys', tags=['api-keys'])
app.include_router(buckets_router, prefix='/api/buckets', tags=['buckets'])
app.include_router(billing_router, prefix='/api/billing', tags=['billing'])
app.include_router(monitoring_router, prefix='/api/monitoring', tags=['monitoring'])
app.include_router(vms_router, prefix='/api/vms', tags=['vms'])
app.include_router(gateways_router, prefix='/api/gateways', tags=['gateways'])
app.include_router(gateway_internal_router, prefix='/internal/gateway', tags=['gateway-internal'])
app.include_router(audit_logs_router, prefix='/api/audit-logs', tags=['audit-logs'])
app.include_router(usage_metrics_router, prefix='/api/usage-metrics', tags=['usage-metrics'])
app.include_router(health_router, tags=['health'])


@app.get('/')
async def root():
    return {'message': 'Cloudlane API is running. See /api for endpoints.'}


@app.middleware('http')
async def log_requests(request, call_next):
    print(f"{datetime.now(timezone.utc).isoformat()} - {request.method} {request.url.path}")
    return await call_next(request)
