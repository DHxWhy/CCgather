"use client";

import { useEffect } from "react";

/**
 * PWA 옛 SW/캐시 자동 청소.
 *
 * 배경: 2026-02 ~ 05 사이 등록된 옛 Service Worker 가 skipWaiting=false 였고
 * 옛 코드(옛 OnboardingGuard, 옛 Header)를 사용자 디바이스에 영구 캐시함.
 * 그 사용자들이 우리 새 frictionless 가입 흐름을 받지 못해 Sign In 후에도
 * 비로그인 상태로 보이는 사건 발생.
 *
 * 이 컴포넌트는 **첫 방문 시 단 한 번** 다음을 수행:
 *   1) 모든 Workbox/PWA 캐시 청소 (caches.delete)
 *   2) 등록된 Service Worker 모두 unregister
 *   3) localStorage 에 마이그레이션 완료 마크
 *   4) 한 번만 hard reload
 *
 * 다음 방문부터는 새 SW 등록 + 정상 동작. 일회성이라 매번 reload 되지 않음.
 *
 * 안전 가드:
 *   - OAuth 콜백 진행 중 (/sso-callback) 에서는 절대 reload 안 함
 *   - 가입 흐름 (/sign-in, /sign-up, /cli/auth) 에서도 보류
 */

const MIGRATION_KEY = "ccg_sw_cleanup_v1_2026_05_24";

export function PwaMigration() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV === "development") return;

    // 일회성 — 이미 완료된 디바이스는 skip
    try {
      if (localStorage.getItem(MIGRATION_KEY) === "done") return;
    } catch {
      return; // localStorage 차단 환경 — 아무것도 안 함
    }

    // Critical path 보호 — OAuth 도중 reload 하면 code 손실
    const CRITICAL = ["/sso-callback", "/sign-in", "/sign-up", "/cli/auth"];
    const path = window.location.pathname;
    if (CRITICAL.some((p) => path.startsWith(p))) {
      // 이 페이지가 아닌 다음 페이지에서 다시 시도하도록 마크 안 함
      return;
    }

    // SW API 없는 환경 (Safari ITP 등) — 캐시만 청소하고 끝
    const hasSwApi = "serviceWorker" in navigator;
    const hasCacheApi = "caches" in window;
    if (!hasSwApi && !hasCacheApi) {
      try {
        localStorage.setItem(MIGRATION_KEY, "done");
      } catch {}
      return;
    }

    let cancelled = false;

    (async () => {
      let didCleanup = false;

      // 1) 모든 cache 청소
      if (hasCacheApi) {
        try {
          const keys = await caches.keys();
          if (keys.length > 0) {
            await Promise.all(keys.map((k) => caches.delete(k)));
            didCleanup = true;
          }
        } catch (err) {
          console.warn("[PwaMigration] cache cleanup failed:", err);
        }
      }

      // 2) 모든 SW unregister — Workbox 가 새로 등록할 것
      if (hasSwApi) {
        try {
          const regs = await navigator.serviceWorker.getRegistrations();
          if (regs.length > 0) {
            await Promise.all(regs.map((r) => r.unregister()));
            didCleanup = true;
          }
        } catch (err) {
          console.warn("[PwaMigration] SW unregister failed:", err);
        }
      }

      if (cancelled) return;

      // 3) 마이그레이션 마크 (실패해도 페이지는 reload — 다음 시도 시 다시 청소)
      try {
        localStorage.setItem(MIGRATION_KEY, "done");
      } catch {}

      // 4) 변화가 있었다면 한 번만 hard reload — 새 SW + 새 캐시 받기
      if (didCleanup) {
        console.log("[PwaMigration] cleaned up stale PWA state — reloading once");
        // 잠깐 텀 두고 reload (React 렌더 안정성)
        setTimeout(() => {
          window.location.reload();
        }, 150);
      }
    })().catch((err) => {
      console.error("[PwaMigration] migration error:", err);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
