import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteParams {
  params: Promise<{ username: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { username } = await params;

  const supabase = await createClient();

  // Get user profile
  const { data: user, error: userError } = await supabase
    .from('users')
    .select(
      `
      id,
      username,
      display_name,
      avatar_url,
      country_code,
      level,
      global_rank,
      country_rank,
      total_tokens,
      total_cost,
      created_at
    `
    )
    .eq('username', username)
    .eq('onboarding_completed', true)
    .single();

  if (userError || !user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Get user badges
  const { data: badges } = await supabase
    .from('user_badges')
    .select('badge_id, earned_at')
    .eq('user_id', user.id)
    .order('earned_at', { ascending: false });

  // Get displayed badges
  const { data: displayedBadges } = await supabase
    .from('badge_display')
    .select('badge_id, slot')
    .eq('user_id', user.id)
    .order('slot', { ascending: true });

  // Get recent usage stats (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: usageHistory } = await supabase
    .from('usage_stats')
    .select('date, input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens')
    .eq('user_id', user.id)
    .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
    .order('date', { ascending: true });

  return NextResponse.json({
    user: {
      ...user,
      badges: badges?.map((b) => b.badge_id) || [],
      displayed_badges: displayedBadges?.map((b) => b.badge_id) || [],
    },
    usage_history: usageHistory || [],
  });
}
