from __future__ import annotations

import logging
import subprocess

logger = logging.getLogger(__name__)

GATEWAY_PROXY_CONTAINER = 'cloudlane-gateway-proxy'


def reload_gateway_proxy() -> None:
    """Best-effort nginx reload so new server_name blocks take effect."""
    try:
        result = subprocess.run(
            ['docker', 'exec', GATEWAY_PROXY_CONTAINER, 'nginx', '-s', 'reload'],
            capture_output=True,
            text=True,
            timeout=15,
            check=False,
        )
        if result.returncode != 0:
            detail = (result.stderr or result.stdout or '').strip()
            logger.warning('nginx reload failed (rc=%s): %s', result.returncode, detail or 'no output')
    except FileNotFoundError:
        logger.warning('docker not on PATH — skip nginx reload')
    except Exception as exc:
        logger.warning('nginx reload error: %s', exc)
