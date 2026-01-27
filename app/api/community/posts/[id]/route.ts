import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";

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

// =====================================================
// GET /api/community/posts/[id] - 단일 포스트 조회
// =====================================================
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();
    const { userId: clerkId } = await auth();

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

    // Get post with author info
    const { data: post, error } = await supabase
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
      `
      )
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error || !post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Check if current user liked this post
    let isLiked = false;
    if (currentUserDbId) {
      const { data: like } = await supabase
        .from("post_likes")
        .select("id")
        .eq("post_id", id)
        .eq("user_id", currentUserDbId)
        .single();
      isLiked = !!like;
    }

    const author = post.author as PostAuthor;

    return NextResponse.json({
      post: {
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
        is_translated: false,
        created_at: post.created_at,
        likes_count: post.likes_count,
        comments_count: post.comments_count,
        is_liked: isLiked,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/community/posts/[id]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// =====================================================
// DELETE /api/community/posts/[id] - 포스트 삭제 (Soft Delete)
// =====================================================
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceClient();

    // Get user from database
    const { data: user } = await supabase
      .from("users")
      .select("id, is_admin")
      .eq("clerk_id", clerkId)
      .single();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get post to check ownership
    const { data: post } = await supabase
      .from("posts")
      .select("author_id")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Check if user owns the post or is admin
    if (post.author_id !== user.id && !user.is_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Soft delete - set deleted_at timestamp
    const { error: deleteError } = await supabase
      .from("posts")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting post:", deleteError);
      return NextResponse.json({ error: "Failed to delete post" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Post deleted. It will be permanently removed after 30 days.",
    });
  } catch (error) {
    console.error("Error in DELETE /api/community/posts/[id]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
