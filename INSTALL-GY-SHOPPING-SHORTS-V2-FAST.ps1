param(
  [string]$TargetPath = "$HOME\Documents\GitHub\GY-NEXUS",
  [string]$ZipPath = "$HOME\Downloads\GY-NEXUS-SHOPPING-SHORTS-CENTER-V2-FAST.zip",
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Step([string]$Message) {
  Write-Host "`n[GY-NEXUS] $Message" -ForegroundColor Cyan
}

$targetFull = [System.IO.Path]::GetFullPath($TargetPath)
$homeFull = [System.IO.Path]::GetFullPath($HOME)
if ($targetFull -eq $homeFull -or $targetFull -eq [System.IO.Path]::GetPathRoot($targetFull)) {
  throw "안전을 위해 홈 폴더나 드라이브 루트는 설치 경로로 사용할 수 없습니다."
}

if (-not (Test-Path -LiteralPath $ZipPath)) {
  $candidate = Get-ChildItem -LiteralPath "$HOME\Downloads" -Filter "GY-NEXUS-SHOPPING-SHORTS-CENTER-V2-FAST*.zip" -File |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
  if (-not $candidate) { throw "다운로드 폴더에서 V2 FAST ZIP을 찾지 못했습니다: $ZipPath" }
  $ZipPath = $candidate.FullName
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = "$targetFull-backup-$stamp"
$extractPath = Join-Path ([System.IO.Path]::GetTempPath()) "gy-nexus-v2-$stamp"

Write-Step "설치 파일 확인: $ZipPath"
New-Item -ItemType Directory -Path $extractPath -Force | Out-Null
Expand-Archive -LiteralPath $ZipPath -DestinationPath $extractPath -Force

$sourcePath = $extractPath
if (-not (Test-Path -LiteralPath (Join-Path $sourcePath "package.json"))) {
  $package = Get-ChildItem -LiteralPath $extractPath -Filter "package.json" -File -Recurse | Select-Object -First 1
  if (-not $package) { throw "ZIP 안에서 package.json을 찾지 못했습니다." }
  $sourcePath = $package.Directory.FullName
}

$preserveNames = @(".env", ".env.local", ".env.production", ".vercel", ".git")
if (Test-Path -LiteralPath $targetFull) {
  Write-Step "현재 사이트 안전 백업: $backupPath"
  Move-Item -LiteralPath $targetFull -Destination $backupPath
}

try {
  Write-Step "V2 FAST 전체 파일 설치"
  New-Item -ItemType Directory -Path $targetFull -Force | Out-Null
  Get-ChildItem -LiteralPath $sourcePath -Force | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $targetFull -Recurse -Force
  }

  if (Test-Path -LiteralPath $backupPath) {
    Write-Step "기존 환경변수·Vercel·Git 연결 복원"
    foreach ($name in $preserveNames) {
      $saved = Join-Path $backupPath $name
      if (Test-Path -LiteralPath $saved) {
        $destination = Join-Path $targetFull $name
        if (Test-Path -LiteralPath $destination) { Remove-Item -LiteralPath $destination -Recurse -Force }
        Copy-Item -LiteralPath $saved -Destination $destination -Recurse -Force
      }
    }
  }

  if (-not $SkipBuild) {
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw "Node.js/npm을 찾지 못했습니다." }
    Push-Location $targetFull
    try {
      Write-Step "패키지 설치"
      npm ci
      if ($LASTEXITCODE -ne 0) { throw "npm ci 실패" }
      Write-Step "타입 검사"
      npm run typecheck
      if ($LASTEXITCODE -ne 0) { throw "타입 검사 실패" }
      Write-Step "프로덕션 빌드"
      npm run build
      if ($LASTEXITCODE -ne 0) { throw "프로덕션 빌드 실패" }
    }
    finally {
      Pop-Location
    }
  }

  Write-Host "`n설치와 검증이 완료됐습니다." -ForegroundColor Green
  Write-Host "프로젝트: $targetFull"
  if (Test-Path -LiteralPath $backupPath) { Write-Host "백업: $backupPath" }
  Write-Host "`n다음 명령으로 배포하세요:" -ForegroundColor Yellow
  Write-Host "cd `"$targetFull`""
  Write-Host "git status"
  Write-Host "git add ."
  Write-Host "git commit -m `"Add Shopping Shorts Center V2 Fast`""
  Write-Host "git push"
  Write-Host "`n배포 후 확인: https://gy-nexus-zfpq.vercel.app/admin/shopping-shorts" -ForegroundColor Green
}
catch {
  Write-Host "`n설치 중 오류가 발생했습니다: $($_.Exception.Message)" -ForegroundColor Red
  if (Test-Path -LiteralPath $backupPath) {
    if (Test-Path -LiteralPath $targetFull) { Remove-Item -LiteralPath $targetFull -Recurse -Force }
    Move-Item -LiteralPath $backupPath -Destination $targetFull
    Write-Host "기존 사이트를 원래 위치로 복구했습니다." -ForegroundColor Yellow
  }
  throw
}
finally {
  if (Test-Path -LiteralPath $extractPath) { Remove-Item -LiteralPath $extractPath -Recurse -Force }
}
