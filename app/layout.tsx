import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Coshape AI · 个性化义肢共创工作台",
  description: "支持多厂商 API 的个性化义肢外观共创与 3D 预览工作台。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
