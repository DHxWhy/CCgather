import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/leaderboard(.*)",
  "/community(.*)",
  "/u/(.*)",
  "/league/(.*)",
  "/terms",
  "/privacy",
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
  // Auth-required APIs 가 middleware 의 redirect 가 아닌 401 JSON 응답을 직접
  // 처리할 수 있도록 public 으로 분류. 핸들러 자체가 auth() 체크 후 401 반환.
  // 이게 없으면 비인증 fetch 가 HTML redirect 받아 클라이언트 JSON parse fail.
  "/api/me(.*)",
  "/api/auth/recovery-check",
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
