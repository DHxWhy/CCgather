"use client";

import { useState, useCallback, useEffect } from "react";

// =====================================================
// Types
// =====================================================

interface PushNotificationState {
  isSupported: boolean;
  isSubscribed: boolean;
  permission: NotificationPermission | "default";
  isLoading: boolean;
  error: string | null;
}

interface UsePushNotificationsReturn extends PushNotificationState {
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  requestPermission: () => Promise<NotificationPermission>;
}

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

// =====================================================
// Hook
// =====================================================

export function usePushNotifications(): UsePushNotificationsReturn {
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    isSubscribed: false,
    permission: "default",
    isLoading: true,
    error: null,
  });

  // Check if push notifications are supported and current state
  useEffect(() => {
    const checkSupport = async () => {
      // Check if service worker and push manager are supported
      const isSupported =
        "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

      if (!isSupported) {
        setState({
          isSupported: false,
          isSubscribed: false,
          permission: "default",
          isLoading: false,
          error: null,
        });
        return;
      }

      const permission = Notification.permission;

      // Check if already subscribed
      try {
        // First check if there's an active service worker registration
        const registrations = await navigator.serviceWorker.getRegistrations();
        if (registrations.length === 0) {
          // No service worker registered, but browser supports it
          setState({
            isSupported: true,
            isSubscribed: false,
            permission,
            isLoading: false,
            error: null,
          });
          return;
        }

        // Use a timeout to prevent hanging on serviceWorker.ready
        const timeoutPromise = new Promise<null>((_, reject) => {
          setTimeout(() => reject(new Error("Service worker ready timeout")), 5000);
        });

        const registration = await Promise.race([navigator.serviceWorker.ready, timeoutPromise]);

        if (!registration) {
          setState({
            isSupported: true,
            isSubscribed: false,
            permission,
            isLoading: false,
            error: null,
          });
          return;
        }

        const subscription = await registration.pushManager.getSubscription();

        setState({
          isSupported: true,
          isSubscribed: !!subscription,
          permission,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        console.error("Error checking push subscription:", error);
        setState({
          isSupported: true,
          isSubscribed: false,
          permission,
          isLoading: false,
          error: null,
        });
      }
    };

    checkSupport();
  }, []);

  // Request notification permission
  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!("Notification" in window)) {
      return "denied";
    }

    const permission = await Notification.requestPermission();
    setState((prev) => ({ ...prev, permission }));
    return permission;
  }, []);

  // Subscribe to push notifications
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported) {
      setState((prev) => ({
        ...prev,
        error: "Push notifications are not supported",
      }));
      return false;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // Check if service worker is registered first
      const registrations = await navigator.serviceWorker.getRegistrations();
      if (registrations.length === 0) {
        // Development mode or no service worker - show helpful message
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isSupported: false,
          error: "Service worker not available (development mode)",
        }));
        return false;
      }

      // Request permission if needed
      let permission = Notification.permission;
      if (permission === "default") {
        permission = await requestPermission();
      }

      if (permission !== "granted") {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: "Notification permission denied",
        }));
        return false;
      }

      // Get VAPID public key from server
      const vapidResponse = await fetch("/api/community/push/vapid-key");
      if (!vapidResponse.ok) {
        const errorData = await vapidResponse.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to get VAPID key");
      }
      const { publicKey } = await vapidResponse.json();

      // Subscribe to push with timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Service worker ready timeout")), 10000);
      });

      const registration = await Promise.race([navigator.serviceWorker.ready, timeoutPromise]);

      const vapidKey = urlBase64ToUint8Array(publicKey);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey.buffer as ArrayBuffer,
      });

      // Send subscription to server
      const response = await fetch("/api/community/push/subscribe", {
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
          user_agent: navigator.userAgent,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save subscription on server");
      }

      setState((prev) => ({
        ...prev,
        isSubscribed: true,
        isLoading: false,
        error: null,
      }));

      return true;
    } catch (error) {
      console.error("Error subscribing to push:", error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to subscribe",
      }));
      return false;
    }
  }, [state.isSupported, requestPermission]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported) {
      return false;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        setState((prev) => ({
          ...prev,
          isSubscribed: false,
          isLoading: false,
        }));
        return true;
      }

      // Unsubscribe from push
      await subscription.unsubscribe();

      // Remove subscription from server
      await fetch("/api/community/push/subscribe", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
        }),
      });

      setState((prev) => ({
        ...prev,
        isSubscribed: false,
        isLoading: false,
        error: null,
      }));

      return true;
    } catch (error) {
      console.error("Error unsubscribing from push:", error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to unsubscribe",
      }));
      return false;
    }
  }, [state.isSupported]);

  return {
    ...state,
    subscribe,
    unsubscribe,
    requestPermission,
  };
}

export default usePushNotifications;
