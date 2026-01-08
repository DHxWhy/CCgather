import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import { z } from "zod";
import { randomBytes } from "crypto";

const UpdateProfileSchema = z.object({
  country_code: z.string().length(2).optional(),
  timezone: z.string().optional(),
  onboarding_completed: z.boolean().optional(),
  marketing_consent: z.boolean().optional(),
});

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: user, error } = await supabase
    .from("users")
    .select(
      `
      id,
      username,
      display_name,
      avatar_url,
      country_code,
      timezone,
      level,
      global_rank,
      country_rank,
      total_tokens,
      total_cost,
      onboarding_completed,
      is_admin,
      created_at
    `
    )
    .eq("clerk_id", userId)
    .single();

  if (error || !user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user });
}

export async function PATCH(request: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = UpdateProfileSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // First, check if user exists
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("clerk_id", userId)
      .maybeSingle();

    let user;
    let error;

    // Prepare update data with marketing consent timestamp
    const updateData: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.marketing_consent !== undefined) {
      updateData.marketing_consent_at = new Date().toISOString();
    }

    if (!existingUser) {
      // User doesn't exist, create them with the profile data
      const clerkUser = await currentUser();
      if (!clerkUser) {
        return NextResponse.json({ error: "Failed to get user info" }, { status: 500 });
      }

      const displayName =
        [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
        clerkUser.username ||
        "Anonymous";

      const { error: insertError } = await supabase.from("users").insert({
        clerk_id: userId,
        username: clerkUser.username || `user_${userId.slice(0, 8)}`,
        display_name: displayName,
        avatar_url: clerkUser.imageUrl,
        email: clerkUser.emailAddresses[0]?.emailAddress,
        ...updateData,
      });

      if (insertError) {
        console.error("Failed to create user:", insertError);
        return NextResponse.json(
          { error: `Failed to create user: ${insertError.message}` },
          { status: 500 }
        );
      }

      // Fetch the created user
      const { data: newUser, error: fetchError } = await supabase
        .from("users")
        .select("*")
        .eq("clerk_id", userId)
        .maybeSingle();

      user = newUser;
      error = fetchError;
    } else {
      // User exists, update them
      const { error: updateError } = await supabase
        .from("users")
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq("clerk_id", userId);

      if (updateError) {
        console.error("Failed to update user:", updateError);
        return NextResponse.json(
          { error: `Failed to update profile: ${updateError.message}` },
          { status: 500 }
        );
      }

      // Fetch the updated user
      const { data: updatedUser, error: fetchError } = await supabase
        .from("users")
        .select("*")
        .eq("clerk_id", userId)
        .maybeSingle();

      user = updatedUser;
      error = fetchError;
    }

    if (error) {
      console.error("Failed to update user:", error);
      return NextResponse.json(
        { error: `Failed to update profile: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("PATCH /api/me error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  try {
    const body = await request.json();
    const action = body.action;

    if (action === "generate_api_key") {
      const apiKey = `ccg_${randomBytes(32).toString("hex")}`;

      const { data: user, error } = await supabase
        .from("users")
        .update({
          api_key: apiKey,
          updated_at: new Date().toISOString(),
        })
        .eq("clerk_id", userId)
        .select("api_key")
        .single();

      if (error) {
        console.error("Failed to generate API key:", error);
        return NextResponse.json({ error: "Failed to generate API key" }, { status: 500 });
      }

      return NextResponse.json({ api_key: user.api_key });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/me error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
