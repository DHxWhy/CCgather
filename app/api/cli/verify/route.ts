import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { checkUserStarred } from "@/lib/services/github-star";
import { rateLimiters } from "@/lib/rate-limit";

const STAR_CHECK_DEADLINE_MS = 4000;
const STAR_NEGATIVE_CACHE_MS = 6 * 60 * 60 * 1000;

interface StarStatusRow {
  clerk_id: string;
  github_id: string | null;
  github_starred_at: string | null;
  github_star_checked_at: string | null;
}

export async function POST(request: NextRequest) {
  try {
    // Get API token from Authorization header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid authorization header" },
        { status: 401 }
      );
    }

    const apiToken = authHeader.slice(7);
    if (!apiToken || apiToken.length < 10) {
      return NextResponse.json({ error: "Invalid API token" }, { status: 401 });
    }

    const supabase = createServiceClient();

    // Find user by API key
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, username")
      .eq("api_key", apiToken)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: "Invalid API token" }, { status: 401 });
    }

    const wantsStarStatus = request.nextUrl.searchParams.get("star_status") === "1";
    let hasStarred: boolean | null | undefined;

    // Star status is best-effort in a separate query so it can never break
    // authentication — including when migration 079/080 has not been applied yet.
    if (wantsStarStatus) {
      hasStarred = await resolveStarStatus(supabase, user.id);
    }

    return NextResponse.json({
      userId: user.id,
      username: user.username,
      ...(wantsStarStatus ? { hasStarred } : {}),
    });
  } catch (error) {
    console.error("[CLI Verify] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function resolveStarStatus(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string
): Promise<boolean | null> {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("clerk_id, github_id, github_starred_at, github_star_checked_at")
      .eq("id", userId)
      .single();

    if (error || !data) {
      console.error("[CLI Verify] Star status lookup failed:", error);
      return null;
    }

    const row = data as StarStatusRow;
    if (row.github_starred_at) {
      return true;
    }

    // Negative cache: a recent definitive "not starred" answer is reused so
    // repeat submits don't re-run the Clerk + GitHub fan-out every time.
    if (row.github_star_checked_at) {
      const checkedAt = new Date(row.github_star_checked_at).getTime();
      if (!Number.isNaN(checkedAt) && Date.now() - checkedAt < STAR_NEGATIVE_CACHE_MS) {
        return false;
      }
    }

    // The external fan-out is bounded twice: per-key rate limit (abuse guard)
    // and an overall deadline so slow GitHub can never stall authentication.
    const rateLimit = rateLimiters.starStatus(userId);
    if (!rateLimit.success) {
      return null;
    }

    const starred = await Promise.race([
      checkUserStarred({ clerkId: row.clerk_id, githubId: row.github_id }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), STAR_CHECK_DEADLINE_MS)),
    ]);

    if (starred === true) {
      const { error: updateError } = await supabase
        .from("users")
        .update({ github_starred_at: new Date().toISOString() })
        .eq("id", userId);
      if (updateError) {
        console.error("[CLI Verify] github_starred_at update failed:", updateError);
      }
    } else if (starred === false) {
      const { error: updateError } = await supabase
        .from("users")
        .update({ github_star_checked_at: new Date().toISOString() })
        .eq("id", userId);
      if (updateError) {
        console.error("[CLI Verify] github_star_checked_at update failed:", updateError);
      }
    }

    return starred;
  } catch (error) {
    console.error("[CLI Verify] Star check failed:", error);
    return null;
  }
}
