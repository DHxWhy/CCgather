import { createServiceClient } from "@/lib/supabase/server";

export interface PublicStats {
  summary: {
    totalUsers: number;
    totalCountries: number;
    tokens30d: number;
    sessions30d: number;
  };
  growth: { date: string; signups: number; cumulative: number }[];
  countries: { countryCode: string; users: number; weekSignups: number }[];
  recentSyncs: { countryCode: string; syncedAt: string }[];
  models: { family: string; pct: number }[];
}

interface SummaryRow {
  total_users: number;
  total_countries: number;
  tokens_30d: number;
  sessions_30d: number;
}

interface GrowthRow {
  date: string;
  signups: number;
  cumulative: number;
}

interface CountryRaceRow {
  country_code: string;
  total_users: number;
  week_signups: number;
  prev_week_signups: number;
}

interface RecentSyncRow {
  country_code: string;
  synced_at: string;
}

interface ModelRow {
  family: string;
  total_tokens: number;
  pct: number;
}

const PUBLIC_GROWTH_DAYS = 90;

function fillDailyGrowth(rows: PublicStats["growth"]): PublicStats["growth"] {
  if (rows.length === 0) return rows;
  const byDate = new Map(rows.map((r) => [r.date, r]));
  const filled: PublicStats["growth"] = [];
  const cursor = new Date(`${rows[0]!.date}T00:00:00Z`);
  const today = new Date();
  let cumulative = 0;
  while (cursor.toISOString().slice(0, 10) <= today.toISOString().slice(0, 10)) {
    const date = cursor.toISOString().slice(0, 10);
    const hit = byDate.get(date);
    if (hit) cumulative = hit.cumulative;
    filled.push({ date, signups: hit?.signups ?? 0, cumulative });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return filled;
}

export async function getPublicStats(): Promise<PublicStats> {
  const supabase = createServiceClient();
  // 신규 RPC는 자동 생성 타입에 없어 우회 (프로젝트 규칙)
  const sb = supabase as never as {
    rpc: (fn: string) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  };

  const [summaryRes, growthRes, raceRes, syncsRes, modelsRes] = await Promise.all([
    sb.rpc("get_public_stats_summary"),
    sb.rpc("get_signup_growth"),
    sb.rpc("get_country_race"),
    sb.rpc("get_recent_syncs"),
    sb.rpc("get_model_distribution"),
  ]);

  const failures = (
    [
      ["summary", summaryRes],
      ["growth", growthRes],
      ["race", raceRes],
      ["syncs", syncsRes],
      ["models", modelsRes],
    ] as const
  ).filter(([, res]) => res.error);
  if (failures.length > 0) {
    const detail = failures.map(([name, res]) => `${name}: ${res.error!.message}`).join("; ");
    throw new Error(`publicStats query failed — ${detail}`);
  }

  const s = ((summaryRes.data as SummaryRow[]) ?? [])[0];

  return {
    summary: {
      totalUsers: Number(s?.total_users ?? 0),
      totalCountries: Number(s?.total_countries ?? 0),
      tokens30d: Number(s?.tokens_30d ?? 0),
      sessions30d: Number(s?.sessions_30d ?? 0),
    },
    growth: fillDailyGrowth(
      ((growthRes.data as GrowthRow[]) ?? []).map((r) => ({
        date: r.date,
        signups: Number(r.signups),
        cumulative: Number(r.cumulative),
      }))
    ).slice(-PUBLIC_GROWTH_DAYS),
    countries: ((raceRes.data as CountryRaceRow[]) ?? []).slice(0, 10).map((r) => ({
      countryCode: r.country_code,
      users: Number(r.total_users),
      weekSignups: Number(r.week_signups),
    })),
    recentSyncs: ((syncsRes.data as RecentSyncRow[]) ?? []).map((r) => ({
      countryCode: r.country_code,
      syncedAt: r.synced_at,
    })),
    models: ((modelsRes.data as ModelRow[]) ?? []).map((r) => ({
      family: r.family,
      pct: Number(r.pct),
    })),
  };
}
