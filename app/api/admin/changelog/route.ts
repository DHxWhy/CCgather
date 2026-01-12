import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import type { ChangelogVersion, ChangelogItem } from "@/types/changelog";

interface ChangelogItemRow {
  verification_status: string;
}

/**
 * GET /api/admin/changelog
 * Admin용 changelog 관리 - 전체 버전 및 항목 조회 (검증 상태 포함)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get("status"); // "all" | "pending" | "approved" | "rejected"

  try {
    const supabase = createServiceClient();

    // 버전 목록 조회
    const { data: versions, error: versionsError } = await supabase
      .from("changelog_versions")
      .select("*")
      .order("version", { ascending: false });

    if (versionsError) {
      return NextResponse.json({ error: "Failed to fetch versions" }, { status: 500 });
    }

    // 항목 조회 (상태 필터 적용)
    let itemsQuery = supabase
      .from("changelog_items")
      .select("*")
      .order("created_at", { ascending: false });

    if (status && status !== "all") {
      itemsQuery = itemsQuery.eq("verification_status", status);
    }

    const { data: items, error: itemsError } = await itemsQuery;

    if (itemsError) {
      return NextResponse.json({ error: "Failed to fetch items" }, { status: 500 });
    }

    // 통계 계산
    const stats = {
      total_versions: (versions || []).length,
      total_items: (items || []).length,
      pending_items: (items || []).filter(
        (i: ChangelogItemRow) => i.verification_status === "pending"
      ).length,
      approved_items: (items || []).filter(
        (i: ChangelogItemRow) => i.verification_status === "approved"
      ).length,
      rejected_items: (items || []).filter(
        (i: ChangelogItemRow) => i.verification_status === "rejected"
      ).length,
    };

    return NextResponse.json({
      versions: versions as ChangelogVersion[],
      items: items as ChangelogItem[],
      stats,
    });
  } catch (err) {
    console.error("Admin changelog API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/changelog
 * 새 버전 추가
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();

    const body = await request.json();
    const { version, official_url, release_type } = body;

    if (!version) {
      return NextResponse.json({ error: "Version is required" }, { status: 400 });
    }

    // version_slug 생성 (2.1.0 -> v2-1-0)
    const version_slug = `v${version.replace(/\./g, "-")}`;

    const { data: newVersion, error: insertError } = await supabase
      .from("changelog_versions")
      .insert({
        version,
        version_slug,
        official_url,
        release_type,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to create version:", insertError);
      return NextResponse.json({ error: "Failed to create version" }, { status: 500 });
    }

    return NextResponse.json({ version: newVersion }, { status: 201 });
  } catch (err) {
    console.error("Admin changelog POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
