"use client";

import type { CSSProperties } from "react";
import type { Badge } from "@/lib/constants/badges";
import { getPinMotion, pinMaskVar, PIN_ASSET_SIZES } from "@/lib/badges/pin-motion";

interface PinWithMotionProps {
  image: string;
  rarity: Badge["rarity"];
  earned: boolean;
  size: number;
  className?: string;
}

export function PinWithMotion({ image, rarity, earned, size, className = "" }: PinWithMotionProps) {
  const motion = getPinMotion(rarity, earned);
  const assetPx =
    size > PIN_ASSET_SIZES.popover / 2 ? PIN_ASSET_SIZES.reveal : PIN_ASSET_SIZES.popover;
  const style = {
    "--pin-src": pinMaskVar(image, assetPx),
    width: size,
    height: size,
  } as CSSProperties;

  return (
    <span className={`${motion.className} ${className}`} style={style} aria-hidden="true">
      {motion.fx.glow && <span className="pin__fx pin__glow" />}
      {/* eslint-disable-next-line @next/next/no-img-element -- static immutable asset, no optimizer round-trip */}
      <img
        src={`${image}-${assetPx}.webp`}
        width={size}
        height={size}
        alt=""
        draggable={false}
        className={`object-contain ${earned ? "" : "grayscale opacity-50"}`}
        style={{ width: size, height: size }}
      />
      {motion.fx.sheen && <span className="pin__fx pin__sheen" />}
      {motion.fx.gem && <span className="pin__gem" />}
      {motion.fx.sparks && (
        <span className="pin__fx">
          <span className="pin__spark" />
          <span className="pin__spark" />
          <span className="pin__spark" />
        </span>
      )}
    </span>
  );
}
