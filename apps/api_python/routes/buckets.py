from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

import database as db
from auth import AuthContext, authenticate_request, client_ip, require_scopes
from schemas import BucketCreate
from services.minio_client import minio_service

router = APIRouter()


@router.get('/')
async def list_buckets(
    auth: AuthContext = Depends(authenticate_request),
    projectId: str | None = Query(default=None),
):
    require_scopes(auth, 'read')
    return {'buckets': db.list_buckets(auth.tenant_id, projectId)}


@router.post('/', status_code=status.HTTP_201_CREATED)
async def create_bucket(
    payload: BucketCreate,
    request: Request,
    auth: AuthContext = Depends(authenticate_request),
):
    require_scopes(auth, 'deploy')
    project = db.get_or_create_default_project(auth.tenant_id)
    if payload.projectId:
        found = db.find_project_by_id(payload.projectId, auth.tenant_id)
        if not found:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Project not found')
        project = found

    name = payload.name.strip().lower()
    if db.find_bucket_by_name(name, auth.tenant_id):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='Bucket already exists')

    minio_service.ensure_bucket(name)
    bucket = db.create_bucket(auth.tenant_id, project['id'], name)
    db.write_audit_log({
        'tenantId': auth.tenant_id,
        'userId': auth.user_id,
        'action': 'bucket.create',
        'resourceType': 'bucket',
        'resourceId': bucket['id'],
        'ipAddress': client_ip(request),
    })
    return {'bucket': bucket}


@router.get('/{bucket_name}/objects')
async def list_objects(bucket_name: str, auth: AuthContext = Depends(authenticate_request)):
    require_scopes(auth, 'read')
    bucket = db.find_bucket_by_name(bucket_name, auth.tenant_id)
    if not bucket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Bucket not found')
    objects = minio_service.list_objects(bucket_name)
    return {'objects': objects}


@router.get('/{bucket_name}/upload-url')
async def upload_url(
    bucket_name: str,
    objectName: str = Query(..., min_length=1),
    auth: AuthContext = Depends(authenticate_request),
):
    require_scopes(auth, 'deploy')
    bucket = db.find_bucket_by_name(bucket_name, auth.tenant_id)
    if not bucket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Bucket not found')
    url = minio_service.presigned_upload(bucket_name, objectName)
    if not url:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail='MinIO not available')
    return {'uploadUrl': url, 'objectName': objectName}
