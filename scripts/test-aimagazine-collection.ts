/**
 * Test script: Collect 5 articles from aimagazine.com
 * Run: npx tsx scripts/test-aimagazine-collection.ts
 */

import { GeminiPipeline } from "../lib/ai";
import { createClient } from "@supabase/supabase-js";

// Load env
const fs = require("fs");
const envContent = fs.readFileSync(".env.local", "utf-8");

function getEnv(key: string): string {
  const match = envContent.match(new RegExp(`${key}=(.+)`));
  return match?.[1]?.trim() || "";
}

const SUPABASE_URL = getEnv("NEXT_PUBLIC_SUPABASE_URL");
const SUPABASE_SERVICE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY");
const GEMINI_API_KEY = getEnv("GOOGLE_GEMINI_API_KEY");

// Set env for GeminiClient
process.env.GOOGLE_GEMINI_API_KEY = GEMINI_API_KEY;

// Real articles from aimagazine.com (verified URLs - 3 that worked in previous test)
const TEST_ARTICLES = [
  "https://aimagazine.com/news/anthropic-research-shows-how-evil-ai-can-lie-and-sabotage",
  "https://aimagazine.com/news/jpmorgan-openai-anthropic-evolving-banking-operations",
  "https://aimagazine.com/news/grok-xai-musk-growing-ai-debate",
];

async function main() {
  console.log("=".repeat(60));
  console.log("🧪 AImagazine Collection Test (5 articles)");
  console.log("=".repeat(60));
  console.log();

  // Initialize
  const pipeline = new GeminiPipeline({
    minFactCheckScore: 80,
    maxRetries: 1,
    debug: true,
  });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const results: Array<{
    url: string;
    success: boolean;
    articleType?: string;
    secondaryType?: string;
    confidence?: number;
    title?: string;
    cost?: number;
    error?: string;
  }> = [];

  let totalCost = 0;

  for (let i = 0; i < TEST_ARTICLES.length; i++) {
    const url = TEST_ARTICLES[i]!;
    console.log(`\n[${i + 1}/${TEST_ARTICLES.length}] Processing: ${url}`);
    console.log("-".repeat(50));

    try {
      // Process through pipeline
      const result = await pipeline.process(url, "press");

      if (!result.success) {
        console.log(`❌ Failed: ${result.error}`);
        results.push({ url, success: false, error: result.error });
        continue;
      }

      const classification = result.extractedFacts?.classification;
      const cost = result.aiUsage.costUsd;
      totalCost += cost;

      console.log(`✅ Success!`);
      console.log(`   Type: ${classification?.primary} (${classification?.secondary || "none"})`);
      console.log(`   Confidence: ${((classification?.confidence || 0) * 100).toFixed(0)}%`);
      console.log(`   Signals: ${classification?.signals?.slice(0, 3).join(", ")}`);
      console.log(`   Title: ${result.rewrittenArticle?.title.text?.substring(0, 50)}...`);
      console.log(`   Cost: $${cost.toFixed(4)}`);

      // Save to database
      const insertData = {
        type: "news",
        content_type: "press",
        source_url: result.article!.url,
        source_name: result.article!.sourceName,
        title: result.rewrittenArticle?.title.text || result.article!.title,
        thumbnail_url: result.article!.thumbnail,
        published_at: result.article!.publishedAt,
        status: result.needsReview ? "needs_review" : "published",
        summary_md: result.rewrittenArticle?.summary || result.summary?.summaryPlain,
        rich_content: result.summary?.richContent,
        one_liner: result.rewrittenArticle?.oneLiner,
        body_html: result.rewrittenArticle?.bodyHtml,
        insight_html: result.rewrittenArticle?.insightHtml,
        key_takeaways: result.rewrittenArticle?.keyTakeaways,
        category: result.rewrittenArticle?.category,
        difficulty: result.summary?.difficulty,
        original_content: result.article!.content,
        fact_check_score: result.factVerification ? result.factVerification.score / 100 : null,
        fact_check_reason: result.factVerification?.issues.join("; ") || "Passed",
        ai_model_used: result.aiUsage.model,
        ai_tokens_used: result.aiUsage.inputTokens + result.aiUsage.outputTokens,
        ai_cost_usd: result.aiUsage.costUsd,
        ai_processed_at: new Date().toISOString(),
        ai_model_version: result.aiUsage.model,
        // New classification fields
        ai_article_type: classification?.primary,
        ai_article_type_secondary: classification?.secondary || null,
        ai_classification_confidence: classification?.confidence,
        ai_classification_signals: classification?.signals,
      };

      const { error: dbError } = await supabase.from("contents").insert(insertData);

      if (dbError) {
        if (dbError.code === "23505") {
          console.log(`   ⚠️ Already exists in DB (skipped)`);
        } else {
          console.log(`   ❌ DB Error: ${dbError.message}`);
        }
      } else {
        console.log(`   💾 Saved to database`);
      }

      results.push({
        url,
        success: true,
        articleType: classification?.primary,
        secondaryType: classification?.secondary,
        confidence: classification?.confidence,
        title: result.rewrittenArticle?.title.text,
        cost,
      });

      // Delay between requests
      if (i < TEST_ARTICLES.length - 1) {
        console.log(`   ⏳ Waiting 3s before next...`);
        await new Promise((r) => setTimeout(r, 3000));
      }
    } catch (error) {
      console.log(`❌ Error: ${error}`);
      results.push({ url, success: false, error: String(error) });
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 SUMMARY");
  console.log("=".repeat(60));

  const successful = results.filter((r) => r.success);
  console.log(`Success: ${successful.length}/${results.length}`);
  console.log(`Total Cost: $${totalCost.toFixed(4)}`);
  console.log();

  // Type distribution
  const typeCounts: Record<string, number> = {};
  for (const r of successful) {
    if (r.articleType) {
      typeCounts[r.articleType] = (typeCounts[r.articleType] || 0) + 1;
    }
  }
  console.log("Article Types:");
  for (const [type, count] of Object.entries(typeCounts)) {
    console.log(`  - ${type}: ${count}`);
  }

  console.log("\nResults:");
  console.log("| # | Type | Confidence | Title |");
  console.log("|---|------|------------|-------|");
  for (let i = 0; i < results.length; i++) {
    const r = results[i]!;
    if (r.success) {
      console.log(
        `| ${i + 1} | ${r.articleType?.padEnd(15)} | ${((r.confidence || 0) * 100).toFixed(0).padStart(3)}% | ${r.title?.substring(0, 40)}... |`
      );
    } else {
      console.log(`| ${i + 1} | FAILED | - | ${r.error?.substring(0, 40)} |`);
    }
  }
}

main().catch(console.error);
