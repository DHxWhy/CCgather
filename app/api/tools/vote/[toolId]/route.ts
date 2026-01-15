import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { calculateTrustTier, calculateVoteWeight } from "@/lib/tools/eligibility";

// =====================================================
// POST /api/tools/vote/[toolId] - Toggle vote on a tool
// =====================================================
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ toolId: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { toolId } = await params;
    const supabase = createServiceClient();

    // Get the current user from database
    const { data: dbUser, error: userError } = await supabase
      .from("users")
      .select("id, current_level, global_rank")
      .eq("clerk_id", userId)
      .single();

    if (userError || !dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get the tool
    const { data: tool, error: toolError } = await supabase
      .from("tools")
      .select("id, upvote_count, weighted_score")
      .eq("id", toolId)
      .single();

    if (toolError || !tool) {
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });
    }

    // Check if user already voted
    const { data: existingVote } = await supabase
      .from("tool_votes")
      .select("tool_id, weight")
      .eq("tool_id", toolId)
      .eq("user_id", dbUser.id)
      .single();

    // Calculate user's vote weight based on trust tier
    const trustTier = calculateTrustTier(dbUser.current_level, dbUser.global_rank);
    const voteWeight = calculateVoteWeight(trustTier);

    if (existingVote) {
      // Remove vote
      const { error: deleteError } = await supabase
        .from("tool_votes")
        .delete()
        .eq("tool_id", toolId)
        .eq("user_id", dbUser.id);

      if (deleteError) {
        console.error("Error deleting vote:", deleteError);
        return NextResponse.json({ error: "Failed to remove vote" }, { status: 500 });
      }

      // Update tool counts
      const newUpvoteCount = Math.max(0, (tool.upvote_count || 0) - 1);
      const newWeightedScore = Math.max(0, (tool.weighted_score || 0) - (existingVote.weight || 1));

      await supabase
        .from("tools")
        .update({
          upvote_count: newUpvoteCount,
          weighted_score: newWeightedScore,
        })
        .eq("id", toolId);

      return NextResponse.json({
        voted: false,
        new_count: newUpvoteCount,
        new_weighted_score: newWeightedScore,
      });
    } else {
      // Add vote
      const { error: insertError } = await supabase.from("tool_votes").insert({
        tool_id: toolId,
        user_id: dbUser.id,
        weight: voteWeight,
      });

      if (insertError) {
        console.error("Error inserting vote:", insertError);
        return NextResponse.json({ error: "Failed to add vote" }, { status: 500 });
      }

      // Update tool counts
      const newUpvoteCount = (tool.upvote_count || 0) + 1;
      const newWeightedScore = (tool.weighted_score || 0) + voteWeight;

      await supabase
        .from("tools")
        .update({
          upvote_count: newUpvoteCount,
          weighted_score: newWeightedScore,
        })
        .eq("id", toolId);

      return NextResponse.json({
        voted: true,
        new_count: newUpvoteCount,
        new_weighted_score: newWeightedScore,
      });
    }
  } catch (error) {
    console.error("Error in POST /api/tools/vote/[toolId]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
