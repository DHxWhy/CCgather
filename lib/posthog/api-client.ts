/**
 * PostHog API Client for Server-Side Data Fetching
 * Used by Admin Analytics Dashboard
 */

const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
const POSTHOG_API_KEY = process.env.POSTHOG_PERSONAL_API_KEY;
const PROJECT_ID = process.env.POSTHOG_PROJECT_ID;

interface PostHogQueryOptions {
  dateRange?: { date_from: string; date_to?: string };
  interval?: "hour" | "day" | "week" | "month";
  breakdown?: string;
}

interface TrendsQueryResult {
  results: Array<{
    label: string;
    data: Array<{ date: string; count: number }>;
    count: number;
  }>;
}

interface FunnelQueryResult {
  results: Array<{
    name: string;
    count: number;
    percentage: number;
  }>;
}

interface RetentionQueryResult {
  results: Array<{
    date: string;
    values: number[];
  }>;
}

interface EventsListResult {
  results: Array<{
    id: string;
    event: string;
    timestamp: string;
    properties: Record<string, unknown>;
  }>;
  next?: string;
}

class PostHogApiClient {
  private baseUrl: string;
  private headers: HeadersInit;

  constructor() {
    this.baseUrl = `${POSTHOG_HOST}/api/projects/${PROJECT_ID}`;
    this.headers = {
      Authorization: `Bearer ${POSTHOG_API_KEY}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Check if the client is properly configured
   */
  isConfigured(): boolean {
    return !!(POSTHOG_API_KEY && PROJECT_ID);
  }

  /**
   * Get trends data for specified events
   */
  async getTrends(events: string[], options: PostHogQueryOptions = {}): Promise<TrendsQueryResult> {
    if (!this.isConfigured()) {
      throw new Error("PostHog API not configured");
    }

    const response = await fetch(`${this.baseUrl}/query/`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        query: {
          kind: "TrendsQuery",
          dateRange: options.dateRange || { date_from: "-7d" },
          interval: options.interval || "day",
          series: events.map((event) => ({
            event,
            kind: "EventsNode",
          })),
          breakdownFilter: options.breakdown
            ? {
                breakdown: options.breakdown,
                breakdown_type: "event",
              }
            : undefined,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[PostHog API] Trends error:", error);
      throw new Error(`PostHog API error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get funnel data for specified steps
   */
  async getFunnel(steps: string[], options: PostHogQueryOptions = {}): Promise<FunnelQueryResult> {
    if (!this.isConfigured()) {
      throw new Error("PostHog API not configured");
    }

    const response = await fetch(`${this.baseUrl}/query/`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        query: {
          kind: "FunnelsQuery",
          dateRange: options.dateRange || { date_from: "-7d" },
          series: steps.map((event) => ({
            event,
            kind: "EventsNode",
          })),
          funnelsFilter: {
            funnelWindowInterval: 7,
            funnelWindowIntervalUnit: "day",
          },
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[PostHog API] Funnel error:", error);
      throw new Error(`PostHog API error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get retention cohort data
   */
  async getRetention(options: PostHogQueryOptions = {}): Promise<RetentionQueryResult> {
    if (!this.isConfigured()) {
      throw new Error("PostHog API not configured");
    }

    const response = await fetch(`${this.baseUrl}/query/`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        query: {
          kind: "RetentionQuery",
          dateRange: options.dateRange || { date_from: "-30d" },
          retentionFilter: {
            retentionType: "retention_first_time",
            totalIntervals: 7,
            period: "Day",
          },
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[PostHog API] Retention error:", error);
      throw new Error(`PostHog API error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get recent events list
   */
  async getEvents(limit = 100, event?: string): Promise<EventsListResult> {
    if (!this.isConfigured()) {
      throw new Error("PostHog API not configured");
    }

    const params = new URLSearchParams({ limit: String(limit) });
    if (event) params.set("event", event);

    const response = await fetch(`${this.baseUrl}/events/?${params}`, {
      headers: this.headers,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[PostHog API] Events error:", error);
      throw new Error(`PostHog API error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; latency_ms: number }> {
    const start = Date.now();

    if (!this.isConfigured()) {
      return {
        status: "not_configured",
        latency_ms: Date.now() - start,
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/`, {
        headers: this.headers,
      });

      return {
        status: response.ok ? "healthy" : "degraded",
        latency_ms: Date.now() - start,
      };
    } catch {
      return {
        status: "unhealthy",
        latency_ms: Date.now() - start,
      };
    }
  }
}

// Singleton instance
export const posthogApi = new PostHogApiClient();

// Export types
export type { TrendsQueryResult, FunnelQueryResult, RetentionQueryResult, EventsListResult };
