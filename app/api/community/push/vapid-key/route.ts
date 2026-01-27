import { NextResponse } from "next/server";

// =====================================================
// GET /api/community/push/vapid-key - VAPID 퍼블릭 키 조회
// =====================================================
export async function GET() {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  if (!vapidPublicKey) {
    return NextResponse.json({ error: "Push notifications not configured" }, { status: 503 });
  }

  return NextResponse.json({ publicKey: vapidPublicKey });
}
