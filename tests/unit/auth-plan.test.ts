import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { KNOWN_PLAN_KEYS, normalizeSubmittedPlan } from "@/lib/services/auth-plan";
import { CCPLAN_CONFIG, getCCPlanConfig } from "@/lib/types/leaderboard";

const read = (p: string) => readFileSync(path.resolve(__dirname, "../../", p), "utf-8");

describe("normalizeSubmittedPlan", () => {
  it("turns the old CLI's API-key report into api, not team", () => {
    expect(
      normalizeSubmittedPlan({
        ccplan: "team",
        authMethod: "api_key",
        rawSubscriptionType: "api_key_auth",
      })
    ).toBe("api");
  });

  it("treats an old CLI Console organization login as api billing", () => {
    expect(
      normalizeSubmittedPlan({
        ccplan: "enterprise",
        authMethod: "api_key",
        rawSubscriptionType: "enterprise",
      })
    ).toBe("api");
  });

  it("keeps a subscription plan, lower-cased", () => {
    expect(normalizeSubmittedPlan({ ccplan: "MAX", authMethod: "oauth" })).toBe("max");
  });

  it("keeps a cloud provider key the new CLI sends", () => {
    expect(normalizeSubmittedPlan({ ccplan: "bedrock" })).toBe("bedrock");
  });

  it("passes an unknown value through so the discovery alert still fires", () => {
    expect(normalizeSubmittedPlan({ ccplan: "Weird-Plan" })).toBe("weird-plan");
  });

  it("returns null when nothing was sent", () => {
    expect(normalizeSubmittedPlan({})).toBeNull();
    expect(normalizeSubmittedPlan({ ccplan: "  " })).toBeNull();
  });
});

describe("official plan labels (Claude Code 2.1.306)", () => {
  it("names each plan the way Claude Code does", () => {
    expect(getCCPlanConfig("pro")?.name).toBe("Claude Pro");
    expect(getCCPlanConfig("max")?.name).toBe("Claude Max");
    expect(getCCPlanConfig("team")?.name).toBe("Claude Team");
    expect(getCCPlanConfig("enterprise")?.name).toBe("Claude Enterprise");
    expect(getCCPlanConfig("api")?.name).toBe("Claude API");
    expect(getCCPlanConfig("bedrock")?.name).toBe("Amazon Bedrock");
    expect(getCCPlanConfig("vertex")?.name).toBe("Google Vertex AI");
    expect(getCCPlanConfig("foundry")?.name).toBe("Microsoft Foundry");
    expect(getCCPlanConfig("aws_platform")?.name).toBe("Claude Platform on AWS");
    expect(getCCPlanConfig("gcp_platform")?.name).toBe("Claude Platform on Google Cloud");
    expect(getCCPlanConfig("mantle")?.name).toBe("Amazon Bedrock (Mantle)");
  });

  it("has a badge for every plan key the server accepts", () => {
    for (const key of KNOWN_PLAN_KEYS) {
      expect(CCPLAN_CONFIG[key], key).toBeDefined();
    }
  });
});

describe("plan wiring", () => {
  it("the submit route stores the normalized plan from the shared module", () => {
    const route = read("app/api/cli/submit/route.ts");
    expect(route).toContain('from "@/lib/services/auth-plan"');
    expect(route).toMatch(/normalizeSubmittedPlan\(body\)/);
    expect(route).not.toContain("const KNOWN_CCPLANS = [");
  });

  it("the badge prints the short label, not the raw key", () => {
    expect(read("components/leaderboard/CCplanBadge.tsx")).toMatch(/config\.short \?\? ccplan/);
  });
});
