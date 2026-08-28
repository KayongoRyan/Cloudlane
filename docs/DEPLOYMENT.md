# Deployment

| App | Host | Root directory |
|---|---|---|
| Dashboard | Vercel (`cloudlane-dashboard`) | `apps/dashboard` |
| API | Netlify | `apps/api_python` |

---

## Netlify (API — FastAPI)

Config lives in `apps/api_python/netlify.toml`. Use these **Build settings** in the Netlify UI:

| Setting | Value |
|---|---|
| Base directory | `apps/api_python` |
| Build command | `pip install -r requirements.txt` |
| Publish directory | `public` |
| Functions directory | `netlify/functions` |

Do **not** use `npm run dev` — that was the legacy Node API.

### Netlify env vars

- `DATABASE_URL` — MongoDB Atlas connection string (**use `mongodb+srv://` — TLS built-in**)
- `JWT_SECRET` — auth signing secret
- `ENVIRONMENT` — set to `production` (enables HSTS + requires Mongo TLS)
- `SECRETS_MASTER_KEY` — optional Fernet root for secret vaults (else JWT_SECRET)

Optional: `JWT_EXPIRE_MINUTES` = `1440`, `FORCE_HTTPS=true`, `MONGO_TLS_REQUIRED=true`

Optional billing (IremboPay): `IREMBOPAY_API_KEY`, `IREMBOPAY_API_URL`, `IREMBOPAY_PAYMENT_ACCOUNT_IDENTIFIER`, `IREMBOPAY_PRODUCT_CODE`. Webhook URL: `https://<api-host>/api/billing/irembopay/webhook` — see [IREMBOPAY.md](IREMBOPAY.md).

Build `DATABASE_URL` in the Atlas UI (**Connect → Drivers**): use your cluster hostname, database user, and password. URL-encode special characters in the password (e.g. `#` → `%23`). **Never commit the real connection string** — set it only in Netlify env vars and local `apps/api_python/.env` (gitignored).

### Managed SQL (tenant product)

Local `docker compose` runs **managed-postgres** (`:5433`) and **managed-mysql** (`:3307`). Creating a Cloud SQL instance provisions a real database + user there; connection strings are Fernet-encrypted in Mongo. This does **not** replace Mongo (control plane). Netlify/production needs reachable `MANAGED_*` hosts if you expose the product there.

### Data encryption

| Hop | Encryption |
|---|---|
| Browser → Netlify / Vercel | TLS 1.3 (platform) |
| FastAPI responses | HSTS + security headers when HTTPS / `ENVIRONMENT=production` |
| FastAPI → MongoDB Atlas | TLS (`mongodb+srv` or `?tls=true`) |
| Secrets at rest | Fernet vaults; passwords bcrypt |

Probe: `GET /health/encryption` on the API.

After deploy, copy your site URL (e.g. `https://your-api.netlify.app`) and set on the **dashboard** (Vercel):

- `NEXT_PUBLIC_API_URL` = that URL (no trailing slash)
- Redeploy dashboard

Test: `https://your-api.netlify.app/health` → `{"status":"ok",...}`

### Migrate from legacy Node API (`apps/api`)

If Netlify still points at `apps/api`, change **Base directory** to `apps/api_python` and redeploy. Same env vars (`DATABASE_URL`, `JWT_SECRET`). The FastAPI app uses the same Mongo ERD and route paths.

---

## Vercel (dashboard)

Set on **cloudlane-dashboard**:

- `NEXT_PUBLIC_API_URL` — your Netlify API URL (no trailing slash), e.g. `https://comfy-starlight-51c0e7.netlify.app`

After changing this variable, **redeploy the dashboard** — Next.js bakes it in at build time.

---

## Local development

```bash
docker compose up -d
cd apps/api_python
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python -m uvicorn main:app --reload --port 8001

cd ../dashboard && npm run dev   # :3000
```

Or from repo root: `npm run dev` (API :8001 + dashboard :3000).
