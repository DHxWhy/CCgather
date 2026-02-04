(() => {
  "use strict";
  function e(e, t, n, r, o, i, a) {
    try {
      var c = e[i](a),
        l = c.value;
    } catch (e) {
      n(e);
      return;
    }
    c.done ? t(l) : Promise.resolve(l).then(r, o);
  }
  function t(e) {
    return e && "u" > typeof Symbol && e.constructor === Symbol ? "symbol" : typeof e;
  }
  function n(e) {
    if (!e) return "";
    for (var t = new Uint8Array(e), n = "", r = 0; r < t.byteLength; r++) {
      var o = t[r];
      void 0 !== o && (n += String.fromCharCode(o));
    }
    return btoa(n).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  }
  ("function" == typeof SuppressedError && SuppressedError,
    self.addEventListener("message", function (e) {
      e.data &&
        "object" === t(e.data) &&
        "SKIP_WAITING" === e.data.type &&
        (console.log("[SW] Received SKIP_WAITING message, activating new version"),
        self.skipWaiting());
    }),
    self.addEventListener("push", function (e) {
      if ((console.log("[SW] Push notification received"), !e.data))
        return void console.warn("[SW] Push event has no data");
      try {
        t = e.data.json();
      } catch (n) {
        t = { title: "CCgather", body: e.data.text() };
      }
      var t,
        n,
        r = {
          body: t.body || "You have a new notification",
          icon: t.icon || "/icons/icon-192x192.png",
          badge: t.badge || "/icons/badge-72x72.png",
          tag: t.tag || "default",
          data: t.data || {},
          requireInteraction: !1,
          silent: null != (n = t.silent) && n,
        };
      e.waitUntil(self.registration.showNotification(t.title || "CCgather", r));
    }),
    self.addEventListener("notificationclick", function (e) {
      (console.log("[SW] Notification clicked:", e.notification.tag), e.notification.close());
      var n,
        r,
        o = (null == (n = e.notification.data) ? void 0 : n.url) || "/";
      try {
        var i = new URL(o, self.location.origin);
        i.origin !== self.location.origin
          ? (console.warn("[SW] Blocked external redirect attempt:", o),
            (r = new URL("/", self.location.origin).href))
          : (r = i.href);
      } catch (e) {
        r = new URL("/", self.location.origin).href;
      }
      e.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: !0 }).then(function (e) {
          var n = !0,
            o = !1,
            i = void 0;
          try {
            for (var a, c = e[Symbol.iterator](); !(n = (a = c.next()).done); n = !0) {
              var l = a.value;
              if (l.url === r && "focus" in l) return l.focus();
            }
          } catch (e) {
            ((o = !0), (i = e));
          } finally {
            try {
              n || null == c.return || c.return();
            } finally {
              if (o) throw i;
            }
          }
          var s = !0,
            u = !1,
            f = void 0;
          try {
            for (var d, p = e[Symbol.iterator](); !(s = (d = p.next()).done); s = !0) {
              var h = (function () {
                var e = d.value;
                if (
                  new URL(e.url).origin === self.location.origin &&
                  "focus" in e &&
                  "navigate" in e
                )
                  return {
                    v: e.navigate(r).then(function () {
                      return e.focus();
                    }),
                  };
              })();
              if ("object" === t(h)) return h.v;
            }
          } catch (e) {
            ((u = !0), (f = e));
          } finally {
            try {
              s || null == p.return || p.return();
            } finally {
              if (u) throw f;
            }
          }
          if (self.clients.openWindow) return self.clients.openWindow(r);
        })
      );
    }),
    self.addEventListener("notificationclose", function (e) {
      console.log("[SW] Notification closed:", e.notification.tag);
    }),
    self.addEventListener("pushsubscriptionchange", function (t) {
      var r;
      (console.log("[SW] Push subscription changed"),
        t.waitUntil(
          ((r = function () {
            var e, t, r;
            return (function (e, t) {
              var n,
                r,
                o,
                i = {
                  label: 0,
                  sent: function () {
                    if (1 & o[0]) throw o[1];
                    return o[1];
                  },
                  trys: [],
                  ops: [],
                },
                a = Object.create(("function" == typeof Iterator ? Iterator : Object).prototype);
              return (
                (a.next = c(0)),
                (a.throw = c(1)),
                (a.return = c(2)),
                "function" == typeof Symbol &&
                  (a[Symbol.iterator] = function () {
                    return this;
                  }),
                a
              );
              function c(c) {
                return function (l) {
                  var s = [c, l];
                  if (n) throw TypeError("Generator is already executing.");
                  for (; a && ((a = 0), s[0] && (i = 0)), i; )
                    try {
                      if (
                        ((n = 1),
                        r &&
                          (o =
                            2 & s[0]
                              ? r.return
                              : s[0]
                                ? r.throw || ((o = r.return) && o.call(r), 0)
                                : r.next) &&
                          !(o = o.call(r, s[1])).done)
                      )
                        return o;
                      switch (((r = 0), o && (s = [2 & s[0], o.value]), s[0])) {
                        case 0:
                        case 1:
                          o = s;
                          break;
                        case 4:
                          return (i.label++, { value: s[1], done: !1 });
                        case 5:
                          (i.label++, (r = s[1]), (s = [0]));
                          continue;
                        case 7:
                          ((s = i.ops.pop()), i.trys.pop());
                          continue;
                        default:
                          if (
                            !(o = (o = i.trys).length > 0 && o[o.length - 1]) &&
                            (6 === s[0] || 2 === s[0])
                          ) {
                            i = 0;
                            continue;
                          }
                          if (3 === s[0] && (!o || (s[1] > o[0] && s[1] < o[3]))) {
                            i.label = s[1];
                            break;
                          }
                          if (6 === s[0] && i.label < o[1]) {
                            ((i.label = o[1]), (o = s));
                            break;
                          }
                          if (o && i.label < o[2]) {
                            ((i.label = o[2]), i.ops.push(s));
                            break;
                          }
                          (o[2] && i.ops.pop(), i.trys.pop());
                          continue;
                      }
                      s = t.call(e, i);
                    } catch (e) {
                      ((s = [6, e]), (r = 0));
                    } finally {
                      n = o = 0;
                    }
                  if (5 & s[0]) throw s[1];
                  return { value: s[0] ? s[1] : void 0, done: !0 };
                };
              }
            })(this, function (o) {
              switch (o.label) {
                case 0:
                  return (o.trys.push([0, 5, , 6]), [4, fetch("/api/community/push/vapid-key")]);
                case 1:
                  if (!(e = o.sent()).ok)
                    return (console.error("[SW] Failed to fetch VAPID key"), [2]);
                  return [4, e.json()];
                case 2:
                  return (
                    (t = (function (e) {
                      for (
                        var t = "=".repeat((4 - (e.length % 4)) % 4),
                          n = atob((e + t).replace(/-/g, "+").replace(/_/g, "/")),
                          r = new Uint8Array(n.length),
                          o = 0;
                        o < n.length;
                        ++o
                      )
                        r[o] = n.charCodeAt(o);
                      return r;
                    })(o.sent().publicKey)),
                    [
                      4,
                      self.registration.pushManager.subscribe({
                        userVisibleOnly: !0,
                        applicationServerKey: t.buffer,
                      }),
                    ]
                  );
                case 3:
                  return [
                    4,
                    fetch("/api/community/push/subscribe", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        endpoint: (r = o.sent()).endpoint,
                        keys: { p256dh: n(r.getKey("p256dh")), auth: n(r.getKey("auth")) },
                      }),
                    }),
                  ];
                case 4:
                  return (o.sent(), console.log("[SW] Resubscribed successfully"), [3, 6]);
                case 5:
                  return (console.error("[SW] Failed to resubscribe:", o.sent()), [3, 6]);
                case 6:
                  return [2];
              }
            });
          }),
          function () {
            var t = this,
              n = arguments;
            return new Promise(function (o, i) {
              var a = r.apply(t, n);
              function c(t) {
                e(a, o, i, c, l, "next", t);
              }
              function l(t) {
                e(a, o, i, c, l, "throw", t);
              }
              c(void 0);
            });
          })()
        ));
    }));
})();
