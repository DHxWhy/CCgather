import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { BeginnersDictionaryItem } from "@/types/changelog";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * GET /api/news/beginners/[slug]
 * FOR BEGINNERS 사전 - 특정 항목 상세
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { slug } = await params;

  if (!slug) {
    return NextResponse.json({ error: "Slug parameter is required" }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    // 항목 조회
    const { data: item, error: itemError } = await supabase
      .from("beginners_dictionary")
      .select("*")
      .eq("slug", slug)
      .eq("verification_status", "approved")
      .single();

    if (itemError || !item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // 인기도 증가 (비동기, 에러 무시)
    supabase
      .from("beginners_dictionary")
      .update({ popularity_score: (item.popularity_score || 0) + 1 })
      .eq("id", item.id)
      .then(() => {});

    // 연관 항목 조회
    let relatedItems: BeginnersDictionaryItem[] = [];
    if (item.related_slugs && item.related_slugs.length > 0) {
      const { data: related } = await supabase
        .from("beginners_dictionary")
        .select("*")
        .in("slug", item.related_slugs)
        .eq("verification_status", "approved")
        .limit(5);

      if (related) {
        relatedItems = related as BeginnersDictionaryItem[];
      }
    }

    // 연관 changelog 항목 조회
    let relatedChangelog: { slug: string; title: string; version?: string }[] = [];
    if (item.related_changelog_slugs && item.related_changelog_slugs.length > 0) {
      const { data: changelog } = await supabase
        .from("changelog_items")
        .select("slug, title")
        .in("slug", item.related_changelog_slugs)
        .eq("verification_status", "approved")
        .limit(5);

      if (changelog) {
        relatedChangelog = changelog;
      }
    }

    return NextResponse.json({
      item: item as BeginnersDictionaryItem,
      relatedItems,
      relatedChangelog,
    });
  } catch (err) {
    console.error("Beginners detail API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
