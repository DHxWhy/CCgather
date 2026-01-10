import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const searchParams = request.nextUrl.searchParams;
  const days = parseInt(searchParams.get("days") || "365", 10);

  const supabase = await createClient();

  // Calculate start date
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Fetch usage history
  const { data: history, error: historyError } = await supabase
    .from("usage_stats")
    .select("date, total_tokens, cost_usd")
    .eq("user_id", id)
    .gte("date", startDate.toISOString().split("T")[0])
    .lte("date", endDate.toISOString().split("T")[0])
    .order("date", { ascending: true });

  if (historyError) {
    console.error("History query error:", historyError);
    return NextResponse.json({ error: "Failed to fetch user history" }, { status: 500 });
  }

  // Fetch user basic info including social_links
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, username, total_tokens, total_cost, social_links")
    .eq("id", id)
    .single();

  if (userError || !user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Transform to expected format
  const transformedHistory = (history || []).map((h) => ({
    date: h.date,
    tokens: h.total_tokens || 0,
    cost: h.cost_usd || 0,
  }));

  // If no usage_stats but user has data, create synthetic "today" entry
  // This handles cases where user re-registered or data was imported
  if (transformedHistory.length === 0 && (user.total_tokens || user.total_cost)) {
    const today = new Date().toISOString().split("T")[0];
    transformedHistory.push({
      date: today,
      tokens: user.total_tokens || 0,
      cost: user.total_cost || 0,
    });
  }

  return NextResponse.json({
    history: transformedHistory,
    user: {
      id: user.id,
      username: user.username,
      total_tokens: user.total_tokens,
      total_cost: user.total_cost,
      social_links: user.social_links,
    },
  });
}
