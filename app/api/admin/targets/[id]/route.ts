import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import type { UpdateTargetInput } from "@/types/automation";

async function isAdmin() {
  const { userId } = await auth();
  if (!userId) return false;
  if (process.env.NODE_ENV === "development") return true;
  return true;
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Get single target
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const supabase = createServiceClient();

    const { data: target, error } = await supabase
      .from("automation_targets")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !target) {
      return NextResponse.json({ error: "Target not found" }, { status: 404 });
    }

    return NextResponse.json({ target });
  } catch (error) {
    console.error("[Admin Target] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH - Update target
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body: UpdateTargetInput = await request.json();

    const supabase = createServiceClient();

    // Build update object
    const updates: Record<string, unknown> = {};
    if (body.label !== undefined) updates.label = body.label;
    if (body.category !== undefined) updates.category = body.category;
    if (body.priority !== undefined) updates.priority = body.priority;
    if (body.is_active !== undefined) updates.is_active = body.is_active;
    if (body.metadata !== undefined) updates.metadata = body.metadata;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const { data: target, error } = await supabase
      .from("automation_targets")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[Admin Target] Update error:", error);
      return NextResponse.json({ error: "Failed to update target" }, { status: 500 });
    }

    if (!target) {
      return NextResponse.json({ error: "Target not found" }, { status: 404 });
    }

    return NextResponse.json({ target });
  } catch (error) {
    console.error("[Admin Target] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE - Delete target
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const supabase = createServiceClient();

    const { error } = await supabase.from("automation_targets").delete().eq("id", id);

    if (error) {
      console.error("[Admin Target] Delete error:", error);
      return NextResponse.json({ error: "Failed to delete target" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Admin Target] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
