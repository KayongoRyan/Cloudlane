from __future__ import annotations

from config import get_settings


class NginxLoadBalancerProvider:
    """L7 HTTP data-plane via gateway-proxy nginx; TCP remains metadata-only."""

    def is_ready(self) -> bool:
        return True

    def provision(self, name: str, scheme: str, protocol: str, port: int) -> dict:
        settings = get_settings()
        host = f'{name.replace(" ", "-").lower()}.{settings.lb_base_domain}'
        proto = (protocol or 'HTTP').upper()
        if proto == 'TCP':
            return {
                'dnsName': host,
                'status': 'active',
                'statusMessage': (
                    'TCP load balancer recorded (metadata only — L4/stream data-plane not synced yet)'
                ),
            }
        return {
            'dnsName': host,
            'status': 'active',
            'statusMessage': (
                f'L7 data-plane on gateway-proxy :8080 — '
                f'curl -H "Host: {host}" http://localhost:8080/'
            ),
        }


# Back-compat alias for imports that still expect the stub name
StubLoadBalancerProvider = NginxLoadBalancerProvider


def get_load_balancer_provider() -> NginxLoadBalancerProvider:
    return NginxLoadBalancerProvider()
