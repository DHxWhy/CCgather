import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = await createClient();

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('clerk_id', userId)
      .single();

    if (error || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
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
    });
  } catch (error) {
    console.error('[API] Profile fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { bio, country, githubUrl, twitterUrl } = body;

    const supabase = await createClient();

    // Validate and sanitize input
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (bio !== undefined) {
      updateData.bio = typeof bio === 'string' ? bio.slice(0, 500) : null;
    }

    if (country !== undefined) {
      updateData.country = typeof country === 'string' ? country.slice(0, 2).toUpperCase() : null;
    }

    if (githubUrl !== undefined) {
      updateData.github_url = typeof githubUrl === 'string' && githubUrl.startsWith('https://github.com/')
        ? githubUrl
        : null;
    }

    if (twitterUrl !== undefined) {
      updateData.twitter_url = typeof twitterUrl === 'string' && twitterUrl.startsWith('https://twitter.com/')
        ? twitterUrl
        : null;
    }

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('clerk_id', userId)
      .select()
      .single();

    if (error) {
      console.error('[API] Profile update error:', error);
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id: data.id,
      username: data.username,
      avatarUrl: data.avatar_url,
      bio: data.bio,
      country: data.country,
      githubUrl: data.github_url,
      twitterUrl: data.twitter_url,
    });
  } catch (error) {
    console.error('[API] Profile update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
