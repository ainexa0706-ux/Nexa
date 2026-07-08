# Publishing Checklist

Use this checklist before sharing Nexa publicly.

## Required

- [ ] Run `npm install`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run test`.
- [ ] Run `npm run build`.
- [ ] Run `npm run dist:win`.
- [ ] Confirm `dist/Nexa-Setup-<version>.exe` exists.
- [ ] Confirm `/download/installer` returns the same installer.
- [ ] Confirm `/lp.html` opens and has no mojibake.
- [ ] Confirm the public LP opens at `https://ainexa0706-ux.github.io/Nexa/`.
- [ ] Confirm the app starts at `http://localhost:8787`.
- [ ] Confirm `/billing` shows plan credits and current credit balance.
- [ ] Confirm `/admin` can update a user's bonus credits and used credits.
- [ ] Confirm short prompts show Choice gate options when ambiguous.
- [ ] Confirm dangerous prompts show safety choices.
- [ ] Confirm code mode asks for a PC folder before direct writes.
- [ ] Confirm no private API keys are committed or bundled.
- [ ] Confirm `README.md` and release notes describe video generation honestly.

## Recommended Manual Smoke Test

1. Open the app.
2. Create a new chat.
3. Select Chat mode and send `それ`.
4. Confirm a selectable Choice gate appears.
5. Send `全部削除して`.
6. Confirm a safety confirmation card appears.
7. Create a Code mode chat.
8. Confirm folder selection is required before direct file writes.
9. Open `/lp.html`.
10. Download `/download/installer`.

## Public Distribution Notes

- Do not embed `OPENAI_API_KEY` or any paid provider key in the installer.
- If users should get cloud AI without setup, place a backend proxy between Nexa and the provider.
- Add rate limits, abuse protection, and usage logging to that proxy.
- Keep local Ollama fallback enabled for offline use.
- Tell users that Ollama model downloads require additional disk space.
- Credit costs in this public build are chat = 1, image = 3, video endpoint = 10.
