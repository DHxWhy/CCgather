import type { Badge } from "@/lib/constants/badges";

/** 등급 표현의 단일 출처. 색은 핀 아트의 금속(커먼 구리·레어 은·에픽 다크브론즈+바이올렛·레전더리 금)과 같은 것을 가리켜야 한다 — 어긋나면 한 배지가 두 등급을 말한다. */
export type Rarity = Badge["rarity"];

export interface RarityStyle {
  order: number;
  label: string;
  pinMetal: string;
  chipBgClass: string;
  chipTextClass: string;
  tileTintClass: string;
}

export const RARITY: Record<Rarity, RarityStyle> = {
  common: {
    order: 1,
    label: "Common",
    pinMetal: "#C88A63",
    chipBgClass: "bg-[#C88A63]/16",
    chipTextClass: "text-[#D9A784]",
    tileTintClass: "bg-[#C88A63]/[0.06]",
  },
  rare: {
    order: 2,
    label: "Rare",
    pinMetal: "#9FB6CC",
    chipBgClass: "bg-[#9FB6CC]/16",
    chipTextClass: "text-[#B8CBDD]",
    tileTintClass: "bg-[#9FB6CC]/[0.07]",
  },
  epic: {
    order: 3,
    label: "Epic",
    pinMetal: "#A78BFA",
    chipBgClass: "bg-[#A78BFA]/18",
    chipTextClass: "text-[#C4B2FD]",
    tileTintClass: "bg-[#A78BFA]/[0.08]",
  },
  legendary: {
    order: 4,
    label: "Legendary",
    pinMetal: "#F6C453",
    chipBgClass: "bg-[#F6C453]/18",
    chipTextClass: "text-[#F8D584]",
    tileTintClass: "bg-[#F6C453]/[0.09]",
  },
};

export const RARITIES = Object.keys(RARITY) as Rarity[];

export function byRarityDesc(a: Badge, b: Badge): number {
  return RARITY[b.rarity].order - RARITY[a.rarity].order;
}
