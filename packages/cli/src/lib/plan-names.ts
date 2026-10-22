// No imports: the server's tests read this file next to its own badge names.

/**
 * The site badge's short name for each plan key (lib/types/leaderboard.ts), kept equal by
 * tests/unit/plan-keys-parity.test.ts.
 */
export const PLAN_SHORT_NAMES: Readonly<Record<string, string>> = {
  free: "Free",
  pro: "Pro",
  max: "Max",
  team: "Team",
  enterprise: "Enterprise",
  api: "API",
  bedrock: "Bedrock",
  vertex: "Vertex AI",
  foundry: "Foundry",
  aws_platform: "AWS",
  gcp_platform: "Google Cloud",
  mantle: "Mantle",
};

/** A plan key's short name for the CLI's screens; an unknown key as it is. */
export function planShortName(plan: string): string {
  return (Object.hasOwn(PLAN_SHORT_NAMES, plan) ? PLAN_SHORT_NAMES[plan] : undefined) ?? plan;
}
