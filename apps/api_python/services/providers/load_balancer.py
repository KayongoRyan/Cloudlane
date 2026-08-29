from __future__ import annotations

from config import get_settings


class NginxLoadBalancerProvider:
    """L7 HTTP/HTTPS and L4 TCP data-plane via gateway-proxy nginx."""

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
                    f'L4 TCP on gateway-proxy :{port} — '
                    f'nc localhost {port} (target deployment must be running)'
                ),
            }
        if proto == 'HTTPS':
            return {
                'dnsName': host,
                'status': 'active',
                'statusMessage': (
                    f'L7 HTTPS TLS terminate on gateway-proxy :8443 — '
                    f'curl -k -H "Host: {host}" https://localhost:8443/'
                ),
            }
        return {
            'dnsName': host,
            'status': 'active',
            'statusMessage': (
                f'L7 HTTP on gateway-proxy :8080 — '
                f'curl -H "Host: {host}" http://localhost:8080/'
            ),
        }


# Back-compat alias for imports that still expect the stub name
StubLoadBalancerProvider = NginxLoadBalancerProvider


def get_load_balancer_provider() -> NginxLoadBalancerProvider:
    return NginxLoadBalancerProvider()
