from __future__ import annotations

from datetime import datetime, timedelta, timezone

import database as db
from config import get_settings
from services.redis_client import cache_get, cache_set, check_rate_limit
from services.utils import hash_api_key


def extract_api_key(headers: dict[str, str]) -> str | None:
    api_key = headers.get('x-api-key') or headers.get('X-Api-Key')
    if api_key:
        return api_key.strip()
    auth = headers.get('authorization') or headers.get('Authorization') or ''
    if auth.lower().startswith('bearer '):
        return auth[7:].strip()
    return None


def validate_gateway_request(
    hostname: str,
    api_key_raw: str | None,
    route_id: str | None = None,
) -> tuple[bool, str, dict | None]:
    """Returns (ok, error_message, context)."""
    gateway = _find_gateway_by_hostname(hostname)
    if not gateway:
        return False, 'Gateway not found', None
    if gateway.get('status') != 'active':
        return False, 'Gateway disabled', None

    if not api_key_raw:
        return False, 'Missing API key', None

    prefix = api_key_raw[:8]
    cache_key = f'gwkey:{prefix}:{hash_api_key(api_key_raw)}'
    cached_id = cache_get(cache_key)
    record = None
    if cached_id:
        record = db.find_gateway_key(prefix, hash_api_key(api_key_raw))
    else:
        record = db.find_gateway_key(prefix, hash_api_key(api_key_raw))
        if record:
            cache_set(cache_key, record['id'], 300)

    if not record or record['gatewayId'] != gateway['id']:
        return False, 'Invalid API key', None

    rpm = record.get('rateLimitRpm') or get_settings().gateway_default_rate_limit_rpm
    rl_key = f'gwrl:{gateway["id"]}:{record["id"]}'
    if route_id:
        rl_key = f'{rl_key}:{route_id}'
    allowed, count = check_rate_limit(rl_key, rpm, 60)
    if not allowed:
        return False, f'Rate limit exceeded ({count}/{rpm} rpm)', None

    db.mark_gateway_key_used(record['id'])
    _record_gateway_metric(gateway)
    return True, '', {
        'gatewayId': gateway['id'],
        'tenantId': gateway['tenantId'],
        'keyId': record['id'],
    }


def _find_gateway_by_hostname(hostname: str) -> dict | None:
    host = hostname.lower().split(':')[0]
    cache_key = f'gwhost:{host}'
    cached = cache_get(cache_key)
    if cached:
        gw = db.find_gateway_by_id_any(cached)
        if gw:
            return gw
    for gateway in db.list_all_active_gateways():
        for name in gateway.get('hostnames') or []:
            if name.lower() == host:
                cache_set(cache_key, gateway['id'], 600)
                return gateway
    return None


def _record_gateway_metric(gateway: dict) -> None:
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(minutes=1)
    try:
        db.create_usage_metric({
            'tenantId': gateway['tenantId'],
            'gatewayId': gateway['id'],
            'metricType': 'gateway_requests',
            'value': 1,
            'windowStart': window_start,
            'windowEnd': now,
        })
    except Exception as exc:
        print(f'gateway metric write failed: {exc}')
