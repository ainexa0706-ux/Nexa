# Nexa 1.0.13 Release Notes

Release type: public-prep SaaS/API foundation build

## Highlights

- Added email/password login with HTTP-only session cookies.
- Added account page at `/auth`.
- Added API key creation with server-side SHA-256 key hashing.
- Added OpenAI-compatible model API:
  - `GET /v1/models`
  - `POST /v1/chat/completions`
- Added admin panel at `/admin`.
- Added admin APIs for users, API keys, usage, and billing events.
- Added Stripe Checkout subscription foundation.
- Added Stripe webhook endpoint with signature verification.
- Added simple login rate limiting.
- Added Origin checks for cookie-authenticated write APIs.
- Kept existing local chat, project, workspace, installer, and LP routes intact.

## Installer

Expected installer:

```text
dist/Nexa-Setup-1.0.13.exe
```

Approximate size:

```text
111 MB
```

SHA256 checksum file:

```text
dist/Nexa-Setup-1.0.13.exe.sha256
```

## Account And Admin

Account page:

```text
http://localhost:8787/auth
```

Admin panel:

```text
http://localhost:8787/admin
```

The first registered user becomes an admin automatically.

## Model API Example

```powershell
curl http://localhost:8787/v1/chat/completions ^
  -H "Authorization: Bearer nxa_your_key" ^
  -H "Content-Type: application/json" ^
  -d "{\"model\":\"nexa-2.5\",\"messages\":[{\"role\":\"user\",\"content\":\"Hello\"}]}"
```

## Stripe Setup

```powershell
setx STRIPE_SECRET_KEY "<stripe-secret-key>"
setx STRIPE_PRICE_ID "<stripe-price-id>"
setx STRIPE_WEBHOOK_SECRET "<stripe-webhook-secret>"
```

Webhook endpoint:

```text
https://your-domain.example/api/billing/webhook
```

## Verification Commands

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
npm run dist:win
```

## Known Limits

- This is a production foundation, not a complete hosted SaaS deployment.
- API quota is local JSON based and should be moved to a real database before large public use.
- Stripe Customer Portal is not implemented yet.
- Streaming `/v1/chat/completions` is not implemented yet.
- Do not embed private provider keys in a public installer.
