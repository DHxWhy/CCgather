"use client";

import React, { useMemo } from "react";
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

export const GlobeParticles: React.FC<GlobeParticlesProps> = ({ size, className }) => {
  const random = (min: number, max: number) => Math.random() * (max - min) + min;
  const randomColor = () => PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)];

  // Generate particles that emanate from the globe's outline
  // Reduce particle count for smaller globes to improve performance
  // Bias towards right side to match globe's rightward rotation
  const particles = useMemo(() => {
    const particleCount = size >= 300 ? 200 : size >= 250 ? 130 : 80;
    return [...Array(particleCount)].map((_, index) => {
      // Start from globe edge (radius = size/2), go outward
      // Clock direction: 12h=-90°, 3h=0°, 6h=90°, 9h=180°
      // 2:30 = -15° (-π/12), 6:30 = 105° (7π/12)
      // 70% towards 2:30-6:30 direction, 30% all directions
      const startAngle =
        Math.random() < 0.7
          ? random(-Math.PI / 12, (7 * Math.PI) / 12) // 70%: 2:30 to 6:30 (-15° to 105°)
          : random(-Math.PI, Math.PI); // 30%: full circle
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

      const duration = random(38, 68); // Ultra slow for elegant, dreamy effect (+20% slower)
      return {
        index,
        startX,
        startY,
        distanceX,
        distanceY,
        duration,
        delay: random(-duration, 0), // Negative delay = already mid-animation on load
        particleSize: Math.random() < 0.7 ? random(1.0, 1.3) : random(1.3, 1.5), // 70% small, 30% medium
        color: randomColor(), // Random leaderboard color
      };
    });
  }, [size]);

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
