"""IremboPay API client — create invoice, fetch status, verify webhooks."""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from typing import Any

from config import get_settings

logger = logging.getLogger(__name__)


class IremboPayError(Exception):
    def __init__(self, message: str, *, status: int | None = None, errors: list | None = None):
        super().__init__(message)
        self.status = status
        self.errors = errors or []


class IremboPayClient:
    def is_configured(self) -> bool:
        settings = get_settings()
        return bool(
            settings.irembopay_api_key
            and settings.irembopay_payment_account_identifier
            and settings.irembopay_product_code
        )

    def _headers(self) -> dict[str, str]:
        settings = get_settings()
        return {
            'Content-Type': 'application/json',
            'irembopay-secretkey': settings.irembopay_api_key,
            'X-API-Version': settings.irembopay_api_version,
        }

    def _request(self, method: str, path: str, body: dict | None = None) -> dict[str, Any]:
        settings = get_settings()
        url = f'{settings.irembopay_api_url.rstrip("/")}{path}'
        data = json.dumps(body).encode('utf-8') if body is not None else None
        req = urllib.request.Request(url, data=data, headers=self._headers(), method=method)
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                payload = json.loads(resp.read().decode('utf-8'))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode('utf-8', errors='replace')
            try:
                payload = json.loads(detail)
            except json.JSONDecodeError:
                raise IremboPayError(detail or str(exc), status=exc.code) from exc
            message = payload.get('message') or detail or str(exc)
            raise IremboPayError(message, status=exc.code, errors=payload.get('errors')) from exc
        except urllib.error.URLError as exc:
            raise IremboPayError(f'IremboPay unreachable: {exc.reason}') from exc

        if not payload.get('success', True) and payload.get('errors'):
            raise IremboPayError(
                payload.get('message') or 'IremboPay request failed',
                errors=payload.get('errors'),
            )
        return payload.get('data') or payload

    def create_invoice(
        self,
        *,
        transaction_id: str,
        amount: float,
        currency: str,
        description: str | None = None,
        customer: dict[str, str] | None = None,
        expiry_days: int = 7,
    ) -> dict[str, Any]:
        settings = get_settings()
        expiry = datetime.now(timezone.utc) + timedelta(days=expiry_days)
        expiry_at = expiry.strftime('%Y-%m-%dT%H:%M:%S.000+00:00')
        body: dict[str, Any] = {
            'transactionId': transaction_id,
            'paymentAccountIdentifier': settings.irembopay_payment_account_identifier,
            'paymentItems': [
                {
                    'code': settings.irembopay_product_code,
                    'quantity': 1,
                    'unitAmount': round(float(amount), 2),
                },
            ],
            'expiryAt': expiry_at,
            'description': description or 'Cloudlane usage invoice',
            'language': settings.irembopay_language,
        }
        if customer:
            body['customer'] = customer
        return self._request('POST', '/payments/invoices', body)

    def get_invoice(self, invoice_reference: str) -> dict[str, Any]:
        return self._request('GET', f'/payments/invoices/{invoice_reference}')

    def verify_webhook_signature(self, raw_body: bytes, signature_header: str) -> bool:
        settings = get_settings()
        if not settings.irembopay_api_key or not signature_header:
            return False
        timestamp = None
        signature_hash = None
        for element in signature_header.split(','):
            element = element.strip()
            if '=' not in element:
                continue
            prefix, value = element.split('=', 1)
            if prefix == 't':
                timestamp = value
            elif prefix == 's':
                signature_hash = value
        if not timestamp or not signature_hash:
            return False

        signed_payload = f'{timestamp}#{raw_body.decode("utf-8")}'
        expected = hmac.new(
            settings.irembopay_api_key.encode(),
            signed_payload.encode(),
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(expected, signature_hash):
            return False

        try:
            ts_ms = int(timestamp)
            now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
            if abs(now_ms - ts_ms) > 300_000:
                return False
        except ValueError:
            return False
        return True


irembopay_client = IremboPayClient()
