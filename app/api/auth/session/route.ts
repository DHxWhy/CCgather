import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { userId } = await auth();

    return NextResponse.json({
      user: userId ? { id: userId } : null,
    });
  } catch {
    return NextResponse.json({ user: null });
  }
}
