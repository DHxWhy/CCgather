/**
 * Re-verify published articles for date/number hallucinations
 * Run with: npx tsx scripts/reverify-articles.ts
 */

import { performHardCheck } from "../lib/ai/fact-hard-check";

// Since we can't use Supabase server client directly in a script,
// we'll need to fetch data via SQL or use the API
// For now, let's test with the known problematic article data

interface ArticleData {
  id: string;
  title: string;
  source_url: string;
  original_content: string;
  body_html: string;
}

// Test data from the California SB 53 article
const testArticles: ArticleData[] = [
  {
    id: "ad6ddd21-0234-4575-b288-5d5dbc45d93d",
    title: "Anthropic Unveils Safety Framework for California's New AI Law",
    source_url: "https://www.anthropic.com/news/compliance-framework-SB53",
    original_content: `PolicySharing our compliance framework for California's Transparency in Frontier AI ActDec 19, 2025On January 1, California's Transparency in Frontier AI Act (SB 53) will go into effect. It establishes the nation's first frontier AI safety and transparency requirements for catastrophic risks.`,
    body_html: `<h2>Compliance Overview</h2><p>Large-scale AI developers operating in California will be legally required to document their safety protocols for preventing catastrophic events beginning on the first day of 2025.</p>`,
  },
];

console.log("=== Re-verifying Published Articles ===\n");

let issuesFound = 0;

for (const article of testArticles) {
  console.log(`Checking: ${article.title}`);
  console.log(`URL: ${article.source_url}`);

  const result = performHardCheck(article.original_content, article.body_html);

  if (!result.passed) {
    issuesFound++;
    console.log(`❌ FAILED - Score: ${result.score}`);
    console.log(`Critical Issues:`);
    result.criticalIssues.forEach((issue) => console.log(`  - ${issue}`));
    if (result.warnings.length > 0) {
      console.log(`Warnings:`);
      result.warnings.forEach((w) => console.log(`  - ${w}`));
    }
  } else {
    console.log(`✅ PASSED - Score: ${result.score}`);
  }

  console.log("---\n");
}

console.log(`\nTotal issues found: ${issuesFound}`);
console.log("\nTo fix these articles, run:");
console.log("GET /api/admin/reverify?status=published&dryRun=false");
