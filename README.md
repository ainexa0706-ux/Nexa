# Nexa

Nexaは、完全オリジナルのAIワークスペースアプリとして企画・設計・実装した自作プロジェクトです。

Nexa is a local-first AI workspace that combines a ChatGPT-style conversation UI with a Codex-style development UI.

It can run with local Ollama models, optionally route to an OpenAI-compatible cloud API, and fall back to local models when cloud routing is unavailable.

## Download

Windows installers are generated locally and served by the running Nexa server.
Installer binaries are not committed to GitHub because they are large build artifacts.

```text
dist/Nexa-Setup-<version>.exe
```

When the local server is running, the installer can also be downloaded from:

```text
http://localhost:8787/download/installer
```

The landing page is available at:

```text
http://localhost:8787/lp.html
```

## Start Locally

```powershell
cd C:\Users\senaa\OneDrive\デスクトップ\AI\agent-company
npm install
npm start
```

Open:

```text
http://localhost:8787
```

## Build The Windows Installer

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
npm run dist:win
```

The installer is generated in `dist/`.

## Features

- ChatGPT-style new chat screen with mode selection
- Codex-style code workspace with project folder selection
- Project-based history and memory
- Multi-agent workflow with Astra, Sage, Mira, Forge, Proof, and Vela
- Local model routing through Ollama
- Optional OpenAI-compatible cloud routing
- Cloud-to-local fallback
- Choice gate for short, ambiguous, or risky requests
- Email/password login with HTTP-only sessions
- Admin panel for users, billing events, and usage
- Stripe Checkout billing foundation with webhook signature verification
- Workspace file reading, direct file writing, diff review, and checks
- File attachments and selected-folder context
- Image generation preview
- Video generation is intentionally disabled in this public build. Nexa offers image generation or storyboard alternatives instead of pretending to generate video.

## Recommended Local Models

For a lightweight setup:

```powershell
ollama pull qwen2.5:3b
ollama pull qwen3:4b
```

For better local quality on a 16 GB RAM PC:

```powershell
ollama pull qwen3:8b
ollama pull qwen2.5-coder:7b
```

## Optional Cloud API

Nexa reads OpenAI-compatible environment variables:

```powershell
setx OPENAI_BASE_URL "https://api.openai.com/v1"
setx OPENAI_API_KEY "your-api-key"
setx OPENAI_CHAT_MODEL "gpt-4o-mini"
setx OPENAI_CODE_MODEL "gpt-4o-mini"
setx OPENAI_AUTO_ROUTE "true"
```

For Groq or OpenRouter, set `OPENAI_BASE_URL` to their OpenAI-compatible endpoint and use the model name they provide.

Do not embed a private API key into a public app build. For public distribution, use a small backend proxy with rate limits or ask users to provide their own key.

## Login And Billing

Account page:

```text
http://localhost:8787/auth
```

Admin panel:

```text
http://localhost:8787/admin
```

The first registered account becomes an admin automatically.

This public build does not expose Nexa API key issuance in the UI. Billing is handled separately through Stripe Checkout. Set these variables on the server to enable paid plans:

```powershell
setx STRIPE_SECRET_KEY "<stripe-secret-key>"
setx STRIPE_PLUS_PRICE_ID "<stripe-plus-price-id>"
setx STRIPE_PRO_PRICE_ID "<stripe-pro-price-id>"
setx STRIPE_STUDIO_PRICE_ID "<stripe-studio-price-id>"
setx STRIPE_WEBHOOK_SECRET "<stripe-webhook-secret>"
```

For production, also set `APP_PUBLIC_URL`, `STRIPE_SUCCESS_URL`, and `STRIPE_CANCEL_URL` to your HTTPS domain.

## Main Files

- `server.mjs`: local API, model routing, memory, agents, workspace tools
- `public/index.html`: application shell
- `public/app.js`: streaming chat and UI state
- `public/styles.css`: main app styling
- `public/lp.html`: public landing page
- `electron/main.cjs`: desktop app launcher
- `docs/`: release, installer, and deployment notes
- `mcp.servers.json`: MCP server registry
- `plugins/core-tools.json`: built-in plugin manifest

## Release Status

Current public-prep version: see `package.json`.

Current honest intelligence estimate:

- Model brain: Qwen 3B to 4B class by default
- System workflow: Lv7.1, because Nexa adds memory, multi-agent routing, code workspace actions, self-evaluation, and choice cards
- ChatGPT-level model quality requires a stronger local model or cloud API routing
