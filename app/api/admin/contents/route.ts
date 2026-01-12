import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";

interface ContentRow {
  type: string;
  status: string;
}

async function isAdmin() {
  const { userId } = await auth();
  if (!userId) return false;
  if (process.env.NODE_ENV === "development") return true;
  return true;
}

export async function GET(request: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type") || "all"; // 'news', 'youtube', 'all'
    const status = searchParams.get("status") || "all"; // 'pending', 'ready', 'published', 'rejected', 'all'
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const supabase = createServiceClient();

    let query = supabase
      .from("contents")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (type !== "all") {
      query = query.eq("type", type);
    }

    if (status !== "all") {
      query = query.eq("status", status);
    }

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: contents, error, count } = await query;

    if (error) {
      console.error("[Admin Contents] Error:", error);
      return NextResponse.json({ error: "Failed to fetch contents" }, { status: 500 });
    }

    // Get stats
    const { data: statsData } = await supabase.from("contents").select("type, status");

    const stats = {
      total: statsData?.length || 0,
      news: statsData?.filter((c: ContentRow) => c.type === "news").length || 0,
      youtube: statsData?.filter((c: ContentRow) => c.type === "youtube").length || 0,
      pending: statsData?.filter((c: ContentRow) => c.status === "pending").length || 0,
      ready: statsData?.filter((c: ContentRow) => c.status === "ready").length || 0,
      published: statsData?.filter((c: ContentRow) => c.status === "published").length || 0,
      rejected: statsData?.filter((c: ContentRow) => c.status === "rejected").length || 0,
    };

    return NextResponse.json({
      contents: contents || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
      stats,
    });
  } catch (error) {
    console.error("[Admin Contents] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { type, source_url, title, ...rest } = body;

    if (!type || !source_url) {
      return NextResponse.json({ error: "type and source_url are required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: content, error } = await supabase
      .from("contents")
      .insert({
        type,
        source_url,
        title: title || "Untitled",
        status: "pending",
        ...rest,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Content with this URL already exists" },
          { status: 409 }
        );
      }
      console.error("[Admin Contents] Insert error:", error);
      return NextResponse.json({ error: "Failed to create content" }, { status: 500 });
    }

    return NextResponse.json({ content }, { status: 201 });
  } catch (error) {
    console.error("[Admin Contents] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
