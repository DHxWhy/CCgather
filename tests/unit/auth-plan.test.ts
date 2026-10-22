import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  KNOWN_PLAN_KEYS,
  normalizeSubmittedPlan,
  planCategory,
  unknownSubscriptionType,
} from "@/lib/services/auth-plan";
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
    expect(normalizeSubmittedPlan({ ccplan: "default_claude_ai" })).toBe("default_claude_ai");
  });

  it("stores only [a-z0-9_], at most 32 characters", () => {
    expect(normalizeSubmittedPlan({ ccplan: "Weird-Plan" })).toBe("weird_plan");
    expect(normalizeSubmittedPlan({ ccplan: "max\nINJECTED line" })).toBe("max_injected_line");
    expect(normalizeSubmittedPlan({ ccplan: "a".repeat(5000) })).toBe("a".repeat(32));
    expect(normalizeSubmittedPlan({ ccplan: "--" })).toBeNull();
  });

  it("returns null when nothing was sent", () => {
    expect(normalizeSubmittedPlan({})).toBeNull();
    expect(normalizeSubmittedPlan({ ccplan: "  " })).toBeNull();
  });

  it("keeps the stored plan when an API-key report carries no plan", () => {
    expect(normalizeSubmittedPlan({ ccplan: null, authMethod: "api_key" })).toBeNull();
  });

  it("does not turn a cloud provider or api into a subscription rewrite", () => {
    expect(normalizeSubmittedPlan({ ccplan: "bedrock", authMethod: "api_key" })).toBe("bedrock");
    expect(normalizeSubmittedPlan({ ccplan: "api", authMethod: "api_key" })).toBe("api");
  });
});

describe("planCategory (admin grouping)", () => {
  it("groups every key the server accepts", () => {
    for (const key of KNOWN_PLAN_KEYS) {
      expect(planCategory(key), key).not.toBe("unknown");
    }
  });

  it("keeps the subscription tiers, merges business, and groups API billing", () => {
    expect(planCategory("Max")).toBe("max");
    expect(planCategory("pro")).toBe("pro");
    expect(planCategory("free")).toBe("free");
    expect(planCategory("team")).toBe("business");
    expect(planCategory("enterprise")).toBe("business");
    expect(planCategory("api")).toBe("api");
    expect(planCategory("bedrock")).toBe("api");
    expect(planCategory("gcp_platform")).toBe("api");
    expect(planCategory("default_claude_ai")).toBe("unknown");
    expect(planCategory("constructor")).toBe("unknown");
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

  it("gives a stored plan named like an Object member the fallback badge", () => {
    expect(getCCPlanConfig("constructor")).toMatchObject({ name: "CONSTRUCTOR", icon: "❓" });
    expect(getCCPlanConfig("__proto__")).toMatchObject({ name: "__PROTO__", icon: "❓" });
  });
});

describe("unknownSubscriptionType", () => {
  it("names a new subscription type a /login reports without a plan key", () => {
    const login = { ccplan: null, authMethod: "oauth" };
    expect(unknownSubscriptionType({ ...login, rawSubscriptionType: "ultra" })).toBe("ultra");
    expect(unknownSubscriptionType({ ...login, rawSubscriptionType: " Ultra Plan! " })).toBe(
      "ultra_plan"
    );
  });

  it("stays quiet for known types, a sent plan key, other sign-ins and empty values", () => {
    expect(unknownSubscriptionType({ authMethod: "oauth", rawSubscriptionType: "max" })).toBeNull();
    expect(
      unknownSubscriptionType({ ccplan: "max", authMethod: "oauth", rawSubscriptionType: "ultra" })
    ).toBeNull();
    expect(
      unknownSubscriptionType({ authMethod: "api_key", rawSubscriptionType: "console_login" })
    ).toBeNull();
    expect(unknownSubscriptionType({ authMethod: "oauth", rawSubscriptionType: null })).toBeNull();
    expect(unknownSubscriptionType({ authMethod: "oauth", rawSubscriptionType: "  " })).toBeNull();
  });
});

describe("plan wiring", () => {
  it("the submit route stores the normalized plan from the shared module", () => {
    const route = read("app/api/cli/submit/route.ts");
    expect(route).toContain('from "@/lib/services/auth-plan"');
    expect(route).toContain("const submittedPlan = normalizeSubmittedPlan(body);");
    expect(route).toContain("updateData.ccplan = submittedPlan;");
    expect(route).not.toContain("updateData.ccplan = body.ccplan");
    expect(route).not.toContain("const KNOWN_CCPLANS = [");
  });

  it("the submit route raises the discovery alert for a raw subscription type", () => {
    const route = read("app/api/cli/submit/route.ts");
    expect(route).toContain("const rawSubscription = unknownSubscriptionType(body);");
    // The insert sits under that check, so a check that never passes is caught too
    expect(route).toMatch(
      /const rawSubscription = unknownSubscriptionType\(body\);\s*if \(rawSubscription\) \{[\s\S]{0,400}?supabase\.from\("admin_alerts"\)\.insert\(\{\s*type: "unknown_ccplan",/
    );
    expect(route).toContain(
      'message: `Unknown subscription type "${rawSubscription}" discovered`,'
    );
  });

  it("the admin pages group plans through planCategory, not their own lists", () => {
    for (const file of [
      "app/(admin)/superadmin/page.tsx",
      "app/api/admin/users/route.ts",
      "app/(admin)/superadmin/deleted-users/page.tsx",
    ]) {
      const source = read(file);
      expect(source, file).toContain('import { planCategory } from "@/lib/services/auth-plan";');
      expect(source, file).not.toContain('["free", "pro", "max", "team", "enterprise"]');
    }
  });

  it("auth-plan stays import-free, so client pages can use it", () => {
    expect(read("lib/services/auth-plan.ts")).not.toMatch(/^\s*import\s/m);
  });

  it("the badge prints the short label, not the raw key", () => {
    expect(read("components/leaderboard/CCplanBadge.tsx")).toMatch(/config\.short \?\? ccplan/);
  });
});
