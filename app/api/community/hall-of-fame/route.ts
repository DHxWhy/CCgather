import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// =====================================================
// Types
// =====================================================

type TimePeriod = "today" | "weekly" | "monthly";

interface HallOfFameEntry {
  id: string;
  postId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  count: number;
}

interface PostWithUser {
  id: string;
  likes_count: number;
  comments_count: number;
  author_id: string;
  users: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

// =====================================================
// Helper: Get date range for period
// =====================================================

function getDateRange(period: TimePeriod): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString();

  let start: Date;

  switch (period) {
    case "today":
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
      break;
    case "weekly":
      start = new Date(now);
      start.setDate(now.getDate() - 7);
      break;
    case "monthly":
      start = new Date(now);
      start.setMonth(now.getMonth() - 1);
      break;
    default:
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
  }

  return { start: start.toISOString(), end };
}

// =====================================================
// GET /api/community/hall-of-fame - 명예의 전당 데이터 조회
// =====================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = (searchParams.get("period") as TimePeriod) || "today";

    // Validate period
    if (!["today", "weekly", "monthly"].includes(period)) {
      return NextResponse.json({ error: "Invalid period" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { start, end } = getDateRange(period);

    // Fetch most liked posts
    const { data: mostLikedPosts, error: likedError } = await supabase
      .from("posts")
      .select(
        `
        id,
        likes_count,
        author_id,
        users!posts_author_id_fkey (
          id,
          username,
          display_name,
          avatar_url
        )
      `
      )
      .is("deleted_at", null)
      .gte("created_at", start)
      .lte("created_at", end)
      .gt("likes_count", 0)
      .order("likes_count", { ascending: false })
      .limit(3);

    if (likedError) {
      console.error("Error fetching most liked posts:", likedError);
      return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
    }

    // Fetch most replied posts
    const { data: mostRepliedPosts, error: repliedError } = await supabase
      .from("posts")
      .select(
        `
        id,
        comments_count,
        author_id,
        users!posts_author_id_fkey (
          id,
          username,
          display_name,
          avatar_url
        )
      `
      )
      .is("deleted_at", null)
      .gte("created_at", start)
      .lte("created_at", end)
      .gt("comments_count", 0)
      .order("comments_count", { ascending: false })
      .limit(3);

    if (repliedError) {
      console.error("Error fetching most replied posts:", repliedError);
      return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
    }

    // Transform to HallOfFameEntry format
    const mostLiked: HallOfFameEntry[] = ((mostLikedPosts || []) as PostWithUser[]).map((post) => {
      return {
        id: `liked-${post.id}`,
        postId: post.id,
        userId: post.users?.id || post.author_id,
        userName: post.users?.display_name || post.users?.username || "Unknown",
        userAvatar: post.users?.avatar_url || undefined,
        count: post.likes_count,
      };
    });

    const mostReplied: HallOfFameEntry[] = ((mostRepliedPosts || []) as PostWithUser[]).map(
      (post) => {
        return {
          id: `replied-${post.id}`,
          postId: post.id,
          userId: post.users?.id || post.author_id,
          userName: post.users?.display_name || post.users?.username || "Unknown",
          userAvatar: post.users?.avatar_url || undefined,
          count: post.comments_count,
        };
      }
    );

    return NextResponse.json({
      mostLiked,
      mostReplied,
      period,
    });
  } catch (error) {
    console.error("Error in GET /api/community/hall-of-fame:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
