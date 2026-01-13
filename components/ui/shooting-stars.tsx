"use client";
import { cn } from "@/lib/utils";
import React, { useEffect, useRef, useCallback } from "react";

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
  const svgRef = useRef<SVGSVGElement>(null);
  const rectRef = useRef<SVGRectElement>(null);
  const starRef = useRef<ShootingStar | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const gradientIdRef = useRef(`shooting-star-gradient-${Math.random().toString(36).slice(2)}`);

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

  const updateStarElement = useCallback(() => {
    const star = starRef.current;
    const rect = rectRef.current;
    if (!star || !rect) return;

    const currentWidth = starWidth * star.scale;
    rect.setAttribute("x", String(star.x));
    rect.setAttribute("y", String(star.y));
    rect.setAttribute("width", String(currentWidth));
    rect.setAttribute(
      "transform",
      `rotate(${star.angle}, ${star.x + currentWidth / 2}, ${star.y + starHeight / 2})`
    );
    rect.style.opacity = "1";
  }, [starWidth, starHeight]);

  const hideStarElement = useCallback(() => {
    const rect = rectRef.current;
    if (rect) {
      rect.style.opacity = "0";
    }
  }, []);

  const animate = useCallback(() => {
    const star = starRef.current;
    if (!star) {
      animationFrameRef.current = requestAnimationFrame(animate);
      return;
    }

    // Update star position
    star.x += star.speed * Math.cos((star.angle * Math.PI) / 180);
    star.y += star.speed * Math.sin((star.angle * Math.PI) / 180);
    star.distance += star.speed;
    star.scale = 1 + star.distance / 100;

    // Check bounds
    const container =
      containerRef?.current || (typeof window !== "undefined" ? document.body : null);
    const width = container?.clientWidth || 800;
    const height = container?.clientHeight || 600;

    if (star.x < -20 || star.x > width + 20 || star.y < -20 || star.y > height + 20) {
      starRef.current = null;
      hideStarElement();
    } else {
      updateStarElement();
    }

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [containerRef, updateStarElement, hideStarElement]);

  const createStar = useCallback(() => {
    const { x, y, angle } = getRandomStartPoint();
    starRef.current = {
      id: Date.now(),
      x,
      y,
      angle,
      scale: 1,
      speed: Math.random() * (maxSpeed - minSpeed) + minSpeed,
      distance: 0,
    };

    const randomDelay = Math.random() * (maxDelay - minDelay) + minDelay;
    timeoutRef.current = setTimeout(createStar, randomDelay);
  }, [getRandomStartPoint, minSpeed, maxSpeed, minDelay, maxDelay]);

  useEffect(() => {
    // Start creating stars
    createStar();
    // Start animation loop (single loop for entire lifecycle)
    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [createStar, animate]);

  return (
    <svg
      ref={svgRef}
      className={cn("w-full h-full absolute inset-0 pointer-events-none", className)}
    >
      <defs>
        <linearGradient id={gradientIdRef.current} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: trailColor, stopOpacity: 0 }} />
          <stop offset="100%" style={{ stopColor: starColor, stopOpacity: 1 }} />
        </linearGradient>
      </defs>
      <rect
        ref={rectRef}
        x="0"
        y="0"
        width={starWidth}
        height={starHeight}
        fill={`url(#${gradientIdRef.current})`}
        style={{ opacity: 0 }}
      />
    </svg>
  );
};
