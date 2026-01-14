import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

const SUPABASE_BUCKET = "thumbnails";

// GET /api/admin/thumbnail/history?content_id=xxx
// GET /api/admin/thumbnail/history?unused=true (미사용 썸네일 전체 조회)
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const contentId = searchParams.get("content_id");
    const showUnused = searchParams.get("unused") === "true";

    type HistoryItem = {
      id: string;
      name: string;
      url: string;
      created_at: string;
      size?: number;
      contentId?: string;
      isUsed?: boolean;
    };

    // Mode 1: Show all unused thumbnails across all contents
    if (showUnused) {
      // Get all files from storage
      const { data: files, error } = await supabase.storage.from(SUPABASE_BUCKET).list("", {
        sortBy: { column: "created_at", order: "desc" },
        limit: 200,
      });

      if (error) {
        console.error("[Thumbnail History] List error:", error);
        return NextResponse.json({ error: "Failed to list thumbnails" }, { status: 500 });
      }

      // Get all currently used thumbnail URLs from contents
      const { data: contents } = await supabase
        .from("contents")
        .select("id, thumbnail_url")
        .not("thumbnail_url", "is", null);

      const usedUrls = new Set(
        (contents || [])
          .map((c: { thumbnail_url: string | null }) => c.thumbnail_url)
          .filter(Boolean)
      );

      // Filter to unused thumbnails only
      const unusedThumbnails: HistoryItem[] = (files || [])
        .filter((file: { name: string }) => {
          const isImage = file.name.endsWith(".png") || file.name.endsWith(".jpg");
          if (!isImage) return false;

          const {
            data: { publicUrl },
          } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(file.name);

          return !usedUrls.has(publicUrl);
        })
        .map(
          (file: {
            id: string;
            name: string;
            created_at: string;
            metadata?: { size?: number };
          }) => {
            const {
              data: { publicUrl },
            } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(file.name);

            // Extract contentId from filename (format: contentId-timestamp.png)
            const extractedContentId = file.name.split("-")[0];

            return {
              id: file.id,
              name: file.name,
              url: publicUrl,
              created_at: file.created_at,
              size: file.metadata?.size,
              contentId: extractedContentId,
              isUsed: false,
            };
          }
        );

      return NextResponse.json({
        success: true,
        unusedThumbnails,
        total: unusedThumbnails.length,
        usedCount: usedUrls.size,
      });
    }

    // Mode 2: Show thumbnails for specific content
    if (!contentId) {
      return NextResponse.json({ error: "content_id is required" }, { status: 400 });
    }

    // List files with search prefix for this content's thumbnails
    const { data: files, error } = await supabase.storage.from(SUPABASE_BUCKET).list("", {
      sortBy: { column: "created_at", order: "desc" },
      limit: 50,
      search: contentId,
    });

    if (error) {
      console.error("[Thumbnail History] List error:", error);
      return NextResponse.json({ error: "Failed to list thumbnails" }, { status: 500 });
    }

    const currentHistory: HistoryItem[] = (files || [])
      .filter((file: { name: string }) => {
        const isImage = file.name.endsWith(".png") || file.name.endsWith(".jpg");
        const belongsToContent = file.name.startsWith(contentId);
        return isImage && belongsToContent;
      })
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
      currentHistory,
      total: currentHistory.length,
    });
  } catch (error) {
    console.error("[Thumbnail History] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/admin/thumbnail/history
// 특정 썸네일 파일 삭제 (단일 또는 다중)
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();
    const { file_name, file_names, content_id } = body;

    // Support both single and bulk delete
    const filesToDelete: string[] = file_names || (file_name ? [file_name] : []);

    if (filesToDelete.length === 0) {
      return NextResponse.json({ error: "file_name or file_names is required" }, { status: 400 });
    }

    // Security check for single content context
    if (content_id) {
      const invalidFiles = filesToDelete.filter((f) => !f.startsWith(content_id));
      if (invalidFiles.length > 0) {
        return NextResponse.json({ error: "Invalid file_name for this content" }, { status: 403 });
      }
    }

    // Delete the files from storage
    const { error } = await supabase.storage.from(SUPABASE_BUCKET).remove(filesToDelete);

    if (error) {
      console.error("[Thumbnail History] Delete error:", error);
      return NextResponse.json({ error: "Failed to delete thumbnail(s)" }, { status: 500 });
    }

    // Check if any deleted file was a current thumbnail and clear it
    for (const fileName of filesToDelete) {
      const extractedContentId = fileName.split("-")[0];
      if (extractedContentId) {
        const { data: content } = await supabase
          .from("contents")
          .select("thumbnail_url")
          .eq("id", extractedContentId)
          .single();

        if (content?.thumbnail_url?.includes(fileName)) {
          await supabase
            .from("contents")
            .update({
              thumbnail_url: null,
              thumbnail_source: null,
            })
            .eq("id", extractedContentId);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `${filesToDelete.length} thumbnail(s) deleted successfully`,
      deletedCount: filesToDelete.length,
    });
  } catch (error) {
    console.error("[Thumbnail History] Delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
