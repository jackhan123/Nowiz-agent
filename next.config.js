/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 增加API路由的最大执行时间（默认10秒，AI生成可能需要更长时间）
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
}

module.exports = nextConfig
