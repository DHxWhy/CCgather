"use client";

import LeaderboardPage from "@/app/(main)/leaderboard/page";

// Community page renders the shared LeaderboardPage component
// Initial view is determined by pathname ("/community") in LeaderboardPage
// Zero-latency view switching via URL sync (window.history.replaceState)
export default function CommunityPage() {
  return <LeaderboardPage />;
}
