"use client";

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";

interface GlobeParticlesProps {
  size: number; // Globe size to match
  className?: string;
}

export const GlobeParticles: React.FC<GlobeParticlesProps> = ({ size, className }) => {
  const random = (min: number, max: number) => Math.random() * (max - min) + min;

  // Generate particles that emanate from the globe's outline
  const particles = useMemo(() => {
    const particleCount = 50; // Total particles
    return [...Array(particleCount)].map((_, index) => {
      // Start from globe edge (radius = size/2), go outward
      const startAngle = random(0, Math.PI * 2);
      const startRadius = size / 2 - 5; // Start slightly inside globe outline
      const travelDistance = random(20, 60); // How far to travel outward

      // Calculate travel direction
      const distanceX = Math.cos(startAngle) * travelDistance;
      const distanceY = Math.sin(startAngle) * travelDistance;

      // Starting position on globe outline
      const startX = Math.cos(startAngle) * startRadius;
      const startY = Math.sin(startAngle) * startRadius;

      const duration = random(8, 15);
      return {
        index,
        startX,
        startY,
        distanceX,
        distanceY,
        duration,
        delay: random(-duration, 0), // Negative delay = already mid-animation on load
        particleSize: random(1.5, 2.5), // Similar to country dot size
      };
    });
  }, [size]);

  return (
    <div className={cn("absolute inset-0 pointer-events-none", className)}>
      {particles.map(
        ({ index, startX, startY, distanceX, distanceY, duration, delay, particleSize }) => (
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
              animationDuration: `${duration}s, ${duration}s`,
              animationDelay: `${delay}s, ${delay}s`,
            }}
          />
        )
      )}
    </div>
  );
};
