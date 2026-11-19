import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../..");
const SOURCE_DIRS = ["app", "components", "hooks", "lib"];
const DEFINITION = path.join(ROOT, "hooks/use-me.ts");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

describe("useMe 는 로그인했을 때만 /api/me 를 부른다", () => {
  it("모든 호출이 enabled 조건을 넘긴다 — 비로그인 방문마다 401 요청이 늘지 않게", () => {
    const calls = SOURCE_DIRS.flatMap((dir) => sourceFiles(path.join(ROOT, dir)))
      .filter((file) => file !== DEFINITION)
      .flatMap((file) => {
        const text = readFileSync(file, "utf-8");
        return [...text.matchAll(/\buseMe\(/g)].map((match) => ({
          where: `${path.relative(ROOT, file)}@${match.index}`,
          call: text.slice(match.index, match.index + 80).replace(/\s+/g, " "),
        }));
      });

    expect(calls.length).toBeGreaterThanOrEqual(6);
    for (const { where, call } of calls) {
      expect(call, where).toMatch(/^useMe\(\{ enabled: /);
    }
  });
});
