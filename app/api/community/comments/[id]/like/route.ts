import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  sendPushNotificationToUser,
  createCommentLikeNotification,
} from "@/lib/push/send-notification";

// =====================================================
// POST /api/community/comments/[id]/like - 댓글 좋아요 토글
// =====================================================
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: commentId } = await params;
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceClient();

    // Get user from database
    const { data: user } = await supabase
      .from("users")
      .select("id, username, display_name")
      .eq("clerk_id", clerkId)
      .single();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user has submission history (required to like)
    const { count: submissionCount } = await supabase
      .from("usage_stats")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (!submissionCount || submissionCount === 0) {
      return NextResponse.json(
        {
          error: "Submission required",
          message: "You need to submit data at least once before interacting with the community.",
        },
        { status: 403 }
      );
    }

    // Check if comment exists
    const { data: comment } = await supabase
      .from("comments")
      .select("id, author_id, post_id, likes_count, content")
      .eq("id", commentId)
      .is("deleted_at", null)
      .single();

    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    // Check if already liked
    const { data: existingLike } = await supabase
      .from("comment_likes")
      .select("id")
      .eq("comment_id", commentId)
      .eq("user_id", user.id)
      .single();

    if (existingLike) {
      // Unlike - remove the like
      const { error: deleteError } = await supabase
        .from("comment_likes")
        .delete()
        .eq("comment_id", commentId)
        .eq("user_id", user.id);

      if (deleteError) {
        console.error("Error removing like:", deleteError);
        return NextResponse.json({ error: "Failed to unlike" }, { status: 500 });
      }

      // Get updated count (trigger should have updated it)
      const { data: updatedComment } = await supabase
        .from("comments")
        .select("likes_count")
        .eq("id", commentId)
        .single();

      return NextResponse.json({
        liked: false,
        likes_count: updatedComment?.likes_count || comment.likes_count - 1,
      });
    } else {
      // Like - add the like
      const { error: insertError } = await supabase.from("comment_likes").insert({
        comment_id: commentId,
        user_id: user.id,
      });

      if (insertError) {
        // Handle duplicate (race condition)
        if (insertError.code === "23505") {
          return NextResponse.json({
            liked: true,
            likes_count: comment.likes_count,
          });
        }
        console.error("Error adding like:", insertError);
        return NextResponse.json({ error: "Failed to like" }, { status: 500 });
      }

      // Create notification for comment author (if not self-like)
      if (comment.author_id !== user.id) {
        await supabase.from("notifications").insert({
          user_id: comment.author_id,
          type: "comment_like",
          actor_id: user.id,
          post_id: comment.post_id,
          comment_id: commentId,
        });

        // Send push notification (async, don't block response)
        const actorDisplayName = user.display_name || user.username;
        const payload = createCommentLikeNotification(
          actorDisplayName,
          comment.content || "",
          comment.post_id,
          commentId
        );
        sendPushNotificationToUser(comment.author_id, payload).catch((err) =>
          console.error("Failed to send push notification:", err)
        );
      }

      // Get updated count (trigger should have updated it)
      const { data: updatedComment } = await supabase
        .from("comments")
        .select("likes_count")
        .eq("id", commentId)
        .single();

      return NextResponse.json({
        liked: true,
        likes_count: updatedComment?.likes_count || comment.likes_count + 1,
      });
    }
  } catch (error) {
    console.error("Error in POST /api/community/comments/[id]/like:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
