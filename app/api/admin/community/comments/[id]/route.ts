import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";

// =====================================================
// PATCH /api/admin/community/comments/[id] - 댓글 숨김/복구
// =====================================================
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceClient();

    // Verify admin
    const { data: user } = await supabase
      .from("users")
      .select("id, is_admin")
      .eq("clerk_id", clerkId)
      .single();

    if (!user || !user.is_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { action, reason } = body; // action: 'hide' | 'restore'

    if (!action || !["hide", "restore"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Get comment
    const { data: comment } = await supabase
      .from("comments")
      .select(
        "id, content, post_id, parent_comment_id, likes_count, replies_count, deleted_at, created_at"
      )
      .eq("id", id)
      .single();

    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    const now = new Date().toISOString();

    if (action === "hide") {
      if (comment.deleted_at) {
        return NextResponse.json({ error: "Comment already hidden" }, { status: 400 });
      }

      // Cascade soft delete replies (if top-level comment)
      let cascadeDeletedReplies = 0;
      if (comment.parent_comment_id === null) {
        const { data: deletedReplies } = await supabase
          .from("comments")
          .update({ deleted_at: now })
          .eq("parent_comment_id", id)
          .is("deleted_at", null)
          .select("id");
        cascadeDeletedReplies = deletedReplies?.length || 0;
      }

      // Hide comment
      await supabase.from("comments").update({ deleted_at: now }).eq("id", id);

      // Log admin action
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
        deleted_by_role: "admin",
        cascade_deleted_replies: cascadeDeletedReplies,
        reason: reason || "Admin action",
      });

      return NextResponse.json({
        success: true,
        message: "Comment hidden",
        cascade_deleted_replies: cascadeDeletedReplies,
      });
    }

    // action === "restore" (validated above)
    if (!comment.deleted_at) {
      return NextResponse.json({ error: "Comment not hidden" }, { status: 400 });
    }

    // Restore comment
    await supabase.from("comments").update({ deleted_at: null }).eq("id", id);

    // Restore replies that were deleted at the same time (within 1 second)
    let restoredReplies = 0;
    if (comment.parent_comment_id === null) {
      const deletedAt = new Date(comment.deleted_at);
      const deletedAtMin = new Date(deletedAt.getTime() - 1000).toISOString();
      const deletedAtMax = new Date(deletedAt.getTime() + 1000).toISOString();

      const { data: restored } = await supabase
        .from("comments")
        .update({ deleted_at: null })
        .eq("parent_comment_id", id)
        .gte("deleted_at", deletedAtMin)
        .lte("deleted_at", deletedAtMax)
        .select("id");
      restoredReplies = restored?.length || 0;
    }

    return NextResponse.json({
      success: true,
      message: "Comment restored",
      restored_replies: restoredReplies,
    });
  } catch (error) {
    console.error("Error in PATCH /api/admin/community/comments/[id]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
