// Plan keys follow Claude Code's own labels (2.1.306): subscription plans, "api" for
// API usage billing (an API key or a Claude Console login), and the cloud providers
// Claude Code names via CLAUDE_CODE_USE_<PROVIDER>.
export const KNOWN_PLAN_KEYS = [
  "free",
  "pro",
  "max",
  "team",
  "enterprise",
  "api",
  "bedrock",
  "vertex",
  "foundry",
  "aws_platform",
  "gcp_platform",
  "mantle",
] as const;

export type PlanKey = (typeof KNOWN_PLAN_KEYS)[number];

export function isKnownPlanKey(value: string): value is PlanKey {
  return (KNOWN_PLAN_KEYS as readonly string[]).includes(value);
}

const SUBSCRIPTION_PLAN_KEYS: readonly string[] = ["free", "pro", "max", "team", "enterprise"];

// Admin grouping. API keys, Console logins and cloud providers are all what Claude Code
// heads "API Usage Billing", so they share one group.
export type PlanCategory = "free" | "pro" | "max" | "business" | "api" | "unknown";

export function planCategory(plan: string): PlanCategory {
  const key = plan.toLowerCase();
  if (key === "free" || key === "pro" || key === "max") return key;
  if (key === "team" || key === "enterprise") return "business";
  return isKnownPlanKey(key) ? "api" : "unknown";
}

interface SubmittedPlan {
  ccplan?: unknown;
  authMethod?: unknown;
  rawSubscriptionType?: unknown;
}

/**
 * A subscription type to raise a discovery alert for, or null. CLI 2.3.3+ sends only
 * known plan keys, so a new subscription type arrives as the raw value of a /login
 * (authMethod "oauth") with no ccplan.
 */
export function unknownSubscriptionType(body: SubmittedPlan): string | null {
  if (body.authMethod !== "oauth" || normalizeSubmittedPlan(body) !== null) return null;
  const raw = normalizeSubmittedPlan({ ccplan: body.rawSubscriptionType });
  return raw !== null && !isKnownPlanKey(raw) ? raw : null;
}

/**
 * The plan to store for a submission, or null to keep the stored one. Stored values
 * are `[a-z0-9_]`, at most 32 characters; an unknown value is kept (the route raises
 * a discovery alert for it). CLIs before 2.3.3 report API-key and Console logins as
 * authMethod "api_key" with a made-up subscription plan ("team" by default); both are
 * API usage billing, so such a plan becomes "api".
 */
export function normalizeSubmittedPlan(body: SubmittedPlan): string | null {
  if (typeof body.ccplan !== "string") return null;
  const plan = body.ccplan
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .slice(0, 32)
    .replace(/^_+|_+$/g, "");
  if (plan === "") return null;
  if (body.authMethod === "api_key" && SUBSCRIPTION_PLAN_KEYS.includes(plan)) return "api";
  return plan;
}
