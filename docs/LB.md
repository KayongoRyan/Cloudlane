# Load balancers (gateway-proxy data plane)

Tenant load balancers sync to the `gateway-proxy` nginx container. Control plane CRUD is at `/api/load-balancers`; configs are written under `infra/nginx/`.

## Protocols

| Protocol | Edge port (host) | Nginx module | Notes |
|---|---|---|---|
| HTTP | `8080` → container `80` | `http` | Route by `Host: <dnsName>` |
| HTTPS | `8443` → container `443` | `http` + `ssl` | TLS terminate; self-signed dev cert per LB hostname |
| TCP | `19400–19599` (listen port = LB `port`) | `stream` | L4 proxy to target deployment `host:port` |

DNS names are `*.lb.cloudlane.run` (see `LB_BASE_DOMAIN`).

## Create flow

1. `POST /api/load-balancers` with `name`, `protocol`, `port`, optional `targetDeploymentId`.
2. `sync_lb_configs()` writes:
   - HTTP/HTTPS → `infra/nginx/lbs/lb-<name>.conf`
   - TCP → `infra/nginx/lb-stream/lb-<name>.conf`
   - HTTPS certs → `infra/nginx/lbs/certs/<name>.{crt,key}` (auto-generated via `cryptography`)
3. `docker exec cloudlane-gateway-proxy nginx -s reload`

TCP listen ports must be unique and within `LB_TCP_PORT_MIN`–`LB_TCP_PORT_MAX` (default `19400–19599`; avoids common host conflicts like MinIO on `9000`).

## Examples

```bash
# HTTP L7
curl -H "Host: my-app.lb.cloudlane.run" http://localhost:8080/

# HTTPS (dev self-signed — use -k)
curl -k -H "Host: my-app.lb.cloudlane.run" https://localhost:8443/

# TCP L4 (LB port 19401 → deployment upstream)
nc -vz localhost 19401
```

## Env

| Variable | Default |
|---|---|
| `LB_CONFIG_DIR` | `infra/nginx/lbs` |
| `LB_STREAM_CONFIG_DIR` | `infra/nginx/lb-stream` |
| `LB_TLS_CERT_DIR` | `infra/nginx/lbs/certs` |
| `LB_BASE_DOMAIN` | `lb.cloudlane.run` |
| `LB_TCP_PORT_MIN` | `19400` |
| `LB_TCP_PORT_MAX` | `19599` |

## Production notes

- Replace self-signed certs with tenant-uploaded or ACME-managed certs (not yet in API).
- Publish `8443` and the TCP port range on your edge load balancer / firewall.
- Target resolution uses the deployment `publicUrl` hostname and `port` field.
