# E2E Stack Validation Results

**Date:** 2026-08-22  
**Environment:** Windows local — `docker compose`, API `:8001`, dashboard `:3000`

## Sign-off checklist

| Check | Result |
|---|---|
| `docker compose ps` — mongo, redis, gateway-proxy, provision-worker | PASS |
| API `:8001` healthy | PASS |
| Dashboard `:3000` responds | PASS |
| Register/login + projects API | PASS |
| Deploy returns 202 → worker → terminal status | PASS (`running` with K8s; `pending` without) |
| Gateway CRUD + nginx conf sync to `infra/nginx/gateways/` | PASS |
| Gateway validate: 401 without key, 204 with `gw_*` key | PASS |
| Usage metrics recorded | PASS |
| Billing usage endpoint | PASS (after fixing path to `/api/billing/usage`) |
| Rate limit 429 at 50 reqs | N/A (threshold 1000 rpm) |

## Fixes applied during validation

1. **`ref_str()` ObjectId conversion** — [`database.py`](../apps/api_python/database.py) uses `value.binary.hex()` for pymongo/docker bson compatibility (worker was crashing on `claim_next_provision_job`).
2. **Gateway config path** — [`gateway_config.py`](../apps/api_python/services/gateway_config.py) resolves `GATEWAY_CONFIG_DIR` relative to repo root (`docker-compose.yml`) so nginx mount matches API writes.
3. **Nginx dynamic upstream** — resolver + variable `proxy_pass` so fake `*.cloudlane.run` URLs do not break nginx reload.
4. **Nginx hash bucket** — `server_names_hash_bucket_size 128` in [`infra/nginx/nginx.conf`](../infra/nginx/nginx.conf) for long gateway hostnames.

## Known gaps (expected)

| Item | Notes |
|---|---|
| Edge `401` without key via `:8080` | Validate endpoint enforces auth; edge may return upstream `200` if auth subrequest routing differs — investigate if strict edge 401 required |
| CDN + WAF | Not in local compose |
| Quota enforcement | Deploy count only — next build item |
| Secret vaults | `.env` still holds secrets |
| K8s without cluster | Deployments correctly end at `pending` |

## Automation

Re-run full suite:

```bash
docker compose up -d
cd apps/api_python && python -m uvicorn main:app --reload --port 8001
python worker.py   # or rely on compose provision-worker
python scripts/e2e_validate.py
```

Latest machine-readable output: [`e2e-validation-results.json`](./e2e-validation-results.json)

## Next step (per architecture diagram)

**Quota Check** — enforce `maxCpu`, `maxMemoryMb`, `maxInstances` at deploy enqueue in [`routes/deployments.py`](../apps/api_python/routes/deployments.py).
