"use client";

import Image from "next/image";
import { useState } from "react";

interface FlagIconProps {
  countryCode: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  fallbackEmoji?: string;
}

const sizeMap = {
  xs: { width: 16, height: 12, fontSize: "text-sm" },
  sm: { width: 20, height: 15, fontSize: "text-base" },
  md: { width: 28, height: 21, fontSize: "text-lg" },
  lg: { width: 40, height: 30, fontSize: "text-2xl" },
  xl: { width: 56, height: 42, fontSize: "text-3xl" },
};

// Convert country code to flag emoji
function countryCodeToEmoji(countryCode: string): string {
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
  const code = countryCode.toLowerCase();

  if (error) {
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

  return (
    <Image
      src={`https://flagcdn.com/w${Math.ceil(width * 2)}/${code}.png`}
      alt={`${countryCode} flag`}
      width={width}
      height={height}
      className={`rounded-sm object-cover ${className}`}
      onError={() => setError(true)}
      unoptimized
    />
  );
}
