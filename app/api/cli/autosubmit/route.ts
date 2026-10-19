import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/cli/autosubmit — the CLI reports the result of `autosubmit on` /
 * `autosubmit off` (2.3.1+). Together with the scheduled flag on submits this
 * is what the admin page's "자동 제출" column reads (migration 081). The CLI
 * treats it as best-effort: a failure here never fails the command.
 */
export async function POST(request: NextRequest) {
  try {
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

    const body = (await request.json().catch(() => null)) as {
      enabled?: unknown;
      cliVersion?: unknown;
    } | null;
    if (!body || typeof body.enabled !== "boolean") {
      return NextResponse.json(
        { error: "Invalid payload: enabled(boolean) required" },
        { status: 400 }
      );
    }
    const cliVersion =
      typeof body.cliVersion === "string" ? body.cliVersion.slice(0, 32) : "unknown";

    const supabase = createServiceClient();

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, username")
      .eq("api_key", apiToken)
      .maybeSingle();

    if (userError || !user) {
      if (userError) {
        console.error("[CLI Autosubmit] DB Error:", userError);
      }
      return NextResponse.json({ error: "Invalid API token" }, { status: 401 });
    }

    const { error: updateError } = await supabase
      .from("users")
      .update({
        auto_sync_enabled: body.enabled,
        auto_sync_reported_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) {
      console.error(
        "[CLI Autosubmit] update failed (migration 081 applied?):",
        updateError.message
      );
      return NextResponse.json({ error: "Failed to record auto-submit state" }, { status: 500 });
    }

    console.log(
      `[CLI Autosubmit] ${user.username}: ${body.enabled ? "on" : "off"} (cli ${cliVersion})`
    );
    return NextResponse.json({ success: true, enabled: body.enabled });
  } catch (error) {
    console.error("[CLI Autosubmit] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
