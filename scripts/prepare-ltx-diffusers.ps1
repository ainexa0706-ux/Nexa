param(
  [string]$InstallDir = "",
  [string]$PythonVersion = "3.12",
  [string]$ModelId = "Lightricks/LTX-Video",
  [string]$CacheDir = "",
  [switch]$DownloadModel,
  [switch]$CpuOnly,
  [string]$TorchIndexUrl = "https://download.pytorch.org/whl/cu121"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
if (-not $InstallDir) {
  $InstallDir = Join-Path $root "engines"
}
if (-not $CacheDir) {
  $CacheDir = Join-Path $InstallDir "hf-cache"
}

$comfyDir = Join-Path $InstallDir "ComfyUI"
$venvDir = Join-Path $comfyDir "venv"
$venvPython = Join-Path $venvDir "Scripts\python.exe"

function Require-Command($name, $message) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw $message
  }
}

function Install-PackageSet {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$PackageArgs
  )
  if (Get-Command uv -ErrorAction SilentlyContinue) {
    uv pip install --python $venvPython @PackageArgs
  } else {
    & $venvPython -m pip install @PackageArgs
  }
  if ($LASTEXITCODE -ne 0) {
    throw "Python package install failed: $($PackageArgs -join ' ')"
  }
}

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
New-Item -ItemType Directory -Force -Path $CacheDir | Out-Null
New-Item -ItemType Directory -Force -Path $comfyDir | Out-Null

if (-not (Test-Path $venvPython)) {
  if (Get-Command uv -ErrorAction SilentlyContinue) {
    uv venv --python $PythonVersion $venvDir
  } else {
    Require-Command python "Python or uv is required to prepare LTX Diffusers."
    python -m venv $venvDir
  }
}

if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
  & $venvPython -m ensurepip --upgrade
  & $venvPython -m pip install --upgrade pip wheel setuptools
} else {
  Install-PackageSet -PackageArgs @("wheel", "setuptools")
}

if ($CpuOnly) {
  Install-PackageSet -PackageArgs @("torch", "torchvision", "torchaudio")
} else {
  Install-PackageSet -PackageArgs @("torch", "torchvision", "torchaudio", "--index-url", $TorchIndexUrl)
}

Install-PackageSet -PackageArgs @(
  "diffusers>=0.35.0",
  "transformers",
  "accelerate",
  "safetensors",
  "sentencepiece",
  "protobuf",
  "imageio",
  "imageio-ffmpeg",
  "huggingface_hub[hf_xet]"
)

if ($DownloadModel) {
  $env:HF_HOME = $CacheDir
  $env:LTX_MODEL_ID = $ModelId
  $downloadScript = @'
from huggingface_hub import snapshot_download
import os

snapshot_download(
    repo_id=os.environ["LTX_MODEL_ID"],
    allow_patterns=[
        "model_index.json",
        "scheduler/*",
        "text_encoder/*",
        "tokenizer/*",
        "transformer/*",
        "vae/*",
        "*.txt",
        "README.md",
    ],
    ignore_patterns=[
        "media/*",
        "*.gif",
        "*.mp4",
        "*.png",
        "ltxv-*.safetensors",
        "ltx-video-*.safetensors",
    ],
    local_files_only=False,
)
'@
  $downloadPy = Join-Path $InstallDir "download-ltx-model.py"
  Set-Content -LiteralPath $downloadPy -Value $downloadScript -Encoding UTF8
  & $venvPython $downloadPy
  Remove-Item -LiteralPath $downloadPy -Force -ErrorAction SilentlyContinue
  if ($LASTEXITCODE -ne 0) {
    throw "Model download failed: $ModelId"
  }
}

$status = [ordered]@{
  preparedAt = (Get-Date).ToString("o")
  python = $venvPython
  cacheDir = $CacheDir
  model = $ModelId
  downloaded = [bool]$DownloadModel
  verified = $false
}
$status | ConvertTo-Json -Depth 4 | Set-Content -Path (Join-Path $InstallDir "ltx-diffusers-engine.json") -Encoding UTF8

Write-Host "LTX Diffusers runtime prepared:"
Write-Host "  Python: $venvPython"
Write-Host "  Cache:  $CacheDir"
Write-Host "  Model:  $ModelId"
if (-not $DownloadModel) {
  Write-Host "Model was not downloaded. Run again with -DownloadModel to cache it locally."
}
