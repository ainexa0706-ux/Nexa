import argparse
import json
import os
import sys
import time


LTX_ALLOW_PATTERNS = [
    "model_index.json",
    "scheduler/*",
    "text_encoder/*",
    "tokenizer/*",
    "transformer/*",
    "vae/*",
    "*.txt",
    "README.md",
]

LTX_IGNORE_PATTERNS = [
    "media/*",
    "*.gif",
    "*.mp4",
    "*.png",
    "ltxv-*.safetensors",
    "ltx-video-*.safetensors",
]


def fail(code, message, **extra):
    print(json.dumps({"ok": False, "code": code, "error": message, **extra}, ensure_ascii=False))
    return 1


def main():
    parser = argparse.ArgumentParser(description="Generate a local LTX-Video MP4 with Diffusers.")
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--negative-prompt", default="worst quality, inconsistent motion, blurry, jittery, distorted")
    parser.add_argument("--output", required=True)
    parser.add_argument("--model", default="Lightricks/LTX-Video")
    parser.add_argument("--width", type=int, default=768)
    parser.add_argument("--height", type=int, default=512)
    parser.add_argument("--frames", type=int, default=97)
    parser.add_argument("--fps", type=int, default=24)
    parser.add_argument("--steps", type=int, default=30)
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--local-files-only", action="store_true")
    parser.add_argument("--require-cuda", action="store_true")
    args = parser.parse_args()

    started = time.time()
    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)

    try:
        import torch
    except Exception as exc:
        return fail("torch_missing", f"PyTorch is not installed: {exc}")

    try:
        from diffusers import LTXPipeline
        from diffusers.utils import export_to_video
        from huggingface_hub import snapshot_download
    except Exception as exc:
        return fail("diffusers_ltx_missing", f"Diffusers LTX support is not installed: {exc}")

    cuda_available = bool(getattr(torch, "cuda", None) and torch.cuda.is_available())
    if args.require_cuda and not cuda_available:
        return fail("cuda_required_for_ltx", "LTX-Video is disabled because CUDA GPU acceleration was not detected.")

    device = "cuda" if cuda_available else "cpu"
    dtype = torch.bfloat16 if cuda_available else torch.float32
    if cuda_available:
        try:
            major, _minor = torch.cuda.get_device_capability()
            if major < 8:
                dtype = torch.float16
        except Exception:
            dtype = torch.float16

    try:
        model_source = snapshot_download(
            repo_id=args.model,
            allow_patterns=LTX_ALLOW_PATTERNS,
            ignore_patterns=LTX_IGNORE_PATTERNS,
            local_files_only=args.local_files_only,
        )
        pipe = LTXPipeline.from_pretrained(
            model_source,
            torch_dtype=dtype,
            local_files_only=True,
        )
    except Exception as exc:
        code = "ltx_diffusers_model_not_cached" if args.local_files_only else "ltx_diffusers_model_load_failed"
        return fail(code, str(exc), model=args.model)

    try:
        if hasattr(pipe, "vae") and hasattr(pipe.vae, "enable_tiling"):
            pipe.vae.enable_tiling()
        if cuda_available and hasattr(pipe, "enable_model_cpu_offload"):
            pipe.enable_model_cpu_offload()
        else:
            pipe.to(device)
    except Exception:
        pipe.to(device)

    generator_device = "cuda" if cuda_available else "cpu"
    generator = torch.Generator(device=generator_device).manual_seed(int(args.seed))

    call_kwargs = {
        "prompt": args.prompt,
        "negative_prompt": args.negative_prompt,
        "width": int(args.width),
        "height": int(args.height),
        "num_frames": int(args.frames),
        "num_inference_steps": int(args.steps),
        "generator": generator,
        "output_type": "pil",
    }
    # LTX 0.9.1+ uses timestep-aware decoding; older pipelines ignore unsupported args poorly.
    try:
        result = pipe(
            **call_kwargs,
            decode_timestep=0.05,
            decode_noise_scale=0.025,
        )
    except TypeError:
        result = pipe(**call_kwargs)

    frames = result.frames[0]
    export_to_video(frames, args.output, fps=int(args.fps))
    size = os.path.getsize(args.output)
    print(json.dumps({
        "ok": True,
        "output": args.output,
        "size": size,
        "model": args.model,
        "device": device,
        "dtype": str(dtype).replace("torch.", ""),
        "width": args.width,
        "height": args.height,
        "frames": args.frames,
        "fps": args.fps,
        "steps": args.steps,
        "elapsedSec": round(time.time() - started, 2),
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
