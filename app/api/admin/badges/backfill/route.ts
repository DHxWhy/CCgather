import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import { checkAndAwardBadges } from "@/lib/services/badgeService";
import { BADGES } from "@/lib/constants/badges";

/**
 * 배지 소급 지급. 배지는 CLI 제출 시점에만 판정되므로, 카탈로그에 배지를 추가하거나
 * 조건을 바꾸면 다시 제출하지 않는 회원은 영영 받지 못한다. 같은 판정 로직을 전원에게
 * 한 번 돌려 밀린 발급을 채운다. 추가만 하고 회수하지 않는다.
 *
 * GET  ?limit=N  드라이런 — 누구에게 무엇이 발급될지만 계산
 * POST ?limit=N  실제 발급
 */
export const maxDuration = 300;

const PAGE = 1000;

interface BoardUser {
  id: string;
  username: string;
  total_tokens: number | null;
  total_cost: number | null;
  total_sessions: number | null;
  global_rank: number | null;
  country_rank: number | null;
  country_code: string | null;
  auto_sync_enabled: boolean | null;
  github_starred_at: string | null;
}

async function verifyAdmin() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return { error: "Unauthorized", status: 401 as const };

  const supabase = createServiceClient();
  const { data: user } = await supabase
    .from("users")
    .select("id, is_admin")
    .eq("clerk_id", clerkId)
    .single();

  if (!user || !user.is_admin) return { error: "Forbidden", status: 403 as const };
  return { supabase };
}

/** 응답당 1000행 상한 때문에 커서로 전량을 읽는다. */
async function fetchBoardUsers(
  supabase: ReturnType<typeof createServiceClient>
): Promise<BoardUser[]> {
  const users: BoardUser[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("users")
      .select(
        "id, username, total_tokens, total_cost, total_sessions, global_rank, country_rank, country_code, auto_sync_enabled, github_starred_at"
      )
      .is("deleted_at", null)
      .eq("shadow_banned", false)
      .gt("total_tokens", 0)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`fetchBoardUsers failed: ${error.message}`);
    const page = data ?? [];
    users.push(...(page as BoardUser[]));
    if (page.length < PAGE) return users;
  }
}

async function runBackfill(dryRun: boolean, limit: number) {
  const supabase = createServiceClient();
  const users = await fetchBoardUsers(supabase);
  const targets = users.slice(0, limit);

  const perBadge: Record<string, number> = {};
  const perUser: Array<{ username: string; awarded: string[] }> = [];
  const failures: Array<{ username: string; error: string }> = [];
  const known = new Set(BADGES.map((b) => b.id));
  let awardedTotal = 0;

  for (const u of targets) {
    try {
      const before = new Set<string>();
      if (dryRun) {
        const { data } = await supabase
          .from("user_badges")
          .select("badge_type")
          .eq("user_id", u.id);
        for (const row of (data ?? []) as Array<{ badge_type: string }>) before.add(row.badge_type);
      }

      const result = await checkAndAwardBadges(
        u.id,
        {
          id: u.id,
          total_tokens: u.total_tokens ?? 0,
          total_cost: Number(u.total_cost ?? 0),
          total_sessions: u.total_sessions ?? 0,
          global_rank: u.global_rank ?? Number.MAX_SAFE_INTEGER,
          country_rank: u.country_rank ?? undefined,
          country_code: u.country_code ?? undefined,
          auto_sync_enabled: u.auto_sync_enabled ?? false,
          github_starred: !!u.github_starred_at,
        },
        undefined,
        { persist: !dryRun }
      );

      const awarded = result.newBadges.map((b) => b.id).filter((id) => known.has(id));
      if (awarded.length > 0) {
        awardedTotal += awarded.length;
        perUser.push({ username: u.username, awarded });
        for (const id of awarded) perBadge[id] = (perBadge[id] ?? 0) + 1;
      }
    } catch (err) {
      failures.push({
        username: u.username,
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  return {
    dryRun,
    scanned: targets.length,
    boardTotal: users.length,
    usersAffected: perUser.length,
    awardedTotal,
    perBadge: Object.fromEntries(Object.entries(perBadge).sort((a, b) => b[1] - a[1])),
    sample: perUser.slice(0, 20),
    failures,
  };
}

function parseLimit(request: NextRequest): number {
  const raw = Number(new URL(request.url).searchParams.get("limit"));
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : Number.MAX_SAFE_INTEGER;
}

export async function GET(request: NextRequest) {
  const guard = await verifyAdmin();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    return NextResponse.json(await runBackfill(true, parseLimit(request)));
  } catch (err) {
    console.error("[BadgeBackfill] dry run failed:", err);
    return NextResponse.json({ error: "Backfill dry run failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const guard = await verifyAdmin();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const result = await runBackfill(false, parseLimit(request));
    console.log(
      `[BadgeBackfill] awarded ${result.awardedTotal} badges to ${result.usersAffected} users`
    );
    return NextResponse.json(result);
  } catch (err) {
    console.error("[BadgeBackfill] failed:", err);
    return NextResponse.json({ error: "Backfill failed" }, { status: 500 });
  }
}
