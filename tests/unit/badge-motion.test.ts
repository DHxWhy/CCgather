import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  composeBadgeMotion,
  MOTION_INTRO_END,
  MOTION_OUT_POINT,
  MOTION_SIZE,
} from "@/lib/badges/motion-composer";
import { BADGES, type Badge } from "@/lib/constants/badges";

const RARITIES: Badge["rarity"][] = ["common", "rare", "epic", "legendary"];
const MOTION_DIR = path.resolve(__dirname, "../../public/badges/motion/v1");

function collectKeyframeTimes(node: unknown, out: number[] = []): number[] {
  if (Array.isArray(node)) node.forEach((n) => collectKeyframeTimes(n, out));
  else if (node && typeof node === "object") {
    const o = node as Record<string, unknown>;
    if (o.a === 1 && Array.isArray(o.k))
      for (const kf of o.k as Array<{ t: number }>) out.push(kf.t);
    for (const v of Object.values(o)) collectKeyframeTimes(v, out);
  }
  return out;
}

describe("composeBadgeMotion", () => {
  it("합성 크기·프레임·마커·외부 이미지 참조가 계약과 같다", () => {
    const m = composeBadgeMotion("streak_7", "common");
    expect([m.w, m.h, m.ip, m.op]).toEqual([MOTION_SIZE, MOTION_SIZE, 0, MOTION_OUT_POINT]);
    expect(m.markers.map((x) => x.cm)).toEqual(["intro", "idle"]);
    expect(m.assets[0]).toMatchObject({ u: "/badges/v1/", p: "streak_7-512.webp", e: 0 });
  });

  it("등급이 오를수록 레이어가 늘고, 모든 등급에 핀 이미지 레이어가 정확히 하나 있다", () => {
    const counts = RARITIES.map((r) => composeBadgeMotion("x", r).layers.length);
    expect(counts[0]).toBe(1);
    expect(counts).toEqual([...counts].sort((a, b) => a - b));
    for (const r of RARITIES) {
      const pins = composeBadgeMotion("x", r).layers.filter((l) => l.nm === "pin");
      expect(pins).toHaveLength(1);
    }
  });

  it("시트 레이어는 알파 매트 바로 아래에 온다 (Lottie 트랙 매트 순서)", () => {
    for (const r of ["rare", "legendary"] as const) {
      const layers = composeBadgeMotion("x", r).layers as Array<{
        nm: string;
        td?: number;
        tt?: number;
      }>;
      const matteIdx = layers.findIndex((l) => l.nm === "pin-matte");
      expect(layers[matteIdx].td).toBe(1);
      expect(layers[matteIdx + 1]).toMatchObject({ nm: "sheen", tt: 1 });
    }
  });

  it("모든 키프레임 시각은 [0, op] 안에 있고 인트로 경계를 넘는 대기 애니메이션은 op 에서 끝난다", () => {
    for (const r of RARITIES) {
      const times = collectKeyframeTimes(composeBadgeMotion("x", r).layers);
      expect(times.length).toBeGreaterThan(0);
      expect(Math.min(...times)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...times)).toBeLessThanOrEqual(MOTION_OUT_POINT);
      expect(MOTION_INTRO_END).toBeLessThan(MOTION_OUT_POINT);
    }
  });

  it("JSON 은 이미지를 내장하지 않아 등급 최대 40KB 이하다", () => {
    for (const r of RARITIES) {
      expect(JSON.stringify(composeBadgeMotion("x", r)).length).toBeLessThan(40 * 1024);
    }
  });
});

describe("build:badge-motion 산출물", () => {
  it("카탈로그의 모든 배지에 모션 JSON 이 있다", () => {
    const missing = BADGES.filter((b) => !existsSync(path.join(MOTION_DIR, `${b.id}.json`))).map(
      (b) => b.id
    );
    expect(missing).toEqual([]);
  });
});
