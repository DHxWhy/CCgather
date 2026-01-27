import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";

// =====================================================
// Types
// =====================================================

interface NotificationActor {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface NotificationResponse {
  id: string;
  type: string;
  actor: NotificationActor | null;
  post_id: string | null;
  comment_id: string | null;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

// =====================================================
// GET /api/community/notifications - 알림 목록 조회
// =====================================================
export async function GET(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);

    // Get user from database
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("clerk_id", clerkId)
      .single();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
    const offset = parseInt(searchParams.get("offset") || "0");
    const unreadOnly = searchParams.get("unread") === "true";

    // Build query
    let query = supabase
      .from("notifications")
      .select(
        `
        id,
        type,
        post_id,
        comment_id,
        data,
        is_read,
        created_at,
        actor:users!actor_id (
          id,
          username,
          display_name,
          avatar_url
        )
      `,
        { count: "exact" }
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (unreadOnly) {
      query = query.eq("is_read", false);
    }

    query = query.range(offset, offset + limit - 1);

    const { data: notifications, error, count } = await query;

    if (error) {
      console.error("Error fetching notifications:", error);
      return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
    }

    // Get unread count
    const { count: unreadCount } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    // Transform response
    const transformedNotifications: NotificationResponse[] =
      notifications?.map(
        (notification: {
          id: string;
          type: string;
          post_id: string | null;
          comment_id: string | null;
          data: unknown;
          is_read: boolean;
          created_at: string;
          actor: NotificationActor | null;
        }) => {
          const actor = notification.actor as NotificationActor | null;
          return {
            id: notification.id,
            type: notification.type,
            actor: actor
              ? {
                  id: actor.id,
                  username: actor.username,
                  display_name: actor.display_name,
                  avatar_url: actor.avatar_url,
                }
              : null,
            post_id: notification.post_id,
            comment_id: notification.comment_id,
            data: notification.data as Record<string, unknown> | null,
            is_read: notification.is_read,
            created_at: notification.created_at,
          };
        }
      ) || [];

    return NextResponse.json({
      notifications: transformedNotifications,
      total: count || 0,
      unread_count: unreadCount || 0,
      hasMore: offset + limit < (count || 0),
    });
  } catch (error) {
    console.error("Error in GET /api/community/notifications:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// =====================================================
// PATCH /api/community/notifications - 알림 읽음 처리
// =====================================================
export async function PATCH(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceClient();

    // Get user from database
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("clerk_id", clerkId)
      .single();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const { notification_ids, mark_all_read } = body;

    if (mark_all_read) {
      // Mark all notifications as read
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

      if (error) {
        console.error("Error marking all as read:", error);
        return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: "All notifications marked as read" });
    }

    if (notification_ids && Array.isArray(notification_ids)) {
      // Mark specific notifications as read
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .in("id", notification_ids);

      if (error) {
        console.error("Error marking notifications as read:", error);
        return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `${notification_ids.length} notifications marked as read`,
      });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error) {
    console.error("Error in PATCH /api/community/notifications:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
