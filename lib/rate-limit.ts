/**
 * Simple in-memory rate limiter
 * For production, consider using Redis with @upstash/ratelimit
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  limit: number;
  /** Time window in milliseconds */
  windowMs: number;
}

// In-memory store for rate limiting
// In production, use Redis or a distributed cache
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup interval reference (lazy initialized)
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

// Start cleanup interval (lazy initialization)
function ensureCleanupRunning() {
  if (cleanupInterval) return;

  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now > entry.resetTime) {
        rateLimitStore.delete(key);
      }
    }
    // Auto-stop if store is empty (memory optimization)
    if (rateLimitStore.size === 0 && cleanupInterval) {
      clearInterval(cleanupInterval);
      cleanupInterval = null;
    }
  }, 60000); // Clean up every minute

  // Prevent interval from keeping Node.js process alive
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
}

/**
 * Check rate limit for a given identifier
 */
export function checkRateLimit(identifier: string, config: RateLimitConfig): RateLimitResult {
  // Ensure cleanup is running (lazy init)
  ensureCleanupRunning();

  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  // If no entry or entry has expired, create new one
  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return {
      success: true,
      limit: config.limit,
      remaining: config.limit - 1,
      resetTime: now + config.windowMs,
    };
  }

  // Check if limit exceeded
  if (entry.count >= config.limit) {
    return {
      success: false,
      limit: config.limit,
      remaining: 0,
      resetTime: entry.resetTime,
    };
  }

  // Increment count
  entry.count++;
  return {
    success: true,
    limit: config.limit,
    remaining: config.limit - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * Pre-configured rate limiters for different endpoints
 */
export const rateLimiters = {
  /** Submit API: 10 requests per hour */
  submit: (identifier: string) =>
    checkRateLimit(`submit:${identifier}`, {
      limit: 10,
      windowMs: 60 * 60 * 1000, // 1 hour
    }),

  /** Profile update: 20 requests per hour */
  profileUpdate: (identifier: string) =>
    checkRateLimit(`profile:${identifier}`, {
      limit: 20,
      windowMs: 60 * 60 * 1000, // 1 hour
    }),

  /** API key generation: 5 requests per day */
  apiKeyGen: (identifier: string) =>
    checkRateLimit(`apikey:${identifier}`, {
      limit: 5,
      windowMs: 24 * 60 * 60 * 1000, // 24 hours
    }),

  /** General API: 100 requests per minute */
  general: (identifier: string) =>
    checkRateLimit(`general:${identifier}`, {
      limit: 100,
      windowMs: 60 * 1000, // 1 minute
    }),

  /** Bulk submit: 5 requests per hour */
  bulkSubmit: (identifier: string) =>
    checkRateLimit(`bulk:${identifier}`, {
      limit: 5,
      windowMs: 60 * 60 * 1000, // 1 hour
    }),
};

/**
 * Create rate limit headers for response
 */
export function createRateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    "X-RateLimit-Limit": result.limit.toString(),
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": Math.ceil(result.resetTime / 1000).toString(),
  };
}

/**
 * Get client identifier from request (IP or API key)
 */
export function getClientIdentifier(request: Request, apiKey?: string): string {
  // Prefer API key if available
  if (apiKey) {
    return `key:${apiKey}`;
  }

  // Fallback to IP address
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  return `ip:${ip}`;
}
