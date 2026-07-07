# Bundled Free Video Engine

This folder is copied into the Windows desktop app as an extra resource.

For real local video generation, place a portable ComfyUI setup here:

- `engines/ComfyUI/main.py`
- required ComfyUI custom nodes
- model files
- an optional workflow at `engines/workflows/video-api.json`

The Electron app starts the local server with:

- `VIDEO_PROVIDER=free`
- `COMFYUI_AUTO_START=true`
- `ENGINES_DIR=<app resources>/engines`

If ComfyUI is not bundled, the app still runs and shows the video engine as not configured.
