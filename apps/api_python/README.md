# Cloudlane FastAPI API

Python control plane for Cloudlane. Replaces the legacy Node.js API in `apps/api`.

## Run locally

```bash
cd apps/api_python
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux
pip install -r requirements.txt
copy .env.example .env          # set DATABASE_URL + JWT_SECRET
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

From repo root: `npm run dev:api` (port **8001**).

## Routes

| Method | Path |
|---|---|
| `POST` | `/api/auth/register` |
| `POST` | `/api/auth/login` |
| `GET/POST` | `/api/deployments` |
| `GET/POST` | `/api/api-keys` |
| `DELETE` | `/api/api-keys/{id}` |
| `GET` | `/api/audit-logs` |
| `GET/POST` | `/api/usage-metrics` |
| `GET` | `/health` |

Auth: `Authorization: Bearer <jwt>` or `X-API-Key`.

## Netlify

Set Netlify **base directory** to `apps/api_python`. Env: `DATABASE_URL`, `JWT_SECRET`. See [docs/DEPLOYMENT.md](../../docs/DEPLOYMENT.md).
