import { describe, it, expect } from "vitest";
import { planShortName } from "../src/lib/plan-names";

describe("plan names", () => {
  it("shows a plan by the site badge's short name, and an unknown key as it is", () => {
    expect(planShortName("max")).toBe("Max");
    expect(planShortName("aws_platform")).toBe("AWS");
    expect(planShortName("gcp_platform")).toBe("Google Cloud");
    expect(planShortName("ultra")).toBe("ultra");
    expect(planShortName("constructor")).toBe("constructor");
  });
});
