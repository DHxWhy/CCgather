/**
 * Admin Guard Utility
 * Shared middleware for admin-only API routes
 */

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Check if the current user has admin privileges
 * Returns userId if admin, null otherwise
 */
export async function checkAdmin(): Promise<string | null> {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  // In development, allow all authenticated users
  if (process.env.NODE_ENV === "development") {
    return userId;
  }

  // Check admin status in database
  try {
    const supabase = await createClient();
    const { data: user } = await supabase
      .from("users")
      .select("is_admin")
      .eq("clerk_id", userId)
      .single();

    if (user?.is_admin) {
      return userId;
    }
  } catch (error) {
    console.error("[Admin Guard] Error checking admin status:", error);
  }

  return null;
}

/**
 * Simple boolean check for admin status
 */
export async function isAdmin(): Promise<boolean> {
  return (await checkAdmin()) !== null;
}
