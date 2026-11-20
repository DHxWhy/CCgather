import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../..");
const PUBLIC_ROUTES = [
  "app/(landing)",
  "app/(main)/leaderboard",
  "app/(main)/stats",
  "app/(main)/privacy",
  "app/(main)/terms",
  "app/(main)/cli",
];
const LOADING_FILES = ["loading.tsx", "loading.ts", "loading.jsx", "loading.js"];

function boundariesAbove(routeDir: string): string[] {
  const found: string[] = [];
  let dir = path.join(ROOT, routeDir);
  const appDir = path.join(ROOT, "app");
  while (dir.startsWith(appDir)) {
    for (const name of LOADING_FILES) {
      if (existsSync(path.join(dir, name))) found.push(path.relative(ROOT, path.join(dir, name)));
    }
    dir = path.dirname(dir);
  }
  return found;
}

describe("공개 페이지는 본문을 제자리에 보낸다", () => {
  it.each(PUBLIC_ROUTES)(
    "%s 위에는 loading 파일이 없다 — 있으면 본문이 숨긴 상자로 스트리밍돼 JS 없는 수집기에는 Loading 만 보인다",
    (route) => {
      expect(existsSync(path.join(ROOT, route))).toBe(true);
      expect(boundariesAbove(route)).toEqual([]);
    }
  );
});
