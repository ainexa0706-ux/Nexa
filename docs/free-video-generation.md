# Free Video Generation Setup

This app can use free local video models through LTX Diffusers or ComfyUI.

## Recommended Provider

Use `VIDEO_PROVIDER=free`.

The app tries direct LTX Diffusers first when a local model cache is present. Then it tries ComfyUI. If neither model-grade route is configured or running, it falls back to the built-in Kino renderer.

Prepare direct LTX support:

```powershell
npm run video:prepare-ltx
```

Optionally cache the model:

```powershell
npm run video:download-ltx
```

## Good Free Model Families

- Wan Video / Wan2.x
- HunyuanVideo
- LTX-Video
- Stable Video Diffusion
- AnimateDiff workflows

ComfyUI is the easiest bridge because the app can submit an API workflow to `/prompt` and read results from `/history/{prompt_id}`.

## Environment Variables

```env
VIDEO_PROVIDER=free
LTX_DIFFUSERS_ENABLED=true
LTX_DIFFUSERS_MODEL=Lightricks/LTX-Video
LTX_DIFFUSERS_AUTO_DOWNLOAD=false
LTX_DIFFUSERS_REQUIRE_CUDA=true
COMFYUI_URL=http://127.0.0.1:8188
COMFYUI_VIDEO_WORKFLOW=C:/path/to/video-workflow-api.json
COMFYUI_PROMPT_NODE=
COMFYUI_NEGATIVE_PROMPT_NODE=
COMFYUI_SEED_NODE=
COMFYUI_OUTPUT_NODE=
```

`COMFYUI_VIDEO_WORKFLOW` must be an API workflow export, not the normal visual editor workflow export.

If automatic prompt-node detection does not patch the right node, set:

- `COMFYUI_PROMPT_NODE`: node id for the positive prompt
- `COMFYUI_NEGATIVE_PROMPT_NODE`: node id for the negative prompt
- `COMFYUI_SEED_NODE`: node id with a numeric seed input
- `COMFYUI_OUTPUT_NODE`: preferred output node id

## Workflow Output

The app supports these generated media formats:

- `.mp4`
- `.webm`
- `.gif`
- `.png`
- `.webp`
- `.jpg`

MP4 and WebM are shown with a video player inside the chat.

## Fallback Behavior

If ComfyUI is not running, the workflow is missing, or no output is found, the app creates a local animated preview and tells you the reason in the assistant message.
