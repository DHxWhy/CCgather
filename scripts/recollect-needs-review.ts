/**
 * Re-collect and fix articles that need review
 * This script re-processes articles through the Gemini pipeline and updates them in-place
 * Run with: npx tsx scripts/recollect-needs-review.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { GeminiPipeline } from "../lib/ai";
import { performHardCheck } from "../lib/ai/fact-hard-check";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface ArticleToFix {
  id: string;
  title: string;
  source_url: string;
  category: string;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function recollectArticle(article: ArticleToFix): Promise<{
  success: boolean;
  passed: boolean;
  score: number;
  error?: string;
  issues?: string[];
}> {
  console.log(`\n📰 Processing: ${article.title}`);
  console.log(`   URL: ${article.source_url}`);

  try {
    // Initialize pipeline with strict fact checking
    const pipeline = new GeminiPipeline({
      minFactCheckScore: 85,
      maxRetries: 2,
      skipFactCheck: false,
    });

    // Re-process through pipeline
    const result = await pipeline.process(article.source_url, article.category as any);

    if (!result.success || !result.article) {
      return {
        success: false,
        passed: false,
        score: 0,
        error: result.error || "Pipeline failed",
      };
    }

    const rewritten = result.rewrittenArticle;
    if (!rewritten) {
      return {
        success: false,
        passed: false,
        score: 0,
        error: "No rewritten content",
      };
    }

    // Run hard check on new content
    const rewrittenContent = `${rewritten.title.text} ${rewritten.oneLiner} ${rewritten.summary} ${rewritten.bodyHtml} ${rewritten.insightHtml}`;
    const hardCheckResult = performHardCheck(result.article.content, rewrittenContent);

    console.log(
      `   Hard check: ${hardCheckResult.passed ? "✅ PASSED" : "❌ FAILED"} (score: ${hardCheckResult.score})`
    );

    if (!hardCheckResult.passed) {
      console.log(`   Issues: ${hardCheckResult.criticalIssues.join(", ")}`);
      return {
        success: true,
        passed: false,
        score: hardCheckResult.score,
        issues: hardCheckResult.criticalIssues,
      };
    }

    // Hard check passed - update the article
    const updateData: Record<string, unknown> = {
      title: rewritten.title.text,
      one_liner: rewritten.oneLiner,
      summary_md: rewritten.summary,
      body_html: rewritten.bodyHtml,
      insight_html: rewritten.insightHtml,
      key_takeaways: rewritten.keyTakeaways,
      difficulty: rewritten.difficulty,
      original_content: result.article.content,
      status: "published", // Update to published
      fact_check_score: (result.factVerification?.score || 100) / 100,
      fact_check_reason: "Re-processed and passed hard check verification",
      ai_processed_at: new Date().toISOString(),
    };

    // Update rich_content
    if (result.summary?.richContent) {
      updateData.rich_content = {
        ...result.summary.richContent,
        title: rewritten.title,
      };
    }

    // Update in database
    const { error: updateError } = await supabase
      .from("contents")
      .update(updateData)
      .eq("id", article.id);

    if (updateError) {
      console.error(`   Update error: ${updateError.message}`);
      return {
        success: false,
        passed: false,
        score: hardCheckResult.score,
        error: updateError.message,
      };
    }

    console.log(`   ✅ Updated and published!`);

    return {
      success: true,
      passed: true,
      score: hardCheckResult.score,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`   Error: ${errorMsg}`);
    return {
      success: false,
      passed: false,
      score: 0,
      error: errorMsg,
    };
  }
}

async function main() {
  console.log("=== Re-collecting Needs Review Articles ===\n");

  // Fetch all needs_review articles
  const { data: articles, error } = await supabase
    .from("contents")
    .select("id, title, source_url, category")
    .eq("status", "needs_review")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching articles:", error);
    process.exit(1);
  }

  if (!articles || articles.length === 0) {
    console.log("No articles need review.");
    return;
  }

  console.log(`Found ${articles.length} articles to re-collect.\n`);

  const results = {
    total: articles.length,
    success: 0,
    failed: 0,
    stillFailing: 0,
  };

  const failedArticles: { id: string; title: string; reason: string }[] = [];

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i] as ArticleToFix;
    console.log(`\n[${i + 1}/${articles.length}]`);

    const result = await recollectArticle(article);

    if (result.success && result.passed) {
      results.success++;
    } else if (result.success && !result.passed) {
      results.stillFailing++;
      failedArticles.push({
        id: article.id,
        title: article.title,
        reason: result.issues?.join("; ") || "Hard check failed",
      });
    } else {
      results.failed++;
      failedArticles.push({
        id: article.id,
        title: article.title,
        reason: result.error || "Unknown error",
      });
    }

    // Rate limiting - wait 2 seconds between articles to avoid API limits
    if (i < articles.length - 1) {
      console.log("   Waiting 2s before next article...");
      await sleep(2000);
    }
  }

  console.log("\n\n=== Final Results ===\n");
  console.log(`Total processed: ${results.total}`);
  console.log(`✅ Successfully fixed: ${results.success}`);
  console.log(`⚠️ Still failing hard check: ${results.stillFailing}`);
  console.log(`❌ Processing errors: ${results.failed}`);

  if (failedArticles.length > 0) {
    console.log("\n=== Articles Still Needing Manual Review ===\n");
    for (const article of failedArticles) {
      console.log(`- ${article.title}`);
      console.log(`  ID: ${article.id}`);
      console.log(`  Reason: ${article.reason}`);
    }
  }
}

main().catch(console.error);
