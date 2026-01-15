import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import { z } from "zod";
import { randomBytes } from "crypto";

const SocialLinksSchema = z
  .object({
    github: z.string().optional(),
    twitter: z.string().optional(),
    linkedin: z.string().optional(),
    website: z.string().url().optional().or(z.literal("")),
  })
  .optional();

const UpdateProfileSchema = z.object({
  country_code: z.string().length(2).optional(),
  timezone: z.string().optional(),
  onboarding_completed: z.boolean().optional(),
  marketing_consent: z.boolean().optional(),
  profile_visibility_consent: z.boolean().optional(),
  community_updates_consent: z.boolean().optional(),
  social_links: SocialLinksSchema,
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
      current_level,
      global_rank,
      country_rank,
      total_tokens,
      total_cost,
      onboarding_completed,
      is_admin,
      social_links,
      created_at
    `
    )
    .eq("clerk_id", userId)
    .single();

  if (error || !user) {
    // User not found - auto-create from Clerk data (webhook may have failed/delayed)
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Failed to get user info" }, { status: 500 });
    }

    const displayName =
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
      clerkUser.username ||
      "Anonymous";

    const { data: newUser, error: insertError } = await supabase
      .from("users")
      .insert({
        clerk_id: userId,
        username: clerkUser.username || `user_${userId.slice(0, 8)}`,
        display_name: displayName,
        avatar_url: clerkUser.imageUrl,
        email: clerkUser.emailAddresses[0]?.emailAddress,
        onboarding_completed: false, // New user needs onboarding
      })
      .select(
        `
        id,
        username,
        display_name,
        avatar_url,
        country_code,
        timezone,
        current_level,
        global_rank,
        country_rank,
        total_tokens,
        total_cost,
        onboarding_completed,
        is_admin,
        social_links,
        created_at
      `
      )
      .single();

    if (insertError) {
      // Handle unique constraint violation (user was created between check and insert)
      if (insertError.code === "23505") {
        // Check if it's username conflict - try to find by clerk_id first
        const { data: existingByClerkId } = await supabase
          .from("users")
          .select(
            `
            id,
            username,
            display_name,
            avatar_url,
            country_code,
            timezone,
            current_level,
            global_rank,
            country_rank,
            total_tokens,
            total_cost,
            onboarding_completed,
            is_admin,
            social_links,
            created_at
          `
          )
          .eq("clerk_id", userId)
          .single();

        if (existingByClerkId) {
          return NextResponse.json(
            { user: existingByClerkId },
            {
              headers: {
                "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
                Pragma: "no-cache",
                Expires: "0",
              },
            }
          );
        }

        // If not found by clerk_id, username conflict with another user
        // Try with a unique username suffix
        const uniqueUsername = `${clerkUser.username || "user"}_${userId.slice(0, 8)}`;
        const { data: retryUser, error: retryError } = await supabase
          .from("users")
          .insert({
            clerk_id: userId,
            username: uniqueUsername,
            display_name: displayName,
            avatar_url: clerkUser.imageUrl,
            email: clerkUser.emailAddresses[0]?.emailAddress,
            onboarding_completed: false,
          })
          .select(
            `
            id,
            username,
            display_name,
            avatar_url,
            country_code,
            timezone,
            current_level,
            global_rank,
            country_rank,
            total_tokens,
            total_cost,
            onboarding_completed,
            is_admin,
            social_links,
            created_at
          `
          )
          .single();

        if (!retryError && retryUser) {
          console.log("Created user with unique username:", {
            clerk_id: userId,
            username: uniqueUsername,
          });
          return NextResponse.json(
            { user: retryUser },
            {
              headers: {
                "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
                Pragma: "no-cache",
                Expires: "0",
              },
            }
          );
        }
      }
      console.error("Failed to auto-create user:", insertError);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    console.log("Auto-created user from /api/me GET:", { clerk_id: userId, user_id: newUser?.id });

    return NextResponse.json(
      { user: newUser },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  }

  // Auto-populate GitHub from Clerk OAuth if not set
  const socialLinks = (user.social_links as Record<string, string> | null) || {};
  if (!socialLinks.github) {
    const clerkUser = await currentUser();

    // Debug logging
    console.log("[/api/me] Auto-populate GitHub check:", {
      userId,
      clerkUsername: clerkUser?.username,
      externalAccounts: clerkUser?.externalAccounts?.map((a) => ({
        provider: a.provider,
        username: a.username,
      })),
      currentSocialLinks: socialLinks,
    });

    // Check for GitHub account - provider can be "github" or "oauth_github"
    const githubAccount = clerkUser?.externalAccounts?.find((account) =>
      account.provider.toLowerCase().includes("github")
    );

    // Get GitHub username from external account or Clerk username (often same as GitHub when using GitHub OAuth)
    const githubUsername = githubAccount?.username || clerkUser?.username;

    console.log("[/api/me] GitHub username resolved:", githubUsername);

    if (githubUsername) {
      const updatedSocialLinks = { ...socialLinks, github: githubUsername };

      // Auto-save to database
      const { error: updateError } = await supabase
        .from("users")
        .update({ social_links: updatedSocialLinks })
        .eq("clerk_id", userId);

      if (updateError) {
        console.error("[/api/me] Failed to update social_links:", updateError);
      } else {
        console.log("[/api/me] Successfully updated social_links:", updatedSocialLinks);
      }

      // Return updated user data
      return NextResponse.json(
        { user: { ...user, social_links: updatedSocialLinks } },
        {
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        }
      );
    }
  }

  // Add cache control headers to prevent stale data
  return NextResponse.json(
    { user },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
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

    // Prepare update data with consent timestamps
    const updateData: Record<string, unknown> = { ...parsed.data };
    const now = new Date().toISOString();
    if (parsed.data.marketing_consent !== undefined) {
      updateData.marketing_consent_at = now;
    }
    if (parsed.data.profile_visibility_consent !== undefined) {
      updateData.profile_visibility_consent_at = now;
    }
    if (parsed.data.community_updates_consent !== undefined) {
      updateData.community_updates_consent_at = now;
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

      // Use INSERT with RETURNING to get the created user directly
      const { data: newUser, error: insertError } = await supabase
        .from("users")
        .insert({
          clerk_id: userId,
          username: clerkUser.username || `user_${userId.slice(0, 8)}`,
          display_name: displayName,
          avatar_url: clerkUser.imageUrl,
          email: clerkUser.emailAddresses[0]?.emailAddress,
          ...updateData,
        })
        .select("*")
        .single();

      if (insertError) {
        console.error("Failed to create user:", insertError);
        return NextResponse.json(
          { error: `Failed to create user: ${insertError.message}` },
          { status: 500 }
        );
      }

      user = newUser;

      // Verify onboarding_completed was set correctly
      if (parsed.data.onboarding_completed && !newUser?.onboarding_completed) {
        console.error("Onboarding verification failed - INSERT:", {
          requested: parsed.data.onboarding_completed,
          actual: newUser?.onboarding_completed,
          user_id: newUser?.id,
        });
      }
    } else {
      // User exists, update them with RETURNING to verify update
      const { data: updatedUser, error: updateError } = await supabase
        .from("users")
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq("clerk_id", userId)
        .select("*")
        .single();

      if (updateError) {
        console.error("Failed to update user:", updateError);
        return NextResponse.json(
          { error: `Failed to update profile: ${updateError.message}` },
          { status: 500 }
        );
      }

      // Verify the update actually happened
      if (!updatedUser) {
        console.error("Update returned no user - possible race condition:", {
          clerk_id: userId,
          updateData,
        });
        return NextResponse.json(
          { error: "Failed to update profile: No user found after update" },
          { status: 500 }
        );
      }

      // Verify onboarding_completed was set correctly
      if (parsed.data.onboarding_completed && !updatedUser.onboarding_completed) {
        console.error("Onboarding verification failed - UPDATE:", {
          requested: parsed.data.onboarding_completed,
          actual: updatedUser.onboarding_completed,
          user_id: updatedUser.id,
        });
        // Force another attempt with explicit value
        const { data: retryUser, error: retryError } = await supabase
          .from("users")
          .update({ onboarding_completed: true, updated_at: new Date().toISOString() })
          .eq("id", updatedUser.id)
          .select("*")
          .single();

        if (!retryError && retryUser) {
          user = retryUser;
        } else {
          user = updatedUser;
        }
      } else {
        user = updatedUser;
      }
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("PATCH /api/me error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// =====================================================
// DELETE /api/me - Soft Delete (3일 유예 기간)
// =====================================================
export async function DELETE() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  try {
    // Call the soft_delete_user function
    const { data, error } = await supabase.rpc("soft_delete_user", {
      target_clerk_id: userId,
    });

    if (error) {
      console.error("Soft delete error:", error);
      return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
    }

    if (!data.success) {
      return NextResponse.json({ error: data.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: "계정이 3일 후 완전히 삭제됩니다. 그 전에 로그인하시면 복구할 수 있습니다.",
      deleted_at: data.deleted_at,
      deletion_scheduled_at: data.expires_at,
    });
  } catch (error) {
    console.error("DELETE /api/me error:", error);
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
