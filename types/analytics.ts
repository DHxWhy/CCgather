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
  // News Events
  | "news_tab_view"
  | "news_article_click"
  | "news_category_filter"
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
  // News Events
  news_tab_view: {
    category?: string;
  };
  news_article_click: {
    article_id: string;
    category: string;
    source_name: string;
  };
  news_category_filter: {
    category: string;
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

// Funnel Response
export interface AnalyticsFunnelResponse {
  funnel: string;
  steps: FunnelStep[];
  overallConversion: number;
  dateRange: DateRange;
}

export interface FunnelStep {
  name: string;
  count: number;
  percentage: number;
  dropOff: number;
  dropOffPercent: number;
  avgTime?: string;
}

// Content Response
export interface AnalyticsContentResponse {
  metrics: {
    totalViews: MetricWithTrend;
    avgTime: MetricWithTrend;
    ctr: MetricWithTrend;
  };
  byCategory: CategoryMetric[];
  topArticles: ArticleMetric[];
  dateRange: DateRange;
}

export interface CategoryMetric {
  category: string;
  views: number;
  clicks: number;
  ctr: number;
}

export interface ArticleMetric {
  id: string;
  title: string;
  category: string;
  views: number;
  clicks: number;
  ctr: number;
  avgTime: string;
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

export interface FunnelQueryParams extends AnalyticsQueryParams {
  funnel: "signup" | "engagement";
}

export interface ContentQueryParams extends AnalyticsQueryParams {
  category?: string;
}
