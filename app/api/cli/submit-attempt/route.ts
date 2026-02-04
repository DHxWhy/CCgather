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
      reason, // "no_sessions" | "no_data" | "scan_failed" | "auth_failed" | "network_error" | "unknown"
      debugInfo, // Optional debug information
      cliVersion,
      platform,
    } = body;

    // Get auth token
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");

    // Get IP and User Agent
    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const userAgent = request.headers.get("user-agent") || null;

    const supabase = await createServiceClient();

    let userId: string | null = null;
    let username: string | null = null;

    // Try to find user by token
    if (token) {
      const { data: user } = await supabase
        .from("users")
        .select("id, username")
        .eq("api_key", token)
        .maybeSingle();

      if (user) {
        userId = user.id;
        username = user.username;

        // Update user's last activity
        await supabase
          .from("users")
          .update({
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id);
      }
    }

    // Save to database
    const { error: insertError } = await supabase.from("cli_submit_attempts").insert({
      user_id: userId,
      reason: reason || "unknown",
      cli_version: cliVersion || null,
      platform: platform || null,
      debug_info: debugInfo
        ? {
            searchedPaths: debugInfo.searchedPaths?.length || 0,
            projectsFound: debugInfo.projectsFound || 0,
            errorMessage: debugInfo.errorMessage || null,
            ...debugInfo,
          }
        : null,
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    if (insertError) {
      console.error("[CLI Submit Attempt] DB insert error:", insertError);
      // Don't fail the request even if DB insert fails
    }

    // Log for monitoring
    console.log("[CLI Submit Attempt]", {
      user_id: userId || "anonymous",
      username: username || "anonymous",
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
    case "auth_failed":
      return "Authentication failed. Please run 'ccgather auth' to re-authenticate.";
    case "network_error":
      return "Network error occurred. Please check your internet connection.";
    default:
      return "Please try again or contact support.";
  }
}
