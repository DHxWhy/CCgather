import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(path.resolve(__dirname, "../../", p), "utf-8");

// 호출부가 생략해도 되는 필드: buildBadgeContext 가 비어 있으면 DB 에서 직접 계산한다.
const DERIVED_WHEN_OMITTED = new Set(["referral_count"]);

function statsFieldsOfCheckAndAwardBadges(): string[] {
  const src = read("lib/services/badgeService.ts");
  const start = src.indexOf("export async function checkAndAwardBadges(");
  const statsStart = src.indexOf("stats: {", start) + "stats: {".length;
  const statsEnd = src.indexOf("}", statsStart);
  const block = src.slice(statsStart, statsEnd);
  return [...block.matchAll(/^\s*([a-z_]+)\??:/gm)]
    .map((m) => m[1]!)
    .filter((f) => !DERIVED_WHEN_OMITTED.has(f));
}

function callBlock(src: string): string {
  const i = src.indexOf("checkAndAwardBadges(");
  expect(i, "checkAndAwardBadges 호출이 있어야 한다").toBeGreaterThan(-1);
  return src.slice(i, src.indexOf(");", i));
}

describe("배지 판정 호출부는 판정에 쓰이는 필드를 전부 넘긴다", () => {
  const fields = statsFieldsOfCheckAndAwardBadges();

  it("stats 타입에서 필드 목록을 읽어온다 (리터럴 복붙 아님)", () => {
    expect(fields).toContain("total_sessions");
    expect(fields).toContain("auto_sync_enabled");
    expect(fields).toContain("github_starred");
    expect(fields).not.toContain("stats");
    expect(fields).not.toContain("referral_count");
    expect(fields.length).toBeGreaterThanOrEqual(8);
  });

  for (const file of ["app/api/cli/submit/route.ts", "app/api/admin/badges/backfill/route.ts"]) {
    it(`${file} — 빠진 필드가 있으면 그 필드에 걸린 배지는 영영 발급되지 않는다`, () => {
      const block = callBlock(read(file));
      const missing = fields.filter((f) => !new RegExp(`\\b${f}\\s*:`).test(block));
      expect(missing).toEqual([]);
    });
  }
});
