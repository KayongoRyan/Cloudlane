from __future__ import annotations

import logging
import secrets
import subprocess
import time

import database as db
from config import get_settings

logger = logging.getLogger(__name__)

DEDICATED_ADMIN_USER = 'cloudlane_rds'


def _container_name(instance_id: str) -> str:
    safe = ''.join(ch for ch in instance_id if ch.isalnum())[:12] or 'inst'
    return f'cloudlane-sql-{safe}'


def _image_for(engine: str, version: str) -> str:
    engine = (engine or 'postgres').lower()
    if engine == 'postgres':
        tag = (version or '16').split('.')[0]
        return f'postgres:{tag}-alpine'
    tag = version or '8.0'
    return f'mysql:{tag}'


def allocate_dedicated_port() -> int:
    settings = get_settings()
    used = set(db.list_dedicated_database_ports())
    for port in range(settings.sql_dedicated_port_min, settings.sql_dedicated_port_max + 1):
        if port not in used:
            return port
    raise RuntimeError('No dedicated SQL ports available in configured range')


def create_dedicated_container(instance_id: str, engine: str, version: str) -> tuple[str, int, str, str]:
    settings = get_settings()
    port = allocate_dedicated_port()
    container = _container_name(instance_id)
    admin_password = secrets.token_urlsafe(24)
    image = _image_for(engine, version)
    env: list[str] = []
    if engine == 'postgres':
        env = [
            '-e', f'POSTGRES_USER={DEDICATED_ADMIN_USER}',
            '-e', f'POSTGRES_PASSWORD={admin_password}',
            '-e', 'POSTGRES_DB=postgres',
        ]
        port_map = f'{port}:5432'
    else:
        env = [
            '-e', f'MYSQL_ROOT_PASSWORD={admin_password}',
        ]
        port_map = f'{port}:3306'
    cmd = [
        'docker', 'run', '-d',
        '--name', container,
        '--label', 'cloudlane.io/managed=true',
        '--label', f'cloudlane.io/instance={instance_id}',
        '-p', port_map,
        *env,
        image,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120, check=False)
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or '').strip()
        raise RuntimeError(f'docker run failed: {detail or "unknown error"}')

    _wait_for_engine(container, engine, admin_password)
    return settings.sql_dedicated_host, port, container, admin_password


def _wait_for_engine(container: str, engine: str, admin_password: str, attempts: int = 30) -> None:
    for _ in range(attempts):
        if engine == 'postgres':
            probe = subprocess.run(
                ['docker', 'exec', container, 'pg_isready', '-U', DEDICATED_ADMIN_USER],
                capture_output=True,
                text=True,
                timeout=10,
                check=False,
            )
        else:
            probe = subprocess.run(
                [
                    'docker', 'exec', container,
                    'mysqladmin', 'ping', '-h', '127.0.0.1',
                    f'-uroot', f'-p{admin_password}',
                ],
                capture_output=True,
                text=True,
                timeout=10,
                check=False,
            )
        if probe.returncode == 0:
            return
        time.sleep(2)
    raise RuntimeError(f'dedicated {engine} container {container} did not become ready')


def destroy_dedicated_container(container_name: str) -> None:
    if not container_name:
        return
    subprocess.run(['docker', 'rm', '-f', container_name], capture_output=True, timeout=60, check=False)


def dedicated_admin_password(container: str, engine: str) -> str:
    result = subprocess.run(
        ['docker', 'inspect', container, '--format', '{{range .Config.Env}}{{println .}}{{end}}'],
        capture_output=True,
        text=True,
        timeout=15,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError('could not inspect dedicated container')
    prefix = 'POSTGRES_PASSWORD=' if engine == 'postgres' else 'MYSQL_ROOT_PASSWORD='
    for line in (result.stdout or '').splitlines():
        if line.startswith(prefix):
            return line.split('=', 1)[1]
    raise RuntimeError('dedicated container admin password not found')
