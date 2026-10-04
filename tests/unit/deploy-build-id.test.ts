import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deployBuildId } from "@/lib/config/build-id";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("deployBuildId", () => {
  it("커밋 SHA 가 없어도 시간이 지나면서 바뀌지 않는다 (바뀌면 SW 킬스위치가 무한 새로고침)", () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "");
    vi.stubEnv("NEXT_PUBLIC_BUILD_ID", "");
    vi.stubEnv("NEXT_PUBLIC_BUILD_TIME", "2026-10-05T00:00:00.000Z");
    vi.useFakeTimers();

    const first = deployBuildId();
    vi.advanceTimersByTime(60_000);

    expect(deployBuildId()).toBe(first);
    expect(first).toBe("2026-10-05T00:00:00.000Z");
  });

  it("커밋 SHA 가 있으면 그것을 쓴다", () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "9949012");
    expect(deployBuildId()).toBe("9949012");
  });

  it("빌드 시각조차 없으면 고정 문자열로 떨어진다", () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "");
    vi.stubEnv("NEXT_PUBLIC_BUILD_ID", "");
    vi.stubEnv("NEXT_PUBLIC_BUILD_TIME", "");
    expect(deployBuildId()).toBe("unknown-build");
  });

  it("레이아웃의 SW 킬스위치가 이 함수로 BUILD_ID 를 만든다", () => {
    const layout = readFileSync(path.resolve(__dirname, "../../app/layout.tsx"), "utf-8");
    expect(layout).toContain("var BUILD_ID='${deployBuildId()}';");
  });
});
