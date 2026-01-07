import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
      .select('id, username')
      .eq('api_key', apiToken)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Invalid API token' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      userId: user.id,
      username: user.username,
    });
  } catch (error) {
    console.error('[CLI Verify] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
