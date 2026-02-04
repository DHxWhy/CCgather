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
  display_avatar_url: string | null;
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
        translated_content,
        translated_to,
        likes_count,
        comments_count,
        created_at,
        author:users!author_id (
          id,
          username,
          display_name,
          display_avatar_url,
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
          avatar_url: author.display_avatar_url,
          current_level: author.current_level,
          country_code: author.country_code,
        },
        content: post.content,
        tab: post.tab,
        original_language: post.original_language,
        translated_content: post.translated_content,
        translated_to: post.translated_to,
        is_translated: !!post.translated_content,
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
// PATCH /api/community/posts/[id] - 포스트 수정 (5분 이내)
// =====================================================
const EDIT_TIME_LIMIT_MS = 5 * 60 * 1000; // 5분

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceClient();
    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    if (content.length > 2000) {
      return NextResponse.json({ error: "Content too long (max 2000 chars)" }, { status: 400 });
    }

    // Get user from database
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("clerk_id", clerkId)
      .single();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get post
    const { data: post } = await supabase
      .from("posts")
      .select("id, author_id, content, created_at")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Check ownership
    if (post.author_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check time limit (5 minutes)
    const createdAt = new Date(post.created_at).getTime();
    const now = Date.now();
    if (now - createdAt > EDIT_TIME_LIMIT_MS) {
      return NextResponse.json(
        { error: "Edit time expired. Posts can only be edited within 5 minutes." },
        { status: 403 }
      );
    }

    // Update the post
    const { data: updatedPost, error: updateError } = await supabase
      .from("posts")
      .update({
        content: content.trim(),
        edited_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id, content, edited_at")
      .single();

    if (updateError) {
      console.error("Error updating post:", updateError);
      return NextResponse.json({ error: "Failed to update post" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      post: updatedPost,
    });
  } catch (error) {
    console.error("Error in PATCH /api/community/posts/[id]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// =====================================================
// DELETE /api/community/posts/[id] - 포스트 삭제 (Soft Delete)
// Cascade: 해당 포스트의 모든 댓글도 soft delete
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

    // Get post with full content for snapshot
    const { data: post } = await supabase
      .from("posts")
      .select(
        `
        id,
        author_id,
        content,
        tab,
        likes_count,
        comments_count,
        created_at
      `
      )
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Check if user owns the post or is admin
    const isOwner = post.author_id === user.id;
    const isAdmin = user.is_admin;
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const now = new Date().toISOString();

    // 1. Cascade soft delete all comments on this post
    const { data: deletedComments } = await supabase
      .from("comments")
      .update({ deleted_at: now })
      .eq("post_id", id)
      .is("deleted_at", null)
      .select("id");

    const cascadeDeletedCount = deletedComments?.length || 0;

    // 2. Soft delete the post
    const { error: deleteError } = await supabase
      .from("posts")
      .update({ deleted_at: now })
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting post:", deleteError);
      return NextResponse.json({ error: "Failed to delete post" }, { status: 500 });
    }

    // 3. Log deletion for admin review
    await supabase.from("content_deletion_logs").insert({
      content_type: "post",
      content_id: id,
      content_snapshot: {
        content: post.content,
        tab: post.tab,
        likes_count: post.likes_count,
        comments_count: post.comments_count,
        created_at: post.created_at,
      },
      deleted_by: user.id,
      deleted_by_role: isAdmin && !isOwner ? "admin" : "owner",
      cascade_deleted_comments: cascadeDeletedCount,
    });

    return NextResponse.json({
      success: true,
      message: "Post deleted. It will be permanently removed after 30 days.",
      cascade_deleted_comments: cascadeDeletedCount,
    });
  } catch (error) {
    console.error("Error in DELETE /api/community/posts/[id]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
