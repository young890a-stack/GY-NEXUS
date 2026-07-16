export type AssistantAction = {
  id: string;
  label: string;
  description: string;
  href: string;
  risk: "safe" | "approval";
};

const tools: AssistantAction[] = [
  { id: "analyze-product", label: "상품 URL 분석", description: "상품 링크에서 제목·가격·특징과 판매 포인트를 정리합니다.", href: "/admin/import", risk: "safe" },
  { id: "create-content", label: "콘텐츠 패키지 생성", description: "Blogger 글, 네이버용 글, 쇼츠 대본과 게시 문구를 생성합니다.", href: "/admin/content", risk: "safe" },
  { id: "create-media", label: "이미지·영상 제작 준비", description: "15~30초 구성과 정확한 한국어 자막 원고를 준비합니다.", href: "/admin/content", risk: "safe" },
  { id: "publish-youtube", label: "YouTube 업로드", description: "완성된 MP4를 제목·설명·제휴 링크와 함께 업로드합니다.", href: "/admin/youtube", risk: "approval" },
  { id: "publish-blogger", label: "Blogger 게시", description: "연결된 Blogger 블로그에 초안 또는 공개 글을 게시합니다.", href: "/admin/publishing", risk: "approval" },
  { id: "schedule", label: "예약 작업", description: "콘텐츠 게시 일정을 등록하고 실행 상태를 추적합니다.", href: "/admin/schedules", risk: "approval" },
];

export function selectAssistantActions(command: string): AssistantAction[] {
  const normalized = command.toLowerCase();
  const picked = tools.filter((tool) => {
    if (tool.id === "analyze-product") return /링크|상품|temu|테무|쿠팡/.test(normalized);
    if (tool.id === "create-content") return /글|블로그|콘텐츠|대본|쇼츠|seo/.test(normalized);
    if (tool.id === "create-media") return /영상|이미지|썸네일|자막/.test(normalized);
    if (tool.id === "publish-youtube") return /유튜브|youtube|업로드/.test(normalized);
    if (tool.id === "publish-blogger") return /블로거|blogger|블로그스팟|게시/.test(normalized);
    if (tool.id === "schedule") return /예약|내일|오늘|시간|스케줄/.test(normalized);
    return false;
  });
  return picked.length ? picked : tools.slice(0, 3);
}
