import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { GuideDetailResponse, ChangelogItem, ChangelogVersion } from "@/types/changelog";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * GET /api/news/guides/[slug]
 * 특정 가이드(changelog item)의 상세 정보 조회
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { slug } = await params;

  if (!slug) {
    return NextResponse.json({ error: "Slug parameter is required" }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    // 가이드 항목 조회
    const { data: item, error: itemError } = await supabase
      .from("changelog_items")
      .select("*")
      .eq("slug", slug)
      .eq("verification_status", "approved")
      .single();

    if (itemError || !item) {
      return NextResponse.json({ error: "Guide not found" }, { status: 404 });
    }

    // 해당 버전 정보 조회
    const { data: version, error: versionError } = await supabase
      .from("changelog_versions")
      .select("*")
      .eq("id", item.version_id)
      .single();

    if (versionError) {
      console.error("Failed to fetch version:", versionError);
    }

    // 연관 항목 조회 (related_slugs 기반)
    let relatedItems: ChangelogItem[] = [];
    if (item.related_slugs && item.related_slugs.length > 0) {
      const { data: related, error: relatedError } = await supabase
        .from("changelog_items")
        .select("*")
        .in("slug", item.related_slugs)
        .eq("verification_status", "approved")
        .limit(5);

      if (!relatedError && related) {
        relatedItems = related as ChangelogItem[];
      }
    }

    const response: GuideDetailResponse = {
      item: {
        ...item,
        version: version as ChangelogVersion,
      },
      relatedItems,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("Guide detail API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
