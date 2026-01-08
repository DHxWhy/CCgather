import { getConfig, getApiUrl } from "./config.js";

export interface SyncPayload {
  totalTokens: number;
  totalSpent: number;
  modelBreakdown: Record<string, number>;
  timestamp: string;
}

export interface UserStats {
  rank: number;
  totalTokens: number;
  totalSpent: number;
  tier: string;
  badges: string[];
  percentile: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const config = getConfig();
  const apiToken = config.get("apiToken");
  const apiUrl = getApiUrl();

  if (!apiToken) {
    return { success: false, error: "Not authenticated. Run: npx ccgather auth" };
  }

  try {
    const response = await fetch(`${apiUrl}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken}`,
        ...options.headers,
      },
    });

    const data = (await response.json()) as T & { error?: string };

    if (!response.ok) {
      return { success: false, error: data.error || `HTTP ${response.status}` };
    }

    return { success: true, data: data as T };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

export async function syncUsage(payload: SyncPayload): Promise<ApiResponse<{ rank: number }>> {
  return fetchApi("/cli/sync", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getStatus(): Promise<ApiResponse<UserStats>> {
  return fetchApi("/cli/status");
}

export async function verifyToken(
  token: string
): Promise<ApiResponse<{ userId: string; username: string }>> {
  try {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/cli/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const data = (await response.json()) as { userId: string; username: string; error?: string };

    if (!response.ok) {
      return { success: false, error: data.error || "Invalid token" };
    }

    return { success: true, data: { userId: data.userId, username: data.username } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}
