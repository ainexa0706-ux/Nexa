param(
  [string]$InstallDir = "",
  [string]$TorchIndexUrl = "https://download.pytorch.org/whl/cu121",
  [switch]$SkipPythonInstall,
  [switch]$CpuOnly,
  [string]$PythonVersion = "3.12"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
if (-not $InstallDir) {
  $InstallDir = Join-Path $root "engines"
}

$comfyDir = Join-Path $InstallDir "ComfyUI"
$workflowDir = Join-Path $InstallDir "workflows"
$customNodesDir = Join-Path $comfyDir "custom_nodes"
$managerDir = Join-Path $customNodesDir "ComfyUI-Manager"
$ltxDir = Join-Path $customNodesDir "ComfyUI-LTXVideo"
$venvPython = Join-Path $comfyDir "venv\Scripts\python.exe"

function Require-Command($name, $message) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw $message
  }
}

function Update-Or-Clone($url, $dir) {
  if (-not (Test-Path $dir)) {
    git clone $url $dir
  } else {
    git -C $dir pull --ff-only
  }
}

function Copy-FirstApiWorkflow($sourceRoot, $targetPath) {
  if (-not (Test-Path $sourceRoot)) { return $false }
  $candidates = Get-ChildItem -Path $sourceRoot -Recurse -Filter *.json -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match "t2v|text|video|ltx" } |
    Sort-Object FullName

  foreach ($candidate in $candidates) {
    try {
      $json = Get-Content -Raw -LiteralPath $candidate.FullName | ConvertFrom-Json
      if ($null -ne $json.nodes) { continue }
      Copy-Item -LiteralPath $candidate.FullName -Destination $targetPath -Force
      return $true
    } catch {
      continue
    }
  }
  return $false
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
New-Item -ItemType Directory -Force -Path $workflowDir | Out-Null

Require-Command git "Git is required to prepare the high quality video engine."
if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
  Require-Command python "Python 3.10-3.12 or uv is required to prepare ComfyUI."
}

Update-Or-Clone "https://github.com/comfyanonymous/ComfyUI.git" $comfyDir
New-Item -ItemType Directory -Force -Path $customNodesDir | Out-Null
Update-Or-Clone "https://github.com/ltdrdata/ComfyUI-Manager.git" $managerDir
Update-Or-Clone "https://github.com/Lightricks/ComfyUI-LTXVideo.git" $ltxDir

if (-not $SkipPythonInstall) {
  if (-not (Test-Path $venvPython)) {
    if (Get-Command uv -ErrorAction SilentlyContinue) {
      uv venv --python $PythonVersion (Join-Path $comfyDir "venv")
    } else {
      python -m venv (Join-Path $comfyDir "venv")
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
  Install-PackageSet -PackageArgs @("-r", (Join-Path $comfyDir "requirements.txt"))

  $ltxRequirements = Join-Path $ltxDir "requirements.txt"
  if (Test-Path $ltxRequirements) {
    Install-PackageSet -PackageArgs @("-r", $ltxRequirements)
  }
}

$workflowTarget = Join-Path $workflowDir "video-api.json"
$copiedWorkflow = Copy-FirstApiWorkflow (Join-Path $ltxDir "example_workflows") $workflowTarget
$blueprintReference = ""
if (-not $copiedWorkflow) {
  $blueprint = Get-ChildItem -Path (Join-Path $ltxDir "example_workflows") -Recurse -Filter "*T2V*.json" -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match "2\\.3|Single|Distilled" } |
    Sort-Object FullName |
    Select-Object -First 1
  if (-not $blueprint) {
    $blueprint = Get-ChildItem -Path (Join-Path $comfyDir "blueprints") -Filter "*Text to Video*LTX*.json" -ErrorAction SilentlyContinue |
      Sort-Object Name |
      Select-Object -First 1
  }
  if ($blueprint) {
    $blueprintReference = Join-Path $workflowDir "ltx-text-to-video-blueprint.json"
    Copy-Item -LiteralPath $blueprint.FullName -Destination $blueprintReference -Force
  }
}

$readme = @"
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
"@

Set-Content -Path (Join-Path $InstallDir "README-high-quality-video-engine.md") -Value $readme -Encoding UTF8

$status = [ordered]@{
  preparedAt = (Get-Date).ToString("o")
  comfyUi = $comfyDir
  manager = $managerDir
  ltxVideo = $ltxDir
  workflow = $(if (Test-Path $workflowTarget) { $workflowTarget } else { "" })
  blueprintReference = $blueprintReference
  copiedWorkflow = $copiedWorkflow
  python = $(if (Test-Path $venvPython) { $venvPython } else { "system" })
}
$status | ConvertTo-Json -Depth 4 | Set-Content -Path (Join-Path $InstallDir "high-quality-video-engine.json") -Encoding UTF8

Write-Host "High quality video engine prepared:"
Write-Host "  $InstallDir"
Write-Host "ComfyUI:"
Write-Host "  $comfyDir"
Write-Host "LTXVideo nodes:"
Write-Host "  $ltxDir"
if ($copiedWorkflow) {
  Write-Host "API workflow:"
  Write-Host "  $workflowTarget"
} else {
  Write-Host "No API workflow was auto-copied. Export an LTX API workflow to:"
  Write-Host "  $workflowTarget"
  if ($blueprintReference) {
    Write-Host "Reference blueprint copied:"
    Write-Host "  $blueprintReference"
  }
}
