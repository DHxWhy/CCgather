import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/leaderboard(.*)",
  "/community(.*)",
  "/u/(.*)",
  "/league/(.*)",
  "/tools",
  "/tools/(.*)",
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
  "/api/tools",
  "/api/tools/((?!vote|submit|eligibility|analyze).*)",
  "/api/cli/(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  // 로그인한 사용자가 홈페이지 접근 시 → 리더보드로 리디렉트
  // Edge Runtime에서 처리하여 Cold Start 영향 없음
  if (userId && req.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/leaderboard", req.url));
  }

  // 비공개 라우트는 로그인 필수
  if (!isPublicRoute(req)) {
    await auth.protect();
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
