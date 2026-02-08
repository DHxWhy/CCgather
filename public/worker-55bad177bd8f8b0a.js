(() => {
  "use strict";
  function e(e) {
    if (!e) return "";
    let t = new Uint8Array(e),
      i = "";
    for (let e = 0; e < t.byteLength; e++) {
      let n = t[e];
      void 0 !== n && (i += String.fromCharCode(n));
    }
    return btoa(i).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  }
  (self.addEventListener("message", (e) => {
    e.data &&
      "object" == typeof e.data &&
      "SKIP_WAITING" === e.data.type &&
      (console.log("[SW] Received SKIP_WAITING message, activating new version"),
      self.skipWaiting());
  }),
    self.addEventListener("push", (e) => {
      let t;
      if ((console.log("[SW] Push notification received"), !e.data))
        return void console.warn("[SW] Push event has no data");
      try {
        t = e.data.json();
      } catch {
        t = { title: "CCgather", body: e.data.text() };
      }
      let i = {
        body: t.body || "You have a new notification",
        icon: t.icon || "/icons/icon-192x192.png",
        badge: t.badge || "/icons/badge-72x72.png",
        tag: t.tag || "default",
        data: t.data || {},
        requireInteraction: !1,
        silent: t.silent ?? !1,
      };
      e.waitUntil(self.registration.showNotification(t.title || "CCgather", i));
    }),
    self.addEventListener("notificationclick", (e) => {
      let t;
      (console.log("[SW] Notification clicked:", e.notification.tag), e.notification.close());
      let i = e.notification.data?.url || "/";
      try {
        let e = new URL(i, self.location.origin);
        e.origin !== self.location.origin
          ? (console.warn("[SW] Blocked external redirect attempt:", i),
            (t = new URL("/", self.location.origin).href))
          : (t = e.href);
      } catch {
        t = new URL("/", self.location.origin).href;
      }
      e.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: !0 }).then((e) => {
          for (let i of e) if (i.url === t && "focus" in i) return i.focus();
          for (let i of e)
            if (new URL(i.url).origin === self.location.origin && "focus" in i && "navigate" in i)
              return i.navigate(t).then(() => i.focus());
          if (self.clients.openWindow) return self.clients.openWindow(t);
        })
      );
    }),
    self.addEventListener("notificationclose", (e) => {
      console.log("[SW] Notification closed:", e.notification.tag);
    }),
    self.addEventListener("pushsubscriptionchange", (t) => {
      (console.log("[SW] Push subscription changed"),
        t.waitUntil(
          (async () => {
            try {
              let t = await fetch("/api/community/push/vapid-key");
              if (!t.ok) return void console.error("[SW] Failed to fetch VAPID key");
              let { publicKey: i } = await t.json(),
                n = (function (e) {
                  let t = "=".repeat((4 - (e.length % 4)) % 4),
                    i = atob((e + t).replace(/-/g, "+").replace(/_/g, "/")),
                    n = new Uint8Array(i.length);
                  for (let e = 0; e < i.length; ++e) n[e] = i.charCodeAt(e);
                  return n;
                })(i),
                o = await self.registration.pushManager.subscribe({
                  userVisibleOnly: !0,
                  applicationServerKey: n.buffer,
                });
              (await fetch("/api/community/push/subscribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  endpoint: o.endpoint,
                  keys: { p256dh: e(o.getKey("p256dh")), auth: e(o.getKey("auth")) },
                }),
              }),
                console.log("[SW] Resubscribed successfully"));
            } catch (e) {
              console.error("[SW] Failed to resubscribe:", e);
            }
          })()
        ));
    }));
})();
