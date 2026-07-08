# Nexa 1.2.4 Release Notes

## Highlights

- Added monthly credits for public distribution.
- Added credit balances to the in-app account modal.
- Added credit totals to the billing page.
- Added owner-only credit controls to Nexa Admin.
- Updated the public landing page with credit and pricing details.

## Credit Rules

- Chat: 1 credit
- Image generation: 3 credits
- Video generation endpoint: 10 credits

## Monthly Credits

- Free: 100 credits
- Plus: 1,200 credits
- Pro: 5,000 credits
- Studio: 12,000 credits

## Admin

Nexa Admin can now manage:

- User plan
- BAN status
- Bonus credits
- Used credits

## Verification

Run before publishing:

```powershell
npm install
npm run lint
npm run typecheck
npm run test
npm run build
npm run dist:win
```

Expected installer:

```text
dist/Nexa-Setup-1.2.4.exe
```
