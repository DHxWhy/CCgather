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

interface SubmittedPlan {
  ccplan?: unknown;
  authMethod?: unknown;
  rawSubscriptionType?: unknown;
}

/**
 * The plan to store for a submission, or null to keep the stored one.
 * CLIs before 2.3.3 report API-key and Console logins as authMethod "api_key" with a
 * made-up plan ("team" by default); both are API usage billing, so they become "api".
 */
export function normalizeSubmittedPlan(body: SubmittedPlan): string | null {
  if (body.authMethod === "api_key") return "api";
  if (typeof body.ccplan !== "string") return null;
  const plan = body.ccplan.trim().toLowerCase();
  return plan === "" ? null : plan;
}
