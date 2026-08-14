# Deployment

| App | Host | Root directory |
|---|---|---|
| Dashboard | Vercel (`cloudlane-dashboard`) | `apps/dashboard` |
| API | Netlify | `apps/api` |

---

## Netlify (API)

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

Build `DATABASE_URL` in the Atlas UI (**Connect → Drivers**): use your cluster hostname, database user, and password. URL-encode special characters in the password (e.g. `#` → `%23`). **Never commit the real connection string** — set it only in Netlify env vars and local `apps/api/.env` (gitignored).

After deploy, copy your site URL (e.g. `https://your-api.netlify.app`) and set on the **dashboard** (Vercel):

- `NEXT_PUBLIC_API_URL` = that URL (no trailing slash)
- Redeploy dashboard

Test: `https://your-api.netlify.app/health` → `{"status":"ok",...}`

### Remove old Vercel API project (one-time)

The API no longer deploys to Vercel. To avoid duplicate deploys and GitHub `inactive` noise:

1. [vercel.com](https://vercel.com) → open **cloudlane-api** (or any API project pointing at `apps/api`)
2. **Settings → General** → scroll to **Delete Project**
3. Confirm deletion

Keep only **cloudlane-dashboard** on Vercel.

---

## Vercel (dashboard)

Set on **cloudlane-dashboard**:

- `NEXT_PUBLIC_API_URL` — your Netlify API URL (no trailing slash), e.g. `https://comfy-starlight-51c0e7.netlify.app`

After changing this variable, **redeploy the dashboard** — Next.js bakes it in at build time.

---

## Local development

```bash
docker compose up -d          # Mongo locally
cd apps/api && npm run dev    # :3001
cd apps/dashboard && npm run dev  # :3000
```
