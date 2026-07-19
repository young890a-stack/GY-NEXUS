"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";

type Project = {
  id: string;
  title: string;
  product_name: string;
  product_description?: string;
  source_image_url?: string | null;
  duration_seconds: number;
  ratio: string;
  style: string;
  status: string;
  render_approved?: boolean;
  quality_threshold?: number;
  final_video_url?: string | null;
  settings?: {
    sourceMode?: "single-photo-commerce" | "premium-multi-photo";
    referenceImageUrls?: string[];
    affiliateUrl?: string;
    subtitleStyle?: string;
    thumbnailStyle?: string;
    sfxMode?: string;
    commercePackage?: CommercePackage;
    voiceAudioUrl?: string;
    voiceName?: string;
    voicePreset?: string;
    gyProductCode?: string;
    mediaReferences?: MediaReference[];
    trendIntelligence?: TrendIntelligence;
    sourceMixPlan?: SourceMixPlan;
    playbackSpeed?: 1 | 1.2 | 1.4;
    subtitleCleanupMode?: "recreate-clean" | "safe-bottom-crop" | "keep-licensed";
    sourceAudioMode?: "mute-korean-tts" | "mute";
    selectedHookIndex?: number;
    selectedHook?: string;
    contentApprovedAt?: string;
    contentApprovalChecklist?: Record<string, boolean>;
    visualProfile?: {
      identitySummary?: string;
      referenceCoverageScore?: number;
      referenceGaps?: string[];
      forbiddenChanges?: string[];
    };
  } | null;
  created_at: string;
};

type SavedProduct = {
  id: string;
  title: string;
  description?: string | null;
  image_url?: string | null;
  affiliate_url?: string | null;
  platform?: string | null;
  price_text?: string | null;
};

type CommercePackage = {
  productCode: string;
  title: string;
  hookOptions: string[];
  voiceover: string;
  description: string;
  hashtags: string[];
  disclosure: string;
  cta: string;
  thumbnailOptions: Array<{
    headline: string;
    accent: string;
    layout: "benefit-arrow" | "problem-solution" | "clean-product";
  }>;
  verifiedClaims: string[];
  cautions: string[];
  subtitleCues: Array<{ index: number; startSecond: number; endSecond: number; text: string }>;
  qualityAudit?: {
    approved: boolean;
    score: number;
    summary: string;
    issues: string[];
    checks: { claimSafety: boolean; affiliateDisclosure: boolean; directExperienceLanguage: boolean; durationFit: boolean };
  };
  platformVersions: {
    youtube: { title: string; description: string; script: string; hashtags: string[] };
    instagram: { caption: string; script: string; hashtags: string[] };
    douyin: { title: string; caption: string; scriptSimplifiedChinese: string; hashtags: string[] };
    xiaohongshu: {
      title: string;
      body: string;
      hashtags: string[];
      cards: Array<{ order: number; headline: string; body: string; visualDirection: string }>;
    };
  };
};

type RightsStatus = "owned" | "seller-provided" | "affiliate-provided" | "permission-confirmed" | "unverified";
type MediaReference = {
  id: string;
  platform: "douyin" | "xiaohongshu" | "coupang" | "temu" | "owned" | "other";
  url: string;
  title: string;
  assetKind: "page-link" | "video-file";
  rightsStatus: RightsStatus;
  useInFinal: boolean;
  includeInMixAnalysis: boolean;
  notes: string;
  analysisFrameUrls: string[];
  selectedKeywords: string[];
  analysis?: ReferenceAnalysis;
  createdAt: string;
};

type SourceMixPlan = {
  title: string;
  totalDurationSeconds: number;
  selectedReferenceIds: string[];
  cuts: Array<{
    order: number;
    startSecond: number;
    durationSeconds: number;
    referenceId: string;
    frameIndex: number;
    role: string;
    decision: "use-licensed" | "recreate" | "generated";
    direction: string;
    subtitleIntent: string;
  }>;
  safetySummary: string;
  generatedAt: string;
  model: string;
};

type ChinaConnectionStatus = {
  douyin: { configured: boolean; mode: string; note: string };
  xiaohongshu: { configured: boolean; mode: string; note: string };
};

type ChinaSearchPlatform = "all" | "douyin" | "xiaohongshu";
type ChinaSearchResultMode = "popular" | "related";
type ChinaKeywordInsight = {
  simplifiedChinese: string;
  koreanMeaning: string;
  intent: "product" | "problem" | "use-case" | "review" | "viral";
  evidenceCount: number;
  trendScore: number;
  trendLabel: string;
};
type ChinaSearchResult = {
  id: string;
  platform: "douyin" | "xiaohongshu";
  title: string;
  url: string;
  thumbnailUrl: string;
  durationSeconds: number | null;
  engagement: { likes: number | null; comments: number | null; saves: number | null };
  popularityLabel: string;
  note: string;
  rightsStatus: "unverified";
  canUseOriginal: false;
  sourceLabel: string;
  sourceMode?: "public-index" | "browser-account";
  nativeRank?: number;
  hashtags?: string[];
};

type ChinaPreviewState = {
  item: ChinaSearchResult;
  loading: boolean;
  mode: "official-embed" | "platform-player" | "error";
  embedUrl: string;
  message: string;
};

type ReferenceAnalysis = {
  productName: string;
  sourceSummary: string;
  keywordCandidates: Array<{ keyword: string; language: "ko" | "zh-CN"; recommended: boolean; reason: string }>;
  hookPatterns: string[];
  salesPoints: string[];
  sceneDecisions: Array<{
    frameIndex: number;
    decision: "keep" | "remove" | "recreate";
    role: string;
    reason: string;
    suggestedDurationSeconds: number;
  }>;
  mixPlan: Array<{
    order: number;
    durationSeconds: number;
    role: string;
    direction: string;
    source: "uploaded-photo" | "licensed-video" | "new-ai-scene";
  }>;
  copyrightSafety: string;
};

type TrendIntelligence = {
  chineseKeywords: Array<{ simplifiedChinese: string; koreanMeaning: string; searchIntent: string }>;
  discoveryLinks: Array<{ platform: "douyin" | "xiaohongshu"; keyword: string; url: string }>;
  hookPatterns: string[];
  sellingAngles: string[];
  originalShotPlan: Array<{
    order: number;
    durationSeconds: number;
    role: string;
    camera: string;
    direction: string;
    assetType: "photo" | "licensed-video" | "generated-scene";
  }>;
  referenceRule: string;
};

type QualityMetrics = {
  productMatch: number;
  visualIntegrity: number;
  geometryDetail?: number;
  colorMaterial?: number;
  textLogoIntegrity?: number;
  humanAnatomy?: number;
  sceneContinuity?: number;
  motionReadiness?: number;
  commercialNaturalness: number;
  composition: number;
  claimSafety: number;
};

type QualityReport = {
  score?: number;
  threshold?: number;
  summary?: string;
  issues?: string[];
  metrics?: QualityMetrics;
  criticalErrors?: string[];
};

type ImageCandidate = {
  index: number;
  assetUrl: string;
  score?: number;
  issues?: string[];
};

type Scene = {
  id: string;
  scene_number: number;
  start_second: number;
  end_second: number;
  role: string;
  prompt: string;
  subtitle_text: string;
  narration: string;
  status: string;
  quality_status?: string;
  quality_score?: number | null;
  quality_report?: QualityReport | null;
  image_candidates?: ImageCandidate[] | null;
  selected_image_url?: string | null;
  image_retry_count?: number;
  video_url?: string | null;
  error_message?: string | null;
};

type BusyState = "create" | "package" | "productization" | "media" | "reference" | "reference-video" | "reference-analysis" | "source-mix" | "china-search" | "china-import" | "shopping-pipeline" | "content-approval" | "voice" | "image" | "images" | "approve" | "scene" | "all" | "render" | "publish" | null;

const styles = [
  ["cinematic-product", "영화형 상품 광고"],
  ["emotional-brand", "감성 브랜드"],
  ["how-to", "사용법 설명"],
  ["ugc-review", "후기형 UGC"],
  ["problem-solution", "문제 해결형"],
];

const qualityLabels: Record<string, string> = {
  pending: "검수 대기",
  generating: "후보 생성 중",
  reviewing: "AI 검수 중",
  approved: "품질 통과",
  revision_required: "자동 재생성",
  hold: "대표님 확인 필요",
  failed: "검수 실패",
};

const rightsLabels: Record<RightsStatus, string> = {
  owned: "직접 촬영",
  "seller-provided": "판매자 제공",
  "affiliate-provided": "제휴센터 제공",
  "permission-confirmed": "사용 허가 확인",
  unverified: "권리 미확인",
};

export default function CreativeStudioPro({ shoppingCenterMode = false }: { shoppingCenterMode?: boolean }) {
  const [form, setForm] = useState({
    title: "GY-NEXUS 20초 상품 영상",
    productUrl: "",
    affiliateUrl: "",
    productName: "",
    productDescription: "",
    masterPrompt: "첫 2초는 강한 시각적 훅, 실제 사용 장면 중심, 과장 없는 프리미엄 광고",
    sourceMode: "single-photo-commerce",
    sourceImageUrl: "",
    duration: 20,
    ratio: "720:1280",
    style: "cinematic-product",
    subtitleMode: "korean",
    voiceMode: "female",
    voicePreset: "marin",
    musicMood: "modern-corporate",
    subtitleStyle: "bold-pop",
    thumbnailStyle: "benefit-arrow",
    sfxMode: "recommended",
    platformTargets: ["youtube", "instagram", "douyin", "xiaohongshu"],
    qualityThreshold: 85,
    maxImageRetries: 2,
  });
  const [referenceFiles, setReferenceFiles] = useState<File[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [savedProducts, setSavedProducts] = useState<SavedProduct[]>([]);
  const [savedProductId, setSavedProductId] = useState("");
  const [selected, setSelected] = useState<Project | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [busy, setBusy] = useState<BusyState>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [mediaReferences, setMediaReferences] = useState<MediaReference[]>([]);
  const [mediaAnalysisFiles, setMediaAnalysisFiles] = useState<File[]>([]);
  const [mediaVideoFile, setMediaVideoFile] = useState<File | null>(null);
  const [chinaSearchKeyword, setChinaSearchKeyword] = useState("");
  const [chinaSearchPlatform, setChinaSearchPlatform] = useState<ChinaSearchPlatform>("all");
  const [chinaSearchResults, setChinaSearchResults] = useState<ChinaSearchResult[]>([]);
  const [chinaKeywords, setChinaKeywords] = useState<ChinaKeywordInsight[]>([]);
  const [translatedChinaProductName, setTranslatedChinaProductName] = useState("");
  const [chinaSearchResultMode, setChinaSearchResultMode] = useState<ChinaSearchResultMode>("related");
  const [selectedChinaResultIds, setSelectedChinaResultIds] = useState<string[]>([]);
  const [chinaPreview, setChinaPreview] = useState<ChinaPreviewState | null>(null);
  const [shoppingPipelineStep, setShoppingPipelineStep] = useState(0);
  const [editorPreferences, setEditorPreferences] = useState<{
    playbackSpeed: 1 | 1.2 | 1.4;
    subtitleCleanupMode: "recreate-clean" | "safe-bottom-crop" | "keep-licensed";
    sourceAudioMode: "mute-korean-tts" | "mute";
  }>({ playbackSpeed: 1.2, subtitleCleanupMode: "recreate-clean", sourceAudioMode: "mute-korean-tts" });
  const [chinaAccountConnectorStatus, setChinaAccountConnectorStatus] = useState<"checking" | "connected" | "not-installed" | "searching" | "error">("checking");
  const [chinaConnectionStatus, setChinaConnectionStatus] = useState<ChinaConnectionStatus | null>(null);
  const [mediaDraft, setMediaDraft] = useState({
    platform: "douyin" as MediaReference["platform"],
    url: "",
    title: "",
    rightsStatus: "unverified" as RightsStatus,
    useInFinal: false,
    notes: "",
  });
  const [selectedHookIndex, setSelectedHookIndex] = useState<number | null>(null);
  const [expandedReferenceId, setExpandedReferenceId] = useState<string | null>(null);

  const previewUrls = useMemo(() => referenceFiles.map((file) => URL.createObjectURL(file)), [referenceFiles]);
  useEffect(() => () => previewUrls.forEach((url) => URL.revokeObjectURL(url)), [previewUrls]);
  const analysisPreviewUrls = useMemo(() => mediaAnalysisFiles.map((file) => URL.createObjectURL(file)), [mediaAnalysisFiles]);
  useEffect(() => () => analysisPreviewUrls.forEach((url) => URL.revokeObjectURL(url)), [analysisPreviewUrls]);

  useEffect(() => {
    function onConnectorMessage(event: MessageEvent) {
      if (event.source !== window || event.data?.source !== "GY_CHINA_CONNECTOR") return;
      if (event.data.type === "GY_CHINA_CONNECTOR_PONG") {
        setChinaAccountConnectorStatus("connected");
        return;
      }
      if (event.data.type !== "GY_CHINA_CONNECTOR_RESULTS") return;
      if (!event.data.success) {
        setChinaAccountConnectorStatus("error");
        setMessage(String(event.data.message || "Edge 계정 검색 도우미가 결과를 가져오지 못했습니다."));
        return;
      }
      const nativeResults = Array.isArray(event.data.results) ? event.data.results as ChinaSearchResult[] : [];
      setChinaSearchResults((current) => Array.from(new Map([...nativeResults, ...current].map((item) => [item.url, item])).values()).slice(0, 12));
      if (nativeResults.some((item) => typeof item.engagement?.likes === "number" && item.engagement.likes > 0)) {
        setChinaSearchResultMode("popular");
      }
      const nativeKeywords = Array.isArray(event.data.keywords) ? event.data.keywords as Array<{ keyword: string; count: number }> : [];
      if (nativeKeywords.length) {
        setChinaKeywords((current) => {
          const nativeInsights: ChinaKeywordInsight[] = nativeKeywords.slice(0, 8).map((item, index) => ({
            simplifiedChinese: String(item.keyword || "").replace(/^#/, "").trim(),
            koreanMeaning: "로그인 계정 검색의 반복 태그",
            intent: "viral" as const,
            evidenceCount: Number(item.count) || 1,
            trendScore: Math.max(80, 100 - index * 3),
            trendLabel: "계정 인기 태그",
          })).filter((item) => item.simplifiedChinese);
          return Array.from(new Map([...nativeInsights, ...current].map((item) => [item.simplifiedChinese, item])).values()).slice(0, 10);
        });
      }
      setChinaAccountConnectorStatus("connected");
      setSelectedChinaResultIds([]);
      setMessage(`로그인 계정 검색 화면에서 ${nativeResults.length}개의 쇼츠 후보를 가져왔습니다. 카드로 보고 필요한 영상을 고르세요.`);
    }

    window.addEventListener("message", onConnectorMessage);
    window.postMessage({ source: "GY_NEXUS", type: "GY_CHINA_CONNECTOR_PING" }, window.location.origin);
    const timer = window.setTimeout(() => setChinaAccountConnectorStatus((current) => current === "checking" ? "not-installed" : current), 1600);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("message", onConnectorMessage);
    };
  }, []);

  const imageApproved = scenes.filter((scene) => scene.quality_status === "approved").length;
  const qualityHolds = scenes.filter((scene) => scene.quality_status === "hold").length;
  const completed = scenes.filter((scene) => scene.status === "completed").length;
  const imageProgress = scenes.length ? Math.round((imageApproved / scenes.length) * 100) : 0;
  const videoProgress = scenes.length ? Math.round((completed / scenes.length) * 100) : 0;
  const visualProfile = selected?.settings?.visualProfile;
  const commercePackage = selected?.settings?.commercePackage;
  const trendIntelligence = selected?.settings?.trendIntelligence;
  const sourceMixPlan = selected?.settings?.sourceMixPlan;
  const contentApproved = Boolean(selected?.settings?.contentApprovedAt);
  const usableMediaCount = mediaReferences.filter((item) => item.useInFinal && item.rightsStatus !== "unverified").length;
  const inspirationMediaCount = mediaReferences.length - usableMediaCount;
  const singlePhotoMode = form.sourceMode === "single-photo-commerce";
  const productPreviewUrl = selected?.settings?.referenceImageUrls?.[0] || selected?.source_image_url || "";
  const activeChinaInput = chinaSearchKeyword.trim() || selected?.product_name || form.productName || "인기 상품";
  const activeChinaKeyword = translatedChinaProductName || activeChinaInput;

  async function loadProjects(openLatest = false) {
    const response = await fetch("/api/creative-studio-pro/projects", { cache: "no-store" });
    const data = await response.json();
    if (data.success) {
      setProjects(data.projects);
      if (openLatest && Array.isArray(data.projects) && data.projects[0]) await openProject(data.projects[0]);
    }
  }

  async function loadSavedProducts() {
    const response = await fetch("/api/products", { cache: "no-store" });
    const data = await response.json();
    if (response.ok) setSavedProducts(Array.isArray(data.products) ? data.products.slice(0, 100) : []);
  }

  async function openProject(project: Pick<Project, "id">) {
    setError("");
    const response = await fetch(`/api/creative-studio-pro/projects/${project.id}`, { cache: "no-store" });
    const data = await response.json();
    if (data.success) {
      setSelected(data.project);
      setScenes(data.scenes);
      setMediaReferences(Array.isArray(data.project.settings?.mediaReferences)
        ? data.project.settings.mediaReferences.map((item: MediaReference) => ({
          ...item,
          assetKind: item.assetKind === "video-file" ? "video-file" : "page-link",
          includeInMixAnalysis: item.includeInMixAnalysis !== false,
          analysisFrameUrls: Array.isArray(item.analysisFrameUrls) ? item.analysisFrameUrls : [],
          selectedKeywords: Array.isArray(item.selectedKeywords) ? item.selectedKeywords : [],
        }))
        : []);
      setSelectedHookIndex(Number.isInteger(data.project.settings?.selectedHookIndex) ? data.project.settings.selectedHookIndex : null);
      setEditorPreferences({
        playbackSpeed: [1, 1.2, 1.4].includes(Number(data.project.settings?.playbackSpeed))
          ? Number(data.project.settings.playbackSpeed) as 1 | 1.2 | 1.4
          : 1.2,
        subtitleCleanupMode: ["recreate-clean", "safe-bottom-crop", "keep-licensed"].includes(String(data.project.settings?.subtitleCleanupMode))
          ? data.project.settings.subtitleCleanupMode
          : "recreate-clean",
        sourceAudioMode: ["mute-korean-tts", "mute"].includes(String(data.project.settings?.sourceAudioMode))
          ? data.project.settings.sourceAudioMode as "mute-korean-tts" | "mute"
          : "mute-korean-tts",
      });
    } else {
      setError(data.message);
    }
  }

  useEffect(() => {
    void Promise.all([
      loadProjects(true),
      loadSavedProducts(),
      fetch("/api/creative-studio-pro/china-connections", { cache: "no-store" })
        .then((response) => response.json())
        .then((data) => { if (data.success) setChinaConnectionStatus(data.connections); })
        .catch(() => undefined),
    ]);
    // Initial hydration only. Subsequent refreshes are explicit after mutations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function patch(key: string, value: string | number) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function importSavedProduct(productId: string) {
    setSavedProductId(productId);
    const product = savedProducts.find((item) => item.id === productId);
    if (!product) return;
    setForm((current) => ({
      ...current,
      title: `${product.title} 쇼핑 쇼츠`,
      productName: product.title,
      productDescription: product.description || "",
      productUrl: product.affiliate_url || "",
      affiliateUrl: product.affiliate_url || "",
      sourceImageUrl: product.image_url || "",
    }));
    setMessage(`${product.platform || "저장"} 상품 정보를 작업 입력란에 불러왔습니다.`);
    setError("");
  }

  function selectReferences(files: FileList | null) {
    const next = Array.from(files || []);
    if (next.length > 4) {
      setError("상품 사진은 최대 4장까지 선택할 수 있습니다.");
      return;
    }
    setError("");
    setReferenceFiles(next);
  }

  async function uploadReferences() {
    if (!referenceFiles.length) return [] as string[];
    const payload = new FormData();
    referenceFiles.forEach((file) => payload.append("images", file));
    const response = await fetch("/api/creative-studio-pro/references", { method: "POST", body: payload });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || "상품 사진 업로드 실패");
    return data.urls as string[];
  }

  async function createProject() {
    const referenceCount = referenceFiles.length + (form.sourceImageUrl.trim() ? 1 : 0);
    const minimumReferences = singlePhotoMode ? 1 : 2;
    if (referenceCount < minimumReferences) {
      setError(singlePhotoMode
        ? "사진 한 장 쇼츠를 만들려면 실제 상품 이미지 1장을 올려주세요."
        : "유료 품질 기준을 위해 실제 상품 사진을 앞·뒤 또는 서로 다른 각도로 최소 2장 올려주세요.");
      return;
    }
    setBusy("create");
    setError("");
    setMessage("");
    try {
      const uploadedUrls = await uploadReferences();
      const response = await fetch("/api/creative-studio-pro/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, referenceImageUrls: uploadedUrls }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message);
      setMessage(`${data.scenes.length}개 장면 기획이 완료되었습니다. 아직 Runway 비용은 사용하지 않았습니다.`);
      await loadProjects();
      await openProject(data.project);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "프로젝트 생성 실패");
    } finally {
      setBusy(null);
    }
  }

  async function uploadAnalysisFrames() {
    if (!mediaAnalysisFiles.length) return [] as string[];
    const payload = new FormData();
    payload.append("purpose", "analysis");
    mediaAnalysisFiles.forEach((file) => payload.append("images", file));
    const response = await fetch("/api/creative-studio-pro/references", { method: "POST", body: payload });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || "분석 프레임 업로드 실패");
    return data.urls as string[];
  }

  function selectMediaVideo(fileList: FileList | null) {
    const file = fileList?.[0] || null;
    if (!file) {
      setMediaVideoFile(null);
      return;
    }
    if (!["video/mp4", "video/webm", "video/quicktime"].includes(file.type)) {
      setError("허가 영상은 MP4, WEBM, MOV 형식만 선택할 수 있습니다.");
      return;
    }
    if (file.size < 1 || file.size > 500 * 1024 * 1024) {
      setError("허가 영상 파일은 500MB 이하여야 합니다.");
      return;
    }
    setError("");
    setMediaVideoFile(file);
    setMediaDraft((current) => ({
      ...current,
      title: current.title || file.name.replace(/\.[^.]+$/, ""),
    }));
  }

  async function uploadMediaVideo(file: File) {
    setBusy("reference-video");
    const ticketResponse = await fetch("/api/creative-studio-pro/reference-videos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: file.name, contentType: file.type, size: file.size }),
    });
    const ticket = await ticketResponse.json();
    if (!ticketResponse.ok || !ticket.success) throw new Error(ticket.message || "허가 영상 업로드 준비 실패");
    const supabase = createBrowserSupabaseClient();
    const { error: uploadError } = await supabase.storage
      .from(ticket.bucket)
      .uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: file.type, upsert: false });
    if (uploadError) throw new Error(`허가 영상 업로드 실패: ${uploadError.message}`);
    return String(ticket.publicUrl);
  }

  async function addMediaReference() {
    if (!selected) return;
    setBusy("reference");
    setError("");
    try {
      if (!mediaVideoFile && !mediaDraft.url.trim()) throw new Error("참고 페이지 주소 또는 사용 허가 영상 파일을 입력해주세요.");
      let assetUrl = "";
      if (mediaVideoFile) {
        if (mediaDraft.rightsStatus === "unverified") throw new Error("영상 파일을 올리려면 직접 촬영·판매자 제공·제휴 제공·사용 허가 중 권리 상태를 선택해주세요.");
        assetUrl = await uploadMediaVideo(mediaVideoFile);
      } else {
        const parsed = new URL(mediaDraft.url.trim());
        if (parsed.protocol !== "https:") throw new Error("HTTPS 주소만 사용할 수 있습니다.");
        assetUrl = parsed.toString();
      }
      const analysisFrameUrls = await uploadAnalysisFrames();
      const next: MediaReference = {
        id: `media-${Date.now()}`,
        platform: mediaDraft.platform,
        url: assetUrl,
        title: mediaDraft.title.trim() || mediaVideoFile?.name || mediaDraft.platform,
        assetKind: mediaVideoFile ? "video-file" : "page-link",
        rightsStatus: mediaDraft.rightsStatus,
        useInFinal: mediaDraft.rightsStatus !== "unverified" && mediaDraft.useInFinal,
        includeInMixAnalysis: true,
        notes: mediaDraft.notes.trim(),
        analysisFrameUrls,
        selectedKeywords: [],
        createdAt: new Date().toISOString(),
      };
      setMediaReferences((current) => [...current, next].slice(0, 20));
      setMediaDraft({ platform: "douyin", url: "", title: "", rightsStatus: "unverified", useInFinal: false, notes: "" });
      setMediaAnalysisFiles([]);
      setMediaVideoFile(null);
      setError("");
      setMessage("소재를 목록에 추가했습니다. ‘권리 목록 저장’을 눌러 프로젝트에 반영해주세요.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "올바른 소재 주소를 입력해주세요.");
    } finally {
      setBusy(null);
    }
  }

  async function generateSourceMix() {
    if (!selected) return;
    if (!mediaReferences.some((item) => item.includeInMixAnalysis)) {
      setError("AI 짜집기 설계에 사용할 쇼츠 소스를 하나 이상 선택해주세요.");
      return;
    }
    setBusy("source-mix");
    setError("");
    setMessage("선택한 쇼츠의 훅·장면 역할을 비교해 새로운 한국형 판매 순서를 설계하고 있습니다.");
    try {
      await persistMediaReferences();
      const response = await fetch(`/api/creative-studio-pro/projects/${selected.id}/source-mix`, { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "AI 소스 믹스 설계 실패");
      await openProject(selected);
      setMessage(data.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "AI 소스 믹스 설계 실패");
    } finally {
      setBusy(null);
    }
  }

  function selectAnalysisFrames(files: FileList | null) {
    const next = Array.from(files || []);
    if (next.length > 8) {
      setError("장면 분석 프레임은 최대 8장까지 선택할 수 있습니다.");
      return;
    }
    setError("");
    setMediaAnalysisFiles(next);
  }

  async function persistMediaReferences(references: MediaReference[] = mediaReferences) {
    if (!selected) throw new Error("프로젝트를 먼저 선택해주세요.");
    const response = await fetch(`/api/creative-studio-pro/projects/${selected.id}/media-references`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ references }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message);
    setMediaReferences(data.references);
    return data;
  }

  async function searchChinaSources(queryOverride?: string) {
    const query = (queryOverride || activeChinaInput).trim();
    if (query.length < 2) {
      setError("찾을 상품명이나 중국어 키워드를 2자 이상 입력해주세요.");
      return;
    }
    setBusy("china-search");
    setError("");
    setMessage("한국어 입력을 중국어 간체로 번역한 뒤 인기 쇼츠를 먼저 찾고, 없으면 관련 쇼츠로 자동 전환합니다.");
    try {
      const response = await fetch("/api/creative-studio-pro/china-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, platform: chinaSearchPlatform, limit: 12 }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "중국 플랫폼 내부 검색 실패");
      setChinaSearchResults(Array.isArray(data.results) ? data.results : []);
      setChinaKeywords(Array.isArray(data.keywords) ? data.keywords : []);
      setTranslatedChinaProductName(String(data.translatedProductName || ""));
      setChinaSearchResultMode(data.resultMode === "popular" ? "popular" : "related");
      if (queryOverride) setChinaSearchKeyword(queryOverride);
      setSelectedChinaResultIds([]);
      setMessage(data.message);
      const accountQuery = String(data.keywords?.[0]?.simplifiedChinese || data.translatedProductName || query).trim();
      if (chinaAccountConnectorStatus === "connected" && accountQuery) requestChinaAccountSearch(accountQuery);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "중국 플랫폼 내부 검색 실패");
    } finally {
      setBusy(null);
    }
  }

  function requestChinaAccountSearch(queryOverride?: string) {
    const query = (queryOverride || translatedChinaProductName || activeChinaKeyword).trim();
    if (!query) {
      setError("계정 검색에 사용할 상품명이나 중국어 키워드를 먼저 입력해주세요.");
      return;
    }
    setChinaAccountConnectorStatus("searching");
    setMessage("번역된 중국어로 도우인·샤오홍슈 계정 화면을 검색합니다. 인기 신호가 없으면 관련 쇼츠를 가져옵니다.");
    window.postMessage({
      source: "GY_NEXUS",
      type: "GY_CHINA_CONNECTOR_SEARCH",
      requestId: window.crypto.randomUUID(),
      query,
      platform: chinaSearchPlatform,
      limit: 12,
    }, window.location.origin);
  }

  function toggleChinaSearchResult(resultId: string) {
    setSelectedChinaResultIds((current) => current.includes(resultId)
      ? current.filter((item) => item !== resultId)
      : [...current, resultId]);
  }

  async function openChinaPreview(item: ChinaSearchResult) {
    setChinaPreview({ item, loading: true, mode: "platform-player", embedUrl: "", message: "공식 재생 방법을 확인하고 있습니다." });
    try {
      const response = await fetch("/api/creative-studio-pro/china-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: item.url }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "영상 미리보기 준비 실패");
      setChinaPreview({
        item,
        loading: false,
        mode: data.mode === "official-embed" ? "official-embed" : "platform-player",
        embedUrl: String(data.embedUrl || ""),
        message: String(data.message || "원문 플레이어에서 재생할 수 있습니다."),
      });
    } catch (cause) {
      setChinaPreview({ item, loading: false, mode: "error", embedUrl: "", message: cause instanceof Error ? cause.message : "영상 미리보기 준비 실패" });
    }
  }

  function buildImportedSearchReferences() {
    const selectedResults = chinaSearchResults.filter((item) => selectedChinaResultIds.includes(item.id));
    if (!selectedResults.length) throw new Error("AI 믹스에 참고할 검색 카드를 하나 이상 선택해주세요.");
    const existingUrls = new Set(mediaReferences.map((item) => item.url));
    const availableSlots = Math.max(0, 20 - mediaReferences.length);
    const newResults = selectedResults.filter((item) => !existingUrls.has(item.url)).slice(0, availableSlots);
    if (!newResults.length) {
      throw new Error(availableSlots === 0 ? "소스함은 최대 20개입니다. 기존 자료를 정리한 뒤 다시 담아주세요." : "선택한 검색 카드는 이미 소스함에 있습니다.");
    }
    const importedAt = Date.now();
    const imported: MediaReference[] = newResults.map((item, index) => ({
      id: `media-search-${importedAt}-${index}`,
      platform: item.platform,
      url: item.url,
      title: item.title,
      assetKind: "page-link",
      rightsStatus: "unverified",
      useInFinal: false,
      includeInMixAnalysis: true,
      notes: `${item.note}. 훅·촬영각도·판매 구조만 분석하고 원본 영상은 최종본에 사용하지 않습니다.`,
      analysisFrameUrls: item.thumbnailUrl ? [item.thumbnailUrl] : [],
      selectedKeywords: chinaKeywords.filter((keyword) => keyword.evidenceCount > 0).slice(0, 6).map((keyword) => keyword.simplifiedChinese),
      createdAt: new Date().toISOString(),
    }));
    return { imported, nextReferences: [...mediaReferences, ...imported].slice(0, 20) };
  }

  async function importChinaSearchResults() {
    if (!selected) {
      setError("먼저 작업할 쇼츠 프로젝트를 선택해주세요.");
      return;
    }
    setBusy("china-import");
    setError("");
    try {
      const { imported, nextReferences } = buildImportedSearchReferences();
      setMediaReferences(nextReferences);
      const data = await persistMediaReferences(nextReferences);
      setSelectedChinaResultIds([]);
      await openProject(selected);
      setMessage(`${imported.length}개 검색 카드를 AI 소스함에 저장했습니다. 필요한 카드를 고른 뒤 ‘선택 소스로 AI 짜집기 설계’를 누르세요. ${data.unchanged ? "" : "기존 믹스 승인은 안전하게 초기화했습니다."}`.trim());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "검색 카드 저장 실패");
    } finally {
      setBusy(null);
    }
  }

  async function prepareSelectedShoppingShorts() {
    if (!selected) {
      setError("먼저 작업할 쇼츠 프로젝트를 선택해주세요.");
      return;
    }
    setBusy("shopping-pipeline");
    setShoppingPipelineStep(1);
    setError("");
    setMessage("선택한 영상을 소스함에 담고 AI 제작 설정을 저장하고 있습니다.");
    try {
      const { imported, nextReferences } = buildImportedSearchReferences();
      setMediaReferences(nextReferences);
      await persistMediaReferences(nextReferences);

      setShoppingPipelineStep(2);
      const settingsResponse = await fetch(`/api/creative-studio-pro/projects/${selected.id}/editor-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editorPreferences),
      });
      const settingsData = await settingsResponse.json();
      if (!settingsResponse.ok || !settingsData.success) throw new Error(settingsData.message || "AI 편집 설정 저장 실패");

      setShoppingPipelineStep(3);
      setMessage("선택 소스의 장면 역할을 분석해 15~30초 한국형 컷 순서를 만들고 있습니다.");
      const mixResponse = await fetch(`/api/creative-studio-pro/projects/${selected.id}/source-mix`, { method: "POST" });
      const mixData = await mixResponse.json();
      if (!mixResponse.ok || !mixData.success) throw new Error(mixData.message || "AI 컷 편집 설계 실패");

      setShoppingPipelineStep(4);
      setMessage("한국어 훅·대본·정확한 자막·TTS용 문장·썸네일·게시정보를 만들고 있습니다.");
      const packageResponse = await fetch(`/api/creative-studio-pro/projects/${selected.id}/productization`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      const packageData = await packageResponse.json();
      if (!packageResponse.ok || !packageData.success) throw new Error(packageData.message || "한국형 판매 패키지 생성 실패");

      setShoppingPipelineStep(5);
      setSelectedChinaResultIds([]);
      await openProject(selected);
      setMessage(`${imported.length}개 영상을 바탕으로 AI 컷 편집, 한국어 대본·자막, 음성 준비, 썸네일·게시정보까지 연결했습니다. 아래에서 훅 하나를 승인한 뒤 AI 음성을 만들면 됩니다.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "쇼핑 쇼츠 자동 제작 준비 실패");
    } finally {
      setBusy(null);
    }
  }

  async function saveMediaReferences() {
    if (!selected) return;
    setBusy("media");
    setError("");
    setMessage("");
    try {
      const data = await persistMediaReferences();
      await openProject(selected);
      setMessage(data.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "소재 권리 목록 저장 실패");
    } finally {
      setBusy(null);
    }
  }

  async function analyzeReference(referenceId: string) {
    if (!selected) return;
    setBusy("reference-analysis");
    setError("");
    setMessage("상품·키워드·훅·장면 유지/제거·믹스 구조를 분석하고 있습니다.");
    try {
      await persistMediaReferences();
      const response = await fetch(`/api/creative-studio-pro/projects/${selected.id}/reference-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceId }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message);
      await openProject(selected);
      setExpandedReferenceId(referenceId);
      setMessage(data.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "참고영상 AI 분석 실패");
    } finally {
      setBusy(null);
    }
  }

  function toggleReferenceKeyword(referenceId: string, keyword: string) {
    setMediaReferences((current) => current.map((item) => {
      if (item.id !== referenceId) return item;
      const selectedKeywords = item.selectedKeywords || [];
      return {
        ...item,
        selectedKeywords: selectedKeywords.includes(keyword)
          ? selectedKeywords.filter((itemKeyword) => itemKeyword !== keyword)
          : [...selectedKeywords, keyword].slice(0, 12),
      };
    }));
  }

  async function prepareProductization(force = false) {
    if (!selected) return;
    setBusy("productization");
    setError("");
    setMessage("중국어 탐색 키워드와 독창적 장면 설계, 플랫폼별 판매 패키지를 만들고 있습니다.");
    try {
      await persistMediaReferences();
      const response = await fetch(`/api/creative-studio-pro/projects/${selected.id}/productization`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message);
      await openProject(selected);
      const elapsed = typeof data.elapsedMs === "number" ? ` · ${(data.elapsedMs / 1000).toFixed(1)}초` : "";
      setMessage(`${data.message}${elapsed}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "통합 상품화 준비 실패");
    } finally {
      setBusy(null);
    }
  }

  async function approveContent() {
    if (!selected || selectedHookIndex === null) {
      setError("첫 3초에 사용할 훅을 하나 선택해주세요.");
      return;
    }
    const confirmed = window.confirm("저작권·상품 일치·허위 표현·한국어 자막·첫 3초 훅을 확인하고 이 콘텐츠를 승인할까요?");
    if (!confirmed) return;
    setBusy("content-approval");
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/creative-studio-pro/projects/${selected.id}/content-approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hookIndex: selectedHookIndex }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message);
      await openProject(selected);
      setMessage(data.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "콘텐츠 품질 승인 실패");
    } finally {
      setBusy(null);
    }
  }

  async function generatePackage() {
    if (!selected) return;
    setBusy("package");
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/creative-studio-pro/projects/${selected.id}/commerce-package`, { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message);
      await openProject(selected);
      setMessage("한국형 대본·훅 3개·썸네일 문구·제목·설명·태그를 만들었습니다.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "쇼핑 콘텐츠 패키지 생성 실패");
    } finally {
      setBusy(null);
    }
  }

  async function generateVoice() {
    if (!selected) return;
    setBusy("voice");
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/creative-studio-pro/projects/${selected.id}/voice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice: selected.settings?.voicePreset || undefined }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message);
      await openProject(selected);
      setMessage("검수된 한국어 대본으로 AI 음성을 만들었습니다.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "AI 음성 생성 실패");
    } finally {
      setBusy(null);
    }
  }

  async function prepareNext(silent = false) {
    if (!selected) return { done: true, readyForRunway: false };
    if (!silent) {
      setBusy("image");
      setError("");
      setMessage("");
    }
    try {
      const response = await fetch(`/api/creative-studio-pro/projects/${selected.id}/prepare-next`, { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message);
      await openProject(selected);
      if (!silent) setMessage(data.message);
      return { done: Boolean(data.done), readyForRunway: Boolean(data.readyForRunway) };
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "이미지 생성·검수 실패");
      return { done: true, readyForRunway: false };
    } finally {
      if (!silent) setBusy(null);
    }
  }

  async function prepareAll() {
    if (!selected) return;
    const confirmed = window.confirm(
      `장면마다 중간 품질 후보 3개를 비교하고 통과 시 4K 고품질 최종본을 생성합니다. 상품 정체성과 장면 연속성을 검사하며 최대 ${form.maxImageRetries}회까지 자동 재생성할 수 있습니다. 계속할까요?`,
    );
    if (!confirmed) return;
    setBusy("images");
    setError("");
    setMessage("후보 이미지 생성과 상품 일치도 검수를 순서대로 진행합니다. 창을 닫지 마세요.");
    for (let index = 0; index < scenes.length * 2 + 1; index += 1) {
      const result = await prepareNext(true);
      if (result.done) break;
    }
    await openProject(selected);
    setBusy(null);
    setMessage("전체 이미지 검수를 마쳤습니다. 보류 장면이 없다면 Runway 비용 승인을 할 수 있습니다.");
  }

  async function approveRunway() {
    if (!selected) return;
    const confirmed = window.confirm(
      `품질을 통과한 ${scenes.length}개 장면을 Runway 영상으로 만들 수 있게 승인합니다. 이 승인 뒤 영상 생성 버튼을 누르면 Runway 크레딧이 사용됩니다. 승인할까요?`,
    );
    if (!confirmed) return;
    setBusy("approve");
    setError("");
    try {
      const response = await fetch(`/api/creative-studio-pro/projects/${selected.id}/approve-render`, { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message);
      await openProject(selected);
      await loadProjects();
      setMessage("Runway 사용을 승인했습니다. 이제 장면 영상을 생성할 수 있습니다.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Runway 승인 실패");
    } finally {
      setBusy(null);
    }
  }

  async function generateNext(silent = false) {
    if (!selected) return false;
    if (!silent) {
      setBusy("scene");
      setError("");
      setMessage("");
    }
    try {
      const response = await fetch(`/api/creative-studio-pro/projects/${selected.id}/generate-next`, { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message);
      await openProject(selected);
      if (!silent) setMessage(data.done ? "모든 Runway 장면 생성이 완료되었습니다." : "다음 장면 영상이 완료되었습니다.");
      return Boolean(data.done);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "장면 영상 생성 실패");
      return true;
    } finally {
      if (!silent) setBusy(null);
    }
  }

  async function generateAll() {
    if (!selected) return;
    const confirmed = window.confirm(`남은 ${scenes.length - completed}개 장면의 Runway 크레딧을 사용합니다. 계속할까요?`);
    if (!confirmed) return;
    setBusy("all");
    setError("");
    setMessage("Runway 영상을 장면별로 생성하고 있습니다. 창을 닫지 마세요.");
    for (let index = 0; index < scenes.length + 1; index += 1) {
      const done = await generateNext(true);
      if (done) break;
    }
    await openProject(selected);
    setBusy(null);
    setMessage("Runway 장면 일괄 생성 작업을 마쳤습니다.");
  }

  async function render() {
    if (!selected) return;
    setBusy("render");
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/creative-studio-pro/projects/${selected.id}/render`, { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message);
      setMessage(data.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "렌더링 요청 실패");
    } finally {
      setBusy(null);
    }
  }

  async function queueYouTube() {
    if (!selected?.final_video_url || !commercePackage || !contentApproved) return;
    const confirmed = window.confirm("완성 영상을 YouTube ‘비공개’ 게시 대기열에 등록할까요? 실제 업로드는 통합 게시센터에서 다시 실행합니다.");
    if (!confirmed) return;
    setBusy("publish");
    setError("");
    setMessage("");
    try {
      const youtube = commercePackage.platformVersions.youtube;
      const response = await fetch("/api/publishing/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channels: ["youtube"],
          title: youtube.title,
          content: `${youtube.description}\n\n${commercePackage.disclosure}\n${commercePackage.cta}`,
          scheduledAt: new Date().toISOString(),
          payload: {
            videoUrl: selected.final_video_url,
            thumbnailUrl: scenes.find((scene) => scene.selected_image_url)?.selected_image_url || "",
            tags: youtube.hashtags.map((tag) => tag.replace(/^#/, "")),
            privacyStatus: "private",
            sourceProjectId: selected.id,
            gyProductCode: commercePackage.productCode,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message);
      setMessage("YouTube 비공개 게시 대기열에 등록했습니다. 게시센터에서 최종 실행할 수 있습니다.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "YouTube 게시 대기열 등록 실패");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={`creative-pro-stack shorts-quality-studio ${shoppingCenterMode ? "shopping-center-standalone" : ""}`}>
      <section className="panel creative-pro-hero">
        <div>
          <div className="eyebrow">GY-NEXUS · SHOPPING SHORTS PRODUCTIZATION</div>
          <h1>{shoppingCenterMode ? "GY-NEXUS SHOPPING SHORTS CENTER" : "상품 하나를 4개 플랫폼용 쇼핑 콘텐츠로 완성"}</h1>
          <p>쿠팡·Temu 링크와 사진을 넣으면 중국어 탐색 키워드, 독창적 장면 설계, 한국형 대본·음성·자막·썸네일·게시정보를 만들고 권리와 상품 품질을 통과한 자료만 최종 영상으로 보냅니다.</p>
        </div>
        <div className="creative-pro-badge"><strong>{form.duration}초</strong><span>{form.duration / 5}개 장면</span></div>
      </section>

      {shoppingCenterMode && <section className="shopping-studio-command">
        <div className="shopping-studio-command-head">
          <div><span>DEDICATED SHORTFORM WORKSPACE</span><h2>쇼핑 쇼츠 전용 제작실</h2><p>다른 스튜디오와 섞이지 않고 이 화면에서 소싱부터 게시 자료까지 완성합니다.</p></div>
          <a href="/admin/creative-studio-pro">일반 Creative Studio Pro 열기</a>
        </div>
        <nav className="shopping-module-nav" aria-label="쇼핑 쇼츠 제작 모듈">
          <a href="#shorts-projects" className={selected ? "ready" : "active"}><b>01</b><span>프로젝트</span><small>{selected ? "선택 완료" : "상품 입력"}</small></a>
          <a href="#shorts-source" className={mediaReferences.length ? "ready" : ""}><b>02</b><span>소스 가져오기</span><small>URL·사진·권리</small></a>
          <a href="#shorts-ai-editor" className={sourceMixPlan || trendIntelligence ? "ready" : ""}><b>03</b><span>AI 편집</span><small>분석·컷·믹스</small></a>
          <a href="#shorts-voice" className={selected?.settings?.voiceAudioUrl ? "ready" : ""}><b>04</b><span>음성·자막</span><small>TTS·정확한 SRT</small></a>
          <a href="#shorts-thumbnail" className={commercePackage ? "ready" : ""}><b>05</b><span>썸네일</span><small>문구·3안·SVG</small></a>
          <a href="#shorts-export" className={selected?.final_video_url ? "ready" : ""}><b>06</b><span>내보내기</span><small>CapCut·MP4·게시</small></a>
        </nav>
      </section>}

      <div className="creative-pro-layout" id="shorts-projects">
        <section className="panel creative-pro-form">
          <div className="section-title-row"><div><span className="eyebrow">STEP 1</span><h2>상품 사실자료와 영상 설정</h2></div><span className="quality-rule">통과 기준 {form.qualityThreshold}점</span></div>
          <div className="photo-mode-grid">
            <button type="button" className={singlePhotoMode ? "active" : ""} onClick={() => patch("sourceMode", "single-photo-commerce")}>
              <strong>사진 한 장 쇼츠</strong><span>한 장의 상품은 그대로 보존하고 배경·조명·카메라 연출을 바꿉니다.</span>
            </button>
            <button type="button" className={!singlePhotoMode ? "active" : ""} onClick={() => patch("sourceMode", "premium-multi-photo")}>
              <strong>프리미엄 2~4장</strong><span>앞·뒤·측면 자료로 실제 사용형 장면과 엄격한 상품 검수를 진행합니다.</span>
            </button>
          </div>
          <div className="saved-product-import">
            <div><b>인기상품·저장 상품 불러오기</b><span>상품 소싱 센터에서 승인한 쿠팡·Temu 상품을 바로 작업 입력란에 채웁니다.</span></div>
            <select value={savedProductId} onChange={(event) => importSavedProduct(event.target.value)}><option value="">상품 선택</option>{savedProducts.map((product) => <option key={product.id} value={product.id}>{product.platform || "기타"} · {product.title}{product.price_text ? ` · ${product.price_text}` : ""}</option>)}</select>
            <a href="/admin/product-intelligence">인기상품 수집 센터</a>
          </div>
          <div className="form-grid">
            <label>작업명<input value={form.title} onChange={(event) => patch("title", event.target.value)} /></label>
            <label>상품명<input value={form.productName} onChange={(event) => patch("productName", event.target.value)} placeholder="예: USB-C 8포트 허브" /></label>
          </div>
          <label>상품 판매 페이지 주소<input value={form.productUrl} onChange={(event) => patch("productUrl", event.target.value)} placeholder="선택사항 · 사실 확인용 URL" /></label>
          <label>제휴 링크<input value={form.affiliateUrl} onChange={(event) => patch("affiliateUrl", event.target.value)} placeholder="쿠팡·Temu에서 직접 만든 제휴 링크 · 선택사항" /></label>
          <label>검증된 상품 설명<textarea rows={4} value={form.productDescription} onChange={(event) => patch("productDescription", event.target.value)} placeholder="확인된 크기, 재질, 구성품, 기능만 입력하세요." /></label>

          <div className="reference-upload">
            <div><b>{singlePhotoMode ? "실제 상품 사진 1장 이상" : "실제 상품 사진 2~4장"}</b><span>{singlePhotoMode ? "정면이 선명하고 글자·워터마크가 적은 사진을 권장합니다." : "앞·뒤·측면·실제 사용 장면을 권장합니다."} PNG/JPG/WEBP, 장당 8MB 이하</span></div>
            <label className="upload-button">사진 선택<input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(event) => selectReferences(event.target.files)} /></label>
          </div>
          {previewUrls.length > 0 && <div className="reference-preview">{previewUrls.map((url, index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={url} src={url} alt={`상품 참조 ${index + 1}`} />
          ))}</div>}
          <label>공개 상품 이미지 URL<input value={form.sourceImageUrl} onChange={(event) => patch("sourceImageUrl", event.target.value)} placeholder="파일 대신 사용할 때만 입력 · HTTPS" /></label>
          <label>공통 연출 지시<textarea rows={4} value={form.masterPrompt} onChange={(event) => patch("masterPrompt", event.target.value)} /></label>

          <div className="choice-block"><b>영상 길이</b><div className="choice-row">{[15, 20, 25, 30].map((seconds) => <button key={seconds} className={form.duration === seconds ? "selected" : ""} onClick={() => patch("duration", seconds)}>{seconds}초</button>)}</div></div>
          <div className="form-grid">
            <label>스타일<select value={form.style} onChange={(event) => patch("style", event.target.value)}>{styles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>화면 비율<select value={form.ratio} onChange={(event) => patch("ratio", event.target.value)}><option value="720:1280">9:16 쇼츠</option><option value="1280:720">16:9 유튜브</option></select></label>
            <label>품질 통과 기준<select value={form.qualityThreshold} onChange={(event) => patch("qualityThreshold", Number(event.target.value))}><option value={85}>85점 · 권장</option><option value={90}>90점 · 엄격</option><option value={95}>95점 · 매우 엄격</option></select></label>
            <label>자동 재검수 한도<select value={form.maxImageRetries} onChange={(event) => patch("maxImageRetries", Number(event.target.value))}><option value={1}>1회 · 비용 절약</option><option value={2}>2회 · 권장</option></select></label>
            <label>자막<select value={form.subtitleMode} onChange={(event) => patch("subtitleMode", event.target.value)}><option value="korean">정확한 한국어 자막</option><option value="none">자막 없음</option></select></label>
            <label>음성<select value={form.voiceMode} onChange={(event) => patch("voiceMode", event.target.value)}><option value="female">여성 내레이션</option><option value="male">남성 내레이션</option><option value="music-only">배경음악만</option><option value="silent">무음</option></select></label>
            <label>AI 목소리<select value={form.voicePreset} onChange={(event) => patch("voicePreset", event.target.value)}><option value="marin">Marin · 자연스러운 여성</option><option value="coral">Coral · 밝고 또렷함</option><option value="shimmer">Shimmer · 부드러운 여성</option><option value="cedar">Cedar · 신뢰감 있는 남성</option><option value="onyx">Onyx · 낮고 단단함</option><option value="echo">Echo · 담백한 남성</option></select></label>
            <label>배경음악<select value={form.musicMood} onChange={(event) => patch("musicMood", event.target.value)}><option value="modern-corporate">모던 쇼핑</option><option value="bright-lifestyle">밝은 라이프스타일</option><option value="minimal-tech">미니멀 테크</option><option value="warm-home">따뜻한 홈</option><option value="none">배경음악 없음</option></select></label>
            <label>자막 스타일<select value={form.subtitleStyle} onChange={(event) => patch("subtitleStyle", event.target.value)}><option value="bold-pop">강조형 쇼핑 자막</option><option value="clean-card">깔끔한 카드 자막</option><option value="minimal">미니멀 자막</option></select></label>
            <label>썸네일 스타일<select value={form.thumbnailStyle} onChange={(event) => patch("thumbnailStyle", event.target.value)}><option value="benefit-arrow">혜택 강조＋화살표</option><option value="problem-solution">문제 해결형</option><option value="clean-product">상품 중심형</option></select></label>
            <label>효과음<select value={form.sfxMode} onChange={(event) => patch("sfxMode", event.target.value)}><option value="recommended">장면별 추천 효과음</option><option value="minimal">최소 효과음</option><option value="none">효과음 없음</option></select></label>
          </div>
          <div className="cost-note"><b>비용 안전장치</b><span>프로젝트 생성은 장면 기획만 합니다. 이미지 생성은 별도 버튼, Runway는 전체 이미지 통과 후 대표님이 직접 승인해야 시작됩니다.</span></div>
          <button className="button button-primary" onClick={createProject} disabled={Boolean(busy)}>{busy === "create" ? "상품 사진 업로드·기획 중..." : "장면 기획 프로젝트 만들기"}</button>
          {message && <p className="success-text">{message}</p>}
          {error && <p className="error-text">{error}</p>}
        </section>

        <section className="panel creative-pro-projects">
          <h2>최근 프로젝트</h2>
          {projects.length === 0 ? <p className="empty-state">아직 프로젝트가 없습니다.</p> : projects.map((project) => (
            <button key={project.id} onClick={() => openProject(project)} className={selected?.id === project.id ? "project-item active" : "project-item"}>
              <span><b>{project.title}</b><small>{project.product_name} · {project.duration_seconds}초</small></span>
              <em>{project.render_approved ? "Runway 승인" : project.status}</em>
            </button>
          ))}
        </section>
      </div>

      {selected && <section className="panel creative-pro-timeline">
        <div className="timeline-head">
          <div><span className="eyebrow">STEP 2–4 · PROJECT</span><h2>{selected.title}</h2><p>이미지 {imageApproved}/{scenes.length} 통과 · 영상 {completed}/{scenes.length} 완료</p></div>
          <div className="timeline-actions quality-actions">
            <button onClick={() => prepareNext()} disabled={Boolean(busy) || imageApproved === scenes.length}>{busy === "image" ? "생성·검수 중..." : "다음 이미지 생성·검수"}</button>
            <button onClick={prepareAll} disabled={Boolean(busy) || imageApproved === scenes.length}>{busy === "images" ? "전체 검수 중..." : "전체 이미지 검수"}</button>
            <button className="approve" onClick={approveRunway} disabled={Boolean(busy) || imageApproved !== scenes.length || !contentApproved || Boolean(selected.render_approved)}>{selected.render_approved ? "Runway 승인됨" : busy === "approve" ? "승인 중..." : "Runway 비용 승인"}</button>
            <button onClick={() => generateNext()} disabled={Boolean(busy) || !selected.render_approved || completed === scenes.length}>{busy === "scene" ? "영상 생성 중..." : "다음 영상 생성"}</button>
            <button onClick={generateAll} disabled={Boolean(busy) || !selected.render_approved || completed === scenes.length}>{busy === "all" ? "전체 영상 생성 중..." : "남은 영상 모두 생성"}</button>
            <button className="render" onClick={render} disabled={Boolean(busy) || completed !== scenes.length}>{busy === "render" ? "요청 중..." : "최종 MP4 합성"}</button>
          </div>
        </div>

        <div className="dual-progress">
          <div><span><b>상품 이미지 품질검수</b><em>{imageProgress}%</em></span><div className="progress-track"><i style={{ width: `${imageProgress}%` }} /></div></div>
          <div><span><b>Runway 영상 제작</b><em>{videoProgress}%</em></span><div className="progress-track video"><i style={{ width: `${videoProgress}%` }} /></div></div>
        </div>
        {visualProfile && <div className="visual-profile-card">
          <div><span className="eyebrow">PRODUCT VISUAL DNA</span><b>{visualProfile.identitySummary || selected.product_name}</b></div>
          <strong>{visualProfile.referenceCoverageScore ?? "-"}점</strong>
          {Array.isArray(visualProfile.referenceGaps) && visualProfile.referenceGaps.length > 0 && <p>보완 자료: {visualProfile.referenceGaps.join(" · ")}</p>}
          {Array.isArray(visualProfile.forbiddenChanges) && visualProfile.forbiddenChanges.length > 0 && <p>변경 금지: {visualProfile.forbiddenChanges.join(" · ")}</p>}
        </div>}
        {qualityHolds > 0 && <p className="quality-hold-note">{qualityHolds}개 장면이 상품 일치도 기준에 미달해 보류되었습니다. Runway 비용은 사용되지 않았습니다.</p>}

        <section className="productization-center" id="shorts-source">
          <div className="productization-flow" aria-label="쇼핑 쇼츠 상품화 순서">
            <span className="done">1 · 상품 입력</span><i>→</i><span className={trendIntelligence ? "done" : ""}>2 · 상품화 준비</span><i>→</i><span className={selectedHookIndex !== null ? "done" : ""}>3 · 훅 선택</span><i>→</i><span className={contentApproved ? "done" : ""}>4 · 승인</span><i>→</i><span>5 · 게시</span>
          </div>
          <div className="productization-title">
            <div><span className="eyebrow">GY-NEXUS SHOPPING SHORTS CENTER</span><h3>중국 트렌드 참고·소재 권리·4개 플랫폼 상품화</h3><p>중국 영상은 구조만 참고하고, 최종본에는 직접 촬영·판매자/제휴센터 제공·사용 허가 소재만 넣습니다.</p></div>
            <div className="gy-product-code"><span>GY 진열장 상품번호</span><b>{selected.settings?.gyProductCode || "상품화 준비 후 생성"}</b></div>
          </div>

          <div className="rights-summary">
            <div><b>{usableMediaCount}</b><span>최종 사용 가능</span></div>
            <div><b>{inspirationMediaCount}</b><span>분석 참고 전용</span></div>
            <p>권리 미확인 자료는 저장할 수 있지만 ‘최종 영상 사용’이 자동 차단됩니다.</p>
          </div>

          <div className="production-stage-board" aria-label="영상 제작 기능 상태">
            <div className={mediaReferences.length ? "ready" : ""}><b>01</b><span>URL·소재 등록</span><small>{mediaReferences.length ? `${mediaReferences.length}개 등록` : "대기"}</small></div>
            <div className={mediaReferences.some((item) => item.analysis) ? "ready" : ""}><b>02</b><span>상품·키워드 분석</span><small>{mediaReferences.some((item) => item.analysis) ? "완료" : "대기"}</small></div>
            <div className={mediaReferences.some((item) => item.analysis?.sceneDecisions.length) ? "ready" : ""}><b>03</b><span>컷 유지·제거</span><small>AI 장면 감독</small></div>
            <div className={sourceMixPlan || trendIntelligence ? "ready" : ""}><b>04</b><span>영상 믹스 설계</span><small>{sourceMixPlan ? `${sourceMixPlan.cuts.length}컷 완료` : trendIntelligence ? "초안 완료" : "대기"}</small></div>
            <div className={commercePackage ? "ready" : ""}><b>05</b><span>대본·자막·썸네일</span><small>{commercePackage ? "완료" : "대기"}</small></div>
            <div className={selected.final_video_url ? "ready" : ""}><b>06</b><span>CapCut·MP4·게시</span><small>{selected.final_video_url ? "완료" : "대기"}</small></div>
          </div>

          <div className="china-source-library">
            <div className="china-source-library-head">
              <div><span className="eyebrow">GY SHORTS TREND FINDER</span><h4>한국어 입력 → 중국어로 자동 검색</h4><p>입력한 한국어를 AI가 중국어 간체 상품명과 키워드로 바꿔 도우인·샤오홍슈를 검색합니다. 인기 쇼츠가 없으면 관련 쇼츠로 자동 전환합니다.</p></div>
              <div className="china-connection-pills">
                <span className={chinaConnectionStatus?.douyin.configured ? "connected" : "manual"}>도우인 · {chinaConnectionStatus?.douyin.configured ? "공식 앱 키 준비" : "내부 공개검색"}</span>
                <span className={chinaConnectionStatus?.xiaohongshu.configured ? "connected" : "manual"}>샤오홍슈 · {chinaConnectionStatus?.xiaohongshu.configured ? "공식 앱 키 준비" : "내부 공개검색"}</span>
              </div>
            </div>
            <div className={`china-account-connector status-${chinaAccountConnectorStatus}`}>
              <div><b>Edge 로그인 계정 연결</b><span>{chinaAccountConnectorStatus === "connected" ? "연결됨 · 비밀번호와 쿠키는 Edge 밖으로 전송하지 않음" : chinaAccountConnectorStatus === "searching" ? "로그인 계정 검색 결과를 읽는 중" : chinaAccountConnectorStatus === "error" ? "로그인 또는 검색 화면 확인 필요" : chinaAccountConnectorStatus === "checking" ? "연결 도우미 확인 중" : "V2.3 Edge 계정 연결 도우미 설치 필요"}</span></div>
              <button type="button" onClick={() => requestChinaAccountSearch()} disabled={chinaAccountConnectorStatus !== "connected" || Boolean(busy)}>로그인 계정으로 다시 찾기</button>
            </div>
            <div className="china-source-search">
              <label><span>한국어 상품명 입력</span><input value={chinaSearchKeyword} onChange={(event) => setChinaSearchKeyword(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !busy) void searchChinaSources(); }} placeholder={selected.product_name || "예: 손선풍기, 싱크대 배수망"} /></label>
              <label><span>검색 플랫폼</span><select value={chinaSearchPlatform} onChange={(event) => setChinaSearchPlatform(event.target.value as ChinaSearchPlatform)}><option value="all">도우인 + 샤오홍슈</option><option value="douyin">도우인만</option><option value="xiaohongshu">샤오홍슈만</option></select></label>
              <button type="button" onClick={() => void searchChinaSources()} disabled={Boolean(busy)}>{busy === "china-search" ? "중국어로 번역·검색 중..." : "중국어로 자동 번역해 찾기"}</button>
            </div>
            <div className="china-search-fallback"><span>공개 웹 색인 결과가 부족할 때만 원문 검색을 보조로 사용</span><a href={`https://www.douyin.com/search/${encodeURIComponent(activeChinaKeyword)}`} target="_blank" rel="noreferrer">도우인 원문</a><a href={`https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(activeChinaKeyword)}`} target="_blank" rel="noreferrer">샤오홍슈 원문</a></div>

            {chinaKeywords.length > 0 && <section className="china-keyword-panel" aria-label="중국어 검색 키워드 후보">
              <div><b>중국어 상품명</b><strong>{translatedChinaProductName}</strong><span>키워드를 누르면 그 검색어로 쇼츠를 다시 찾습니다.</span></div>
              <div className="china-keyword-chips">{chinaKeywords.map((keyword) => <button key={`${keyword.simplifiedChinese}-${keyword.intent}`} type="button" disabled={Boolean(busy)} onClick={() => void searchChinaSources(keyword.simplifiedChinese)}><b>{keyword.simplifiedChinese}</b><small>{keyword.koreanMeaning}</small><em>{keyword.trendLabel}{keyword.evidenceCount > 0 ? ` · ${keyword.evidenceCount}회` : ""}</em></button>)}</div>
            </section>}

            {chinaSearchResults.length > 0 && <section className="china-search-results" aria-label="중국 플랫폼 공개 콘텐츠 검색 결과">
              <div className="china-search-results-head"><div><b>{chinaSearchResultMode === "popular" ? "중국어 인기 쇼츠" : "인기 결과가 없어 찾은 관련 쇼츠"} {chinaSearchResults.length}개</b><span>{chinaSearchResultMode === "popular" ? "확인 가능한 공개 인기 신호 우선" : "중국어 상품명·문제·사용 상황 관련성 우선"} · 장시간 영상 제외 · {selectedChinaResultIds.length}개 선택</span></div><div className="china-result-head-actions"><button type="button" className="secondary" onClick={importChinaSearchResults} disabled={Boolean(busy) || selectedChinaResultIds.length === 0}>{busy === "china-import" ? "저장 중..." : "소스함에만 저장"}</button><button type="button" onClick={() => void prepareSelectedShoppingShorts()} disabled={Boolean(busy) || selectedChinaResultIds.length === 0}>{busy === "shopping-pipeline" ? `AI 제작 준비 ${Math.max(1, shoppingPipelineStep)}/5` : `선택 ${selectedChinaResultIds.length}개로 AI 자동 제작`}</button></div></div>
              <div className="china-result-grid">{chinaSearchResults.map((item) => {
                const isSelected = selectedChinaResultIds.includes(item.id);
                return <article key={item.id} className={isSelected ? "selected" : ""}>
                  <button type="button" className="china-result-select" aria-pressed={isSelected} onClick={() => toggleChinaSearchResult(item.id)}>
                    <div className="china-result-thumb">
                      {item.thumbnailUrl
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={item.thumbnailUrl} alt="" loading="lazy" />
                        : <span>{item.platform === "douyin" ? "抖音" : "小红书"}</span>}
                      <i>{isSelected ? "✓ 선택됨" : "+ 선택"}</i>
                      <div className="china-result-signals"><span>{item.durationSeconds ? `${item.durationSeconds}초` : "쇼츠 후보"}</span><span>{item.popularityLabel}</span></div>
                    </div>
                    <em>{item.platform === "douyin" ? "도우인" : "샤오홍슈"}{item.sourceMode === "browser-account" ? " · 로그인 계정" : " · 공개검색"}</em>
                    <b>{item.title}</b>
                    <small>{item.durationSeconds ? "60초 이하 확인" : "길이 공개값 없음"} · {chinaSearchResultMode === "popular" ? "인기 신호 우선" : "관련성 우선"}</small>
                  </button>
                  <div className="china-result-actions"><button type="button" onClick={() => void openChinaPreview(item)}>▶ 영상 재생</button><a href={item.url} target="_blank" rel="noreferrer">원문 열기 ↗</a></div>
                </article>;
              })}</div>
            </section>}

            {chinaSearchResults.length > 0 && <section className="shopping-ai-cockpit" aria-label="AI 쇼핑 쇼츠 자동 제작 설정">
              <div className="shopping-ai-cockpit-head"><div><span>VIDEO FLOW MATCH</span><b>선택 영상 → AI 컷 → 한국어 자막·음성 → 썸네일·게시정보</b><p>영상에서 본 제작 흐름을 한 버튼으로 준비합니다. 최종 원본 컷은 권리를 확인한 파일만 사용합니다.</p></div><strong>{selected.duration_seconds}초</strong></div>
              <div className="shopping-editor-settings">
                <div><span>편집 속도</span><div>{([1, 1.2, 1.4] as const).map((speed) => <button type="button" key={speed} className={editorPreferences.playbackSpeed === speed ? "selected" : ""} onClick={() => setEditorPreferences((current) => ({ ...current, playbackSpeed: speed }))}>{speed.toFixed(1)}x</button>)}</div></div>
                <label><span>중국어 화면 자막</span><select value={editorPreferences.subtitleCleanupMode} onChange={(event) => setEditorPreferences((current) => ({ ...current, subtitleCleanupMode: event.target.value as typeof current.subtitleCleanupMode }))}><option value="recreate-clean">AI 새 장면으로 깨끗하게 재제작</option><option value="safe-bottom-crop">허가 영상 하단 안전 크롭</option><option value="keep-licensed">허가 영상 원문 유지</option></select></label>
                <label><span>원본 음성</span><select value={editorPreferences.sourceAudioMode} onChange={(event) => setEditorPreferences((current) => ({ ...current, sourceAudioMode: event.target.value as typeof current.sourceAudioMode }))}><option value="mute-korean-tts">원음 제거＋한국어 AI 음성</option><option value="mute">원음 제거＋무음</option></select></label>
              </div>
              <div className="shopping-pipeline-progress">{["소스 저장", "편집 설정", "AI 컷 설계", "대본·썸네일", "검수 준비"].map((label, index) => <span key={label} className={shoppingPipelineStep > index ? "done" : busy === "shopping-pipeline" && shoppingPipelineStep === index + 1 ? "active" : ""}><i>{shoppingPipelineStep > index ? "✓" : index + 1}</i>{label}</span>)}</div>
              <button type="button" className="shopping-pipeline-button" onClick={() => void prepareSelectedShoppingShorts()} disabled={Boolean(busy) || selectedChinaResultIds.length === 0}>{busy === "shopping-pipeline" ? `자동 제작 준비 중 · ${Math.max(1, shoppingPipelineStep)}/5` : `선택 ${selectedChinaResultIds.length}개로 쇼핑 쇼츠 자동 제작 준비`}</button>
            </section>}

            <p className="china-source-rule">한국어는 검색 입력으로만 사용하고, 실제 플랫폼 검색은 AI가 만든 중국어 간체 상품명과 키워드로 실행합니다. 공개 좋아요 등 인기 근거가 없으면 `인기`라고 표시하지 않고 관련 쇼츠로 자동 전환합니다. 선택 카드는 구조 분석용이며 최종 영상에는 권리를 확인한 파일만 들어갑니다.</p>
          </div>

          <div className="media-reference-form">
            <label>플랫폼<select value={mediaDraft.platform} onChange={(event) => setMediaDraft((current) => ({ ...current, platform: event.target.value as MediaReference["platform"] }))}><option value="douyin">도우인</option><option value="xiaohongshu">샤오홍슈</option><option value="coupang">쿠팡</option><option value="temu">Temu</option><option value="owned">직접 보유</option><option value="other">기타</option></select></label>
            <label>참고 영상·소재 HTTPS 주소<input value={mediaDraft.url} onChange={(event) => setMediaDraft((current) => ({ ...current, url: event.target.value }))} placeholder="도우인·샤오홍슈·판매자 제공 URL" /></label>
            <label>자료 이름<input value={mediaDraft.title} onChange={(event) => setMediaDraft((current) => ({ ...current, title: event.target.value }))} placeholder="예: 수납 전후 훅 참고" /></label>
            <label>권리 상태<select value={mediaDraft.rightsStatus} onChange={(event) => {
              const rightsStatus = event.target.value as RightsStatus;
              setMediaDraft((current) => ({ ...current, rightsStatus, useInFinal: rightsStatus === "unverified" ? false : current.useInFinal }));
            }}>{Object.entries(rightsLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="wide">분석 메모<input value={mediaDraft.notes} onChange={(event) => setMediaDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="예: 첫 2초 문제 제시, 손 클로즈업, 전후 비교 리듬만 참고" /></label>
            <label className="licensed-video-upload wide">
              <span>사용 허가 영상 파일 · 선택사항</span>
              <small>직접 촬영·판매자 제공·제휴센터 제공·사용 허가 자료만 업로드하세요. MP4/WEBM/MOV, 최대 500MB</small>
              <input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(event) => selectMediaVideo(event.target.files)} />
              {mediaVideoFile && <b>{mediaVideoFile.name} · {(mediaVideoFile.size / 1024 / 1024).toFixed(1)}MB</b>}
            </label>
            <label className="media-final-check"><input type="checkbox" checked={mediaDraft.useInFinal} disabled={mediaDraft.rightsStatus === "unverified" || !mediaVideoFile} onChange={(event) => setMediaDraft((current) => ({ ...current, useInFinal: event.target.checked }))} /><span>업로드 허가 영상을 최종본에 사용</span></label>
            <label className="analysis-frame-upload wide">
              <span>AI 장면 분석 프레임 · 최대 8장</span>
              <small>영상에서 핵심 장면을 캡처해 올리면 상품·훅·불필요 컷·새 믹스 순서를 분석합니다. 보호된 영상을 서버가 임의 다운로드하지 않습니다.</small>
              <input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(event) => selectAnalysisFrames(event.target.files)} />
            </label>
            <button type="button" onClick={addMediaReference} disabled={Boolean(busy)}>{busy === "reference-video" ? "영상 업로드 중..." : busy === "reference" ? "프레임 업로드 중..." : "소재 추가"}</button>
          </div>

          {analysisPreviewUrls.length > 0 && <div className="analysis-frame-preview">{analysisPreviewUrls.map((url, index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <div key={url}><img src={url} alt={`분석 프레임 ${index + 1}`} /><span>{index + 1}</span></div>
          ))}</div>}

          {mediaReferences.length > 0 && <div className="media-reference-list">{mediaReferences.map((item) => <article key={item.id} className={item.rightsStatus === "unverified" ? "unverified" : "verified"}>
            <div className="media-reference-row">
              <div className="media-reference-thumb">{item.assetKind === "video-file"
                ? <video className="media-reference-video" src={item.url} muted controls preload="metadata" />
                : item.analysisFrameUrls?.[0]
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={item.analysisFrameUrls[0]} alt="참고 쇼츠 프레임" />
                  : <span>{item.platform === "douyin" ? "抖音" : item.platform === "xiaohongshu" ? "小红书" : "LINK"}</span>}</div>
              <div className="media-reference-name"><b>{item.title || item.platform}</b><a href={item.url} target="_blank" rel="noreferrer">{item.assetKind === "video-file" ? "허가 영상 열기" : "원본 페이지 확인"}</a><small>{item.assetKind === "video-file" ? "업로드 영상 파일" : "참고 페이지 링크"} · {item.notes || "메모 없음"}</small></div>
              <select aria-label="소재 권리 상태" value={item.rightsStatus} onChange={(event) => {
                const rightsStatus = event.target.value as RightsStatus;
                setMediaReferences((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, rightsStatus, useInFinal: rightsStatus === "unverified" ? false : candidate.useInFinal } : candidate));
              }}>{Object.entries(rightsLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              <label><input type="checkbox" checked={item.includeInMixAnalysis} onChange={(event) => setMediaReferences((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, includeInMixAnalysis: event.target.checked } : candidate))} />AI 믹스 선택</label>
              <label><input type="checkbox" checked={item.useInFinal} disabled={item.rightsStatus === "unverified" || item.assetKind !== "video-file"} onChange={(event) => setMediaReferences((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, useInFinal: event.target.checked } : candidate))} />최종 사용</label>
              <button className="analyze-reference-button" type="button" disabled={Boolean(busy)} onClick={() => analyzeReference(item.id)}>{busy === "reference-analysis" ? "분석 중..." : item.analysis ? "AI 재분석" : "AI 장면 분석"}</button>
              <button className="delete-reference-button" type="button" disabled={Boolean(busy)} onClick={() => setMediaReferences((current) => current.filter((candidate) => candidate.id !== item.id))}>삭제</button>
            </div>

            {(item.analysisFrameUrls || []).length > 0 && <div className="saved-analysis-frames">{(item.analysisFrameUrls || []).map((url, index) => (
              // eslint-disable-next-line @next/next/no-img-element
              <div key={`${item.id}-${url}`}><img src={url} alt={`${item.title || "소재"} 프레임 ${index + 1}`} /><span>{index + 1}</span></div>
            ))}</div>}

            {item.analysis && <details className="reference-analysis-result" open={expandedReferenceId === item.id} onToggle={(event) => {
              const isOpen = event.currentTarget.open;
              if (isOpen) setExpandedReferenceId(item.id);
              else setExpandedReferenceId((current) => current === item.id ? null : current);
            }}>
              <summary><span>AI 분석 완료</span><b>{item.analysis.productName}</b><small>키워드·훅·컷 판단·믹스 구성 보기</small></summary>
              <div className="reference-analysis-body">
                <p className="analysis-summary">{item.analysis.sourceSummary}</p>
                <div className="analysis-column-grid">
                  <section><h4>검색 키워드 선택</h4><div className="analysis-keywords">{item.analysis.keywordCandidates.map((keyword) => {
                    const active = (item.selectedKeywords || []).includes(keyword.keyword);
                    return <button key={`${keyword.language}-${keyword.keyword}`} type="button" className={active ? "selected" : ""} onClick={() => toggleReferenceKeyword(item.id, keyword.keyword)} title={keyword.reason}><span>{keyword.language === "zh-CN" ? "中文" : "KR"}</span>{keyword.keyword}</button>;
                  })}</div><small>선택한 키워드는 통합 상품화 대본과 탐색 설계에 반영됩니다.</small></section>
                  <section><h4>훅·판매 포인트</h4><ul>{item.analysis.hookPatterns.map((hook) => <li key={hook}>{hook}</li>)}</ul><div className="sales-point-list">{item.analysis.salesPoints.map((point) => <span key={point}>{point}</span>)}</div></section>
                </div>
                <section className="scene-decision-section"><h4>장면별 유지·제거·새로 제작</h4><div className="scene-decision-grid">{item.analysis.sceneDecisions.map((decision) => <div key={`${decision.frameIndex}-${decision.role}`} className={`decision-${decision.decision}`}><b>프레임 {decision.frameIndex}</b><em>{decision.decision === "keep" ? "유지 후보" : decision.decision === "remove" ? "제거" : "새로 제작"}</em><span>{decision.suggestedDurationSeconds}초 · {decision.role}</span><p>{decision.reason}</p></div>)}</div></section>
                <section className="mix-plan-section"><h4>15~30초 영상 믹스 순서</h4><ol>{item.analysis.mixPlan.map((shot) => <li key={`${shot.order}-${shot.role}`}><b>{shot.order}. {shot.role}</b><em>{shot.durationSeconds}초 · {shot.source === "uploaded-photo" ? "업로드 사진" : shot.source === "licensed-video" ? "허가 영상" : "새 AI 장면"}</em><p>{shot.direction}</p></li>)}</ol></section>
                <p className="copyright-safety-note"><b>권리 안전:</b> {item.analysis.copyrightSafety}</p>
              </div>
            </details>}
          </article>)}</div>}

          <div className="productization-primary-actions">
            <button type="button" onClick={saveMediaReferences} disabled={Boolean(busy)}>{busy === "media" ? "권리 상태 저장 중..." : "권리 목록 저장"}</button>
            <button type="button" className="source-mix-button" onClick={generateSourceMix} disabled={Boolean(busy) || !mediaReferences.some((item) => item.includeInMixAnalysis)}>{busy === "source-mix" ? "AI 믹스 설계 중..." : "선택 소스로 AI 짜집기 설계"}</button>
            {trendIntelligence && commercePackage && <button type="button" onClick={() => prepareProductization(true)} disabled={Boolean(busy)}>전체 AI 결과 다시 생성</button>}
            <button type="button" className="primary" onClick={() => prepareProductization(false)} disabled={Boolean(busy)}>{busy === "productization" ? "병렬 생성 중..." : trendIntelligence && commercePackage ? "빠르게 최신 결과 확인" : "쇼핑 쇼츠 상품화 준비"}</button>
          </div>

          {sourceMixPlan && <section className="selected-source-mix" id="shorts-ai-editor">
            <div className="selected-source-mix-head"><div><span className="eyebrow">AI SELECTED SOURCE MIX</span><h4>{sourceMixPlan.title}</h4><p>대표님이 고른 {sourceMixPlan.selectedReferenceIds.length}개 소스 → {sourceMixPlan.cuts.length}개 컷 · 총 {sourceMixPlan.totalDurationSeconds}초</p></div><button type="button" onClick={generateSourceMix} disabled={Boolean(busy)}>믹스 다시 설계</button></div>
            <div className="selected-source-timeline">{sourceMixPlan.cuts.map((cut) => {
              const reference = mediaReferences.find((item) => item.id === cut.referenceId);
              return <article key={`${cut.order}-${cut.startSecond}`} className={`mix-${cut.decision}`}>
                <b>{cut.order}</b><span>{cut.startSecond.toFixed(1)}–{(cut.startSecond + cut.durationSeconds).toFixed(1)}초</span>
                <em>{cut.decision === "use-licensed" ? "허가 원본 사용" : cut.decision === "recreate" ? "새로 촬영·생성" : "새 AI 장면"}</em>
                <h5>{cut.role}</h5><p>{cut.direction}</p><small>{reference ? `${reference.platform} · ${reference.title || "선택 소스"}` : "상품 사진 기반 새 장면"}{cut.frameIndex ? ` · 프레임 ${cut.frameIndex}` : ""}</small><i>{cut.subtitleIntent}</i>
              </article>;
            })}</div>
            <p className="source-mix-safety"><b>권리·품질 규칙:</b> {sourceMixPlan.safetySummary}</p>
          </section>}

          {trendIntelligence && <div className="trend-intelligence-grid" id={sourceMixPlan ? undefined : "shorts-ai-editor"}>
            <article><span>중국어 탐색 키워드</span><div className="keyword-chip-list">{trendIntelligence.chineseKeywords.map((keyword) => <div key={keyword.simplifiedChinese}><b>{keyword.simplifiedChinese}</b><small>{keyword.koreanMeaning} · {keyword.searchIntent}</small></div>)}</div></article>
            <article><span>도우인·샤오홍슈 바로 찾기</span><div className="discovery-link-list">{trendIntelligence.discoveryLinks.map((link) => <a key={`${link.platform}-${link.keyword}`} href={link.url} target="_blank" rel="noreferrer"><b>{link.platform === "douyin" ? "도우인" : "샤오홍슈"}</b><small>{link.keyword}</small></a>)}</div><p>{trendIntelligence.referenceRule}</p></article>
            <article className="shot-plan"><span>AI 장면 감독 · 새로 설계한 컷</span><ol>{trendIntelligence.originalShotPlan.map((shot) => <li key={`${shot.order}-${shot.role}`}><b>{shot.order}. {shot.role}</b><em>{shot.durationSeconds}초 · {shot.assetType}</em><p>{shot.camera} · {shot.direction}</p></li>)}</ol></article>
          </div>}
        </section>

        <section className="commerce-package-panel" id="shorts-voice">
          <div className="commerce-package-head">
            <div><span className="eyebrow">ONE IMAGE → SALES PACKAGE</span><h3>한국형 대본·음성·썸네일·게시정보</h3><p>사진을 다시 올릴 필요 없이 이 프로젝트의 상품 사실자료로 판매 패키지를 만듭니다.</p></div>
            <div className="commerce-package-actions">
              <button onClick={generatePackage} disabled={Boolean(busy)}>{busy === "package" ? "대본·메타데이터 생성 중..." : commercePackage ? "판매 패키지 다시 생성" : "판매 패키지 생성"}</button>
              <button onClick={generateVoice} disabled={Boolean(busy) || !commercePackage || !contentApproved}>{busy === "voice" ? "한국어 음성 생성 중..." : contentApproved ? "AI 음성 만들기" : "훅 승인 후 음성 생성"}</button>
            </div>
          </div>
          {commercePackage ? <div className="commerce-package-grid">
            <article className="commerce-copy-card">
              <span>추천 제목</span><h4>{commercePackage.title}</h4>
              <b>첫 3초 훅 3개 · 하나 선택</b>
              <div className="hook-choice-list">{commercePackage.hookOptions.map((hook, index) => <button type="button" className={selectedHookIndex === index ? "selected" : ""} key={hook} onClick={() => setSelectedHookIndex(index)}><span>{index + 1}</span>{hook}</button>)}</div>
              <b>{contentApproved ? "선택 훅이 반영된 완성 대본" : "훅 선택 전 본문 대본"}</b><p>{commercePackage.voiceover}</p>
              <b>CTA</b><p>{commercePackage.cta}</p>
              <div className="content-approval-box"><b>대표 품질 승인</b><small>저작권 · 상품 일치 · 허위 표현 · 자막 · 첫 3초 훅</small><button type="button" onClick={approveContent} disabled={Boolean(busy) || selectedHookIndex === null || contentApproved}>{contentApproved ? "콘텐츠 승인 완료" : busy === "content-approval" ? "승인 검사 중..." : "선택한 훅으로 승인"}</button></div>
            </article>
            <article className="commerce-thumbnail-card" id="shorts-thumbnail">
              <span>정확한 글자로 만드는 썸네일 3안</span>
              <div className="thumbnail-option-list">{commercePackage.thumbnailOptions.map((thumbnail, index) => <div key={`${thumbnail.headline}-${index}`} className={`thumbnail-option ${thumbnail.layout}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {productPreviewUrl && <img src={productPreviewUrl} alt="상품 썸네일 참고" />}
                <div><strong>{thumbnail.headline}</strong><em>{thumbnail.accent}</em></div>
                {thumbnail.layout === "benefit-arrow" && <i>➜</i>}
                <a href={`/api/creative-studio-pro/projects/${selected.id}/export?format=thumbnail&index=${index}`}>SVG 저장</a>
              </div>)}</div>
            </article>
            <article className="commerce-meta-card">
              <span>게시 설명·태그</span><p>{commercePackage.description}</p>
              <div className="commerce-tags">{commercePackage.hashtags.map((tag) => <em key={tag}>{tag}</em>)}</div>
              <b>제휴 고지</b><p>{commercePackage.disclosure}</p>
              {commercePackage.verifiedClaims.length > 0 && <><b>확인된 표현</b><ul>{commercePackage.verifiedClaims.map((claim) => <li key={claim}>{claim}</li>)}</ul></>}
              {commercePackage.cautions.length > 0 && <><b>게시 전 확인</b><ul>{commercePackage.cautions.map((caution) => <li key={caution}>{caution}</li>)}</ul></>}
              {commercePackage.qualityAudit && <div className={commercePackage.qualityAudit.approved ? "commerce-audit pass" : "commerce-audit fail"}><b>독립 광고 검수 · {commercePackage.qualityAudit.score}점</b><p>{commercePackage.qualityAudit.summary}</p>{commercePackage.qualityAudit.issues.length > 0 && <ul>{commercePackage.qualityAudit.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>}</div>}
            </article>
            <article className="platform-package-card">
              <span>플랫폼별 판매 패키지</span>
              <details open><summary>YouTube Shorts</summary><b>{commercePackage.platformVersions.youtube.title}</b><p>{commercePackage.platformVersions.youtube.description}</p></details>
              <details><summary>Instagram Reels</summary><p>{commercePackage.platformVersions.instagram.caption}</p></details>
              <details><summary>Douyin · 중국어 간체</summary><b>{commercePackage.platformVersions.douyin.title}</b><p>{commercePackage.platformVersions.douyin.scriptSimplifiedChinese}</p></details>
              <details><summary>샤오홍슈 사진 노트 {commercePackage.platformVersions.xiaohongshu.cards.length}장</summary><b>{commercePackage.platformVersions.xiaohongshu.title}</b><ol>{commercePackage.platformVersions.xiaohongshu.cards.map((card) => <li key={card.order}><b>{card.order}. {card.headline}</b><p>{card.body}</p><small>{card.visualDirection}</small></li>)}</ol></details>
            </article>
          </div> : <p className="empty-commerce-package">`판매 패키지 생성`을 누르면 영상 속 기능처럼 훅·대본·썸네일·설명·태그가 한 번에 만들어집니다.</p>}
          {selected.settings?.voiceAudioUrl && <div className="voice-preview"><b>AI 한국어 음성 · {selected.settings.voiceName || "기본 음성"}</b><audio src={selected.settings.voiceAudioUrl} controls /></div>}
        </section>

        <div className="export-bar" id="shorts-export"><div><b>CapCut·게시 편집 자료</b><span>정확한 자막, 컷 유지·제거, 믹스 순서, 음성·BGM·썸네일·판매 문구를 내려받습니다.</span></div><a href={`/api/creative-studio-pro/projects/${selected.id}/export?format=srt`}>SRT 자막</a><a href={`/api/creative-studio-pro/projects/${selected.id}/export?format=guide`}>CapCut 안내서</a><a href={`/api/creative-studio-pro/projects/${selected.id}/export?format=capcut`}>CapCut 편집 JSON</a><a href={`/api/creative-studio-pro/projects/${selected.id}/export?format=package`}>게시 패키지</a></div>

        <div className="scene-grid quality-scene-grid">{scenes.map((scene) => {
          const report = scene.quality_report;
          return <article key={scene.id} className={`scene-card ${scene.status} quality-${scene.quality_status || "pending"}`}>
            <div className="scene-number">{scene.scene_number}</div>
            <div className="scene-body">
              <div className="scene-heading"><b>{scene.start_second}–{scene.end_second}초 · {scene.role}</b><span className={`quality-chip ${scene.quality_status || "pending"}`}>{qualityLabels[scene.quality_status || "pending"] || scene.quality_status}</span></div>
              <p className="exact-subtitle">{scene.subtitle_text || "자막 없음"}</p>
              {scene.selected_image_url && <div className="selected-scene-image">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={scene.selected_image_url} alt={`장면 ${scene.scene_number} 최종 이미지`} />
                <span>{scene.quality_score ?? report?.score ?? "-"}점 · 최종본</span>
              </div>}
              {!scene.selected_image_url && Array.isArray(scene.image_candidates) && scene.image_candidates.length > 0 && <div className="candidate-strip">{scene.image_candidates.map((candidate) => (
                <div key={`${scene.id}-${candidate.index}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={candidate.assetUrl} alt={`장면 ${scene.scene_number} 후보 ${candidate.index + 1}`} />
                  <small>{candidate.score ?? "-"}점</small>
                </div>
              ))}</div>}
              {report?.metrics && <div className="quality-metrics"><span>상품 {report.metrics.productMatch}</span><span>전체 무결성 {report.metrics.visualIntegrity}</span><span>형태·버튼 {report.metrics.geometryDetail ?? "-"}</span><span>색상·재질 {report.metrics.colorMaterial ?? "-"}</span><span>로고·글자 {report.metrics.textLogoIntegrity ?? "-"}</span><span>손·신체 {report.metrics.humanAnatomy ?? "-"}</span><span>장면 연속성 {report.metrics.sceneContinuity ?? "-"}</span><span>영상 안정성 {report.metrics.motionReadiness ?? "-"}</span><span>자연스러움 {report.metrics.commercialNaturalness}</span><span>구도 {report.metrics.composition}</span><span>과장검수 {report.metrics.claimSafety}</span></div>}
              {Array.isArray(report?.criticalErrors) && report.criticalErrors.length > 0 && <p className="critical-error">치명적 오류: {report.criticalErrors.join(" · ")}</p>}
              {report?.summary && <p className="quality-summary">{report.summary}</p>}
              {Array.isArray(report?.issues) && report.issues.length > 0 && <ul className="quality-issues">{report.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>}
              <details><summary>장면 프롬프트·내레이션</summary><small>{scene.prompt}</small><small>{scene.narration}</small></details>
              {scene.error_message && <p className="error-text">{scene.error_message}</p>}
              {scene.video_url && <video src={scene.video_url} controls playsInline />}
            </div>
            <span className="scene-status">{scene.status}</span>
          </article>;
        })}</div>

        {selected.final_video_url && <div className="final-preview"><h3>최종 완성 영상</h3><video src={selected.final_video_url} controls playsInline /><div className="final-publish-actions"><a className="button button-primary" href={selected.final_video_url} target="_blank" rel="noreferrer">원본 열기</a><button className="button button-primary" type="button" onClick={queueYouTube} disabled={Boolean(busy) || !contentApproved || !commercePackage}>{busy === "publish" ? "대기열 등록 중..." : "YouTube 비공개 게시 대기열"}</button><a className="button button-light" href="/admin/publishing">통합 게시센터 열기</a></div></div>}
      </section>}

      {chinaPreview && <div className="china-preview-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setChinaPreview(null); }}>
        <section className="china-preview-modal" role="dialog" aria-modal="true" aria-label="중국 쇼츠 영상 미리보기">
          <div className="china-preview-head"><div><span>{chinaPreview.item.platform === "douyin" ? "DOUYIN" : "XIAOHONGSHU"} PREVIEW</span><b>{chinaPreview.item.title}</b></div><button type="button" onClick={() => setChinaPreview(null)} aria-label="미리보기 닫기">×</button></div>
          <div className="china-preview-player">
            {chinaPreview.loading && <div className="china-preview-loading"><i>▶</i><b>공식 재생 방법 확인 중</b></div>}
            {!chinaPreview.loading && chinaPreview.mode === "official-embed" && chinaPreview.embedUrl && <iframe src={chinaPreview.embedUrl} title={chinaPreview.item.title} allow="autoplay; fullscreen" allowFullScreen referrerPolicy="unsafe-url" />}
            {!chinaPreview.loading && chinaPreview.mode !== "official-embed" && <div className="china-preview-fallback">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {chinaPreview.item.thumbnailUrl ? <img src={chinaPreview.item.thumbnailUrl} alt="" /> : <span>{chinaPreview.item.platform === "douyin" ? "抖音" : "小红书"}</span>}
              <div><b>로그인된 Edge 원문 플레이어에서 재생</b><p>{chinaPreview.message}</p><a href={chinaPreview.item.url} target="_blank" rel="noreferrer">▶ 지금 영상 재생</a></div>
            </div>}
          </div>
          <div className="china-preview-foot"><p>{chinaPreview.message}</p><button type="button" className={selectedChinaResultIds.includes(chinaPreview.item.id) ? "selected" : ""} onClick={() => toggleChinaSearchResult(chinaPreview.item.id)}>{selectedChinaResultIds.includes(chinaPreview.item.id) ? "✓ AI 믹스 선택됨" : "+ 이 영상을 AI 믹스에 선택"}</button></div>
        </section>
      </div>}
    </div>
  );
}
