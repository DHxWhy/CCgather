import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 외부 이미지 도메인 허용 (뉴스 기사 OG 이미지 등)
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  // PostHog 프록시 설정 - AdBlocker 우회 및 CORS 문제 해결
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
};

export default nextConfig;
