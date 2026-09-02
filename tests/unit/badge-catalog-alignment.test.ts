import { describe, expect, it } from "vitest";
import catalog from "@/assets/badges/catalog-v2.json";
import { BADGES } from "@/lib/constants/badges";

type CatalogItem = [id: string, name: string, category: string, rarity: string, motif: string];
interface CatalogSheet {
  sheet: string;
  title: string;
  items: CatalogItem[];
}

const byId = new Map<string, CatalogItem>();
for (const sheet of catalog as CatalogSheet[])
  for (const item of sheet.items) byId.set(item[0], item);

describe("badges.ts ↔ assets/badges/catalog-v2.json (핀 아트의 등급 키트는 카탈로그 등급으로 그려졌다)", () => {
  it("모든 라이브 배지가 카탈로그에 있다", () => {
    const missing = BADGES.filter((b) => !byId.has(b.id)).map((b) => b.id);
    expect(missing).toEqual([]);
  });

  it("등급·이름·분류가 카탈로그와 같다 — 어긋나면 팝오버 칩과 핀 금속이 서로 다른 등급을 말한다", () => {
    const mismatches: string[] = [];
    for (const b of BADGES) {
      const item = byId.get(b.id);
      if (!item) continue;
      const [, name, category, rarity] = item;
      if (b.rarity !== rarity) mismatches.push(`${b.id}: rarity ${b.rarity} ≠ ${rarity}`);
      if (b.name !== name) mismatches.push(`${b.id}: name ${b.name} ≠ ${name}`);
      if (b.category !== category) mismatches.push(`${b.id}: category ${b.category} ≠ ${category}`);
    }
    expect(mismatches).toEqual([]);
  });

  it("카탈로그에 한 사람만 받는 시간 잠금 배지(Founding 200 · Season 1 Veteran)가 없다", () => {
    expect(byId.has("founding_200")).toBe(false);
    expect(byId.has("season1_veteran")).toBe(false);
  });
});
