import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// 옛 PWA SW/캐시 강제 청소 일회성 마이그레이션.
// 사용자가 HTML 페이지로 첫 방문 시 Clear-Site-Data 헤더로 cache+storage 청소.
// 옛 SW 가 PwaMigration 클라이언트 코드까지 가로채서 못 도달하는 케이스를 server-side
// 헤더로 우회. cookie 마크로 일회성 보장 (cookie 자체는 청소 대상이 아니라 보존됨).
const CLEANUP_VERSION = "v1_2026_05_24";
const CLEANUP_COOKIE = `ccg-cleared-${CLEANUP_VERSION}`;
const CRITICAL_PATHS = ["/sso-callback", "/sign-in", "/sign-up", "/cli/auth"];

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
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  // ─── 일회성 PWA 마이그레이션 ───────────────────────────────
  // HTML 페이지 첫 방문 시 Clear-Site-Data 헤더로 옛 SW/캐시 강제 청소.
  // 한 번 cookie 마크하면 영구 skip. OAuth 도중에는 안 함.
  const acceptHeader = req.headers.get("accept") || "";
  const isHtmlNavigation = acceptHeader.includes("text/html");
  const isCriticalPath = CRITICAL_PATHS.some((p) => req.nextUrl.pathname.startsWith(p));
  const alreadyCleared = req.cookies.get(CLEANUP_COOKIE)?.value === "done";

  if (isHtmlNavigation && !isCriticalPath && !alreadyCleared) {
    const res = NextResponse.next();
    // cache, storage(IndexedDB/localStorage/SW), executionContexts 청소.
    // cookies 는 의도적으로 제외 — 우리 마크 cookie 와 Clerk 진행 중 cookie 보존.
    res.headers.set("Clear-Site-Data", '"cache", "storage", "executionContexts"');
    res.cookies.set(CLEANUP_COOKIE, "done", {
      maxAge: 60 * 60 * 24 * 365, // 1년
      sameSite: "lax",
      path: "/",
      httpOnly: false, // 클라에서도 읽을 수 있게 (디버깅 편의)
    });
    return res;
  }

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
