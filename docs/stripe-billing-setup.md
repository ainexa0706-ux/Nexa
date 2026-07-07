# Nexa Stripe Billing Setup

Nexa billing is ready for Stripe Checkout. You only need to create Stripe products/prices and paste keys into `.env` or `%APPDATA%\Nexa\.env`.

## 1. Create Stripe prices

Create recurring monthly prices in Stripe:

- Nexa Plus: JPY 980 / month
- Nexa Pro: JPY 1,980 / month
- Nexa Studio: JPY 4,980 / month

Copy each `price_...` ID.

## 2. Set environment variables

```env
STRIPE_SECRET_KEY=sk_live_or_test_...
STRIPE_PLUS_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_STUDIO_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_SUCCESS_URL=http://localhost:8787/billing?status=success
STRIPE_CANCEL_URL=http://localhost:8787/billing?status=cancel
```

`STRIPE_PRICE_ID` is still accepted as a legacy alias for `STRIPE_PRO_PRICE_ID`.

## 3. Configure webhook

Webhook endpoint:

```text
http://localhost:8787/api/billing/webhook
```

For production, replace it with your public HTTPS domain:

```text
https://your-domain.example/api/billing/webhook
```

Recommended events:

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

## 4. Verify

Start Nexa and open:

```text
http://localhost:8787/billing
```

Paid plan buttons should become clickable for every plan that has both `STRIPE_SECRET_KEY` and a matching `STRIPE_*_PRICE_ID`.
