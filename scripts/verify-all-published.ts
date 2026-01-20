/**
 * Verify all published articles using hard check
 * Run with: npx tsx scripts/verify-all-published.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { performHardCheck } from "../lib/ai/fact-hard-check";

// Use service role key for admin access
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface ArticleIssue {
  id: string;
  title: string;
  source_url: string;
  created_at: string;
  issues: string[];
  score: number;
}

async function main() {
  console.log("=== Verifying ALL Published Articles ===\n");
  console.log("Fetching published articles...");

  // Fetch ALL published articles
  const { data: articles, error } = await supabase
    .from("contents")
    .select("id, title, source_url, original_content, body_html, created_at")
    .eq("status", "published")
    .not("original_content", "is", null)
    .not("body_html", "is", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching articles:", error);
    process.exit(1);
  }

  if (!articles || articles.length === 0) {
    console.log("No published articles found.");
    return;
  }

  console.log(`Found ${articles.length} published articles to verify.\n`);

  const articlesWithIssues: ArticleIssue[] = [];
  let checked = 0;

  for (const article of articles) {
    checked++;
    process.stdout.write(`\rChecking ${checked}/${articles.length}...`);

    const result = performHardCheck(article.original_content!, article.body_html!);

    if (!result.passed || result.criticalIssues.length > 0) {
      articlesWithIssues.push({
        id: article.id,
        title: article.title || "Untitled",
        source_url: article.source_url,
        created_at: article.created_at,
        issues: [...result.criticalIssues, ...result.warnings],
        score: result.score,
      });
    }
  }

  console.log("\n\n=== Results ===\n");
  console.log(`Total checked: ${checked}`);
  console.log(`Articles with issues: ${articlesWithIssues.length}`);

  if (articlesWithIssues.length > 0) {
    console.log("\n=== Articles Needing Review ===\n");

    for (const article of articlesWithIssues) {
      console.log(`❌ ${article.title}`);
      console.log(`   ID: ${article.id}`);
      console.log(`   URL: ${article.source_url}`);
      console.log(`   Score: ${article.score}`);
      console.log(`   Issues:`);
      article.issues.forEach((issue) => console.log(`     - ${issue}`));
      console.log("");
    }

    // Update each article individually to avoid constraint issues
    console.log("\n=== Updating Status to needs_review ===\n");

    const idsToUpdate = articlesWithIssues.map((a) => a.id);
    let updatedCount = 0;
    let errorCount = 0;

    for (const article of articlesWithIssues) {
      const { error: updateError } = await supabase
        .from("contents")
        .update({
          status: "needs_review",
          fact_check_reason: article.issues.slice(0, 3).join("; ").substring(0, 500),
        })
        .eq("id", article.id)
        .eq("status", "published"); // Only update if still published

      if (updateError) {
        console.error(`Error updating ${article.id}:`, updateError.message);
        errorCount++;
      } else {
        updatedCount++;
      }
    }

    console.log(`\n✅ Updated ${updatedCount} articles to needs_review status.`);
    if (errorCount > 0) {
      console.log(
        `⚠️ ${errorCount} articles could not be updated (may already be in needs_review).`
      );
    }
    console.log("\nAffected article IDs:");
    idsToUpdate.forEach((id) => console.log(`  - ${id}`));
  } else {
    console.log("\n✅ All published articles passed verification!");
  }
}

main().catch(console.error);
