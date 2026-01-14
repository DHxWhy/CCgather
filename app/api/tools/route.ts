import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { auth } from "@clerk/nextjs/server";
import type {
  GetToolsParams,
  GetToolsResponse,
  SubmitToolRequest,
  SubmitToolResponse,
  ToolCategory,
  ToolPeriod,
  ToolSortOption,
  ToolWithVoters,
} from "@/types/tools";
import {
  calculateTrustTier,
  checkSuggestionEligibility,
  buildSuggesterInfo,
} from "@/lib/tools/eligibility";

// =====================================================
// GET /api/tools - 도구 목록 조회
// =====================================================
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const params: GetToolsParams = {
      category: (searchParams.get("category") as ToolCategory | "all") || "all",
      period: (searchParams.get("period") as ToolPeriod) || "all",
      sort: (searchParams.get("sort") as ToolSortOption) || "weighted",
      limit: Math.min(parseInt(searchParams.get("limit") || "20"), 50),
      offset: parseInt(searchParams.get("offset") || "0"),
    };

    // Base query - only approved/featured tools
    let query = supabase
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
      `,
        { count: "exact" }
      )
      .in("status", ["approved", "featured"]);

    // Category filter
    if (params.category && params.category !== "all") {
      query = query.eq("category", params.category);
    }

    // Period filter
    if (params.period && params.period !== "all") {
      const now = new Date();
      let startDate: Date;

      if (params.period === "week") {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else {
        // month
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      query = query.gte("approved_at", startDate.toISOString());
    }

    // Sorting
    switch (params.sort) {
      case "votes":
        query = query.order("upvote_count", { ascending: false });
        break;
      case "weighted":
        query = query.order("weighted_score", { ascending: false });
        break;
      case "newest":
        query = query.order("approved_at", { ascending: false });
        break;
      default:
        query = query.order("weighted_score", { ascending: false });
    }

    // Secondary sort by created_at for consistency
    query = query.order("created_at", { ascending: false });

    // Pagination
    query = query.range(params.offset!, params.offset! + params.limit! - 1);

    const { data: tools, error, count } = await query;

    if (error) {
      console.error("Error fetching tools:", error);
      return NextResponse.json({ error: "Failed to fetch tools" }, { status: 500 });
    }

    // Get top voters for each tool (max 5, sorted by trust tier)
    const toolIds = tools?.map((t: { id: string }) => t.id) || [];

    const { data: votes } = await supabase
      .from("tool_votes")
      .select(
        `
        tool_id,
        user_id,
        weight,
        comment,
        user:users!user_id (
          id,
          username,
          avatar_url,
          current_level,
          global_rank
        )
      `
      )
      .in("tool_id", toolIds)
      .order("weight", { ascending: false })
      .order("created_at", { ascending: true });

    // Group votes by tool and calculate trust tier
    const votesByTool = new Map<string, ToolWithVoters["voters"]>();
    const topCommentByTool = new Map<string, ToolWithVoters["top_comment"]>();

    type VoteRecord = {
      tool_id: string;
      user_id: string;
      weight: number;
      comment: string | null;
      user: unknown;
    };

    votes?.forEach((vote: VoteRecord) => {
      const toolId = vote.tool_id;
      if (!votesByTool.has(toolId)) {
        votesByTool.set(toolId, []);
      }

      const user = vote.user as {
        id: string;
        username: string;
        avatar_url: string | null;
        current_level: number;
        global_rank: number | null;
      };

      // Calculate trust tier
      const trustTier = calculateTrustTier(user.current_level);

      const voters = votesByTool.get(toolId)!;
      if (voters.length < 5) {
        voters.push({
          user_id: user.id,
          username: user.username,
          avatar_url: user.avatar_url,
          trust_tier: trustTier,
          weight: vote.weight,
          comment: vote.comment,
        });
      }

      // Find top comment (from highest trust tier user)
      if (vote.comment && !topCommentByTool.has(toolId)) {
        topCommentByTool.set(toolId, {
          username: user.username,
          avatar_url: user.avatar_url,
          trust_tier: trustTier,
          comment: vote.comment,
        });
      }
    });

    // Combine tools with voters and suggester info
    const toolsWithVoters: ToolWithVoters[] =
      tools?.map((tool: Record<string, unknown>) => {
        const submitter = tool.submitter as {
          id: string;
          username: string;
          avatar_url: string | null;
          current_level: number;
          global_rank: number | null;
        } | null;

        const toolId = tool.id as string;

        // Build suggester info from submitter
        const suggester = submitter
          ? buildSuggesterInfo({
              id: submitter.id,
              username: submitter.username,
              avatar_url: submitter.avatar_url,
              current_level: submitter.current_level,
            })
          : null;

        return {
          ...tool,
          suggester,
          voters: votesByTool.get(toolId) || [],
          top_comment: topCommentByTool.get(toolId) || null,
        };
      }) || [];

    const response: GetToolsResponse = {
      tools: toolsWithVoters,
      total: count || 0,
      hasMore: (params.offset || 0) + (params.limit || 20) < (count || 0),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error in GET /api/tools:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// =====================================================
// POST /api/tools - 도구 제출
// =====================================================
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceClient();

    // Get user from database
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, username, avatar_url, current_level, global_rank")
      .eq("clerk_id", userId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Count unique data days
    const { count: uniqueDataDays } = await supabase
      .from("usage_stats")
      .select("date", { count: "exact", head: true })
      .eq("user_id", user.id);

    // Check suggestion eligibility (Level 7+ OR 7+ unique data days)
    const eligibility = checkSuggestionEligibility({
      current_level: user.current_level,
      unique_data_days: uniqueDataDays ?? 0,
    });

    if (!eligibility.eligible) {
      return NextResponse.json(
        {
          error: "Not eligible to suggest tools",
          message: eligibility.message,
          requirements: eligibility.requirements,
        },
        { status: 403 }
      );
    }

    // Parse request body
    const body: SubmitToolRequest = await request.json();

    // Validation
    if (!body.name || body.name.trim().length === 0) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (!body.website_url || !isValidUrl(body.website_url)) {
      return NextResponse.json({ error: "Valid website URL is required" }, { status: 400 });
    }

    if (!body.tagline || body.tagline.trim().length === 0) {
      return NextResponse.json({ error: "Tagline is required" }, { status: 400 });
    }

    if (body.tagline.length > 100) {
      return NextResponse.json(
        { error: "Tagline must be 100 characters or less" },
        { status: 400 }
      );
    }

    if (!body.category) {
      return NextResponse.json({ error: "Category is required" }, { status: 400 });
    }

    // Check for duplicate URL
    const { data: existing } = await supabase
      .from("tools")
      .select("id, name")
      .eq("website_url", body.website_url)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: `A tool with this URL already exists: ${existing.name}` },
        { status: 409 }
      );
    }

    // Insert tool
    const { data: tool, error: insertError } = await supabase
      .from("tools")
      .insert({
        name: body.name.trim(),
        tagline: body.tagline.trim(),
        description: body.description?.trim() || null,
        website_url: body.website_url.trim(),
        category: body.category,
        pricing_type: body.pricing_type || "free",
        logo_url: body.logo_url?.trim() || null,
        tags: body.tags || [],
        submitted_by: user.id,
        source: "user",
        status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting tool:", insertError);
      return NextResponse.json({ error: "Failed to submit tool" }, { status: 500 });
    }

    const response: SubmitToolResponse = {
      success: true,
      tool,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/tools:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// =====================================================
// Helper Functions
// =====================================================

function isValidUrl(string: string): boolean {
  try {
    const url = new URL(string);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
