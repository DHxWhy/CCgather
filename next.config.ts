import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  reloadOnOnline: true,
  cacheOnFrontEndNav: false,
  cacheStartUrl: true,
  // Clerk 인증 및 API 경로 캐싱 제외
  publicExcludes: ["!manifest.webmanifest"],
  // Workbox 옵션
  workboxOptions: {
    // skipWaiting: false - 사용자가 업데이트 버튼 클릭 시 수동으로 활성화
    // 자동 skipWaiting 제거하여 UpdateNotification 컴포넌트가 제어
    skipWaiting: false,
    clientsClaim: true,
    // 런타임 캐싱 전략
    // API(/api/*) 및 Clerk 라우트는 runtimeCaching에서 의도적으로 제외:
    // NetworkOnly 전략이라도 SW가 요청을 가로채면 SW 활성화/전환 중
    // Workbox no-response 에러 발생 가능 → React Error #185로 페이지 크래시
    // runtimeCaching에 미등록 시 SW fetch 핸들러가 가로채지 않고
    // 브라우저가 직접 네트워크 요청을 처리하여 에러를 완전히 방지
    runtimeCaching: [
      // 이미지 캐싱 (빠른 로딩)
      {
        urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
        handler: "CacheFirst",
        options: {
          cacheName: "static-images",
          expiration: {
            maxEntries: 64,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30일
          },
        },
      },
      // 폰트 캐싱
      {
        urlPattern: /\.(?:woff|woff2|ttf|otf|eot)$/i,
        handler: "CacheFirst",
        options: {
          cacheName: "static-fonts",
          expiration: {
            maxEntries: 16,
            maxAgeSeconds: 365 * 24 * 60 * 60, // 1년
          },
        },
      },
      // JS/CSS 캐싱 — _next/static은 precache가 이미 처리하므로 제외
      // 외부 스크립트/스타일만 NetworkFirst로 캐싱 (StaleWhileRevalidate는
      // SW 업데이트 중 stale 자원을 제공하여 React Error #185 유발 가능)
      {
        urlPattern: ({ url }: { url: URL }) =>
          /\.(?:js|css)$/i.test(url.pathname) && !url.pathname.startsWith("/_next/"),
        handler: "NetworkFirst",
        options: {
          cacheName: "external-resources",
          expiration: {
            maxEntries: 32,
            maxAgeSeconds: 24 * 60 * 60, // 1일
          },
        },
      },
    ],
  },
});

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

export default withPWA(nextConfig);
