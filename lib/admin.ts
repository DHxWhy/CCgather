import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

export async function checkAdminAccess(): Promise<boolean> {
  const { userId } = await auth();
  if (!userId) return false;

  // Development mode: allow all authenticated users
  if (process.env.NODE_ENV === "development") return true;

  // Production: verify is_admin flag in database
  const supabase = await createClient();
  const { data } = await supabase.from("users").select("is_admin").eq("clerk_id", userId).single();

  return data?.is_admin === true;
}

export async function requireAdmin() {
  const isAdmin = await checkAdminAccess();
  if (!isAdmin) {
    throw new Error("Unauthorized: Admin access required");
  }
  return true;
}
