import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import { randomBytes } from "crypto";

/**
 * Authorize a device code (called from web after user login)
 * POST /api/cli/auth/device/authorize
 * Body: { user_code: string }
 *
 * Requires authenticated user (Clerk session)
 */
export async function POST(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized - Please log in first" }, { status: 401 });
    }

    const body = await request.json();
    const { user_code } = body;

    if (!user_code) {
      return NextResponse.json({ error: "user_code is required" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const user = await currentUser();

    // Find the device code
    const { data: deviceData, error: findError } = await supabase
      .from("cli_device_codes")
      .select("id, status, expires_at")
      .eq("user_code", user_code.toUpperCase())
      .single();

    if (findError || !deviceData) {
      return NextResponse.json(
        { error: "Invalid code. Please check and try again." },
        { status: 404 }
      );
    }

    // Check if expired
    if (new Date(deviceData.expires_at) < new Date()) {
      await supabase.from("cli_device_codes").update({ status: "expired" }).eq("id", deviceData.id);

      return NextResponse.json(
        { error: 'Code has expired. Please run "ccgather auth" again.' },
        { status: 410 }
      );
    }

    // Check if already used
    if (deviceData.status !== "pending") {
      return NextResponse.json(
        { error: "Code has already been used or expired." },
        { status: 410 }
      );
    }

    // Find or create user in database
    const { data: existingUser, error: userFindError } = await supabase
      .from("users")
      .select("id, api_key")
      .eq("clerk_id", clerkUserId)
      .single();

    if (userFindError && userFindError.code !== "PGRST116") {
      console.error("[Device Authorize] Error finding user:", userFindError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    let apiKey: string;
    let userId: string;

    if (!existingUser) {
      // Create new user
      apiKey = `ccg_${randomBytes(32).toString("hex")}`;
      let username = user?.username || user?.firstName || "user";

      // Try to insert, handle username conflict
      let { data: newUser, error: createError } = await supabase
        .from("users")
        .insert({
          clerk_id: clerkUserId,
          username: username,
          display_name: user?.fullName || username,
          avatar_url: user?.imageUrl,
          api_key: apiKey,
          onboarding_completed: false,
        })
        .select("id")
        .single();

      // Handle username conflict (23505 = unique_violation)
      if (createError?.code === "23505" && createError.message?.includes("username")) {
        // Append clerk_id suffix to make unique
        const uniqueUsername = `${username}_${clerkUserId.slice(0, 8)}`;
        console.log(`[Device Authorize] Username conflict, retrying with: ${uniqueUsername}`);

        const retryResult = await supabase
          .from("users")
          .insert({
            clerk_id: clerkUserId,
            username: uniqueUsername,
            display_name: user?.fullName || username,
            avatar_url: user?.imageUrl,
            api_key: apiKey,
            onboarding_completed: false,
          })
          .select("id")
          .single();

        if (retryResult.error) {
          console.error("[Device Authorize] Error creating user (retry):", retryResult.error);
          return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
        }
        newUser = retryResult.data;
        createError = null;
      }

      if (createError) {
        console.error("[Device Authorize] Error creating user:", createError);
        return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
      }

      userId = newUser!.id;
    } else if (!existingUser.api_key) {
      // Generate API key if user doesn't have one
      apiKey = `ccg_${randomBytes(32).toString("hex")}`;
      userId = existingUser.id;

      const { error: updateError } = await supabase
        .from("users")
        .update({ api_key: apiKey })
        .eq("id", existingUser.id);

      if (updateError) {
        console.error("[Device Authorize] Error updating API key:", updateError);
        return NextResponse.json({ error: "Failed to generate token" }, { status: 500 });
      }
    } else {
      apiKey = existingUser.api_key;
      userId = existingUser.id;
    }

    // Authorize the device code
    const { error: updateError } = await supabase
      .from("cli_device_codes")
      .update({
        status: "authorized",
        user_id: userId,
        api_token: apiKey,
      })
      .eq("id", deviceData.id);

    if (updateError) {
      console.error("[Device Authorize] Error authorizing device:", updateError);
      return NextResponse.json({ error: "Failed to authorize device" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "CLI authorized successfully! You can close this window.",
    });
  } catch (error) {
    console.error("[Device Authorize] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
