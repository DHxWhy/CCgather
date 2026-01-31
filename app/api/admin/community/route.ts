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
    const view = searchParams.get("view") || "overview"; // overview, posts, comments, deletions, timeline
    const includeDeleted = searchParams.get("includeDeleted") === "true";
    const search = searchParams.get("search") || "";
    const typeFilter = searchParams.get("type") || "all"; // all, post, comment, deletion
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    // ========== OVERVIEW ==========
    if (view === "overview") {
      // Primary: community_stats 테이블에서 통계 조회 + 삭제 대기 항목
      const [statsResult, deletedResult, deletionsResult] = await Promise.all([
        // 1. community_stats 테이블에서 캐시된 통계 조회
        supabase
          .from("community_stats")
          .select("total_posts, total_comments, today_posts, today_date")
          .eq("id", "global")
          .single(),

        // 2. 삭제 대기 항목 (실시간 조회 필요)
        Promise.all([
          supabase
            .from("posts")
            .select("id", { count: "exact", head: true })
            .not("deleted_at", "is", null),
          supabase
            .from("comments")
            .select("id", { count: "exact", head: true })
            .not("deleted_at", "is", null),
        ]),

        // 3. 최근 삭제 기록
        supabase
          .from("content_deletion_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      // community_stats에서 통계 추출 (날짜가 다르면 today_posts는 0)
      const statsData = statsResult.data;
      const todayStr = new Date().toISOString().split("T")[0];
      const isSameDay = statsData?.today_date === todayStr;

      let totalPosts = statsData?.total_posts || 0;
      let totalComments = statsData?.total_comments || 0;
      let todayPosts = isSameDay ? statsData?.today_posts || 0 : 0;

      // Fallback: community_stats 테이블 조회 실패 시
      if (statsResult.error) {
        console.warn("community_stats query failed, using fallback:", statsResult.error.message);
        const [postsCount, commentsCount, todayCount] = await Promise.all([
          supabase
            .from("posts")
            .select("id", { count: "exact", head: true })
            .is("deleted_at", null),
          supabase
            .from("comments")
            .select("id", { count: "exact", head: true })
            .is("deleted_at", null),
          supabase
            .from("posts")
            .select("id", { count: "exact", head: true })
            .is("deleted_at", null)
            .gte("created_at", new Date().toISOString().split("T")[0]),
        ]);
        totalPosts = postsCount.count || 0;
        totalComments = commentsCount.count || 0;
        todayPosts = todayCount.count || 0;
      }

      return NextResponse.json({
        stats: {
          totalPosts,
          totalComments,
          todayPosts,
          deletedPosts: deletedResult[0].count || 0,
          deletedComments: deletedResult[1].count || 0,
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

    // ========== TIMELINE VIEW (통합 타임라인) ==========
    if (view === "timeline") {
      // Fetch posts, comments, and deletions, then merge and sort by time
      const shouldFetchPosts = typeFilter === "all" || typeFilter === "post";
      const shouldFetchComments = typeFilter === "all" || typeFilter === "comment";
      const shouldFetchDeletions = typeFilter === "all" || typeFilter === "deletion";

      interface TimelineItem {
        type: "post" | "comment" | "deletion";
        id: string;
        content: string;
        created_at: string;
        deleted_at: string | null;
        author: {
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
        } | null;
        extra: Record<string, unknown>;
      }

      const timelineItems: TimelineItem[] = [];

      // Build search filter for content or username
      const hasSearch = search.trim().length > 0;

      // Fetch posts
      if (shouldFetchPosts) {
        let postsQuery = supabase
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
          `
          )
          .order("created_at", { ascending: false })
          .limit(hasSearch ? 100 : limit);

        if (!includeDeleted) {
          postsQuery = postsQuery.is("deleted_at", null);
        }

        const { data: posts } = await postsQuery;

        if (posts) {
          for (const post of posts) {
            const author = post.author as TimelineItem["author"];
            // Filter by search (content or username)
            if (hasSearch) {
              const matchesContent = post.content.toLowerCase().includes(search.toLowerCase());
              const matchesUsername =
                author?.username?.toLowerCase().includes(search.toLowerCase()) || false;
              const matchesDisplayName =
                author?.display_name?.toLowerCase().includes(search.toLowerCase()) || false;
              if (!matchesContent && !matchesUsername && !matchesDisplayName) continue;
            }

            timelineItems.push({
              type: "post",
              id: post.id,
              content: post.content,
              created_at: post.created_at,
              deleted_at: post.deleted_at,
              author,
              extra: {
                tab: post.tab,
                likes_count: post.likes_count,
                comments_count: post.comments_count,
              },
            });
          }
        }
      }

      // Fetch comments
      if (shouldFetchComments) {
        let commentsQuery = supabase
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
          `
          )
          .order("created_at", { ascending: false })
          .limit(hasSearch ? 100 : limit);

        if (!includeDeleted) {
          commentsQuery = commentsQuery.is("deleted_at", null);
        }

        const { data: comments } = await commentsQuery;

        if (comments) {
          for (const comment of comments) {
            const author = comment.author as TimelineItem["author"];
            if (hasSearch) {
              const matchesContent = comment.content.toLowerCase().includes(search.toLowerCase());
              const matchesUsername =
                author?.username?.toLowerCase().includes(search.toLowerCase()) || false;
              const matchesDisplayName =
                author?.display_name?.toLowerCase().includes(search.toLowerCase()) || false;
              if (!matchesContent && !matchesUsername && !matchesDisplayName) continue;
            }

            timelineItems.push({
              type: "comment",
              id: comment.id,
              content: comment.content,
              created_at: comment.created_at,
              deleted_at: comment.deleted_at,
              author,
              extra: {
                post_id: comment.post_id,
                parent_comment_id: comment.parent_comment_id,
                likes_count: comment.likes_count,
              },
            });
          }
        }
      }

      // Fetch deletions
      if (shouldFetchDeletions) {
        const { data: deletions } = await supabase
          .from("content_deletion_logs")
          .select(
            `
            *,
            deleted_by_user:users!deleted_by (
              id,
              username,
              display_name,
              avatar_url
            )
          `
          )
          .order("created_at", { ascending: false })
          .limit(hasSearch ? 100 : limit);

        if (deletions) {
          for (const log of deletions) {
            const deletedByUser = log.deleted_by_user as TimelineItem["author"];
            if (hasSearch) {
              const matchesContent =
                log.content_snapshot?.content?.toLowerCase().includes(search.toLowerCase()) ||
                false;
              const matchesUsername =
                deletedByUser?.username?.toLowerCase().includes(search.toLowerCase()) || false;
              if (!matchesContent && !matchesUsername) continue;
            }

            timelineItems.push({
              type: "deletion",
              id: log.id,
              content: log.content_snapshot?.content || "[삭제된 컨텐츠]",
              created_at: log.created_at,
              deleted_at: null,
              author: deletedByUser,
              extra: {
                content_type: log.content_type,
                deleted_by_role: log.deleted_by_role,
                cascade_deleted_comments: log.cascade_deleted_comments,
                cascade_deleted_replies: log.cascade_deleted_replies,
                reason: log.reason,
                content_snapshot: log.content_snapshot,
              },
            });
          }
        }
      }

      // Sort by created_at descending
      timelineItems.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // Apply pagination
      const paginatedItems = timelineItems.slice(offset, offset + limit);

      return NextResponse.json({
        timeline: paginatedItems,
        total: timelineItems.length,
        hasMore: offset + limit < timelineItems.length,
      });
    }

    return NextResponse.json({ error: "Invalid view parameter" }, { status: 400 });
  } catch (error) {
    console.error("Error in GET /api/admin/community:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
