import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import { z } from "zod";

// =====================================================
// Validation Schemas
// =====================================================

const SubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
  user_agent: z.string().optional(),
});

// =====================================================
// POST /api/community/push/subscribe - 푸시 구독 등록
// =====================================================
export async function POST(request: NextRequest) {
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
    const parsed = SubscribeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.issues },
        { status: 400 }
      );
    }

    // Upsert subscription (update if endpoint exists, insert if not)
    const { error: upsertError } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: user.id,
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
        user_agent: parsed.data.user_agent || request.headers.get("user-agent") || null,
      },
      {
        onConflict: "endpoint",
      }
    );

    if (upsertError) {
      console.error("Error saving push subscription:", upsertError);
      return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Push notification subscription saved",
    });
  } catch (error) {
    console.error("Error in POST /api/community/push/subscribe:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// =====================================================
// DELETE /api/community/push/subscribe - 푸시 구독 해제
// =====================================================
export async function DELETE(request: NextRequest) {
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
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json({ error: "Endpoint is required" }, { status: 400 });
    }

    // Delete subscription
    const { error: deleteError } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user.id)
      .eq("endpoint", endpoint);

    if (deleteError) {
      console.error("Error deleting push subscription:", deleteError);
      return NextResponse.json({ error: "Failed to delete subscription" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Push notification subscription removed",
    });
  } catch (error) {
    console.error("Error in DELETE /api/community/push/subscribe:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
