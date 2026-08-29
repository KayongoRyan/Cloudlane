from __future__ import annotations

import re
from pathlib import Path
from urllib.parse import urlparse

import database as db
from config import get_settings
from services.lb_tls import ensure_self_signed_cert
from services.nginx_reload import reload_gateway_proxy


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


def _safe_lb_name(name: str) -> str:
    return re.sub(r'[^a-zA-Z0-9_-]', '_', name)


def _resolve_deployment_target(lb: dict) -> tuple[str, str] | None:
    target_id = lb.get('targetDeploymentId')
    if not target_id:
        return None
    deployment = db.find_deployment_by_id(target_id, lb['tenantId'])
    if not deployment or deployment.get('status') != 'running' or not deployment.get('publicUrl'):
        return None
    parsed = urlparse(deployment['publicUrl'])
    host = parsed.hostname
    if not host:
        return None
    port = int(deployment.get('port') or 80)
    return host, str(port)


def _resolve_http_upstream(lb: dict) -> str:
    target_id = lb.get('targetDeploymentId')
    if not target_id:
        return ''
    deployment = db.find_deployment_by_id(target_id, lb['tenantId'])
    if (
        deployment
        and deployment.get('status') == 'running'
        and deployment.get('publicUrl')
    ):
        return deployment['publicUrl'].rstrip('/')
    return ''


def _http_location_block(upstream_url: str, lb_id: str) -> str:
    if upstream_url:
        return f"""
    location / {{
        proxy_connect_timeout 10s;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Request-Id $request_id;
        proxy_set_header X-Cloudlane-Load-Balancer-Id "{_nginx_escape(lb_id)}";
        resolver 127.0.0.11 ipv6=off valid=30s;
        set $upstream "{_nginx_escape(upstream_url)}";
        proxy_pass $upstream;
    }}
"""
    return """
    location / {
        return 503 "Load balancer has no healthy target";
    }
"""


def generate_lb_http_server_block(lb: dict) -> str:
    dns_name = (lb.get('dnsName') or '').strip()
    if not dns_name or lb.get('status') != 'active':
        return ''
    if (lb.get('protocol') or 'HTTP').upper() != 'HTTP':
        return ''
    upstream_url = _resolve_http_upstream(lb)
    location = _http_location_block(upstream_url, lb['id'])
    return f"""
server {{
    listen 80;
    server_name {_nginx_escape(dns_name)};
{location}
}}
"""


def generate_lb_https_server_block(lb: dict, cert_container_path: str, key_container_path: str) -> str:
    dns_name = (lb.get('dnsName') or '').strip()
    if not dns_name or lb.get('status') != 'active':
        return ''
    if (lb.get('protocol') or 'HTTP').upper() != 'HTTPS':
        return ''
    upstream_url = _resolve_http_upstream(lb)
    location = _http_location_block(upstream_url, lb['id'])
    return f"""
server {{
    listen 443 ssl;
    server_name {_nginx_escape(dns_name)};
    ssl_certificate {_nginx_escape(cert_container_path)};
    ssl_certificate_key {_nginx_escape(key_container_path)};
    ssl_protocols TLSv1.2 TLSv1.3;
{location}
}}
"""


def generate_lb_stream_block(lb: dict) -> str:
    if lb.get('status') != 'active':
        return ''
    if (lb.get('protocol') or 'HTTP').upper() != 'TCP':
        return ''
    listen_port = int(lb.get('port') or 0)
    if listen_port <= 0:
        return ''
    target = _resolve_deployment_target(lb)
    if target:
        host, port = target
        upstream = f'{host}:{port}'
        return f"""
server {{
    listen {listen_port};
    resolver 127.0.0.11 ipv6=off valid=30s;
    set $upstream "{_nginx_escape(upstream)}";
    proxy_connect_timeout 10s;
    proxy_timeout 300s;
    proxy_pass $upstream;
}}
"""
    return f"""
server {{
    listen {listen_port};
    return 503;
}}
"""


def sync_lb_configs() -> None:
    settings = get_settings()
    http_dir = _resolve_config_dir(settings.lb_config_dir)
    stream_dir = _resolve_config_dir(settings.lb_stream_config_dir)
    cert_dir = _resolve_config_dir(settings.lb_tls_cert_dir)
    http_dir.mkdir(parents=True, exist_ok=True)
    stream_dir.mkdir(parents=True, exist_ok=True)
    cert_dir.mkdir(parents=True, exist_ok=True)

    for existing in http_dir.glob('*.conf'):
        existing.unlink()
    for existing in stream_dir.glob('*.conf'):
        existing.unlink()

    for lb in db.list_all_active_load_balancers():
        protocol = (lb.get('protocol') or 'HTTP').upper()
        safe_name = _safe_lb_name(lb['name'])

        if protocol == 'HTTP':
            content = generate_lb_http_server_block(lb).strip()
            if content:
                (http_dir / f'lb-{safe_name}.conf').write_text(content + '\n', encoding='utf-8')
        elif protocol == 'HTTPS':
            dns_name = (lb.get('dnsName') or '').strip()
            if dns_name:
                cert_path = cert_dir / f'{safe_name}.crt'
                key_path = cert_dir / f'{safe_name}.key'
                ensure_self_signed_cert(dns_name, cert_path, key_path)
                cert_container = f'/etc/nginx/lbs/certs/{safe_name}.crt'
                key_container = f'/etc/nginx/lbs/certs/{safe_name}.key'
                content = generate_lb_https_server_block(lb, cert_container, key_container).strip()
                if content:
                    (http_dir / f'lb-{safe_name}.conf').write_text(content + '\n', encoding='utf-8')
        elif protocol == 'TCP':
            content = generate_lb_stream_block(lb).strip()
            if content:
                (stream_dir / f'lb-{safe_name}.conf').write_text(content + '\n', encoding='utf-8')

    print(
        f'Synced LB configs to {http_dir.resolve()} '
        f'and stream configs to {stream_dir.resolve()}'
    )
    reload_gateway_proxy()
