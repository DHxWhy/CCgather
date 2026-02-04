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
    runtimeCaching: [
      // API 호출은 항상 네트워크에서 (실시간 데이터)
      {
        urlPattern: /^https?:\/\/.*\/api\/.*/i,
        handler: "NetworkOnly",
        options: {
          cacheName: "api-calls",
        },
      },
      // Clerk 인증 관련은 캐싱하지 않음
      {
        urlPattern: /^https?:\/\/.*clerk.*/i,
        handler: "NetworkOnly",
        options: {
          cacheName: "clerk-auth",
        },
      },
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
      // JS/CSS 캐싱 (StaleWhileRevalidate - 빠른 로딩 + 최신화)
      {
        urlPattern: /\.(?:js|css)$/i,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "static-resources",
          expiration: {
            maxEntries: 64,
            maxAgeSeconds: 7 * 24 * 60 * 60, // 7일
          },
        },
      },
    ],
  },
});

const nextConfig: NextConfig = {
  // Turbopack 설정 (Next.js 16 기본 번들러)
  turbopack: {},
  // 외부 이미지 도메인 허용 (뉴스 기사 OG 이미지 등)
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
    // SVG 아바타 지원 (dicebear 등)
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  // 성능 최적화
  experimental: {
    // 모던 번들 최적화 - 트리 쉐이킹 개선
    optimizePackageImports: [
      "lucide-react",
      "@clerk/nextjs",
      "date-fns",
      "recharts",
      "framer-motion",
      "@supabase/supabase-js",
      "clsx",
      "tailwind-merge",
    ],
  },
  // PostHog 프록시는 vercel.json rewrites로 처리
  // Next.js rewrites는 POST 요청에서 405 에러 발생하여 Vercel rewrites로 대체
};

export default withPWA(nextConfig);
