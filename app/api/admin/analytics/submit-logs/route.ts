/**
 * Admin Analytics Submit Logs API
 * 제출 로그 조회 (제출 1회당 1건)
 */

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/guard";
import { createServiceClient } from "@/lib/supabase/server";

interface SubmitLogRow {
  submitted_at: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  ccplan: string | null;
  days_count: number;
  date_from: string;
  date_to: string;
  total_tokens: number;
  total_cost: number;
  submission_source: string;
  primary_model: string | null;
  // League placement audit
  league_reason: string | null;
  league_reason_details: string | null;
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
    const source = searchParams.get("source") || "";
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";

    const supabase = createServiceClient();
    const offset = (page - 1) * pageSize;

    // 기본 날짜 범위: 최근 30일
    const defaultEndDate = new Date();
    const defaultStartDate = new Date();
    defaultStartDate.setDate(defaultStartDate.getDate() - 30);

    const effectiveStartDate = startDate || defaultStartDate.toISOString();
    const effectiveEndDate = endDate || defaultEndDate.toISOString();

    // 제출 로그 조회 쿼리 (submitted_at 기준 그룹핑)
    // Supabase는 GROUP BY를 직접 지원하지 않으므로 RPC 또는 raw SQL 사용
    const { data: logs, error: logsError } = await supabase.rpc("get_submit_logs", {
      p_start_date: effectiveStartDate,
      p_end_date: effectiveEndDate,
      p_search: search || null,
      p_source: source || null,
      p_limit: pageSize,
      p_offset: offset,
    });

    if (logsError) {
      // RPC가 없으면 대체 쿼리 사용
      console.log("[Submit Logs] RPC not found, using fallback query");

      // Fallback: 개별 쿼리로 처리
      const { data: rawLogs, error: rawError } = await supabase
        .from("usage_stats")
        .select(
          `
          submitted_at,
          user_id,
          date,
          total_tokens,
          cost_usd,
          submission_source,
          primary_model,
          league_reason,
          league_reason_details,
          users!inner (
            username,
            avatar_url,
            ccplan
          )
        `
        )
        .gte("submitted_at", effectiveStartDate)
        .lte("submitted_at", effectiveEndDate)
        .order("submitted_at", { ascending: false });

      if (rawError) {
        console.error("[Submit Logs] Query error:", rawError);
        return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
      }

      // 클라이언트 측 그룹핑 (submitted_at 기준)
      const groupedLogs = new Map<
        string,
        {
          submitted_at: string;
          user_id: string;
          username: string;
          avatar_url: string | null;
          ccplan: string | null;
          dates: Set<string>;
          total_tokens: number;
          total_cost: number;
          submission_source: string;
          primary_model: string | null;
          league_reason: string | null;
          league_reason_details: string | null;
        }
      >();

      type RawLogItem = {
        submitted_at: string;
        user_id: string;
        date: string;
        total_tokens: number;
        cost_usd: number;
        submission_source: string;
        league_reason: string | null;
        league_reason_details: string | null;
        primary_model: string | null;
        users: {
          username: string;
          avatar_url: string | null;
          ccplan: string | null;
        };
      };

      (rawLogs as RawLogItem[])?.forEach((row) => {
        const key = `${row.submitted_at}_${row.user_id}`;

        if (!groupedLogs.has(key)) {
          groupedLogs.set(key, {
            submitted_at: row.submitted_at,
            user_id: row.user_id,
            username: row.users.username,
            avatar_url: row.users.avatar_url,
            ccplan: row.users.ccplan,
            dates: new Set([row.date]),
            total_tokens: row.total_tokens,
            total_cost: row.cost_usd,
            submission_source: row.submission_source,
            primary_model: row.primary_model,
            league_reason: row.league_reason,
            league_reason_details: row.league_reason_details,
          });
        } else {
          const existing = groupedLogs.get(key)!;
          existing.dates.add(row.date);
          existing.total_tokens += row.total_tokens;
          existing.total_cost += row.cost_usd;
          if (row.primary_model && !existing.primary_model) {
            existing.primary_model = row.primary_model;
          }
          // Keep first league_reason (they should be same for same submission)
          if (row.league_reason && !existing.league_reason) {
            existing.league_reason = row.league_reason;
            existing.league_reason_details = row.league_reason_details;
          }
        }
      });

      // 필터링 적용
      let filteredLogs = Array.from(groupedLogs.values());

      if (search) {
        const searchLower = search.toLowerCase();
        filteredLogs = filteredLogs.filter((log) =>
          log.username.toLowerCase().includes(searchLower)
        );
      }

      if (source) {
        filteredLogs = filteredLogs.filter((log) => log.submission_source === source);
      }

      // 정렬 및 페이지네이션
      filteredLogs.sort(
        (a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
      );

      const totalCount = filteredLogs.length;
      const paginatedLogs = filteredLogs.slice(offset, offset + pageSize);

      // 응답 형식 변환
      const formattedLogs: SubmitLogRow[] = paginatedLogs.map((log) => {
        const sortedDates = Array.from(log.dates).sort();
        const firstDate = sortedDates[0] || "";
        const lastDate = sortedDates[sortedDates.length - 1] || firstDate;
        return {
          submitted_at: log.submitted_at,
          user_id: log.user_id,
          username: log.username,
          avatar_url: log.avatar_url,
          ccplan: log.ccplan,
          days_count: log.dates.size,
          date_from: firstDate,
          date_to: lastDate,
          total_tokens: log.total_tokens,
          total_cost: log.total_cost,
          submission_source: log.submission_source,
          primary_model: log.primary_model,
          league_reason: log.league_reason,
          league_reason_details: log.league_reason_details,
        };
      });

      return NextResponse.json({
        logs: formattedLogs,
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
          source: source || null,
        },
        generatedAt: new Date().toISOString(),
      });
    }

    // RPC 성공 시 응답
    return NextResponse.json({
      logs: logs || [],
      pagination: {
        page,
        pageSize,
        totalCount: logs?.length || 0,
        totalPages: Math.ceil((logs?.length || 0) / pageSize),
      },
      filters: {
        startDate: effectiveStartDate,
        endDate: effectiveEndDate,
        search: search || null,
        source: source || null,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Submit Logs] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
