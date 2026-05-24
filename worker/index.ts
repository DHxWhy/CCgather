/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

// =====================================================
// Skip Waiting Message Handler (for manual update trigger)
// =====================================================

self.addEventListener("message", (event) => {
  // Validate message structure before processing
  if (event.data && typeof event.data === "object" && event.data.type === "SKIP_WAITING") {
    console.log("[SW] Received SKIP_WAITING message, activating new version");
    self.skipWaiting();
  }
});

// =====================================================
// Push Notification Event Handler
// =====================================================

self.addEventListener("push", (event) => {
  console.log("[SW] Push notification received");

  if (!event.data) {
    console.warn("[SW] Push event has no data");
    return;
  }

  let payload: {
    title?: string;
    body?: string;
    icon?: string;
    badge?: string;
    tag?: string;
    silent?: boolean;
    data?: {
      url?: string;
      type?: string;
      postId?: string;
      commentId?: string;
      actorId?: string;
    };
  };

  try {
    payload = event.data.json();
  } catch {
    payload = {
      title: "CCgather",
      body: event.data.text(),
    };
  }

  const options: NotificationOptions = {
    body: payload.body || "You have a new notification",
    icon: payload.icon || "/icons/icon-192x192.png",
    badge: payload.badge || "/icons/badge-72x72.png",
    tag: payload.tag || "default",
    data: payload.data || {},
    requireInteraction: false,
    silent: payload.silent ?? false,
  };

  event.waitUntil(self.registration.showNotification(payload.title || "CCgather", options));
});

// =====================================================
// Notification Click Event Handler
// =====================================================

self.addEventListener("notificationclick", (event) => {
  console.log("[SW] Notification clicked:", event.notification.tag);

  event.notification.close();

  // Get URL from notification data with security validation
  const rawUrl = (event.notification.data as { url?: string })?.url || "/";

  // Security: Only allow relative URLs or same-origin URLs
  // This prevents open redirect attacks via malicious push notifications
  let fullUrl: string;
  try {
    const parsed = new URL(rawUrl, self.location.origin);
    // Reject if URL points to different origin (potential phishing)
    if (parsed.origin !== self.location.origin) {
      console.warn("[SW] Blocked external redirect attempt:", rawUrl);
      fullUrl = new URL("/", self.location.origin).href;
    } else {
      fullUrl = parsed.href;
    }
  } catch {
    // Invalid URL, fallback to home
    fullUrl = new URL("/", self.location.origin).href;
  }

  event.waitUntil(
    self.clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then((windowClients) => {
        // Check if there's already a window open
        for (const client of windowClients) {
          if (client.url === fullUrl && "focus" in client) {
            return client.focus();
          }
        }

        // Find any window on our origin
        for (const client of windowClients) {
          if (
            new URL(client.url).origin === self.location.origin &&
            "focus" in client &&
            "navigate" in client
          ) {
            return (client as WindowClient).navigate(fullUrl).then(() => client.focus());
          }
        }

        // Open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(fullUrl);
        }

        return undefined;
      })
  );
});

// =====================================================
// Notification Close Event Handler
// =====================================================

self.addEventListener("notificationclose", (event) => {
  console.log("[SW] Notification closed:", event.notification.tag);
});

// =====================================================
// Push Subscription Change Event Handler
// =====================================================

self.addEventListener("pushsubscriptionchange", (event) => {
  console.log("[SW] Push subscription changed");

  event.waitUntil(
    (async () => {
      try {
        // Try to get the VAPID key from the server
        const response = await fetch("/api/community/push/vapid-key");
        if (!response.ok) {
          console.error("[SW] Failed to fetch VAPID key");
          return;
        }

        const { publicKey } = await response.json();

        const vapidKey = urlBase64ToUint8Array(publicKey);
        const subscription = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKey.buffer as ArrayBuffer,
        });

        // Notify the server about the new subscription
        await fetch("/api/community/push/subscribe", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
            keys: {
              p256dh: arrayBufferToBase64(subscription.getKey("p256dh")),
              auth: arrayBufferToBase64(subscription.getKey("auth")),
            },
          }),
        });

        console.log("[SW] Resubscribed successfully");
      } catch (error) {
        console.error("[SW] Failed to resubscribe:", error);
      }
    })()
  );
});

// =====================================================
// Helper Functions
// =====================================================

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    const byte = bytes[i];
    if (byte !== undefined) {
      binary += String.fromCharCode(byte);
    }
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export {};
