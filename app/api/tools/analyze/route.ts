import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getToolCrawler } from "@/lib/tools/tool-crawler";
import { checkSuggestionEligibility } from "@/lib/tools/eligibility";

// =====================================================
// POST /api/tools/analyze - URL 분석하여 도구 정보 추출
// =====================================================
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceClient();

    // Get user and check eligibility
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, current_level")
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

    // Verify eligibility (Level 7+ OR 7+ unique data days)
    const eligibility = checkSuggestionEligibility({
      current_level: user.current_level,
      unique_data_days: uniqueDataDays ?? 0,
    });

    if (!eligibility.eligible) {
      return NextResponse.json(
        {
          error: "Not eligible to suggest tools",
          message: eligibility.message,
        },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Validate URL format
    try {
      const parsedUrl = new URL(url);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return NextResponse.json({ error: "URL must use http or https protocol" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
    }

    // Check if URL already exists
    const { data: existing } = await supabase
      .from("tools")
      .select("id, name, slug, status")
      .eq("website_url", url)
      .single();

    if (existing) {
      return NextResponse.json(
        {
          error: "duplicate",
          message: `This tool already exists: ${existing.name}`,
          existing: {
            id: existing.id,
            name: existing.name,
            slug: existing.slug,
            status: existing.status,
          },
        },
        { status: 409 }
      );
    }

    // Use crawler to analyze the URL
    const crawler = getToolCrawler({ debug: false });
    const analyzedTool = await crawler.crawlSingleTool(url);

    if (!analyzedTool) {
      return NextResponse.json(
        {
          error: "analysis_failed",
          message: "Unable to analyze the URL. Please fill in the details manually.",
          // Return empty form data
          tool: {
            name: "",
            website_url: url,
            tagline: "",
            description: "",
            category: "productivity",
            pricing_type: "freemium",
            logo_url: null,
            tags: [],
          },
        },
        { status: 200 } // Still return 200 so frontend can show manual form
      );
    }

    return NextResponse.json({
      success: true,
      tool: {
        name: analyzedTool.name,
        website_url: analyzedTool.website_url,
        tagline: analyzedTool.tagline,
        description: analyzedTool.description || "",
        category: analyzedTool.category,
        pricing_type: analyzedTool.pricing_type,
        logo_url: analyzedTool.logo_url || null,
        tags: analyzedTool.tags,
      },
    });
  } catch (error) {
    console.error("Error analyzing URL:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
