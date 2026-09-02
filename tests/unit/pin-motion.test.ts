import { describe, expect, it } from "vitest";
import { getPinMotion, pinMaskVar } from "@/lib/badges/pin-motion";
import { BADGES, type Badge } from "@/lib/constants/badges";

const RARITIES: Badge["rarity"][] = ["common", "rare", "epic", "legendary"];

describe("getPinMotion", () => {
  it("잠금 배지는 등급과 무관하게 모션·FX 가 없다", () => {
    for (const r of RARITIES) {
      const m = getPinMotion(r, false);
      expect(m.className).toBe("pin");
      expect(Object.values(m.fx).some(Boolean)).toBe(false);
    }
  });

  it("획득 배지는 모두 팝인을 갖고, 등급이 오를수록 FX 채널이 늘어난다", () => {
    const channels = RARITIES.map(
      (r) => Object.values(getPinMotion(r, true).fx).filter(Boolean).length
    );
    expect(getPinMotion("common", true).className).toContain("pin--pop");
    expect(channels).toEqual([0, 1, 2, 2]);
    expect(getPinMotion("legendary", true).fx.sparks).toBe(true);
    expect(getPinMotion("epic", true).fx.gem).toBe(true);
  });

  it("등급 클래스는 등급명과 일치한다 (CSS 규칙 이름과 1:1)", () => {
    for (const r of RARITIES) {
      const cls = getPinMotion(r, true).className.split(" ");
      if (r === "common") expect(cls).not.toContain("pin--common");
      else expect(cls).toContain(`pin--${r}`);
    }
  });

  it("실제 카탈로그의 모든 등급이 매핑에 존재한다", () => {
    for (const b of BADGES) expect(() => getPinMotion(b.rarity, true)).not.toThrow();
  });
});

describe("pinMaskVar", () => {
  it("팝오버 크기의 WebP 를 url() 로 감싼다", () => {
    expect(pinMaskVar("/badges/v1/streak_7")).toBe('url("/badges/v1/streak_7-192.webp")');
    expect(pinMaskVar("/badges/v1/streak_7", 512)).toBe('url("/badges/v1/streak_7-512.webp")');
  });
});
