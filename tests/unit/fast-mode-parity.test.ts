import { describe, expect, it } from "vitest";
import { FAST_MODE_MULTIPLIERS as SERVER } from "@/lib/services/fast-mode";
import { FAST_MODE_MULTIPLIERS as CLI } from "../../packages/cli/src/lib/fast-mode";

describe("fast-mode multipliers", () => {
  it("the CLI's copy equals the server's table", () => {
    expect(CLI).toEqual(SERVER);
  });
});
