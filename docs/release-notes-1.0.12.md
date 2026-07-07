# Nexa 1.0.12 Release Notes

Release type: public-prep Windows build

## Highlights

- Renamed and prepared the app as Nexa for public distribution.
- Added a readable Japanese landing page at `/lp.html`.
- Added a Windows installer download route at `/download/installer`.
- Added login, API key, admin, billing, and OpenAI-compatible model API foundations.
- Added OpenAI-compatible cloud model routing with local Ollama fallback.
- Added Choice gate behavior for short, ambiguous, or risky prompts.
- Improved honest capability reporting:
  - Default local model level is Qwen 3B to 4B class.
  - Nexa workflow score is Lv7.1.
  - ChatGPT-level model quality requires stronger local models or cloud API routing.
- Kept video generation disabled in the public build to avoid low-quality or fake video claims.
- Preserved image generation and storyboard alternatives.

## Installer

Expected installer:

```text
dist/Nexa-Setup-1.0.12.exe
```

Approximate size:

```text
111 MB
```

SHA256 checksum file:

```text
dist/Nexa-Setup-1.0.12.exe.sha256
```

## Recommended Local Models

Lightweight:

```powershell
ollama pull qwen2.5:3b
ollama pull qwen3:4b
```

Better local quality:

```powershell
ollama pull qwen3:8b
ollama pull qwen2.5-coder:7b
```

## Optional Cloud API

Nexa can connect to OpenAI-compatible APIs:

```powershell
setx OPENAI_BASE_URL "https://api.openai.com/v1"
setx OPENAI_API_KEY "your-api-key"
setx OPENAI_CHAT_MODEL "gpt-4o-mini"
setx OPENAI_CODE_MODEL "gpt-4o-mini"
setx OPENAI_AUTO_ROUTE "true"
```

Groq and OpenRouter can also be used by changing `OPENAI_BASE_URL` and model names.

## Verification Commands

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
npm run dist:win
```

## Known Limits

- Local model quality depends on the user's installed Ollama models.
- The app does not include Ollama model weights.
- The public build does not provide real video generation.
- A private cloud API key must not be embedded in the installer.
- For a setting-free public cloud experience, use a backend proxy with rate limits.
