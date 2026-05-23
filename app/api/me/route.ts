import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { randomBytes } from "crypto";

// Pending-referral attribution: set by /api/referral/[code] (cookie) and
// claimed on the first authenticated /api/me GET so attribution lands before
// onboarding instead of after. localStorage path (/api/referral/claim) is the
// fallback for when the cookie is unavailable (cross-device, cleared cookies).
const PENDING_REF_COOKIE = "ccg_pending_ref";

async function tryClaimPendingReferral(
  supabase: SupabaseClient,
  userRowId: string,
  currentReferredBy: string | null | undefined,
  pendingCode: string | null
): Promise<void> {
  if (!pendingCode || currentReferredBy) return;

  const { data: inviter } = await supabase
    .from("users")
    .select("id")
    .eq("referral_code", pendingCode.toLowerCase())
    .is("deleted_at", null)
    .single();

  if (!inviter || inviter.id === userRowId) return;

  // Atomic — same guard pattern as POST /api/referral/claim.
  // Silent on conflict: the cookie is single-use; we don't surface failures here.
  const { error } = await supabase
    .from("users")
    .update({ referred_by: inviter.id })
    .eq("id", userRowId)
    .is("referred_by", null);

  if (error) {
    console.error("[/api/me] Pending referral claim failed:", error);
  }
}

function clearPendingRefCookie(response: NextResponse, hadCookie: boolean): NextResponse {
  // Single-use: clear regardless of claim outcome to avoid re-attempting next request.
  if (hadCookie) {
    response.cookies.set({
      name: PENDING_REF_COOKIE,
      value: "",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
  }
  return response;
}

// Generate 5-character alphanumeric referral code (CSPRNG)
function generateShortCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(bytes[i]! % chars.length);
  }
  return code;
}

const SocialLinksSchema = z
  .object({
    github: z.string().optional(),
    twitter: z.string().optional(),
    linkedin: z.string().optional(),
    // Allow URL with or without protocol (will be normalized)
    website: z
      .string()
      .refine(
        (val) => {
          if (!val || val === "") return true;
          try {
            const url = val.startsWith("http") ? val : `https://${val}`;
            new URL(url);
            return true;
          } catch {
            return false;
          }
        },
        { message: "Invalid URL format" }
      )
      .optional()
      .or(z.literal("")),
  })
  .optional();

const UpdateProfileSchema = z.object({
  country_code: z.string().length(2).optional(),
  timezone: z.string().optional(),
  onboarding_completed: z.boolean().optional(),
  marketing_consent: z.boolean().optional(),
  profile_visibility_consent: z.boolean().optional(),
  community_updates_consent: z.boolean().optional(),
  integrity_agreed: z.boolean().optional(),
  social_links: SocialLinksSchema,
  hide_profile_on_invite: z.boolean().optional(),
  custom_avatar_url: z
    .string()
    .nullable()
    .optional()
    .refine(
      (val) => val === null || val === undefined || val.startsWith("https://api.dicebear.com/"),
      { message: "Must be a valid DiceBear URL" }
    ), // DiceBear avatar URL or null to reset
});

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Read pending-referral cookie up-front; consumed once across all response branches.
  const cookieStore = await cookies();
  const pendingRefCode = cookieStore.get(PENDING_REF_COOKIE)?.value ?? null;
  const hadPendingRefCookie = pendingRefCode !== null;

  const { data: user, error } = await supabase
    .from("users")
    .select(
      `
      id,
      username,
      display_name,
      avatar_url,
      custom_avatar_url,
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
      referral_code,
      referred_by,
      hide_profile_on_invite,
      ccplan,
      github_id,
      created_at,
      last_submission_at
    `
    )
    .eq("clerk_id", userId)
    .is("deleted_at", null)
    .single();

  // Claim pending referral as soon as the user row is known — runs before any
  // response branch so subsequent reads see the updated referred_by.
  if (!error && user && hadPendingRefCookie) {
    await tryClaimPendingReferral(supabase, user.id, user.referred_by, pendingRefCode);
  }

  if (error || !user) {
    // User not found by clerk_id - check if existing user with same email
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Failed to get user info" }, { status: 500 });
    }

    const email = clerkUser.emailAddresses[0]?.emailAddress;

    // Account linking by email: only safe when we can prove the same identity owns it.
    // GitHub email is mutable/recyclable, so email alone is insufficient — we also require
    // the immutable GitHub numeric ID (provider_user_id) to match. For legacy rows that
    // pre-date github_id storage, we backfill from Clerk OAuth on first match.
    const githubAccount = clerkUser.externalAccounts?.find(
      (acc) => acc.provider === "oauth_github"
    );
    const currentProvider = clerkUser.externalAccounts?.[0]?.provider;
    // Clerk Backend SDK exposes the provider's user ID as `externalId`
    // (webhook JSON payload uses snake_case `provider_user_id` — different field name, same value)
    const githubId = githubAccount?.externalId || null;

    if (email && currentProvider === "oauth_github") {
      const { data: existingByEmail } = await supabase
        .from("users")
        .select(
          `
          id,
          github_id,
          username,
          display_name,
          avatar_url,
          custom_avatar_url,
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
          referred_by,
          created_at,
          last_submission_at
        `
        )
        .eq("email", email)
        .is("deleted_at", null)
        .single();

      if (existingByEmail) {
        // Verify the GitHub numeric ID matches (or backfill if absent).
        // If the existing row has a github_id that differs from the current Clerk
        // user's GitHub ID, this is a different person who happens to share the
        // recycled email — DO NOT link, fall through to creating a new account.
        const existingGithubId = existingByEmail.github_id;
        const isSameIdentity =
          !existingGithubId || // legacy row → backfill on link
          !githubId || // Clerk didn't expose ID → conservative: still link (provider-guarded)
          existingGithubId === githubId;

        if (!isSameIdentity) {
          console.warn("[/api/me] Refusing to link by email — github_id mismatch:", {
            email,
            existing_github_id: existingGithubId,
            incoming_github_id: githubId,
          });
        } else {
          // Found existing account with same email + matching identity — link clerk_id
          console.log("[/api/me] Linking existing account by email:", {
            email,
            old_user_id: existingByEmail.id,
            new_clerk_id: userId,
            backfilled_github_id: !existingGithubId && !!githubId,
          });

          const linkUpdate: Record<string, unknown> = {
            clerk_id: userId,
            updated_at: new Date().toISOString(),
          };
          // Backfill github_id only when missing — never overwrite a divergent value
          if (!existingGithubId && githubId) {
            linkUpdate.github_id = githubId;
          }

          const { error: linkError } = await supabase
            .from("users")
            .update(linkUpdate)
            .eq("id", existingByEmail.id);

          if (linkError) {
            console.error("[/api/me] Failed to link account:", linkError);
          } else {
            // Apply pending referral to the now-linked account
            if (hadPendingRefCookie) {
              await tryClaimPendingReferral(
                supabase,
                existingByEmail.id,
                existingByEmail.referred_by,
                pendingRefCode
              );
            }

            // Get referral count for this user
            const { count: existingReferralCount } = await supabase
              .from("users")
              .select("*", { count: "exact", head: true })
              .eq("referred_by", existingByEmail.id);

            // Return the existing user (now linked to new clerk_id)
            return clearPendingRefCookie(
              NextResponse.json(
                { user: { ...existingByEmail, referral_count: existingReferralCount || 0 } },
                {
                  headers: {
                    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
                    Pragma: "no-cache",
                    Expires: "0",
                  },
                }
              ),
              hadPendingRefCookie
            );
          }
        }
      }
    }

    // No existing account found - create new user
    const displayName =
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
      clerkUser.username ||
      "Anonymous";

    const baseUsername = clerkUser.username || `user_${userId.slice(0, 8)}`;
    const referralCode = generateShortCode();

    const { data: newUser, error: insertError } = await supabase
      .from("users")
      .insert({
        clerk_id: userId,
        github_id: githubId,
        username: baseUsername,
        display_name: displayName,
        avatar_url: clerkUser.imageUrl,
        email: email,
        onboarding_completed: false, // New user needs onboarding
        referral_code: referralCode,
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
          if (hadPendingRefCookie) {
            // existingByClerkId SELECT doesn't include referred_by; pass undefined
            // so tryClaim does an extra lookup-free atomic update (the WHERE
            // referred_by IS NULL guard inside is the real protection).
            await tryClaimPendingReferral(
              supabase,
              existingByClerkId.id,
              undefined,
              pendingRefCode
            );
          }
          return clearPendingRefCookie(
            NextResponse.json(
              { user: existingByClerkId },
              {
                headers: {
                  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
                  Pragma: "no-cache",
                  Expires: "0",
                },
              }
            ),
            hadPendingRefCookie
          );
        }

        // Username and/or referral_code conflict with another row.
        // Both have UNIQUE constraints; both can collide independently. Retry
        // up to 5 times with fresh random suffixes — covers birthday-paradox
        // collisions on a 36^5 referral_code space at higher signup volumes.
        const baseUsername = clerkUser.username || "user";
        const MAX_INSERT_RETRIES = 5;
        let retryUser: { id: string; [k: string]: unknown } | null = null;
        let lastRetryError: { code?: string; message?: string } | null = null;

        for (let attempt = 1; attempt <= MAX_INSERT_RETRIES; attempt++) {
          // Each attempt: unique username suffix (attempt index disambiguates
          // if first suffix itself collides) + freshly generated referral_code
          const uniqueUsername =
            attempt === 1
              ? `${baseUsername}_${userId.slice(0, 8)}`
              : `${baseUsername}_${userId.slice(0, 8)}_${attempt}`;
          const retryReferralCode = generateShortCode();

          const { data, error: retryError } = await supabase
            .from("users")
            .insert({
              clerk_id: userId,
              github_id: githubId,
              username: uniqueUsername,
              display_name: displayName,
              avatar_url: clerkUser.imageUrl,
              email: clerkUser.emailAddresses[0]?.emailAddress,
              onboarding_completed: false,
              referral_code: retryReferralCode,
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

          if (!retryError && data) {
            retryUser = data;
            console.log("[/api/me] Created user with unique fields:", {
              clerk_id: userId,
              username: uniqueUsername,
              attempt,
            });
            break;
          }

          lastRetryError = retryError;
          // Non-UNIQUE failures aren't fixable by retrying with new codes
          if (retryError?.code !== "23505") break;
        }

        if (retryUser) {
          if (hadPendingRefCookie) {
            await tryClaimPendingReferral(supabase, retryUser.id, null, pendingRefCode);
          }
          return clearPendingRefCookie(
            NextResponse.json(
              { user: retryUser },
              {
                headers: {
                  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
                  Pragma: "no-cache",
                  Expires: "0",
                },
              }
            ),
            hadPendingRefCookie
          );
        }

        console.error("[/api/me] Auto-create exhausted retries:", {
          clerk_id: userId,
          lastErrorCode: lastRetryError?.code,
          lastErrorMessage: lastRetryError?.message,
        });
      }
      console.error("Failed to auto-create user:", insertError);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    console.log("Auto-created user from /api/me GET:", { clerk_id: userId, user_id: newUser?.id });

    // Brand-new account → referred_by is null; attempt claim before responding
    if (hadPendingRefCookie && newUser?.id) {
      await tryClaimPendingReferral(supabase, newUser.id, null, pendingRefCode);
    }

    // New user has 0 referrals
    return clearPendingRefCookie(
      NextResponse.json(
        { user: { ...newUser, referral_count: 0 } },
        {
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        }
      ),
      hadPendingRefCookie
    );
  }

  // Sync user profile from GitHub API directly (Clerk caches OAuth data)
  const clerkUser = await currentUser();
  if (clerkUser) {
    const githubAccount = clerkUser.externalAccounts?.find((account) =>
      account.provider.toLowerCase().includes("github")
    );

    // Backfill the immutable GitHub numeric ID for legacy rows.
    // Profile fields (username/display_name/avatar_url) are NOT auto-synced here —
    // the explicit POST /api/me/sync-github route exists for that, and silently
    // overwriting user edits on every page load was the bug we're closing.
    const clerkGithubId = githubAccount?.externalId || null;
    if (clerkGithubId && !user.github_id) {
      const { error: backfillError } = await supabase
        .from("users")
        .update({ github_id: clerkGithubId, updated_at: new Date().toISOString() })
        .eq("clerk_id", userId)
        .is("github_id", null); // race-safe: don't clobber if another request already wrote

      if (backfillError) {
        console.error("[/api/me] Failed to backfill github_id:", backfillError);
      } else {
        user.github_id = clerkGithubId;
      }
    }
  }

  // Auto-populate GitHub from Clerk OAuth if not set
  const socialLinks = (user.social_links as Record<string, string> | null) || {};
  if (!socialLinks.github && clerkUser) {
    const githubAccount = clerkUser.externalAccounts?.find((account) =>
      account.provider.toLowerCase().includes("github")
    );

    // Get GitHub username from external account or Clerk username
    const githubUsername = githubAccount?.username || clerkUser.username;

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

      // Get referral count
      const { count: socialLinksReferralCount } = await supabase
        .from("users")
        .select("*", { count: "exact", head: true })
        .eq("referred_by", user.id);

      // Return updated user data
      return clearPendingRefCookie(
        NextResponse.json(
          {
            user: {
              ...user,
              social_links: updatedSocialLinks,
              referral_count: socialLinksReferralCount || 0,
            },
          },
          {
            headers: {
              "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
              Pragma: "no-cache",
              Expires: "0",
            },
          }
        ),
        hadPendingRefCookie
      );
    }
  }

  // Auto-generate or migrate referral_code for existing users
  // - Users without referral_code: generate new 5-char code
  // - Users with long referral_code (>5 chars): migrate to 5-char code
  let finalUser = user;
  const needsNewCode = !user.referral_code || user.referral_code.length > 5;

  if (needsNewCode) {
    const newReferralCode = generateShortCode();
    const { data: updatedUser, error: referralUpdateError } = await supabase
      .from("users")
      .update({ referral_code: newReferralCode })
      .eq("id", user.id)
      .select("*")
      .single();

    if (!referralUpdateError && updatedUser) {
      finalUser = updatedUser;
      const action = user.referral_code ? "migrated" : "generated";
      console.log(`[/api/me] ${action} referral_code for user:`, {
        old: user.referral_code,
        new: newReferralCode,
      });
    }
  }

  // Get referral count
  const { count: referralCount } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true })
    .eq("referred_by", finalUser.id);

  // Add cache control headers to prevent stale data
  return clearPendingRefCookie(
    NextResponse.json(
      { user: { ...finalUser, referral_count: referralCount || 0 } },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    ),
    hadPendingRefCookie
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
    if (parsed.data.integrity_agreed !== undefined) {
      updateData.integrity_agreed_at = now;
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

      // Generate referral code
      const patchBaseUsername = clerkUser.username || `user_${userId.slice(0, 8)}`;
      const patchReferralCode = generateShortCode();

      // Use INSERT with RETURNING to get the created user directly
      const { data: newUser, error: insertError } = await supabase
        .from("users")
        .insert({
          clerk_id: userId,
          username: patchBaseUsername,
          display_name: displayName,
          avatar_url: clerkUser.imageUrl,
          email: clerkUser.emailAddresses[0]?.emailAddress,
          referral_code: patchReferralCode,
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
      return NextResponse.json(
        { error: "Failed to delete account. Please try again later." },
        { status: 500 }
      );
    }

    if (!data.success) {
      // Provide more context for the error
      const errorMessage = data.error || "Unknown error";
      console.log("Soft delete failed:", { clerk_id: userId, error: errorMessage });
      return NextResponse.json(
        { error: `Account deletion failed: ${errorMessage}` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Your profile is now hidden. Your data will be permanently deleted after 7 days. You can recover your account by logging in within 7 days.",
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
