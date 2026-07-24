import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import { currentSeasonStart, toMonthKey } from "@/lib/constants/season";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const MONTH_KEY = /^\d{4}-\d{2}-01$/;

interface SeasonPositionRow {
  my_rank: number;
  total_participants: number;
  my_tokens: number;
  my_cost: number;
  above_username: string | null;
  above_tokens: number | null;
  below_username: string | null;
  below_tokens: number | null;
  first_username: string | null;
  first_tokens: number | null;
  cut_rank: number;
  cut_tokens: number | null;
}

export async function GET(request: NextRequest) {
  try {
    const monthParam = request.nextUrl.searchParams.get("month");
    const month =
      monthParam && MONTH_KEY.test(monthParam) ? monthParam : toMonthKey(currentSeasonStart());

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ authenticated: false, month }, { headers: NO_STORE });
    }

    const supabase = createServiceClient();
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, username")
      .eq("clerk_id", userId)
      .single();

    if (userError || !user) {
      console.error("[season-position] user lookup failed:", userError?.message ?? "not found");
      return NextResponse.json({ authenticated: false, month }, { headers: NO_STORE });
    }

    // 신규 RPC는 자동 생성 타입에 없어 우회 (프로젝트 규칙)
    const sb = supabase as never as {
      rpc: (
        fn: string,
        args: Record<string, unknown>
      ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
    };
    const { data, error } = await sb.rpc("get_season_position", {
      viewer: user.id,
      m_start: month,
    });

    if (error) {
      console.error("[season-position] rpc failed:", error.message);
      return NextResponse.json({ error: "Failed to load position" }, { status: 500 });
    }

    const row = ((data as SeasonPositionRow[]) ?? [])[0];
    if (!row) {
      return NextResponse.json(
        { authenticated: true, submitted: false, month },
        { headers: NO_STORE }
      );
    }

    return NextResponse.json(
      {
        authenticated: true,
        submitted: true,
        month,
        position: {
          myUsername: user.username,
          myRank: Number(row.my_rank),
          totalParticipants: Number(row.total_participants),
          myTokens: Number(row.my_tokens),
          myCost: Number(row.my_cost),
          aboveUsername: row.above_username,
          aboveTokens: row.above_tokens === null ? null : Number(row.above_tokens),
          belowUsername: row.below_username,
          belowTokens: row.below_tokens === null ? null : Number(row.below_tokens),
          firstUsername: row.first_username,
          firstTokens: row.first_tokens === null ? null : Number(row.first_tokens),
          cutRank: Number(row.cut_rank),
          cutTokens: row.cut_tokens === null ? null : Number(row.cut_tokens),
        },
      },
      { headers: NO_STORE }
    );
  } catch (err) {
    console.error("[season-position] unexpected failure:", err);
    return NextResponse.json({ error: "Failed to load position" }, { status: 500 });
  }
}
