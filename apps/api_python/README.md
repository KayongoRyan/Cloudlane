# Cloudlane FastAPI API

This FastAPI service provides the Python API layer for Cloudlane.

## Run locally

1. Create a virtual environment:

   python -m venv .venv
   .venv\Scripts\activate

2. Install dependencies:

   pip install -r requirements.txt

3. Copy environment variables:

   copy .env.example .env

4. Start the app:

   uvicorn main:app --reload --host 0.0.0.0 --port 8001

## Routes

- `POST /api/auth/login`
- `GET /api/deployments`
- `POST /api/deployments`
- `GET /api/health`
