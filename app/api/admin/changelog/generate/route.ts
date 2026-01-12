/**
 * Admin Changelog Generation API
 *
 * Triggers the AI pipeline to generate changelog content:
 * POST /api/admin/changelog/generate
 *
 * Body:
 * - sourceUrl: Official changelog URL
 * - options: Pipeline options
 */

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { processChangelog, processAndSaveChangelog } from "@/lib/ai/changelog";

// ============================================
// POST: Generate changelog content
// ============================================

export async function POST(request: Request) {
  try {
    const supabase = createServiceClient();

    // Parse request body
    const body = await request.json();
    const { sourceUrl, options = {} } = body as {
      sourceUrl: string;
      options?: {
        skipVerification?: boolean;
        highlightsOnly?: boolean;
        autoSave?: boolean;
        targetAudience?: "beginner" | "intermediate" | "advanced";
      };
    };

    if (!sourceUrl) {
      return NextResponse.json({ error: "sourceUrl is required" }, { status: 400 });
    }

    // Validate URL
    try {
      new URL(sourceUrl);
    } catch {
      return NextResponse.json({ error: "Invalid sourceUrl" }, { status: 400 });
    }

    console.log(`[Generate] Starting pipeline for: ${sourceUrl}`);
    console.log(`[Generate] Options:`, options);

    // Run pipeline
    const result = options.autoSave
      ? await processAndSaveChangelog(sourceUrl, options)
      : await processChangelog(sourceUrl, options);

    // Log the generation attempt
    await supabase.from("content_generation_logs").insert({
      content_type: "changelog_generation",
      content_id: result.version?.version || "unknown",
      stage: "api_trigger",
      model_used: "pipeline",
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: result.totalCost,
      result_status: result.success ? "success" : "error",
      error_message: result.error,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error || "Pipeline failed",
          partialResult: {
            version: result.version,
            itemCount: result.items.length,
            totalCost: result.totalCost,
          },
        },
        { status: 500 }
      );
    }

    // Prepare response
    const response = {
      success: true,
      version: result.version,
      summary: {
        totalItems: result.items.length,
        byStatus: {
          auto: result.items.filter((i) => i.verification.status === "auto").length,
          confirm: result.items.filter((i) => i.verification.status === "confirm").length,
          revision: result.items.filter((i) => i.verification.status === "revision").length,
          manual: result.items.filter((i) => i.verification.status === "manual").length,
        },
        totalCost: result.totalCost,
        saved: options.autoSave || false,
      },
      items: result.items.map((item) => ({
        title: item.content.title,
        slug: item.content.slug,
        category: item.content.category,
        isHighlight: item.content.isHighlight,
        hasForBeginners: !!item.content.forBeginners,
        verification: {
          confidence: item.verification.confidence,
          status: item.verification.status,
        },
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Generate] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// ============================================
// GET: Check pipeline status (for polling)
// ============================================

export async function GET(request: Request) {
  try {
    const supabase = createServiceClient();

    // Get recent generation logs
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10");

    const { data: logs, error } = await supabase
      .from("content_generation_logs")
      .select("*")
      .eq("content_type", "changelog_generation")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Calculate stats
    const stats = {
      totalGenerations: logs?.length || 0,
      successRate:
        logs && logs.length > 0
          ? (logs.filter((l) => l.result_status === "success").length / logs.length) * 100
          : 0,
      totalCost: logs?.reduce((sum, l) => sum + (l.cost_usd || 0), 0) || 0,
    };

    return NextResponse.json({
      logs,
      stats,
    });
  } catch (error) {
    console.error("[Generate] GET Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
