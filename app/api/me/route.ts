import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { cookies, headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { randomBytes } from "crypto";

// IP geo 로 country 자동 추정. 가입 시 1회만 사용.
// Vercel Edge 가 매 요청에 x-vercel-ip-country 헤더를 자동 부여 (ISO-3166 2자리).
// 추정 실패 시 null 반환 → 사용자가 settings/banner 에서 직접 설정.
async function detectCountryFromHeaders(): Promise<string | null> {
  try {
    const h = await headers();
    const raw = h.get("x-vercel-ip-country");
    if (!raw) return null;
    const code = raw.trim().toUpperCase();
    // 정상 ISO-3166 alpha-2 만 허용 (XX 같은 unknown 코드 거름)
    if (!/^[A-Z]{2}$/.test(code) || code === "XX") return null;
    return code;
  } catch {
    return null;
  }
}

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

    // ── Re-signup of a soft-deleted account (7-day grace) ───────────────────
    // Soft-deleted rows keep occupying this identity's globally-UNIQUE slots
    // (clerk_id / github_id / username / referral_code), so the auto-create
    // INSERT below would 23505 and dead-end — the months-long "duplicate key" /
    // 404 signup break. Handle the returning user here instead:
    //   • same clerk_id → defer to OnboardingGuard's recovery modal
    //     (Recover / Start-Fresh choice).
    //   • same github_id with a NEW clerk_id (Clerk account was recreated) →
    //     silently revive + relink; the modal is keyed on clerk_id and cannot
    //     see this case. Preserves the user's prior data (votes/level/referrals).
    {
      const { data: deletedByClerk } = await supabase
        .from("users")
        .select("id, shadow_banned")
        .eq("clerk_id", userId)
        .not("deleted_at", "is", null)
        .maybeSingle();

      if (deletedByClerk) {
        // Shadow-banned + soft-deleted = permanent block: no recovery modal, no revive.
        if (deletedByClerk.shadow_banned) {
          return clearPendingRefCookie(
            NextResponse.json(
              { user: null, banned: true },
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
        return clearPendingRefCookie(
          NextResponse.json(
            { user: null, recovery_pending: true },
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

      if (githubId && /^\d+$/.test(githubId)) {
        const { data: deletedByGithub } = await supabase
          .from("users")
          .select("id, shadow_banned")
          .eq("github_id", githubId)
          .not("deleted_at", "is", null)
          .maybeSingle();

        if (deletedByGithub) {
          // Shadow-banned + soft-deleted = permanent block: no silent revive.
          if (deletedByGithub.shadow_banned) {
            return clearPendingRefCookie(
              NextResponse.json(
                { user: null, banned: true },
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
          const { data: revived, error: reviveError } = await supabase
            .from("users")
            .update({
              deleted_at: null,
              clerk_id: userId,
              updated_at: new Date().toISOString(),
            })
            .eq("id", deletedByGithub.id)
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
            .single();

          if (reviveError || !revived) {
            // Race: between the deletedByClerk check above and this relink UPDATE,
            // another concurrent request already created/revived the ACTIVE row for
            // this clerk_id, so SET clerk_id=userId 23505'd. Return that now-active row
            // instead of a spurious 500 + logged-out flash.
            if (reviveError?.code === "23505") {
              const { data: raced } = await supabase
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
                .maybeSingle();

              if (raced) {
                const { count: racedReferralCount } = await supabase
                  .from("users")
                  .select("*", { count: "exact", head: true })
                  .eq("referred_by", raced.id)
                  .is("deleted_at", null);
                return clearPendingRefCookie(
                  NextResponse.json(
                    { user: { ...raced, referral_count: racedReferralCount || 0 } },
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
            console.error("[/api/me] Failed to reactivate soft-deleted account on re-signup:", {
              clerk_id: userId,
              error: reviveError,
            });
            return NextResponse.json({ error: "Account reactivation failed" }, { status: 500 });
          }

          console.log("[/api/me] Reactivated soft-deleted account on re-signup:", {
            user_id: revived.id,
            new_clerk_id: userId,
          });

          if (hadPendingRefCookie) {
            await tryClaimPendingReferral(
              supabase,
              revived.id,
              revived.referred_by,
              pendingRefCode
            );
          }
          const { count: revivedReferralCount } = await supabase
            .from("users")
            .select("*", { count: "exact", head: true })
            .eq("referred_by", revived.id)
            .is("deleted_at", null);

          return clearPendingRefCookie(
            NextResponse.json(
              { user: { ...revived, referral_count: revivedReferralCount || 0 } },
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
              .eq("referred_by", existingByEmail.id)
              .is("deleted_at", null);

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

    // No existing account found - create new user.
    // IP geo 로 country 자동 추정 + onboarding 완료로 표시 (frictionless signup).
    // 추정 실패 시 country=null 로 두고, 리더보드에서 banner 로 입력 유도.
    const displayName =
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
      clerkUser.username ||
      "Anonymous";

    const baseUsername = clerkUser.username || `user_${userId.slice(0, 8)}`;
    const referralCode = generateShortCode();
    const autoCountry = await detectCountryFromHeaders();

    const { data: newUser, error: insertError } = await supabase
      .from("users")
      .insert({
        clerk_id: userId,
        github_id: githubId,
        username: baseUsername,
        display_name: displayName,
        avatar_url: clerkUser.imageUrl,
        email: email,
        country_code: autoCountry,
        // Terms/Privacy implicit consent at OAuth click (GitHub 패턴).
        // Marketing 은 opt-in 분리 (settings).
        onboarding_completed: true,
        profile_visibility_consent: true,
        community_updates_consent: true,
        integrity_agreed: true,
        marketing_consent: false,
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
          .is("deleted_at", null)
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
          // referral_count for the settings invite card (active referrals only,
          // matching the social-badge count in badgeService)
          const { count: existingClerkReferralCount } = await supabase
            .from("users")
            .select("*", { count: "exact", head: true })
            .eq("referred_by", existingByClerkId.id)
            .is("deleted_at", null);
          return clearPendingRefCookie(
            NextResponse.json(
              {
                user: { ...existingByClerkId, referral_count: existingClerkReferralCount || 0 },
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
              country_code: autoCountry,
              onboarding_completed: true,
              profile_visibility_consent: true,
              community_updates_consent: true,
              integrity_agreed: true,
              marketing_consent: false,
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
      // Mercury P2: 404 응답에 cookie clear 누락 — pending referral cookie 가 잔존
      return clearPendingRefCookie(
        NextResponse.json({ error: "User not found" }, { status: 404 }),
        hadPendingRefCookie
      );
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

    // country_code 자동 백필: webhook 으로 가입한 사용자는 country=null 로 들어옴
    // (webhook 서버의 IP 는 사용자 IP 가 아님). 첫 /api/me GET 시 사용자 IP geo 로
    // 자동 채워서 frictionless 가입 흐름의 일관성 확보.
    if (!user.country_code) {
      const detectedCountry = await detectCountryFromHeaders();
      if (detectedCountry) {
        const { error: countryErr } = await supabase
          .from("users")
          .update({ country_code: detectedCountry, updated_at: new Date().toISOString() })
          .eq("clerk_id", userId)
          .is("country_code", null);
        if (!countryErr) {
          user.country_code = detectedCountry;
          // 백필 직후 country_rank 재계산 (이번 사용자가 국가별 랭킹에 합류)
          await supabase.rpc("calculate_country_ranks").catch(() => {});
        }
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
        .eq("referred_by", user.id)
        .is("deleted_at", null);

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
    .eq("referred_by", finalUser.id)
    .is("deleted_at", null);

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

    // 기존 country_code 를 미리 읽어서 변경 여부 판정 (PATCH 끝에서 rank 재계산용)
    const { data: existingUser } = await supabase
      .from("users")
      .select("id, country_code")
      .eq("clerk_id", userId)
      .is("deleted_at", null)
      .maybeSingle();
    const previousCountry = existingUser?.country_code ?? null;

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
        // 23505 = 재가입: 소프트삭제된 옛 행이 username/github_id 슬롯을 점유 중.
        // 새로 INSERT 하는 대신 옛 행을 되살려(데이터 보존) onboarding 업데이트를 함께 적용.
        // 이 처리가 없어서 국가선택 직후 "Failed to create user: ...users_username_key" 500 발생.
        if (insertError.code === "23505") {
          const ghAccount = clerkUser.externalAccounts?.find((a) => a.provider === "oauth_github");
          const ghId = ghAccount?.externalId || null;
          const orParts = [`clerk_id.eq.${userId}`];
          if (ghId && /^\d+$/.test(ghId)) orParts.push(`github_id.eq.${ghId}`);

          const { data: deletedRow } = await supabase
            .from("users")
            .select("id")
            .or(orParts.join(","))
            .not("deleted_at", "is", null)
            .order("deleted_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (deletedRow) {
            const { data: revived, error: reviveError } = await supabase
              .from("users")
              .update({
                deleted_at: null,
                clerk_id: userId,
                updated_at: new Date().toISOString(),
                ...updateData,
              })
              .eq("id", deletedRow.id)
              .select("*")
              .single();

            if (!reviveError && revived) {
              if (parsed.data.country_code !== undefined) {
                await supabase.rpc("calculate_country_ranks").catch(() => {});
              }
              return NextResponse.json({ user: revived });
            }
            console.error("Failed to revive soft-deleted account (PATCH):", reviveError);
          }

          // No soft-deleted row of this user's to revive → the 23505 is a username/
          // referral_code collision with an UNRELATED row. Retry with unique suffixes
          // so onboarding never dead-ends at 500 (mirrors the GET auto-create loop).
          const patchRetryBase = clerkUser.username || "user";
          for (let attempt = 1; attempt <= 5; attempt++) {
            const retryUsername =
              attempt === 1
                ? `${patchRetryBase}_${userId.slice(0, 8)}`
                : `${patchRetryBase}_${userId.slice(0, 8)}_${attempt}`;
            const { data: patchRetryUser, error: patchRetryError } = await supabase
              .from("users")
              .insert({
                clerk_id: userId,
                username: retryUsername,
                display_name: displayName,
                avatar_url: clerkUser.imageUrl,
                email: clerkUser.emailAddresses[0]?.emailAddress,
                referral_code: generateShortCode(),
                ...updateData,
              })
              .select("*")
              .single();

            if (!patchRetryError && patchRetryUser) {
              if (parsed.data.country_code !== undefined) {
                await supabase.rpc("calculate_country_ranks").catch(() => {});
              }
              return NextResponse.json({ user: patchRetryUser });
            }
            // Only UNIQUE violations are fixable by a fresh suffix; bail otherwise.
            if (patchRetryError?.code !== "23505") break;
          }
        }

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

    // country_code 가 바뀌었으면 두 그룹 (옛+새) 의 country_rank 즉시 재계산.
    // 사용자가 자기 국가 변경하자마자 banner 의 rank 가 정확히 반영되도록.
    const newCountry = (parsed.data.country_code ?? null) as string | null;
    if (parsed.data.country_code !== undefined && newCountry !== previousCountry) {
      const { error: rankErr } = await supabase.rpc("calculate_country_ranks");
      if (rankErr) {
        console.error("[/api/me] calculate_country_ranks failed:", rankErr);
        // 사용자 요청 자체는 성공이므로 PATCH 실패 처리 X. cron 다음 주기에 자연 보정.
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
