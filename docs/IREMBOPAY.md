# IremboPay (Cloudlane billing)

Production charges use the [IremboPay Invoice API](https://irembopay.gitbook.io/irembopay-api-docs/apis/invoice/openapi.md).

## Flow

1. Tenant clicks **Generate invoice** → Cloudlane creates Mongo invoice + IremboPay invoice via `POST /payments/invoices`
2. Response includes `paymentLinkUrl` — tenant pays on IremboPay checkout
3. IremboPay sends webhook to `POST /api/billing/irembopay/webhook` (configure callback URL in merchant portal)
4. Optional: `POST /api/billing/invoices/{id}/sync` polls IremboPay status

## Env (API)

| Variable | Required | Description |
|---|---|---|
| `IREMBOPAY_API_KEY` | Yes | Merchant secret key (`irembopay-secretkey` header) |
| `IREMBOPAY_API_URL` | Yes | `https://api.irembopay.com` or sandbox URL |
| `IREMBOPAY_PAYMENT_ACCOUNT_IDENTIFIER` | Yes | Payment account from portal (e.g. `TST-RWF`) |
| `IREMBOPAY_PRODUCT_CODE` | Yes | Product code for `paymentItems[].code` |
| `IREMBOPAY_PUBLIC_KEY` | No | For future inline JS widget |
| `IREMBOPAY_API_VERSION` | No | Default `2` |

Migratable via ops vault: `IREMBOPAY_API_KEY`

## Webhook

Set callback URL in IremboPay portal to:

```
https://<your-api-host>/api/billing/irembopay/webhook
```

Verifies `irembopay-signature` header (HMAC-SHA256).

## Sandbox

Use sandbox URL and test keys from IremboPay signup. Without keys, invoices stay **sandbox** (Mongo only, no payment link).
