import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";

// =====================================================
// PATCH /api/community/comments/[id] - 댓글 수정
// =====================================================

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

    if (content.length > 1000) {
      return NextResponse.json({ error: "Content too long (max 1000 chars)" }, { status: 400 });
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

    // Get comment
    const { data: comment } = await supabase
      .from("comments")
      .select("id, author_id, content, created_at")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    // Check ownership
    if (comment.author_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Update the comment
    const { data: updatedComment, error: updateError } = await supabase
      .from("comments")
      .update({
        content: content.trim(),
        edited_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id, content, edited_at")
      .single();

    if (updateError) {
      console.error("Error updating comment:", updateError);
      return NextResponse.json({ error: "Failed to update comment" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      comment: updatedComment,
    });
  } catch (error) {
    console.error("Error in PATCH /api/community/comments/[id]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// =====================================================
// DELETE /api/community/comments/[id] - 댓글 삭제 (Soft Delete)
// Cascade: 해당 댓글의 모든 대댓글도 soft delete
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

    // Get comment with full content for snapshot
    const { data: comment } = await supabase
      .from("comments")
      .select(
        `
        id,
        author_id,
        post_id,
        parent_comment_id,
        content,
        likes_count,
        replies_count,
        created_at
      `
      )
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    // Check if user owns the comment or is admin
    const isOwner = comment.author_id === user.id;
    const isAdmin = user.is_admin;
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const now = new Date().toISOString();

    // 1. Cascade soft delete all replies to this comment
    let cascadeDeletedReplies = 0;
    if (comment.parent_comment_id === null) {
      // Only top-level comments can have replies
      const { data: deletedReplies } = await supabase
        .from("comments")
        .update({ deleted_at: now })
        .eq("parent_comment_id", id)
        .is("deleted_at", null)
        .select("id");

      cascadeDeletedReplies = deletedReplies?.length || 0;
    }

    // 2. Soft delete the comment
    const { error: deleteError } = await supabase
      .from("comments")
      .update({ deleted_at: now })
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting comment:", deleteError);
      return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
    }

    // 3. Log deletion for admin review
    await supabase.from("content_deletion_logs").insert({
      content_type: "comment",
      content_id: id,
      content_snapshot: {
        content: comment.content,
        post_id: comment.post_id,
        parent_comment_id: comment.parent_comment_id,
        likes_count: comment.likes_count,
        replies_count: comment.replies_count,
        created_at: comment.created_at,
      },
      deleted_by: user.id,
      deleted_by_role: isAdmin && !isOwner ? "admin" : "owner",
      cascade_deleted_replies: cascadeDeletedReplies,
    });

    return NextResponse.json({
      success: true,
      message: "Comment deleted.",
      cascade_deleted_replies: cascadeDeletedReplies,
    });
  } catch (error) {
    console.error("Error in DELETE /api/community/comments/[id]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
