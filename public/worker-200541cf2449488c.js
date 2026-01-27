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
    if (!e) return "";
    for (var t = new Uint8Array(e), n = "", r = 0; r < t.byteLength; r++) {
      var o = t[r];
      void 0 !== o && (n += String.fromCharCode(o));
    }
    return btoa(n).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  }
  ("function" == typeof SuppressedError && SuppressedError,
    self.addEventListener("push", function (e) {
      if ((console.log("[SW] Push notification received"), !e.data))
        return void console.warn("[SW] Push event has no data");
      try {
        t = e.data.json();
      } catch (n) {
        t = { title: "CCgather", body: e.data.text() };
      }
      var t,
        n = {
          body: t.body || "You have a new notification",
          icon: t.icon || "/icons/icon-192x192.png",
          badge: t.badge || "/icons/badge-72x72.png",
          tag: t.tag || "default",
          data: t.data || {},
          requireInteraction: !1,
        };
      e.waitUntil(self.registration.showNotification(t.title || "CCgather", n));
    }),
    self.addEventListener("notificationclick", function (e) {
      (console.log("[SW] Notification clicked:", e.notification.tag), e.notification.close());
      var t,
        n = new URL(
          (null == (t = e.notification.data) ? void 0 : t.url) || "/",
          self.location.origin
        ).href;
      e.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: !0 }).then(function (e) {
          var t = !0,
            r = !1,
            o = void 0;
          try {
            for (var i, a = e[Symbol.iterator](); !(t = (i = a.next()).done); t = !0) {
              var c = i.value;
              if (c.url === n && "focus" in c) return c.focus();
            }
          } catch (e) {
            ((r = !0), (o = e));
          } finally {
            try {
              t || null == a.return || a.return();
            } finally {
              if (r) throw o;
            }
          }
          var l = !0,
            s = !1,
            u = void 0;
          try {
            for (var f, d = e[Symbol.iterator](); !(l = (f = d.next()).done); l = !0) {
              var p = (function () {
                var e = f.value;
                if (
                  new URL(e.url).origin === self.location.origin &&
                  "focus" in e &&
                  "navigate" in e
                )
                  return {
                    v: e.navigate(n).then(function () {
                      return e.focus();
                    }),
                  };
              })();
              if (
                "object" ==
                (p && "u" > typeof Symbol && p.constructor === Symbol ? "symbol" : typeof p)
              )
                return p.v;
            }
          } catch (e) {
            ((s = !0), (u = e));
          } finally {
            try {
              l || null == d.return || d.return();
            } finally {
              if (s) throw u;
            }
          }
          if (self.clients.openWindow) return self.clients.openWindow(n);
        })
      );
    }),
    self.addEventListener("notificationclose", function (e) {
      console.log("[SW] Notification closed:", e.notification.tag);
    }),
    self.addEventListener("pushsubscriptionchange", function (n) {
      var r;
      (console.log("[SW] Push subscription changed"),
        n.waitUntil(
          ((r = function () {
            var e, n, r;
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
                    (n = (function (e) {
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
                        applicationServerKey: n.buffer,
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
                        keys: { p256dh: t(r.getKey("p256dh")), auth: t(r.getKey("auth")) },
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
