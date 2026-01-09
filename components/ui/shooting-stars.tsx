"use client";
import { cn } from "@/lib/utils";
import React, { useEffect, useState, useRef, useCallback } from "react";

interface ShootingStar {
  id: number;
  x: number;
  y: number;
  angle: number;
  scale: number;
  speed: number;
  distance: number;
}

interface ShootingStarsProps {
  minSpeed?: number;
  maxSpeed?: number;
  minDelay?: number;
  maxDelay?: number;
  starColor?: string;
  trailColor?: string;
  starWidth?: number;
  starHeight?: number;
  className?: string;
  containerRef?: React.RefObject<HTMLElement | null>;
}

export const ShootingStars: React.FC<ShootingStarsProps> = ({
  minSpeed = 10,
  maxSpeed = 30,
  minDelay = 1200,
  maxDelay = 4200,
  starColor = "#9E00FF",
  trailColor = "#2EB9DF",
  starWidth = 10,
  starHeight = 1,
  className,
  containerRef,
}) => {
  const [star, setStar] = useState<ShootingStar | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const getRandomStartPoint = useCallback(() => {
    const container =
      containerRef?.current || (typeof window !== "undefined" ? document.body : null);
    const width = container?.clientWidth || 800;
    const height = container?.clientHeight || 600;

    const side = Math.floor(Math.random() * 4);
    const offset = Math.random() * width;

    switch (side) {
      case 0:
        return { x: offset, y: 0, angle: 45 };
      case 1:
        return { x: width, y: Math.random() * height, angle: 135 };
      case 2:
        return { x: offset, y: height, angle: 225 };
      case 3:
        return { x: 0, y: Math.random() * height, angle: 315 };
      default:
        return { x: 0, y: 0, angle: 45 };
    }
  }, [containerRef]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const createStar = () => {
      const { x, y, angle } = getRandomStartPoint();
      const newStar: ShootingStar = {
        id: Date.now(),
        x,
        y,
        angle,
        scale: 1,
        speed: Math.random() * (maxSpeed - minSpeed) + minSpeed,
        distance: 0,
      };
      setStar(newStar);

      const randomDelay = Math.random() * (maxDelay - minDelay) + minDelay;
      timeoutId = setTimeout(createStar, randomDelay);
    };

    createStar();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [minSpeed, maxSpeed, minDelay, maxDelay, getRandomStartPoint]);

  useEffect(() => {
    const moveStar = () => {
      if (star) {
        setStar((prevStar) => {
          if (!prevStar) return null;
          const newX = prevStar.x + prevStar.speed * Math.cos((prevStar.angle * Math.PI) / 180);
          const newY = prevStar.y + prevStar.speed * Math.sin((prevStar.angle * Math.PI) / 180);
          const newDistance = prevStar.distance + prevStar.speed;
          const newScale = 1 + newDistance / 100;

          const container =
            containerRef?.current || (typeof window !== "undefined" ? document.body : null);
          const width = container?.clientWidth || 800;
          const height = container?.clientHeight || 600;

          if (newX < -20 || newX > width + 20 || newY < -20 || newY > height + 20) {
            return null;
          }
          return {
            ...prevStar,
            x: newX,
            y: newY,
            distance: newDistance,
            scale: newScale,
          };
        });
      }
    };

    const animationFrame = requestAnimationFrame(moveStar);
    return () => cancelAnimationFrame(animationFrame);
  }, [star, containerRef]);

  return (
    <svg
      ref={svgRef}
      className={cn("w-full h-full absolute inset-0 pointer-events-none", className)}
    >
      {star && (
        <rect
          key={star.id}
          x={star.x}
          y={star.y}
          width={starWidth * star.scale}
          height={starHeight}
          fill={`url(#gradient-${star.id})`}
          transform={`rotate(${star.angle}, ${
            star.x + (starWidth * star.scale) / 2
          }, ${star.y + starHeight / 2})`}
        />
      )}
      <defs>
        <linearGradient id={`gradient-${star?.id || 0}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: trailColor, stopOpacity: 0 }} />
          <stop offset="100%" style={{ stopColor: starColor, stopOpacity: 1 }} />
        </linearGradient>
      </defs>
    </svg>
  );
};
