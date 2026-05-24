/**
 * CCgather Service Worker — SELF-DESTRUCT (2026-05-24)
 *
 * 옛 PWA SW 회수용. 사용자 브라우저가 24h 내에 이 SW 자동 update check 하면:
 *   1) install: skipWaiting 으로 즉시 active
 *   2) activate:
 *      - 모든 cache 청소
 *      - 자기 자신 unregister
 *      - 활성 페이지 reload (OAuth 진행 중 제외)
 *   3) fetch handler 없음 → 네트워크 통과 (pass-through)
 *
 * 다음 page load 부터는 SW 없는 일반 웹앱.
 * push notification 잃음 — push_subscriptions 활성 사용자 1명, 비즈니스 영향 미미.
 */

self.addEventListener("install", () => {
  // 옛 SW 즉시 종료 + 새 SW active
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // 1) 모든 cache 청소
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      } catch (e) {
        console.warn("[SW] cache cleanup failed:", e);
      }

      // 2) 자기 자신 unregister — 다음 페이지부터 SW 없는 일반 웹앱
      try {
        await self.registration.unregister();
      } catch (e) {
        console.warn("[SW] unregister failed:", e);
      }

      // 3) 활성 페이지들 reload — 단 OAuth/가입 진행 중인 페이지는 보호
      try {
        const clients = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        const CRITICAL_PATHS = ["/sso-callback", "/sign-in", "/sign-up", "/cli/auth"];
        for (const client of clients) {
          const path = new URL(client.url).pathname;
          if (CRITICAL_PATHS.some((p) => path.startsWith(p))) {
            continue; // OAuth code 손실 방지 — 자연 navigate 대기
          }
          client.navigate(client.url);
        }
      } catch (e) {
        console.warn("[SW] client reload failed:", e);
      }
    })()
  );
});

// fetch handler 없음 — 모든 네트워크 요청은 브라우저가 직접 처리.
// 옛 SW 와 달리 cache 가로채기 X = ChunkLoadError 영구 차단.
