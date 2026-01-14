import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { getToolCrawler, type ExtractedTool, type CrawlResult } from "@/lib/tools/tool-crawler";

// =====================================================
// POST /api/admin/tools/crawl - 도구 크롤링
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
    const { url, mode = "listing" } = body;

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
    }

    const crawler = getToolCrawler({ debug: true });
    let result: CrawlResult;
    let extractedTools: ExtractedTool[] = [];

    if (mode === "single") {
      // Single tool mode: directly crawl one tool's website
      const tool = await crawler.crawlSingleTool(url);
      if (tool) {
        extractedTools = [tool];
        result = {
          success: true,
          tools: extractedTools,
          errors: [],
          stats: {
            totalFound: 1,
            successfullyParsed: 1,
            failed: 0,
            tokensUsed: 0,
            costUsd: 0,
          },
        };
      } else {
        result = {
          success: false,
          tools: [],
          errors: ["Failed to extract tool information from the page"],
          stats: {
            totalFound: 1,
            successfullyParsed: 0,
            failed: 1,
            tokensUsed: 0,
            costUsd: 0,
          },
        };
      }
    } else {
      // Listing mode: crawl a page with multiple tools
      result = await crawler.crawlToolsPage(url);
      extractedTools = result.tools;
    }

    if (!result.success && extractedTools.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: result.errors.join(", ") || "Failed to extract tools",
          stats: result.stats,
        },
        { status: 422 }
      );
    }

    // Save extracted tools to database as pending
    const savedTools = [];
    const duplicates = [];
    const errors = [];

    for (const tool of extractedTools) {
      try {
        // Check for duplicate URL
        const { data: existing } = await supabase
          .from("tools")
          .select("id, name")
          .eq("website_url", tool.website_url)
          .single();

        if (existing) {
          duplicates.push({ name: tool.name, existing: existing.name });
          continue;
        }

        // Insert as pending with source = automation
        const { data: insertedTool, error: insertError } = await supabase
          .from("tools")
          .insert({
            name: tool.name,
            tagline: tool.tagline,
            description: tool.description || null,
            website_url: tool.website_url,
            category: tool.category,
            pricing_type: tool.pricing_type,
            logo_url: tool.logo_url || null,
            tags: tool.tags,
            submitted_by: user.id,
            source: "automation",
            status: "pending",
          })
          .select()
          .single();

        if (insertError) {
          errors.push({ name: tool.name, error: insertError.message });
        } else {
          savedTools.push(insertedTool);
        }
      } catch (err) {
        errors.push({
          name: tool.name,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      success: true,
      saved: savedTools.length,
      duplicates: duplicates.length,
      failed: errors.length,
      tools: savedTools,
      duplicateDetails: duplicates,
      errors: errors,
      crawlStats: result.stats,
    });
  } catch (error) {
    console.error("Error in POST /api/admin/tools/crawl:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
