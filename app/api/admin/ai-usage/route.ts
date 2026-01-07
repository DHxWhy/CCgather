import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@/lib/supabase/server';

async function isAdmin() {
  const { userId } = await auth();
  if (!userId) return false;
  if (process.env.NODE_ENV === 'development') return true;
  return true;
}

export async function GET(request: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || '7d';

    const supabase = await createClient();

    // Calculate date range
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case '7d':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 30);
        break;
      default:
        startDate = new Date(0); // All time
    }

    // Get AI usage logs
    const { data: logs, error: logsError } = await supabase
      .from('ai_usage_log')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });

    if (logsError) {
      // Table might not exist yet
      console.error('[Admin AI Usage] Error:', logsError);
      return NextResponse.json({
        totalRequests: 0,
        totalTokensUsed: 0,
        totalCost: 0,
        requestsByDay: [],
        topModels: [],
      });
    }

    // Aggregate stats
    const totalRequests = logs?.length || 0;
    const totalTokensUsed = logs?.reduce((sum, l) => sum + (l.total_tokens || 0), 0) || 0;
    const totalCost = logs?.reduce((sum, l) => sum + parseFloat(l.cost_usd || '0'), 0) || 0;

    // Group by day
    const byDay = new Map<string, { count: number; tokens: number }>();
    logs?.forEach((log) => {
      const date = new Date(log.created_at).toISOString().split('T')[0] ?? '';
      const existing = byDay.get(date) || { count: 0, tokens: 0 };
      existing.count++;
      existing.tokens += log.total_tokens || 0;
      byDay.set(date, existing);
    });

    const requestsByDay = Array.from(byDay.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => b.date.localeCompare(a.date));

    // Group by model
    const byModel = new Map<string, { count: number; tokens: number }>();
    logs?.forEach((log) => {
      const model = log.model || 'unknown';
      const existing = byModel.get(model) || { count: 0, tokens: 0 };
      existing.count++;
      existing.tokens += log.total_tokens || 0;
      byModel.set(model, existing);
    });

    const topModels = Array.from(byModel.entries())
      .map(([model, data]) => ({ model, ...data }))
      .sort((a, b) => b.tokens - a.tokens);

    return NextResponse.json({
      totalRequests,
      totalTokensUsed,
      totalCost,
      requestsByDay,
      topModels,
    });
  } catch (error) {
    console.error('[Admin AI Usage] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
