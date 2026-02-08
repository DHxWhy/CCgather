"use client";

import React, { useMemo, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface GlobeParticlesProps {
  size: number;
  className?: string;
  animated?: boolean;
}

const PARTICLE_COLORS = ["#FBBF24", "#DA7756", "#DA7756", "#10b981", "#3B82F6"];

const WAVE_DELAYS = { 1: 0, 3: 20, 2: 40 };

function createSeededRandom(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

function getParticleCount(viewportWidth: number): number {
  if (viewportWidth >= 1024) return 100;
  if (viewportWidth >= 768) return 70;
  return 40;
}

interface Particle {
  index: number;
  startX: number;
  startY: number;
  distanceX: number;
  distanceY: number;
  staticX: number;
  staticY: number;
  duration: number;
  delay: number;
  particleSize: number;
  opacity: number;
  color: string;
}

export const GlobeParticles: React.FC<GlobeParticlesProps> = ({
  size,
  className,
  animated = false,
}) => {
  const [mounted, setMounted] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(1024);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
    setViewportWidth(window.innerWidth);
    requestAnimationFrame(() => setIsVisible(true));

    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const particles = useMemo(() => {
    if (!mounted) return [];

    const baseCount = getParticleCount(viewportWidth);
    const globeRadius = size / 2;
    const result: Particle[] = [];

    const generateWave = (
      count: number,
      startIndex: number,
      seed: number,
      wave: number,
      angleFn: (rng: () => number, random: (min: number, max: number) => number) => number,
      distanceFn: (angle: number, random: (min: number, max: number) => number) => number
    ) => {
      const rng = createSeededRandom(seed);
      const random = (min: number, max: number) => rng() * (max - min) + min;
      const randomColor = () =>
        PARTICLE_COLORS[Math.floor(rng() * PARTICLE_COLORS.length)] ?? PARTICLE_COLORS[0]!;

      for (let i = 0; i < count; i++) {
        const angle = angleFn(rng, random);
        const travel = distanceFn(angle, random);

        const startRadius = globeRadius * 0.65;
        const startX = Math.cos(angle) * startRadius;
        const startY = Math.sin(angle) * startRadius;
        const distanceX = Math.cos(angle) * travel;
        const distanceY = Math.sin(angle) * travel;

        // Static position: frozen at random point along travel path
        const progress = rng() * 0.6 + 0.4;
        const fromCenter = startRadius + travel * progress;
        const staticX = Math.cos(angle) * fromCenter;
        const staticY = Math.sin(angle) * fromCenter;

        // Animation timing
        const duration = wave === 2 ? random(80, 130) : random(90, 150);
        const animationProgress = rng();
        const waveDelay = WAVE_DELAYS[wave as keyof typeof WAVE_DELAYS] || 0;

        const color = randomColor();
        const isCoral = color === "#DA7756";
        const smallRatio = isCoral ? 0.76 : 0.7;
        const particleSize = rng() < smallRatio ? random(1.0, 1.3) : random(1.3, 1.5);

        result.push({
          index: startIndex + i,
          startX,
          startY,
          distanceX,
          distanceY,
          staticX,
          staticY,
          duration,
          delay: -animationProgress * duration + waveDelay,
          particleSize,
          opacity: rng() < 0.5 ? 0.7 : 1,
          color,
        });
      }
    };

    const firstCount = Math.floor(baseCount / 2);
    const thirdCount = baseCount - firstCount;

    generateWave(
      firstCount,
      0,
      size * 1000 + 42,
      1,
      (rng, random) =>
        rng() < 0.85 ? random(-Math.PI / 3, (2 * Math.PI) / 3) : random(-Math.PI, Math.PI),
      (angle, random) => {
        const isRight = Math.abs(angle) < Math.PI / 2;
        const isDown = angle > 0 && angle < Math.PI;
        if (isRight && isDown) return random(200, 500);
        if (isRight || isDown) return random(150, 350);
        return random(60, 150);
      }
    );

    generateWave(
      thirdCount,
      firstCount,
      size * 3000 + 77,
      3,
      (rng, random) => {
        let angle: number;
        if (rng() < 0.75) {
          angle = random(-Math.PI / 3, (2 * Math.PI) / 3);
        } else {
          angle = random((2 * Math.PI) / 3, (5 * Math.PI) / 3);
        }
        return angle + random(-Math.PI / 18, Math.PI / 18);
      },
      (angle, random) => {
        const isRight = Math.abs(angle) < Math.PI / 2;
        const isDown = angle > 0 && angle < Math.PI;
        if (isRight && isDown) return random(200, 500);
        if (isRight || isDown) return random(150, 350);
        return random(60, 150);
      }
    );

    if (viewportWidth >= 1024) {
      const dirs = [-Math.PI / 3, Math.PI / 6, Math.PI / 2];
      generateWave(
        20,
        baseCount,
        size * 2000 + 99,
        2,
        (rng, random) => {
          const base = dirs[Math.floor(rng() * dirs.length)] ?? dirs[0]!;
          return base + random(-Math.PI / 12, Math.PI / 12);
        },
        (_angle, random) => random(150, 350)
      );
    }

    return result;
  }, [size, mounted, viewportWidth]);

  if (!mounted) {
    return <div className={cn("absolute inset-0 pointer-events-none", className)} />;
  }

  return (
    <div
      className={cn(
        "absolute inset-0 pointer-events-none transition-opacity duration-300 ease-out",
        isVisible ? "opacity-100" : "opacity-0",
        className
      )}
    >
      {particles.map((p) => (
        <div
          key={`particle-${p.index}`}
          className={`absolute rounded-full ${animated ? "globe-particle-animated" : "globe-particle"}`}
          style={
            animated
              ? {
                  width: p.particleSize,
                  height: p.particleSize,
                  left: `calc(50% + ${p.startX}px)`,
                  top: `calc(50% + ${p.startY}px)`,
                  opacity: p.opacity,
                  ["--distance-x" as string]: p.distanceX,
                  ["--distance-y" as string]: p.distanceY,
                  ["--particle-color" as string]: p.color,
                  animationDuration: `${p.duration}s, ${p.duration}s`,
                  animationDelay: `${p.delay}s, ${p.delay}s`,
                }
              : {
                  width: p.particleSize,
                  height: p.particleSize,
                  left: `calc(50% + ${p.staticX}px)`,
                  top: `calc(50% + ${p.staticY}px)`,
                  opacity: p.opacity,
                  ["--particle-color" as string]: p.color,
                }
          }
        />
      ))}
    </div>
  );
};
