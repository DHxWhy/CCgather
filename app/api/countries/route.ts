import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const includeStats = searchParams.get('stats') === 'true';

  const supabase = await createClient();

  if (includeStats) {
    // Get country statistics
    const { data: stats, error } = await supabase
      .from('country_stats')
      .select('*')
      .order('total_tokens', { ascending: false });

    if (error) {
      console.error('Failed to fetch country stats:', error);
      return NextResponse.json(
        { error: 'Failed to fetch country statistics' },
        { status: 500 }
      );
    }

    return NextResponse.json({ countries: stats || [] });
  }

  // Get unique countries with user counts
  const { data: countries, error } = await supabase
    .from('users')
    .select('country_code')
    .not('country_code', 'is', null)
    .eq('onboarding_completed', true);

  if (error) {
    console.error('Failed to fetch countries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch countries' },
      { status: 500 }
    );
  }

  // Count users per country
  const countryMap = new Map<string, number>();
  (countries as Array<{ country_code: string | null }> | null)?.forEach((user) => {
    if (user.country_code) {
      countryMap.set(
        user.country_code,
        (countryMap.get(user.country_code) || 0) + 1
      );
    }
  });

  const countryList = Array.from(countryMap.entries())
    .map(([code, count]) => ({ code, user_count: count }))
    .sort((a, b) => b.user_count - a.user_count);

  return NextResponse.json({ countries: countryList });
}
