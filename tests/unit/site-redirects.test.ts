import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

// Next ships its own copy of path-to-regexp without type declarations
const { pathToRegexp } = createRequire(import.meta.url)("next/dist/compiled/path-to-regexp") as {
  pathToRegexp: (path: string, keys: { name: string | number }[]) => RegExp;
};

const read = (rel: string) => readFileSync(join(__dirname, "../..", rel), "utf8");

describe("프로필 짧은 주소", () => {
  it("/u/이름 과 /@이름 은 그 회원의 프로필로 넘긴다", () => {
    const src = read("next.config.ts");
    expect(src).toContain(
      '{ source: "/u/:username", destination: "/leaderboard?u=:username", permanent: false }'
    );
    expect(src).toContain(
      '{ source: "/@:username", destination: "/leaderboard?u=:username", permanent: false }'
    );
  });

  it("/@이름 꼴이 실제 주소와 맞고 이름을 꺼낸다", () => {
    const keys: { name: string | number }[] = [];
    const pattern = pathToRegexp("/@:username", keys);
    const match = pattern.exec("/@DHxWhy");
    expect(match?.[1]).toBe("DHxWhy");
    expect(keys.map((key) => key.name)).toEqual(["username"]);
    expect(pattern.exec("/leaderboard")).toBeNull();
  });
});
