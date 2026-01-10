import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { checkAndAwardBadges } from "@/lib/services/badgeService";

interface DailyUsage {
  date: string;
  tokens: number;
  cost: number;
  inputTokens?: number;
  outputTokens?: number;
  sessions?: number;
}

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
  dailyUsage?: DailyUsage[]; // NEW: Array of daily usage data
}

interface AuthenticatedUser {
  id: string;
  username: string;
  total_tokens: number | null;
  total_cost: number | null;
  country_code?: string;
  last_submission_at?: string | null;
}

// Rate limit settings: 10 submissions per hour
const RATE_LIMIT_WINDOW_HOURS = 1;
const RATE_LIMIT_MAX_SUBMISSIONS = 10;

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
      .select("id, username, total_tokens, total_cost, country_code, last_submission_at")
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

    // Rate limit check: count submissions in the last hour
    const oneHourAgo = new Date(
      Date.now() - RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000
    ).toISOString();

    const { count: recentSubmissions } = await supabase
      .from("usage_stats")
      .select("*", { count: "exact", head: true })
      .eq("user_id", authenticatedUser.id)
      .gte("submitted_at", oneHourAgo);

    if ((recentSubmissions ?? 0) >= RATE_LIMIT_MAX_SUBMISSIONS) {
      // Calculate when they can submit again
      const { data: oldestRecentSubmission } = await supabase
        .from("usage_stats")
        .select("submitted_at")
        .eq("user_id", authenticatedUser.id)
        .gte("submitted_at", oneHourAgo)
        .order("submitted_at", { ascending: true })
        .limit(1)
        .single();

      let retryAfterMinutes = 60; // Default 60 minutes
      if (oldestRecentSubmission?.submitted_at) {
        const oldestTime = new Date(oldestRecentSubmission.submitted_at).getTime();
        const windowEndTime = oldestTime + RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000;
        retryAfterMinutes = Math.ceil((windowEndTime - Date.now()) / (60 * 1000));
      }

      return NextResponse.json(
        {
          error: `Rate limit exceeded. Maximum ${RATE_LIMIT_MAX_SUBMISSIONS} submissions per hour.`,
          retryAfterMinutes: Math.max(1, retryAfterMinutes),
          hint: `Please try again in ${retryAfterMinutes} minute${retryAfterMinutes !== 1 ? "s" : ""}.`,
        },
        { status: 429 }
      );
    }

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

    // Insert usage_stats records
    if (body.dailyUsage && body.dailyUsage.length > 0) {
      // Bulk insert daily usage data
      const usageRecords = body.dailyUsage.map((day) => ({
        user_id: authenticatedUser.id,
        date: day.date,
        total_tokens: day.tokens,
        input_tokens: day.inputTokens || 0,
        output_tokens: day.outputTokens || 0,
        cache_read_tokens: 0,
        cache_write_tokens: 0,
        cost_usd: day.cost,
        primary_model: "claude-sonnet-4",
        submitted_at: new Date().toISOString(),
        submission_source: "cli",
      }));

      const { error: statsError } = await supabase
        .from("usage_stats")
        .upsert(usageRecords, { onConflict: "user_id,date" });

      if (statsError) {
        console.error("[CLI Submit] Bulk usage stats upsert error:", statsError);
      } else {
        console.log(
          `[CLI Submit] Inserted ${usageRecords.length} daily usage records for user ${authenticatedUser.username}`
        );
      }
    } else {
      // Fallback: Insert only today's record (legacy behavior)
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
      }
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

    // Get country rank for badge calculation
    let countryRank: number | undefined;
    if (authenticatedUser.country_code) {
      const { data: countryRankData } = await supabase
        .from("users")
        .select("id")
        .eq("country_code", authenticatedUser.country_code)
        .gt("total_tokens", 0)
        .order("total_tokens", { ascending: false });

      const foundRank =
        (countryRankData?.findIndex((u: { id: string }) => u.id === authenticatedUser.id) ?? -1) +
        1;

      if (foundRank > 0) {
        countryRank = foundRank;
        await supabase
          .from("users")
          .update({ country_rank: countryRank })
          .eq("id", authenticatedUser.id);
      }
    }

    // Check and award badges
    const usageHistory = body.dailyUsage?.map((d) => ({ date: d.date, tokens: d.tokens })) || [];
    const { newBadges, allBadges } = await checkAndAwardBadges(
      authenticatedUser.id,
      {
        id: authenticatedUser.id,
        total_tokens: Math.max(authenticatedUser.total_tokens || 0, body.totalTokens),
        total_cost: Math.max(authenticatedUser.total_cost || 0, body.totalSpent),
        global_rank: rank || 9999,
        country_rank: countryRank,
        country_code: authenticatedUser.country_code,
      },
      usageHistory
    );

    return NextResponse.json({
      success: true,
      profileUrl: `https://ccgather.com/u/${authenticatedUser.username}`,
      rank: rank || undefined,
      countryRank: countryRank || undefined,
      // Badge information
      newBadges: newBadges.map((b) => ({
        id: b.id,
        name: b.name,
        icon: b.icon,
        description: b.description,
        praise: b.praise,
        rarity: b.rarity,
        category: b.category,
        earnedAt: new Date().toISOString(),
      })),
      totalBadges: allBadges.length,
    });
  } catch (error) {
    console.error("[CLI Submit] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
