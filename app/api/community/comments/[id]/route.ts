import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";

// =====================================================
// DELETE /api/community/comments/[id] - 댓글 삭제 (Soft Delete)
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

    // Get comment to check ownership
    const { data: comment } = await supabase
      .from("comments")
      .select("author_id")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    // Check if user owns the comment or is admin
    if (comment.author_id !== user.id && !user.is_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Soft delete - set deleted_at timestamp
    const { error: deleteError } = await supabase
      .from("comments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting comment:", deleteError);
      return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Comment deleted.",
    });
  } catch (error) {
    console.error("Error in DELETE /api/community/comments/[id]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
