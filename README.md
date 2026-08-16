# Cloudlane

Deploy Faster. Scale Smarter. Build Without Limits.

Multi-tenant control plane with a Cloud Run-style loop: `deploy` → URL, scale-to-zero when idle, pay per second.

```bash
cloudlane deploy --image myrepo/app:v1 --port 8080
# → https://app-x7k2.cloudlane.run
```

**Live**

| App | URL |
|---|---|
| Dashboard | [cloudlane-dashboard.vercel.app](https://cloudlane-dashboard.vercel.app) |
| API | [comfy-starlight-51c0e7.netlify.app](https://comfy-starlight-51c0e7.netlify.app) |

`GET /health` → `{"status":"ok",...}`. Host setup: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## How it works

```
Customer (CLI / dashboard)
        │
        ▼
Control plane API  ──────────────►  MongoDB Atlas
(FastAPI on Netlify)                ObjectId ERD (see below)
        │
        ▼
Kubernetes (EKS, planned)
  ├─ one namespace per tenant
  ├─ scale 0 → N on traffic
  └─ publicUrl per deployment (*.cloudlane.run)
        │
        ▼
IremboPay (metered billing — tenants.irembopayCustomerId reserved)
```

Customers never see Kubernetes — one `deploy` command, same as Cloud Run hiding GKE.

## Data model

Native `_id: ObjectId`. FKs are ObjectIds; JSON/JWT use hex strings. Legacy UUID docs still resolve on login.

```
tenants 1──has──* users
        1──owns──* deployments
        1──creates──* api_keys
users   1──triggers──* audit_logs
deployments 1──produces──* usage_metrics
```

| Collection | Fields |
|---|---|
| `tenants` | slug, name, status, tier, limits, irembopayCustomerId, createdAt |
| `users` | tenantId, email, passwordHash, role, status, createdAt |
| `deployments` | tenantId, name, slug, image, cpu, memory, min/maxInstances, status, publicUrl, k8sNamespace, deletedAt, createdAt |
| `api_keys` | tenantId, userId, name, keyHash, prefix, scopes, expiresAt, lastUsedAt |
| `audit_logs` | tenantId, userId, action, resourceType, resourceId, changes, ipAddress, createdAt |
| `usage_metrics` | tenantId, deploymentId, metricType, value, windowStart, windowEnd |

Queries are always scoped by `tenantId`.

## API

Bearer JWT or `X-API-Key`.

| Method | Path | Auth |
|---|---|---|
| `POST` | `/api/auth/register` | public |
| `POST` | `/api/auth/login` | public |
| `GET/POST` | `/api/deployments` | JWT / API key |
| `GET/POST` | `/api/api-keys` | JWT / API key |
| `DELETE` | `/api/api-keys/:id` | JWT / API key |
| `GET` | `/api/audit-logs` | JWT / API key |
| `GET/POST` | `/api/usage-metrics` | JWT / API key |
| `GET` | `/health` | public (no DB) |

`POST /api/api-keys` returns the plaintext key **once**. Register and deploy write `audit_logs`.

## Tech stack

| Layer | Choice |
|---|---|
| API | Python, FastAPI, Mangum (Netlify serverless) |
| Dashboard | Next.js 14 (App Router) on Vercel |
| CLI | Commander.js |
| Compute | Kubernetes (AWS EKS) — provisioning wired, cluster not production yet |
| Database | MongoDB. Atlas in prod, `docker compose` locally |
| Billing | IremboPay (customer id on tenant; charges not wired) |
| Auth | JWT (dashboard) + hashed API keys (CLI) |

## Repo

```
cloudlane/
├── apps/
│   ├── api_python/   # FastAPI control plane (Netlify)
│   ├── api/          # legacy Node API (deprecated)
│   └── dashboard/    # Next.js dashboard (Vercel)
├── packages/
│   ├── cli/          # `cloudlane` CLI
│   └── shared/       # Shared TypeScript types
├── docs/DEPLOYMENT.md
├── docker-compose.yml   # local Mongo
└── README.md
```

## Local

Python 3.11+, Node 20+ (dashboard), Docker, `apps/api_python/.env` (copy from `.env.example`):

```
DATABASE_URL=mongodb://localhost:27017/cloudlane
JWT_SECRET=<long random string>
```

If compose auth is on, set root `.env` `MONGO_PASSWORD` and point `DATABASE_URL` at that user. **Never commit Atlas URIs** — GitHub secret scanning flags `mongodb+srv` with credentials, even placeholders.

```bash
docker compose up -d
cd apps/api_python && pip install -r requirements.txt
npm install
npm run dev                 # API :8001 + dashboard :3000
```

Dashboard on localhost hits `:8001`; production hits the Netlify API.

## Production

| App | Host | Root |
|---|---|---|
| Dashboard | Vercel (`cloudlane-dashboard`) | `apps/dashboard` |
| API | Netlify | `apps/api_python` |

Netlify: base `apps/api_python`, build `pip install -r requirements.txt`, publish `public`, functions `netlify/functions`. Env: `DATABASE_URL` (Atlas, set in the UI only), `JWT_SECRET`. Atlas Network Access: `0.0.0.0/0`. Production branch: `develop`.

Vercel: `NEXT_PUBLIC_API_URL` = Netlify URL, no trailing slash. Redeploy after changing it.

## Build phases

### Phase 1 — Core deploy loop
- [x] Multi-tenant Mongo ERD (tenants, users, deployments, api_keys, audit_logs, usage_metrics)
- [x] JWT + API key auth
- [x] Dashboard signup/login + deploy modal
- [x] CLI (`login`, `deploy`, `logs`, `list`)
- [ ] K8s cluster in production (API already calls namespace / deploy / service / ingress)
- [ ] Scale-to-zero (KEDA)
- [ ] IremboPay charges (field reserved)

### Phase 2 — Polish
- Usage graphs in dashboard, audit log viewer, quotas from `tenants.limits`, alerting

### Phase 3 — Broader surface
- Object storage, managed Postgres for customers, secrets vault, custom domains, orgs

## Design principles

- **Destructive-action safety** — tenant/deployment delete needs confirmation + grace period; deployments use `deletedAt`
- **Staged control-plane rollouts** — config to one internal tenant first, then percentage, never all-at-once
- **Tenant isolation** — one K8s namespace per tenant; Mongo queries always filtered by `tenantId`
- **Pricing transparency** — per-second billing, usage in `usage_metrics`

## Status

MVP in progress. **FastAPI** control plane replaces legacy Node API. Dashboard + auth + ERD routes ready; point Netlify base dir to `apps/api_python` and redeploy.
