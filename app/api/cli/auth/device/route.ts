import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { randomBytes } from "crypto";

/**
 * Generate a new device code for CLI authentication
 * POST /api/cli/auth/device
 *
 * Returns device_code (for polling) and user_code (for display/URL)
 */
export async function POST() {
  try {
    const supabase = createServiceClient();

    // Generate codes
    const deviceCode = randomBytes(32).toString("hex");
    const userCode = randomBytes(4).toString("hex").toUpperCase(); // 8 char code like "A1B2C3D4"

    // Calculate expiration (15 minutes)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // Insert into database
    const { error } = await supabase.from("cli_device_codes").insert({
      device_code: deviceCode,
      user_code: userCode,
      status: "pending",
      expires_at: expiresAt,
    });

    if (error) {
      console.error("[Device Auth] Error creating device code:", error);
      return NextResponse.json({ error: "Failed to create device code" }, { status: 500 });
    }

    return NextResponse.json({
      device_code: deviceCode,
      user_code: userCode,
      verification_uri: `${process.env.NEXT_PUBLIC_APP_URL || "https://ccgather.dev"}/cli/auth`,
      verification_uri_complete: `${process.env.NEXT_PUBLIC_APP_URL || "https://ccgather.dev"}/cli/auth?code=${userCode}`,
      expires_in: 900, // 15 minutes in seconds
      interval: 5, // Poll every 5 seconds
    });
  } catch (error) {
    console.error("[Device Auth] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
