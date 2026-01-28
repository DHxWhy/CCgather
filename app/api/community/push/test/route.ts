import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendPushNotificationToUser, PushNotificationPayload } from "@/lib/push/send-notification";

// =====================================================
// POST /api/community/push/test - 테스트 푸시 알림 전송
// =====================================================
export async function POST() {
  try {
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceClient();

    // Get user from database
    const { data: user } = await supabase
      .from("users")
      .select("id, username")
      .eq("clerk_id", clerkId)
      .single();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user has any push subscriptions
    const { count } = await supabase
      .from("push_subscriptions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (!count || count === 0) {
      return NextResponse.json(
        {
          error: "No subscriptions",
          message: "No push notification subscriptions found. Please enable notifications first.",
        },
        { status: 400 }
      );
    }

    // Send test notification
    const payload: PushNotificationPayload = {
      title: "Test Notification",
      body: `Hello ${user.username}! Push notifications are working correctly.`,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/badge-72x72.png",
      tag: "test-notification",
      data: {
        url: "/settings",
        type: "test",
      },
    };

    const result = await sendPushNotificationToUser(user.id, payload);

    return NextResponse.json({
      success: true,
      message: `Test notification sent to ${result.success} device(s)`,
      result,
    });
  } catch (error) {
    console.error("Error in POST /api/community/push/test:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
