from __future__ import annotations

import gzip
import logging
import subprocess
from datetime import datetime, timezone
from io import BytesIO

import database as db
from config import get_settings
from services.minio_client import minio_service
from services.sql_disk import container_for_instance
from services.sql_dedicated import dedicated_admin_password

logger = logging.getLogger(__name__)

BACKUP_BUCKET = 'cloudlane-db-backups'


def _object_key(tenant_id: str, instance_id: str, backup_id: str) -> str:
    return f'{tenant_id}/{instance_id}/{backup_id}.sql.gz'


def _dump_sql(instance: dict) -> bytes:
    engine = (instance.get('engine') or 'postgres').lower()
    db_name = instance.get('dbName')
    username = instance.get('username')
    if not db_name or not username:
        raise RuntimeError('instance missing dbName or username')
    container = container_for_instance(instance)
    settings = get_settings()

    if engine == 'postgres':
        admin_user = settings.managed_postgres_admin_user
        env_prefix: list[str] = []
        if instance.get('dedicated'):
            admin_user = 'cloudlane_rds'
            env_prefix = ['-e', f'PGPASSWORD={dedicated_admin_password(container, engine)}']
        result = subprocess.run(
            ['docker', 'exec', *env_prefix, container, 'pg_dump', '-U', admin_user, '-d', db_name],
            capture_output=True,
            timeout=300,
            check=False,
        )
        if result.returncode != 0:
            raise RuntimeError((result.stderr or result.stdout or b'pg_dump failed').decode(errors='replace'))
        payload = result.stdout
    else:
        admin_user = settings.managed_mysql_admin_user
        admin_password = settings.managed_mysql_admin_password
        if instance.get('dedicated'):
            admin_user = 'root'
            admin_password = dedicated_admin_password(container, engine)
        result = subprocess.run(
            [
                'docker', 'exec', container,
                'mysqldump', '-u', admin_user, f'-p{admin_password}', db_name,
            ],
            capture_output=True,
            timeout=300,
            check=False,
        )
        if result.returncode != 0:
            raise RuntimeError((result.stderr or result.stdout or b'mysqldump failed').decode(errors='replace'))
        payload = result.stdout

    buf = BytesIO()
    with gzip.GzipFile(fileobj=buf, mode='wb') as gz:
        gz.write(payload)
    return buf.getvalue()


def create_backup(instance: dict, *, trigger: str = 'manual') -> dict:
    settings = get_settings()
    minio_service.ensure_bucket(BACKUP_BUCKET)
    client = minio_service._get_client()
    if not client:
        raise RuntimeError('MinIO is not reachable — start docker compose service minio')

    backup_doc = db.create_database_backup({
        'tenantId': instance['tenantId'],
        'instanceId': instance['id'],
        'status': 'running',
        'trigger': trigger,
        'sizeBytes': 0,
    })
    backup_id = backup_doc['id']
    object_name = _object_key(instance['tenantId'], instance['id'], backup_id)

    try:
        payload = _dump_sql(instance)
        from io import BytesIO as BIO
        client.put_object(
            BACKUP_BUCKET,
            object_name,
            BIO(payload),
            length=len(payload),
            content_type='application/gzip',
        )
        updated = db.update_database_backup(backup_id, instance['tenantId'], {
            'status': 'completed',
            'sizeBytes': len(payload),
            'objectKey': object_name,
            'completedAt': datetime.now(timezone.utc),
        })
        db.update_database_instance(instance['id'], instance['tenantId'], {
            'lastBackupAt': datetime.now(timezone.utc),
        })
        return updated or backup_doc
    except Exception as exc:
        db.update_database_backup(backup_id, instance['tenantId'], {
            'status': 'failed',
            'statusMessage': str(exc),
            'completedAt': datetime.now(timezone.utc),
        })
        raise


def list_backups(instance_id: str, tenant_id: str) -> list[dict]:
    return db.list_database_backups(tenant_id, instance_id)


def presigned_download_url(backup: dict, *, expires_seconds: int = 3600) -> str | None:
    key = backup.get('objectKey')
    if not key or backup.get('status') != 'completed':
        return None
    return minio_service.presigned_download(BACKUP_BUCKET, key, expires_seconds)


def sweep_due_backups() -> int:
    settings = get_settings()
    due = db.list_instances_due_for_backup(settings.database_backup_interval_hours)
    count = 0
    for instance in due:
        try:
            create_backup(instance, trigger='scheduled')
            count += 1
            print(f'database backup completed for {instance["id"]}')
        except Exception as exc:
            print(f'database backup failed for {instance["id"]}: {exc}')
    return count
