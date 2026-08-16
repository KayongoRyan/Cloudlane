from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status

import database as db
from auth import AuthContext, authenticate_request, client_ip, require_scopes
from services.billing import billing_service

router = APIRouter()

COMPUTE_RATE_PER_SECOND = 0.00012


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
        'status': 'pending',
        'breakdown': {'computeCost': total, 'requestCost': 0, 'memoryCost': 0},
    })

    payment = billing_service.initiate_payment(invoice['id'], total, auth.tenant_id)
    if payment.get('transactionId'):
        updated = db.update_invoice(invoice['id'], auth.tenant_id, {
            'irembopayTransactionId': payment['transactionId'],
            'status': 'paid',
        })
        if updated:
            invoice = updated

    db.write_audit_log({
        'tenantId': auth.tenant_id,
        'userId': auth.user_id,
        'action': 'invoice.create',
        'resourceType': 'invoice',
        'resourceId': invoice['id'],
        'ipAddress': client_ip(request),
    })
    return {'invoice': invoice, 'payment': payment}
