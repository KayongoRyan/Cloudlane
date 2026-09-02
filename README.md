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

`GET /health` → `{"status":"ok",...}`. Host setup: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Architecture: [docs/architecture.md](docs/architecture.md).

## How it works

Two front doors: **management plane** (dashboard / Cloudlane Terminal / CLI → FastAPI) and **data plane** (tenant API consumers → Nginx gateway-proxy).

```
Dashboard · Cloudlane Terminal · CLI · GraphQL
        │
        ▼
Control plane API (:8001)  ──►  MongoDB (Atlas prod / compose local)
  JWT + cl_* platform keys        tenants · projects · deployments
  rate limit (Redis)              gateways · LBs · SQL · secrets · …
        │
        ├── POST /api/deployments → 202 + provision_jobs queue
        │         └── provision-worker → K8s (optional) → publicUrl
        │
        ├── /api/gateways CRUD → nginx conf → gateway-proxy (:8080)
        │         └── gw_* keys · auth_request · proxy to deployment
        │
        ├── /api/load-balancers → HTTP :8080 · HTTPS :8443 · TCP :19400–19599
        │
        └── /api/databases → shared Postgres/MySQL or dedicated containers
                  └── backups → MinIO (cloudlane-db-backups)

Tenant API clients
        │
        ▼
gateway-proxy (Nginx)  ──►  deployment.publicUrl (*.cloudlane.run)
        │
        ▼
IremboPay (metered billing — tenants.irembopayCustomerId reserved)
```

Customers never see Kubernetes — one `deploy` command, same as Cloud Run hiding GKE. Deploy is **async**: API enqueues a job; `provision-worker` provisions and updates status. The **Cloudlane Terminal** in the console runs the same control-plane commands in-browser (`deploy`, `db`, `lb`, `gateway`, `quota`, `graphql`, …).

Full architecture: [docs/architecture.md](docs/architecture.md).

## Data model

Native `_id: ObjectId`. FKs are ObjectIds; JSON/JWT use hex strings. Legacy UUID docs still resolve on login.

```
tenants 1──has──* users
        1──owns──* projects
        1──owns──* deployments
        1──creates──* api_keys
        1──owns──* gateways
projects 1──groups──* deployments · gateways · buckets · load_balancers · database_instances
gateways 1──has──* gateway_routes · gateway_keys
database_instances 1──has──* database_backups
deployments 1──produces──* usage_metrics
users   1──triggers──* audit_logs
```

| Collection | Fields |
|---|---|
| `tenants` | slug, name, status, tier, limits, irembopayCustomerId, createdAt |
| `users` | tenantId, email, passwordHash, role, status, createdAt |
| `projects` | tenantId, name, slug, status, createdAt |
| `deployments` | tenantId, projectId, name, slug, image, cpu, memory, min/maxInstances, status, statusMessage, publicUrl, k8sNamespace, deletedAt, createdAt |
| `provision_jobs` | tenantId, deploymentId, status, attempts, lastError, createdAt |
| `gateways` | tenantId, projectId, name, slug, hostname, status, createdAt |
| `gateway_routes` | gatewayId, path, method, deploymentId, createdAt |
| `gateway_keys` | gatewayId, name, keyHash, prefix, status, createdAt |
| `load_balancers` | tenantId, projectId, name, protocol (HTTP/HTTPS/TCP), port, dnsName, targetDeploymentId, status |
| `database_instances` | tenantId, projectId, name, engine, version, sizeGb, diskUsedMb, dedicated, endpoint, status |
| `database_backups` | instanceId, status, sizeBytes, trigger, objectKey, createdAt |
| `secrets` | tenantId, projectId, name, version, ciphertext |
| `api_keys` | tenantId, userId, name, keyHash, prefix, scopes, expiresAt, lastUsedAt |
| `buckets` | tenantId, projectId, name, createdAt |
| `audit_logs` | tenantId, userId, action, resourceType, resourceId, changes, ipAddress, createdAt |
| `usage_metrics` | tenantId, deploymentId, metricType, value, windowStart, windowEnd |

Queries are always scoped by `tenantId`.

## API

Bearer JWT or `X-API-Key` (`cl_*` platform keys). Gateway consumer keys (`gw_*`) are validated at the edge only.

| Method | Path | Auth |
|---|---|---|
| `POST` | `/api/auth/register` | public |
| `POST` | `/api/auth/login` | public |
| `GET/POST` | `/api/projects` | JWT / API key |
| `GET/POST` | `/api/deployments` | JWT / API key |
| `POST` | `/api/deployments` | returns **202** + job id (async provision) |
| `GET/POST` | `/api/gateways` (+ routes, keys) | JWT / API key (`gateway:*` scopes) |
| `GET/POST` | `/api/buckets` | JWT / API key |
| `GET/POST` | `/api/api-keys` | JWT / API key |
| `DELETE` | `/api/api-keys/:id` | JWT / API key |
| `GET` | `/api/audit-logs` | JWT / API key |
| `GET/POST` | `/api/usage-metrics` | JWT / API key |
| `GET/POST` | `/api/secrets` (+ reveal/rotate/delete) | JWT / API key |
| `GET/POST` | `/api/ops/secrets` (+ migrate) | JWT **admin** (control-plane vault) |
| `GET/POST` | `/api/load-balancers` | JWT / API key |
| `GET/POST` | `/api/databases` | JWT / API key |
| `GET/POST` | `/api/databases/:id/backups` | JWT / API key |
| `POST` | `/graphql` | JWT / API key (queries + mutations) |
| `GET` | `/api/billing`, `/api/monitoring`, `/api/quota` | JWT / API key |
| `GET` | `/internal/gateway/validate` | Nginx `auth_request` (edge) |
| `GET` | `/health`, `/health/encryption` | public (no DB) |

`POST /api/api-keys` returns the plaintext key **once**. Register and deploy write `audit_logs`.

**Cloudlane Terminal** (console top bar) wraps these APIs: `status`, `quota`, `monitor`, `deployments list`, `deploy create|delete`, `logs`, `db list|create|backup|reveal`, `lb list|create|delete`, `gateway list|create`, `secret list|create`, `bucket list|create|objects`, `vm list|create`, `billing`, `audit list`, `graphql <query>`.

## Languages

Cloudlane is polyglot by design. Each language owns the layer it fits best:

| Language | Where we use it |
|---|---|
| **C** | Pointers, memory management, threads, sockets, files — low-level runtime and system primitives |
| **Go** | Kubernetes, Docker, Prometheus, Terraform, etcd, control-plane operators and cloudplane tooling |
| **Rust** | Security-critical paths, high performance, storage engines, networking |
| **Python** | Automation, AI, testing, scripting — FastAPI control plane API today |
| **TypeScript** | Dashboard, CLI, developer portal, API SDK |

```
TypeScript ──► Dashboard / CLI / Dev portal / SDK
Python     ──► Control plane API / automation / AI / tests
Go         ──► K8s · Docker · Prometheus · Terraform · etcd · operators
Rust       ──► Security · hot paths · storage · networking
C          ──► Memory · threads · sockets · files (system core)
```

## Core systems knowledge

Foundations every Cloudlane engineer is expected to own — below containers and K8s.

### Linux internals

Foundation of servers and processes: boot, init, process lifecycle, signals, users/groups, systemd, journald, and how a machine actually runs workloads.

### Computer networking

| Topic | Scope |
|---|---|
| Routing | How packets find a path between networks |
| TCP/IP | Reliable transport, congestion, sockets |
| DNS | Name resolution for services and edge |
| Load balancing | L4 / L7 distribution, health checks |
| VPNs | Encrypted tunnels and private connectivity |

### Operating system

| Topic | Scope |
|---|---|
| Scheduling | CPU time, priorities, preemption |
| Memory | Virtual memory, paging, allocation |
| File systems | Persistence, mounts, permissions |
| Isolation | Processes, namespaces, sandboxes |

### Virtualization

| Topic | Scope |
|---|---|
| Hypervisors | Type-1 / Type-2 isolation of guest machines |
| KVM | Linux kernel virtualization (Cloudlane VM base) |
| Firecracker | MicroVMs — fast, secure multi-tenant compute |
| QEMU | Emulation / device model paired with KVM |

### Distributed systems

| Topic | Scope |
|---|---|
| Consensus | Agreement across nodes (e.g. Raft / etcd) |
| Replication | Copies for durability and read scale |
| Partition tolerance | Correct behavior when the network splits |

### Cybersecurity

| Topic | Scope |
|---|---|
| IAM | Identity, roles, least privilege |
| PKI | Certificates, CAs, trust chains |
| TLS | Encrypted transport everywhere |
| Encryption | Data at rest and in transit |
| Zero trust | Never trust the network; verify every request |

```
Linux internals · OS · Networking
        │
        ▼
Virtualization (KVM · Firecracker · QEMU)
        │
        ▼
Distributed systems (consensus · replication · partitions)
        │
        ▼
Cybersecurity (IAM · PKI · TLS · encryption · zero trust)
```

## Platform foundations

What Cloudlane’s compute and delivery surface is built on — and what we expect every layer to understand.

### Containers

| Topic | Scope |
|---|---|
| Docker | Build, run, and ship workload images |
| Images | Layered OCI images, tags, digests |
| Volumes | Persistent and ephemeral container storage |
| Networking | Bridge, host, overlay, service discovery |
| Registry | Push/pull, private registries, image promotion |
| BuildKit | Fast, cacheable multi-stage builds |
| Container runtime | containerd / CRI — what actually runs the container |
| OCI | Image and runtime specs (portable across engines) |
| Namespaces | Process, network, mount isolation |
| cgroups | CPU / memory / IO limits and accounting |

### Kubernetes

| Topic | Scope |
|---|---|
| Pods | Smallest schedulable unit |
| Deployments | Declarative rollouts for stateless apps |
| ReplicaSets | Desired replica count under Deployments |
| Services | Stable networking to Pods |
| Ingress | HTTP(S) routing and TLS termination |
| StatefulSets | Ordered, sticky identity for stateful workloads |
| Jobs | Run-to-completion batch work |
| DaemonSets | One Pod per node (agents, logs, mesh) |
| RBAC | Who can do what in the cluster |
| Operators | Controllers that extend the API for custom resources |
| Network policies | Pod-to-pod traffic rules |
| Storage classes | Dynamic volume provisioning |
| Helm | Package and template cluster apps |

### Infrastructure as Code & delivery

| Topic | Scope |
|---|---|
| Terraform | Provision cloud + cluster infra as code |
| Ansible | Config management and host automation |
| GitHub Actions | CI pipelines (build, test, scan, publish) |
| Argo CD | GitOps continuous delivery to Kubernetes |
| CI/CD | End-to-end: commit → image → deploy → verify |

```
Containers (OCI / Docker / BuildKit / cgroups)
        │
        ▼
Kubernetes (Pods · Deployments · Services · Ingress · Operators · Helm …)
        │
        ▼
IaC & delivery (Terraform · Ansible · GitHub Actions · Argo CD)
```

## How the platform operates

Cloudlane is a full cloud surface — identity → projects → compute/storage/data → edge → observe → pay. This is how it works:

```
Developer (CLI / SDK / Dashboard)
        │
        ▼
API Gateway ──► Authentication · IAM · Organizations · Projects
        │
        ├── Virtual Machines · Storage · Database · Networking · DNS
        ├── Monitoring · Logging · Backups
        ├── Marketplace
        └── Billing
```

| Service | Role |
|---|---|
| **Authentication** | Sign-in, tokens, API keys — who is calling |
| **IAM** | Roles, policies, least-privilege access across orgs and projects |
| **Organizations** | Top-level tenant boundary (company / team) |
| **Projects** | Scoped workspaces inside an org — isolate apps and quotas |
| **API Gateway** | Single front door: routing, authn/authz, rate limits, versioning |
| **Virtual Machines** | Compute instances (and container-backed workloads) |
| **Storage** | Object / block / volume storage for apps and backups |
| **Database** | Managed data stores for customer workloads |
| **Networking** | VPCs, load balancing, private connectivity, firewalls |
| **DNS** | Hostnames and records for public and private services |
| **Monitoring** | Metrics, health, alerts on every resource |
| **Logging** | Centralized logs from compute, gateways, and control plane |
| **Backups** | Snapshots and restore for storage and databases |
| **Billing** | Metered usage, invoices, IremboPay settlement |
| **Marketplace** | Discover and install partner / curated images and add-ons |
| **Developer CLI** | `cloudlane` — login, deploy, list, logs from the shell |
| **Cloudlane Terminal** | In-browser control-plane CLI in the console (same APIs as CLI) |
| **SDK** | Typed client libraries for the public API |

Identity and tenancy flow: **Organization → Project → IAM → resources**. Every VM, bucket, DB, and DNS zone lives under a project; Billing meters usage; Monitoring and Logging attach to the same resource IDs.

## Tech stack

Language → job, then the concrete products we run.

### Languages

| Domain | Language | Why |
|---|---|---|
| System programming | **C** | Pointers, memory, threads, sockets, files — OS-adjacent primitives |
| Cloud backend | **Go** | Control-plane services, operators, APIs that talk to K8s / cloud APIs |
| Frontend | **TypeScript + React + Next.js** | Dashboard, developer portal |
| Automation | **Python** | Scripts, AI, testing, FastAPI control-plane API (today) |
| Performance components | **Rust** | Hot paths: security, storage engines, networking |

```
C          ──► system core
Go         ──► cloud backend / operators
TypeScript ──► Next.js dashboard (+ CLI / SDK)
Python     ──► automation · AI · tests · API
Rust       ──► performance · security · storage · net
```

### Runtime & data plane

| Technology | Role |
|---|---|
| **Redis** | Cache, sessions, rate-limit counters, hot keys |
| **MinIO** | S3-compatible object storage |
| **Docker** | Images, volumes, networking, registry, BuildKit |
| **Kubernetes** | Orchestration (Pods, Deployments, Services, Ingress, …) |
| **Nginx** | Reverse proxy / TLS / edge routing |
| **Prometheus + Grafana** | Metrics and dashboards |
| **Loki** | Log aggregation (pairs with Grafana) |
| **NATS** | High-throughput messaging / fan-out |
| **RabbitMQ** | Work queues, durable async jobs |
| **Terraform** | Infrastructure as code |
| **Ubuntu Server** | Host OS for nodes and bastions |

### Control plane (today)

| Layer | Choice |
|---|---|
| API | Python FastAPI (+ Mangum on Netlify) |
| Async provision | `worker.py` + `provision_jobs` (compose `provision-worker`) |
| Customer API edge | Nginx `gateway-proxy` + Redis rate limits |
| Dashboard / Terminal / CLI | TypeScript (Next.js 14 console + Cloudlane Terminal, Commander.js CLI) |
| GraphQL | Strawberry (`POST /graphql` queries + mutations) |
| Control-plane DB | MongoDB (Atlas in prod, `docker compose` locally) |
| Managed SQL | Shared Postgres `:5433` / MySQL `:3307` or dedicated Docker (`:19600–19699`); backups → MinIO |
| Load balancers | HTTP `:8080`, HTTPS TLS `:8443`, TCP `:19400–19599` on `gateway-proxy` |
| Auth | JWT + platform keys (`cl_*`) + gateway keys (`gw_*`) |
| Billing | IremboPay invoice API + webhook (see docs/IREMBOPAY.md) |

```
[Client: Next.js / CLI / SDK]              [Tenant API clients]
        │                                           │
        ▼                                           ▼
   FastAPI :8001                            gateway-proxy :8080
        │                                           │
        ├── Redis (rate limits)                     ├── auth_request → FastAPI
        ├── provision-worker → K8s (optional)       └── proxy → deployment.publicUrl
        ├── MinIO (object storage)
        └── Prometheus · Grafana
                ▲
         docker compose locally · Terraform (planned)
```

## Repo

```
cloudlane/
├── apps/
│   ├── api_python/      # FastAPI control plane + worker.py + GraphQL
│   ├── api/             # legacy Node API (deprecated — do not point dashboard here)
│   └── dashboard/       # Next.js console + Cloudlane Terminal (Vercel)
├── packages/
│   ├── cli/             # `cloudlane` CLI
│   └── shared/          # Shared TypeScript types
├── infra/
│   ├── nginx/           # gateway-proxy + gateways/*.conf + lbs/*.conf + lb-stream/
│   └── prometheus/
├── docs/
│   ├── architecture.md  # dual-gateway model, layers, status
│   ├── LB.md · MANAGED_SQL.md · GRAPHQL.md · KEDA.md · IREMBOPAY.md
│   └── DEPLOYMENT.md
├── docker-compose.yml   # mongo, minio, redis, SQL, gateway-proxy, worker, …
└── README.md
```

Planned: Go operators / Terraform, Rust storage & networking crates, C system primitives.

## Local

Python 3.11+, Node 20+, Docker.

1. Copy env files:
   - Root `.env` → `MONGO_PASSWORD` (used by compose)
   - `apps/api_python/.env` from `apps/api_python/.env.example`
   - `apps/dashboard/.env.local` from `apps/dashboard/.env.example`

2. **Dashboard must target the Python API** (not the legacy Node `:3001` / old Netlify Node deploy):

```
# apps/dashboard/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8001
```

3. Match API credentials — compose creates Mongo user `cloudlane` with `MONGO_PASSWORD`. URL-encode special chars in `DATABASE_URL` (`#` → `%23`):

```
DATABASE_URL=mongodb://cloudlane:<password>@localhost:27017/cloudlane?authSource=admin
JWT_SECRET=<long random string>
REDIS_URL=redis://localhost:6380/0
MINIO_ENDPOINT=localhost:9010
```

**Never commit Atlas URIs** — GitHub secret scanning flags `mongodb+srv` with credentials.

```bash
docker compose up -d          # mongo, minio, redis, managed-postgres/mysql, gateway-proxy, …
npm install
cd apps/api_python && pip install -r requirements.txt
# Terminal A — control plane
cd apps/api_python && python -m uvicorn main:app --reload --port 8001
# Terminal B — dashboard
cd apps/dashboard && npm run dev
# or: npm run dev from repo root if wired for both
```

| Service | Port |
|---|---|
| FastAPI (control plane) | 8001 |
| Dashboard | 3000 |
| gateway-proxy HTTP / HTTPS | 8080 / 8443 |
| gateway-proxy TCP LB range | 19400–19599 |
| MongoDB (control plane) | 27017 |
| Managed Postgres (tenant SQL) | 5433 |
| Managed MySQL (tenant SQL) | 3307 |
| Dedicated SQL containers | 19600–19699 |
| Redis | 6380 |
| MinIO API / console | 9010 / 9011 |
| Prometheus / Grafana | 9090 / 3002 |

Run the worker separately (or rely on compose `provision-worker`):

```bash
cd apps/api_python && python worker.py
```

After changing `NEXT_PUBLIC_API_URL`, **restart Next.js** and **log in again** so the JWT matches that API host. In the console, select a project, then open **Cloudlane Terminal** → `status` (should report `python (full control plane)` + valid auth).

Optional: set `KUBECONFIG` for real K8s provisioning; without it deployments stay `pending`.  
For autoscaling / scale-to-zero, install KEDA on the cluster — [docs/KEDA.md](docs/KEDA.md).

More: [docs/LB.md](docs/LB.md) · [docs/MANAGED_SQL.md](docs/MANAGED_SQL.md) · [docs/GRAPHQL.md](docs/GRAPHQL.md).

## Production

| App | Host | Root |
|---|---|---|
| Dashboard | Vercel (`cloudlane-dashboard`) | `apps/dashboard` |
| API | Netlify | `apps/api_python` (Python — not `apps/api`) |

Netlify: base `apps/api_python`, build `pip install -r requirements.txt`, publish `public`, functions `netlify/functions`. Env: `DATABASE_URL` (Atlas, set in the UI only), `JWT_SECRET`. Atlas Network Access: `0.0.0.0/0`. Production branch: `develop`.

Vercel: `NEXT_PUBLIC_API_URL` = Netlify Python URL, no trailing slash. Redeploy after changing it. If `/api/databases` 404s or health lacks `encryption`, the site is still on the legacy Node function — redeploy from `apps/api_python`.

## Build phases

### Phase 1 — Core deploy loop
- [x] Multi-tenant Mongo ERD (tenants, users, deployments, api_keys, audit_logs, usage_metrics)
- [x] JWT + API key auth (+ scopes on deploy routes)
- [x] Dashboard signup/login + deploy modal + **console** (`/dashboard/console`)
- [x] **Cloudlane Terminal** — in-browser control-plane CLI (deploy, db, lb, gateway, graphql, …)
- [x] CLI (`login` returns API key, `deploy`, `logs`, `list`)
- [x] K8s Service + Ingress in Python API (honest `pending`/`failed` without cluster)
- [x] Deployment list, get, soft-delete, logs stub/stream
- [x] Projects collection + APIs + dashboard project switcher
- [x] API keys dashboard (create/revoke, plaintext once)
- [x] MinIO in compose + bucket APIs + object browser in console
- [x] Usage metering (`compute_seconds`) + billing/invoices + IremboPay sandbox
- [x] Monitoring summary + usage charts in console; Prometheus/Grafana in compose
- [x] VM lifecycle API (stub IP; hypervisor deferred)
- [x] **API Gateway** — CRUD, Nginx edge (`gateway-proxy`), `gw_*` keys, Redis rate limits
- [x] **Async deploy orchestrator** — `provision_jobs`, worker, `POST /api/deployments` → 202
- [x] **Quota service** — CPU/memory at max scale, deploy count, buckets, SQL disk; `GET /api/quota`
- [x] **Provider drivers** — `services/providers` (K8s compute, MinIO storage)
- [x] **Secret Vaults** — tenant `/api/secrets` + ops vault `/api/ops/secrets` (Cloudlane secret migration)
- [x] **Load Balancing** — HTTP/HTTPS/TCP on `gateway-proxy` ([docs/LB.md](docs/LB.md))
- [x] **Managed SQL** — shared + dedicated containers, disk quotas, MinIO backups ([docs/MANAGED_SQL.md](docs/MANAGED_SQL.md))
- [x] **GraphQL** — Strawberry schema with queries + mutations ([docs/GRAPHQL.md](docs/GRAPHQL.md))
- [x] **Scale-to-zero (KEDA)** — ScaledObject on provision; optional HTTP add-on (see docs/KEDA.md)
- [x] **IremboPay production charges** — real invoice API + webhook (see docs/IREMBOPAY.md)
- [x] Console product overviews + resource cards for live services

### Phase 2 — Polish
- Audit log viewer depth, alerting, Loki
- GraphiQL IDE in console (optional)
- Deeper gateway mutations via GraphQL

### Phase 3 — Broader surface
- Custom domains, orgs/IAM depth, VPC/security groups

## Design principles

- **Destructive-action safety** — tenant/deployment delete needs confirmation + grace period; deployments use `deletedAt`
- **Staged control-plane rollouts** — config to one internal tenant first, then percentage, never all-at-once
- **Tenant isolation** — one K8s namespace per tenant; Mongo queries always filtered by `tenantId`
- **Pricing transparency** — per-second billing, usage in `usage_metrics`

## Status

V1 control plane: **FastAPI** + **Next.js console** + **Cloudlane Terminal**. Live: API Gateway, async provisioning, quotas, secret vaults, **HTTP/HTTPS/TCP LBs**, **managed SQL + backups**, **KEDA scale-to-zero**, **IremboPay**, and **GraphQL** (read + mutations). Local dashboard must use `NEXT_PUBLIC_API_URL=http://localhost:8001` (Python) — legacy Node API lacks these routes. See [docs/architecture.md](docs/architecture.md).
