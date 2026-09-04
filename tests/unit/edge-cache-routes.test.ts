import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CACHE_TAG_LEADERBOARD,
  edgeCacheHeaders,
  EDGE_SWR_SEC,
  userCacheTag,
} from "@/lib/cache/edge-cache-shared";

const read = (p: string) => readFileSync(path.resolve(__dirname, "../../", p), "utf-8");

// 패널·진입 화면이 부르는 읽기 라우트 — 하나라도 캐시 헤더가 빠지면 매 요청이 미국 왕복(≈300ms)
const READ_ROUTES = [
  "app/api/leaderboard/route.ts",
  "app/api/countries/route.ts",
  "app/api/stats/global/route.ts",
  "app/api/community/stats/route.ts",
  "app/api/users/[id]/profile/route.ts",
  "app/api/users/[id]/badges/route.ts",
  "app/api/users/[id]/usage-summary/route.ts",
  "app/api/users/[id]/usage-daily/route.ts",
];

describe("edgeCacheHeaders", () => {
  it("CDN 캐시 지시자 + 쉼표 구분 태그를 만든다", () => {
    const h = edgeCacheHeaders(300, [CACHE_TAG_LEADERBOARD, userCacheTag("u1")]);
    expect(h["Cache-Control"]).toBe(`public, s-maxage=300, stale-while-revalidate=${EDGE_SWR_SEC}`);
    expect(h["Vercel-Cache-Tag"]).toBe("leaderboard,user-u1");
  });

  it("태그에 쉼표가 없다 (Vercel 구분자)", () => {
    expect(CACHE_TAG_LEADERBOARD).not.toContain(",");
    expect(userCacheTag("a,b")).toBe("user-a,b");
  });
});

describe("읽기 라우트는 엣지 캐시 헬퍼를 쓴다", () => {
  for (const file of READ_ROUTES) {
    it(`${file} — edgeCacheHeaders 호출 + 손으로 쓴 Cache-Control 없음`, () => {
      const src = read(file);
      expect(src).toContain("edgeCacheHeaders(");
      expect(src).not.toMatch(/"Cache-Control":\s*"/);
    });
  }
});

describe("edge-cache-shared 는 import 가 없다 (vitest·클라이언트 안전)", () => {
  it("import 문 0건", () => {
    expect(read("lib/cache/edge-cache-shared.ts")).not.toMatch(/^import /m);
  });
});

describe("제출 라우트는 순위표·본인 태그를 무효화한다", () => {
  it("invalidateEdgeCache([CACHE_TAG_LEADERBOARD, userCacheTag(...)]) 호출", () => {
    const src = read("app/api/cli/submit/route.ts");
    expect(src).toMatch(/invalidateEdgeCache\(\[\s*CACHE_TAG_LEADERBOARD,\s*userCacheTag\(/);
  });
});
