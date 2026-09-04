import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BADGES } from "@/lib/constants/badges";
import { byRarityDesc, RARITIES, RARITY } from "@/lib/badges/rarity";
import { getPinMotion } from "@/lib/badges/pin-motion";

const read = (p: string) => readFileSync(path.resolve(__dirname, "../../", p), "utf-8");

describe("등급 표현 SSOT", () => {
  it("네 등급이 모두 있고 order 가 1..4 로 유일하다", () => {
    expect(RARITIES).toEqual(["common", "rare", "epic", "legendary"]);
    expect(RARITIES.map((r) => RARITY[r].order).sort()).toEqual([1, 2, 3, 4]);
  });

  it("등급마다 칩 색이 서로 다르다 — 같으면 화면에서 등급이 구분되지 않는다", () => {
    const metals = RARITIES.map((r) => RARITY[r].pinMetal);
    const chips = RARITIES.map((r) => RARITY[r].chipTextClass);
    expect(new Set(metals).size).toBe(4);
    expect(new Set(chips).size).toBe(4);
  });

  it("byRarityDesc 는 높은 등급을 먼저 놓는다", () => {
    const sorted = [...BADGES].sort(byRarityDesc);
    const orders = sorted.map((b) => RARITY[b.rarity].order);
    expect(orders).toEqual([...orders].sort((a, b) => b - a));
  });

  it("모션 키트도 같은 등급 집합을 덮는다", () => {
    for (const r of RARITIES) expect(() => getPinMotion(r, true)).not.toThrow();
  });
});

describe("UI 는 등급 색을 로컬에 복제하지 않는다", () => {
  const files = [
    "components/leaderboard/ProfileSidePanel.tsx",
    "components/badges/BadgeRevealModal.tsx",
  ];

  it("배지를 그리는 화면은 rarity SSOT 를 import 한다", () => {
    for (const f of files) expect(read(f)).toContain('from "@/lib/badges/rarity"');
  });

  it("등급별 색 맵을 따로 선언하지 않는다 — 복제하면 칩과 핀 금속이 갈라진다", () => {
    for (const f of files) {
      const src = read(f);
      expect(src).not.toMatch(/RARITY_BG_COLORS|RARITY_CHIP|RARITY_ORDER\s*[:=]/);
    }
  });
});

describe("배지 그리드 구성", () => {
  it("열마다 8칸을 넘지 않고 커뮤니티는 그리드 밖이다", () => {
    const counts = new Map<string, number>();
    for (const b of BADGES) counts.set(b.category, (counts.get(b.category) ?? 0) + 1);
    for (const [cat, n] of counts) expect(n, cat).toBeLessThanOrEqual(8);
    expect(counts.get("community")).toBeGreaterThan(0);
  });

  it("그리드 5열은 꼭대기에 전설을 하나 이상 갖는다", () => {
    for (const cat of ["streak", "tokens", "rank", "model", "journey"]) {
      const top = BADGES.filter((b) => b.category === cat).sort(byRarityDesc)[0];
      expect(top?.rarity, cat).toBe("legendary");
    }
  });
});
