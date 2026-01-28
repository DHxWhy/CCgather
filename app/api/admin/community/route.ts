import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";

// =====================================================
// Admin guard helper
// =====================================================
async function verifyAdmin() {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return { error: "Unauthorized", status: 401 };
  }

  const supabase = createServiceClient();
  const { data: user } = await supabase
    .from("users")
    .select("id, is_admin")
    .eq("clerk_id", clerkId)
    .single();

  if (!user || !user.is_admin) {
    return { error: "Forbidden", status: 403 };
  }

  return { user, supabase };
}

// =====================================================
// GET /api/admin/community - 커뮤니티 관리 대시보드 데이터
// =====================================================
export async function GET(request: NextRequest) {
  try {
    const adminCheck = await verifyAdmin();
    if ("error" in adminCheck) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
    }
    const { supabase } = adminCheck;

    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view") || "overview"; // overview, posts, comments, deletions
    const includeDeleted = searchParams.get("includeDeleted") === "true";
    const search = searchParams.get("search") || "";
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    // ========== OVERVIEW ==========
    if (view === "overview") {
      // Get stats
      const [postsResult, commentsResult, deletionsResult] = await Promise.all([
        supabase.from("posts").select("id", { count: "exact", head: true }).is("deleted_at", null),
        supabase
          .from("comments")
          .select("id", { count: "exact", head: true })
          .is("deleted_at", null),
        supabase
          .from("content_deletion_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      // Get today's posts count
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count: todayPosts } = await supabase
        .from("posts")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .gte("created_at", today.toISOString());

      // Get deleted posts/comments count (pending hard delete)
      const { count: deletedPosts } = await supabase
        .from("posts")
        .select("id", { count: "exact", head: true })
        .not("deleted_at", "is", null);

      const { count: deletedComments } = await supabase
        .from("comments")
        .select("id", { count: "exact", head: true })
        .not("deleted_at", "is", null);

      return NextResponse.json({
        stats: {
          totalPosts: postsResult.count || 0,
          totalComments: commentsResult.count || 0,
          todayPosts: todayPosts || 0,
          deletedPosts: deletedPosts || 0,
          deletedComments: deletedComments || 0,
        },
        recentDeletions: deletionsResult.data || [],
      });
    }

    // ========== POSTS LIST ==========
    if (view === "posts") {
      let query = supabase
        .from("posts")
        .select(
          `
          id,
          content,
          tab,
          likes_count,
          comments_count,
          created_at,
          deleted_at,
          author:users!author_id (
            id,
            username,
            display_name,
            avatar_url
          )
        `,
          { count: "exact" }
        )
        .order("created_at", { ascending: false });

      // Filter by deleted status
      if (!includeDeleted) {
        query = query.is("deleted_at", null);
      }

      // Search in content
      if (search) {
        query = query.ilike("content", `%${search}%`);
      }

      const { data: posts, count, error } = await query.range(offset, offset + limit - 1);

      if (error) {
        console.error("Error fetching posts:", error);
        return NextResponse.json({ error: "Failed to fetch posts" }, { status: 500 });
      }

      return NextResponse.json({
        posts: posts || [],
        total: count || 0,
        hasMore: offset + limit < (count || 0),
      });
    }

    // ========== COMMENTS LIST ==========
    if (view === "comments") {
      let query = supabase
        .from("comments")
        .select(
          `
          id,
          content,
          post_id,
          parent_comment_id,
          likes_count,
          created_at,
          deleted_at,
          author:users!author_id (
            id,
            username,
            display_name,
            avatar_url
          )
        `,
          { count: "exact" }
        )
        .order("created_at", { ascending: false });

      if (!includeDeleted) {
        query = query.is("deleted_at", null);
      }

      if (search) {
        query = query.ilike("content", `%${search}%`);
      }

      const { data: comments, count, error } = await query.range(offset, offset + limit - 1);

      if (error) {
        console.error("Error fetching comments:", error);
        return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
      }

      return NextResponse.json({
        comments: comments || [],
        total: count || 0,
        hasMore: offset + limit < (count || 0),
      });
    }

    // ========== DELETION LOGS ==========
    if (view === "deletions") {
      const {
        data: deletions,
        count,
        error,
      } = await supabase
        .from("content_deletion_logs")
        .select(
          `
          *,
          deleted_by_user:users!deleted_by (
            id,
            username,
            display_name
          )
        `,
          { count: "exact" }
        )
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error("Error fetching deletion logs:", error);
        return NextResponse.json({ error: "Failed to fetch deletion logs" }, { status: 500 });
      }

      return NextResponse.json({
        deletions: deletions || [],
        total: count || 0,
        hasMore: offset + limit < (count || 0),
      });
    }

    return NextResponse.json({ error: "Invalid view parameter" }, { status: 400 });
  } catch (error) {
    console.error("Error in GET /api/admin/community:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
