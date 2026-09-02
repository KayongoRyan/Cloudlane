# Managed SQL (Cloud SQL product)

Tenant database instances on shared compose engines or dedicated Docker containers. Control plane stays on MongoDB.

## Modes

| Mode | Host | When to use |
|---|---|---|
| **Shared** (default) | `localhost:5433` (Postgres) / `:3307` (MySQL) | Dev / cost-efficient multi-tenant |
| **Dedicated** | `localhost:19600–19699` | Isolated container per instance (`docker run`) |

Create with `dedicated: true` on `POST /api/databases`.

## Storage quotas

- Each instance has `sizeGb` (metadata quota, 5–1024).
- `diskUsedMb` is measured live via `pg_database_size` / `information_schema`.
- Tenant total `sizeGb` cannot exceed `maxDatabaseStorageGb` (default **50 GB**).
- Exceeding instance quota updates `statusMessage` with a warning.

Refresh usage: `GET /api/databases?refreshDisk=true` or per-instance `?refreshDisk=true`.

## Backups

- **Manual:** `POST /api/databases/{id}/backups`
- **Scheduled:** provision-worker sweeps every `DATABASE_BACKUP_INTERVAL_HOURS` (default 24h) for instances with `autoBackup: true`
- Dumps: `pg_dump` / `mysqldump` → gzip → MinIO bucket `cloudlane-db-backups`
- List: `GET /api/databases/{id}/backups`
- Download: presigned URL on backup create response (`downloadUrl`)

Requires MinIO (`docker compose up -d minio`) and `docker` on PATH for dumps.

## Env

| Variable | Default |
|---|---|
| `MANAGED_POSTGRES_HOST` | `localhost` |
| `MANAGED_POSTGRES_PORT` | `5433` |
| `MANAGED_MYSQL_PORT` | `3307` |
| `SQL_DEDICATED_HOST` | `localhost` |
| `SQL_DEDICATED_PORT_MIN` | `19600` |
| `SQL_DEDICATED_PORT_MAX` | `19699` |
| `DATABASE_BACKUP_INTERVAL_HOURS` | `24` |

## GraphQL

Full read schema at `POST /graphql` (Strawberry):

```graphql
{
  projects { id name deployments { id status publicUrl } }
  databases { id diskUsedMb dedicated backups { id status sizeBytes } }
  quota { limits { maxDatabaseStorageGb } usage { databaseStorageGb } }
}
```

Bearer token or `X-API-Key` required.
