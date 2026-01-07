"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ConfettiPiece {
  id: number;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  color: string;
  delay: number;
  type: "circle" | "square" | "triangle" | "star";
}

const COLORS = [
  "#DA7756", // Claude coral
  "#E8A087", // Claude peach
  "#F7931E", // Orange
  "#FFD700", // Gold
  "#10b981", // Emerald
  "#3b82f6", // Blue
  "#8b5cf6", // Purple
  "#ec4899", // Pink
];

const SHAPES: ConfettiPiece["type"][] = ["circle", "square", "triangle", "star"];

function getRandomColor(): string {
  const index = Math.floor(Math.random() * COLORS.length);
  return COLORS[index] ?? "#DA7756";
}

function getRandomShape(): ConfettiPiece["type"] {
  const index = Math.floor(Math.random() * SHAPES.length);
  return SHAPES[index] ?? "circle";
}

function generateConfetti(count: number): ConfettiPiece[] {
  return Array.from({ length: count }, (_, i) => ({
    id: Date.now() + i,
    x: Math.random() * 100,
    y: -10 - Math.random() * 20,
    rotation: Math.random() * 360,
    scale: 0.5 + Math.random() * 1,
    color: getRandomColor(),
    delay: Math.random() * 0.3,
    type: getRandomShape(),
  }));
}

interface ConfettiProps {
  active: boolean;
  duration?: number;
}

export function Confetti({ active, duration = 3000 }: ConfettiProps) {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);

  useEffect(() => {
    if (!active) {
      return;
    }

    setPieces(generateConfetti(50));

    const timer = setTimeout(() => {
      setPieces([]);
    }, duration);

    return () => clearTimeout(timer);
  }, [active, duration]);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      <AnimatePresence>
        {pieces.map((piece) => (
          <motion.div
            key={piece.id}
            className="absolute"
            initial={{
              left: `${piece.x}%`,
              top: `${piece.y}%`,
              rotate: 0,
              scale: 0,
              opacity: 1,
            }}
            animate={{
              top: "120%",
              rotate: piece.rotation + 720,
              scale: piece.scale,
              opacity: [1, 1, 0],
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 2 + Math.random(),
              delay: piece.delay,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
            style={{
              left: `${piece.x}%`,
            }}
          >
            <ConfettiShape type={piece.type} color={piece.color} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function ConfettiShape({ type, color }: { type: ConfettiPiece["type"]; color: string }) {
  const size = "w-3 h-3";

  switch (type) {
    case "circle":
      return <div className={`${size} rounded-full`} style={{ backgroundColor: color }} />;
    case "square":
      return <div className={`${size} rounded-sm`} style={{ backgroundColor: color }} />;
    case "triangle":
      return (
        <div
          className="w-0 h-0"
          style={{
            borderLeft: "6px solid transparent",
            borderRight: "6px solid transparent",
            borderBottom: `12px solid ${color}`,
          }}
        />
      );
    case "star":
      return (
        <svg className={size} viewBox="0 0 24 24" fill={color}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      );
  }
}

// Burst effect for selection celebration
interface BurstProps {
  active: boolean;
  x?: number;
  y?: number;
}

export function SelectionBurst({ active, x = 50, y = 50 }: BurstProps) {
  const [particles, setParticles] = useState<
    Array<{
      id: number;
      angle: number;
      distance: number;
      size: number;
      color: string;
    }>
  >([]);

  useEffect(() => {
    if (!active) {
      return;
    }

    const newParticles = Array.from({ length: 16 }, (_, i) => ({
      id: Date.now() + i,
      angle: (360 / 16) * i,
      distance: 60 + Math.random() * 40,
      size: 4 + Math.random() * 4,
      color: getRandomColor(),
    }));
    setParticles(newParticles);

    const timer = setTimeout(() => setParticles([]), 800);
    return () => clearTimeout(timer);
  }, [active]);

  return (
    <div
      className="fixed pointer-events-none z-50"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: "translate(-50%, -50%)",
      }}
    >
      <AnimatePresence>
        {particles.map((particle) => {
          const rad = (particle.angle * Math.PI) / 180;
          const endX = Math.cos(rad) * particle.distance;
          const endY = Math.sin(rad) * particle.distance;

          return (
            <motion.div
              key={particle.id}
              className="absolute rounded-full"
              style={{
                width: particle.size,
                height: particle.size,
                backgroundColor: particle.color,
                left: "50%",
                top: "50%",
                marginLeft: -particle.size / 2,
                marginTop: -particle.size / 2,
              }}
              initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
              animate={{
                x: endX,
                y: endY,
                scale: 0,
                opacity: 0,
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 0.6,
                ease: "easeOut",
              }}
            />
          );
        })}
      </AnimatePresence>

      {/* Center ring effect */}
      <AnimatePresence>
        {active && (
          <motion.div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary"
            initial={{ width: 0, height: 0, opacity: 1 }}
            animate={{ width: 120, height: 120, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Sparkle effect for floating particles
export function SparkleEffect({ active }: { active: boolean }) {
  const [sparkles, setSparkles] = useState<
    Array<{
      id: number;
      x: number;
      y: number;
      size: number;
      delay: number;
    }>
  >([]);

  useEffect(() => {
    if (!active) {
      setSparkles([]);
      return;
    }

    const interval = setInterval(() => {
      setSparkles((prev) => [
        ...prev.slice(-20),
        {
          id: Date.now(),
          x: Math.random() * 100,
          y: Math.random() * 100,
          size: 2 + Math.random() * 4,
          delay: 0,
        },
      ]);
    }, 200);

    return () => clearInterval(interval);
  }, [active]);

  return (
    <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
      <AnimatePresence>
        {sparkles.map((sparkle) => (
          <motion.div
            key={sparkle.id}
            className="absolute"
            style={{
              left: `${sparkle.x}%`,
              top: `${sparkle.y}%`,
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{
              scale: [0, 1, 0],
              opacity: [0, 1, 0],
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1, ease: "easeInOut" }}
          >
            <svg
              width={sparkle.size * 4}
              height={sparkle.size * 4}
              viewBox="0 0 24 24"
              fill="#DA7756"
              className="opacity-60"
            >
              <path d="M12 2l1.5 6.5L20 10l-6.5 1.5L12 18l-1.5-6.5L4 10l6.5-1.5L12 2z" />
            </svg>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
