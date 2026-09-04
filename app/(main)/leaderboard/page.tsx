import { headers } from "next/headers";
import { LeaderboardPageClient } from "@/components/leaderboard/LeaderboardPageClient";
import { fetchInitialLeaderboard } from "@/lib/leaderboard/initial-server";

const FALLBACK_TIME_ZONE = "UTC";

export default async function LeaderboardPage() {
  const requestHeaders = await headers();
  const tz = requestHeaders.get("x-vercel-ip-timezone") ?? FALLBACK_TIME_ZONE;
  const initialLeaderboard = await fetchInitialLeaderboard(tz);
  return <LeaderboardPageClient initialLeaderboard={initialLeaderboard} />;
}
