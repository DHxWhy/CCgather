import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface UsageHistoryRow {
  date: string;
  tokens: number;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  try {
    const supabase = await createClient();

    // Fetch user profile
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Calculate percentile
    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    const percentile = totalUsers
      ? ((totalUsers - user.rank + 1) / totalUsers) * 100
      : 0;

    // Fetch usage history (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const { data: usageHistory } = await supabase
      .from('usage_history')
      .select('date, tokens')
      .eq('user_id', user.id)
      .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: true });

    const profile = {
      id: user.id,
      username: user.username,
      avatarUrl: user.avatar_url,
      bio: user.bio,
      country: user.country,
      rank: user.rank,
      tier: user.tier,
      totalTokens: user.total_tokens,
      totalSpent: user.total_spent,
      badges: user.badges || [],
      createdAt: user.created_at,
      githubUrl: user.github_url,
      twitterUrl: user.twitter_url,
      percentile,
    };

    return NextResponse.json({
      profile,
      usageHistory: (usageHistory || []).map((row: UsageHistoryRow) => ({
        date: row.date,
        tokens: row.tokens,
      })),
      modelBreakdown: user.model_breakdown || {},
    });
  } catch (error) {
    console.error('[API] Profile fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
