import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { auth } from "@clerk/nextjs/server";
import type { AdminUpdateToolRequest } from "@/types/tools";

// =====================================================
// PATCH /api/admin/tools/[id] - 도구 수정 (상태 변경 포함)
// =====================================================
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: toolId } = await params;
    const supabase = createServiceClient();

    // Check if user is admin
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, is_admin")
      .eq("clerk_id", userId)
      .single();

    if (userError || !user || !user.is_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if tool exists
    const { data: existingTool, error: toolError } = await supabase
      .from("tools")
      .select("id, status")
      .eq("id", toolId)
      .single();

    if (toolError || !existingTool) {
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });
    }

    const body: AdminUpdateToolRequest = await request.json();

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.status !== undefined) {
      updateData.status = body.status;

      // Set approved_at when approving
      if (
        ["approved", "featured"].includes(body.status) &&
        !existingTool.status.match(/approved|featured/)
      ) {
        updateData.approved_at = new Date().toISOString();
      }
    }

    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.tagline !== undefined) updateData.tagline = body.tagline.trim();
    if (body.description !== undefined) updateData.description = body.description?.trim() || null;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.pricing_type !== undefined) updateData.pricing_type = body.pricing_type;
    if (body.logo_url !== undefined) updateData.logo_url = body.logo_url?.trim() || null;
    if (body.tags !== undefined) updateData.tags = body.tags;

    // Update tool
    const { data: updatedTool, error: updateError } = await supabase
      .from("tools")
      .update(updateData)
      .eq("id", toolId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating tool:", updateError);
      return NextResponse.json({ error: "Failed to update tool" }, { status: 500 });
    }

    return NextResponse.json({ success: true, tool: updatedTool });
  } catch (error) {
    console.error("Error in PATCH /api/admin/tools/[id]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// =====================================================
// DELETE /api/admin/tools/[id] - 도구 삭제
// =====================================================
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: toolId } = await params;
    const supabase = createServiceClient();

    // Check if user is admin
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, is_admin")
      .eq("clerk_id", userId)
      .single();

    if (userError || !user || !user.is_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if tool exists
    const { data: existingTool, error: toolError } = await supabase
      .from("tools")
      .select("id, name")
      .eq("id", toolId)
      .single();

    if (toolError || !existingTool) {
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });
    }

    // Delete tool (cascades to votes and bookmarks)
    const { error: deleteError } = await supabase.from("tools").delete().eq("id", toolId);

    if (deleteError) {
      console.error("Error deleting tool:", deleteError);
      return NextResponse.json({ error: "Failed to delete tool" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Tool "${existingTool.name}" has been deleted`,
    });
  } catch (error) {
    console.error("Error in DELETE /api/admin/tools/[id]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
