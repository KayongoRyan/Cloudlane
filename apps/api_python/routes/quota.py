from fastapi import APIRouter, Depends

from auth import AuthContext, authenticate_request, require_scopes
from services.quota import build_quota_report

router = APIRouter()


@router.get('')
async def get_quota(auth: AuthContext = Depends(authenticate_request)):
    require_scopes(auth, 'read')
    return build_quota_report(auth.tenant_id)
