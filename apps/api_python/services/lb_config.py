from __future__ import annotations

import re
from pathlib import Path

import database as db
from config import get_settings
from services.nginx_reload import reload_gateway_proxy

# HTTP L7 only on gateway-proxy; HTTPS uses the same Host routing until TLS exists.
_SYNC_PROTOCOLS = frozenset({'HTTP', 'HTTPS'})


def _nginx_escape(value: str) -> str:
    return value.replace('\\', '\\\\').replace('"', '\\"')


def _resolve_config_dir(configured: str) -> Path:
    path = Path(configured)
    if path.is_absolute():
        return path
    cwd = Path.cwd()
    probe = cwd
    while probe != probe.parent:
        if (probe / 'docker-compose.yml').exists():
            return probe / path
        probe = probe.parent
    return cwd / path


def generate_lb_server_block(lb: dict) -> str:
    dns_name = (lb.get('dnsName') or '').strip()
    if not dns_name:
        return ''

    protocol = (lb.get('protocol') or 'HTTP').upper()
    if protocol not in _SYNC_PROTOCOLS:
        return ''

    if lb.get('status') != 'active':
        return ''

    upstream_url = ''
    target_id = lb.get('targetDeploymentId')
    if target_id:
        deployment = db.find_deployment_by_id(target_id, lb['tenantId'])
        if (
            deployment
            and deployment.get('status') == 'running'
            and deployment.get('publicUrl')
        ):
            upstream_url = deployment['publicUrl'].rstrip('/')

    if upstream_url:
        location = f"""
    location / {{
        proxy_connect_timeout 10s;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Request-Id $request_id;
        proxy_set_header X-Cloudlane-Load-Balancer-Id "{_nginx_escape(lb['id'])}";
        resolver 127.0.0.11 ipv6=off valid=30s;
        set $upstream "{_nginx_escape(upstream_url)}";
        proxy_pass $upstream;
    }}
"""
    else:
        location = """
    location / {
        return 503 "Load balancer has no healthy target";
    }
"""

    return f"""
server {{
    listen 80;
    server_name {_nginx_escape(dns_name)};
{location}
}}
"""


def sync_lb_configs() -> None:
    settings = get_settings()
    config_dir = _resolve_config_dir(settings.lb_config_dir)
    config_dir.mkdir(parents=True, exist_ok=True)

    for existing in config_dir.glob('*.conf'):
        existing.unlink()

    for lb in db.list_all_active_load_balancers():
        content = generate_lb_server_block(lb).strip()
        if not content:
            continue
        safe_name = re.sub(r'[^a-zA-Z0-9_-]', '_', lb['name'])
        path = config_dir / f'lb-{safe_name}.conf'
        path.write_text(content + '\n', encoding='utf-8')

    print(f'Synced LB configs to {config_dir.resolve()}')
    reload_gateway_proxy()
