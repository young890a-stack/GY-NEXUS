param(
  [string]$TargetPath = "",
  [string]$ZipPath = "$HOME\Downloads\GY-NEXUS-SHOPPING-SHORTS-INTERNAL-SEARCH-V2.2.zip",
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Step([string]$Text) {
  Write-Host "`n[GY-NEXUS] $Text" -ForegroundColor Cyan
}

function Copy-Tree([string]$Source, [string]$Destination) {
  New-Item -ItemType Directory -Path $Destination -Force | Out-Null
  & robocopy $Source $Destination /E /XJ /R:2 /W:1 /XD node_modules .next .git .vercel /XF .env .env.local .env.production /NFL /NDL /NJH /NJS /NP
  $code = $LASTEXITCODE
  if ($code -gt 7) {
    throw "File copy failed. Robocopy exit code: $code"
  }
}

if ([string]::IsNullOrWhiteSpace($TargetPath)) {
  $TargetPath = Read-Host "Paste the GY-NEXUS folder that contains package.json"
}

$target = [IO.Path]::GetFullPath($TargetPath.Trim('"'))
$homePath = [IO.Path]::GetFullPath($HOME)
if ($target -eq $homePath -or $target -eq [IO.Path]::GetPathRoot($target)) {
  throw "Unsafe TargetPath."
}
if (-not (Test-Path -LiteralPath (Join-Path $target "package.json"))) {
  throw "GY-NEXUS was not found. package.json is missing: $target"
}

if (-not (Test-Path -LiteralPath $ZipPath)) {
  $zip = Get-ChildItem -LiteralPath "$HOME\Downloads" -Filter "GY-NEXUS-SHOPPING-SHORTS-INTERNAL-SEARCH-V2.2*.zip" -File |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
  if ($null -eq $zip) { throw "The V2.2 ZIP was not found in Downloads." }
  $ZipPath = $zip.FullName
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path "$HOME\Documents" "GY-NEXUS-source-backup-v22-$stamp"
$temp = Join-Path ([IO.Path]::GetTempPath()) "gy-nexus-v22-$stamp"
$buildInfo = Join-Path $target "tsconfig.tsbuildinfo"
$backupBuildInfo = Join-Path $backup "tsconfig.tsbuildinfo"

try {
  Step "Opening the V2.2 ZIP"
  New-Item -ItemType Directory -Path $temp -Force | Out-Null
  Expand-Archive -LiteralPath $ZipPath -DestinationPath $temp -Force

  $source = $temp
  if (-not (Test-Path -LiteralPath (Join-Path $source "package.json"))) {
    $package = Get-ChildItem -LiteralPath $temp -Filter "package.json" -File -Recurse | Select-Object -First 1
    if ($null -eq $package) { throw "package.json was not found in the ZIP." }
    $source = $package.Directory.FullName
  }

  Step "Creating a source backup without moving the project folder"
  Copy-Tree $target $backup

  Step "Overlaying Shopping Shorts Internal Search V2.2"
  Copy-Tree $source $target

  if (-not $SkipBuild) {
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
      throw "Node.js and npm were not found."
    }
    Push-Location $target
    try {
      Step "Installing exact dependencies"
      npm ci
      if ($LASTEXITCODE -ne 0) { throw "npm ci failed." }

      Step "Running typecheck"
      npm run typecheck
      if ($LASTEXITCODE -ne 0) { throw "typecheck failed." }

      Step "Running production build"
      npm run build
      if ($LASTEXITCODE -ne 0) { throw "build failed." }
    }
    finally {
      Pop-Location
    }
  }

  Write-Host "`nINSTALLATION COMPLETED" -ForegroundColor Green
  Write-Host "Project: $target"
  Write-Host "Source backup: $backup"
  Write-Host "Open after deployment: /admin/shopping-shorts" -ForegroundColor Yellow
}
catch {
  Write-Host "`nINSTALLATION FAILED: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "The original project folder was not moved or deleted." -ForegroundColor Yellow
  if (Test-Path -LiteralPath (Join-Path $backup "package.json")) {
    Write-Host "Source backup: $backup" -ForegroundColor Yellow
  }
  throw
}
finally {
  if (Test-Path -LiteralPath $backupBuildInfo) {
    Copy-Item -LiteralPath $backupBuildInfo -Destination $buildInfo -Force
  }
  if (Test-Path -LiteralPath $temp) {
    Remove-Item -LiteralPath $temp -Recurse -Force
  }
}
