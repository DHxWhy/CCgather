import type { NextConfig } from "next";

// PWA 제거 (2026-05-24).
// 배경: 옛 SW 가 옛 chunk 영구 캐시 → ChunkLoadError 루프 + 가입 funnel 차단.
// push_subscriptions 활성 사용자 1명 = PWA 가치 ≪ 사이트 안정성.
// public/sw.js 는 self-destruct SW 로 수동 작성 → 옛 PWA 사용자 자동 회수.

const nextConfig: NextConfig = {
  // Turbopack 설정 (Next.js 16 기본 번들러)
  turbopack: {},
  // Security headers + CORS
  async headers() {
    const securityHeaders = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-DNS-Prefetch-Control", value: "on" },
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
    ];
    return [
      { source: "/(.*)", headers: securityHeaders },
      {
        source: "/api/:path*",
        headers: [
          ...securityHeaders,
          {
            key: "Access-Control-Allow-Origin",
            value:
              process.env.NODE_ENV === "development"
                ? "http://localhost:3000"
                : "https://ccgather.com",
          },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PATCH,DELETE,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
        ],
      },
    ];
  },
  // 외부 이미지 도메인 허용 (허용된 소스만)
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "img.clerk.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "api.dicebear.com" },
      { protocol: "https", hostname: "www.google.com" },
      { protocol: "https", hostname: "logo.clearbit.com" },
    ],
    // SVG 아바타 지원 (dicebear 등)
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  // 성능 최적화
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@clerk/nextjs",
      "date-fns",
      "recharts",
      "framer-motion",
      "@supabase/supabase-js",
      "clsx",
      "tailwind-merge",
      "cobe",
      "posthog-js",
    ],
  },
  // PostHog 프록시는 vercel.json rewrites로 처리
  // Next.js rewrites는 POST 요청에서 405 에러 발생하여 Vercel rewrites로 대체
};

export default nextConfig;
