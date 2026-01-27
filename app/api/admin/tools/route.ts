import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { auth } from "@clerk/nextjs/server";
import type {
  AdminToolListItem,
  AdminToolStats,
  ToolCategory,
  ToolStatus,
} from "@/lib/types/tools";
import { calculateTrustTier } from "@/lib/tools/eligibility";

// =====================================================
// GET /api/admin/tools - 관리자 도구 목록
// =====================================================
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceClient();

    // Check if user is admin
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, is_admin")
      .eq("clerk_id", userId)
      .single();

    if (userError || !user || !user.is_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as ToolStatus | "all" | null;
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build query
    let query = supabase.from("tools").select(
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
    );

    // Status filter
    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    // Order: pending first (by submitter trust), then by created_at
    query = query
      .order("status", { ascending: true }) // pending comes first alphabetically
      .order("created_at", { ascending: false });

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data: tools, error, count } = await query;

    if (error) {
      console.error("Error fetching admin tools:", error);
      return NextResponse.json({ error: "Failed to fetch tools" }, { status: 500 });
    }

    // Calculate priority for each tool based on submitter trust
    const toolsWithPriority: AdminToolListItem[] =
      tools?.map((tool: Record<string, unknown>) => {
        const submitter = tool.submitter as {
          id: string;
          username: string;
          avatar_url: string | null;
          current_level: number;
          global_rank: number | null;
        } | null;

        const trustTier = submitter
          ? calculateTrustTier(submitter.current_level, submitter.global_rank)
          : "member";

        const priority =
          trustTier === "elite" || trustTier === "power_user"
            ? "high"
            : trustTier === "verified"
              ? "medium"
              : "low";

        return {
          ...tool,
          submitter: submitter
            ? {
                ...submitter,
                trust_tier: trustTier,
              }
            : null,
          priority,
        };
      }) || [];

    // Sort pending tools by priority
    toolsWithPriority.sort((a, b) => {
      if (a.status === "pending" && b.status === "pending") {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return 0;
    });

    // Get stats
    const { data: statsData } = await supabase.from("tools").select("status, category, source");

    type ToolStat = { status: string; category: string; source: string };
    const stats: AdminToolStats = {
      total: statsData?.length || 0,
      pending: statsData?.filter((t: ToolStat) => t.status === "pending").length || 0,
      approved: statsData?.filter((t: ToolStat) => t.status === "approved").length || 0,
      featured: statsData?.filter((t: ToolStat) => t.status === "featured").length || 0,
      rejected: statsData?.filter((t: ToolStat) => t.status === "rejected").length || 0,
      by_category: {} as Record<ToolCategory, number>,
      by_source: { user: 0, admin: 0, automation: 0 },
    };

    // Count by category
    const categories: ToolCategory[] = [
      "ai-coding",
      "devops",
      "productivity",
      "design",
      "api-data",
      "open-source",
      "learning",
    ];
    categories.forEach((cat) => {
      stats.by_category[cat] = statsData?.filter((t: ToolStat) => t.category === cat).length || 0;
    });

    // Count by source
    statsData?.forEach((t: ToolStat) => {
      if (t.source === "user") stats.by_source.user++;
      else if (t.source === "admin") stats.by_source.admin++;
      else if (t.source === "automation") stats.by_source.automation++;
    });

    return NextResponse.json({
      tools: toolsWithPriority,
      total: count || 0,
      hasMore: offset + limit < (count || 0),
      stats,
    });
  } catch (error) {
    console.error("Error in GET /api/admin/tools:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// =====================================================
// POST /api/admin/tools - 관리자 직접 추가
// =====================================================
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceClient();

    // Check if user is admin
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, is_admin")
      .eq("clerk_id", userId)
      .single();

    if (userError || !user || !user.is_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();

    // Validation
    if (!body.name || !body.website_url || !body.tagline || !body.category) {
      return NextResponse.json(
        { error: "Name, website URL, tagline, and category are required" },
        { status: 400 }
      );
    }

    // Check for duplicate URL
    const { data: existing } = await supabase
      .from("tools")
      .select("id")
      .eq("website_url", body.website_url)
      .single();

    if (existing) {
      return NextResponse.json({ error: "A tool with this URL already exists" }, { status: 409 });
    }

    // Insert tool (directly approved)
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
        source: "admin",
        status: body.status || "approved",
        approved_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting tool:", insertError);
      return NextResponse.json({ error: "Failed to add tool" }, { status: 500 });
    }

    return NextResponse.json({ success: true, tool }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/admin/tools:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
