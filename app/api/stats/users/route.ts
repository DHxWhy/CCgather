import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const { count, error } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true });

    if (error) {
      console.error("Failed to get user count:", error);
      return NextResponse.json({ count: null });
    }

    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: null });
  }
}
