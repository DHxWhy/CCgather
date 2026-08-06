import { clerkClient } from "@clerk/nextjs/server";

const REPO_OWNER = "DHxWhy";
const REPO_NAME = "CCgather";
const GITHUB_API = "https://api.github.com";
const FETCH_TIMEOUT_MS = 2500;
const STARGAZERS_PER_PAGE = 100;
const STARGAZERS_MAX_BACK_PAGES = 4;

const GITHUB_HEADERS = {
  Accept: "application/vnd.github.v3+json",
  "User-Agent": "CCgather",
} as const;

interface CheckUserStarredInput {
  clerkId: string;
  githubId: string | null;
}

interface StargazerEntry {
  id: number;
}

async function fetchGitHub(path: string, token?: string): Promise<Response> {
  return fetch(`${GITHUB_API}${path}`, {
    headers: token ? { ...GITHUB_HEADERS, Authorization: `Bearer ${token}` } : GITHUB_HEADERS,
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
}

async function getClerkGitHubToken(
  clerkId: string
): Promise<{ token: string; scopes: string[] } | null> {
  try {
    const clerk = await clerkClient();
    const { data } = await clerk.users.getUserOauthAccessToken(clerkId, "github");
    const entry = data[0];
    if (!entry?.token) {
      return null;
    }
    return { token: entry.token, scopes: entry.scopes ?? [] };
  } catch (error) {
    console.warn(
      `[github-star] Clerk token retrieval failed for ${clerkId}:`,
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

// GET /user/starred/{owner}/{repo}: 204 = starred (definitive).
// 404 = not starred, BUT GitHub also returns 404 when the token lacks
// repo/public_repo scope — so a 404 on a minimal-scope token is only a hint.
async function checkViaUserToken(
  clerkId: string
): Promise<{ result: boolean | null; needsFallbackConfirm: boolean }> {
  const tokenInfo = await getClerkGitHubToken(clerkId);
  if (!tokenInfo) {
    return { result: null, needsFallbackConfirm: false };
  }

  try {
    const res = await fetchGitHub(`/user/starred/${REPO_OWNER}/${REPO_NAME}`, tokenInfo.token);
    if (res.status === 204) {
      return { result: true, needsFallbackConfirm: false };
    }
    if (res.status === 404) {
      const hasStarScope = tokenInfo.scopes.some((s) => s === "repo" || s === "public_repo");
      return { result: false, needsFallbackConfirm: !hasStarScope };
    }
    return { result: null, needsFallbackConfirm: false };
  } catch (error) {
    console.warn(
      "[github-star] User-token star check failed:",
      error instanceof Error ? error.message : error
    );
    return { result: null, needsFallbackConfirm: false };
  }
}

function parseLastPage(linkHeader: string | null): number | null {
  if (!linkHeader) {
    return null;
  }
  const match = linkHeader.match(/[?&]page=(\d+)[^>]*>;\s*rel="last"/);
  return match ? Number(match[1]) : null;
}

async function fetchStargazersPage(
  page: number,
  token: string
): Promise<{ entries: StargazerEntry[]; linkHeader: string | null } | null> {
  const res = await fetchGitHub(
    `/repos/${REPO_OWNER}/${REPO_NAME}/stargazers?per_page=${STARGAZERS_PER_PAGE}&page=${page}`,
    token
  );
  if (!res.ok) {
    console.warn(`[github-star] Stargazers fetch failed: HTTP ${res.status}`);
    return null;
  }
  const entries = (await res.json()) as StargazerEntry[];
  return { entries, linkHeader: res.headers.get("link") };
}

// GitHub returns stargazers oldest-first and ignores `direction=desc` on this
// endpoint (verified live 2026-08-06), so a fresh star lands on the LAST page.
// Page 1 is fetched for the small-repo case, then the newest pages are walked
// backwards from rel="last". A capped scan that saw every page may answer a
// definitive false; a capped scan with unseen middle pages must answer null.
async function checkViaStargazers(githubId: string): Promise<boolean | null> {
  const serverToken = process.env.GITHUB_STAR_TOKEN;
  if (!serverToken) {
    return null;
  }

  const numericId = Number(githubId);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    return null;
  }

  try {
    const first = await fetchStargazersPage(1, serverToken);
    if (!first) {
      return null;
    }
    if (first.entries.some((s) => s.id === numericId)) {
      return true;
    }
    if (first.entries.length < STARGAZERS_PER_PAGE) {
      return false;
    }

    const lastPage = parseLastPage(first.linkHeader);
    if (!lastPage || lastPage < 2) {
      return null;
    }

    const stopPage = Math.max(2, lastPage - STARGAZERS_MAX_BACK_PAGES + 1);
    for (let page = lastPage; page >= stopPage; page--) {
      const result = await fetchStargazersPage(page, serverToken);
      if (!result) {
        return null;
      }
      if (result.entries.some((s) => s.id === numericId)) {
        return true;
      }
    }

    return stopPage <= 2 ? false : null;
  } catch (error) {
    console.warn(
      "[github-star] Stargazers check failed:",
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

export async function checkUserStarred({
  clerkId,
  githubId,
}: CheckUserStarredInput): Promise<boolean | null> {
  const primary = await checkViaUserToken(clerkId);

  if (primary.result === true) {
    return true;
  }

  if (primary.result === false && !primary.needsFallbackConfirm) {
    return false;
  }

  if (githubId) {
    const fallback = await checkViaStargazers(githubId);
    if (fallback !== null) {
      return fallback;
    }
  }

  // Ambiguous 404 with no way to confirm: treat as not starred — worst case is
  // one nudge to an already-starred user, and the star PUT is idempotent.
  if (primary.result === false) {
    return false;
  }

  return null;
}
