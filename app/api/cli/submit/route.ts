import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

interface SubmitPayload {
  username: string;
  totalTokens: number;
  totalSpent: number;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  daysTracked?: number;
  ccplan?: string | null;
  rateLimitTier?: string | null;
  timestamp: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: SubmitPayload = await request.json();

    // Validate required fields
    if (!body.username || typeof body.username !== "string") {
      return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }

    if (typeof body.totalTokens !== "number" || body.totalTokens < 0) {
      return NextResponse.json({ error: "Invalid totalTokens" }, { status: 400 });
    }

    if (typeof body.totalSpent !== "number" || body.totalSpent < 0) {
      return NextResponse.json({ error: "Invalid totalSpent" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Find user by username
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, username, total_tokens, total_cost")
      .eq("username", body.username)
      .maybeSingle();

    if (userError) {
      console.error("[CLI Submit] User lookup error:", userError);
      return NextResponse.json({ error: "Failed to find user" }, { status: 500 });
    }

    if (!user) {
      return NextResponse.json(
        { error: `User "${body.username}" not found. Please sign up at ccgather.com first.` },
        { status: 404 }
      );
    }

    // Update user stats (use max values to prevent lowering)
    const updateData: Record<string, unknown> = {
      total_tokens: Math.max(user.total_tokens || 0, body.totalTokens),
      total_cost: Math.max(user.total_cost || 0, body.totalSpent),
      last_submission_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Update ccplan if provided
    if (body.ccplan) {
      updateData.ccplan = body.ccplan.toLowerCase();
      updateData.ccplan_updated_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from("users")
      .update(updateData)
      .eq("id", user.id);

    if (updateError) {
      console.error("[CLI Submit] Update error:", updateError);
      return NextResponse.json({ error: "Failed to update stats" }, { status: 500 });
    }

    // Insert usage_stats record for today
    const today = new Date().toISOString().split("T")[0];

    await supabase.from("usage_stats").upsert(
      {
        user_id: user.id,
        date: today,
        total_tokens: body.totalTokens,
        input_tokens: body.inputTokens || 0,
        output_tokens: body.outputTokens || 0,
        cache_read_tokens: body.cacheReadTokens || 0,
        cache_write_tokens: body.cacheWriteTokens || 0,
        cost_usd: body.totalSpent,
        primary_model: "claude-sonnet-4",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,date" }
    );

    // Calculate rank
    const { data: rankData } = await supabase
      .from("users")
      .select("id")
      .gt("total_tokens", 0)
      .order("total_tokens", { ascending: false });

    const rank = (rankData?.findIndex((u) => u.id === user.id) ?? -1) + 1;

    // Update global rank
    if (rank > 0) {
      await supabase.from("users").update({ global_rank: rank }).eq("id", user.id);
    }

    return NextResponse.json({
      success: true,
      profileUrl: `https://ccgather.com/u/${user.username}`,
      rank: rank || undefined,
    });
  } catch (error) {
    console.error("[CLI Submit] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
