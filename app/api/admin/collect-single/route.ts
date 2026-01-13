import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import { GeminiPipeline } from "@/lib/ai";
import type { TargetCategory } from "@/types/automation";

async function isAdmin() {
  const { userId } = await auth();
  if (!userId) return false;
  if (process.env.NODE_ENV === "development") return true;
  return true;
}

// POST - Collect single URL through AI pipeline
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { url, category = "press" } = body as {
      url: string;
      category?: TargetCategory;
    };

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Check if URL already exists
    const { data: existing } = await supabase
      .from("contents")
      .select("id")
      .eq("source_url", url)
      .single();

    if (existing) {
      return NextResponse.json({ error: "이 URL은 이미 수집되어 있습니다." }, { status: 409 });
    }

    // Initialize Gemini AI pipeline
    const hasApiKey = !!process.env.GOOGLE_GEMINI_API_KEY;

    if (!hasApiKey) {
      return NextResponse.json({ error: "AI API key not configured" }, { status: 500 });
    }

    const pipeline = new GeminiPipeline({
      minFactCheckScore: 70,
      skipFactCheck: false,
    });

    console.log(`[Collect Single] Processing URL: ${url}`);

    // Process URL through AI pipeline
    const result = await pipeline.process(url, category);

    if (!result.success || !result.article) {
      console.error(`[Collect Single] Pipeline failed:`, result.error);
      return NextResponse.json(
        { error: result.error || "Failed to process article" },
        { status: 400 }
      );
    }

    const pipelineResult = result;
    const hasRichContent = pipelineResult.success && pipelineResult.summary;

    // Build insert data
    const insertData: Record<string, unknown> = {
      type: "news",
      content_type: category,
      source_url: result.article.url,
      source_name: result.article.sourceName,
      title: hasRichContent ? pipelineResult.summary!.richContent.title.text : result.article.title,
      thumbnail_url: result.article.thumbnail,
      published_at: result.article.publishedAt,
      status: "pending", // Always pending for manual collection, requires review
      category: category,
    };

    // Add rich content fields if AI processing succeeded
    if (hasRichContent) {
      const rewritten = pipelineResult.rewrittenArticle;

      insertData.summary = pipelineResult.summary!.summaryPlain;
      insertData.summary_md = rewritten?.summary;
      insertData.rich_content = pipelineResult.summary!.richContent;
      insertData.favicon_url = pipelineResult.article?.favicon;
      insertData.difficulty = pipelineResult.summary!.difficulty;
      insertData.original_content = pipelineResult.article?.content;

      // Gemini-specific fields
      if (rewritten) {
        insertData.one_liner = rewritten.oneLiner;
        insertData.body_html = rewritten.bodyHtml;
        insertData.insight_html = rewritten.insightHtml;
        insertData.key_takeaways = rewritten.keyTakeaways;
        insertData.category = rewritten.category;
      }

      // Fact check results
      if (pipelineResult.factVerification) {
        insertData.fact_check_score = pipelineResult.factVerification.score / 100;
        insertData.fact_check_reason =
          pipelineResult.factVerification.issues.join("; ") || "Passed";
      }

      // AI usage metadata
      insertData.ai_model_used = pipelineResult.aiUsage.model;
      insertData.ai_tokens_used =
        pipelineResult.aiUsage.inputTokens + pipelineResult.aiUsage.outputTokens;
      insertData.ai_cost_usd = pipelineResult.aiUsage.costUsd;
      insertData.ai_processed_at = new Date().toISOString();
    }

    // Save to database
    const { data: savedContent, error: insertError } = await supabase
      .from("contents")
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      console.error("[Collect Single] Insert error:", insertError);
      return NextResponse.json({ error: "Failed to save article" }, { status: 500 });
    }

    // Log AI usage
    if (hasRichContent && pipelineResult.aiUsage.costUsd > 0) {
      await supabase.from("ai_usage_log").insert({
        model: pipelineResult.aiUsage.model,
        operation: "single_collect",
        input_tokens: pipelineResult.aiUsage.inputTokens,
        output_tokens: pipelineResult.aiUsage.outputTokens,
        cost_usd: pipelineResult.aiUsage.costUsd,
        metadata: {
          source_url: url,
          content_id: savedContent.id,
          manual: true,
        },
      });
    }

    const duration = Date.now() - startTime;
    console.log(`[Collect Single] Success in ${duration}ms. Content ID: ${savedContent.id}`);

    return NextResponse.json({
      success: true,
      content_id: savedContent.id,
      title: insertData.title,
      duration_ms: duration,
      ai_usage: {
        model: pipelineResult.aiUsage.model,
        tokens: pipelineResult.aiUsage.inputTokens + pipelineResult.aiUsage.outputTokens,
        cost_usd: pipelineResult.aiUsage.costUsd,
      },
    });
  } catch (error) {
    console.error("[Collect Single] Unexpected error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
