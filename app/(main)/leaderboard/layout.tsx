import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/server";

// 1시간마다 schema 재생성 — top users 변동 반영하되 build/cache 효율 균형
export const revalidate = 3600;

// ===========================================
// SEO Metadata for Leaderboard
// ===========================================
export const metadata: Metadata = {
  title: "Claude Code Usage Leaderboard - Track & Compare Global Rankings",
  description:
    "Real-time Claude Code usage leaderboard. Track and compare top Claude Code developers by token usage worldwide. See global rankings, usage stats, and compete with the AI coding community.",
  keywords: [
    "Claude Code leaderboard",
    "Claude Code usage leaderboard",
    "Claude Code ranking",
    "Claude Code usage tracker",
    "track Claude Code usage",
    "compare Claude Code",
    "Claude Code stats",
    "top Claude Code users",
    "Claude Code community",
    "developer leaderboard",
    "token usage rankings",
    "Anthropic Claude leaderboard",
  ],
  openGraph: {
    title: "Claude Code Usage Leaderboard - Track & Compare Rankings",
    description:
      "Real-time Claude Code usage leaderboard. Track and compare top developers by token usage worldwide.",
    type: "website",
    url: "https://ccgather.com/leaderboard",
  },
  twitter: {
    card: "summary_large_image",
    title: "Claude Code Usage Leaderboard - Track & Compare",
    description:
      "Real-time Claude Code usage leaderboard. Track and compare top developers worldwide.",
  },
  alternates: {
    canonical: "https://ccgather.com/leaderboard",
  },
};

// ===========================================
// JSON-LD Structured Data
// ===========================================

// Privacy 보호: profile_visibility_consent=true + 삭제되지 않은 사용자만.
// Top 10 만 schema 에 포함 — Google rich snippet 의 권장 entries 수.
// 실패해도 빈 배열 반환 (페이지 자체는 정상 렌더, schema 만 최소화).
type TopUserRow = {
  username: string | null;
  country_code: string | null;
  total_tokens: number | null;
};

async function fetchTopUsersForSchema(): Promise<TopUserRow[]> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("users")
      .select("username, country_code, total_tokens")
      .eq("profile_visibility_consent", true)
      .is("deleted_at", null)
      .not("username", "is", null)
      .gt("total_tokens", 0)
      .order("total_tokens", { ascending: false })
      .limit(10);

    if (error) {
      console.warn("[LeaderboardJsonLd] fetch failed:", error.message);
      return [];
    }
    return (data as TopUserRow[]) ?? [];
  } catch (err) {
    console.warn("[LeaderboardJsonLd] fetch threw:", err);
    return [];
  }
}

async function LeaderboardJsonLd() {
  const topUsers = await fetchTopUsersForSchema();

  const itemListElement = topUsers
    .filter((u): u is TopUserRow & { username: string } => Boolean(u.username))
    .map((u, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      url: `https://ccgather.com/u/${u.username}`,
      name: u.username,
    }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Claude Code Usage Leaderboard - Track & Compare Global Rankings",
    description:
      "Real-time Claude Code usage leaderboard. Track and compare top developers by token usage worldwide.",
    url: "https://ccgather.com/leaderboard",
    mainEntity: {
      "@type": "ItemList",
      name: "Top Claude Code Developers by Token Usage",
      description:
        "Global rankings of Claude Code developers ranked by total tokens used. Updated hourly.",
      itemListOrder: "https://schema.org/ItemListOrderDescending",
      numberOfItems: itemListElement.length,
      itemListElement,
    },
    isPartOf: {
      "@type": "WebSite",
      name: "CCgather",
      url: "https://ccgather.com",
    },
    publisher: {
      "@type": "Organization",
      name: "CCgather",
      url: "https://ccgather.com",
    },
  };

  // JSON.stringify 결과의 "<" 를 "<" 로 escape — </script> 가
  // 우연히 schema 데이터에 들어가도 HTML parser 가 script tag 닫지 않음.
  // username 같은 사용자 입력이 schema 에 포함되므로 XSS 방어 필수.
  const safeJson = JSON.stringify(jsonLd).replace(/</g, "\\u003c");

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJson }} />;
}

export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LeaderboardJsonLd />
      {children}
    </>
  );
}
