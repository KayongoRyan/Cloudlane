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
| **Developer CLI** | `cloudlane` — login, deploy, list, logs from the terminal |
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
| Dashboard / CLI / SDK | TypeScript (Next.js 14, Commander.js) |
| Control-plane DB | MongoDB (Atlas in prod, `docker compose` locally) |
| Auth | JWT + hashed API keys |
| Billing | IremboPay (customer id reserved; charges not wired) |

```
[Client: Next.js / CLI / SDK]
        │
        ▼
   Nginx (reverse proxy)
        │
        ▼
   Go / Python backends ── Redis · NATS · RabbitMQ
        │
        ├── MinIO (object storage)
        ├── Kubernetes (Docker workloads)
        └── Prometheus · Grafana · Loki
                ▲
         Ubuntu Server + Terraform
```

## Repo

```
cloudlane/
├── apps/
│   ├── api_python/   # Python FastAPI control plane (Netlify)
│   ├── api/          # legacy Node API (deprecated)
│   └── dashboard/    # TypeScript Next.js dashboard (Vercel)
├── packages/
│   ├── cli/          # TypeScript `cloudlane` CLI
│   └── shared/       # Shared TypeScript types
├── docs/DEPLOYMENT.md
├── docker-compose.yml   # local Mongo
└── README.md
```

Planned: Go operators / Terraform, Rust storage & networking crates, C system primitives.

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
- [x] JWT + API key auth (+ scopes on deploy routes)
- [x] Dashboard signup/login + deploy modal + **console** (`/dashboard/console`)
- [x] CLI (`login` returns API key, `deploy`, `logs`, `list`)
- [x] K8s Service + Ingress in Python API (honest `pending`/`failed` without cluster)
- [x] Deployment list, get, soft-delete, logs stub/stream
- [x] Projects collection + APIs + dashboard project switcher
- [x] API keys dashboard (create/revoke, plaintext once)
- [x] MinIO in compose + bucket APIs + dashboard storage tab
- [x] Usage metering (`compute_seconds`) + billing/invoices + IremboPay sandbox
- [x] Monitoring summary + usage charts in console; Prometheus/Grafana in compose
- [x] VM lifecycle API (stub IP; hypervisor deferred)
- [ ] Scale-to-zero (KEDA)
- [ ] IremboPay production charges

### Phase 2 — Polish
- Audit log viewer, quotas UI from `tenants.limits`, alerting, Loki

### Phase 3 — Broader surface
- Managed Postgres for customers, secrets vault, custom domains, orgs/IAM depth

## Design principles

- **Destructive-action safety** — tenant/deployment delete needs confirmation + grace period; deployments use `deletedAt`
- **Staged control-plane rollouts** — config to one internal tenant first, then percentage, never all-at-once
- **Tenant isolation** — one K8s namespace per tenant; Mongo queries always filtered by `tenantId`
- **Pricing transparency** — per-second billing, usage in `usage_metrics`

## Status

V1 control-plane surfaces implemented in **FastAPI** + **Next dashboard console**. Local stack: `docker compose up` (Mongo, MinIO, Prometheus, Grafana). Point Netlify base dir to `apps/api_python` and redeploy.
