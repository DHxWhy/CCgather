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
  // PostHog 프록시는 API route로 처리 (app/ingest/[[...path]]/route.ts)
  // rewrites는 POST 요청에서 405 에러 발생하여 API route로 대체됨
};

export default nextConfig;
