import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * CLI Submit Attempt Log API
 *
 * Records when a user attempts to submit but fails before data is sent.
 * This helps track users who are trying to use the service but encountering issues.
 *
 * POST /api/cli/submit-attempt
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      reason, // "no_sessions" | "no_data" | "scan_failed"
      debugInfo, // Optional debug information
      cliVersion,
      platform,
    } = body;

    // Get auth token
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      // Even without token, log the attempt for debugging
      console.log("[CLI Submit Attempt] Anonymous attempt:", {
        reason,
        platform,
        cliVersion,
        timestamp: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        message: "Attempt logged (anonymous)",
      });
    }

    const supabase = await createServiceClient();

    // Try to find user by token
    const { data: user } = await supabase
      .from("users")
      .select("id, username")
      .eq("api_key", token)
      .maybeSingle();

    // Log the attempt
    console.log("[CLI Submit Attempt]", {
      user_id: user?.id || "anonymous",
      username: user?.username || "anonymous",
      reason,
      platform,
      cliVersion,
      debugInfo: debugInfo
        ? {
            searchedPaths: debugInfo.searchedPaths?.length || 0,
            projectsFound: debugInfo.projectsFound || 0,
          }
        : null,
      timestamp: new Date().toISOString(),
    });

    // Update user's last activity if found
    if (user) {
      await supabase
        .from("users")
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);
    }

    return NextResponse.json({
      success: true,
      message: "Attempt logged",
      hint: getHintForReason(reason),
    });
  } catch (error) {
    console.error("[CLI Submit Attempt] Error:", error);
    return NextResponse.json({ error: "Failed to log attempt" }, { status: 500 });
  }
}

function getHintForReason(reason: string): string {
  switch (reason) {
    case "no_sessions":
      return "Make sure you have used Claude Code and sent at least one message.";
    case "no_data":
      return "Session files exist but contain no usage data. Try using Claude Code again.";
    case "scan_failed":
      return "Failed to read session files. Check file permissions.";
    default:
      return "Please try again or contact support.";
  }
}
