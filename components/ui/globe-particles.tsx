"use client";

import React, { useMemo, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface GlobeParticlesProps {
  size: number;
  className?: string;
}

const PARTICLE_COLORS = ["#FBBF24", "#DA7756", "#DA7756", "#10b981", "#3B82F6"];

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

export const GlobeParticles: React.FC<GlobeParticlesProps> = ({ size, className }) => {
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
    const result: Array<{
      index: number;
      x: number;
      y: number;
      particleSize: number;
      opacity: number;
      color: string;
    }> = [];

    const generateWave = (
      count: number,
      startIndex: number,
      seed: number,
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
        // Place at a random point along the travel path (simulates frozen animation)
        const progress = rng() * 0.6 + 0.4; // 40%~100% of travel distance
        const fromCenter = globeRadius * 0.65 + travel * progress;
        const x = Math.cos(angle) * fromCenter;
        const y = Math.sin(angle) * fromCenter;

        const color = randomColor();
        const isCoral = color === "#DA7756";
        const smallRatio = isCoral ? 0.76 : 0.7;
        const particleSize = rng() < smallRatio ? random(1.0, 1.3) : random(1.3, 1.5);

        result.push({
          index: startIndex + i,
          x,
          y,
          particleSize,
          opacity: rng() < 0.5 ? 0.7 : 1,
          color,
        });
      }
    };

    const firstCount = Math.floor(baseCount / 2);
    const thirdCount = baseCount - firstCount;

    // Wave 1: 85% right-bottom bias
    generateWave(
      firstCount,
      0,
      size * 1000 + 42,
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

    // Wave 3: 75% right-bottom, 25% elsewhere
    generateWave(
      thirdCount,
      firstCount,
      size * 3000 + 77,
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

    // Wave 2: desktop only, 2시/4시/6시 directions
    if (viewportWidth >= 1024) {
      const dirs = [-Math.PI / 3, Math.PI / 6, Math.PI / 2];
      generateWave(
        20,
        baseCount,
        size * 2000 + 99,
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
      {particles.map(({ index, x, y, particleSize, opacity, color }) => (
        <div
          key={`particle-${index}`}
          className="globe-particle absolute rounded-full"
          style={{
            width: particleSize,
            height: particleSize,
            left: `calc(50% + ${x}px)`,
            top: `calc(50% + ${y}px)`,
            opacity,
            ["--particle-color" as string]: color,
          }}
        />
      ))}
    </div>
  );
};
