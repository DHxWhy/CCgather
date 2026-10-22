import { describe, expect, it } from "vitest";
import { KNOWN_PLAN_KEYS } from "@/lib/services/auth-plan";
import { SENT_PLAN_KEYS } from "../../packages/cli/src/lib/credentials";

describe("plan keys", () => {
  it("every ccplan the CLI sends is a key the server knows", () => {
    for (const key of SENT_PLAN_KEYS) {
      expect(KNOWN_PLAN_KEYS as readonly string[], key).toContain(key);
    }
  });
});
