import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ChangelogDetailResponse, ChangelogVersion, ChangelogItem } from "@/types/changelog";

interface RouteParams {
  params: Promise<{ version: string }>;
}

/**
 * GET /api/news/changelog/[version]
 * 특정 버전의 상세 정보 및 변경 항목 조회
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { version } = await params;

  if (!version) {
    return NextResponse.json({ error: "Version parameter is required" }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    // version_slug로 버전 조회 (v2-1-0 형식)
    const { data: versionData, error: versionError } = await supabase
      .from("changelog_versions")
      .select("*")
      .eq("version_slug", version)
      .single();

    if (versionError || !versionData) {
      // version 번호로도 시도 (2.1.0 형식)
      const { data: versionByNumber, error: numberError } = await supabase
        .from("changelog_versions")
        .select("*")
        .eq("version", version.replace(/^v/, "").replace(/-/g, "."))
        .single();

      if (numberError || !versionByNumber) {
        return NextResponse.json({ error: "Version not found" }, { status: 404 });
      }

      // 해당 버전의 items 조회
      const { data: items, error: itemsError } = await supabase
        .from("changelog_items")
        .select("*")
        .eq("version_id", versionByNumber.id)
        .eq("verification_status", "approved")
        .order("display_order", { ascending: true });

      if (itemsError) {
        console.error("Failed to fetch changelog items:", itemsError);
        return NextResponse.json({ error: "Failed to fetch changelog items" }, { status: 500 });
      }

      const highlights = (items || []).filter((item: ChangelogItem) => item.is_highlight);

      const response: ChangelogDetailResponse = {
        version: versionByNumber as ChangelogVersion,
        items: (items || []) as ChangelogItem[],
        highlights,
      };

      return NextResponse.json(response);
    }

    // 해당 버전의 items 조회
    const { data: items, error: itemsError } = await supabase
      .from("changelog_items")
      .select("*")
      .eq("version_id", versionData.id)
      .eq("verification_status", "approved")
      .order("display_order", { ascending: true });

    if (itemsError) {
      console.error("Failed to fetch changelog items:", itemsError);
      return NextResponse.json({ error: "Failed to fetch changelog items" }, { status: 500 });
    }

    const highlights = (items || []).filter((item: ChangelogItem) => item.is_highlight);

    const response: ChangelogDetailResponse = {
      version: versionData as ChangelogVersion,
      items: (items || []) as ChangelogItem[],
      highlights,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("Changelog detail API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
