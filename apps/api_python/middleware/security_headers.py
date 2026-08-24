"""HTTPS / HSTS / security headers — Cloudlane edge → origin encryption posture."""

from __future__ import annotations

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from config import get_settings


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Maps diagram step: User → edge (TLS 1.3) → control plane.

    Netlify/Vercel terminate TLS; this middleware adds HSTS and hardening headers
    so browsers only talk HTTPS after first visit when enabled.
    """

    async def dispatch(self, request: Request, call_next):
        settings = get_settings()
        response: Response = await call_next(request)

        response.headers.setdefault('X-Content-Type-Options', 'nosniff')
        response.headers.setdefault('X-Frame-Options', 'DENY')
        response.headers.setdefault('Referrer-Policy', 'strict-origin-when-cross-origin')
        response.headers.setdefault(
            'Permissions-Policy',
            'geolocation=(), microphone=(), camera=()',
        )

        # Trust proxy headers when behind Netlify / Cloudflare
        forwarded_proto = (request.headers.get('x-forwarded-proto') or '').split(',')[0].strip()
        is_https = forwarded_proto == 'https' or request.url.scheme == 'https'

        if settings.enable_hsts and is_https:
            response.headers['Strict-Transport-Security'] = (
                f'max-age={settings.hsts_max_age_seconds}; includeSubDomains'
            )

        response.headers['X-Cloudlane-Encryption'] = 'transit-tls;at-rest-fernet'
        return response
