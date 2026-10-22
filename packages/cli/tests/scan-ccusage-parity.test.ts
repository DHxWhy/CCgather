/**
 * ccusage parity on a fixed transcript set.
 *
 * fixtures/ccusage-parity holds two config folders (A, B) written by the research
 * script make_ccusage_fixture.py, and ccusage-daily.json is what ccusage 20.0.37
 * printed for them (`claude daily --json --offline --mode calculate -z UTC`). Opus 4.8
 * in folder A is one response written as four lines whose output is 8, 8, 8 and 534;
 * Sonnet 4.6 in folder B writes 300 tokens to the 1-hour cache.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const mocked = vi.hoisted(() => ({ home: "" }));

vi.mock("os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("os")>();
  return { ...actual, homedir: () => mocked.home };
});

// The real conf store holds the user's confirmed data folders; a scan must not read them.
vi.mock("../src/lib/config", () => ({ getConfig: () => ({ get: () => undefined }) }));

vi.mock("../src/lib/credentials", () => ({
  readCredentials: () => ({
    ccplan: null,
    rateLimitTier: null,
    authMethod: "unknown",
    rawSubscriptionType: null,
  }),
}));

import { scanAllProjects } from "../src/lib/ccgather-json";
import { estimateCostRaw } from "../src/lib/pricing";

const FIXTURE = path.join(__dirname, "fixtures", "ccusage-parity");
const FIXTURE_SHA256: Record<string, string> = {
  "A/projects/projA/s1.jsonl": "49f701a4729071b6b92df47d79427a4d36ab96d9e4363e39466558acaa41971c",
  "A/projects/projA/s2.jsonl": "78ee6589618290bd35b419955fde5c4ff6bc0854ab609897c86cd6c81eac9f93",
  "B/projects/projB/s3.jsonl": "2f605a6d2010528a0e463f736a151bab3157d7e73781f0c140d8902c6cfdc89c",
  "ccusage-daily.json": "858a93745135ce8b4b4af617a338a648319f953a88514ab8d3d18f1c91ebf61e",
};

interface CcusageBreakdown {
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  cost: number;
}

const ccusage = JSON.parse(fs.readFileSync(path.join(FIXTURE, "ccusage-daily.json"), "utf-8")) as {
  daily: { date: string; modelBreakdowns: CcusageBreakdown[] }[];
};
const breakdownOf = (model: string): CcusageBreakdown => {
  const found = ccusage.daily[0].modelBreakdowns.find((b) => b.modelName === model);
  if (!found) throw new Error(`ccusage has no ${model}`);
  return found;
};

function scanFolder(folder: string) {
  vi.stubEnv("CLAUDE_CONFIG_DIR", folder);
  const data = scanAllProjects();
  expect(data?.dailyUsage.map((d) => d.date)).toEqual(["2026-10-20"]);
  return data!;
}

beforeEach(() => {
  mocked.home = fs.mkdtempSync(path.join(os.tmpdir(), "ccgather-parity-"));
  vi.stubEnv("APPDATA", "");
  vi.stubEnv("XDG_CONFIG_HOME", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(mocked.home, { recursive: true, force: true });
});

describe("scanAllProjects matches ccusage on the fixture", () => {
  it("reads the fixture it was checked against", () => {
    for (const [file, sha] of Object.entries(FIXTURE_SHA256)) {
      const bytes = fs.readFileSync(path.join(FIXTURE, file));
      expect(crypto.createHash("sha256").update(bytes).digest("hex"), file).toBe(sha);
    }
  });

  it("folder A: one response counted at its largest line, tokens as ccusage", () => {
    const day = scanFolder(path.join(FIXTURE, "A")).dailyUsage[0];
    for (const model of ["claude-opus-4-8", "gpt-oss:120b"]) {
      const want = breakdownOf(model);
      expect(day.modelTokens?.[model], model).toMatchObject({
        inputTokens: want.inputTokens,
        outputTokens: want.outputTokens,
        cacheWriteTokens: want.cacheCreationTokens,
        cacheReadTokens: want.cacheReadTokens,
      });
    }
    expect(day.modelTokens?.["claude-opus-4-8"]?.outputTokens).toBe(534);
  });

  it("folder B: the 1-hour cache write is sent and priced at 2x input, as ccusage", () => {
    const day = scanFolder(path.join(FIXTURE, "B")).dailyUsage[0];
    const want = breakdownOf("claude-sonnet-4-6");
    const split = day.modelTokens?.["claude-sonnet-4-6"];
    expect(split).toEqual({
      inputTokens: want.inputTokens,
      outputTokens: want.outputTokens,
      cacheWriteTokens: want.cacheCreationTokens,
      cacheWrite1hTokens: 300,
      cacheReadTokens: want.cacheReadTokens,
    });
    expect(estimateCostRaw("claude-sonnet-4-6", split!)).toBeCloseTo(want.cost, 12);
  });

  it("prices Opus 4.8 at ccusage's cost for the same tokens", () => {
    const day = scanFolder(path.join(FIXTURE, "A")).dailyUsage[0];
    const want = breakdownOf("claude-opus-4-8");
    expect(estimateCostRaw("claude-opus-4-8", day.modelTokens!["claude-opus-4-8"])).toBeCloseTo(
      want.cost,
      12
    );
  });
});

describe("costs are summed unrounded and rounded once", () => {
  it("1,000 responses of $0.004 make $4.00, not $0.00", () => {
    const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "ccgather-subcent-"));
    try {
      const lines = Array.from({ length: 1000 }, (_, i) =>
        JSON.stringify({
          type: "assistant",
          sessionId: "s1",
          requestId: `req_${i}`,
          timestamp: "2026-10-20T05:00:00.000Z",
          message: {
            id: `msg_${i}`,
            model: "claude-haiku-4-5",
            usage: { input_tokens: 4000, output_tokens: 0 },
          },
        })
      );
      const file = path.join(configDir, "projects", "p", "s1.jsonl");
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, lines.join("\n") + "\n");

      vi.stubEnv("CLAUDE_CONFIG_DIR", configDir);
      const data = scanAllProjects();

      expect(data?.usage.totalCost).toBe(4);
      expect(data?.dailyUsage[0]?.cost).toBe(4);
      expect(data?.projects.p?.cost).toBe(4);
    } finally {
      fs.rmSync(configDir, { recursive: true, force: true });
    }
  });
});
