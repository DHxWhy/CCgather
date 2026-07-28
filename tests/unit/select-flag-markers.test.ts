import { describe, it, expect } from "vitest";
import { flagSizeForRank, selectFlagMarkers } from "../../lib/globe/select-flag-markers";

const HAS_COORDS = (code: string) => ["KR", "US", "TH", "XX"].includes(code);

const MARKERS = [
  { code: "KR", tokens: 100, cost: 1 },
  { code: "US", tokens: 300, cost: 2 },
  { code: "TH", tokens: 200, cost: 9 },
];

describe("selectFlagMarkers", () => {
  it("ranks by tokens descending", () => {
    const r = selectFlagMarkers({
      markers: MARKERS,
      hasCoordinates: HAS_COORDS,
      scopeFilter: "global",
      sortBy: "tokens",
    });
    expect(r.map((m) => m.code)).toEqual(["US", "TH", "KR"]);
    expect(r.map((m) => m.rank)).toEqual([0, 1, 2]);
  });

  it("ranks by cost when sortBy is cost", () => {
    const r = selectFlagMarkers({
      markers: MARKERS,
      hasCoordinates: HAS_COORDS,
      scopeFilter: "global",
      sortBy: "cost",
    });
    expect(r.map((m) => m.code)).toEqual(["TH", "US", "KR"]);
  });

  it("drops codes without coordinates", () => {
    const r = selectFlagMarkers({
      markers: [...MARKERS, { code: "ZZ", tokens: 999, cost: 999 }],
      hasCoordinates: HAS_COORDS,
      scopeFilter: "global",
      sortBy: "tokens",
    });
    expect(r.map((m) => m.code)).not.toContain("ZZ");
  });

  it("normalises lowercase marker codes", () => {
    const r = selectFlagMarkers({
      markers: [{ code: "kr", tokens: 5, cost: 5 }],
      hasCoordinates: HAS_COORDS,
      scopeFilter: "global",
      sortBy: "tokens",
    });
    expect(r).toEqual([{ code: "KR", rank: 0, isMine: false }]);
  });

  it("marks the user's country", () => {
    const r = selectFlagMarkers({
      markers: MARKERS,
      hasCoordinates: HAS_COORDS,
      scopeFilter: "global",
      userCountryCode: "kr",
      sortBy: "tokens",
    });
    expect(r.find((m) => m.code === "KR")!.isMine).toBe(true);
    expect(r.filter((m) => m.isMine)).toHaveLength(1);
  });

  it("keeps only the user's country in country scope", () => {
    const r = selectFlagMarkers({
      markers: MARKERS,
      hasCoordinates: HAS_COORDS,
      scopeFilter: "country",
      userCountryCode: "KR",
      sortBy: "tokens",
    });
    expect(r).toEqual([{ code: "KR", rank: 0, isMine: true }]);
  });

  it("synthesises the user's flag in country scope when they have no marker", () => {
    const r = selectFlagMarkers({
      markers: MARKERS,
      hasCoordinates: HAS_COORDS,
      scopeFilter: "country",
      userCountryCode: "XX",
      sortBy: "tokens",
    });
    expect(r).toEqual([{ code: "XX", rank: 0, isMine: true }]);
  });

  it("falls back to all flags in country scope without a user country", () => {
    const r = selectFlagMarkers({
      markers: MARKERS,
      hasCoordinates: HAS_COORDS,
      scopeFilter: "country",
      sortBy: "tokens",
    });
    expect(r).toHaveLength(3);
  });

  it("returns nothing when the user's country has no coordinates", () => {
    const r = selectFlagMarkers({
      markers: MARKERS,
      hasCoordinates: HAS_COORDS,
      scopeFilter: "country",
      userCountryCode: "ZZ",
      sortBy: "tokens",
    });
    expect(r).toEqual([]);
  });
});

describe("flagSizeForRank", () => {
  it.each([
    [0, "md"],
    [1, "sm"],
    [4, "sm"],
    [5, "xs"],
    [99, "xs"],
  ])("rank %i maps to %s", (rank, size) => {
    expect(flagSizeForRank(rank as number)).toBe(size);
  });
});
