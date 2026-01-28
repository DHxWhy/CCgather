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

interface PostResponse {
  id: string;
  author: PostAuthor;
  content: string;
  tab: string;
  original_language: string;
  is_translated: boolean;
  created_at: string;
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
  liked_by: LikedByUser[];
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
// GET /api/community/posts - 포스트 목록 조회
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

    // Get current user's database ID if authenticated
    let currentUserDbId: string | null = null;
    if (clerkId) {
      const { data: dbUser } = await supabase
        .from("users")
        .select("id")
        .eq("clerk_id", clerkId)
        .single();
      currentUserDbId = dbUser?.id || null;
    }

    // Build query
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

    // Tab filter
    if (tab && tab !== "all") {
      query = query.eq("tab", tab);
    }

    // Author filter
    if (authorId) {
      query = query.eq("author_id", authorId);
    }

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data: posts, error, count } = await query;

    if (error) {
      console.error("Error fetching posts:", error);
      return NextResponse.json({ error: "Failed to fetch posts" }, { status: 500 });
    }

    // Get liked post IDs for current user
    let likedPostIds: string[] = [];
    const postIds = posts?.map((p: { id: string }) => p.id) || [];

    if (currentUserDbId && postIds.length > 0) {
      const { data: likes } = await supabase
        .from("post_likes")
        .select("post_id")
        .eq("user_id", currentUserDbId)
        .in("post_id", postIds);
      likedPostIds = likes?.map((l: { post_id: string }) => l.post_id) || [];
    }

    // Get liked_by users for each post (up to 5 per post for avatar display)
    const likedByMap: Record<
      string,
      { id: string; username: string; display_name: string | null; avatar_url: string | null }[]
    > = {};
    if (postIds.length > 0) {
      const { data: allLikes } = await supabase
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
        .order("created_at", { ascending: false });

      // Group by post_id, limit to 5 per post
      allLikes?.forEach(
        (like: {
          post_id: string;
          user: {
            id: string;
            username: string;
            display_name: string | null;
            avatar_url: string | null;
          };
        }) => {
          if (!likedByMap[like.post_id]) {
            likedByMap[like.post_id] = [];
          }
          const postLikes = likedByMap[like.post_id];
          if (postLikes && postLikes.length < 5) {
            postLikes.push(like.user);
          }
        }
      );
    }

    // Transform response
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
        }) => {
          const author = post.author as PostAuthor;
          return {
            id: post.id,
            author: {
              id: author.id,
              username: author.username,
              display_name: author.display_name,
              avatar_url: author.avatar_url,
              current_level: author.current_level,
              country_code: author.country_code,
            },
            content: post.content,
            tab: post.tab,
            original_language: post.original_language,
            is_translated: false, // TODO: Implement translation detection
            created_at: post.created_at,
            likes_count: post.likes_count,
            comments_count: post.comments_count,
            is_liked: likedPostIds.includes(post.id),
            liked_by: likedByMap[post.id] || [],
          };
        }
      ) || [];

    return NextResponse.json({
      posts: transformedPosts,
      total: count || 0,
      hasMore: offset + limit < (count || 0),
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

    // Detect language (simple heuristic, can be improved)
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
      is_translated: false,
      created_at: post.created_at,
      likes_count: 0,
      comments_count: 0,
      is_liked: false,
      liked_by: [],
    };

    return NextResponse.json({ post: response }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/community/posts:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// =====================================================
// Helper Functions
// =====================================================

function detectLanguage(text: string): string {
  // Simple language detection heuristic
  // Check for Korean characters
  if (/[\uAC00-\uD7AF]/.test(text)) return "ko";
  // Check for Japanese characters (Hiragana, Katakana, Kanji)
  if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text)) return "ja";
  // Check for Chinese characters (excluding Japanese Kanji overlap)
  if (/[\u4E00-\u9FFF]/.test(text) && !/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return "zh";
  // Default to English
  return "en";
}
