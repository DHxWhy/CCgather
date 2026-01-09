import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

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

    const supabase = createServiceClient();

    // Find user by API key
    const { data: user, error: userError } = await supabase
      .from("users")
      .select(
        "id, username, rank, country_rank, country_code, tier, total_tokens, total_spent, badges"
      )
      .eq("api_key", apiToken)
      .maybeSingle();

    if (userError || !user) {
      return NextResponse.json({ error: "Invalid API token" }, { status: 401 });
    }

    // Calculate percentile
    const { count: totalUsers } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true });

    const percentile = totalUsers ? ((totalUsers - user.rank + 1) / totalUsers) * 100 : 0;

    return NextResponse.json({
      rank: user.rank,
      countryRank: user.country_rank,
      countryCode: user.country_code,
      totalTokens: user.total_tokens,
      totalSpent: user.total_spent,
      tier: user.tier,
      badges: user.badges || [],
      percentile: Math.round(percentile * 10) / 10,
    });
  } catch (error) {
    console.error("[CLI Status] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
