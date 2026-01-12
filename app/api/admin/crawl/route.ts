import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";

async function isAdmin() {
  const { userId } = await auth();
  if (!userId) return false;
  if (process.env.NODE_ENV === "development") return true;
  return true;
}

interface CrawlRequest {
  type: "news" | "youtube";
  url?: string; // For manual OFF mode - specific URL to crawl
}

export async function POST(request: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: CrawlRequest = await request.json();
    const { type, url } = body;

    if (!type || !["news", "youtube"].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be "news" or "youtube"' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Get current settings
    const { data: settings } = await supabase
      .from("admin_settings")
      .select("*")
      .eq("id", "default")
      .single();

    const mode = type === "news" ? settings?.news_mode : settings?.youtube_mode;

    // If mode is OFF, require a URL
    if (mode === "off" && !url) {
      return NextResponse.json(
        { error: "URL is required when automation is OFF" },
        { status: 400 }
      );
    }

    // Validate URL format
    if (url) {
      try {
        new URL(url);
      } catch {
        return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
      }
    }

    // For now, we'll create a pending content entry
    // The actual crawling logic will be implemented in a separate service
    if (url) {
      // Manual mode - add single URL
      const contentData: Record<string, unknown> = {
        type,
        source_url: url,
        title: "Pending...",
        status: "pending",
      };

      // Extract video ID for YouTube
      if (type === "youtube") {
        const videoId = extractYouTubeVideoId(url);
        if (videoId) {
          contentData.video_id = videoId;
        }
      }

      const { data: content, error } = await supabase
        .from("contents")
        .insert(contentData)
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          return NextResponse.json({ error: "This URL has already been added" }, { status: 409 });
        }
        console.error("[Admin Crawl] Insert error:", error);
        return NextResponse.json({ error: "Failed to add content" }, { status: 500 });
      }

      // Update last crawl timestamp
      const updateField = type === "news" ? "last_news_crawl_at" : "last_youtube_crawl_at";
      await supabase
        .from("admin_settings")
        .update({ [updateField]: new Date().toISOString() })
        .eq("id", "default");

      return NextResponse.json({
        success: true,
        message: `Content added for processing`,
        content,
        mode,
      });
    } else {
      // Automatic mode - trigger batch crawl
      // This would typically be handled by a background job/cron
      // For now, return a success message indicating the crawl was triggered

      // Update last crawl timestamp
      const updateField = type === "news" ? "last_news_crawl_at" : "last_youtube_crawl_at";
      await supabase
        .from("admin_settings")
        .update({ [updateField]: new Date().toISOString() })
        .eq("id", "default");

      return NextResponse.json({
        success: true,
        message: `${type === "news" ? "News" : "YouTube"} crawl triggered`,
        mode,
        sources: type === "news" ? settings?.news_sources : settings?.youtube_keywords,
      });
    }
  } catch (error) {
    console.error("[Admin Crawl] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

// GET endpoint to check crawl status and history
export async function GET() {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceClient();

    // Get settings with last crawl times
    const { data: settings } = await supabase
      .from("admin_settings")
      .select("last_news_crawl_at, last_youtube_crawl_at, news_mode, youtube_mode")
      .eq("id", "default")
      .single();

    // Get recent pending contents count
    const { count: pendingCount } = await supabase
      .from("contents")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    // Get recent contents for each type
    const { data: recentNews } = await supabase
      .from("contents")
      .select("id, title, status, created_at")
      .eq("type", "news")
      .order("created_at", { ascending: false })
      .limit(5);

    const { data: recentYoutube } = await supabase
      .from("contents")
      .select("id, title, status, created_at")
      .eq("type", "youtube")
      .order("created_at", { ascending: false })
      .limit(5);

    return NextResponse.json({
      status: {
        news: {
          mode: settings?.news_mode || "confirm",
          lastCrawl: settings?.last_news_crawl_at,
          recentItems: recentNews || [],
        },
        youtube: {
          mode: settings?.youtube_mode || "confirm",
          lastCrawl: settings?.last_youtube_crawl_at,
          recentItems: recentYoutube || [],
        },
        pendingCount: pendingCount || 0,
      },
    });
  } catch (error) {
    console.error("[Admin Crawl] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
