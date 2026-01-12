/**
 * Changelog Content Pipeline - 2-Stage Processing
 *
 * Simplified pipeline for generating changelog content:
 * Stage 1 (Haiku): Parse changelog → Extract entries
 * Stage 2 (Opus 4.5): Generate high-quality content with self-verification
 *
 * Total cost per version: ~$1-3 depending on entry count
 */

import { createClient } from "@/lib/supabase/server";
import { getChangelogCollector, fetchChangelogContent } from "./collector";
import { getChangelogContentGenerator } from "./content-generator";
import type {
  CollectorInput,
  CollectorOutput,
  ChangelogPipelineResult,
  PipelineStageResult,
} from "./types";

// ============================================
// Pipeline Options
// ============================================

interface PipelineOptions {
  // Only process highlight entries
  highlightsOnly?: boolean;

  // Auto-save to database
  autoSave?: boolean;

  // Target audience for content generation
  targetAudience?: "beginner" | "intermediate" | "advanced";

  // Delay between API calls (ms)
  apiDelayMs?: number;

  // Minimum confidence score for auto-approval
  minConfidence?: number;
}

// ============================================
// Changelog Content Pipeline
// ============================================

export class ChangelogContentPipeline {
  private collector = getChangelogCollector();
  private contentGenerator = getChangelogContentGenerator();
  private options: Required<PipelineOptions>;

  constructor(options: PipelineOptions = {}) {
    this.options = {
      highlightsOnly: false,
      autoSave: false,
      targetAudience: "beginner",
      apiDelayMs: 2000,
      minConfidence: 85,
      ...options,
    };
  }

  /**
   * Process a changelog URL through the 2-stage pipeline
   */
  async process(input: CollectorInput): Promise<ChangelogPipelineResult> {
    const startTime = Date.now();
    let totalCost = 0;

    console.log(`\n🚀 [Pipeline] Starting changelog processing (2-stage)...`);
    console.log(`📍 Source: ${input.sourceUrl}`);

    // Initialize result structure
    const result: ChangelogPipelineResult = {
      success: false,
      items: [],
      totalCost: 0,
      stages: {
        collector: {
          success: false,
          usage: { model: "", inputTokens: 0, outputTokens: 0, costUsd: 0 },
        },
        writer: [],
        verifier: [],
      },
    };

    try {
      // ========================================
      // Stage 1: Collect (Haiku)
      // ========================================
      console.log(`\n📥 [Stage 1] Collecting changelog data with Haiku...`);

      // Fetch content if not provided
      if (!input.htmlContent) {
        console.log(`   Fetching content from URL...`);
        input.htmlContent = await fetchChangelogContent(input.sourceUrl);
      }

      const collectorResult = await this.collector.collect(input);
      result.stages.collector = collectorResult;
      totalCost += collectorResult.usage.costUsd;

      if (!collectorResult.success || !collectorResult.result) {
        result.error = `Collector failed: ${collectorResult.error}`;
        result.totalCost = totalCost;
        return result;
      }

      const { version, releaseDate, releaseType, entries } = collectorResult.result;
      result.version = { version, releaseDate, releaseType };

      console.log(`   ✓ Parsed v${version} (${releaseType})`);
      console.log(`   ✓ Found ${entries.length} entries`);

      // Filter entries if needed
      const entriesToProcess = this.options.highlightsOnly
        ? entries.filter((e) => e.isHighlight)
        : entries;

      console.log(`   → Processing ${entriesToProcess.length} entries`);

      // ========================================
      // Stage 2: Generate Content (Opus 4.5)
      // ========================================
      console.log(`\n✍️  [Stage 2] Generating content with Opus 4.5...`);

      for (let i = 0; i < entriesToProcess.length; i++) {
        const entry = entriesToProcess[i]!;
        console.log(`   [${i + 1}/${entriesToProcess.length}] "${entry.title}"...`);

        const generatorResult = await this.contentGenerator.generate({
          entry,
          version,
          targetAudience: this.options.targetAudience,
        });

        // Store in writer stage for compatibility
        result.stages.writer.push(generatorResult);
        totalCost += generatorResult.usage.costUsd;

        if (generatorResult.success && generatorResult.result) {
          const content = generatorResult.result;
          const confidence = content.confidence || 0;

          // Determine verification status based on confidence
          const status =
            confidence >= 95
              ? "auto"
              : confidence >= this.options.minConfidence
                ? "confirm"
                : confidence >= 70
                  ? "revision"
                  : "manual";

          result.items.push({
            entry,
            content,
            verification: {
              confidence,
              status,
              checks: {
                factualAccuracy: { passed: confidence >= 80, reason: "Self-verified by Opus 4.5" },
                analogyQuality: {
                  passed: !!content.forBeginners,
                  reason: content.forBeginners ? "Analogy included" : "No analogy",
                },
                completeness: {
                  passed: confidence >= 75,
                  reason: "Content completeness self-assessed",
                },
                clarity: { passed: confidence >= 70, reason: "Clarity self-assessed" },
                technicalCorrectness: {
                  passed: confidence >= 80,
                  reason: "Technical accuracy self-verified",
                },
              },
              suggestions: [],
              finalContent: content,
            },
          });

          console.log(`   ✓ Generated (confidence: ${confidence}, status: ${status})`);
        }

        // Delay between API calls
        if (i < entriesToProcess.length - 1) {
          await this.delay(this.options.apiDelayMs);
        }
      }

      console.log(`   ✓ Generated ${result.items.length} content items`);

      // ========================================
      // Auto-save to Database
      // ========================================
      if (this.options.autoSave && result.items.length > 0) {
        console.log(`\n💾 [Save] Saving to database...`);
        await this.saveToDatabase(result);
      }

      // ========================================
      // Summary
      // ========================================
      result.success = true;
      result.totalCost = totalCost;

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      const autoCount = result.items.filter((i) => i.verification.status === "auto").length;
      const confirmCount = result.items.filter((i) => i.verification.status === "confirm").length;
      const revisionCount = result.items.filter((i) => i.verification.status === "revision").length;
      const manualCount = result.items.filter((i) => i.verification.status === "manual").length;

      console.log(`\n✅ [Pipeline] Complete!`);
      console.log(`   Duration: ${duration}s`);
      console.log(`   Total cost: $${totalCost.toFixed(4)}`);
      console.log(`   Items: ${result.items.length}`);
      console.log(
        `   Status: AUTO=${autoCount} CONFIRM=${confirmCount} REVISION=${revisionCount} MANUAL=${manualCount}`
      );

      return result;
    } catch (error) {
      console.error(`\n❌ [Pipeline] Error:`, error);
      result.error = error instanceof Error ? error.message : "Pipeline failed";
      result.totalCost = totalCost;
      return result;
    }
  }

  /**
   * Save pipeline results to database
   */
  private async saveToDatabase(result: ChangelogPipelineResult): Promise<void> {
    if (!result.version) return;

    const supabase = await createClient();

    // 1. Create or get version
    const { data: existingVersion } = await supabase
      .from("changelog_versions")
      .select("id")
      .eq("version", result.version.version)
      .single();

    let versionId: string;

    if (existingVersion) {
      versionId = existingVersion.id;
    } else {
      const { data: newVersion, error: versionError } = await supabase
        .from("changelog_versions")
        .insert({
          version: result.version.version,
          version_slug: `v${result.version.version.replace(/\./g, "-")}`,
          release_date: result.version.releaseDate,
          release_type: result.version.releaseType,
          official_url: result.stages.collector.result
            ? (result.stages.collector as PipelineStageResult<CollectorOutput>).result?.rawSummary
            : null,
        })
        .select("id")
        .single();

      if (versionError || !newVersion) {
        console.error("Failed to create version:", versionError);
        return;
      }
      versionId = newVersion.id;
    }

    // 2. Save items
    for (const item of result.items) {
      const content = item.verification.finalContent || item.content;
      const verificationStatus = item.verification.status === "auto" ? "approved" : "pending";

      const { error: itemError } = await supabase.from("changelog_items").upsert(
        {
          version_id: versionId,
          slug: content.slug,
          title: content.title,
          overview: content.overview,
          how_to_use: content.howToUse,
          use_cases: content.useCases,
          tips: content.tips,
          for_beginners: content.forBeginners
            ? `${content.forBeginners.analogy}\n\n${content.forBeginners.explanation}\n\n${content.forBeginners.whenToUse}`
            : null,
          commands: content.commands,
          category: content.category,
          is_highlight: content.isHighlight,
          verification_status: verificationStatus,
          ai_confidence: item.verification.confidence,
        },
        { onConflict: "slug" }
      );

      if (itemError) {
        console.error(`Failed to save item ${content.slug}:`, itemError);
      }
    }

    // 3. Log generation
    await supabase.from("content_generation_logs").insert({
      content_type: "changelog",
      content_id: versionId,
      stage: "complete",
      model_used: "haiku+opus",
      input_tokens:
        result.stages.collector.usage.inputTokens +
        result.stages.writer.reduce((sum, w) => sum + w.usage.inputTokens, 0),
      output_tokens:
        result.stages.collector.usage.outputTokens +
        result.stages.writer.reduce((sum, w) => sum + w.usage.outputTokens, 0),
      cost_usd: result.totalCost,
      result_status: result.success ? "success" : "error",
    });

    console.log(`   ✓ Saved ${result.items.length} items to database`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================
// Convenience Functions
// ============================================

/**
 * Process a changelog URL with default options
 */
export async function processChangelog(
  sourceUrl: string,
  options: PipelineOptions = {}
): Promise<ChangelogPipelineResult> {
  const pipeline = new ChangelogContentPipeline(options);
  return pipeline.process({ sourceUrl });
}

/**
 * Process changelog with auto-save enabled
 */
export async function processAndSaveChangelog(
  sourceUrl: string,
  options: Omit<PipelineOptions, "autoSave"> = {}
): Promise<ChangelogPipelineResult> {
  const pipeline = new ChangelogContentPipeline({
    ...options,
    autoSave: true,
  });
  return pipeline.process({ sourceUrl });
}

/**
 * Quick processing (highlights only)
 */
export async function quickProcessChangelog(sourceUrl: string): Promise<ChangelogPipelineResult> {
  const pipeline = new ChangelogContentPipeline({
    highlightsOnly: true,
  });
  return pipeline.process({ sourceUrl });
}
