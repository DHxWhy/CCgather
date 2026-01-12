import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import type { ChangelogItem } from "@/types/changelog";

/**
 * POST /api/admin/changelog/items
 * 새 changelog 항목 추가
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();

    const body = await request.json();
    const {
      version_id,
      slug,
      title,
      category,
      overview,
      how_to_use,
      use_cases,
      tips,
      for_beginners,
      commands,
      code_examples,
      official_doc_url,
      is_highlight,
    } = body;

    if (!version_id || !slug || !title) {
      return NextResponse.json(
        { error: "version_id, slug, and title are required" },
        { status: 400 }
      );
    }

    const { data: newItem, error: insertError } = await supabase
      .from("changelog_items")
      .insert({
        version_id,
        slug,
        title,
        category,
        overview,
        how_to_use,
        use_cases,
        tips,
        for_beginners,
        commands,
        code_examples,
        official_doc_url,
        is_highlight: is_highlight || false,
        verification_status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to create item:", insertError);
      return NextResponse.json({ error: "Failed to create item" }, { status: 500 });
    }

    return NextResponse.json({ item: newItem as ChangelogItem }, { status: 201 });
  } catch (err) {
    console.error("Admin changelog items POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/changelog/items
 * changelog 항목 일괄 업데이트 (검증 상태 변경 등)
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = createServiceClient();

    const body = await request.json();
    const { ids, updates } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids array is required" }, { status: 400 });
    }

    if (!updates || typeof updates !== "object") {
      return NextResponse.json({ error: "updates object is required" }, { status: 400 });
    }

    // 허용된 필드만 업데이트
    const allowedFields = [
      "verification_status",
      "verification_confidence",
      "verification_issues",
      "verification_suggestions",
      "is_highlight",
      "display_order",
    ];

    const filteredUpdates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in updates) {
        filteredUpdates[field] = updates[field];
      }
    }

    const { data: updatedItems, error: updateError } = await supabase
      .from("changelog_items")
      .update(filteredUpdates)
      .in("id", ids)
      .select();

    if (updateError) {
      console.error("Failed to update items:", updateError);
      return NextResponse.json({ error: "Failed to update items" }, { status: 500 });
    }

    return NextResponse.json({
      updated_count: (updatedItems || []).length,
      items: updatedItems,
    });
  } catch (err) {
    console.error("Admin changelog items PATCH error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
