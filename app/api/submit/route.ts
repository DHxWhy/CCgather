import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { rateLimiters, createRateLimitHeaders, getClientIdentifier } from "@/lib/rate-limit";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// CCplan type validation
const CCPlanEnum = z.enum(["free", "pro", "max", "team"]);

const SubmitSchema = z.object({
  api_key: z.string().min(1),
  input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
  cache_creation_tokens: z.number().int().nonnegative().optional().default(0),
  cache_read_tokens: z.number().int().nonnegative().optional().default(0),
  model: z.string().optional(),
  timestamp: z.string().datetime().optional(),
  // CCplan fields
  ccplan: CCPlanEnum.optional(),
  rate_limit_tier: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = SubmitSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const {
      api_key,
      input_tokens,
      output_tokens,
      cache_creation_tokens,
      cache_read_tokens,
      ccplan,
    } = parsed.data;

    // Rate limiting check
    const clientId = getClientIdentifier(request, api_key);
    const rateLimitResult = rateLimiters.submit(clientId);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: "Too many submissions. Please try again later.",
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: createRateLimitHeaders(rateLimitResult),
        }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Verify API key and get user
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, clerk_id")
      .eq("api_key", api_key)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }

    const today = new Date().toISOString().split("T")[0];

    // Upsert usage stats for today
    const { error: upsertError } = await supabaseAdmin.from("usage_stats").upsert(
      {
        user_id: user.id,
        date: today,
        input_tokens,
        output_tokens,
        cache_creation_tokens,
        cache_read_tokens,
        ccplan_at_submission: ccplan || null,
      },
      {
        onConflict: "user_id,date",
        ignoreDuplicates: false,
      }
    );

    if (upsertError) {
      console.error("Failed to upsert usage stats:", upsertError);
      return NextResponse.json({ error: "Failed to save usage data" }, { status: 500 });
    }

    // Update user's ccplan if provided
    if (ccplan) {
      const { error: ccplanError } = await supabaseAdmin
        .from("users")
        .update({
          ccplan,
          ccplan_updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (ccplanError) {
        console.error("Failed to update user ccplan:", ccplanError);
        // Non-fatal, continue
      }
    }

    // Trigger user stats update
    const { error: updateError } = await supabaseAdmin.rpc("update_user_stats", {
      p_user_id: user.id,
    });

    if (updateError) {
      console.error("Failed to update user stats:", updateError);
      // Non-fatal, continue
    }

    return NextResponse.json(
      {
        success: true,
        message: "Usage data submitted successfully",
      },
      {
        headers: createRateLimitHeaders(rateLimitResult),
      }
    );
  } catch (error) {
    console.error("Submit error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
