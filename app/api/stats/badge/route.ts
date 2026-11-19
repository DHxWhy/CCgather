import { CACHE_TAG_LEADERBOARD, edgeCacheHeaders } from "@/lib/cache/edge-cache-shared";
import type { LiveNumbers } from "@/lib/seo/llms";
import { getLiveNumbers } from "@/lib/seo/live-numbers";

// README badges through shields.io's endpoint badge: https://shields.io/badges/endpoint-badge
const TTL_SEC = 3600;
const COLOR = "da7756";

function compact(n: number): string {
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  return n.toLocaleString("en-US");
}

const METRICS: Record<string, { label: string; message: (live: LiveNumbers) => string | null }> = {
  developers: {
    label: "developers",
    message: (live) =>
      live.developers && live.countries
        ? `${live.developers.toLocaleString("en-US")} in ${live.countries} countries`
        : null,
  },
  tokens: {
    label: "Claude Code tokens logged",
    message: (live) => (live.tokensAllTime ? compact(live.tokensAllTime) : null),
  },
  tokens30d: {
    label: "tokens, last 30 days",
    message: (live) => (live.tokens30d ? compact(live.tokens30d) : null),
  },
};

export async function GET(request: Request) {
  const metric = new URL(request.url).searchParams.get("metric") ?? "";
  const spec = Object.hasOwn(METRICS, metric) ? METRICS[metric] : undefined;
  if (!spec) {
    return Response.json(
      { schemaVersion: 1, label: "ccgather", message: "unknown metric", isError: true },
      { status: 400 }
    );
  }

  const live = await getLiveNumbers().catch((error: unknown) => {
    console.error("[stats/badge] live numbers unavailable:", error);
    return null;
  });
  const message = live ? spec.message(live) : null;
  const body = message
    ? { schemaVersion: 1, label: spec.label, message, color: COLOR, cacheSeconds: TTL_SEC }
    : { schemaVersion: 1, label: spec.label, message: "unavailable", isError: true };

  return Response.json(body, { headers: edgeCacheHeaders(TTL_SEC, [CACHE_TAG_LEADERBOARD]) });
}
