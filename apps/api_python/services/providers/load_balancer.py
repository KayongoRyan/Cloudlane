from __future__ import annotations


class StubLoadBalancerProvider:
    """Metadata-only LB provisioning until real L4/L7 infra exists."""

    def is_ready(self) -> bool:
        return True

    def provision(self, name: str, scheme: str, protocol: str, port: int) -> dict:
        host = f'{name.replace(" ", "-").lower()}.lb.cloudlane.run'
        return {
            'dnsName': host,
            'status': 'active',
            'statusMessage': 'Load balancer recorded (stub provider — no data-plane yet)',
        }


def get_load_balancer_provider() -> StubLoadBalancerProvider:
    return StubLoadBalancerProvider()
