import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";

// =====================================================
// PATCH /api/admin/community/posts/[id] - 게시물 숨김/복구
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

    // Get post
    const { data: post } = await supabase
      .from("posts")
      .select("id, content, tab, likes_count, comments_count, deleted_at, created_at")
      .eq("id", id)
      .single();

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const now = new Date().toISOString();

    if (action === "hide") {
      if (post.deleted_at) {
        return NextResponse.json({ error: "Post already hidden" }, { status: 400 });
      }

      // Cascade soft delete comments
      const { data: deletedComments } = await supabase
        .from("comments")
        .update({ deleted_at: now })
        .eq("post_id", id)
        .is("deleted_at", null)
        .select("id");

      // Hide post
      await supabase.from("posts").update({ deleted_at: now }).eq("id", id);

      // Log admin action
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
        deleted_by_role: "admin",
        cascade_deleted_comments: deletedComments?.length || 0,
        reason: reason || "Admin action",
      });

      return NextResponse.json({
        success: true,
        message: "Post hidden",
        cascade_deleted_comments: deletedComments?.length || 0,
      });
    }

    // action === "restore" (validated above)
    if (!post.deleted_at) {
      return NextResponse.json({ error: "Post not hidden" }, { status: 400 });
    }

    // Restore post
    await supabase.from("posts").update({ deleted_at: null }).eq("id", id);

    // Restore comments that were deleted at the same time (within 1 second)
    const deletedAt = new Date(post.deleted_at);
    const deletedAtMin = new Date(deletedAt.getTime() - 1000).toISOString();
    const deletedAtMax = new Date(deletedAt.getTime() + 1000).toISOString();

    const { data: restoredComments } = await supabase
      .from("comments")
      .update({ deleted_at: null })
      .eq("post_id", id)
      .gte("deleted_at", deletedAtMin)
      .lte("deleted_at", deletedAtMax)
      .select("id");

    return NextResponse.json({
      success: true,
      message: "Post restored",
      restored_comments: restoredComments?.length || 0,
    });
  } catch (error) {
    console.error("Error in PATCH /api/admin/community/posts/[id]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
