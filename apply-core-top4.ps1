$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Get-Location

if (-not (Test-Path (Join-Path $projectRoot "package.json"))) {
    Write-Host ""
    Write-Host "오류: GY-NEXUS 프로젝트 폴더에서 실행해야 합니다." -ForegroundColor Red
    Read-Host "엔터를 누르면 종료합니다"
    exit 1
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = Join-Path $projectRoot ".gy-backups\core-top4-$stamp"

$files = @(
    "components\admin\AdminSidebar.tsx",
    "components\admin\AdminMobileDock.tsx"
)

Write-Host ""
Write-Host "핵심 4개 메뉴를 최상단에 배치합니다." -ForegroundColor Cyan
Write-Host "기존 나머지 메뉴는 삭제하지 않고 아래쪽에 보존합니다." -ForegroundColor Yellow

foreach ($relative in $files) {
    $target = Join-Path $projectRoot $relative
    $source = Join-Path $scriptDir ("PATCH\" + $relative)
    $backup = Join-Path $backupRoot $relative

    if (-not (Test-Path $source)) {
        throw "패치 파일을 찾을 수 없습니다: $source"
    }

    if (Test-Path $target) {
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $backup) | Out-Null
        Copy-Item $target $backup -Force
    }

    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
    Copy-Item $source $target -Force
    Write-Host "적용: $relative" -ForegroundColor Green
}

Write-Host ""
Write-Host "원본 백업: $backupRoot" -ForegroundColor Yellow
Write-Host "빌드를 확인합니다..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "빌드 실패. 백업 원본은 보존되어 있습니다." -ForegroundColor Red
    Read-Host "엔터를 누르면 종료합니다"
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "완료되었습니다." -ForegroundColor Green
Write-Host "GitHub Desktop에서 Commit 후 Push하세요." -ForegroundColor Cyan
Write-Host "추천 커밋: Put core creator tools at the top of admin navigation" -ForegroundColor White
Read-Host "엔터를 누르면 종료합니다"
