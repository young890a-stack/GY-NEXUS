import MediaRetentionManager from "@/components/admin/MediaRetentionManager";

export const dynamic = "force-dynamic";

export default function MediaLibraryPage() {
  return (
    <section className="section">
      <div className="admin-top"><div><span className="eyebrow">STORAGE CARE</span><h1>사진·영상 보관 관리</h1><p>오래된 제작 파일의 용량을 먼저 확인하고, 대표 승인 후 안전하게 정리합니다.</p></div></div>
      <div className="grid grid-3" style={{ marginBottom: 20 }}>
        <article className="panel"><h2>안전 범위</h2><p>images·videos·references의 날짜 폴더만 검사합니다.</p></article>
        <article className="panel"><h2>기본 보관</h2><p>기본 90일이며 30일에서 2년까지 선택할 수 있습니다.</p></article>
        <article className="panel"><h2>삭제 방식</h2><p>미리보기와 최종 확인 없이는 어떤 파일도 삭제하지 않습니다.</p></article>
      </div>
      <MediaRetentionManager />
    </section>
  );
}

