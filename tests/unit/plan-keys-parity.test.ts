import { describe, expect, it } from "vitest";
import { KNOWN_PLAN_KEYS } from "@/lib/services/auth-plan";
import { CCPLAN_CONFIG } from "@/lib/types/leaderboard";
import { SENT_PLAN_KEYS } from "../../packages/cli/src/lib/credentials";
import { PLAN_SHORT_NAMES } from "../../packages/cli/src/lib/plan-names";

describe("plan keys", () => {
  it("every ccplan the CLI sends is a key the server knows", () => {
    for (const key of SENT_PLAN_KEYS) {
      expect(KNOWN_PLAN_KEYS as readonly string[], key).toContain(key);
    }
  });

  it("the CLI shows each plan by the site badge's short name", () => {
    for (const key of SENT_PLAN_KEYS) {
      expect(PLAN_SHORT_NAMES[key], key).toBeDefined();
      expect(PLAN_SHORT_NAMES[key], key).toBe(CCPLAN_CONFIG[key]?.short);
    }
  });
});
