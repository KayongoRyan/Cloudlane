# Deployment

| App | Host | Root directory |
|---|---|---|
| Dashboard | Vercel (`cloudlane-dashboard`) | `apps/dashboard` |
| API | Netlify or Vercel | `apps/api` |

---

## Netlify (API) — recommended backend

Config lives in `apps/api/netlify.toml`. Use these **Build settings** in the Netlify UI:

| Setting | Value |
|---|---|
| Base directory | `apps/api` |
| Build command | `npm run build` |
| Publish directory | `public` |
| Functions directory | `netlify/functions` |

Do **not** use `npm run dev` — that is local development only.

### Netlify env vars

- `DATABASE_URL` — MongoDB Atlas connection string
- `JWT_SECRET` — auth signing secret

Optional: `JWT_EXPIRES_IN` = `24h`

After deploy, copy your site URL (e.g. `https://your-api.netlify.app`) and set on the **dashboard** (Vercel):

- `NEXT_PUBLIC_API_URL` = that URL (no trailing slash)
- Redeploy dashboard

Test: `https://your-api.netlify.app/health` → `{"status":"ok",...}`

---

## Vercel (API) — alternative

| Vercel project | Root directory |
|---|---|
| `cloudlane-api` | `apps/api` |

### GitHub shows `inactive` for the API on Vercel

This is **normal**, not a failure.

When a commit only touches files outside `apps/api` (for example dashboard UI work), Vercel **skips** the API build and reports the GitHub deployment status as:

- **State:** `inactive`
- **Description:** `Skipped - Not affected`

The API is still live at its last successful production deployment. Only the *latest commit* did not redeploy the API.

To get a fresh **success** status on GitHub for the API:

1. Push a change under `apps/api`, or
2. In Vercel → **cloudlane-api** → Deployments → **Redeploy** the latest production build.

### Required Vercel env vars (API)

Set these on the **cloudlane-api** project:

- `DATABASE_URL` — MongoDB Atlas connection string (not `localhost`)
- `JWT_SECRET` — signing secret for auth tokens

Also disable **Deployment Protection** on the API project (Settings → Deployment Protection) so the public dashboard can call it.

---

## Vercel (dashboard)

Set on **cloudlane-dashboard**:

- `NEXT_PUBLIC_API_URL` — your Netlify or Vercel API URL (no trailing slash)

After changing this variable, **redeploy the dashboard** — Next.js bakes it in at build time.

---

## Local development

```bash
docker compose up -d          # Mongo locally
cd apps/api && npm run dev    # :3001
cd apps/dashboard && npm run dev  # :3000
```
