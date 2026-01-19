'use client';
import { useEffect, useRef } from 'react';

interface StarsCanvasProps {
  starCount?: number;
  className?: string;
}

export function StarsCanvas({
  starCount = 300,
  className = '',
}: StarsCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = canvas.width = window.innerWidth;
    let h = canvas.height = window.innerHeight;

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
        speed: (Math.random() * 0.0001 + 0.00005),
        radius: Math.random() * 1.2 + 0.5, // 0.5 - 1.7px
        alpha: Math.random() * 0.5 + 0.3,  // Higher base alpha
        targetAlpha: Math.random() * 0.6 + 0.3,
        twinkleSpeed: Math.random() * 0.01 + 0.005,
      });
    }

    // Draw a glowing star
    const drawStar = (x: number, y: number, radius: number, alpha: number) => {
      // Outer glow
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 4);
      gradient.addColorStop(0, `rgba(200, 220, 255, ${alpha * 0.8})`);
      gradient.addColorStop(0.3, `rgba(180, 200, 255, ${alpha * 0.3})`);
      gradient.addColorStop(1, 'transparent');

      ctx.beginPath();
      ctx.arc(x, y, radius * 4, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Core
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fill();
    };

    const animate = () => {
      ctx.fillStyle = 'rgba(10, 10, 12, 0.12)';
      ctx.fillRect(0, 0, w, h);

      for (const star of stars) {
        // Slow orbital movement
        star.angle += star.speed;

        const x = centerX + Math.cos(star.angle) * star.orbitRadius;
        const y = centerY + Math.sin(star.angle) * star.orbitRadius;

        // Gentle twinkle
        if (Math.abs(star.alpha - star.targetAlpha) < 0.02) {
          star.targetAlpha = Math.random() * 0.6 + 0.3;
        }
        star.alpha += (star.targetAlpha - star.alpha) * star.twinkleSpeed;

        drawStar(x, y, star.radius, star.alpha);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    // Initial fill
    ctx.fillStyle = 'rgb(10, 10, 12)';
    ctx.fillRect(0, 0, w, h);

    animate();

    const handleResize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, [starCount]);

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 pointer-events-none ${className}`}
    />
  );
}
