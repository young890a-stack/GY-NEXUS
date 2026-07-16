import type { PlannedScene, ProProjectInput, ProStyle } from "./types";

const styleDirection: Record<ProStyle, string> = {
  "cinematic-product": "영화 같은 조명, 빠른 클로즈업, 고급 제품 광고, 자연스러운 카메라 이동",
  "emotional-brand": "따뜻한 감성, 부드러운 빛, 여유 있는 움직임, 브랜드 신뢰와 공감",
  "how-to": "사용법이 명확히 보이는 손 동작, 단계별 시연, 깨끗한 배경, 현실적인 속도",
  "ugc-review": "스마트폰으로 촬영한 듯 자연스러운 후기형 UGC, 실제 생활 공간, 진솔한 반응",
  "problem-solution": "불편한 문제 상황에서 시작해 제품으로 해결되는 전후 변화, 명확한 대비",
};

const roles = ["강한 훅", "문제 또는 필요 상황", "제품 등장", "핵심 장점", "실사용 장면", "신뢰 형성", "자연스러운 마무리"];

export function planScenes(input: ProProjectInput): PlannedScene[] {
  const count = input.duration / 5;
  const product = input.productName.trim() || input.title.trim();
  const description = input.productDescription.trim() || "제품의 핵심 장점과 실제 사용 가치";
  const master = input.masterPrompt.trim();

  return Array.from({ length: count }, (_, index) => {
    const sceneNumber = index + 1;
    const startSecond = index * 5;
    const endSecond = startSecond + 5;
    const role = index === count - 1 ? "자연스러운 마무리" : roles[Math.min(index, roles.length - 2)];
    const subtitle = buildSubtitle(role, product, sceneNumber, count);
    return {
      sceneNumber,
      startSecond,
      endSecond,
      duration: 5,
      role,
      narration: input.voiceMode === "silent" || input.voiceMode === "music-only" ? "" : subtitle,
      subtitle: input.subtitleMode === "none" ? "" : subtitle,
      prompt: [
        `${input.ratio === "720:1280" ? "세로형 9:16" : "가로형 16:9"} 영상의 ${sceneNumber}번째 장면.`,
        `역할: ${role}.`,
        `제품: ${product}.`,
        `제품 정보: ${description}.`,
        `연출: ${styleDirection[input.style]}.`,
        master ? `추가 지시: ${master}.` : "",
        "한 장면 안에서 하나의 행동만 명확히 보여주고, 화면 안에 글자나 로고를 새로 만들지 않는다.",
        "사람의 손과 제품 형태가 자연스럽고, 과장 광고 없이 실제 촬영처럼 표현한다.",
      ].filter(Boolean).join(" "),
    };
  });
}

function buildSubtitle(role: string, product: string, sceneNumber: number, total: number) {
  if (sceneNumber === 1) return `이 불편함, ${product} 하나로 달라집니다.`;
  if (sceneNumber === total) return `${product}, 필요한 순간에 직접 확인해보세요.`;
  if (role.includes("문제")) return "매번 반복되는 불편함, 그냥 넘기고 있지 않나요?";
  if (role.includes("제품 등장")) return `${product}가 해결 과정을 간단하게 바꿉니다.`;
  if (role.includes("핵심")) return "복잡하지 않고, 필요한 기능에 집중했습니다.";
  if (role.includes("실사용")) return "일상에서 바로 써보면 차이가 더 분명합니다.";
  return "부담 없는 사용감과 실용성을 함께 확인하세요.";
}
