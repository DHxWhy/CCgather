/**
 * Admin Beginners Dictionary Generation API
 *
 * Generates FOR BEGINNERS dictionary entries using AI:
 * POST /api/admin/beginners/generate
 */

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "@/lib/supabase/server";
import { AI_MODELS, calculateCost } from "@/lib/ai/types";
import {
  BEGINNERS_DICT_SYSTEM_PROMPT,
  BEGINNERS_DICT_USER_PROMPT,
  fillTemplate,
} from "@/lib/ai/changelog/prompts";
import type { BeginnerCategory } from "@/types/changelog";

// ============================================
// Types
// ============================================

interface GenerateRequest {
  name: string;
  category: BeginnerCategory;
  whatItDoes: string;
  commandSyntax?: string;
  autoSave?: boolean;
}

interface GeneratedEntry {
  slug: string;
  name: string;
  category: BeginnerCategory;
  whatItDoes: string;
  commandSyntax: string | null;
  forBeginners: string;
  relatedSlugs: string[];
  isFeatured: boolean;
  displayOrder: number;
}

// ============================================
// POST: Generate beginner dictionary entry
// ============================================

export async function POST(request: Request) {
  try {
    const supabase = createServiceClient();

    // Parse request body
    const body = (await request.json()) as GenerateRequest;
    const { name, category, whatItDoes, commandSyntax, autoSave = false } = body;

    if (!name || !category || !whatItDoes) {
      return NextResponse.json(
        { error: "name, category, and whatItDoes are required" },
        { status: 400 }
      );
    }

    // Build prompt
    const userPrompt = fillTemplate(BEGINNERS_DICT_USER_PROMPT, {
      name,
      category,
      whatItDoes,
      commandSyntax,
    });

    // Call Sonnet for generation
    const client = new Anthropic();
    const response = await client.messages.create({
      model: AI_MODELS.SONNET,
      max_tokens: 2048,
      system: BEGINNERS_DICT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    // Extract text content
    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response from AI");
    }

    // Parse JSON
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const generatedEntry = JSON.parse(jsonMatch[0]) as GeneratedEntry;

    // Calculate cost
    const costUsd = calculateCost(
      AI_MODELS.SONNET,
      response.usage.input_tokens,
      response.usage.output_tokens
    );

    // Auto-save if requested
    if (autoSave) {
      const { error: insertError } = await supabase.from("beginners_dictionary").insert({
        slug: generatedEntry.slug,
        name: generatedEntry.name,
        category: generatedEntry.category,
        what_it_does: generatedEntry.whatItDoes,
        command_syntax: generatedEntry.commandSyntax,
        for_beginners: generatedEntry.forBeginners,
        related_slugs: generatedEntry.relatedSlugs,
        is_featured: generatedEntry.isFeatured,
        display_order: generatedEntry.displayOrder,
        verification_status: "pending",
      });

      if (insertError) {
        console.error("Failed to save entry:", insertError);
      }
    }

    // Log generation
    await supabase.from("content_generation_logs").insert({
      content_type: "beginners_dictionary",
      content_id: generatedEntry.slug,
      stage: "generate",
      model_used: AI_MODELS.SONNET,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cost_usd: costUsd,
      result_status: "success",
    });

    return NextResponse.json({
      success: true,
      entry: generatedEntry,
      usage: {
        model: AI_MODELS.SONNET,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        costUsd,
      },
      saved: autoSave,
    });
  } catch (error) {
    console.error("[Beginners Generate] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// ============================================
// POST: Batch generate multiple entries
// ============================================

export async function PUT(request: Request) {
  try {
    const supabase = createServiceClient();

    // Parse request body
    const body = (await request.json()) as {
      entries: GenerateRequest[];
      autoSave?: boolean;
    };

    const { entries, autoSave = false } = body;

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ error: "entries array is required" }, { status: 400 });
    }

    // Limit batch size
    if (entries.length > 20) {
      return NextResponse.json({ error: "Maximum 20 entries per batch" }, { status: 400 });
    }

    const results: Array<{
      name: string;
      success: boolean;
      entry?: GeneratedEntry;
      error?: string;
    }> = [];

    let totalCost = 0;
    const client = new Anthropic();

    for (const entry of entries) {
      try {
        const userPrompt = fillTemplate(BEGINNERS_DICT_USER_PROMPT, {
          name: entry.name,
          category: entry.category,
          whatItDoes: entry.whatItDoes,
          commandSyntax: entry.commandSyntax,
        });

        const response = await client.messages.create({
          model: AI_MODELS.SONNET,
          max_tokens: 2048,
          system: BEGINNERS_DICT_SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPrompt }],
        });

        const textContent = response.content.find((c) => c.type === "text");
        if (!textContent || textContent.type !== "text") {
          throw new Error("No text response");
        }

        const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error("No JSON in response");
        }

        const generatedEntry = JSON.parse(jsonMatch[0]) as GeneratedEntry;
        const costUsd = calculateCost(
          AI_MODELS.SONNET,
          response.usage.input_tokens,
          response.usage.output_tokens
        );
        totalCost += costUsd;

        if (autoSave) {
          await supabase.from("beginners_dictionary").insert({
            slug: generatedEntry.slug,
            name: generatedEntry.name,
            category: generatedEntry.category,
            what_it_does: generatedEntry.whatItDoes,
            command_syntax: generatedEntry.commandSyntax,
            for_beginners: generatedEntry.forBeginners,
            related_slugs: generatedEntry.relatedSlugs,
            is_featured: generatedEntry.isFeatured,
            display_order: generatedEntry.displayOrder,
            verification_status: "pending",
          });
        }

        results.push({ name: entry.name, success: true, entry: generatedEntry });

        // Delay between requests
        await new Promise((resolve) => setTimeout(resolve, 1500));
      } catch (error) {
        results.push({
          name: entry.name,
          success: false,
          error: error instanceof Error ? error.message : "Generation failed",
        });
      }
    }

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: entries.length,
        successful: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        totalCost,
        saved: autoSave,
      },
    });
  } catch (error) {
    console.error("[Beginners Batch Generate] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
