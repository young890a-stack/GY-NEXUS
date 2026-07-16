import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "GY Company OS", template: "%s | GY" },
  description: "상품, 콘텐츠, 품질, 게시와 성장을 하나의 흐름으로 연결하는 GY 운영 플랫폼.",
  applicationName: "GY Company OS",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "GY Company OS", statusBarStyle: "black-translucent" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#111936" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
