/**
 * Test Changelog Pipeline
 *
 * 실제 Claude Code Changelog를 파싱하고 콘텐츠를 생성합니다.
 *
 * 실행: npx tsx scripts/test-changelog-pipeline.ts
 *
 * 환경변수 필요:
 * - ANTHROPIC_API_KEY
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY (또는 NEXT_PUBLIC_SUPABASE_ANON_KEY)
 */

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

// GitHub Raw URL for CHANGELOG.md
const CHANGELOG_URL = "https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md";

// Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Anthropic client
const anthropic = new Anthropic();

// ============================================
// Step 1: Fetch Changelog HTML
// ============================================

async function fetchChangelog(): Promise<string> {
  console.log("📥 Fetching changelog from:", CHANGELOG_URL);

  const response = await fetch(CHANGELOG_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status}`);
  }

  const markdown = await response.text();
  console.log(`   Content length: ${markdown.length} chars`);

  // Return first 40000 chars (enough for recent versions)
  return markdown.slice(0, 40000);
}

// ============================================
// Step 2: Parse with Haiku
// ============================================

interface ChangelogEntry {
  title: string;
  description: string;
  category: string;
  isHighlight: boolean;
  version: string;
}

async function parseWithHaiku(content: string): Promise<ChangelogEntry[]> {
  console.log("\n🔍 Parsing with Haiku...");

  const response = await anthropic.messages.create({
    model: "claude-3-5-haiku-20241022",
    max_tokens: 4096,
    system: `You are a changelog parser. Extract structured data from Claude Code changelog.
Output valid JSON array only. Focus on the most recent 2-3 versions.`,
    messages: [
      {
        role: "user",
        content: `Parse this Claude Code changelog and extract the entries:

${content}

Return JSON array:
[{
  "title": "Feature name",
  "description": "Brief description",
  "category": "feature|improvement|bugfix|command",
  "isHighlight": true/false,
  "version": "X.Y.Z"
}]

Focus on major features and commands. Limit to 10-15 most important items.`,
      },
    ],
  });

  const textContent = response.content.find((c) => c.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No response from Haiku");
  }

  const jsonMatch = textContent.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.log("Raw response:", textContent.text);
    throw new Error("No JSON array found");
  }

  const entries = JSON.parse(jsonMatch[0]) as ChangelogEntry[];
  console.log(`   Parsed ${entries.length} entries`);
  console.log(
    `   Cost: ~$${((response.usage.input_tokens * 0.8 + response.usage.output_tokens * 4) / 1000000).toFixed(4)}`
  );

  return entries;
}

// ============================================
// Step 3: Generate Content with Sonnet
// ============================================

interface GeneratedContent {
  slug: string;
  title: string;
  overview: string;
  howToUse: string;
  forBeginners: string | null;
  category: string;
  isHighlight: boolean;
}

async function generateWithSonnet(entry: ChangelogEntry): Promise<GeneratedContent> {
  const needsForBeginners =
    entry.isHighlight || entry.category === "feature" || entry.category === "command";

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: `You create beginner-friendly content for Claude Code features.
Use global services for analogies: Netflix, Instagram, YouTube, Spotify, etc.
NEVER use country-specific services like KakaoTalk, Line, etc.`,
    messages: [
      {
        role: "user",
        content: `Create content for this Claude Code feature:

Title: ${entry.title}
Description: ${entry.description}
Category: ${entry.category}

Return JSON:
{
  "slug": "feature-name-slug",
  "title": "${entry.title}",
  "overview": "2-3 sentence overview",
  "howToUse": "How to use this feature",
  "forBeginners": ${needsForBeginners ? '"Everyday analogy explanation (2-3 paragraphs)"' : "null"},
  "category": "${entry.category}",
  "isHighlight": ${entry.isHighlight}
}`,
      },
    ],
  });

  const textContent = response.content.find((c) => c.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No response from Sonnet");
  }

  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON found");
  }

  return JSON.parse(jsonMatch[0]) as GeneratedContent;
}

// ============================================
// Step 4: Save to Database
// ============================================

async function saveToDatabase(entries: ChangelogEntry[], contents: GeneratedContent[]) {
  console.log("\n💾 Saving to database...");

  // Group by version
  const versions = [...new Set(entries.map((e) => e.version))];

  for (const version of versions) {
    // Create version
    const { data: existingVersion } = await supabase
      .from("changelog_versions")
      .select("id")
      .eq("version", version)
      .single();

    let versionId: string;

    if (existingVersion) {
      versionId = existingVersion.id;
      console.log(`   Using existing version: ${version}`);
    } else {
      const { data: newVersion, error } = await supabase
        .from("changelog_versions")
        .insert({
          version,
          version_slug: `v${version.replace(/\./g, "-")}`,
          release_type: version.endsWith(".0.0")
            ? "major"
            : version.endsWith(".0")
              ? "minor"
              : "patch",
          official_url: CHANGELOG_URL,
        })
        .select("id")
        .single();

      if (error) {
        console.error(`   Failed to create version ${version}:`, error.message);
        continue;
      }
      versionId = newVersion!.id;
      console.log(`   Created version: ${version}`);
    }

    // Save items for this version
    const versionEntries = entries.filter((e) => e.version === version);
    for (let i = 0; i < versionEntries.length; i++) {
      const entry = versionEntries[i];
      if (!entry) continue;

      const content = contents.find((c) => c.title === entry.title);
      if (!content) continue;

      const { error } = await supabase.from("changelog_items").upsert(
        {
          version_id: versionId,
          slug: content.slug,
          title: content.title,
          overview: content.overview,
          how_to_use: content.howToUse,
          for_beginners: content.forBeginners,
          category: content.category,
          is_highlight: content.isHighlight,
          verification_status: "approved",
          display_order: i + 1,
        },
        { onConflict: "slug" }
      );

      if (error) {
        console.error(`   Failed to save ${content.slug}:`, error.message);
      } else {
        console.log(`   ✓ Saved: ${content.title}`);
      }
    }
  }
}

// ============================================
// Main
// ============================================

async function main() {
  console.log("🚀 Changelog Pipeline Test\n");
  console.log("=".repeat(50));

  try {
    // Step 1: Fetch
    const content = await fetchChangelog();

    // Step 2: Parse with Haiku
    const entries = await parseWithHaiku(content);
    console.log("\n📋 Parsed entries:");
    entries.forEach((e, i) => {
      console.log(`   ${i + 1}. [${e.category}] ${e.title} (v${e.version})`);
    });

    // Step 3: Generate with Sonnet
    console.log("\n✍️  Generating content with Sonnet...");
    const contents: GeneratedContent[] = [];
    for (const entry of entries) {
      process.stdout.write(`   Processing "${entry.title}"... `);
      const content = await generateWithSonnet(entry);
      contents.push(content);
      console.log("✓");

      // Rate limit delay
      await new Promise((r) => setTimeout(r, 1000));
    }

    // Step 4: Save
    await saveToDatabase(entries, contents);

    console.log("\n" + "=".repeat(50));
    console.log("✅ Complete!");
    console.log(`   Versions: ${[...new Set(entries.map((e) => e.version))].join(", ")}`);
    console.log(`   Items saved: ${contents.length}`);
  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  }
}

main();
