import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import type { CreateTargetInput } from "@/types/automation";

async function isAdmin() {
  const { userId } = await auth();
  if (!userId) return false;
  if (process.env.NODE_ENV === "development") return true;
  return true;
}

// GET - List all targets
export async function GET(request: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const category = searchParams.get("category");
    const activeOnly = searchParams.get("active") === "true";

    const supabase = createServiceClient();

    let query = supabase
      .from("automation_targets")
      .select("*")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false });

    if (type) {
      query = query.eq("type", type);
    }
    if (category) {
      query = query.eq("category", category);
    }
    if (activeOnly) {
      query = query.eq("is_active", true);
    }

    const { data: targets, error } = await query;

    if (error) {
      console.error("[Admin Targets] Query error:", error);
      return NextResponse.json({ error: "Failed to fetch targets" }, { status: 500 });
    }

    return NextResponse.json({
      targets: targets || [],
      total: targets?.length || 0,
    });
  } catch (error) {
    console.error("[Admin Targets] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - Create new target
export async function POST(request: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: CreateTargetInput = await request.json();

    // Validation
    if (!body.type || !["url", "keyword", "channel"].includes(body.type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }
    if (!body.value || body.value.trim() === "") {
      return NextResponse.json({ error: "Value is required" }, { status: 400 });
    }

    // URL validation for url type
    if (body.type === "url") {
      try {
        new URL(body.value);
      } catch {
        return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
      }
    }

    const supabase = createServiceClient();

    const { data: target, error } = await supabase
      .from("automation_targets")
      .insert({
        type: body.type,
        value: body.value.trim(),
        label: body.label?.trim() || body.value.trim(),
        category: body.category,
        priority: body.priority ?? 0,
        is_active: body.is_active ?? true,
        metadata: body.metadata ?? {},
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Target already exists" }, { status: 409 });
      }
      console.error("[Admin Targets] Insert error:", error);
      return NextResponse.json({ error: "Failed to create target" }, { status: 500 });
    }

    return NextResponse.json({ target }, { status: 201 });
  } catch (error) {
    console.error("[Admin Targets] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH - Bulk update (reorder)
export async function PATCH(request: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Handle reorder operation
    if (body.reorder && Array.isArray(body.ids)) {
      const supabase = createServiceClient();
      const updates = body.ids.map((id: string, index: number) => ({
        id,
        priority: body.ids.length - index, // Higher priority first
      }));

      // Update each target's priority
      for (const update of updates) {
        await supabase
          .from("automation_targets")
          .update({ priority: update.priority })
          .eq("id", update.id);
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid operation" }, { status: 400 });
  } catch (error) {
    console.error("[Admin Targets] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
