import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import type { BeginnersDictionaryItem } from "@/types/changelog";

/**
 * GET /api/admin/beginners
 * Admin용 beginners dictionary 관리
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get("status"); // "all" | "pending" | "approved" | "rejected"

  try {
    const supabase = createServiceClient();

    // 항목 조회 (상태 필터 적용)
    let query = supabase
      .from("beginners_dictionary")
      .select("*")
      .order("category", { ascending: true })
      .order("display_order", { ascending: true });

    if (status && status !== "all") {
      query = query.eq("verification_status", status);
    }

    const { data: items, error: itemsError } = await query;

    if (itemsError) {
      return NextResponse.json({ error: "Failed to fetch items" }, { status: 500 });
    }

    // 통계 계산
    const stats = {
      total_items: (items || []).length,
      pending_items: (items || []).filter((i) => i.verification_status === "pending").length,
      approved_items: (items || []).filter((i) => i.verification_status === "approved").length,
      rejected_items: (items || []).filter((i) => i.verification_status === "rejected").length,
      featured_items: (items || []).filter((i) => i.is_featured).length,
    };

    // 카테고리별 그룹화
    const byCategory: Record<string, BeginnersDictionaryItem[]> = {};
    for (const item of (items || []) as BeginnersDictionaryItem[]) {
      if (!byCategory[item.category]) {
        byCategory[item.category] = [];
      }
      byCategory[item.category]!.push(item);
    }

    return NextResponse.json({
      items: items as BeginnersDictionaryItem[],
      byCategory,
      stats,
    });
  } catch (err) {
    console.error("Admin beginners API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/beginners
 * 새 beginners dictionary 항목 추가
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();

    const body = await request.json();
    const {
      slug,
      name,
      category,
      command_syntax,
      what_it_does,
      for_beginners,
      related_slugs,
      related_changelog_slugs,
      official_doc_url,
      is_featured,
    } = body;

    if (!slug || !name || !category || !for_beginners) {
      return NextResponse.json(
        { error: "slug, name, category, and for_beginners are required" },
        { status: 400 }
      );
    }

    const { data: newItem, error: insertError } = await supabase
      .from("beginners_dictionary")
      .insert({
        slug,
        name,
        category,
        command_syntax,
        what_it_does,
        for_beginners,
        related_slugs,
        related_changelog_slugs,
        official_doc_url,
        is_featured: is_featured || false,
        verification_status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to create item:", insertError);
      return NextResponse.json({ error: "Failed to create item" }, { status: 500 });
    }

    return NextResponse.json({ item: newItem as BeginnersDictionaryItem }, { status: 201 });
  } catch (err) {
    console.error("Admin beginners POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/beginners
 * beginners dictionary 항목 일괄 업데이트
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = createServiceClient();

    const body = await request.json();
    const { ids, updates } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids array is required" }, { status: 400 });
    }

    // 허용된 필드만 업데이트
    const allowedFields = [
      "verification_status",
      "verification_confidence",
      "is_featured",
      "display_order",
      "for_beginners",
      "what_it_does",
      "command_syntax",
    ];

    const filteredUpdates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in updates) {
        filteredUpdates[field] = updates[field];
      }
    }

    const { data: updatedItems, error: updateError } = await supabase
      .from("beginners_dictionary")
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
    console.error("Admin beginners PATCH error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
