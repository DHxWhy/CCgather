import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MIN_DISPATCH_INTERVAL_MS,
  requestPricingCheck,
  resetPricingDispatchForTest,
  unpricedClaudeModels,
} from "@/lib/services/pricing-dispatch";

describe("unpricedClaudeModels", () => {
  it("flags only well-formed Claude ids missing from the official snapshot", () => {
    expect(
      unpricedClaudeModels([
        "claude-opus-5-5", // in snapshot
        "claude-haiku-4-5-20251001", // in snapshot after date strip
        "claude-sonnet-4-20250514", // in snapshot after date strip
        "claude-opus-6", // new
        "claude-lyric-1-20270101", // new family
        "claude-opus-6", // duplicate
        "claude-3-7-sonnet-20250219", // legacy naming, LiteLLM covers it
        "<synthetic>",
        "gpt-5",
        "claude-opus-6; rm -rf /",
      ])
    ).toEqual(["claude-opus-6", "claude-lyric-1-20270101"]);
  });
});

describe("requestPricingCheck", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    resetPricingDispatchForTest();
    fetchMock.mockReset().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("GITHUB_PRICING_DISPATCH_TOKEN", "test-token");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("is a no-op without a token", async () => {
    vi.stubEnv("GITHUB_PRICING_DISPATCH_TOKEN", "");
    expect(await requestPricingCheck(["claude-opus-6"])).toBe("skipped");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends a repository_dispatch without echoing user input", async () => {
    expect(await requestPricingCheck(["claude-opus-6"], 1_000)).toBe("sent");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.github.com/repos/DHxWhy/CCgather/dispatches");
    expect(JSON.parse(init.body)).toEqual({ event_type: "pricing-check" });
    expect(init.headers.Authorization).toBe("Bearer test-token");
  });

  it("fires at most once per interval regardless of model ids", async () => {
    await requestPricingCheck(["claude-opus-6"], 1_000);
    expect(await requestPricingCheck(["claude-opus-7"], 1_000 + MIN_DISPATCH_INTERVAL_MS - 1)).toBe(
      "skipped"
    );
    expect(await requestPricingCheck(["claude-opus-7"], 1_000 + MIN_DISPATCH_INTERVAL_MS)).toBe(
      "sent"
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reports a non-204 as failed without throwing", async () => {
    fetchMock.mockResolvedValue(new Response("bad", { status: 404 }));
    expect(await requestPricingCheck(["claude-opus-6"], 1_000)).toBe("failed");
  });
});
