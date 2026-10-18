import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// supabase-js 의 쿼리 빌더(.from()/.rpc())는 PromiseLike 라 `.catch` 가 없다.
// `await supabase.rpc("x").catch(() => {})` 는 "실패를 무시하는" 코드가 아니라
// 호출 즉시 TypeError 를 던지는 코드다 (2026-10-17 GET /api/me 500 실사고).
// 서버 코드(app/, lib/) 전체에서 그 모양을 금지한다.
const ROOT = path.resolve(__dirname, "../../");
const SCAN_DIRS = ["app", "lib"];
const BUILDER_CATCH = /\.(rpc|from)\([^;[\]]*?\)\s*\.catch\(/;

function walk(dir: string, out: string[]): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

describe("PostgREST 빌더에 .catch 를 붙이지 않는다", () => {
  const files = SCAN_DIRS.flatMap((d) => walk(path.join(ROOT, d), []));

  it("스캔 대상이 비어 있지 않다 (양성 샘플 역검증)", () => {
    expect(files.length).toBeGreaterThan(50);
    expect(
      BUILDER_CATCH.test('await supabase.rpc("calculate_country_ranks").catch(() => {});')
    ).toBe(true);
    expect(
      BUILDER_CATCH.test('await Promise.all([supabase.from("t").select()]).catch(noop);')
    ).toBe(false);
  });

  it("app/·lib/ 에 .rpc(...).catch( / .from(...).catch( 가 없다", () => {
    const offenders = files
      .filter((f) => BUILDER_CATCH.test(readFileSync(f, "utf-8")))
      .map((f) => path.relative(ROOT, f));
    expect(offenders).toEqual([]);
  });
});
