import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Poll for device code authorization status
 * GET /api/cli/auth/device/poll?device_code=xxx
 *
 * Returns:
 * - pending: { status: 'pending' }
 * - authorized: { status: 'authorized', token, userId, username }
 * - expired: { status: 'expired', error: '...' }
 */
export async function GET(request: NextRequest) {
  try {
    const deviceCode = request.nextUrl.searchParams.get("device_code");

    if (!deviceCode) {
      return NextResponse.json({ error: "device_code is required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Find the device code
    const { data: deviceData, error: findError } = await supabase
      .from("cli_device_codes")
      .select(
        `
        id,
        status,
        api_token,
        user_id,
        expires_at,
        users (
          id,
          username
        )
      `
      )
      .eq("device_code", deviceCode)
      .single();

    if (findError || !deviceData) {
      return NextResponse.json({ error: "Invalid or expired device code" }, { status: 404 });
    }

    // Check if expired
    if (new Date(deviceData.expires_at) < new Date()) {
      // Mark as expired
      await supabase
        .from("cli_device_codes")
        .update({ status: "expired" })
        .eq("device_code", deviceCode);

      return NextResponse.json(
        { status: "expired", error: "Device code has expired" },
        { status: 410 }
      );
    }

    // Check status
    if (deviceData.status === "pending") {
      return NextResponse.json({ status: "pending" });
    }

    if (deviceData.status === "expired") {
      return NextResponse.json(
        { status: "expired", error: "Device code has expired" },
        { status: 410 }
      );
    }

    if (deviceData.status === "used") {
      return NextResponse.json(
        { status: "used", error: "Device code has already been used" },
        { status: 410 }
      );
    }

    if (deviceData.status === "authorized" && deviceData.api_token) {
      // Mark as used to prevent reuse
      await supabase
        .from("cli_device_codes")
        .update({ status: "used" })
        .eq("device_code", deviceCode);

      // users can be array (many-to-one) or object (one-to-one)
      const users = deviceData.users;
      const user = Array.isArray(users) ? users[0] : users;

      return NextResponse.json({
        status: "authorized",
        token: deviceData.api_token,
        userId: deviceData.user_id,
        username: user?.username || "user",
      });
    }

    return NextResponse.json({ status: "pending" });
  } catch (error) {
    console.error("[Device Poll] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
