"use client";

import React, { useMemo, type JSX } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ShimmerTextProps {
  children: string;
  as?: React.ElementType;
  className?: string;
  /** Animation duration in seconds */
  duration?: number;
  /** Spread of the shimmer highlight */
  spread?: number;
}

/**
 * Text shimmer effect using framer-motion
 * The text itself has a moving highlight/shimmer effect
 *
 * Use for: "Auto-translate", "Translating...", status text
 * Different from TextShimmer (skeleton placeholder)
 */
export function ShimmerText({
  children,
  as: Component = "span",
  className,
  duration = 1.5,
  spread = 6, // Wider spread for more visible effect
}: ShimmerTextProps) {
  const MotionComponent = motion.create(Component as keyof JSX.IntrinsicElements);

  const dynamicSpread = useMemo(() => {
    return children.length * spread;
  }, [children, spread]);

  return (
    <MotionComponent
      className={cn(
        "relative inline-block bg-[length:300%_100%,auto] bg-clip-text",
        "text-transparent",
        // Cyan base with bright white shimmer
        "[--base-color:#06b6d4] [--base-gradient-color:#ffffff]",
        // Wider, more visible gradient sweep
        "[--bg:linear-gradient(90deg,#0000_calc(50%-var(--spread)),var(--base-gradient-color)_50%,#0000_calc(50%+var(--spread)))]",
        "[background-repeat:no-repeat,padding-box]",
        // Dark mode
        "dark:[--base-color:#22d3ee] dark:[--base-gradient-color:#ffffff]",
        className
      )}
      initial={{ backgroundPosition: "100% center" }}
      animate={{ backgroundPosition: "0% center" }}
      transition={{
        repeat: Infinity,
        duration,
        ease: "linear",
      }}
      style={
        {
          "--spread": `${dynamicSpread}px`,
          backgroundImage: `var(--bg), linear-gradient(var(--base-color), var(--base-color))`,
          filter: "drop-shadow(0 0 4px rgba(34, 211, 238, 0.5))",
        } as React.CSSProperties
      }
    >
      {children}
    </MotionComponent>
  );
}

export default ShimmerText;
