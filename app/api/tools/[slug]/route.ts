import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { auth } from "@clerk/nextjs/server";
import type { ToolWithInteraction } from "@/types/tools";

// =====================================================
// GET /api/tools/[slug] - 도구 상세 조회
// =====================================================
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const supabase = createServiceClient();
    const { userId } = await auth();

    // Fetch tool by slug
    const { data: tool, error: toolError } = await supabase
      .from("tools")
      .select(
        `
        *,
        submitter:users!submitted_by (
          id,
          username,
          avatar_url,
          current_level,
          global_rank
        )
      `
      )
      .eq("slug", slug)
      .in("status", ["approved", "featured"])
      .single();

    if (toolError || !tool) {
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });
    }

    // Get all voters
    const { data: votes } = await supabase
      .from("tool_votes")
      .select(
        `
        user_id,
        weight,
        comment,
        created_at,
        user:users!user_id (
          id,
          username,
          avatar_url,
          current_level,
          global_rank
        )
      `
      )
      .eq("tool_id", tool.id)
      .order("weight", { ascending: false })
      .order("created_at", { ascending: true });

    // Calculate trust tier for submitter
    const submitter = tool.submitter as {
      id: string;
      username: string;
      avatar_url: string | null;
      current_level: number;
      global_rank: number | null;
    } | null;

    // Process voters
    const voters =
      votes?.map((vote) => {
        const user = vote.user as {
          id: string;
          username: string;
          avatar_url: string | null;
          current_level: number;
          global_rank: number | null;
        };

        return {
          user_id: user.id,
          username: user.username,
          avatar_url: user.avatar_url,
          trust_tier: calculateTrustTier(user.current_level, user.global_rank),
          weight: vote.weight,
          comment: vote.comment,
        };
      }) || [];

    // Find top comment (from highest trust tier user)
    const topComment = voters.find((v) => v.comment)
      ? {
          username: voters.find((v) => v.comment)!.username,
          avatar_url: voters.find((v) => v.comment)!.avatar_url,
          trust_tier: voters.find((v) => v.comment)!.trust_tier,
          comment: voters.find((v) => v.comment)!.comment!,
        }
      : null;

    // Check user's interaction status
    let isVoted = false;
    let isBookmarked = false;

    if (userId) {
      const { data: dbUser } = await supabase
        .from("users")
        .select("id")
        .eq("clerk_id", userId)
        .single();

      if (dbUser) {
        // Check vote
        const { data: vote } = await supabase
          .from("tool_votes")
          .select("tool_id")
          .eq("tool_id", tool.id)
          .eq("user_id", dbUser.id)
          .single();

        isVoted = !!vote;

        // Check bookmark
        const { data: bookmark } = await supabase
          .from("tool_bookmarks")
          .select("tool_id")
          .eq("tool_id", tool.id)
          .eq("user_id", dbUser.id)
          .single();

        isBookmarked = !!bookmark;
      }
    }

    const response: ToolWithInteraction = {
      ...tool,
      submitter: submitter
        ? {
            ...submitter,
            trust_tier: calculateTrustTier(submitter.current_level, submitter.global_rank),
          }
        : null,
      voters: voters.slice(0, 10), // Limit to 10 voters for detail page
      top_comment: topComment,
      is_voted: isVoted,
      is_bookmarked: isBookmarked,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error in GET /api/tools/[slug]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// =====================================================
// Helper Functions
// =====================================================

function calculateTrustTier(
  level: number,
  globalRank: number | null
): "elite" | "power_user" | "verified" | "member" {
  if (level >= 4 || (globalRank !== null && globalRank <= 100)) {
    return "elite";
  }
  if (level >= 3 || (globalRank !== null && globalRank <= 500)) {
    return "power_user";
  }
  if (level >= 2) {
    return "verified";
  }
  return "member";
}
