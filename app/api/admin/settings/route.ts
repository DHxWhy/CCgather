import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@/lib/supabase/server';

async function isAdmin() {
  const { userId } = await auth();
  if (!userId) return false;
  if (process.env.NODE_ENV === 'development') return true;
  return true;
}

export async function GET() {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    const { data: settings, error } = await supabase
      .from('admin_settings')
      .select('*')
      .eq('id', 'default')
      .single();

    if (error) {
      // If table doesn't exist or no settings, return defaults
      console.error('[Admin Settings] Error:', error);
      return NextResponse.json({
        settings: {
          id: 'default',
          news_mode: 'confirm',
          news_crawl_interval: 6,
          news_sources: ['https://www.anthropic.com/news', 'https://www.anthropic.com/research'],
          youtube_mode: 'confirm',
          youtube_crawl_interval: 12,
          youtube_keywords: ['Claude Code', 'Claude Code tutorial', 'Anthropic Claude', 'Claude 코딩'],
          total_ai_requests: 0,
          total_ai_tokens: 0,
          total_ai_cost: 0,
        },
      });
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('[Admin Settings] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Allowed fields for update
    const allowedFields = [
      'news_mode',
      'news_crawl_interval',
      'news_sources',
      'youtube_mode',
      'youtube_crawl_interval',
      'youtube_keywords',
    ];

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Validate mode values
    const validModes = ['on', 'confirm', 'off'];
    if (updates.news_mode && !validModes.includes(updates.news_mode as string)) {
      return NextResponse.json({ error: 'Invalid news_mode value' }, { status: 400 });
    }
    if (updates.youtube_mode && !validModes.includes(updates.youtube_mode as string)) {
      return NextResponse.json({ error: 'Invalid youtube_mode value' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: settings, error } = await supabase
      .from('admin_settings')
      .update(updates)
      .eq('id', 'default')
      .select()
      .single();

    if (error) {
      console.error('[Admin Settings] Update error:', error);
      return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('[Admin Settings] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
