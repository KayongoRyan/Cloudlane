from __future__ import annotations

import uuid

from config import get_settings
from services.irembopay import IremboPayError, irembopay_client


class BillingService:
    def initiate_payment(
        self,
        invoice_id: str,
        amount: float,
        tenant_id: str,
        *,
        currency: str = 'RWF',
        description: str | None = None,
        customer: dict[str, str] | None = None,
    ) -> dict:
        settings = get_settings()

        if amount <= 0:
            return {
                'status': 'skipped',
                'message': 'Invoice amount is zero — no payment required',
                'transactionId': None,
                'paymentLinkUrl': None,
            }

        if not settings.irembopay_api_key:
            return {
                'status': 'sandbox',
                'message': 'IremboPay not configured — invoice recorded only (set IREMBOPAY_API_KEY)',
                'transactionId': None,
                'paymentLinkUrl': None,
            }

        if not irembopay_client.is_configured():
            return {
                'status': 'sandbox',
                'message': (
                    'IremboPay partially configured — set IREMBOPAY_PAYMENT_ACCOUNT_IDENTIFIER '
                    'and IREMBOPAY_PRODUCT_CODE from the merchant portal'
                ),
                'transactionId': None,
                'paymentLinkUrl': None,
            }

        transaction_id = f'cl-{invoice_id}-{uuid.uuid4().hex[:8]}'
        try:
            data = irembopay_client.create_invoice(
                transaction_id=transaction_id,
                amount=amount,
                currency=currency,
                description=description,
                customer=customer,
            )
        except IremboPayError as exc:
            return {
                'status': 'failed',
                'message': str(exc),
                'transactionId': None,
                'paymentLinkUrl': None,
                'errors': exc.errors,
            }

        payment_status = (data.get('paymentStatus') or 'NEW').upper()
        return {
            'status': 'initiated' if payment_status != 'PAID' else 'paid',
            'message': 'IremboPay invoice created',
            'transactionId': data.get('transactionId') or transaction_id,
            'invoiceNumber': data.get('invoiceNumber'),
            'paymentLinkUrl': data.get('paymentLinkUrl'),
            'paymentStatus': payment_status,
            'amount': data.get('amount', amount),
            'invoiceId': invoice_id,
            'tenantId': tenant_id,
        }

    def sync_payment_status(self, invoice_reference: str) -> dict:
        if not irembopay_client.is_configured():
            return {'paymentStatus': 'UNKNOWN', 'message': 'IremboPay not configured'}
        try:
            data = irembopay_client.get_invoice(invoice_reference)
        except IremboPayError as exc:
            return {'paymentStatus': 'ERROR', 'message': str(exc)}
        return {
            'paymentStatus': (data.get('paymentStatus') or 'NEW').upper(),
            'invoiceNumber': data.get('invoiceNumber'),
            'paymentLinkUrl': data.get('paymentLinkUrl'),
            'paymentReference': data.get('paymentReference'),
            'paidAt': data.get('paidAt'),
        }


billing_service = BillingService()
