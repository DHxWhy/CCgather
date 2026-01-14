import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

const SUPABASE_BUCKET = "thumbnails";

// GET /api/admin/thumbnail/history?content_id=xxx
// 특정 콘텐츠의 썸네일 히스토리 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const contentId = searchParams.get("content_id");

    if (!contentId) {
      return NextResponse.json({ error: "content_id is required" }, { status: 400 });
    }

    // List all files in the bucket that match the content_id prefix
    const { data: files, error } = await supabase.storage.from(SUPABASE_BUCKET).list("", {
      search: contentId,
      sortBy: { column: "created_at", order: "desc" },
    });

    if (error) {
      console.error("[Thumbnail History] List error:", error);
      return NextResponse.json({ error: "Failed to list thumbnails" }, { status: 500 });
    }

    // Filter files that start with the content_id and get public URLs
    const history = (files || [])
      .filter((file: { name: string }) => file.name.startsWith(contentId))
      .map(
        (file: { id: string; name: string; created_at: string; metadata?: { size?: number } }) => {
          const {
            data: { publicUrl },
          } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(file.name);

          return {
            id: file.id,
            name: file.name,
            url: publicUrl,
            created_at: file.created_at,
            size: file.metadata?.size,
          };
        }
      );

    return NextResponse.json({
      success: true,
      history,
      total: history.length,
    });
  } catch (error) {
    console.error("[Thumbnail History] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/admin/thumbnail/history
// 특정 썸네일 파일 삭제
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();
    const { file_name, content_id } = body;

    if (!file_name) {
      return NextResponse.json({ error: "file_name is required" }, { status: 400 });
    }

    // Security check: file_name should start with content_id if provided
    if (content_id && !file_name.startsWith(content_id)) {
      return NextResponse.json({ error: "Invalid file_name for this content" }, { status: 403 });
    }

    // Delete the file from storage
    const { error } = await supabase.storage.from(SUPABASE_BUCKET).remove([file_name]);

    if (error) {
      console.error("[Thumbnail History] Delete error:", error);
      return NextResponse.json({ error: "Failed to delete thumbnail" }, { status: 500 });
    }

    // If this was the current thumbnail, clear it from the content
    if (content_id) {
      const { data: content } = await supabase
        .from("contents")
        .select("thumbnail_url")
        .eq("id", content_id)
        .single();

      if (content?.thumbnail_url?.includes(file_name)) {
        await supabase
          .from("contents")
          .update({
            thumbnail_url: null,
            thumbnail_source: null,
          })
          .eq("id", content_id);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Thumbnail deleted successfully",
    });
  } catch (error) {
    console.error("[Thumbnail History] Delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
