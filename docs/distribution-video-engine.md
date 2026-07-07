# Distribution Plan For Built-In Free Video Generation

The app can be distributed with built-in free video generation so end users do not configure anything manually.

There are three layers:

1. Built-in Kino renderer: always available in the packaged app, creates real `.webm` videos from prompt-aware rendered frames.
2. Optional LTX Diffusers bundle: higher quality local LTX-Video generation when Python dependencies and cached Hugging Face model files are bundled.
3. Optional ComfyUI bundle: higher quality workflow-based generation when `engines/ComfyUI`, models, and a workflow are bundled.

For the direct LTX path, prepare dependencies with:

```powershell
npm run video:prepare-ltx
```

To pre-cache the model for a no-setup installer:

```powershell
npm run video:download-ltx
```

For the ComfyUI/LTX path, prepare the engine with:

```powershell
npm run video:prepare-hq
```

## Distribution Layout

Ship this structure:

```text
agent-company/
  server.mjs
  public/
  engines/
    ComfyUI/
      main.py
      requirements.txt
      models/
        ...
    hf-cache/
      hub/
        models--Lightricks--LTX-Video/
    workflows/
      video-api.json
```

The app auto-detects:

- `engines/hf-cache` with an LTX Diffusers snapshot
- `engines/ComfyUI`
- `engines/workflows/video-api.json`

When video generation is requested, the app first tries direct LTX Diffusers generation. If that is unavailable, it tries to start the bundled ComfyUI server on `127.0.0.1:8188`. If that is unavailable, it falls back to the built-in Kino renderer and still returns a playable `.webm` video.

## Environment Defaults

No user configuration is required when the layout above exists.

Defaults:

```env
VIDEO_PROVIDER=free
LTX_DIFFUSERS_ENABLED=true
LTX_DIFFUSERS_MODEL=Lightricks/LTX-Video
LTX_DIFFUSERS_AUTO_DOWNLOAD=false
LTX_DIFFUSERS_REQUIRE_CUDA=true
COMFYUI_AUTO_START=true
COMFYUI_URL=http://127.0.0.1:8188
ENGINES_DIR=./engines
COMFYUI_DIR=./engines/ComfyUI
KINO_DEFAULT_DURATION_SEC=8
KINO_FPS=12
KINO_CRF=31
```

## Preparing The Engine Bundle

Run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/prepare-free-video-engine.ps1
```

Then add:

- cached LTX Diffusers model files under `engines/hf-cache`, or
- a working API workflow as `engines/workflows/video-api.json`
- required ComfyUI model files under `engines/ComfyUI/models`

## Recommended User Experience

The packaged app should show three states:

- Ready: built-in Kino renderer is available
- Enhanced: LTX Diffusers model, or bundled workflow and models, are present
- Installing: first-run model download or engine preparation
- Fallback: HTML preview is used only if WebM encoding fails

## Important Reality Check

The built-in Kino renderer is not a diffusion model, but it is a real local video export path and works immediately after install. It now includes prompt direction for subject, action, camera, weather accents, and shot flow before rendering frames.

Free diffusion video models are large. A no-setup diffusion app is possible only by doing one of these:

- ship the model files inside the installer
- download the model files automatically on first launch
- provide a cloud-hosted free provider you control

The current server supports the first option directly, has an immediate built-in `.webm` renderer, and can support the second option through an installer/downloader UI.
