import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface SyncPayload {
  totalTokens: number;
  totalSpent: number;
  modelBreakdown: Record<string, number>;
  timestamp: string;
}

export async function POST(request: NextRequest) {
  try {
    // Get API token from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const apiToken = authHeader.slice(7);
    if (!apiToken || apiToken.length < 10) {
      return NextResponse.json(
        { error: 'Invalid API token' },
        { status: 401 }
      );
    }

    const supabase = await createClient();

    // Find user by API key
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, username, total_tokens, total_spent, model_breakdown, rank')
      .eq('api_key', apiToken)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Invalid API token' },
        { status: 401 }
      );
    }

    // Parse and validate payload
    const body: SyncPayload = await request.json();

    if (typeof body.totalTokens !== 'number' || body.totalTokens < 0) {
      return NextResponse.json(
        { error: 'Invalid totalTokens' },
        { status: 400 }
      );
    }

    if (typeof body.totalSpent !== 'number' || body.totalSpent < 0) {
      return NextResponse.json(
        { error: 'Invalid totalSpent' },
        { status: 400 }
      );
    }

    // Merge model breakdowns
    const existingBreakdown = user.model_breakdown || {};
    const newBreakdown: Record<string, number> = { ...existingBreakdown };

    for (const [model, tokens] of Object.entries(body.modelBreakdown || {})) {
      if (typeof tokens === 'number' && tokens > 0) {
        newBreakdown[model] = Math.max(newBreakdown[model] || 0, tokens);
      }
    }

    // Update user stats
    const { error: updateError } = await supabase
      .from('users')
      .update({
        total_tokens: Math.max(user.total_tokens, body.totalTokens),
        total_spent: Math.max(user.total_spent, body.totalSpent),
        model_breakdown: newBreakdown,
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('[CLI Sync] Update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to sync data' },
        { status: 500 }
      );
    }

    // Log sync event
    await supabase.from('sync_logs').insert({
      user_id: user.id,
      tokens_synced: body.totalTokens,
      spent_synced: body.totalSpent,
      source: 'cli',
      created_at: new Date().toISOString(),
    });

    // Trigger rank recalculation (simplified - just get current rank)
    const { data: rankData } = await supabase
      .from('users')
      .select('id')
      .order('total_tokens', { ascending: false });

    const rank = (rankData?.findIndex(u => u.id === user.id) ?? -1) + 1;

    if (rank > 0) {
      await supabase
        .from('users')
        .update({ rank })
        .eq('id', user.id);
    }

    return NextResponse.json({
      success: true,
      rank: rank || user.rank,
    });
  } catch (error) {
    console.error('[CLI Sync] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
