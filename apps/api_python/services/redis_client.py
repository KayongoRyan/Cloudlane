from __future__ import annotations

import time
from typing import Any

from config import get_settings

_client: Any = None


def get_redis():
    global _client
    if _client is not None:
        return _client
    try:
        import redis
    except ImportError:
        return None
    settings = get_settings()
    try:
        _client = redis.from_url(settings.redis_url, decode_responses=True)
        _client.ping()
        return _client
    except Exception as exc:
        print(f'Redis unavailable: {exc}')
        return None


def check_rate_limit(key: str, limit: int, window_seconds: int = 60) -> tuple[bool, int]:
    """Sliding-window rate limit. Returns (allowed, current_count)."""
    client = get_redis()
    if not client or limit <= 0:
        return True, 0

    now = time.time()
    window_start = now - window_seconds
    pipe = client.pipeline()
    pipe.zremrangebyscore(key, 0, window_start)
    pipe.zadd(key, {str(now): now})
    pipe.zcard(key)
    pipe.expire(key, window_seconds + 1)
    results = pipe.execute()
    count = int(results[2])
    if count > limit:
        client.zrem(key, str(now))
        return False, count
    return True, count


def cache_set(key: str, value: str, ttl_seconds: int = 300) -> None:
    client = get_redis()
    if client:
        client.setex(key, ttl_seconds, value)


def cache_get(key: str) -> str | None:
    client = get_redis()
    if not client:
        return None
    val = client.get(key)
    return str(val) if val is not None else None
