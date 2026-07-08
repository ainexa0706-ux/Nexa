# Windows Installer

Nexa can be packaged as a Windows desktop app with Electron and an NSIS installer.

## Build

```powershell
npm install
npm run lint
npm run typecheck
npm run test
npm run build
npm run dist:win
```

The installer is written to:

```text
dist/Nexa-Setup-<version>.exe
```

## Download Endpoint

When the local Nexa server is running, the latest installer is served at:

```text
http://localhost:8787/download/installer
```

The endpoint returns the installer matching `package.json` when it exists.

## App Behavior

The desktop app starts a local Nexa server and opens the UI in an Electron window.

Runtime data is stored in the app user-data folder. The installed program directory is not used as the user's workspace.

## Local AI Models

The installer does not bundle Ollama model weights. Users who want local AI should install Ollama and pull models.

Lightweight setup:

```powershell
ollama pull qwen2.5:3b
ollama pull qwen3:4b
```

Better local quality on a 16 GB RAM PC:

```powershell
ollama pull qwen3:8b
ollama pull qwen2.5-coder:7b
```

## Optional Cloud API

Nexa supports OpenAI-compatible cloud routing through environment variables.

```powershell
setx OPENAI_BASE_URL "https://api.openai.com/v1"
setx OPENAI_API_KEY "your-api-key"
setx OPENAI_CHAT_MODEL "gpt-4o-mini"
setx OPENAI_CODE_MODEL "gpt-4o-mini"
setx OPENAI_AUTO_ROUTE "true"
```

Do not publish a build with a private API key embedded in it.

## Media Notice

Image generation is available in the app UI.

Video generation is intentionally disabled in this public build. When users ask for video, Nexa should offer image generation or storyboard alternatives instead of claiming that a video was generated.

## Credits

The public billing build includes monthly credits:

- Free: 100
- Plus: 1,200
- Pro: 5,000
- Studio: 12,000

Chat consumes 1 credit, image generation consumes 3 credits, and the video generation endpoint consumes 10 credits. Nexa Admin can adjust bonus and used credits per user.
