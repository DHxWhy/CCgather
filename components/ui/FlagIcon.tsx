"use client";

import { useState } from "react";
import * as Flags from "country-flag-icons/react/3x2";

interface FlagIconProps {
  countryCode: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
  fallbackEmoji?: string;
}

const sizeMap = {
  xs: { width: 16, height: 11, fontSize: "text-sm" },
  sm: { width: 20, height: 14, fontSize: "text-base" },
  md: { width: 28, height: 19, fontSize: "text-lg" },
  lg: { width: 40, height: 27, fontSize: "text-2xl" },
  xl: { width: 56, height: 38, fontSize: "text-3xl" },
  "2xl": { width: 80, height: 54, fontSize: "text-4xl" },
};

// Convert country code to flag emoji
function countryCodeToEmoji(countryCode: string): string {
  if (!countryCode) return "🌐";
  const code = countryCode.toUpperCase();
  const offset = 127397; // Regional indicator symbol offset
  return String.fromCodePoint(...[...code].map((c) => c.charCodeAt(0) + offset));
}

export function FlagIcon({
  countryCode,
  size = "md",
  className = "",
  fallbackEmoji,
}: FlagIconProps) {
  const [error, setError] = useState(false);
  const { width, height, fontSize } = sizeMap[size];

  // Handle null/undefined country code
  if (!countryCode) {
    const emoji = fallbackEmoji || "🌐";
    return (
      <span
        className={`inline-flex items-center justify-center ${fontSize} ${className}`}
        style={{ width: sizeMap[size].width, height: sizeMap[size].height }}
        role="img"
        aria-label="Unknown flag"
      >
        {emoji}
      </span>
    );
  }

  const code = countryCode.toUpperCase();

  // Get the flag component dynamically
  const FlagComponent = (
    Flags as Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>>
  )[code];

  if (error || !FlagComponent) {
    const emoji = fallbackEmoji || countryCodeToEmoji(countryCode);
    return (
      <span
        className={`inline-flex items-center justify-center ${fontSize} ${className}`}
        style={{ width, height }}
        role="img"
        aria-label={`${countryCode} flag`}
      >
        {emoji}
      </span>
    );
  }

  try {
    return (
      <FlagComponent
        width={width}
        height={height}
        className={`rounded-sm ${className}`}
        aria-label={`${countryCode} flag`}
        onError={() => setError(true)}
      />
    );
  } catch {
    const emoji = fallbackEmoji || countryCodeToEmoji(countryCode);
    return (
      <span
        className={`inline-flex items-center justify-center ${fontSize} ${className}`}
        style={{ width, height }}
        role="img"
        aria-label={`${countryCode} flag`}
      >
        {emoji}
      </span>
    );
  }
}
