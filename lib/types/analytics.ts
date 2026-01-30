/**
 * PostHog Analytics Type Definitions
 */

// ============================================
// Event Types
// ============================================

export type AnalyticsEventName =
  // User Events
  | "user_signup"
  | "user_login"
  | "profile_complete"
  | "profile_update"
  // CLI Events
  | "cli_install_click"
  | "cli_sync_complete"
  | "cli_auth_complete"
  // Leaderboard Events
  | "leaderboard_view"
  | "leaderboard_filter"
  | "my_rank_view"
  | "my_rank_click"
  // Profile Events
  | "profile_panel_open"
  | "profile_view"
  // Engagement Events
  | "feature_discovery"
  | "cta_click";

export interface AnalyticsEventProperties {
  // User Events
  user_signup: {
    method: "clerk" | "google" | "github";
    country?: string;
  };
  user_login: {
    method: "clerk" | "google" | "github";
  };
  profile_complete: {
    country: string;
    plan?: string;
  };
  profile_update: {
    fields: string[];
  };
  // CLI Events
  cli_install_click: {
    source: "leaderboard" | "profile" | "onboarding" | "hero";
  };
  cli_sync_complete: {
    tokens: number;
    cost: number;
  };
  cli_auth_complete: Record<string, never>;
  // Leaderboard Events
  leaderboard_view: {
    period: "daily" | "weekly" | "monthly" | "all-time";
    country_filter?: string;
  };
  leaderboard_filter: {
    filter_type: "period" | "country";
    value: string;
  };
  my_rank_view: {
    rank: number | null;
  };
  my_rank_click: {
    current_rank: number | null;
  };
  // Profile Events
  profile_panel_open: {
    target_user_id: string;
    target_username: string;
  };
  profile_view: {
    target_user_id: string;
  };
  // Engagement Events
  feature_discovery: {
    feature: string;
  };
  cta_click: {
    cta_name: string;
    location: string;
  };
}

// ============================================
// API Response Types
// ============================================

export interface MetricWithTrend {
  value: number;
  previousValue: number;
  change: number;
  changePercent: number;
  trend: "up" | "down" | "neutral";
}

export interface DateRange {
  from: string;
  to?: string;
}

// Overview Response
export interface AnalyticsOverviewResponse {
  metrics: {
    dau: MetricWithTrend;
    totalEvents: MetricWithTrend;
    signups: MetricWithTrend;
    avgSessionDuration: MetricWithTrend;
  };
  topEvents: EventSummary[];
  dateRange: DateRange;
}

export interface EventSummary {
  event: string;
  count: number;
  timestamp?: string;
}

// Trends Response
export interface AnalyticsTrendsResponse {
  results: TrendSeries[];
  dateRange: DateRange;
  interval: string;
}

export interface TrendSeries {
  label: string;
  data: TrendDataPoint[];
  total: number;
}

export interface TrendDataPoint {
  date: string;
  count: number;
}

// Users Response
export interface AnalyticsUsersResponse {
  metrics: {
    dau: MetricWithTrend;
    wau: MetricWithTrend;
    mau: MetricWithTrend;
  };
  byCountry: CountryMetric[];
  dateRange: DateRange;
}

export interface CountryMetric {
  country: string;
  countryCode: string;
  users: number;
  percentage: number;
}

// Retention Response
export interface AnalyticsRetentionResponse {
  cohorts: RetentionCohort[];
  dateRange: DateRange;
}

export interface RetentionCohort {
  date: string;
  size: number;
  retention: number[];
}

// ============================================
// Query Parameters
// ============================================

export interface AnalyticsQueryParams {
  date_from?: string;
  date_to?: string;
  interval?: "hour" | "day" | "week" | "month";
  breakdown?: string;
  events?: string[];
}
