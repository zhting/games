param(
  [ValidateSet('all', 'capture', 'audio', 'render', 'preview')]
  [string]$Task = 'all'
)

$ErrorActionPreference = 'Stop'
$project = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$runtime = 'C:\Users\zhting\.codex\runtimes\jelly-tetris-ad'

function Reset-RuntimeDirectory([string]$Name) {
  $target = Join-Path $runtime $Name
  $runtimeFull = [System.IO.Path]::GetFullPath($runtime)
  $targetFull = [System.IO.Path]::GetFullPath($target)
  if (-not $targetFull.StartsWith($runtimeFull, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to reset path outside runtime: $targetFull"
  }
  if (Test-Path -LiteralPath $targetFull) {
    Remove-Item -LiteralPath $targetFull -Recurse -Force
  }
  New-Item -ItemType Directory -Path $targetFull -Force | Out-Null
}

New-Item -ItemType Directory -Path $runtime -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $project 'package.json') -Destination (Join-Path $runtime 'package.json') -Force

if (-not (Test-Path -LiteralPath (Join-Path $runtime 'node_modules\remotion'))) {
  Push-Location $runtime
  try { npm install } finally { Pop-Location }
}

Reset-RuntimeDirectory 'scripts'
Reset-RuntimeDirectory 'src'
Copy-Item -Path (Join-Path $project 'scripts\*') -Destination (Join-Path $runtime 'scripts') -Recurse -Force
Copy-Item -Path (Join-Path $project 'src\*') -Destination (Join-Path $runtime 'src') -Recurse -Force

Reset-RuntimeDirectory 'site'
New-Item -ItemType Directory -Path (Join-Path $runtime 'site\games') -Force | Out-Null
Copy-Item -Path (Join-Path $project '..\games\game') -Destination (Join-Path $runtime 'site\games\game') -Recurse -Force
Copy-Item -Path (Join-Path $project '..\games\game') -Destination (Join-Path $runtime 'site\game') -Recurse -Force

if (Test-Path -LiteralPath (Join-Path $project 'public')) {
  Reset-RuntimeDirectory 'public'
  Copy-Item -Path (Join-Path $project 'public\*') -Destination (Join-Path $runtime 'public') -Recurse -Force
} else {
  Reset-RuntimeDirectory 'public'
}
New-Item -ItemType Directory -Path (Join-Path $runtime 'output') -Force | Out-Null

$playwright = Join-Path $runtime 'node_modules\.bin\playwright.cmd'
$remotion = Join-Path $runtime 'node_modules\.bin\remotion.cmd'

function Invoke-Capture {
  & $playwright install ffmpeg
  if ($LASTEXITCODE -ne 0) { throw "Playwright FFmpeg installation failed: $LASTEXITCODE" }
  Push-Location $runtime
  try {
    $env:JELLY_SITE_ROOT = Join-Path $runtime 'site'
    node scripts/capture.mjs
  } finally {
    Remove-Item Env:JELLY_SITE_ROOT -ErrorAction SilentlyContinue
    Pop-Location
  }
  if ($LASTEXITCODE -ne 0) { throw "Gameplay capture failed: $LASTEXITCODE" }
  New-Item -ItemType Directory -Path (Join-Path $project 'public\capture') -Force | Out-Null
  Copy-Item -Path (Join-Path $runtime 'public\capture\*') -Destination (Join-Path $project 'public\capture') -Recurse -Force
}

function Invoke-Audio {
  Push-Location $runtime
  try {
    node scripts/generate-audio.mjs
    if ($LASTEXITCODE -ne 0) { throw "BGM generation failed: $LASTEXITCODE" }
    python scripts/generate-tts.py
    if ($LASTEXITCODE -ne 0) { throw "TTS generation failed: $LASTEXITCODE" }
  } finally { Pop-Location }
  New-Item -ItemType Directory -Path (Join-Path $project 'public\audio') -Force | Out-Null
  Copy-Item -Path (Join-Path $runtime 'public\audio\*') -Destination (Join-Path $project 'public\audio') -Recurse -Force
}

function Invoke-Render {
  Push-Location $runtime
  try {
    & $remotion render src/index.jsx JellyTetrisAd output/jelly-tetris-ad.mp4 --codec=h264 --crf=18 --audio-codec=aac
  } finally { Pop-Location }
  if ($LASTEXITCODE -ne 0) { throw "Remotion render failed: $LASTEXITCODE" }
  New-Item -ItemType Directory -Path (Join-Path $project 'output') -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $runtime 'output\jelly-tetris-ad.mp4') -Destination (Join-Path $project 'output\jelly-tetris-ad.mp4') -Force
}

switch ($Task) {
  'capture' { Invoke-Capture }
  'audio' { Invoke-Audio }
  'render' { Invoke-Render }
  'preview' {
    Push-Location $runtime
    try { & $remotion studio src/index.jsx } finally { Pop-Location }
  }
  'all' {
    Invoke-Capture
    Invoke-Audio
    Invoke-Render
  }
}
