import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { createClient } from '@/lib/supabase/server';
import { randomBytes } from 'crypto';

/**
 * Generate a new API token for CLI authentication
 * POST /api/cli/auth/token
 */
export async function POST() {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await currentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const supabase = await createClient();

    // Find or create user in database
    const { data: existingUser, error: findError } = await supabase
      .from('users')
      .select('id, username, api_key')
      .eq('clerk_id', clerkUserId)
      .single();

    if (findError && findError.code !== 'PGRST116') {
      console.error('[CLI Auth] Error finding user:', findError);
      return NextResponse.json(
        { error: 'Database error' },
        { status: 500 }
      );
    }

    let apiKey: string;
    let dbUserId: string;
    let username: string;

    if (existingUser) {
      // Use existing API key or generate new one
      if (existingUser.api_key) {
        apiKey = existingUser.api_key;
      } else {
        // Generate new API key
        apiKey = `ccg_${randomBytes(32).toString('hex')}`;

        const { error: updateError } = await supabase
          .from('users')
          .update({ api_key: apiKey })
          .eq('id', existingUser.id);

        if (updateError) {
          console.error('[CLI Auth] Error updating API key:', updateError);
          return NextResponse.json(
            { error: 'Failed to generate token' },
            { status: 500 }
          );
        }
      }

      dbUserId = existingUser.id;
      username = existingUser.username;
    } else {
      // Create new user
      apiKey = `ccg_${randomBytes(32).toString('hex')}`;
      username = user.username || user.firstName || 'user';

      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          clerk_id: clerkUserId,
          username: username,
          display_name: user.fullName || username,
          avatar_url: user.imageUrl,
          api_key: apiKey,
          onboarding_completed: false,
        })
        .select('id')
        .single();

      if (createError) {
        console.error('[CLI Auth] Error creating user:', createError);
        return NextResponse.json(
          { error: 'Failed to create user' },
          { status: 500 }
        );
      }

      dbUserId = newUser.id;
    }

    return NextResponse.json({
      token: apiKey,
      userId: dbUserId,
      username: username,
    });
  } catch (error) {
    console.error('[CLI Auth] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
