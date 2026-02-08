import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { checkSuggestionEligibility, getEligibilityRequirements } from "@/lib/tools/eligibility";

// =====================================================
// GET /api/tools/eligibility - 도구 제안 자격 확인
// =====================================================
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceClient();

    // Get user data
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, username, avatar_url, current_level")
      .eq("clerk_id", userId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Count unique data days (distinct dates, not rows — multi-device safe)
    const { data: uniqueDaysData } = await supabase
      .from("usage_stats")
      .select("date")
      .eq("user_id", user.id);
    const uniqueDataDays = uniqueDaysData
      ? new Set(uniqueDaysData.map((r: { date: string }) => r.date)).size
      : 0;

    // Check eligibility with both paths
    const eligibility = checkSuggestionEligibility({
      current_level: user.current_level,
      unique_data_days: uniqueDataDays ?? 0,
    });

    // Get all requirements for UI display
    const allRequirements = getEligibilityRequirements();

    return NextResponse.json({
      eligible: eligibility.eligible,
      eligible_path: eligibility.eligible_path,
      trust_tier: eligibility.trust_tier,
      vote_weight: eligibility.vote_weight,
      message: eligibility.message,
      requirements: eligibility.requirements,
      allRequirements,
      user: {
        username: user.username,
        avatar_url: user.avatar_url,
        current_level: user.current_level,
        unique_data_days: uniqueDataDays ?? 0,
      },
    });
  } catch (error) {
    console.error("Error checking eligibility:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
