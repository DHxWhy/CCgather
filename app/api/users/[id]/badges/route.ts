import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();

  // Fetch user's badges
  const { data: badges, error } = await supabase
    .from("user_badges")
    .select("badge_type, earned_at")
    .eq("user_id", id)
    .order("earned_at", { ascending: false });

  if (error) {
    console.error("Error fetching user badges:", error);
    return NextResponse.json({ error: "Failed to fetch badges" }, { status: 500 });
  }

  return NextResponse.json({ badges: badges || [] });
}
