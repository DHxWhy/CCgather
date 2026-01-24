"use client";

import { useEffect, useState, useCallback } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type TTheme = "light" | "dark";

interface ThemeSwitcherProps {
  className?: string;
  size?: "sm" | "md";
}

export function ThemeSwitcher({ className, size = "md" }: ThemeSwitcherProps) {
  const [theme, setTheme] = useState<TTheme>("dark");
  const [mounted, setMounted] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Initialize theme from localStorage (default to dark)
  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("theme") as TTheme | null;
    if (stored && ["light", "dark"].includes(stored)) {
      setTheme(stored);
    } else {
      setTheme("dark");
      localStorage.setItem("theme", "dark");
    }
  }, []);

  // Apply theme with View Transitions API for smooth crossfade
  const applyTheme = useCallback((newTheme: TTheme, animate = true) => {
    const root = document.documentElement;
    const updateDOM = () => {
      root.classList.toggle("light", newTheme === "light");
    };

    // Use View Transitions API if available for smooth crossfade
    if (animate && "startViewTransition" in document) {
      (document as any).startViewTransition(() => {
        updateDOM();
      });
    } else {
      updateDOM();
    }
  }, []);

  // Handle theme change
  useEffect(() => {
    if (!mounted) return;
    // Skip animation on initial load
    const isInitialLoad = !document.documentElement.classList.contains("light") && theme === "dark";
    applyTheme(theme, !isInitialLoad);
    localStorage.setItem("theme", theme);
  }, [theme, mounted, applyTheme]);

  // Toggle theme with animation
  const toggleTheme = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setTheme(theme === "dark" ? "light" : "dark");
    // Reset animation state after animation completes
    setTimeout(() => setIsAnimating(false), 600);
  };

  // Size variants
  const sizes = {
    sm: {
      container: "w-8 h-8",
      icon: 16,
    },
    md: {
      container: "w-10 h-10",
      icon: 20,
    },
  };

  const currentSize = sizes[size];

  // Prevent hydration mismatch with skeleton
  if (!mounted) {
    return (
      <div
        className={cn(
          "rounded-full border border-[var(--border-default)] bg-transparent",
          currentSize.container,
          className
        )}
      />
    );
  }

  return (
    <button
      onClick={toggleTheme}
      disabled={isAnimating}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "relative rounded-full overflow-hidden",
        "border border-[var(--border-default)]",
        "bg-[var(--color-bg-secondary)]",
        "hover:border-[var(--color-claude-coral)]/50",
        "focus-visible:ring-2 focus-visible:ring-[var(--color-claude-coral)] focus-visible:ring-offset-1",
        "transition-colors duration-300",
        "cursor-pointer",
        currentSize.container,
        className
      )}
    >
      {/* Moon icon - soft yellow/cream color */}
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center",
          "text-amber-200",
          theme === "dark"
            ? isAnimating
              ? "animate-celestial-rise"
              : "translate-x-0 translate-y-0 opacity-100"
            : isAnimating
              ? "animate-celestial-fall"
              : "translate-x-[-150%] translate-y-[150%] opacity-0"
        )}
      >
        <Moon
          size={currentSize.icon}
          className="drop-shadow-[0_0_8px_rgba(252,211,77,0.6)]"
          fill="currentColor"
        />
      </div>

      {/* Sun icon - warm orange/gold color */}
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center",
          "text-orange-400",
          theme === "light"
            ? isAnimating
              ? "animate-celestial-rise"
              : "translate-x-0 translate-y-0 opacity-100"
            : isAnimating
              ? "animate-celestial-fall"
              : "translate-x-[-150%] translate-y-[150%] opacity-0"
        )}
      >
        <Sun size={currentSize.icon} className="drop-shadow-[0_0_10px_rgba(251,146,60,0.7)]" />
      </div>
    </button>
  );
}

export default ThemeSwitcher;
