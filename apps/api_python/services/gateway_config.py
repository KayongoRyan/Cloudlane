from __future__ import annotations

import os
import re
from pathlib import Path

import database as db
from config import get_settings


def _nginx_escape(value: str) -> str:
    return value.replace('\\', '\\\\').replace('"', '\\"')


def _route_location_block(route: dict, deployment_url: str, gateway_id: str) -> str:
    method = route['method'].upper()
    path = route['path'].rstrip('/') or '/'
    timeout_s = max(route.get('timeoutMs', 30000) // 1000, 1)
    target = deployment_url.rstrip('/')
    proxy_pass = target
    if route.get('stripPathPrefix') and path != '/':
        proxy_pass = f'{target}/'

    return f"""
    location = "{_nginx_escape(path)}" {{
        limit_except {method} {{
            deny all;
        }}
        auth_request /internal/gateway/auth;
        proxy_connect_timeout {timeout_s}s;
        proxy_read_timeout {timeout_s}s;
        proxy_send_timeout {timeout_s}s;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Request-Id $request_id;
        proxy_set_header X-Cloudlane-Gateway-Id "{_nginx_escape(gateway_id)}";
        proxy_set_header X-Cloudlane-Route-Id "{_nginx_escape(route['id'])}";
        resolver 127.0.0.11 ipv6=off valid=30s;
        set $upstream "{_nginx_escape(proxy_pass)}";
        proxy_pass $upstream;
    }}
"""


def generate_gateway_server_block(gateway: dict, routes: list[dict]) -> str:
    hostnames = gateway.get('hostnames') or []
    if not hostnames:
        return ''

    route_blocks: list[str] = []
    for route in routes:
        if gateway.get('status') != 'active':
            continue
        deployment = db.find_deployment_by_id(route.get('targetDeploymentId', ''), gateway['tenantId'])
        if not deployment or deployment.get('status') != 'running' or not deployment.get('publicUrl'):
            continue
        route_blocks.append(_route_location_block(route, deployment['publicUrl'], gateway['id']))

    if not route_blocks:
        route_blocks.append("""
    location / {
        return 503 "Gateway has no active routes";
    }
""")

    server_names = ' '.join(_nginx_escape(h) for h in hostnames)
    blocks = '\n'.join(route_blocks)
    return f"""
server {{
    listen 80;
    server_name {server_names};

    location = /internal/gateway/auth {{
        internal;
        proxy_pass http://gateway-auth/internal/gateway/validate;
        proxy_pass_request_body off;
        proxy_set_header Content-Length "";
        proxy_set_header X-Original-URI $request_uri;
        proxy_set_header X-Gateway-Hostname $host;
        proxy_set_header X-Api-Key $http_x_api_key;
        proxy_set_header Authorization $http_authorization;
    }}

{blocks}
}}
"""


def generate_deploy_preview(gateway: dict, routes: list[dict]) -> str:
    return generate_gateway_server_block(gateway, routes).strip()


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


def sync_gateway_configs() -> None:
    settings = get_settings()
    config_dir = _resolve_config_dir(settings.gateway_config_dir)
    config_dir.mkdir(parents=True, exist_ok=True)

    for existing in config_dir.glob('*.conf'):
        existing.unlink()

    for gateway in db.list_all_active_gateways():
        routes = db.list_gateway_routes(gateway['id'])
        content = generate_gateway_server_block(gateway, routes).strip()
        if not content:
            continue
        safe_name = re.sub(r'[^a-zA-Z0-9_-]', '_', gateway['slug'])
        path = config_dir / f'{safe_name}.conf'
        path.write_text(content + '\n', encoding='utf-8')

    print(f'Synced gateway configs to {config_dir.resolve()}')
