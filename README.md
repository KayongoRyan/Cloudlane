# Cloudlane

Deploy a container, get a live URL, pay only for what you use. Cloudlane is a multi-tenant cloud platform that combines AWS's breadth of managed infrastructure with Cloud Run's dead-simple deploy experience.

## What it is

- **Like AWS:** multi-tenant, isolated by design, room to grow into more managed services (storage, databases, queues) over time.
- **Like Cloud Run:** the core loop is deploy → URL, scale-to-zero when idle, pay per second/request — no servers or clusters exposed to the customer.

```bash
cloudlane deploy --image myrepo/app:v1 --port 8080
# → https://app-x7k2.cloudlane.run
```

## How it works (under the hood)

```
Customer (CLI / dashboard)
        │
        ▼
Control plane API  ──────────────►  PostgreSQL
(Node.js + Express)                 (tenants, deployments, usage, billing records)
        │
        ▼
Kubernetes (EKS)
  ├─ one namespace per tenant
  ├─ deployment scales 0 → N based on traffic
  └─ auto-generated subdomain per deployment
        │
        ▼
IremboPay (metered billing — per-second compute usage)
```

Customers never see Kubernetes, namespaces, or scaling config — Cloudlane hides all of it behind one `deploy` command, the same way Cloud Run hides GKE.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| API | Node.js, TypeScript, Express | Fast, strong ecosystem, easy K8s SDKs |
| Dashboard | Next.js | SSR, file-based routing, API routes built-in |
| CLI | Commander.js | Lightweight, composable |
| Compute | Kubernetes (AWS EKS) | Industry standard, great multi-tenant isolation |
| Database | PostgreSQL (`pg`) | Relational integrity and transactional tenant/account creation |
| Billing | IremboPay | Local payment infrastructure, Rwanda-native |
| Auth | JWT (dashboard) + API keys (CLI) | Stateless, easy to rotate |

## Repository structure

```
cloudlane/
├── apps/
│   ├── api/          # Express control plane API
│   └── dashboard/    # Next.js customer dashboard
├── packages/
│   ├── cli/          # cloudlane CLI (Commander.js)
│   └── shared/       # Shared TypeScript types
├── infrastructure/   # Terraform (EKS, VPC, security groups)
├── docker-compose.yml
└── README.md
```

## Build phases

### Phase 1 — Core deploy loop (Weeks 1–4)
- Multi-tenant PostgreSQL schema (tenants, users, deployments, API keys, audit logs)
- JWT + API key authentication
- Kubernetes provisioning API (deploy container → namespace + service + ingress)
- Scale-to-zero with KEDA (idle deployments spin down, wake on first request)
- Auto-generated subdomain per deployment (`app-x7k2.cloudlane.run`)
- Next.js dashboard (login, list deployments, view logs)
- CLI (`cloudlane login`, `cloudlane deploy`, `cloudlane logs`, `cloudlane list`)
- IremboPay metered billing wired to per-second usage metrics

### Phase 2 — Polish + reliability (Weeks 5–8)
- Deployment health checks and alerting
- Usage graphs and billing history in dashboard
- Staging environments per deployment
- Audit log viewer
- Quota management per tenant tier

### Phase 3 — Broader surface (beyond Week 8)
- Managed object storage (S3-compatible)
- Managed PostgreSQL databases for customers
- Environment variables vault (secrets management)
- Custom domains (BYOD)
- Team/organisation accounts

## Design principles (non-negotiable from day one)

- **Destructive-action safety** — deleting a tenant or deployment requires confirmation + a mandatory grace period; backups stored independently of the account record
- **Staged control-plane rollouts** — config changes go to one internal tenant first, then percentage rollout, never all-at-once
- **Tenant isolation** — one Kubernetes namespace per tenant, PostgreSQL queries always filtered by `tenant_id`
- **Pricing transparency** — per-second billing, no hidden egress fees, usage visible in real time on dashboard

## Status

MVP in active development. 4-week build roadmap in progress.
