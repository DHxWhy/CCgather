import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import { z } from "zod";

// =====================================================
// Types
// =====================================================

interface PostAuthor {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  current_level: number;
  country_code: string | null;
}

interface LikedByUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface PreviewComment {
  id: string;
  author: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    current_level: number;
  };
  content: string;
  original_language: string;
  likes_count: number;
  created_at: string;
  is_liked: boolean;
  replies_count?: number;
}

// For batch translation - minimal data for all comments/replies
interface TranslationItem {
  id: string;
  content: string;
  original_language: string;
}

interface PostResponse {
  id: string;
  author: PostAuthor;
  content: string;
  tab: string;
  original_language: string;
  created_at: string;
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
  liked_by: LikedByUser[];
  preview_comments: PreviewComment[];
  has_more_comments: boolean;
  // All comments/replies for batch translation (minimal data)
  all_comments_for_translation?: TranslationItem[];
}

// =====================================================
// Validation Schemas
// =====================================================

const CreatePostSchema = z.object({
  content: z
    .string()
    .min(1, "Content is required")
    .max(2000, "Content must be 2000 characters or less"),
  tab: z.enum(["vibes", "showcase", "help", "canu"]).default("vibes"),
  language: z.string().length(2).optional(),
});

// =====================================================
// Helper Functions
// =====================================================

function detectLanguage(text: string): string {
  if (/[\uAC00-\uD7AF]/.test(text)) return "ko";
  if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text)) return "ja";
  if (/[\u4E00-\u9FFF]/.test(text) && !/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return "zh";
  // European languages detection
  if (/[äöüßÄÖÜ]/.test(text)) return "de";
  if (/[éèêëàâùûôîïç]/i.test(text)) return "fr";
  if (/[áéíóúüñ¿¡]/i.test(text)) return "es";
  if (/[ãõáéíóúâêôç]/i.test(text)) return "pt";
  return "en";
}

function countryToLanguage(countryCode: string | null | undefined): string {
  if (!countryCode) return "en";

  const countryLangMap: Record<string, string> = {
    KR: "ko",
    JP: "ja",
    CN: "zh",
    TW: "zh",
    HK: "zh",
    ES: "es",
    MX: "es",
    AR: "es",
    CO: "es",
    CL: "es",
    PE: "es",
    FR: "fr",
    BE: "fr",
    CH: "fr",
    CA: "fr",
    DE: "de",
    AT: "de",
    BR: "pt",
    PT: "pt",
    US: "en",
    GB: "en",
    AU: "en",
    NZ: "en",
    IE: "en",
    ZA: "en",
    IN: "en",
    SG: "en",
  };

  return countryLangMap[countryCode.toUpperCase()] || "en";
}

// =====================================================
// GET /api/community/posts - 포스트 목록 조회 (최적화됨)
// =====================================================
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const { userId: clerkId } = await auth();

    // Parse query parameters
    const tab = searchParams.get("tab") || "all";
    const authorId = searchParams.get("author");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
    const offset = parseInt(searchParams.get("offset") || "0");

    // =====================================================
    // Step 1: Parallel user data fetch (if authenticated)
    // =====================================================
    let currentUserDbId: string | null = null;
    let autoTranslate = false;
    let preferredLanguage = "en";

    if (clerkId) {
      // Fetch user data
      const userResult = await supabase
        .from("users")
        .select("id, country_code")
        .eq("clerk_id", clerkId)
        .single();

      if (userResult.data) {
        currentUserDbId = userResult.data.id;
        preferredLanguage = countryToLanguage(userResult.data.country_code);

        // Now fetch settings with user ID
        const { data: settings } = await supabase
          .from("user_notification_settings")
          .select("auto_translate")
          .eq("user_id", currentUserDbId)
          .single();
        autoTranslate = settings?.auto_translate ?? true;
      }
    }

    // =====================================================
    // Step 2: Build and execute main posts query
    // =====================================================
    let query = supabase
      .from("posts")
      .select(
        `
        id,
        content,
        tab,
        original_language,
        likes_count,
        comments_count,
        created_at,
        author:users!author_id (
          id,
          username,
          display_name,
          avatar_url,
          current_level,
          country_code
        )
      `,
        { count: "exact" }
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (tab && tab !== "all") {
      query = query.eq("tab", tab);
    }
    if (authorId) {
      query = query.eq("author_id", authorId);
    }
    query = query.range(offset, offset + limit - 1);

    const { data: posts, error, count } = await query;

    if (error) {
      console.error("Error fetching posts:", error);
      return NextResponse.json({ error: "Failed to fetch posts" }, { status: 500 });
    }

    const postIds = posts?.map((p: { id: string }) => p.id) || [];

    if (postIds.length === 0) {
      return createResponse({
        posts: [],
        total: 0,
        hasMore: false,
        auto_translate_enabled: autoTranslate,
        preferred_language: preferredLanguage,
      });
    }

    // =====================================================
    // Step 3: Parallel fetch of related data
    // =====================================================
    const postsWithComments =
      posts?.filter((p: { comments_count: number }) => p.comments_count > 0) || [];
    const postIdsWithComments = postsWithComments.map((p: { id: string }) => p.id);

    // Run all secondary queries in parallel
    const [
      likedPostsResult,
      likedByResult,
      previewCommentsResult,
      allCommentsForTranslationResult,
    ] = await Promise.all([
      // 1. User's liked posts
      currentUserDbId
        ? supabase
            .from("post_likes")
            .select("post_id")
            .eq("user_id", currentUserDbId)
            .in("post_id", postIds)
        : Promise.resolve({ data: [] }),

      // 2. Liked by users (avatars)
      supabase
        .from("post_likes")
        .select(
          `
          post_id,
          user:users!user_id (
            id,
            username,
            display_name,
            avatar_url
          )
        `
        )
        .in("post_id", postIds)
        .order("created_at", { ascending: false }),

      // 3. Preview comments (top 3 per post, top-level only)
      postIdsWithComments.length > 0
        ? supabase
            .from("comments")
            .select(
              `
              id,
              post_id,
              content,
              likes_count,
              created_at,
              author:users!author_id (
                id,
                username,
                display_name,
                avatar_url,
                current_level
              )
            `
            )
            .in("post_id", postIdsWithComments)
            .is("deleted_at", null)
            .is("parent_comment_id", null)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),

      // 4. ALL comments for translation (includes replies) - minimal data
      postIdsWithComments.length > 0
        ? supabase
            .from("comments")
            .select("id, post_id, content")
            .in("post_id", postIdsWithComments)
            .is("deleted_at", null)
        : Promise.resolve({ data: [] }),
    ]);

    // Process liked posts
    const likedPostIds = likedPostsResult.data?.map((l: { post_id: string }) => l.post_id) || [];

    // Process ALL comments for translation (grouped by post_id)
    const allCommentsForTranslationMap: Record<string, TranslationItem[]> = {};
    allCommentsForTranslationResult.data?.forEach(
      (comment: { id: string; post_id: string; content: string }) => {
        if (!allCommentsForTranslationMap[comment.post_id]) {
          allCommentsForTranslationMap[comment.post_id] = [];
        }
        allCommentsForTranslationMap[comment.post_id]!.push({
          id: comment.id,
          content: comment.content,
          original_language: detectLanguage(comment.content),
        });
      }
    );

    // Process liked_by map (limit 5 per post)
    const likedByMap: Record<string, LikedByUser[]> = {};
    likedByResult.data?.forEach((like: { post_id: string; user: LikedByUser }) => {
      if (!likedByMap[like.post_id]) {
        likedByMap[like.post_id] = [];
      }
      if (likedByMap[like.post_id]!.length < 5) {
        likedByMap[like.post_id]!.push(like.user);
      }
    });

    // Process preview comments (limit 3 per post)
    // Also track total top-level comment count per post for has_more_comments
    const previewCommentsMap: Record<string, PreviewComment[]> = {};
    const topLevelCountMap: Record<string, number> = {};
    const allCommentIds: string[] = [];

    previewCommentsResult.data?.forEach(
      (comment: {
        id: string;
        post_id: string;
        content: string;
        likes_count: number;
        created_at: string;
        author: {
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          current_level: number;
        };
      }) => {
        // Count all top-level comments per post
        topLevelCountMap[comment.post_id] = (topLevelCountMap[comment.post_id] || 0) + 1;

        if (!previewCommentsMap[comment.post_id]) {
          previewCommentsMap[comment.post_id] = [];
        }
        if (previewCommentsMap[comment.post_id]!.length < 3) {
          allCommentIds.push(comment.id);
          previewCommentsMap[comment.post_id]!.push({
            id: comment.id,
            author: comment.author,
            content: comment.content,
            original_language: detectLanguage(comment.content),
            likes_count: comment.likes_count,
            created_at: comment.created_at,
            is_liked: false, // Will be updated below
            replies_count: 0, // Will be updated below
          });
        }
      }
    );

    // =====================================================
    // Step 4: Parallel fetch for comment metadata
    // =====================================================
    if (allCommentIds.length > 0) {
      const [commentLikesResult, repliesCountResult] = await Promise.all([
        // Comment likes for current user
        currentUserDbId
          ? supabase
              .from("comment_likes")
              .select("comment_id")
              .eq("user_id", currentUserDbId)
              .in("comment_id", allCommentIds)
          : Promise.resolve({ data: [] }),

        // Replies count
        supabase
          .from("comments")
          .select("parent_comment_id")
          .in("parent_comment_id", allCommentIds)
          .is("deleted_at", null),
      ]);

      const likedCommentIds = new Set(
        commentLikesResult.data?.map((l: { comment_id: string }) => l.comment_id) || []
      );

      const repliesCountMap: Record<string, number> = {};
      repliesCountResult.data?.forEach((r: { parent_comment_id: string }) => {
        repliesCountMap[r.parent_comment_id] = (repliesCountMap[r.parent_comment_id] || 0) + 1;
      });

      // Apply to preview comments
      Object.values(previewCommentsMap).forEach((comments) => {
        comments.forEach((comment) => {
          comment.is_liked = likedCommentIds.has(comment.id);
          comment.replies_count = repliesCountMap[comment.id] || 0;
        });
      });
    }

    // =====================================================
    // Step 5: Transform response (NO TRANSLATION - original only)
    // =====================================================
    const transformedPosts: PostResponse[] =
      posts?.map(
        (post: {
          id: string;
          content: string;
          tab: string;
          original_language: string;
          likes_count: number;
          comments_count: number;
          created_at: string;
          author: PostAuthor;
        }) => ({
          id: post.id,
          author: post.author,
          content: post.content, // Original content only
          tab: post.tab,
          original_language: post.original_language,
          created_at: post.created_at,
          likes_count: post.likes_count,
          comments_count: post.comments_count,
          is_liked: likedPostIds.includes(post.id),
          liked_by: likedByMap[post.id] || [],
          preview_comments: previewCommentsMap[post.id] || [],
          // has_more_comments: 실제 최상위 댓글 수가 프리뷰 개수(3)보다 많을 때만 true
          has_more_comments: (topLevelCountMap[post.id] || 0) > 3,
          // All comments/replies for batch translation
          all_comments_for_translation: allCommentsForTranslationMap[post.id] || [],
        })
      ) || [];

    return createResponse({
      posts: transformedPosts,
      total: count || 0,
      hasMore: offset + limit < (count || 0),
      auto_translate_enabled: autoTranslate,
      preferred_language: preferredLanguage,
    });
  } catch (error) {
    console.error("Error in GET /api/community/posts:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// =====================================================
// POST /api/community/posts - 포스트 작성
// =====================================================
export async function POST(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceClient();

    // Get user from database
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, username, display_name, avatar_url, current_level, country_code")
      .eq("clerk_id", clerkId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user has submission history (required to post)
    const { count: submissionCount } = await supabase
      .from("usage_stats")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (!submissionCount || submissionCount === 0) {
      return NextResponse.json(
        {
          error: "Submission required",
          message: "You need to submit data at least once before posting in the community.",
        },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const parsed = CreatePostSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.issues },
        { status: 400 }
      );
    }

    // Detect language
    const language = parsed.data.language || detectLanguage(parsed.data.content);

    // Insert post
    const { data: post, error: insertError } = await supabase
      .from("posts")
      .insert({
        author_id: user.id,
        content: parsed.data.content.trim(),
        tab: parsed.data.tab,
        original_language: language,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting post:", insertError);
      return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
    }

    // Return created post with author info
    const response: PostResponse = {
      id: post.id,
      author: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        current_level: user.current_level,
        country_code: user.country_code,
      },
      content: post.content,
      tab: post.tab,
      original_language: post.original_language,
      created_at: post.created_at,
      likes_count: 0,
      comments_count: 0,
      is_liked: false,
      liked_by: [],
      preview_comments: [],
      has_more_comments: false,
    };

    return NextResponse.json({ post: response }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/community/posts:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// =====================================================
// Response Helper with Caching
// =====================================================

function createResponse(data: {
  posts: PostResponse[];
  total: number;
  hasMore: boolean;
  auto_translate_enabled: boolean;
  preferred_language: string;
}) {
  return new NextResponse(JSON.stringify(data), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      // CDN caching: 60s fresh, 5min stale-while-revalidate
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
