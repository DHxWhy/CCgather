import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import { z } from "zod";

// =====================================================
// Types (matches DB schema)
// =====================================================

interface NotificationSettings {
  // Leaderboard & Progress
  notify_rank_updates: boolean;
  notify_level_up: boolean;
  notify_badges: boolean;
  notify_submissions: boolean;
  // Community
  notify_post_likes: boolean;
  notify_post_comments: boolean;
  notify_comment_replies: boolean;
}

// =====================================================
// Validation Schemas
// =====================================================

const UpdateSettingsSchema = z.object({
  notify_rank_updates: z.boolean().optional(),
  notify_level_up: z.boolean().optional(),
  notify_badges: z.boolean().optional(),
  notify_submissions: z.boolean().optional(),
  notify_post_likes: z.boolean().optional(),
  notify_post_comments: z.boolean().optional(),
  notify_comment_replies: z.boolean().optional(),
});

// =====================================================
// GET /api/community/settings - 알림 설정 조회
// =====================================================
export async function GET() {
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

    // Get notification settings (or create default if not exists)
    let { data: settings, error } = await supabase
      .from("user_notification_settings")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error && error.code === "PGRST116") {
      // No settings found, create default
      const { data: newSettings, error: insertError } = await supabase
        .from("user_notification_settings")
        .insert({ user_id: user.id })
        .select()
        .single();

      if (insertError) {
        console.error("Error creating notification settings:", insertError);
        return NextResponse.json({ error: "Failed to get settings" }, { status: 500 });
      }

      settings = newSettings;
    } else if (error) {
      console.error("Error fetching notification settings:", error);
      return NextResponse.json({ error: "Failed to get settings" }, { status: 500 });
    }

    const response: NotificationSettings = {
      notify_rank_updates: settings.notify_rank_updates ?? true,
      notify_level_up: settings.notify_level_up ?? true,
      notify_badges: settings.notify_badges ?? true,
      notify_submissions: settings.notify_submissions ?? true,
      notify_post_likes: settings.notify_post_likes ?? true,
      notify_post_comments: settings.notify_post_comments ?? true,
      notify_comment_replies: settings.notify_comment_replies ?? true,
    };

    return NextResponse.json({ settings: response });
  } catch (error) {
    console.error("Error in GET /api/community/settings:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// =====================================================
// PATCH /api/community/settings - 알림 설정 수정
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

    // Parse and validate request body
    const body = await request.json();
    const parsed = UpdateSettingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.issues },
        { status: 400 }
      );
    }

    // Upsert settings
    const { data: settings, error } = await supabase
      .from("user_notification_settings")
      .upsert(
        {
          user_id: user.id,
          ...parsed.data,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id",
        }
      )
      .select()
      .single();

    if (error) {
      console.error("Error updating notification settings:", error);
      return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
    }

    const response: NotificationSettings = {
      notify_rank_updates: settings.notify_rank_updates ?? true,
      notify_level_up: settings.notify_level_up ?? true,
      notify_badges: settings.notify_badges ?? true,
      notify_submissions: settings.notify_submissions ?? true,
      notify_post_likes: settings.notify_post_likes ?? true,
      notify_post_comments: settings.notify_post_comments ?? true,
      notify_comment_replies: settings.notify_comment_replies ?? true,
    };

    return NextResponse.json({ settings: response });
  } catch (error) {
    console.error("Error in PATCH /api/community/settings:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
