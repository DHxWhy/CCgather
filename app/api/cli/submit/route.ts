import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

interface SubmitPayload {
  username?: string; // Now optional - use token auth instead
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

interface AuthenticatedUser {
  id: string;
  username: string;
  total_tokens: number | null;
  total_cost: number | null;
}

export async function POST(request: NextRequest) {
  try {
    const body: SubmitPayload = await request.json();

    // Validate required fields
    if (typeof body.totalTokens !== "number" || body.totalTokens < 0) {
      return NextResponse.json({ error: "Invalid totalTokens" }, { status: 400 });
    }

    if (typeof body.totalSpent !== "number" || body.totalSpent < 0) {
      return NextResponse.json({ error: "Invalid totalSpent" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Check for token authentication (required)
    const authHeader = request.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      if (body.username) {
        // Legacy username-based lookup (deprecated, will be removed)
        return NextResponse.json(
          {
            error: "Authentication required. Please run 'ccgather auth' first.",
            hint: "Username-based submission is no longer supported for security reasons.",
          },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: "Authentication required. Please run 'ccgather auth' first." },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);

    // Find user by API token
    const { data: user, error: tokenError } = await supabase
      .from("users")
      .select("id, username, total_tokens, total_cost")
      .eq("api_key", token)
      .maybeSingle();

    if (tokenError) {
      console.error("[CLI Submit] Token lookup error:", tokenError);
      return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
    }

    if (!user) {
      return NextResponse.json(
        { error: "Invalid or expired token. Please run 'ccgather auth' to re-authenticate." },
        { status: 401 }
      );
    }

    const authenticatedUser = user as AuthenticatedUser;

    // Update user stats (use max values to prevent lowering)
    const updateData: Record<string, unknown> = {
      total_tokens: Math.max(authenticatedUser.total_tokens || 0, body.totalTokens),
      total_cost: Math.max(authenticatedUser.total_cost || 0, body.totalSpent),
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
      .eq("id", authenticatedUser.id);

    if (updateError) {
      console.error("[CLI Submit] Update error:", updateError);
      return NextResponse.json({ error: "Failed to update stats" }, { status: 500 });
    }

    // Insert usage_stats record for today
    const today = new Date().toISOString().split("T")[0];

    const { error: statsError } = await supabase.from("usage_stats").upsert(
      {
        user_id: authenticatedUser.id,
        date: today,
        total_tokens: body.totalTokens,
        input_tokens: body.inputTokens || 0,
        output_tokens: body.outputTokens || 0,
        cache_read_tokens: body.cacheReadTokens || 0,
        cache_write_tokens: body.cacheWriteTokens || 0,
        cost_usd: body.totalSpent,
        primary_model: "claude-sonnet-4",
        submitted_at: new Date().toISOString(),
        submission_source: "cli",
      },
      { onConflict: "user_id,date" }
    );

    if (statsError) {
      console.error("[CLI Submit] Usage stats upsert error:", statsError);
      // Continue anyway - user stats were updated successfully
    }

    // Calculate rank
    const { data: rankData } = await supabase
      .from("users")
      .select("id")
      .gt("total_tokens", 0)
      .order("total_tokens", { ascending: false });

    const rank =
      (rankData?.findIndex((u: { id: string }) => u.id === authenticatedUser.id) ?? -1) + 1;

    // Update global rank
    if (rank > 0) {
      await supabase.from("users").update({ global_rank: rank }).eq("id", authenticatedUser.id);
    }

    return NextResponse.json({
      success: true,
      profileUrl: `https://ccgather.com/u/${authenticatedUser.username}`,
      rank: rank || undefined,
    });
  } catch (error) {
    console.error("[CLI Submit] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
