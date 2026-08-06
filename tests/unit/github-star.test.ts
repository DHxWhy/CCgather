import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const getUserOauthAccessToken = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: vi.fn(async () => ({
    users: { getUserOauthAccessToken },
  })),
}));

import { checkUserStarred } from "../../lib/services/github-star";

const STARRED_URL = "https://api.github.com/user/starred/DHxWhy/CCgather";
const STARGAZERS_PREFIX = "https://api.github.com/repos/DHxWhy/CCgather/stargazers";

const fetchMock = vi.fn();

function clerkTokenResponse(token: string, scopes: string[]) {
  getUserOauthAccessToken.mockResolvedValue({ data: [{ token, scopes }] });
}

function stargazersPage(ids: number[], lastPage?: number): Response {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (lastPage) {
    headers.Link = `<${STARGAZERS_PREFIX}?per_page=100&page=2>; rel="next", <${STARGAZERS_PREFIX}?per_page=100&page=${lastPage}>; rel="last"`;
  }
  return new Response(JSON.stringify(ids.map((id) => ({ id }))), { status: 200, headers });
}

function fullPage(startId: number): number[] {
  return Array.from({ length: 100 }, (_, i) => startId + i);
}

function requestedPage(callIndex: number): string | null {
  const url = String(fetchMock.mock.calls[callIndex][0]);
  const match = url.match(/[?&]page=(\d+)/);
  return match ? match[1] : null;
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  getUserOauthAccessToken.mockReset();
  delete process.env.GITHUB_STAR_TOKEN;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("checkUserStarred", () => {
  it("returns true on 204 from the user-token check", async () => {
    clerkTokenResponse("user-token", []);
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    const result = await checkUserStarred({ clerkId: "clerk_1", githubId: "111" });

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(STARRED_URL);
  });

  it("trusts 404 as not-starred when the token has repo scope", async () => {
    clerkTokenResponse("user-token", ["repo"]);
    process.env.GITHUB_STAR_TOKEN = "server-token";
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }));

    const result = await checkUserStarred({ clerkId: "clerk_1", githubId: "111" });

    expect(result).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("confirms an ambiguous 404 via a single short stargazers page (match)", async () => {
    clerkTokenResponse("user-token", ["read:user"]);
    process.env.GITHUB_STAR_TOKEN = "server-token";
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(stargazersPage([42, 111, 7]));

    const result = await checkUserStarred({ clerkId: "clerk_1", githubId: "111" });

    expect(result).toBe(true);
    expect(fetchMock.mock.calls[1][0]).toContain(STARGAZERS_PREFIX);
  });

  it("returns false when a single short page has no match (full coverage)", async () => {
    clerkTokenResponse("user-token", []);
    process.env.GITHUB_STAR_TOKEN = "server-token";
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(stargazersPage([1, 2, 3]));

    const result = await checkUserStarred({ clerkId: "clerk_1", githubId: "111" });

    expect(result).toBe(false);
  });

  it("walks BACKWARDS from rel=last and finds a fresh star on the newest page", async () => {
    getUserOauthAccessToken.mockRejectedValue(new Error("revoked"));
    process.env.GITHUB_STAR_TOKEN = "server-token";
    fetchMock
      .mockResolvedValueOnce(stargazersPage(fullPage(1000), 2))
      .mockResolvedValueOnce(stargazersPage([2000, 111]));

    const result = await checkUserStarred({ clerkId: "clerk_1", githubId: "111" });

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestedPage(0)).toBe("1");
    expect(requestedPage(1)).toBe("2");
  });

  it("scans the newest pages first when the repo is large (last=10 → pages 10..7)", async () => {
    getUserOauthAccessToken.mockRejectedValue(new Error("revoked"));
    process.env.GITHUB_STAR_TOKEN = "server-token";
    fetchMock
      .mockResolvedValueOnce(stargazersPage(fullPage(1), 10))
      .mockImplementation(() => Promise.resolve(stargazersPage(fullPage(5000))));

    const result = await checkUserStarred({ clerkId: "clerk_1", githubId: "999999" });

    expect(result).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect([requestedPage(1), requestedPage(2), requestedPage(3), requestedPage(4)]).toEqual([
      "10",
      "9",
      "8",
      "7",
    ]);
  });

  it("answers a definitive false when the capped backward walk covered every page", async () => {
    getUserOauthAccessToken.mockRejectedValue(new Error("revoked"));
    process.env.GITHUB_STAR_TOKEN = "server-token";
    fetchMock
      .mockResolvedValueOnce(stargazersPage(fullPage(1), 3))
      .mockImplementation(() => Promise.resolve(stargazersPage(fullPage(5000))));

    const result = await checkUserStarred({ clerkId: "clerk_1", githubId: "999999" });

    expect(result).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("returns null when a full first page carries no Link header", async () => {
    getUserOauthAccessToken.mockRejectedValue(new Error("revoked"));
    process.env.GITHUB_STAR_TOKEN = "server-token";
    fetchMock.mockResolvedValue(stargazersPage(fullPage(1)));

    const result = await checkUserStarred({ clerkId: "clerk_1", githubId: "999999" });

    expect(result).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns false on ambiguous 404 when no fallback token exists", async () => {
    clerkTokenResponse("user-token", []);
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }));

    const result = await checkUserStarred({ clerkId: "clerk_1", githubId: "111" });

    expect(result).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns null when Clerk has no token and no fallback exists", async () => {
    getUserOauthAccessToken.mockRejectedValue(new Error("no github account"));

    const result = await checkUserStarred({ clerkId: "clerk_1", githubId: "111" });

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null when every path errors", async () => {
    clerkTokenResponse("user-token", []);
    fetchMock.mockRejectedValue(new Error("timeout"));

    const result = await checkUserStarred({ clerkId: "clerk_1", githubId: null });

    expect(result).toBeNull();
  });

  it("skips the fallback when githubId is missing", async () => {
    clerkTokenResponse("user-token", []);
    process.env.GITHUB_STAR_TOKEN = "server-token";
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }));

    const result = await checkUserStarred({ clerkId: "clerk_1", githubId: null });

    expect(result).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("ignores a non-numeric githubId in the fallback", async () => {
    getUserOauthAccessToken.mockRejectedValue(new Error("no account"));
    process.env.GITHUB_STAR_TOKEN = "server-token";

    const result = await checkUserStarred({ clerkId: "clerk_1", githubId: "abc" });

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
