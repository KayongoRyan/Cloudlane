from __future__ import annotations

import logging
import subprocess

from services.sql_dedicated import dedicated_admin_password

logger = logging.getLogger(__name__)

POSTGRES_CONTAINER = 'cloudlane-managed-postgres'
MYSQL_CONTAINER = 'cloudlane-managed-mysql'


def container_for_instance(instance: dict) -> str:
    if instance.get('dedicated') and instance.get('containerName'):
        return instance['containerName']
    engine = (instance.get('engine') or 'postgres').lower()
    return POSTGRES_CONTAINER if engine == 'postgres' else MYSQL_CONTAINER


def measure_disk_usage_mb(instance: dict) -> int | None:
    engine = (instance.get('engine') or 'postgres').lower()
    db_name = instance.get('dbName')
    if not db_name:
        return None
    container = container_for_instance(instance)
    try:
        if engine == 'postgres':
            from config import get_settings
            settings = get_settings()
            user = settings.managed_postgres_admin_user
            env: list[str] = []
            if instance.get('dedicated'):
                user = 'cloudlane_rds'
                env = ['-e', f'PGPASSWORD={dedicated_admin_password(container, engine)}']
            result = subprocess.run(
                [
                    'docker', 'exec', *env, container,
                    'psql', '-U', user, '-d', db_name, '-tAc',
                    'SELECT pg_database_size(current_database())',
                ],
                capture_output=True,
                text=True,
                timeout=30,
                check=False,
            )
            if result.returncode != 0:
                logger.warning('postgres disk measure failed: %s', (result.stderr or result.stdout).strip())
                return None
            bytes_used = int((result.stdout or '0').strip() or '0')
            return max(0, bytes_used // (1024 * 1024))
        from config import get_settings
        settings = get_settings()
        user = settings.managed_mysql_admin_user
        password = settings.managed_mysql_admin_password
        if instance.get('dedicated'):
            user = 'root'
            password = dedicated_admin_password(container, engine)
        sql = (
            'SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024) '
            f"FROM information_schema.tables WHERE table_schema = '{db_name}'"
        )
        result = subprocess.run(
            [
                'docker', 'exec', container,
                'mysql', '-u', user, f'-p{password}', '-N', '-e', sql,
            ],
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
        if result.returncode != 0:
            logger.warning('mysql disk measure failed: %s', (result.stderr or result.stdout).strip())
            return None
        return max(0, int((result.stdout or '0').strip() or '0'))
    except FileNotFoundError:
        logger.warning('docker not on PATH — skip disk measure')
    except Exception as exc:
        logger.warning('disk measure error: %s', exc)
    return None


def refresh_disk_usage(instance: dict) -> int | None:
    used = measure_disk_usage_mb(instance)
    if used is None:
        return None
    limit_mb = int(instance.get('sizeGb', 10)) * 1024
    status_message = instance.get('statusMessage') or ''
    if used > limit_mb:
        status_message = (
            f'Storage quota exceeded — using {used} MB of {limit_mb} MB allocated. '
            'Delete data or increase sizeGb.'
        )
    elif instance.get('dedicated'):
        status_message = f'Dedicated container on {instance.get("endpoint")} — {used} MB used'
    else:
        status_message = (
            f'Shared {instance.get("engine")} engine — {used} MB used '
            f'({instance.get("sizeGb")} GB quota metadata)'
        )
    import database as db
    db.update_database_instance(
        instance['id'],
        instance['tenantId'],
        {'diskUsedMb': used, 'statusMessage': status_message},
    )
    return used
