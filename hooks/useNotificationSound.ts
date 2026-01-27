"use client";

import { useCallback, useRef } from "react";

/**
 * Hook for playing notification sounds
 * Usage:
 *   const { play } = useNotificationSound();
 *   play(); // plays default notification sound
 */
export function useNotificationSound() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const play = useCallback((volume: number = 0.5) => {
    try {
      // Create audio element if not exists
      if (!audioRef.current) {
        audioRef.current = new Audio("/sounds/notification.mp3");
      }

      const audio = audioRef.current;
      audio.volume = Math.min(1, Math.max(0, volume));
      audio.currentTime = 0;

      // Play and handle errors silently
      audio.play().catch((error) => {
        // Autoplay might be blocked by browser policy
        console.debug("Notification sound blocked:", error.message);
      });
    } catch (error) {
      console.debug("Error playing notification sound:", error);
    }
  }, []);

  const preload = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio("/sounds/notification.mp3");
      audioRef.current.preload = "auto";
    }
  }, []);

  return { play, preload };
}

export default useNotificationSound;
