from fastapi import APIRouter, Depends, Query

import database as db
from auth import AuthContext, authenticate_request

router = APIRouter()

from datetime import datetime

@router.get('')
async def list_logs(
    auth: AuthContext = Depends(authenticate_request),
    limit: int = Query(default=50, ge=1, le=200),
    resourceType: str | None = Query(default=None),
    action: str | None = Query(default=None),
    userId: str | None = Query(default=None),
    fromDate: datetime | None = Query(default=None),
    toDate: datetime | None = Query(default=None),
    cursor: str | None = Query(default=None),
):
    logs = db.list_audit_logs(
        auth.tenant_id,
        limit=limit,
        resource_type=resourceType,
        action=action,
        user_id=userId,
        from_date=fromDate,
        to_date=toDate,
        cursor=cursor
    )
    total = db.count_audit_logs(
        auth.tenant_id,
        resource_type=resourceType,
        action=action,
        user_id=userId,
        from_date=fromDate,
        to_date=toDate
    )
    next_cursor = logs[-1]['id'] if len(logs) == limit else None
    return {'auditLogs': logs, 'nextCursor': next_cursor, 'total': total}
