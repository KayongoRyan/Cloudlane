import uuid

from config import get_settings


class BillingService:
    def initiate_payment(self, invoice_id: str, amount: float, tenant_id: str) -> dict:
        settings = get_settings()
        if not settings.irembopay_api_key:
            return {
                'status': 'sandbox',
                'message': 'IremboPay not configured — invoice recorded only',
                'transactionId': None,
            }
        return {
            'status': 'initiated',
            'transactionId': f'irembo_{uuid.uuid4().hex[:12]}',
            'amount': amount,
            'invoiceId': invoice_id,
            'tenantId': tenant_id,
        }


billing_service = BillingService()
