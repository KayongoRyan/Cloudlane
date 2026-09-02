# GraphQL API

Tenant read + write schema at **`POST /graphql`** using [Strawberry](https://strawberry.rocks/).

## Auth

Same as REST: `Authorization: Bearer <jwt>` or `X-API-Key: <key>`.

- **Queries** require `read` scope
- **Mutations** require `deploy` scope

## Query example

```bash
curl -s http://localhost:8001/graphql \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ projects { id name deployments { id status publicUrl } } quota { usage { databaseStorageGb } } }"}'
```

## Mutation example

```graphql
mutation {
  createDeployment(input: {
    name: "my-api"
    image: "nginx:alpine"
    port: 80
    minInstances: 0
    maxInstances: 3
  }) {
    jobId
    deployment { id status publicUrl }
  }
}
```

```bash
curl -s http://localhost:8001/graphql \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation { createBucket(name: \"uploads\") { id name } }"}'
```

## Query root

| Field | Type | Notes |
|---|---|---|
| `projects` | `[Project!]!` | Nested `deployments` |
| `deployments(projectId)` | `[Deployment!]!` | |
| `deployment(id)` | `Deployment` | |
| `secrets` | `[Secret!]!` | Names only (no values) |
| `loadBalancers` | `[LoadBalancer!]!` | |
| `databases` | `[DatabaseInstance!]!` | Nested `backups` |
| `buckets` | `[Bucket!]!` | |
| `gateways` | `[Gateway!]!` | |
| `quota` | `Quota!` | Limits + usage |

## Mutations

| Mutation | Returns | Notes |
|---|---|---|
| `createProject(name)` | `Project` | |
| `createDeployment(input)` | `DeploymentCreatePayload` | Async — includes `jobId` |
| `deleteDeployment(id)` | `DeletePayload` | Soft delete |
| `createBucket(name, projectId)` | `Bucket` | MinIO |
| `createSecret(name, value, projectId)` | `Secret` | Encrypted at rest |
| `rotateSecret(id, value)` | `Secret` | |
| `deleteSecret(id)` | `DeletePayload` | |
| `createLoadBalancer(input)` | `LoadBalancer` | Syncs nginx |
| `updateLoadBalancer(id, input)` | `LoadBalancer` | |
| `deleteLoadBalancer(id)` | `DeletePayload` | |
| `createDatabase(input)` | `DatabaseInstance` | Shared or dedicated |
| `updateDatabase(id, input)` | `DatabaseInstance` | |
| `deleteDatabase(id)` | `DeletePayload` | |
| `createDatabaseBackup(instanceId)` | `DatabaseBackupPayload` | Includes `downloadUrl` |

Errors return standard GraphQL `errors[]` with message + optional `extensions.code` (HTTP status).

Implementation: `apps/api_python/graphql_app.py` + `services/graphql_mutations.py`.
