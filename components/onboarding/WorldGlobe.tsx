"use client";

import { useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { type Country } from "@/lib/constants/countries";

// Simplified world map SVG paths for major countries
const COUNTRY_PATHS: Record<string, { path: string; center: [number, number] }> = {
  US: {
    path: "M 55 90 L 145 90 L 150 115 L 130 130 L 55 130 Z",
    center: [100, 110],
  },
  CA: {
    path: "M 50 40 L 180 40 L 175 85 L 50 85 Z",
    center: [115, 62],
  },
  MX: {
    path: "M 60 130 L 110 130 L 100 165 L 55 155 Z",
    center: [82, 147],
  },
  BR: {
    path: "M 150 175 L 210 150 L 220 220 L 165 250 L 140 210 Z",
    center: [180, 200],
  },
  AR: {
    path: "M 145 250 L 175 250 L 170 320 L 155 340 L 140 290 Z",
    center: [157, 290],
  },
  GB: {
    path: "M 275 70 L 285 60 L 295 75 L 285 85 Z",
    center: [285, 72],
  },
  DE: {
    path: "M 310 75 L 330 70 L 335 95 L 310 100 Z",
    center: [322, 85],
  },
  FR: {
    path: "M 285 85 L 310 80 L 315 110 L 290 115 Z",
    center: [300, 97],
  },
  ES: {
    path: "M 270 105 L 295 100 L 300 130 L 275 135 Z",
    center: [285, 117],
  },
  IT: {
    path: "M 315 100 L 330 95 L 340 135 L 320 140 Z",
    center: [327, 117],
  },
  RU: {
    path: "M 350 30 L 550 30 L 560 90 L 450 100 L 350 80 Z",
    center: [455, 60],
  },
  CN: {
    path: "M 480 100 L 560 85 L 570 160 L 490 170 L 460 140 Z",
    center: [515, 127],
  },
  JP: {
    path: "M 580 105 L 600 95 L 605 130 L 585 140 Z",
    center: [592, 117],
  },
  KR: {
    path: "M 560 115 L 575 110 L 578 135 L 562 140 Z",
    center: [569, 125],
  },
  IN: {
    path: "M 440 140 L 490 130 L 495 200 L 450 220 L 430 180 Z",
    center: [462, 175],
  },
  AU: {
    path: "M 520 250 L 610 240 L 620 310 L 540 320 L 510 280 Z",
    center: [565, 280],
  },
  ZA: {
    path: "M 340 280 L 375 270 L 385 320 L 350 330 Z",
    center: [362, 300],
  },
  EG: {
    path: "M 355 140 L 385 135 L 390 175 L 360 180 Z",
    center: [372, 157],
  },
  SA: {
    path: "M 385 150 L 420 140 L 430 190 L 390 200 Z",
    center: [407, 170],
  },
  AE: {
    path: "M 420 165 L 440 160 L 445 180 L 425 185 Z",
    center: [432, 172],
  },
};

// Continent boundaries for background
const CONTINENTS = [
  // North America
  "M 30 35 Q 80 25 180 35 L 200 50 L 180 85 L 155 95 L 150 120 L 135 135 L 95 165 L 55 155 L 30 130 Z",
  // South America
  "M 95 170 L 150 155 L 175 175 L 225 150 L 235 230 L 180 285 L 160 345 L 145 350 L 130 290 L 125 230 L 115 200 Z",
  // Europe
  "M 260 50 L 350 35 L 365 85 L 335 110 L 265 125 L 250 95 Z",
  // Africa
  "M 265 125 L 335 115 L 395 130 L 410 175 L 395 260 L 340 340 L 290 315 L 260 235 L 255 165 Z",
  // Asia
  "M 350 25 L 600 25 L 615 100 L 580 145 L 495 175 L 425 225 L 380 180 L 400 130 L 365 85 Z",
  // Australia
  "M 500 235 L 625 230 L 640 320 L 540 340 L 490 290 Z",
];

interface WorldGlobeProps {
  countries: Country[];
  selectedCountry: string;
  onSelectCountry: (code: string) => void;
  hoveredCountry: string | null;
  onHoverCountry: (code: string | null) => void;
}

export function WorldGlobe({
  countries,
  selectedCountry,
  onSelectCountry,
  hoveredCountry,
  onHoverCountry,
}: WorldGlobeProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number }>>([]);

  const handleCountryClick = useCallback(
    (code: string, center: [number, number]) => {
      onSelectCountry(code);

      // Generate celebration particles
      const newParticles = Array.from({ length: 12 }, (_, i) => ({
        id: Date.now() + i,
        x: center[0],
        y: center[1],
      }));
      setParticles((prev) => [...prev, ...newParticles]);

      // Clean up particles after animation
      setTimeout(() => {
        setParticles((prev) => prev.filter((p) => !newParticles.find((np) => np.id === p.id)));
      }, 1000);
    },
    [onSelectCountry]
  );

  return (
    <div className="relative w-full aspect-[2/1] max-w-2xl mx-auto">
      {/* Glow background */}
      <div className="absolute inset-0 bg-gradient-radial from-primary/5 via-transparent to-transparent opacity-50" />

      <svg
        ref={svgRef}
        viewBox="0 0 650 360"
        className="w-full h-full"
        style={{ filter: "drop-shadow(0 0 20px rgba(218, 119, 86, 0.1))" }}
      >
        {/* Background gradient */}
        <defs>
          <linearGradient id="globeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(218, 119, 86, 0.03)" />
            <stop offset="100%" stopColor="rgba(218, 119, 86, 0.01)" />
          </linearGradient>
          <linearGradient id="selectedGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#DA7756" />
            <stop offset="100%" stopColor="#B85C3D" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="strongGlow">
            <feGaussianBlur stdDeviation="6" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Continents background */}
        {CONTINENTS.map((path, i) => (
          <path
            key={`continent-${i}`}
            d={path}
            fill="url(#globeGradient)"
            stroke="rgba(218, 119, 86, 0.1)"
            strokeWidth="1"
            className="transition-all duration-300"
          />
        ))}

        {/* Country regions */}
        {Object.entries(COUNTRY_PATHS).map(([code, { path, center }]) => {
          const isSelected = selectedCountry === code;
          const isHovered = hoveredCountry === code;
          const country = countries.find((c) => c.code === code);

          return (
            <g key={code}>
              <motion.path
                d={path}
                fill={
                  isSelected
                    ? "url(#selectedGradient)"
                    : isHovered
                      ? "rgba(218, 119, 86, 0.3)"
                      : "rgba(218, 119, 86, 0.1)"
                }
                stroke={isSelected ? "#DA7756" : isHovered ? "#DA7756" : "rgba(218, 119, 86, 0.2)"}
                strokeWidth={isSelected ? 2 : 1}
                filter={isSelected ? "url(#strongGlow)" : isHovered ? "url(#glow)" : undefined}
                className="cursor-pointer transition-colors"
                onClick={() => handleCountryClick(code, center)}
                onMouseEnter={() => onHoverCountry(code)}
                onMouseLeave={() => onHoverCountry(null)}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{
                  opacity: 1,
                  scale: isSelected ? 1.02 : 1,
                }}
                transition={{ duration: 0.3 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              />

              {/* Country flag emoji */}
              {country && (
                <motion.text
                  x={center[0]}
                  y={center[1]}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="pointer-events-none select-none"
                  style={{ fontSize: isSelected || isHovered ? "16px" : "12px" }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: isSelected || isHovered ? 1 : 0.6 }}
                  transition={{ duration: 0.2 }}
                >
                  {country.flag}
                </motion.text>
              )}
            </g>
          );
        })}

        {/* Celebration particles */}
        <AnimatePresence>
          {particles.map((particle) => (
            <motion.circle
              key={particle.id}
              cx={particle.x}
              cy={particle.y}
              r={3}
              fill="#DA7756"
              initial={{ opacity: 1, scale: 0 }}
              animate={{
                opacity: 0,
                scale: 2,
                x: particle.x + (Math.random() - 0.5) * 60,
                y: particle.y + (Math.random() - 0.5) * 60,
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          ))}
        </AnimatePresence>
      </svg>

      {/* Hover tooltip */}
      <AnimatePresence>
        {hoveredCountry && !selectedCountry && (
          <motion.div
            className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-bg-elevated/90 backdrop-blur-sm border border-white/10 text-sm"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <span className="text-lg mr-2">
              {countries.find((c) => c.code === hoveredCountry)?.flag}
            </span>
            <span className="text-text-primary font-medium">
              {countries.find((c) => c.code === hoveredCountry)?.name}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
