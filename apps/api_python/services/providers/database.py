from __future__ import annotations

import secrets


class StubDatabaseProvider:
    """Managed DB metadata stub — connection strings are placeholders."""

    def is_ready(self) -> bool:
        return True

    def provision(self, name: str, engine: str, version: str, size_gb: int) -> dict:
        host = f'{name.replace(" ", "-").lower()}.db.cloudlane.run'
        port = 5432 if engine == 'postgres' else 3306
        password = secrets.token_urlsafe(16)
        user = 'cloudlane'
        db_name = name.replace('-', '_').replace(' ', '_').lower()[:48] or 'app'
        scheme = 'postgresql' if engine == 'postgres' else 'mysql'
        return {
            'host': host,
            'port': port,
            'engine': engine,
            'version': version,
            'sizeGb': size_gb,
            'status': 'available',
            'statusMessage': 'Database instance recorded (stub — no real RDS yet)',
            'endpoint': f'{host}:{port}',
            'connectionString': f'{scheme}://{user}:{password}@{host}:{port}/{db_name}',
            'username': user,
        }


def get_database_provider() -> StubDatabaseProvider:
    return StubDatabaseProvider()
