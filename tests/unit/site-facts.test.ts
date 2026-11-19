import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BADGES } from "@/lib/constants/badges";
import { LEVELS } from "@/lib/constants/levels";
import {
  SITE_FAQ,
  SITE_FEATURES,
  SITE_ONE_LINER,
  badgesSentence,
  formatTokenThreshold,
  levelsSentence,
} from "@/lib/seo/site-facts";

const read = (rel: string) => readFileSync(join(__dirname, "../..", rel), "utf8");

const everything = () =>
  [SITE_ONE_LINER, ...SITE_FEATURES, ...SITE_FAQ.flatMap((f) => [f.question, f.answer])].join("\n");

describe("사이트 소개 사실 (SSOT)", () => {
  it("배지 수와 분류 수, 분류별 수는 배지 정의에서 센다", () => {
    const categories = new Set(BADGES.map((badge) => badge.category));
    const sentence = badgesSentence();
    expect(sentence.startsWith(`${BADGES.length} badges in ${categories.size} categories`)).toBe(
      true
    );
    const counted = [...sentence.matchAll(/\((\d+)\)/g)].map((m) => Number(m[1]));
    expect(counted.reduce((a, b) => a + b, 0)).toBe(BADGES.length);
    expect(counted).toHaveLength(categories.size);
  });

  it("레벨 문장은 레벨 정의의 이름과 시작 토큰을 순서대로 담는다", () => {
    const sentence = levelsSentence();
    let from = 0;
    for (const level of LEVELS) {
      const at = sentence.indexOf(`${level.name} (${formatTokenThreshold(level.minTokens)}`, from);
      expect(at, level.name).toBeGreaterThanOrEqual(from);
      from = at;
    }
  });

  it("토큰 기준 표기", () => {
    expect(formatTokenThreshold(0)).toBe("0");
    expect(formatTokenThreshold(50_000_000)).toBe("50M");
    expect(formatTokenThreshold(1_000_000_000)).toBe("1B");
    expect(formatTokenThreshold(100_000_000_000)).toBe("100B");
  });

  it("숨긴 커뮤니티 · 옛 숫자 · 틀린 문장을 말하지 않는다", () => {
    const text = everything();
    expect(text).not.toMatch(/translat/i);
    expect(text).not.toMatch(/\bcommunity\b/i);
    expect(text).not.toMatch(/\b27\b/);
    expect(text).not.toMatch(/Rookie/);
    expect(text).not.toMatch(/anonymous/i);
    expect(text).not.toMatch(/complete session history/i);
  });

  it("FAQ 는 배지 · 레벨 문장을 그대로 쓴다", () => {
    const text = everything();
    expect(text).toContain(badgesSentence());
    expect(text).toContain(levelsSentence());
  });

  it("구조화 데이터는 SITE_FAQ · SITE_FEATURES 로 만든다", () => {
    const src = read("app/layout.tsx");
    expect(src).toContain("SITE_FAQ.map(");
    expect(src).toContain("featureList: SITE_FEATURES");
    expect(src).not.toMatch(/AI-translated|27 achievement|curated AI news|search_term_string/);
  });

  it("홈 · 통계 제목에 CCgather 가 두 번 붙지 않는다", () => {
    expect(read("app/(landing)/page.tsx")).toMatch(/title: \{\s*absolute: /);
    expect(read("app/(main)/stats/page.tsx")).not.toContain("— CCgather Stats");
  });
});
