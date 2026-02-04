/**
 * Admin Analytics Failed Attempts API
 * CLI 실행 실패 로그 조회
 */

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/server";

interface FailedAttemptRow {
  id: string;
  user_id: string | null;
  username: string | null;
  avatar_url: string | null;
  reason: string;
  cli_version: string | null;
  platform: string | null;
  debug_info: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export async function GET(request: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "50");
    const search = searchParams.get("search") || "";
    const reason = searchParams.get("reason") || "";
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";

    const supabase = await createServiceClient();
    const offset = (page - 1) * pageSize;

    // 기본 날짜 범위: 최근 30일
    const defaultEndDate = new Date();
    const defaultStartDate = new Date();
    defaultStartDate.setDate(defaultStartDate.getDate() - 30);

    const effectiveStartDate = startDate || defaultStartDate.toISOString();
    const effectiveEndDate = endDate || defaultEndDate.toISOString();

    // 실패 로그 조회 - users 테이블과 LEFT JOIN
    let query = supabase
      .from("cli_submit_attempts")
      .select(
        `
        id,
        user_id,
        reason,
        cli_version,
        platform,
        debug_info,
        ip_address,
        created_at,
        users (
          username,
          avatar_url
        )
      `,
        { count: "exact" }
      )
      .gte("created_at", effectiveStartDate)
      .lte("created_at", effectiveEndDate)
      .order("created_at", { ascending: false });

    // reason 필터
    if (reason) {
      query = query.eq("reason", reason);
    }

    // 페이지네이션
    query = query.range(offset, offset + pageSize - 1);

    const { data: rawLogs, error, count } = await query;

    if (error) {
      console.error("[Failed Attempts] Query error:", error);
      return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
    }

    // 데이터 형식 변환
    type RawLogItem = {
      id: string;
      user_id: string | null;
      reason: string;
      cli_version: string | null;
      platform: string | null;
      debug_info: Record<string, unknown> | null;
      ip_address: string | null;
      created_at: string;
      users: {
        username: string;
        avatar_url: string | null;
      } | null;
    };

    let logs: FailedAttemptRow[] =
      (rawLogs as RawLogItem[])?.map((row) => ({
        id: row.id,
        user_id: row.user_id,
        username: row.users?.username || null,
        avatar_url: row.users?.avatar_url || null,
        reason: row.reason,
        cli_version: row.cli_version,
        platform: row.platform,
        debug_info: row.debug_info,
        ip_address: row.ip_address,
        created_at: row.created_at,
      })) || [];

    // 검색 필터 (클라이언트 측 - username, ip 검색)
    if (search) {
      const searchLower = search.toLowerCase();
      logs = logs.filter(
        (log) =>
          log.username?.toLowerCase().includes(searchLower) ||
          log.ip_address?.toLowerCase().includes(searchLower)
      );
    }

    const totalCount = search ? logs.length : count || 0;

    // reason 별 통계
    const { data: reasonStats } = await supabase
      .from("cli_submit_attempts")
      .select("reason")
      .gte("created_at", effectiveStartDate)
      .lte("created_at", effectiveEndDate);

    const reasonCounts: Record<string, number> = {};
    reasonStats?.forEach((item: { reason: string }) => {
      reasonCounts[item.reason] = (reasonCounts[item.reason] || 0) + 1;
    });

    return NextResponse.json({
      logs,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
      },
      filters: {
        startDate: effectiveStartDate,
        endDate: effectiveEndDate,
        search: search || null,
        reason: reason || null,
      },
      stats: {
        byReason: reasonCounts,
        total: Object.values(reasonCounts).reduce((a, b) => a + b, 0),
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Failed Attempts] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
