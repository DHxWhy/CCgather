"use client";

import Image from "next/image";
import { useState } from "react";

interface FlagIconProps {
  countryCode: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeMap = {
  xs: { width: 16, height: 12 },
  sm: { width: 20, height: 15 },
  md: { width: 28, height: 21 },
  lg: { width: 40, height: 30 },
  xl: { width: 56, height: 42 },
};

export function FlagIcon({ countryCode, size = "md", className = "" }: FlagIconProps) {
  const [error, setError] = useState(false);
  const { width, height } = sizeMap[size];
  const code = countryCode.toLowerCase();

  if (error) {
    return (
      <span
        className={`inline-flex items-center justify-center bg-white/10 rounded text-xs text-text-muted ${className}`}
        style={{ width, height }}
      >
        {countryCode}
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
