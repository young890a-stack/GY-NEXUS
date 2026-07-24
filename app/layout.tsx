import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://gy-nexus-zfpq.vercel.app"),
  title: {
    default: "쇼핑 쇼츠·상품 광고 영상 제작 | GY Labs",
    template: "%s | GY Labs",
  },
  description:
    "상품 분석부터 15~30초 쇼핑 쇼츠, 광고 영상, 한국어 자막, 썸네일과 판매 문구까지 한 흐름으로 제작하는 GY Labs입니다.",
  applicationName: "GY",
  keywords: [
    "쇼핑 쇼츠 제작",
    "상품 광고 영상",
    "유튜브 쇼츠 제작",
    "인스타 릴스 제작",
    "영상 광고 대행",
  ],
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "GY Labs",
    title: "쇼핑 쇼츠·상품 광고 영상 제작 | GY Labs",
    description:
      "보기 좋은 영상보다, 상품이 팔리는 영상을 만듭니다. 기획·자막·썸네일·판매 문구를 한 번에.",
  },
  twitter: {
    card: "summary",
    title: "쇼핑 쇼츠·상품 광고 영상 제작 | GY Labs",
    description:
      "기획부터 자막, 썸네일, 판매 문구까지 연결하는 쇼핑 영상 제작 스튜디오.",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "GY", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#07111f",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
