from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

import database as db
from auth import AuthContext, authenticate_request, client_ip, require_scopes
from schemas import DatabaseInstanceCreate, DatabaseInstanceUpdate
from services.database_backup import create_backup, list_backups, presigned_download_url
from services.providers import get_database_provider
from services.providers.database import ManagedDatabaseError
from services.quota import assert_database_allowed
from services.sql_disk import refresh_disk_usage

router = APIRouter()


def _enrich_instance(instance: dict, *, refresh_disk: bool = False) -> dict:
    if refresh_disk:
        refresh_disk_usage(instance)
        refreshed = db.find_database_instance_by_id(instance['id'], instance['tenantId'])
        return refreshed or instance
    return instance


@router.get('/')
async def list_database_instances(
    auth: AuthContext = Depends(authenticate_request),
    projectId: str | None = Query(default=None),
    refreshDisk: bool = Query(default=False),
):
    require_scopes(auth, 'read')
    instances = db.list_database_instances(auth.tenant_id, projectId)
    if refreshDisk:
        instances = [_enrich_instance(inst, refresh_disk=True) for inst in instances]
    return {'instances': instances}


@router.post('/', status_code=status.HTTP_201_CREATED)
async def create_database_instance(
    payload: DatabaseInstanceCreate,
    request: Request,
    auth: AuthContext = Depends(authenticate_request),
):
    require_scopes(auth, 'deploy')
    assert_database_allowed(auth.tenant_id, additional_storage_gb=payload.sizeGb)

    project = db.get_or_create_default_project(auth.tenant_id)
    if payload.projectId:
        found = db.find_project_by_id(payload.projectId, auth.tenant_id)
        if not found:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Project not found')
        project = found

    name = payload.name.replace(' ', '-').lower()
    provider = get_database_provider()
    if not payload.dedicated and not provider.is_engine_ready(payload.engine):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                f'Managed {payload.engine} engine is not running. '
                f'Start it with: docker compose up -d managed-{"postgres" if payload.engine == "postgres" else "mysql"}'
            ),
        )

    placeholder = db.create_database_instance({
        'tenantId': auth.tenant_id,
        'projectId': project['id'],
        'name': name,
        'engine': payload.engine,
        'version': payload.version,
        'sizeGb': payload.sizeGb,
        'dedicated': payload.dedicated,
        'autoBackup': payload.autoBackup,
        'status': 'provisioning',
        'statusMessage': 'Provisioning database resources',
    })

    try:
        provisioned = provider.provision(
            name,
            payload.engine,
            payload.version,
            payload.sizeGb,
            tenant_id=auth.tenant_id,
            dedicated=payload.dedicated,
            instance_id=placeholder['id'],
        )
    except ManagedDatabaseError as exc:
        db.delete_database_instance(placeholder['id'], auth.tenant_id)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    instance = db.update_database_instance(placeholder['id'], auth.tenant_id, {
        **provisioned,
        'status': 'available',
    })
    if not instance:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Failed to finalize database instance')
    refresh_disk_usage(instance)
    instance = db.find_database_instance_by_id(instance['id'], auth.tenant_id, include_connection=True)

    db.write_audit_log({
        'tenantId': auth.tenant_id,
        'userId': auth.user_id,
        'action': 'database.create',
        'resourceType': 'database_instance',
        'resourceId': instance['id'],
        'changes': {
            'name': name,
            'engine': payload.engine,
            'dbName': provisioned.get('dbName'),
            'dedicated': payload.dedicated,
        },
        'ipAddress': client_ip(request),
    })
    return {'instance': instance}


@router.get('/{instance_id}')
async def get_database_instance(
    instance_id: str,
    reveal: bool = Query(default=False),
    refreshDisk: bool = Query(default=False),
    auth: AuthContext = Depends(authenticate_request),
):
    require_scopes(auth, 'deploy' if reveal else 'read')
    instance = db.find_database_instance_by_id(
        instance_id,
        auth.tenant_id,
        include_connection=reveal,
    )
    if not instance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Database instance not found')
    if refreshDisk:
        refresh_disk_usage(instance)
        instance = db.find_database_instance_by_id(
            instance_id,
            auth.tenant_id,
            include_connection=reveal,
        )
    return {'instance': instance}


@router.patch('/{instance_id}')
async def update_database_instance(
    instance_id: str,
    payload: DatabaseInstanceUpdate,
    auth: AuthContext = Depends(authenticate_request),
):
    require_scopes(auth, 'deploy')
    updates = payload.model_dump(exclude_none=True)
    if 'sizeGb' in updates:
        existing = db.find_database_instance_by_id(instance_id, auth.tenant_id)
        if not existing:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Database instance not found')
        delta = int(updates['sizeGb']) - int(existing.get('sizeGb', 0))
        if delta > 0:
            assert_database_allowed(auth.tenant_id, additional_storage_gb=delta)
    instance = db.update_database_instance(instance_id, auth.tenant_id, updates)
    if not instance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Database instance not found')
    return {'instance': instance}


@router.delete('/{instance_id}', status_code=status.HTTP_204_NO_CONTENT)
async def delete_database_instance(
    instance_id: str,
    request: Request,
    auth: AuthContext = Depends(authenticate_request),
):
    require_scopes(auth, 'deploy')
    existing = db.find_database_instance_by_id(instance_id, auth.tenant_id)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Database instance not found')

    provider = get_database_provider()
    db_name = existing.get('dbName')
    username = existing.get('username')
    if db_name and username:
        try:
            provider.deprovision(
                engine=existing.get('engine', 'postgres'),
                db_name=db_name,
                username=username,
                instance=existing,
            )
        except ManagedDatabaseError as exc:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    db.delete_database_instance(instance_id, auth.tenant_id)
    db.write_audit_log({
        'tenantId': auth.tenant_id,
        'userId': auth.user_id,
        'action': 'database.delete',
        'resourceType': 'database_instance',
        'resourceId': instance_id,
        'ipAddress': client_ip(request),
    })
    return None


@router.get('/{instance_id}/backups')
async def list_database_backups(
    instance_id: str,
    auth: AuthContext = Depends(authenticate_request),
):
    require_scopes(auth, 'read')
    instance = db.find_database_instance_by_id(instance_id, auth.tenant_id)
    if not instance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Database instance not found')
    backups = list_backups(instance_id, auth.tenant_id)
    return {'backups': backups}


@router.post('/{instance_id}/backups', status_code=status.HTTP_201_CREATED)
async def create_database_backup(
    instance_id: str,
    request: Request,
    auth: AuthContext = Depends(authenticate_request),
):
    require_scopes(auth, 'deploy')
    instance = db.find_database_instance_by_id(instance_id, auth.tenant_id)
    if not instance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Database instance not found')
    try:
        backup = create_backup(instance, trigger='manual')
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    db.write_audit_log({
        'tenantId': auth.tenant_id,
        'userId': auth.user_id,
        'action': 'database.backup.create',
        'resourceType': 'database_backup',
        'resourceId': backup['id'],
        'changes': {'instanceId': instance_id},
        'ipAddress': client_ip(request),
    })
    download_url = presigned_download_url(backup)
    return {'backup': {**backup, 'downloadUrl': download_url}}
