import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import { z } from "zod";

// ===========================================
// Validation Schema
// ===========================================

const FeedbackSchema = z.object({
  type: z.enum(["bug", "feature", "general"]),
  content: z.string().min(10).max(1000),
  page_url: z.string().optional(),
  user_agent: z.string().optional(),
});

// ===========================================
// POST - Submit Feedback
// ===========================================

export async function POST(request: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = FeedbackSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Get user ID
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("clerk_id", userId)
      .single();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Insert feedback
    const { data: feedback, error } = await supabase
      .from("feedback")
      .insert({
        user_id: user.id,
        type: parsed.data.type,
        content: parsed.data.content,
        page_url: parsed.data.page_url,
        user_agent: parsed.data.user_agent,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Failed to insert feedback:", error);
      return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: feedback.id });
  } catch (error) {
    console.error("POST /api/feedback error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ===========================================
// GET - Get Feedback List (Admin only)
// ===========================================

export async function GET(request: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Check admin
  const { data: user } = await supabase
    .from("users")
    .select("is_admin")
    .eq("clerk_id", userId)
    .single();

  if (!user?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Parse query params
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = parseInt(searchParams.get("offset") || "0");

  // Build query
  let query = supabase
    .from("feedback")
    .select(
      `
      *,
      user:users(id, username, display_name, avatar_url)
    `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data: feedbacks, error, count } = await query;

  if (error) {
    console.error("Failed to fetch feedbacks:", error);
    return NextResponse.json({ error: "Failed to fetch feedbacks" }, { status: 500 });
  }

  return NextResponse.json({
    feedbacks,
    total: count,
    hasMore: offset + limit < (count || 0),
  });
}

// ===========================================
// PATCH - Update Feedback Status (Admin only)
// ===========================================

export async function PATCH(request: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Check admin
  const { data: user } = await supabase
    .from("users")
    .select("is_admin")
    .eq("clerk_id", userId)
    .single();

  if (!user?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id, status, admin_note } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing feedback ID" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (admin_note !== undefined) updateData.admin_note = admin_note;

    const { error } = await supabase.from("feedback").update(updateData).eq("id", id);

    if (error) {
      console.error("Failed to update feedback:", error);
      return NextResponse.json({ error: "Failed to update feedback" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/feedback error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
