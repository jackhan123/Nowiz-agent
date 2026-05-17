import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AI 硬件实验室 - 用 AI 设计你的硬件',
  description: '输入你想做的物品，AI 帮你生成完整的硬件方案和 BOM 清单',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
