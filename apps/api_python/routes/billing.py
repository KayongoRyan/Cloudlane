from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status

import database as db
from auth import AuthContext, authenticate_request, client_ip, require_scopes
from services.billing import billing_service
from services.irembopay import irembopay_client

router = APIRouter()

COMPUTE_RATE_PER_SECOND = 0.00012


def _apply_irembopay_status(invoice_id: str, tenant_id: str, payment_status: str, extra: dict | None = None) -> dict | None:
    status_upper = (payment_status or '').upper()
    updates: dict = {'irembopayPaymentStatus': status_upper}
    if extra:
        updates.update(extra)
    if status_upper == 'PAID':
        updates['status'] = 'paid'
        updates.setdefault('paidAt', datetime.now(timezone.utc))
    elif status_upper in ('NEW', 'PENDING'):
        updates['status'] = 'pending'
    return db.update_invoice(invoice_id, tenant_id, updates)


@router.get('/usage')
async def get_usage(auth: AuthContext = Depends(authenticate_request)):
    require_scopes(auth, 'read')
    compute_seconds = db.sum_usage_for_tenant(auth.tenant_id, 'compute_seconds')
    estimated = round(compute_seconds * COMPUTE_RATE_PER_SECOND, 4)
    return {
        'usage': {
            'computeSeconds': compute_seconds,
            'estimatedCost': estimated,
            'currency': 'RWF',
        }
    }


@router.get('/invoices')
async def list_invoices(auth: AuthContext = Depends(authenticate_request)):
    require_scopes(auth, 'read')
    return {'invoices': db.list_invoices(auth.tenant_id)}


@router.post('/invoices', status_code=status.HTTP_201_CREATED)
async def create_invoice(
    request: Request,
    auth: AuthContext = Depends(authenticate_request),
):
    require_scopes(auth, 'deploy')
    period_end = datetime.now(timezone.utc)
    period_start = period_end - timedelta(days=30)
    compute_seconds = db.sum_usage_for_tenant(auth.tenant_id, 'compute_seconds')
    total = round(compute_seconds * COMPUTE_RATE_PER_SECOND, 2)

    invoice = db.create_invoice({
        'tenantId': auth.tenant_id,
        'periodStart': period_start,
        'periodEnd': period_end,
        'totalAmount': total,
        'currency': 'RWF',
        'status': 'pending' if total > 0 else 'paid',
        'breakdown': {'computeCost': total, 'requestCost': 0, 'memoryCost': 0},
    })

    payment = billing_service.initiate_payment(
        invoice['id'],
        total,
        auth.tenant_id,
        currency=invoice['currency'],
        description=f'Cloudlane compute usage {period_start.date()} – {period_end.date()}',
    )

    if payment.get('invoiceNumber') or payment.get('transactionId'):
        updates = {
            'irembopayTransactionId': payment.get('transactionId'),
            'irembopayInvoiceNumber': payment.get('invoiceNumber'),
            'irembopayPaymentLinkUrl': payment.get('paymentLinkUrl'),
            'irembopayPaymentStatus': payment.get('paymentStatus') or 'NEW',
        }
        if payment.get('status') == 'paid':
            updates['status'] = 'paid'
            updates['paidAt'] = datetime.now(timezone.utc)
        elif payment.get('status') == 'initiated':
            updates['status'] = 'pending'
        elif payment.get('status') == 'failed':
            updates['status'] = 'failed'
        updated = db.update_invoice(invoice['id'], auth.tenant_id, updates)
        if updated:
            invoice = updated

    db.write_audit_log({
        'tenantId': auth.tenant_id,
        'userId': auth.user_id,
        'action': 'invoice.create',
        'resourceType': 'invoice',
        'resourceId': invoice['id'],
        'changes': {
            'totalAmount': total,
            'paymentStatus': payment.get('status'),
            'irembopayInvoiceNumber': payment.get('invoiceNumber'),
        },
        'ipAddress': client_ip(request),
    })
    return {'invoice': invoice, 'payment': payment}


@router.post('/invoices/{invoice_id}/sync')
async def sync_invoice_payment(
    invoice_id: str,
    auth: AuthContext = Depends(authenticate_request),
):
    require_scopes(auth, 'read')
    invoice = db.find_invoice_by_id(invoice_id, auth.tenant_id)
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Invoice not found')

    reference = invoice.get('irembopayInvoiceNumber') or invoice.get('irembopayTransactionId')
    if not reference:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invoice has no IremboPay reference')

    sync = billing_service.sync_payment_status(reference)
    updated = _apply_irembopay_status(
        invoice_id,
        auth.tenant_id,
        sync.get('paymentStatus', 'UNKNOWN'),
        {
            'irembopayPaymentLinkUrl': sync.get('paymentLinkUrl') or invoice.get('irembopayPaymentLinkUrl'),
            'irembopayInvoiceNumber': sync.get('invoiceNumber') or invoice.get('irembopayInvoiceNumber'),
        },
    )
    return {'invoice': updated or invoice, 'sync': sync}


@router.post('/irembopay/webhook', status_code=status.HTTP_200_OK)
async def irembopay_webhook(request: Request):
    raw = await request.body()
    signature = request.headers.get('irembopay-signature', '')
    if not irembopay_client.verify_webhook_signature(raw, signature):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid IremboPay signature')

    import json
    try:
        payload = json.loads(raw.decode('utf-8'))
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid JSON') from exc

    data = payload.get('data') or {}
    reference = data.get('invoiceNumber') or data.get('transactionId')
    if not reference:
        return {'ok': True, 'message': 'ignored — no invoice reference'}

    invoice = db.find_invoice_by_irembopay_reference(reference)
    if not invoice:
        return {'ok': True, 'message': 'invoice not found in Cloudlane'}

    payment_status = (data.get('paymentStatus') or 'PAID').upper()
    _apply_irembopay_status(
        invoice['id'],
        invoice['tenantId'],
        payment_status,
        {
            'irembopayInvoiceNumber': data.get('invoiceNumber') or invoice.get('irembopayInvoiceNumber'),
            'irembopayTransactionId': data.get('transactionId') or invoice.get('irembopayTransactionId'),
            'irembopayPaymentLinkUrl': invoice.get('irembopayPaymentLinkUrl'),
        },
    )
    db.write_audit_log({
        'tenantId': invoice['tenantId'],
        'userId': None,
        'action': 'invoice.irembopay.webhook',
        'resourceType': 'invoice',
        'resourceId': invoice['id'],
        'changes': {'paymentStatus': payment_status, 'reference': reference},
    })
    return {'ok': True}
