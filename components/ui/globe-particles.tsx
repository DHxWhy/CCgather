"use client";

import React, { useMemo, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface GlobeParticlesProps {
  size: number; // Globe size to match
  className?: string;
}

// Leaderboard signature colors
const PARTICLE_COLORS = [
  "#FBBF24", // Yellow/Gold (1st place)
  "#DA7756", // Claude Coral (signature)
  "#10b981", // Emerald Green
  "#3B82F6", // Blue
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
  if (viewportWidth >= 1024) return 150; // Desktop: 150 particles
  if (viewportWidth >= 768) return 100; // Tablet: 100 particles
  return 60; // Mobile: 60 particles
}

export const GlobeParticles: React.FC<GlobeParticlesProps> = ({ size, className }) => {
  // Use mounted state to prevent hydration mismatch
  const [mounted, setMounted] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(1024); // Default to desktop

  useEffect(() => {
    setMounted(true);
    setViewportWidth(window.innerWidth);

    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
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
    wave: number, // 1 = first wave, 2 = second wave, 3 = third wave
    waveIndex?: number, // Index within the wave (for 3rd wave uniform distribution)
    waveTotal?: number // Total particles in the wave (for 3rd wave uniform distribution)
  ) => {
    let startAngle: number;

    if (wave === 3) {
      // Third wave: 360° uniform distribution
      const baseAngle = ((waveIndex || 0) / (waveTotal || 1)) * 2 * Math.PI;
      startAngle = baseAngle + random(-Math.PI / 18, Math.PI / 18); // ±10° jitter
    } else if (wave === 2) {
      // Second wave: target 2시, 4시, 6시 directions with ±15° variation
      const directionIndex = Math.floor(seededRandom() * SECOND_WAVE_DIRECTIONS.length);
      const baseDirection = SECOND_WAVE_DIRECTIONS[directionIndex] ?? SECOND_WAVE_DIRECTIONS[0]!;
      startAngle = baseDirection + random(-Math.PI / 12, Math.PI / 12); // ±15° spread
    } else {
      // First wave: 70% towards 2:30-6:30, 30% all directions
      startAngle =
        seededRandom() < 0.7
          ? random(-Math.PI / 12, (7 * Math.PI) / 12)
          : random(-Math.PI, Math.PI);
    }

    const startRadius = size / 2 - 5; // Start slightly inside globe outline

    // Particles going right travel further (150-400px), others travel less (80-200px)
    const isRightward = Math.abs(startAngle) < Math.PI / 2;
    const travelDistance = isRightward ? random(150, 400) : random(80, 200);

    // Calculate travel direction
    const distanceX = Math.cos(startAngle) * travelDistance;
    const distanceY = Math.sin(startAngle) * travelDistance;

    // Starting position on globe outline
    const startX = Math.cos(startAngle) * startRadius;
    const startY = Math.sin(startAngle) * startRadius;

    // Second wave: slightly faster for variety
    const duration = wave === 2 ? random(45, 80) : random(53, 95);
    // Spread particles evenly across animation cycle
    const animationProgress = seededRandom();
    // Apply wave delay offset
    const waveDelay = WAVE_DELAYS[wave as keyof typeof WAVE_DELAYS] || 0;

    return {
      index,
      startX,
      startY,
      distanceX,
      distanceY,
      duration,
      delay: -animationProgress * duration + waveDelay,
      particleSize: seededRandom() < 0.7 ? random(1.0, 1.3) : random(1.3, 1.5),
      color: randomColor(),
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
      generateParticle(
        firstWaveCount + index,
        seededRandom3,
        random3,
        randomColor3,
        3,
        index,
        thirdWaveCount
      )
    );

    // Second wave - desktop only (50 extra particles targeting 2시, 4시, 6시)
    if (viewportWidth >= 1024) {
      const seededRandom2 = createSeededRandom(size * 2000 + 99);
      const random2 = (min: number, max: number) => seededRandom2() * (max - min) + min;
      const randomColor2 = () =>
        PARTICLE_COLORS[Math.floor(seededRandom2() * PARTICLE_COLORS.length)] ??
        PARTICLE_COLORS[0]!;

      const secondWave = [...Array(50)].map((_, index) =>
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
  }, [size, mounted, viewportWidth]);

  // Don't render particles until mounted to prevent hydration mismatch
  if (!mounted) {
    return <div className={cn("absolute inset-0 pointer-events-none", className)} />;
  }

  return (
    <div className={cn("absolute inset-0 pointer-events-none", className)}>
      {particles.map(
        ({ index, startX, startY, distanceX, distanceY, duration, delay, particleSize, color }) => (
          <div
            key={`particle-${index}`}
            className="globe-particle absolute rounded-full"
            style={{
              width: particleSize,
              height: particleSize,
              left: `calc(50% + ${startX}px)`,
              top: `calc(50% + ${startY}px)`,
              ["--distance-x" as string]: distanceX,
              ["--distance-y" as string]: distanceY,
              ["--particle-color" as string]: color,
              animationDuration: `${duration}s, ${duration}s`,
              animationDelay: `${delay}s, ${delay}s`,
            }}
          />
        )
      )}
    </div>
  );
};
