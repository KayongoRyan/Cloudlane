# KEDA scale-to-zero (Cloudlane)

Cloudlane provisions a KEDA **ScaledObject** (CPU) for each K8s deployment when `KEDA_ENABLED=true`.  
`minInstances: 0` is honored (no longer coerced to 1).

CPU scalers **cannot activate from zero**. KEDA’s admission webhook also **rejects** `minReplicaCount: 0` when the only triggers are CPU/memory. Cloudlane therefore:

- Still allows Deployment `replicas: 0` when you set `minInstances: 0`
- Creates a **ScaledObject with min=1** (CPU) unless the HTTP add-on is enabled
- With `KEDA_HTTP_ADDON_ENABLED=true`, also creates `HTTPScaledObject` for true request-driven scale-from-zero

## Install on kind / Docker Desktop Kubernetes

### Option A — kubectl only (no Helm)

```powershell
# Core KEDA
kubectl apply --server-side -f https://github.com/kedacore/keda/releases/download/v2.16.1/keda-2.16.1.yaml
kubectl wait --for=condition=available --timeout=180s deployment/keda-operator -n keda

# Optional HTTP add-on (true scale-from-zero)
kubectl apply --server-side -f https://github.com/kedacore/http-add-on/releases/download/v0.8.0/keda-http-add-on-0.8.0-crds.yaml
kubectl apply --server-side -f https://github.com/kedacore/http-add-on/releases/download/v0.8.0/keda-http-add-on-0.8.0.yaml
```

Then in `apps/api_python/.env`:

```
KEDA_ENABLED=true
KEDA_HTTP_ADDON_ENABLED=true
```

Restart the API/worker so settings reload.

### Option B — Helm (if installed)

```bash
# Core KEDA
helm repo add kedacore https://kedacore.github.io/charts
helm repo update
helm install keda kedacore/keda --namespace keda --create-namespace

# Optional — request-driven scale-from-zero
helm install http-add-on kedacore/keda-add-ons-http --namespace keda
```

On Windows without Helm: use Option A, or install Helm via an **Admin** PowerShell (`choco install kubernetes-helm`) / portable binary from https://github.com/helm/helm/releases.

Point Cloudlane at the cluster (`KUBECONFIG` or default kubeconfig), then deploy with:

```json
{ "name": "api", "image": "nginx:alpine", "port": 80, "minInstances": 0, "maxInstances": 3 }
```

## Env

| Variable | Default | Meaning |
|---|---|---|
| `KEDA_ENABLED` | `true` | Create ScaledObject on provision |
| `KEDA_HTTP_ADDON_ENABLED` | `false` | Also create HTTPScaledObject when min=0 |
| `KEDA_COOLDOWN_SECONDS` | `300` | Scale-down cool down |
| `KEDA_CPU_THRESHOLD` | `70` | CPU utilization target (%) |

If CRDs are missing, provisioning still succeeds; `statusMessage` notes that KEDA was skipped.

## Soft-delete

Deleting a deployment removes ScaledObject / HTTPScaledObject best-effort. Deployment/Service/Ingress cleanup is still manual / future work.
