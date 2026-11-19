import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import { cliStatusFromEvent } from "@/lib/cli/update-notice";
import type { SubmitEventOutcome } from "@/lib/services/submit-rate-limit";

const ACCEPTED: SubmitEventOutcome = "accepted";
const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  }

  const supabase = createServiceClient();
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", userId)
    .is("deleted_at", null)
    .maybeSingle();
  if (userError) {
    console.error("[cli-status] user lookup failed:", userError.message);
    return NextResponse.json({ error: "Failed to read user" }, { status: 500, headers: NO_STORE });
  }
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404, headers: NO_STORE });
  }

  const { data: event, error: eventError } = await supabase
    .from("submit_events")
    .select("cli_version")
    .eq("user_id", user.id)
    .eq("outcome", ACCEPTED)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (eventError) {
    console.error("[cli-status] submit event lookup failed:", eventError.message);
    return NextResponse.json(
      { error: "Failed to read submits" },
      { status: 500, headers: NO_STORE }
    );
  }

  return NextResponse.json(cliStatusFromEvent(event), { headers: NO_STORE });
}
