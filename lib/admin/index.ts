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

/**
 * Check if current user has admin access (boolean)
 * @returns true if user is admin, false otherwise
 */
export async function checkAdminAccess(): Promise<boolean> {
  const { userId } = await auth();
  if (!userId) return false;

  // Verify is_admin flag in database
  const supabase = await createClient();
  const { data } = await supabase.from("users").select("is_admin").eq("clerk_id", userId).single();

  return data?.is_admin === true;
}

/**
 * Require admin access, throws error if not admin
 * @throws Error if user is not admin
 */
export async function requireAdmin(): Promise<true> {
  const hasAccess = await checkAdminAccess();
  if (!hasAccess) {
    throw new Error("Unauthorized: Admin access required");
  }
  return true;
}
