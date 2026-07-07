# High Quality Video Engine

This folder contains the optional model-grade video engine for Nexa.

Installed components:
- ComfyUI
- ComfyUI-Manager
- ComfyUI-LTXVideo

If engines/workflows/video-api.json exists, Nexa will try ComfyUI before falling back to Kino.

If no API workflow was copied automatically, open ComfyUI, load the reference blueprint if present, then export it as an API workflow to:

engines/workflows/video-api.json

Notes:
- LTXVideo/ComfyUI may download required model files on first use.
- Wan workflows need their model files under ComfyUI/models as documented by ComfyUI.
- Strong GPUs are recommended for model-grade video.
