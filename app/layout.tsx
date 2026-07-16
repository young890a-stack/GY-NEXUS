import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "GY Company OS", template: "%s | GY" },
  description: "GY First Release Production 1.0 — One Human. One AI Company.",
  applicationName: "GY Company OS",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "GY Company OS", statusBarStyle: "black-translucent" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#4f46e5" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
