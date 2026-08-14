# Deployment (Vercel + GitHub)

Cloudlane uses **two Vercel projects** from this monorepo:

| Vercel project | Root directory | GitHub environment |
|---|---|---|
| `cloudlane-dashboard` | `apps/dashboard` | Production – cloudlane-dashboard |
| `cloudlane-api` | `apps/api` | Production – cloudlane-api |

## GitHub shows `inactive` for the API

This is **normal**, not a failure.

When a commit only touches files outside `apps/api` (for example dashboard UI work), Vercel **skips** the API build and reports the GitHub deployment status as:

- **State:** `inactive`
- **Description:** `Skipped - Not affected`

The API is still live at its last successful production deployment. Only the *latest commit* did not redeploy the API.

To get a fresh **success** status on GitHub for the API:

1. Push a change under `apps/api`, or
2. In Vercel → **cloudlane-api** → Deployments → **Redeploy** the latest production build.

## Required Vercel env vars (API)

Set these on the **cloudlane-api** project:

- `DATABASE_URL` — MongoDB Atlas connection string (not `localhost`)
- `JWT_SECRET` — signing secret for auth tokens

Also disable **Deployment Protection** on the API project (Settings → Deployment Protection) so the public dashboard can call it.

## Required Vercel env vars (dashboard)

Set on **cloudlane-dashboard** (or use `apps/dashboard/vercel.json`):

- `NEXT_PUBLIC_API_URL` — public URL of the deployed API (no trailing slash)

After changing this variable, **redeploy the dashboard** — Next.js bakes it in at build time.

## Local vs production

```bash
docker compose up -d          # Mongo locally
cd apps/api && npm run dev    # :3001
cd apps/dashboard && npm run dev  # :3000
```
