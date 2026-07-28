export interface FlagMarkerInput {
  code: string;
  tokens: number;
  cost: number;
}

export interface SelectedFlagMarker {
  code: string;
  rank: number;
  isMine: boolean;
}

export function flagSizeForRank(rank: number): "md" | "sm" | "xs" {
  if (rank === 0) return "md";
  if (rank < 5) return "sm";
  return "xs";
}

/**
 * Country scope returns the viewer's own flag alone **even when they have no
 * marker yet** — otherwise filtering to a country nobody has submitted from
 * leaves the globe blank.
 */
export function selectFlagMarkers(args: {
  markers: FlagMarkerInput[];
  hasCoordinates: (code: string) => boolean;
  scopeFilter: "global" | "country";
  userCountryCode?: string;
  sortBy: "tokens" | "cost";
}): SelectedFlagMarker[] {
  const { markers, hasCoordinates, scopeFilter, sortBy } = args;
  const mine = args.userCountryCode?.toUpperCase();

  if (scopeFilter === "country" && mine) {
    return hasCoordinates(mine) ? [{ code: mine, rank: 0, isMine: true }] : [];
  }

  return markers
    .map((m) => ({ ...m, code: m.code.toUpperCase() }))
    .filter((m) => hasCoordinates(m.code))
    .sort((a, b) => (sortBy === "cost" ? b.cost - a.cost : b.tokens - a.tokens))
    .map((m, rank) => ({ code: m.code, rank, isMine: m.code === mine }));
}
