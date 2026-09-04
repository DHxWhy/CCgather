import { describe, expect, it } from "vitest";
import pinArt from "@/assets/badges/pin-art.json";
import { BADGES } from "@/lib/constants/badges";

const art = pinArt as Record<string, { grade: string; motif: string }>;

describe("badges.ts ↔ assets/badges/pin-art.json (핀 아트는 그 배지의 등급 키트로 그려졌다)", () => {
  it("모든 배지에 아트 기록이 있다", () => {
    const missing = BADGES.filter((b) => !art[b.id]).map((b) => b.id);
    expect(missing).toEqual([]);
  });

  it("배지 등급 = 아트가 그려진 등급 — 어긋나면 팝오버 칩과 핀 금속이 서로 다른 등급을 말한다", () => {
    const mismatches = BADGES.filter((b) => art[b.id] && art[b.id]!.grade !== b.rarity).map(
      (b) => `${b.id}: ${b.rarity} ≠ ${art[b.id]!.grade}`
    );
    expect(mismatches).toEqual([]);
  });

  it("아트 기록에 죽은 항목이 없다 — 배지가 사라지면 기록도 지운다", () => {
    const live = new Set(BADGES.map((b) => b.id));
    expect(Object.keys(art).filter((id) => !live.has(id))).toEqual([]);
  });

  it("한 사람만 받을 수 있는 시간 잠금 배지가 없다", () => {
    for (const dead of ["founding_200", "season1_veteran", "rising_star"]) {
      expect(BADGES.some((b) => b.id === dead)).toBe(false);
    }
  });
});
