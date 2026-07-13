import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/leaderboard(.*)",
  "/community(.*)",
  "/u/(.*)",
  "/league/(.*)",
  // 추천 초대 랜딩: 초대받는 사람은 정의상 비로그인 신규 → public 이어야 카드/CTA 가 뜨고
  // /j/[code] 의 attribution(localStorage + 쿠키) 이 실행됨. public 아니면 /sign-in 으로 튕김.
  "/j/(.*)",
  "/join/(.*)",
  "/terms",
  "/privacy",
  "/stats",
  "/cli",
  "/cli/auth(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/sso-callback(.*)",
  "/api/webhooks/(.*)",
  "/api/og/(.*)",
  "/api/leaderboard(.*)",
  "/api/user/(.*)",
  "/api/users/(.*)",
  "/api/countries(.*)",
  "/api/cli/(.*)",
  // /j/[code] 페이지가 mount 시 호출 — inviter 정보 반환 + ccg_pending_ref 쿠키 설정.
  // 핸들러에 auth() 게이트 없음(의도적 public). 형제 /api/referral/claim·invitees 는 자체 401.
  "/api/referral/(.*)",
  // Auth-required APIs 가 middleware 의 redirect 가 아닌 401 JSON 응답을 직접
  // 처리할 수 있도록 public 으로 분류. 핸들러 자체가 auth() 체크 후 401 반환.
  // 이게 없으면 비인증 fetch 가 HTML redirect 받아 클라이언트 JSON parse fail.
  "/api/me(.*)",
  "/api/auth/recovery-check",
  // 공개 stats API + 크론 (크론 핸들러는 CRON_SECRET/x-vercel-cron 자체 인증)
  "/api/stats(.*)",
  "/api/cron/(.*)",
  // 비인증 사용자에게도 통계 보여줘야 — 비인증 시 핸들러가 빈 stats 반환.
  // public 안 두면 middleware 가 307 HTML redirect → 클라이언트 JSON parse fail
  // → console error (무한 루프 아니지만 노이즈).
  "/api/community/stats",
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  // 로그인한 사용자가 홈페이지 접근 시 → 리더보드로 리디렉트
  // Edge Runtime에서 처리하여 Cold Start 영향 없음
  if (userId && req.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/leaderboard", req.url));
  }

  // 비공개 라우트는 로그인 필수.
  // unauthenticatedUrl 을 명시해서 Clerk hosted Account Portal (accounts.dev)
  // 대신 우리 앱의 /sign-in 으로 보냅니다. NEXT_PUBLIC_CLERK_SIGN_IN_URL env 가
  // 누락된 환경에서도 GitHub-only UX 가 보장됩니다.
  if (!isPublicRoute(req)) {
    await auth.protect({
      unauthenticatedUrl: new URL("/sign-in", req.url).toString(),
    });
  }

  // Public routes and non-redirect paths: continue without modification
  return;
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files (including xml, txt for sitemap/robots)
    // Also skip /ingest for PostHog proxy (handled by Vercel rewrites)
    "/((?!_next|ingest|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|xml|txt)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
