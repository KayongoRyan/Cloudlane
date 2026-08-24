"""Managed Postgres/MySQL provider — real DBs on compose services (tenant product).

Control-plane state stays in MongoDB. This provisions isolated databases + users
on shared managed-postgres / managed-mysql containers.
"""

from __future__ import annotations

import logging
import re
import secrets
from urllib.parse import quote_plus

from config import get_settings

logger = logging.getLogger(__name__)

_SAFE_IDENT = re.compile(r'^[a-z][a-z0-9_]{0,62}$')


class ManagedDatabaseError(Exception):
    """Raised when provisioning / deprovisioning fails."""


def _safe_ident(value: str, *, fallback: str = 'app') -> str:
    cleaned = re.sub(r'[^a-z0-9_]', '_', (value or '').lower()).strip('_')
    if cleaned and cleaned[0].isdigit():
        cleaned = f'd_{cleaned}'
    cleaned = (cleaned or fallback)[:63]
    if not _SAFE_IDENT.match(cleaned):
        cleaned = fallback
    return cleaned


def _unique_names(tenant_id: str, name: str) -> tuple[str, str]:
    """Return (db_name, username) unique-ish per tenant+name (PG ident limit 63)."""
    tid = re.sub(r'[^a-z0-9]', '', tenant_id.lower())[:8] or 'tenant'
    base = _safe_ident(name, fallback='app')[:40]
    db_name = _safe_ident(f'cl_{tid}_{base}', fallback=f'cl_{tid}_app')
    username = _safe_ident(f'u_{tid}_{base}', fallback=f'u_{tid}_app')
    return db_name, username


class LocalManagedDatabaseProvider:
    """Creates real Postgres/MySQL databases on local compose engines."""

    def is_ready(self, engine: str | None = None) -> bool:
        engines = [engine] if engine else ['postgres', 'mysql']
        return any(self._ping(e) for e in engines if e in ('postgres', 'mysql'))

    def is_engine_ready(self, engine: str) -> bool:
        return self._ping(engine)

    def _ping(self, engine: str) -> bool:
        try:
            if engine == 'postgres':
                with self._pg_admin() as conn:
                    with conn.cursor() as cur:
                        cur.execute('SELECT 1')
                return True
            if engine == 'mysql':
                conn = self._mysql_admin()
                try:
                    with conn.cursor() as cur:
                        cur.execute('SELECT 1')
                    return True
                finally:
                    conn.close()
        except Exception as exc:
            logger.debug('managed %s not ready: %s', engine, exc)
            return False
        return False

    def _pg_admin(self):
        import psycopg

        settings = get_settings()
        return psycopg.connect(
            host=settings.managed_postgres_host,
            port=settings.managed_postgres_port,
            user=settings.managed_postgres_admin_user,
            password=settings.managed_postgres_admin_password,
            dbname='postgres',
            connect_timeout=5,
            autocommit=True,
        )

    def _mysql_admin(self):
        import pymysql

        settings = get_settings()
        return pymysql.connect(
            host=settings.managed_mysql_host,
            port=settings.managed_mysql_port,
            user=settings.managed_mysql_admin_user,
            password=settings.managed_mysql_admin_password,
            connect_timeout=5,
            autocommit=True,
        )

    def provision(
        self,
        name: str,
        engine: str,
        version: str,
        size_gb: int,
        *,
        tenant_id: str,
    ) -> dict:
        engine = (engine or 'postgres').lower()
        if engine not in ('postgres', 'mysql'):
            raise ManagedDatabaseError(f'Unsupported engine: {engine}')
        if not self.is_engine_ready(engine):
            raise ManagedDatabaseError(
                f'{engine} managed engine is not reachable — '
                f'start docker compose service managed-{engine if engine != "postgres" else "postgres"}'
            )

        db_name, username = _unique_names(tenant_id, name)
        password = secrets.token_urlsafe(18)
        settings = get_settings()

        if engine == 'postgres':
            host = settings.managed_postgres_host
            port = settings.managed_postgres_port
            self._provision_postgres(db_name, username, password)
            scheme = 'postgresql'
            resolved_version = version or '16'
        else:
            host = settings.managed_mysql_host
            port = settings.managed_mysql_port
            self._provision_mysql(db_name, username, password)
            scheme = 'mysql'
            resolved_version = version or '8.0'

        conn = (
            f'{scheme}://{quote_plus(username)}:{quote_plus(password)}'
            f'@{host}:{port}/{db_name}'
        )
        return {
            'host': host,
            'port': port,
            'engine': engine,
            'version': resolved_version,
            'sizeGb': size_gb,
            'dbName': db_name,
            'username': username,
            'status': 'available',
            'statusMessage': (
                f'Real {engine} database provisioned on {host}:{port} '
                f'(sizeGb is metadata only; Mongo remains the control plane)'
            ),
            'endpoint': f'{host}:{port}',
            'connectionString': conn,
        }

    def deprovision(self, *, engine: str, db_name: str, username: str) -> None:
        engine = (engine or 'postgres').lower()
        db_name = _safe_ident(db_name)
        username = _safe_ident(username)
        if engine == 'postgres':
            if not self.is_engine_ready('postgres'):
                logger.warning('skip postgres deprovision — engine unreachable')
                return
            self._deprovision_postgres(db_name, username)
        elif engine == 'mysql':
            if not self.is_engine_ready('mysql'):
                logger.warning('skip mysql deprovision — engine unreachable')
                return
            self._deprovision_mysql(db_name, username)

    def _provision_postgres(self, db_name: str, username: str, password: str) -> None:
        # Identifiers validated; passwords passed as bind params where supported.
        try:
            with self._pg_admin() as conn:
                with conn.cursor() as cur:
                    cur.execute(f'CREATE USER "{username}" WITH PASSWORD %s', (password,))
                    cur.execute(f'CREATE DATABASE "{db_name}" OWNER "{username}"')
                    cur.execute(f'GRANT ALL PRIVILEGES ON DATABASE "{db_name}" TO "{username}"')
        except Exception as exc:
            # Best-effort rollback
            try:
                self._deprovision_postgres(db_name, username)
            except Exception:
                pass
            raise ManagedDatabaseError(f'Postgres provision failed: {exc}') from exc

        # Schema privileges inside the new DB
        try:
            import psycopg

            settings = get_settings()
            with psycopg.connect(
                host=settings.managed_postgres_host,
                port=settings.managed_postgres_port,
                user=settings.managed_postgres_admin_user,
                password=settings.managed_postgres_admin_password,
                dbname=db_name,
                connect_timeout=5,
                autocommit=True,
            ) as conn:
                with conn.cursor() as cur:
                    cur.execute(f'GRANT ALL ON SCHEMA public TO "{username}"')
                    cur.execute(f'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO "{username}"')
        except Exception as exc:
            logger.warning('postgres schema grants partial: %s', exc)

    def _deprovision_postgres(self, db_name: str, username: str) -> None:
        with self._pg_admin() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    'SELECT pg_terminate_backend(pid) FROM pg_stat_activity '
                    'WHERE datname = %s AND pid <> pg_backend_pid()',
                    (db_name,),
                )
                cur.execute(f'DROP DATABASE IF EXISTS "{db_name}"')
                cur.execute(f'DROP ROLE IF EXISTS "{username}"')

    def _provision_mysql(self, db_name: str, username: str, password: str) -> None:
        try:
            conn = self._mysql_admin()
            try:
                with conn.cursor() as cur:
                    cur.execute(f'CREATE DATABASE `{db_name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci')
                    cur.execute(
                        'CREATE USER %s@%s IDENTIFIED BY %s',
                        (username, '%', password),
                    )
                    cur.execute(f'GRANT ALL PRIVILEGES ON `{db_name}`.* TO %s@%s', (username, '%'))
                    cur.execute('FLUSH PRIVILEGES')
            finally:
                conn.close()
        except Exception as exc:
            try:
                self._deprovision_mysql(db_name, username)
            except Exception:
                pass
            raise ManagedDatabaseError(f'MySQL provision failed: {exc}') from exc

    def _deprovision_mysql(self, db_name: str, username: str) -> None:
        conn = self._mysql_admin()
        try:
            with conn.cursor() as cur:
                cur.execute(f'DROP DATABASE IF EXISTS `{db_name}`')
                cur.execute('DROP USER IF EXISTS %s@%s', (username, '%'))
                cur.execute('FLUSH PRIVILEGES')
        finally:
            conn.close()


# Back-compat alias
StubDatabaseProvider = LocalManagedDatabaseProvider


def get_database_provider() -> LocalManagedDatabaseProvider:
    return LocalManagedDatabaseProvider()
