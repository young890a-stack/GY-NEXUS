import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "GY — Create better. Grow with clarity.", template: "%s | GY" },
  description: "GY는 상품 발굴, 콘텐츠 제작, 품질 검수, 게시와 성장 분석을 하나의 경험으로 연결하는 AI Content & Commerce Platform입니다.",
  applicationName: "GY",
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
