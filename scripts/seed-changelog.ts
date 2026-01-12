/**
 * Seed Changelog Script
 *
 * 실제 Claude Code 공식 Changelog에서 데이터를 가져와 DB에 저장합니다.
 *
 * 실행 방법:
 * npx tsx scripts/seed-changelog.ts
 */

import { processAndSaveChangelog } from "../lib/ai/changelog";

const CHANGELOG_URL = "https://docs.anthropic.com/en/docs/claude-code/changelog";

async function main() {
  console.log("🚀 Starting Changelog Seed Process...\n");
  console.log(`📍 Source: ${CHANGELOG_URL}\n`);

  try {
    // 2-stage pipeline: Haiku (detect) → Opus 4.5 (content)
    const result = await processAndSaveChangelog(CHANGELOG_URL, {
      highlightsOnly: false, // 모든 항목 처리
      targetAudience: "beginner",
    });

    if (result.success) {
      console.log("\n✅ Success!");
      console.log(`   Version: ${result.version?.version}`);
      console.log(`   Items: ${result.items.length}`);
      console.log(`   Total Cost: $${result.totalCost.toFixed(4)}`);
    } else {
      console.error("\n❌ Failed:", result.error);
    }
  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  }
}

main();
