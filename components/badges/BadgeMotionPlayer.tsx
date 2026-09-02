"use client";

import { useEffect, useRef, useState } from "react";
import type { Badge } from "@/lib/constants/badges";
import { MOTION_INTRO_END, MOTION_OUT_POINT } from "@/lib/badges/motion-composer";
import { PinWithMotion } from "@/components/badges/PinWithMotion";

const IDLE_LOOPS = 3;
const MOTION_URL = (badgeId: string) => `/badges/motion/v1/${badgeId}.json`;

interface BadgeMotionPlayerProps {
  badgeId: string;
  image: string;
  rarity: Badge["rarity"];
  size: number;
}

type PlayerState = "loading" | "playing" | "fallback";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function BadgeMotionPlayer({ badgeId, image, rarity, size }: BadgeMotionPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<PlayerState>(() =>
    prefersReducedMotion() ? "fallback" : "loading"
  );

  useEffect(() => {
    if (state !== "loading" || !containerRef.current) return;
    const container = containerRef.current;
    const abort = new AbortController();
    let animation: { destroy: () => void } | null = null;

    async function start() {
      try {
        const [lottieModule, res] = await Promise.all([
          import("lottie-web/build/player/lottie_light"),
          fetch(MOTION_URL(badgeId), { signal: abort.signal }),
        ]);
        if (!res.ok) throw new Error(`motion json ${res.status}`);
        const animationData = await res.json();
        if (abort.signal.aborted) return;
        const lottie = lottieModule.default;
        const anim = lottie.loadAnimation({
          container,
          renderer: "svg",
          loop: false,
          autoplay: false,
          animationData,
          rendererSettings: { preserveAspectRatio: "xMidYMid meet", progressiveLoad: true },
        });
        animation = anim;
        let idleLoops = 0;
        anim.addEventListener("DOMLoaded", () => {
          setState("playing");
          anim.playSegments(
            [
              [0, MOTION_INTRO_END],
              [MOTION_INTRO_END, MOTION_OUT_POINT],
            ],
            true
          );
        });
        anim.addEventListener("complete", () => {
          idleLoops += 1;
          if (idleLoops < IDLE_LOOPS) anim.playSegments([MOTION_INTRO_END, MOTION_OUT_POINT], true);
          else anim.goToAndStop(MOTION_OUT_POINT - 1, true);
        });
        anim.addEventListener("data_failed", () => setState("fallback"));
      } catch (err) {
        if (!abort.signal.aborted) {
          console.warn("[BadgeMotionPlayer] falling back to static pin:", err);
          setState("fallback");
        }
      }
    }

    void start();
    return () => {
      abort.abort();
      animation?.destroy();
    };
  }, [badgeId, state]);

  if (state === "fallback") {
    return <PinWithMotion image={image} rarity={rarity} earned size={size} />;
  }

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {state === "loading" && (
        <PinWithMotion
          image={image}
          rarity={rarity}
          earned
          size={size}
          className="absolute inset-0"
        />
      )}
      <div ref={containerRef} className="absolute inset-0" aria-hidden="true" />
    </div>
  );
}
