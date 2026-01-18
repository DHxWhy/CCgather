import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    // Get API token from Authorization header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid authorization header" },
        { status: 401 }
      );
    }

    const apiToken = authHeader.slice(7);
    if (!apiToken || apiToken.length < 10) {
      return NextResponse.json({ error: "Invalid API token" }, { status: 401 });
    }

    const supabase = await createClient();

    // Find user by API key
    const { data: user, error: userError } = await supabase
      .from("users")
      .select(
        "id, username, global_rank, country_rank, country_code, ccplan, total_tokens, total_cost"
      )
      .eq("api_key", apiToken)
      .maybeSingle();

    if (userError || !user) {
      if (userError) {
        console.error("[CLI Status] DB Error:", userError);
      }
      return NextResponse.json({ error: "Invalid API token" }, { status: 401 });
    }

    // Get user badges
    const { data: userBadges } = await supabase
      .from("user_badges")
      .select("badge_type")
      .eq("user_id", user.id);

    const badges = userBadges?.map((b) => b.badge_type) || [];

    // Calculate percentile
    const { count: totalUsers } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true });

    const percentile =
      totalUsers && user.global_rank ? ((totalUsers - user.global_rank + 1) / totalUsers) * 100 : 0;

    return NextResponse.json({
      rank: user.global_rank,
      countryRank: user.country_rank,
      countryCode: user.country_code,
      totalTokens: user.total_tokens,
      totalSpent: user.total_cost,
      tier: user.ccplan,
      badges,
      percentile: Math.round(percentile * 10) / 10,
    });
  } catch (error) {
    console.error("[CLI Status] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
