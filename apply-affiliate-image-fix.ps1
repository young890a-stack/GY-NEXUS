$ErrorActionPreference = "Stop"

function Find-RepoRoot {
  $scriptRoot = $PSScriptRoot
  $candidates = @(
    (Get-Location).Path,
    $scriptRoot,
    (Split-Path -Parent $scriptRoot)
  ) | Select-Object -Unique

  foreach ($candidate in $candidates) {
    if ((Test-Path (Join-Path $candidate "package.json")) -and
        (Test-Path (Join-Path $candidate "app")) -and
        (Test-Path (Join-Path $candidate "components"))) {
      return (Resolve-Path $candidate).Path
    }
  }
  throw "GY-NEXUS 프로젝트 루트를 찾지 못했습니다. 이 폴더를 GY-NEXUS 폴더 안에 넣고 다시 실행해주세요."
}

function Read-Utf8Normalized([string]$Path) {
  return ([IO.File]::ReadAllText($Path) -replace "`r`n", "`n")
}

function Write-Utf8NoBom([string]$Path, [string]$Content) {
  [IO.File]::WriteAllText($Path, $Content, [Text.UTF8Encoding]::new($false))
}

function Replace-Required([string]$Text, [string]$Old, [string]$New, [string]$Label) {
  if (-not $Text.Contains($Old)) {
    throw "수정 위치를 찾지 못했습니다: $Label. 파일 버전이 달라졌을 수 있습니다."
  }
  return $Text.Replace($Old, $New)
}

$repoRoot = Find-RepoRoot
$scriptRoot = $PSScriptRoot
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = Join-Path $repoRoot ".gy-backup-affiliate-image-$timestamp"

$routePath = Join-Path $repoRoot "app/api/revenue-shorts/product-import/route.ts"
$componentPath = Join-Path $repoRoot "components/revenue-shorts/RevenueShortsCommandCenter.tsx"
$cssPath = Join-Path $repoRoot "components/revenue-shorts/RevenueShortsCommandCenter.module.css"
$payloadRoute = Join-Path $scriptRoot "payload/app/api/revenue-shorts/product-import/route.ts"

foreach ($path in @($routePath, $componentPath, $cssPath, $payloadRoute)) {
  if (-not (Test-Path $path)) { throw "필수 파일을 찾지 못했습니다: $path" }
}

New-Item -ItemType Directory -Path (Join-Path $backupRoot "app/api/revenue-shorts/product-import") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $backupRoot "components/revenue-shorts") -Force | Out-Null
Copy-Item $routePath (Join-Path $backupRoot "app/api/revenue-shorts/product-import/route.ts")
Copy-Item $componentPath (Join-Path $backupRoot "components/revenue-shorts/RevenueShortsCommandCenter.tsx")
Copy-Item $cssPath (Join-Path $backupRoot "components/revenue-shorts/RevenueShortsCommandCenter.module.css")

Copy-Item $payloadRoute $routePath -Force

$component = Read-Utf8Normalized $componentPath

$oldType = @'
type ImportedProduct = {
  name: string;
  description: string;
  imageUrl: string;
  priceText: string;
  platform: string;
  finalUrl: string;
  source: "database" | "page-metadata" | "link-only";
  warning?: string;
};
'@
$newType = @'
type ImportedProduct = {
  name: string;
  description: string;
  imageUrl: string;
  originalImageUrl?: string;
  imageStored?: boolean;
  imageSource?: "storage" | "remote" | "none";
  priceText: string;
  discountText?: string;
  platform: string;
  finalUrl: string;
  resolvedUrl?: string;
  source: "database" | "page-metadata" | "link-only";
  warning?: string;
};
'@
$component = Replace-Required $component $oldType $newType "ImportedProduct 타입"

$oldState = @'
  const [productImageUrl, setProductImageUrl] = useState("");
  const [priceText, setPriceText] = useState("");
'@
$newState = @'
  const [productImageUrl, setProductImageUrl] = useState("");
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const [priceText, setPriceText] = useState("");
'@
$component = Replace-Required $component $oldState $newState "상품 이미지 상태"

$oldImportSetters = @'
      if (product.imageUrl) setProductImageUrl(product.imageUrl);
      if (product.priceText) setPriceText(product.priceText);
'@
$newImportSetters = @'
      if (product.imageUrl) {
        setProductImageUrl(product.imageUrl);
        setImageLoadFailed(false);
      }
      if (product.priceText) {
        setPriceText(product.discountText ? `${product.priceText} · ${product.discountText} 할인` : product.priceText);
      }
'@
$component = Replace-Required $component $oldImportSetters $newImportSetters "자동 불러오기 결과 반영"

$oldStatus = @'
      setStatus(product.warning || `상품 정보를 불러왔습니다. 중국 검색어 ${keyword}도 준비했습니다.`);
'@
$newStatus = @'
      const imageStatus = product.imageStored
        ? "대표 이미지도 GY 저장소에 복사했습니다."
        : product.imageUrl
          ? "대표 이미지는 외부 주소로 확인했습니다. 화면에서 깨지면 직접 업로드해주세요."
          : "대표 이미지를 찾지 못했습니다. 직접 업로드 또는 AI 이미지 생성으로 보완해주세요.";
      setStatus(product.warning || `상품 정보를 불러왔습니다. ${imageStatus} 중국 검색어 ${keyword}도 준비했습니다.`);
'@
$component = Replace-Required $component $oldStatus $newStatus "상품 불러오기 상태 문구"

$uploadFunction = @'

  async function uploadProductImage(file: File | undefined) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("상품 이미지는 JPG, PNG, WEBP 형식만 사용할 수 있습니다.");
      return;
    }
    if (file.size < 1 || file.size > 8 * 1024 * 1024) {
      setError("상품 이미지는 8MB 이하여야 합니다.");
      return;
    }
    setBusy("product-image-upload");
    setError("");
    setStatus("상품 이미지를 GY 저장소에 업로드하고 있습니다.");
    try {
      const form = new FormData();
      form.append("images", file);
      const response = await fetch("/api/creative-studio-pro/references", { method: "POST", body: form });
      const data = await response.json() as { success?: boolean; urls?: string[]; message?: string };
      if (!response.ok || !data.success || !data.urls?.[0]) throw new Error(data.message || "상품 이미지 업로드 실패");
      setProductImageUrl(data.urls[0]);
      setImageLoadFailed(false);
      setStatus("상품 이미지를 GY 저장소에 안전하게 저장했습니다.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "상품 이미지 업로드 실패");
    } finally {
      setBusy("");
    }
  }
'@
$prepareMarker = @'

  async function prepareChineseSearch() {
'@
$component = Replace-Required $component $prepareMarker ($uploadFunction + $prepareMarker) "상품 이미지 업로드 함수"

$oldProductGrid = @'
        <div className={styles.productGrid}>
          <div className={styles.productPreview}>
            {productImageUrl ? <img src={productImageUrl} alt={productName || "상품 이미지"} /> : <div><strong>상품 이미지</strong><span>제휴링크에서 자동 수집</span></div>}
          </div>
          <div className={styles.productFields}>
            <label><span>상품명</span><input value={productName} onChange={(event: ChangeEvent<HTMLInputElement>) => setProductName(event.target.value)} placeholder="상품명" /></label>
            <label><span>가격</span><input value={priceText} onChange={(event: ChangeEvent<HTMLInputElement>) => setPriceText(event.target.value)} placeholder="자동 확인 또는 직접 입력" /></label>
            <label className={styles.wide}><span>상품 설명·판매 포인트</span><textarea value={productDescription} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setProductDescription(event.target.value)} placeholder="상품 설명과 실제 장점" /></label>
            <label><span>판매 플랫폼</span><input value={platform} onChange={(event: ChangeEvent<HTMLInputElement>) => setPlatform(event.target.value)} placeholder="coupang / temu / naver" /></label>
            <label><span>중국어 검색어</span><input value={chineseKeyword} onChange={(event: ChangeEvent<HTMLInputElement>) => setChineseKeyword(event.target.value)} placeholder="예: 手持小风扇" /></label>
          </div>
        </div>
'@
$newProductGrid = @'
        <div className={styles.productGrid}>
          <div className={styles.productPreview}>
            <div className={styles.productPreviewMedia}>
              {productImageUrl && !imageLoadFailed
                ? <img src={productImageUrl} alt={productName || "상품 이미지"} onError={() => { setImageLoadFailed(true); setStatus("외부 상품 이미지 표시가 차단됐습니다. 아래 직접 업로드를 사용해주세요."); }} />
                : <div><strong>상품 이미지</strong><span>{productImageUrl ? "외부 이미지 표시 실패" : "제휴링크에서 자동 수집"}</span></div>}
            </div>
            <div className={styles.imageFallbackActions}>
              <label className={styles.imageUploadButton}>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event: ChangeEvent<HTMLInputElement>) => void uploadProductImage(event.target.files?.[0])} />
                <span>{busy === "product-image-upload" ? "이미지 저장 중..." : "상품 이미지 직접 업로드"}</span>
              </label>
              <a href="/admin/creative-studio-pro" target="_blank" rel="noreferrer">AI 상품 이미지 만들기</a>
            </div>
          </div>
          <div className={styles.productFields}>
            <label><span>상품명</span><input value={productName} onChange={(event: ChangeEvent<HTMLInputElement>) => setProductName(event.target.value)} placeholder="상품명" /></label>
            <label><span>가격·할인</span><input value={priceText} onChange={(event: ChangeEvent<HTMLInputElement>) => setPriceText(event.target.value)} placeholder="자동 확인 또는 직접 입력" /></label>
            <label className={styles.wide}><span>상품 설명·판매 포인트</span><textarea value={productDescription} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setProductDescription(event.target.value)} placeholder="상품 설명과 실제 장점" /></label>
            <label className={styles.wide}><span>상품 이미지 주소</span><input value={productImageUrl} onChange={(event: ChangeEvent<HTMLInputElement>) => { setProductImageUrl(event.target.value); setImageLoadFailed(false); }} placeholder="자동 저장된 Supabase 이미지 주소 또는 직접 입력" /></label>
            <label><span>판매 플랫폼</span><input value={platform} onChange={(event: ChangeEvent<HTMLInputElement>) => setPlatform(event.target.value)} placeholder="coupang / temu / naver" /></label>
            <label><span>중국어 검색어</span><input value={chineseKeyword} onChange={(event: ChangeEvent<HTMLInputElement>) => setChineseKeyword(event.target.value)} placeholder="예: 手持小风扇" /></label>
          </div>
        </div>
'@
$component = Replace-Required $component $oldProductGrid $newProductGrid "상품 이미지 미리보기와 대체 동작"
Write-Utf8NoBom $componentPath $component

$css = Read-Utf8Normalized $cssPath
$oldCss = @'
.productPreview {
  display: grid;
  min-height: 270px;
  place-items: center;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 18px;
  background: #090e1b;
}
.productPreview img { width: 100%; height: 100%; object-fit: contain; }
.productPreview > div { display: grid; gap: 7px; color: #67748d; text-align: center; }
.productPreview strong { color: #d5deed; }
'@
$newCss = @'
.productPreview {
  display: grid;
  min-height: 270px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 18px;
  background: #090e1b;
}
.productPreviewMedia {
  display: grid;
  min-height: 214px;
  place-items: center;
  overflow: hidden;
}
.productPreviewMedia img { width: 100%; height: 100%; max-height: 260px; object-fit: contain; }
.productPreviewMedia > div { display: grid; gap: 7px; padding: 24px; color: #67748d; text-align: center; }
.productPreview strong { color: #d5deed; }
.imageFallbackActions { display: grid; grid-template-columns: 1fr; gap: 7px; padding: 10px; border-top: 1px solid rgba(255,255,255,.07); }
.imageUploadButton input { display: none; }
.imageUploadButton span,
.imageFallbackActions a {
  display: flex;
  min-height: 39px;
  align-items: center;
  justify-content: center;
  padding: 0 10px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 900;
  text-decoration: none;
  cursor: pointer;
}
.imageUploadButton span { color: #06131a; background: linear-gradient(135deg,#70e7bd,#76c9ff); }
.imageFallbackActions a { color: #e4ebf7; border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.04); }
'@
$css = Replace-Required $css $oldCss $newCss "상품 이미지 CSS"
Write-Utf8NoBom $cssPath $css

Write-Host ""
Write-Host "✅ GY-NEXUS 제휴링크 상품 이미지 수정이 완료됐습니다." -ForegroundColor Green
Write-Host "백업 폴더: $backupRoot"
Write-Host ""
Write-Host "다음 명령어를 프로젝트 터미널에서 실행하세요:" -ForegroundColor Cyan
Write-Host "npm run typecheck"
Write-Host "npm run build"
Write-Host "git add app/api/revenue-shorts/product-import/route.ts components/revenue-shorts/RevenueShortsCommandCenter.tsx components/revenue-shorts/RevenueShortsCommandCenter.module.css"
Write-Host 'git commit -m "Fix affiliate product image import"'
Write-Host "git push"
