"use client";
import { useEffect, useRef } from "react";

interface StarsCanvasProps {
  starCount?: number;
  className?: string;
}

export function StarsCanvas({ starCount = 500, className = "" }: StarsCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);

    const centerX = w / 2;
    const centerY = h / 2;
    const maxOrbit = Math.sqrt(w * w + h * h) / 2;

    interface Star {
      orbitRadius: number;
      angle: number;
      speed: number;
      radius: number;
      alpha: number;
      targetAlpha: number;
      twinkleSpeed: number;
    }

    const stars: Star[] = [];

    for (let i = 0; i < starCount; i++) {
      stars.push({
        orbitRadius: Math.random() * maxOrbit,
        angle: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.0001 + 0.00005,
        radius: Math.random() * 0.5 + 0.3, // 0.3 - 0.8px (smaller)
        alpha: Math.random() * 0.4 + 0.2, // 0.2 - 0.6 (subtler)
        targetAlpha: Math.random() * 0.7 + 0.1, // wider range for more variation
        twinkleSpeed: Math.random() * 0.02 + 0.003, // faster, more random twinkle
      });
    }

    // Draw a subtle glowing star
    const drawStar = (x: number, y: number, radius: number, alpha: number) => {
      // Subtle outer glow (smaller)
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 2);
      gradient.addColorStop(0, `rgba(220, 230, 255, ${alpha * 0.6})`);
      gradient.addColorStop(0.5, `rgba(200, 210, 255, ${alpha * 0.2})`);
      gradient.addColorStop(1, "transparent");

      ctx.beginPath();
      ctx.arc(x, y, radius * 2, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Tiny core
      ctx.beginPath();
      ctx.arc(x, y, radius * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fill();
    };

    const animate = () => {
      ctx.fillStyle = "rgba(10, 10, 12, 0.12)";
      ctx.fillRect(0, 0, w, h);

      for (const star of stars) {
        // Slow orbital movement
        star.angle += star.speed;

        const x = centerX + Math.cos(star.angle) * star.orbitRadius;
        const y = centerY + Math.sin(star.angle) * star.orbitRadius;

        // Random twinkle with wider variation
        if (Math.abs(star.alpha - star.targetAlpha) < 0.02) {
          star.targetAlpha = Math.random() * 0.7 + 0.1; // 0.1 - 0.8 range
        }
        star.alpha += (star.targetAlpha - star.alpha) * star.twinkleSpeed;

        drawStar(x, y, star.radius, star.alpha);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    // Initial fill
    ctx.fillStyle = "rgb(10, 10, 12)";
    ctx.fillRect(0, 0, w, h);

    animate();

    const handleResize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", handleResize);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      window.removeEventListener("resize", handleResize);
    };
  }, [starCount]);

  return <canvas ref={canvasRef} className={`fixed inset-0 pointer-events-none ${className}`} />;
}
