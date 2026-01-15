import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";

// =====================================================
// POST /api/auth/fresh-start - 새로 시작 (이전 계정 즉시 삭제 후 새 계정 생성)
// =====================================================
export async function POST() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  try {
    // 1. Check if there's a pending deletion account
    const { data: pendingInfo, error: checkError } = await supabase.rpc(
      "get_pending_deletion_info",
      {
        target_clerk_id: userId,
      }
    );

    if (checkError) {
      console.error("Fresh start check error:", checkError);
      return NextResponse.json({ error: "Failed to check account status" }, { status: 500 });
    }

    if (!pendingInfo.pending_deletion) {
      return NextResponse.json({ error: "No pending deletion account found" }, { status: 400 });
    }

    // 2. Permanently delete the old account immediately
    const { error: deleteError } = await supabase.from("users").delete().eq("clerk_id", userId);

    if (deleteError) {
      console.error("Fresh start delete error:", deleteError);
      return NextResponse.json({ error: "Failed to delete old account" }, { status: 500 });
    }

    // 3. Create a new account with Clerk data
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
      .select("id, username, display_name")
      .single();

    if (insertError) {
      // Handle username conflict
      if (insertError.code === "23505") {
        const uniqueUsername = `${clerkUser.username || "user"}_${Date.now().toString(36)}`;
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
          .select("id, username, display_name")
          .single();

        if (retryError) {
          console.error("Fresh start retry error:", retryError);
          return NextResponse.json({ error: "Failed to create new account" }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          message: "이전 계정이 삭제되고 새 계정이 생성되었습니다.",
          user: retryUser,
        });
      }

      console.error("Fresh start insert error:", insertError);
      return NextResponse.json({ error: "Failed to create new account" }, { status: 500 });
    }

    console.log("Fresh start completed:", { old_deleted: true, new_user_id: newUser?.id });

    return NextResponse.json({
      success: true,
      message: "이전 계정이 삭제되고 새 계정이 생성되었습니다.",
      user: newUser,
    });
  } catch (error) {
    console.error("POST /api/auth/fresh-start error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
