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

`GET /health` on the API should return `{"status":"ok",...}`. Full host setup: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## How it works

```
Customer (CLI / dashboard)
        │
        ▼
Control plane API  ──────────────►  MongoDB Atlas
(Node.js + Express, Netlify)        (tenants, users, deployments, usage)
        │
        ▼
Kubernetes (EKS, planned)
  ├─ one namespace per tenant
  ├─ scale 0 → N on traffic
  └─ auto-generated subdomain per deployment
        │
        ▼
IremboPay (metered billing — per-second compute)
```

Customers never see Kubernetes, namespaces, or scaling config — one `deploy` command, same as Cloud Run hiding GKE.

## Tech stack

| Layer | Choice |
|---|---|
| API | Node.js, TypeScript, Express (`serverless-http` on Netlify) |
| Dashboard | Next.js 14 (App Router) on Vercel |
| CLI | Commander.js |
| Compute | Kubernetes (AWS EKS) — provisioning wired, cluster not production yet |
| Database | MongoDB (`mongodb` driver). Atlas in prod, `docker compose` locally |
| Billing | IremboPay |
| Auth | JWT (dashboard) + API keys (CLI) |

## Repo

```
cloudlane/
├── apps/
│   ├── api/          # Express control plane (Netlify functions)
│   └── dashboard/    # Next.js dashboard (Vercel)
├── packages/
│   ├── cli/          # `cloudlane` CLI
│   └── shared/       # Shared TypeScript types
├── docs/DEPLOYMENT.md
├── docker-compose.yml   # local Mongo
└── README.md
```

## Local

Needs Node 20+, Docker, and `apps/api/.env`:

```
DATABASE_URL=mongodb://cloudlane:<MONGO_PASSWORD>@localhost:27017/cloudlane?authSource=admin
JWT_SECRET=<long random string>
```

Root `.env` (compose): `MONGO_PASSWORD=<same password>`.

```bash
docker compose up -d
npm install
npm run dev                 # API :3001 + dashboard :3000
```

Or split:

```bash
cd apps/api && npm run dev
cd apps/dashboard && npm run dev
```

Dashboard talks to `http://localhost:3001` on localhost; production builds hit the Netlify API.

## Production

| App | Host | Root |
|---|---|---|
| Dashboard | Vercel (`cloudlane-dashboard`) | `apps/dashboard` |
| API | Netlify | `apps/api` |

Netlify: base `apps/api`, build `npm run build`, publish `public`, functions `netlify/functions`. Env: `DATABASE_URL` (Atlas `mongodb+srv://…`), `JWT_SECRET`. Atlas Network Access must allow `0.0.0.0/0`. Production branch should be `develop`.

Vercel: `NEXT_PUBLIC_API_URL` = Netlify site URL, no trailing slash. Redeploy after changing it.

## Build phases

### Phase 1 — Core deploy loop
- Multi-tenant Mongo collections (tenants, users, deployments, API keys)
- JWT + API key auth
- K8s provisioning API (container → namespace + service + ingress)
- Scale-to-zero (KEDA)
- Auto subdomain (`app-x7k2.cloudlane.run`)
- Dashboard (signup/login, deployments)
- CLI (`login`, `deploy`, `logs`, `list`)
- IremboPay metered billing

### Phase 2 — Polish
- Health checks / alerting, usage graphs, staging envs, audit log viewer, quotas

### Phase 3 — Broader surface
- Object storage, managed Postgres for customers, secrets vault, custom domains, orgs

## Design principles

- **Destructive-action safety** — tenant/deployment delete needs confirmation + grace period; backups independent of the account record
- **Staged control-plane rollouts** — config to one internal tenant first, then percentage, never all-at-once
- **Tenant isolation** — one K8s namespace per tenant; Mongo queries always filtered by `tenantId`
- **Pricing transparency** — per-second billing, usage visible in the dashboard

## Status

MVP in progress. Dashboard + auth API are live; Mongo on Atlas; K8s deploy path and billing are not production yet.
