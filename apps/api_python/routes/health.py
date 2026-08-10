from fastapi import APIRouter
from database import ping_database

router = APIRouter()


@router.get('/health')
async def health_check():
    db_health = ping_database()
    return {
        'status': 'ok',
        'database': 'connected' if db_health else 'unavailable',
    }
