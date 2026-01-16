import { NextResponse } from "next/server";
import { checkAdminAccess } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    if (!(await checkAdminAccess())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();
    const startTime = Date.now();

    // DB 연결 테스트
    const { error: dbError } = await supabase.from("users").select("id").limit(1);

    const dbResponseTime = Date.now() - startTime;

    // 통계
    const { count: userCount } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true });

    const { count: contentCount } = await supabase
      .from("contents")
      .select("*", { count: "exact", head: true });

    // 크롤러 상태
    const { data: settings } = await supabase
      .from("admin_settings")
      .select("*")
      .eq("id", "default")
      .single();

    return NextResponse.json({
      database: {
        status: dbError ? "error" : "healthy",
        responseTime: dbResponseTime,
      },
      stats: {
        users: userCount || 0,
        contents: contentCount || 0,
      },
      crawler: {
        newsMode: settings?.news_mode || "off",
        youtubeMode: settings?.youtube_mode || "off",
        lastNewsCrawl: settings?.last_news_crawl_at,
        lastYoutubeCrawl: settings?.last_youtube_crawl_at,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[System Status] Error:", error);
    return NextResponse.json({ error: "Failed to fetch system status" }, { status: 500 });
  }
}
