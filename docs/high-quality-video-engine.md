# High Quality Video Engine

The built-in Kino renderer is useful because it works immediately after install, but it is not a diffusion video model.

For substantially better video quality, Nexa supports two model-grade local paths:

1. LTX-Video through Diffusers, used directly by the app when the model is cached locally.
2. LTX-Video or Wan through ComfyUI, used when a valid API workflow and model files are present.

## Recommended Path

Use LTX-Video through Diffusers for the simplest local model path:

```powershell
npm run video:prepare-ltx
```

That installs the Python dependencies. To cache the model locally, run:

```powershell
npm run video:download-ltx
```

The default model is `Lightricks/LTX-Video`. It is several GB and needs a CUDA GPU for practical generation. By default the app does not start a huge model download during chat; set `LTX_DIFFUSERS_AUTO_DOWNLOAD=true` only if first-run downloading is acceptable.

Use LTX-Video through ComfyUI when you want workflow control:

- ComfyUI runs locally.
- ComfyUI-LTXVideo provides LTX video nodes and workflows.
- Nexa sends the prompt to ComfyUI and saves the generated MP4/WebM/GIF for in-app preview.

Prepare it with:

```powershell
npm run video:prepare-hq
```

Then make sure a ComfyUI API workflow exists at:

```text
engines/workflows/video-api.json
```

When the LTX Diffusers model is cached, the app tries it first. If it is not available, the app tries ComfyUI. If neither model-grade route is available, it falls back to Kino and records the reason in the artifact metadata.

## Why This Is Needed

No-setup Kino can generate a real local WebM, but it is procedural. It cannot produce Sora-style realistic motion.

Model-grade video requires one of these:

- bundled local models
- first-run model download
- a hosted video provider

The local free route is an open video model such as LTX-Video or Wan. The app can run LTX directly through Diffusers or route a ComfyUI API workflow.

## Notes

- Strong GPUs are recommended for model-grade video.
- LTX Diffusers requires cached Hugging Face model files unless `LTX_DIFFUSERS_AUTO_DOWNLOAD=true`.
- LTXVideo/ComfyUI also needs required model files under ComfyUI `models` folders.
- Wan workflows require placing model files under the ComfyUI `models` folders.
- Installer size will grow significantly if model files are bundled.
