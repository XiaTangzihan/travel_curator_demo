import type { Metadata } from "next";
import { IBM_Plex_Mono, Noto_Sans_SC } from "next/font/google";
import "./globals.css";

const bodyFont = Noto_Sans_SC({
  subsets: ["latin"],
  variable: "--font-body",
});

const monoFont = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "旅行策展人 Demo",
  description: "广州黄金评论数据集驱动的本地旅行策展 Demo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" data-scroll-behavior="smooth">
      <body className={`${bodyFont.variable} ${monoFont.variable}`}>{children}</body>
    </html>
  );
}
