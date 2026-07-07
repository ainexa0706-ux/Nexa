param(
  [string]$InstallDir = "",
  [switch]$SkipPythonInstall
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
if (-not $InstallDir) {
  $InstallDir = Join-Path $root "engines"
}

$comfyDir = Join-Path $InstallDir "ComfyUI"
$workflowDir = Join-Path $InstallDir "workflows"

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
New-Item -ItemType Directory -Force -Path $workflowDir | Out-Null

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "Git is required to prepare the free video engine bundle."
}

if (-not (Test-Path $comfyDir)) {
  git clone https://github.com/comfyanonymous/ComfyUI.git $comfyDir
} else {
  git -C $comfyDir pull --ff-only
}

if (-not $SkipPythonInstall) {
  $venvPython = Join-Path $comfyDir "venv\Scripts\python.exe"
  if (-not (Test-Path $venvPython)) {
    python -m venv (Join-Path $comfyDir "venv")
  }
  & $venvPython -m pip install --upgrade pip
  & $venvPython -m pip install -r (Join-Path $comfyDir "requirements.txt")
}

$readme = @"
# Bundled Free Video Engine

This folder is used by Nexa when VIDEO_PROVIDER=free.

To ship real video generation without user setup, include:

1. ComfyUI in engines/ComfyUI
2. Required model files inside engines/ComfyUI/models
3. A ComfyUI API workflow at engines/workflows/video-api.json

Recommended free model families:
- LTX-Video for lighter local generation
- AnimateDiff workflows for lower VRAM machines
- Stable Video Diffusion for image-to-video
- Wan / HunyuanVideo only for stronger GPUs

The app auto-starts engines/ComfyUI/main.py and auto-loads engines/workflows/video-api.json.
"@

Set-Content -Path (Join-Path $InstallDir "README-free-video-engine.md") -Value $readme -Encoding UTF8

Write-Host "Free video engine scaffold prepared:"
Write-Host "  $InstallDir"
Write-Host ""
Write-Host "Next for packaging:"
Write-Host "  1. Put a working ComfyUI API workflow at engines/workflows/video-api.json"
Write-Host "  2. Put the required free video model files in engines/ComfyUI/models"
Write-Host "  3. Ship the engines folder with the app"
