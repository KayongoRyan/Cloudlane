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

- `DATABASE_URL` — MongoDB Atlas connection string
- `JWT_SECRET` — auth signing secret

Optional: `JWT_EXPIRE_MINUTES` = `1440`

Build `DATABASE_URL` in the Atlas UI (**Connect → Drivers**): use your cluster hostname, database user, and password. URL-encode special characters in the password (e.g. `#` → `%23`). **Never commit the real connection string** — set it only in Netlify env vars and local `apps/api_python/.env` (gitignored).

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
