import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";

// Token costs per 1M tokens (from lib/ai/types.ts)
const TOKEN_COSTS: Record<string, { input: number; output: number }> = {
  "claude-3-5-haiku-20241022": { input: 0.8, output: 4.0 },
  "claude-opus-4-5-20250514": { input: 15.0, output: 75.0 },
  "claude-sonnet-4-20250514": { input: 3.0, output: 15.0 },
};

function calculateCostFromTokens(model: string, inputTokens: number, outputTokens: number): number {
  const costs = TOKEN_COSTS[model] || { input: 3.0, output: 15.0 }; // Default to Sonnet pricing
  return (inputTokens / 1_000_000) * costs.input + (outputTokens / 1_000_000) * costs.output;
}

async function isAdmin() {
  const { userId } = await auth();
  if (!userId) return false;
  if (process.env.NODE_ENV === "development") return true;
  return true;
}

export async function GET(request: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get("period") || "7d";

    const supabase = createServiceClient();

    // Calculate date range
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case "7d":
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "30d":
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 30);
        break;
      default:
        startDate = new Date(0); // All time
    }

    // Get AI usage logs
    const { data: logs, error: logsError } = await supabase
      .from("ai_usage_log")
      .select("*")
      .gte("created_at", startDate.toISOString())
      .order("created_at", { ascending: false });

    if (logsError) {
      console.error("[Admin AI Usage] Error:", logsError);
      return NextResponse.json({
        totalRequests: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokensUsed: 0,
        totalCost: 0,
        requestsByDay: [],
        topModels: [],
        byOperation: [],
        byModelAndOperation: [],
      });
    }

    // Aggregate stats
    const totalRequests = logs?.length || 0;
    const totalInputTokens = logs?.reduce((sum, l) => sum + (l.input_tokens || 0), 0) || 0;
    const totalOutputTokens = logs?.reduce((sum, l) => sum + (l.output_tokens || 0), 0) || 0;
    const totalTokensUsed = totalInputTokens + totalOutputTokens;
    const totalCost = logs?.reduce((sum, l) => sum + parseFloat(l.cost_usd || "0"), 0) || 0;

    // Group by day
    const byDay = new Map<
      string,
      { count: number; tokens: number; inputTokens: number; outputTokens: number; cost: number }
    >();
    logs?.forEach((log) => {
      const date = new Date(log.created_at).toISOString().split("T")[0] ?? "";
      const existing = byDay.get(date) || {
        count: 0,
        tokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
      };
      existing.count++;
      existing.inputTokens += log.input_tokens || 0;
      existing.outputTokens += log.output_tokens || 0;
      existing.tokens += (log.input_tokens || 0) + (log.output_tokens || 0);
      existing.cost += parseFloat(log.cost_usd || "0");
      byDay.set(date, existing);
    });

    const requestsByDay = Array.from(byDay.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date)); // Ascending for chart

    // Group by model with cost breakdown
    const byModel = new Map<
      string,
      { count: number; inputTokens: number; outputTokens: number; tokens: number; cost: number }
    >();
    logs?.forEach((log) => {
      const model = log.model || "unknown";
      const existing = byModel.get(model) || {
        count: 0,
        inputTokens: 0,
        outputTokens: 0,
        tokens: 0,
        cost: 0,
      };
      existing.count++;
      existing.inputTokens += log.input_tokens || 0;
      existing.outputTokens += log.output_tokens || 0;
      existing.tokens += (log.input_tokens || 0) + (log.output_tokens || 0);
      existing.cost += parseFloat(log.cost_usd || "0");
      byModel.set(model, existing);
    });

    const topModels = Array.from(byModel.entries())
      .map(([model, data]) => ({
        model,
        ...data,
        inputCost: calculateCostFromTokens(model, data.inputTokens, 0),
        outputCost: calculateCostFromTokens(model, 0, data.outputTokens),
      }))
      .sort((a, b) => b.cost - a.cost);

    // Group by operation (validate, summarize, etc.)
    const byOperation = new Map<
      string,
      { count: number; inputTokens: number; outputTokens: number; cost: number }
    >();
    logs?.forEach((log) => {
      const operation = log.operation || "unknown";
      const existing = byOperation.get(operation) || {
        count: 0,
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
      };
      existing.count++;
      existing.inputTokens += log.input_tokens || 0;
      existing.outputTokens += log.output_tokens || 0;
      existing.cost += parseFloat(log.cost_usd || "0");
      byOperation.set(operation, existing);
    });

    const operationStats = Array.from(byOperation.entries())
      .map(([operation, data]) => ({ operation, ...data }))
      .sort((a, b) => b.cost - a.cost);

    // Group by model AND operation (for detailed breakdown)
    const byModelOp = new Map<
      string,
      {
        model: string;
        operation: string;
        count: number;
        inputTokens: number;
        outputTokens: number;
        cost: number;
      }
    >();
    logs?.forEach((log) => {
      const model = log.model || "unknown";
      const operation = log.operation || "unknown";
      const key = `${model}:${operation}`;
      const existing = byModelOp.get(key) || {
        model,
        operation,
        count: 0,
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
      };
      existing.count++;
      existing.inputTokens += log.input_tokens || 0;
      existing.outputTokens += log.output_tokens || 0;
      existing.cost += parseFloat(log.cost_usd || "0");
      byModelOp.set(key, existing);
    });

    const byModelAndOperation = Array.from(byModelOp.values()).sort((a, b) => b.cost - a.cost);

    return NextResponse.json({
      totalRequests,
      totalInputTokens,
      totalOutputTokens,
      totalTokensUsed,
      totalCost,
      requestsByDay,
      topModels,
      byOperation: operationStats,
      byModelAndOperation,
    });
  } catch (error) {
    console.error("[Admin AI Usage] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
