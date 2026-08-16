from fastapi import APIRouter, Depends, Query

import database as db
from auth import AuthContext, authenticate_request

router = APIRouter()


@router.get('/')
async def list_logs(
    auth: AuthContext = Depends(authenticate_request),
    limit: int = Query(default=50, ge=1, le=200),
):
    return {'auditLogs': db.list_audit_logs(auth.tenant_id, limit)}
