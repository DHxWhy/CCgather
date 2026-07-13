import { NextResponse } from "next/server";
import { getPublicStats } from "@/lib/services/publicStats";

export async function GET() {
  try {
    const stats = await getPublicStats();
    return NextResponse.json(stats, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600" },
    });
  } catch (error) {
    console.error("[Public Stats] failed:", error);
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
  }
}
