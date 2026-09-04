import type { Badge } from "@/lib/constants/badges";

/** 성능 제약: 모션은 팝오버·획득 모달에서만 재생하고 그리드 타일은 정적 이미지만 쓴다. 클래스명은 app/globals.css 의 `.pin*` 규칙과 1:1. */
export const PIN_ASSET_SIZES = { tile: 96, tile2x: 192, popover: 192, reveal: 512 } as const;

export interface PinMotion {
  className: string;
  fx: { sheen: boolean; glow: boolean; gem: boolean; sparks: boolean };
}

const NONE: PinMotion["fx"] = { sheen: false, glow: false, gem: false, sparks: false };

const BY_RARITY: Record<Badge["rarity"], PinMotion> = {
  common: { className: "pin pin--pop", fx: NONE },
  rare: { className: "pin pin--pop pin--rare", fx: { ...NONE, sheen: true } },
  epic: { className: "pin pin--pop pin--epic", fx: { ...NONE, glow: true, gem: true } },
  legendary: {
    className: "pin pin--pop pin--legendary",
    fx: { sheen: true, glow: false, gem: false, sparks: true },
  },
};

export function getPinMotion(rarity: Badge["rarity"], earned: boolean): PinMotion {
  if (!earned) return { className: "pin", fx: NONE };
  return BY_RARITY[rarity];
}

export function pinMaskVar(imageBase: string, size: number = PIN_ASSET_SIZES.popover): string {
  return `url("${imageBase}-${size}.webp")`;
}
