import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";

// Called after sign-up to claim the referral
export async function POST(request: NextRequest) {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { referral_code } = await request.json();

    if (!referral_code) {
      return NextResponse.json({ error: "No referral code provided" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Get current user
    const { data: currentUser, error: userError } = await supabase
      .from("users")
      .select("id, referred_by")
      .eq("clerk_id", clerkId)
      .single();

    if (userError || !currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if already referred
    if (currentUser.referred_by) {
      return NextResponse.json({ error: "Already referred" }, { status: 400 });
    }

    // Find the inviter by referral code
    const { data: inviter, error: inviterError } = await supabase
      .from("users")
      .select("id")
      .eq("referral_code", referral_code.toLowerCase())
      .single();

    if (inviterError || !inviter) {
      return NextResponse.json({ error: "Invalid referral code" }, { status: 404 });
    }

    // Can't refer yourself
    if (inviter.id === currentUser.id) {
      return NextResponse.json({ error: "Cannot refer yourself" }, { status: 400 });
    }

    // Update current user with referred_by
    const { error: updateError } = await supabase
      .from("users")
      .update({ referred_by: inviter.id })
      .eq("id", currentUser.id);

    if (updateError) {
      console.error("Failed to update referral:", updateError);
      return NextResponse.json({ error: "Failed to claim referral" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Referral claim error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
