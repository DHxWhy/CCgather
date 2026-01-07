import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  rateLimiters,
  createRateLimitHeaders,
  getClientIdentifier,
} from '@/lib/rate-limit';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Schema for individual project usage
const ProjectUsageSchema = z.object({
  project_name: z.string().min(1).max(255),
  input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
  cache_creation_tokens: z.number().int().nonnegative().optional().default(0),
  cache_read_tokens: z.number().int().nonnegative().optional().default(0),
  model: z.string().optional(),
});

// Schema for bulk submission
const BulkSubmitSchema = z.object({
  api_key: z.string().min(1),
  projects: z.array(ProjectUsageSchema).min(1).max(50),
  timestamp: z.string().datetime().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = BulkSubmitSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { api_key, projects } = parsed.data;

    // Rate limiting check (stricter for bulk operations)
    const clientId = getClientIdentifier(request, api_key);
    const rateLimitResult = rateLimiters.bulkSubmit(clientId);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: 'Too many bulk submissions. Please try again later.',
          retryAfter: Math.ceil(
            (rateLimitResult.resetTime - Date.now()) / 1000
          ),
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
      .from('users')
      .select('id, clerk_id')
      .eq('api_key', api_key)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    const today = new Date().toISOString().split('T')[0];

    // Aggregate tokens across all projects
    const totalUsage = projects.reduce(
      (acc, project) => ({
        input_tokens: acc.input_tokens + project.input_tokens,
        output_tokens: acc.output_tokens + project.output_tokens,
        cache_creation_tokens: acc.cache_creation_tokens + (project.cache_creation_tokens || 0),
        cache_read_tokens: acc.cache_read_tokens + (project.cache_read_tokens || 0),
      }),
      {
        input_tokens: 0,
        output_tokens: 0,
        cache_creation_tokens: 0,
        cache_read_tokens: 0,
      }
    );

    // Upsert aggregated usage stats for today
    const { error: upsertError } = await supabaseAdmin
      .from('usage_stats')
      .upsert(
        {
          user_id: user.id,
          date: today,
          ...totalUsage,
        },
        {
          onConflict: 'user_id,date',
          ignoreDuplicates: false,
        }
      );

    if (upsertError) {
      console.error('Failed to upsert usage stats:', upsertError);
      return NextResponse.json(
        { error: 'Failed to save usage data' },
        { status: 500 }
      );
    }

    // Store individual project breakdown (optional - for future analytics)
    // This can be enabled when project_usage table is created
    /*
    const projectUsageRecords = projects.map(project => ({
      user_id: user.id,
      date: today,
      project_name: project.project_name,
      input_tokens: project.input_tokens,
      output_tokens: project.output_tokens,
      cache_creation_tokens: project.cache_creation_tokens || 0,
      cache_read_tokens: project.cache_read_tokens || 0,
      model: project.model,
    }));

    await supabaseAdmin
      .from('project_usage')
      .upsert(projectUsageRecords, {
        onConflict: 'user_id,date,project_name',
      });
    */

    // Trigger user stats update
    const { error: updateError } = await supabaseAdmin.rpc('update_user_stats', {
      p_user_id: user.id,
    });

    if (updateError) {
      console.error('Failed to update user stats:', updateError);
      // Non-fatal, continue
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Bulk usage data submitted successfully',
        summary: {
          projects_count: projects.length,
          total_input_tokens: totalUsage.input_tokens,
          total_output_tokens: totalUsage.output_tokens,
          total_cache_creation_tokens: totalUsage.cache_creation_tokens,
          total_cache_read_tokens: totalUsage.cache_read_tokens,
          total_tokens:
            totalUsage.input_tokens +
            totalUsage.output_tokens +
            totalUsage.cache_creation_tokens +
            totalUsage.cache_read_tokens,
        },
      },
      {
        headers: createRateLimitHeaders(rateLimitResult),
      }
    );
  } catch (error) {
    console.error('Bulk submit error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
