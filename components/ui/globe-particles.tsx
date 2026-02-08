"use client";

import React, { useMemo, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface GlobeParticlesProps {
  size: number; // Globe size to match
  className?: string;
  speed?: number; // Speed multiplier (1 = normal, 0.5 = half speed, etc.)
}

// Leaderboard signature colors (Coral weighted higher ~40%)
const PARTICLE_COLORS = [
  "#FBBF24", // Yellow/Gold (1st place) ~20%
  "#DA7756", // Claude Coral (signature)
  "#DA7756", // Claude Coral (duplicate for higher weight)
  "#10b981", // Emerald Green ~20%
  "#3B82F6", // Blue ~20%
];

// Seeded random number generator for consistent SSR/client rendering
function createSeededRandom(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

// Determine particle count based on viewport width
function getParticleCount(viewportWidth: number): number {
  if (viewportWidth >= 1024) return 100; // Desktop: 100 particles (optimized from 150)
  if (viewportWidth >= 768) return 70; // Tablet: 70 particles (optimized from 100)
  return 40; // Mobile: 40 particles (optimized from 60)
}

export const GlobeParticles: React.FC<GlobeParticlesProps> = ({ size, className, speed = 1 }) => {
  // Use mounted state to prevent hydration mismatch
  const [mounted, setMounted] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(1024); // Default to desktop
  // Fade-in state for smooth appearance (only on initial load)
  const [isVisible, setIsVisible] = useState(false);
  const [initialFadeComplete, setInitialFadeComplete] = useState(false);

  useEffect(() => {
    setMounted(true);
    setViewportWidth(window.innerWidth);

    // Immediate visibility - synced with globe fadeIn (no delay)
    // Using requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      setIsVisible(true);
    });

    // Mark initial fade complete after transition finishes
    const fadeCompleteTimer = setTimeout(() => {
      setInitialFadeComplete(true);
    }, 400); // 300ms transition + 100ms buffer (synced with globe)

    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(fadeCompleteTimer);
    };
  }, []);

  // Second wave target directions (2시, 4시, 6시)
  // Clock: 12h=-90°, 3h=0°, 6h=90°
  // 2시 = -60° = -π/3, 4시 = 30° = π/6, 6시 = 90° = π/2
  const SECOND_WAVE_DIRECTIONS = [
    -Math.PI / 3, // 2시 방향 (-60°)
    Math.PI / 6, // 4시 방향 (30°)
    Math.PI / 2, // 6시 방향 (90°)
  ];

  // Wave delay offsets (seconds) - stagger wave starts
  const WAVE_DELAYS = {
    1: 0, // 1차: 즉시 시작
    3: 20, // 3차: 20초 후
    2: 40, // 2차: 40초 후
  };

  // Helper function to generate particle data
  const generateParticle = (
    index: number,
    seededRandom: () => number,
    random: (min: number, max: number) => number,
    randomColor: () => string,
    wave: number // 1 = first wave, 2 = second wave, 3 = third wave
  ) => {
    let startAngle: number;

    // Globe is positioned top-left, so bias particles toward right and bottom
    // Angles: 3시=0°, 6시=90°(π/2), 9시=180°(π), 12시=-90°(-π/2)
    // Target: right-bottom quadrant (1시~7시, -60° ~ 120°)

    if (wave === 3) {
      // Third wave: 75% toward right-bottom, 25% elsewhere
      if (seededRandom() < 0.75) {
        // Right-bottom bias: -60° to 120° (1시~7시)
        startAngle = random(-Math.PI / 3, (2 * Math.PI) / 3);
      } else {
        // Remaining directions with shorter travel
        startAngle = random((2 * Math.PI) / 3, (5 * Math.PI) / 3);
      }
      startAngle += random(-Math.PI / 18, Math.PI / 18); // ±10° jitter
    } else if (wave === 2) {
      // Second wave: target 2시, 4시, 6시 directions with ±15° variation
      const directionIndex = Math.floor(seededRandom() * SECOND_WAVE_DIRECTIONS.length);
      const baseDirection = SECOND_WAVE_DIRECTIONS[directionIndex] ?? SECOND_WAVE_DIRECTIONS[0]!;
      startAngle = baseDirection + random(-Math.PI / 12, Math.PI / 12); // ±15° spread
    } else {
      // First wave: 85% toward right-bottom (1시~7시), 15% elsewhere
      startAngle =
        seededRandom() < 0.85
          ? random(-Math.PI / 3, (2 * Math.PI) / 3) // -60° to 120°
          : random(-Math.PI, Math.PI);
    }

    // Start from inside globe to create emergence effect
    const globeRadius = size / 2;
    const startRadius = globeRadius * 0.65; // Start at 65% of globe radius (inside globe)

    // Particles travel: globe radius (hidden) + visible distance beyond globe
    // Longer travel for right-bottom direction (where more screen space)
    const isRightward = Math.abs(startAngle) < Math.PI / 2; // -90° to 90°
    const isDownward = startAngle > 0 && startAngle < Math.PI; // 0° to 180°
    const isRightBottom = isRightward && isDownward; // 0° to 90° (3시~6시)

    // Travel distance is just the visible distance beyond start point
    // (no longer need to add globeRadius since we start near the edge)
    let travelDistance: number;
    if (isRightBottom) {
      travelDistance = random(200, 500); // Longest: right-bottom
    } else if (isRightward || isDownward) {
      travelDistance = random(150, 350); // Medium: right or bottom
    } else {
      travelDistance = random(60, 150); // Shortest: left-top (less screen space)
    }

    // Calculate travel direction (total distance from center)
    const distanceX = Math.cos(startAngle) * travelDistance;
    const distanceY = Math.sin(startAngle) * travelDistance;

    // Starting position at globe center
    const startX = Math.cos(startAngle) * startRadius;
    const startY = Math.sin(startAngle) * startRadius;

    // Slower animation for smooth, relaxing effect
    // Base duration stored in particle, speed applied via CSS
    const duration = wave === 2 ? random(80, 130) : random(90, 150);
    // Spread particles evenly across animation cycle
    const animationProgress = seededRandom();
    // Apply wave delay offset
    const waveDelay = WAVE_DELAYS[wave as keyof typeof WAVE_DELAYS] || 0;

    // Determine color first
    const color = randomColor();
    const isCoral = color === "#DA7756";

    // Coral particles: reduce large size ratio by 1/5 (30% → 24% large)
    // Non-coral: 70% small, 30% large
    // Coral: 76% small, 24% large
    const smallSizeRatio = isCoral ? 0.76 : 0.7;
    const particleSize =
      seededRandom() < smallSizeRatio
        ? random(1.0, 1.3) // Small
        : random(1.3, 1.5); // Large

    return {
      index,
      startX,
      startY,
      distanceX,
      distanceY,
      duration,
      delay: -animationProgress * duration + waveDelay,
      particleSize,
      opacity: seededRandom() < 0.5 ? 0.7 : 1, // Half at 70%, half at 100%
      color,
      wave,
    };
  };

  // Generate particles with seeded random for consistency
  const particles = useMemo(() => {
    if (!mounted) return [];

    const baseParticleCount = getParticleCount(viewportWidth);
    const firstWaveCount = Math.floor(baseParticleCount / 2); // Half for first wave
    const thirdWaveCount = baseParticleCount - firstWaveCount; // Other half for third wave

    // First wave - main particles (half count, directional bias)
    const seededRandom1 = createSeededRandom(size * 1000 + 42);
    const random1 = (min: number, max: number) => seededRandom1() * (max - min) + min;
    const randomColor1 = () =>
      PARTICLE_COLORS[Math.floor(seededRandom1() * PARTICLE_COLORS.length)] ?? PARTICLE_COLORS[0]!;

    const firstWave = [...Array(firstWaveCount)].map((_, index) =>
      generateParticle(index, seededRandom1, random1, randomColor1, 1)
    );

    // Third wave - 360° uniform distribution (other half)
    const seededRandom3 = createSeededRandom(size * 3000 + 77);
    const random3 = (min: number, max: number) => seededRandom3() * (max - min) + min;
    const randomColor3 = () =>
      PARTICLE_COLORS[Math.floor(seededRandom3() * PARTICLE_COLORS.length)] ?? PARTICLE_COLORS[0]!;

    const thirdWave = [...Array(thirdWaveCount)].map((_, index) =>
      generateParticle(firstWaveCount + index, seededRandom3, random3, randomColor3, 3)
    );

    // Second wave - desktop only (50 extra particles targeting 2시, 4시, 6시)
    if (viewportWidth >= 1024) {
      const seededRandom2 = createSeededRandom(size * 2000 + 99);
      const random2 = (min: number, max: number) => seededRandom2() * (max - min) + min;
      const randomColor2 = () =>
        PARTICLE_COLORS[Math.floor(seededRandom2() * PARTICLE_COLORS.length)] ??
        PARTICLE_COLORS[0]!;

      const secondWave = [...Array(20)].map((_, index) =>
        generateParticle(
          firstWaveCount + thirdWaveCount + index,
          seededRandom2,
          random2,
          randomColor2,
          2
        )
      );

      return [...firstWave, ...thirdWave, ...secondWave];
    }

    return [...firstWave, ...thirdWave];
  }, [size, mounted, viewportWidth]); // speed removed - applied via CSS only

  // Don't render particles until mounted to prevent hydration mismatch
  if (!mounted) {
    return <div className={cn("absolute inset-0 pointer-events-none", className)} />;
  }

  return (
    <div
      className={cn(
        "absolute inset-0 pointer-events-none",
        // Only apply transition during initial fade-in (synced with globe 0.3s)
        !initialFadeComplete && "transition-opacity duration-300 ease-out",
        isVisible ? "opacity-100" : "opacity-0",
        className
      )}
    >
      {particles.map(
        ({
          index,
          startX,
          startY,
          distanceX,
          distanceY,
          duration,
          delay,
          particleSize,
          opacity,
          color,
        }) => (
          <div
            key={`particle-${index}`}
            className="globe-particle absolute rounded-full"
            style={{
              width: particleSize,
              height: particleSize,
              left: `calc(50% + ${startX}px)`,
              top: `calc(50% + ${startY}px)`,
              opacity,
              ["--distance-x" as string]: distanceX,
              ["--distance-y" as string]: distanceY,
              ["--particle-color" as string]: color,
              animationDuration: `${duration / speed}s, ${duration / speed}s`,
              animationDelay: `${delay / speed}s, ${delay / speed}s`,
            }}
          />
        )
      )}
    </div>
  );
};
