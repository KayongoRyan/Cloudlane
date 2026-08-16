from datetime import datetime, timezone

from fastapi import APIRouter

from config import get_settings
from database import ping_database

router = APIRouter()


@router.get('/health')
async def health_check():
    settings = get_settings()
    url = settings.database_url or ''
    return {
        'status': 'ok',
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'hasDatabaseUrl': bool(url),
        'database': (
            'atlas' if 'mongodb.net' in url
            else 'localhost' if 'localhost' in url
            else 'other' if url
            else 'missing'
        ),
    }


@router.get('/health/db')
async def health_db():
    settings = get_settings()
    url = settings.database_url or ''
    return {
        'status': 'ok',
        'database': (
            'atlas-configured' if 'mongodb.net' in url
            else 'localhost' if 'localhost' in url
            else 'other' if url
            else 'missing'
        ),
        'hasDatabaseUrl': bool(url),
        'note': 'This endpoint does not open Mongo (avoids Netlify 502). Sign in tests the real connection.',
    }
