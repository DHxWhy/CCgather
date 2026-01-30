import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Get current user from database
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, username, display_name, avatar_url, social_links")
    .eq("clerk_id", userId)
    .single();

  if (userError || !user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Get GitHub username from social_links
  const socialLinks = (user.social_links as Record<string, string> | null) || {};
  const githubUsername = socialLinks.github;

  if (!githubUsername) {
    return NextResponse.json(
      { error: "No GitHub username found in social links" },
      { status: 400 }
    );
  }

  try {
    // Fetch fresh data from GitHub API (no cache)
    const githubRes = await fetch(`https://api.github.com/users/${githubUsername}`, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "CCgather",
      },
      cache: "no-store", // Force fresh fetch
    });

    if (!githubRes.ok) {
      if (githubRes.status === 404) {
        return NextResponse.json(
          { error: `GitHub user "${githubUsername}" not found` },
          { status: 404 }
        );
      }
      return NextResponse.json({ error: "Failed to fetch GitHub profile" }, { status: 500 });
    }

    const githubProfile = await githubRes.json();

    // Extract latest values
    const latestUsername = githubProfile.login;
    const latestDisplayName = githubProfile.name || latestUsername;
    const latestAvatarUrl = githubProfile.avatar_url;

    // Build update object
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    const changes: string[] = [];

    if (latestUsername && user.username !== latestUsername) {
      updates.username = latestUsername;
      changes.push(`username: ${user.username} → ${latestUsername}`);
    }

    if (latestDisplayName && user.display_name !== latestDisplayName) {
      updates.display_name = latestDisplayName;
      changes.push(`display_name: ${user.display_name} → ${latestDisplayName}`);
    }

    if (latestAvatarUrl && user.avatar_url !== latestAvatarUrl) {
      updates.avatar_url = latestAvatarUrl;
      changes.push(`avatar_url: updated`);
    }

    // Also update social_links.github if username changed
    if (latestUsername && socialLinks.github !== latestUsername) {
      updates.social_links = { ...socialLinks, github: latestUsername };
      changes.push(`social_links.github: ${socialLinks.github} → ${latestUsername}`);
    }

    if (changes.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Profile is already up to date",
        synced: false,
      });
    }

    // Update database
    const { error: updateError } = await supabase
      .from("users")
      .update(updates)
      .eq("clerk_id", userId);

    if (updateError) {
      console.error("[sync-github] Failed to update user:", updateError);
      return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }

    console.log("[sync-github] Synced profile from GitHub:", { userId, changes });

    return NextResponse.json({
      success: true,
      message: "Profile synced from GitHub",
      synced: true,
      changes,
      profile: {
        username: latestUsername,
        display_name: latestDisplayName,
        avatar_url: latestAvatarUrl,
      },
    });
  } catch (error) {
    console.error("[sync-github] Error:", error);
    return NextResponse.json({ error: "Failed to sync from GitHub" }, { status: 500 });
  }
}
