import { hasOfficialPricing } from "@/lib/services/pricing";

// A submission naming a Claude model the official snapshot lacks is the earliest
// signal that a model launched. Ask .github/workflows/pricing-sync.yml to run now
// instead of waiting for its hourly poll. No-op without the token.

const DISPATCH_URL = "https://api.github.com/repos/DHxWhy/CCgather/dispatches";
const DISPATCH_TIMEOUT_MS = 3000;
// Model ids are user-supplied: cap how often any instance can fire, whatever the ids.
export const MIN_DISPATCH_INTERVAL_MS = 10 * 60 * 1000;
// claude-<family>-<major>[-<minor>][-<yyyymmdd>] — rejects legacy "claude-3-…",
// "<synthetic>", and free-form strings.
const CLAUDE_MODEL_ID = /^claude-[a-z]+-\d{1,2}(-\d{1,2})?(-\d{8})?$/;

let lastDispatchAt: number | null = null;

export function unpricedClaudeModels(models: Iterable<string>): string[] {
  const out = new Set<string>();
  for (const m of models) {
    if (CLAUDE_MODEL_ID.test(m) && !hasOfficialPricing(m)) out.add(m);
  }
  return [...out];
}

export async function requestPricingCheck(
  models: string[],
  now: number = Date.now()
): Promise<"skipped" | "sent" | "failed"> {
  const token = process.env.GITHUB_PRICING_DISPATCH_TOKEN?.trim();
  if (!token || models.length === 0) return "skipped";
  if (lastDispatchAt !== null && now - lastDispatchAt < MIN_DISPATCH_INTERVAL_MS) {
    return "skipped";
  }
  lastDispatchAt = now;

  try {
    const res = await fetch(DISPATCH_URL, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ event_type: "pricing-check" }),
      signal: AbortSignal.timeout(DISPATCH_TIMEOUT_MS),
    });
    console.log(
      JSON.stringify({
        evt: "pricing_check_dispatch",
        models: models.slice(0, 5),
        status: res.status,
      })
    );
    return res.status === 204 ? "sent" : "failed";
  } catch (error) {
    console.warn("[pricing-dispatch] failed:", error);
    return "failed";
  }
}

export function resetPricingDispatchForTest(): void {
  lastDispatchAt = null;
}
