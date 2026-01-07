# CCGather Backend Development Plan

**Version:** 1.1
**Date:** 2025-01-06
**Status:** Updated

---

## 1. Technology Stack

| Category | Technology | Purpose |
|----------|------------|---------|
| **Platform** | Supabase | Managed PostgreSQL + Realtime |
| **Database** | PostgreSQL 15 | Primary data store |
| **Auth** | Clerk | GitHub OAuth, Session management |
| **Realtime** | Supabase Realtime | Live leaderboard updates |
| **Edge Functions** | Supabase (Deno) | Private logic (crawler, AI) |
| **API Routes** | Next.js | Public API endpoints |
| **Validation** | Zod | Schema validation |

---

## 2. Database Schema

### 2.1 Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────────┐       ┌────────────────┐
│   users     │───────│  usage_stats    │       │  user_badges   │
├─────────────┤ 1:N   ├─────────────────┤       ├────────────────┤
│ id (PK)     │       │ id (PK)         │       │ id (PK)        │
│ clerk_id    │◀──────│ user_id (FK)    │       │ user_id (FK)   │
│ github_id   │       │ date            │       │ badge_type     │
│ username    │       │ input_tokens    │       │ earned_at      │
│ country_code│       │ output_tokens   │       └────────────────┘
│ total_tokens│       │ cache_tokens    │              │
│ global_rank │       │ total_tokens    │              │
│ ...         │       │ cost_usd        │              │
└─────────────┘       │ primary_model   │              │
      │               └─────────────────┘              │
      │                                                │
      │        ┌─────────────────┐                     │
      │        │ badge_display   │◀────────────────────┘
      │        ├─────────────────┤
      └───────▶│ user_id (FK,PK)│
               │ displayed_badges│
               └─────────────────┘

┌─────────────────┐       ┌─────────────────┐
│ country_stats   │       │  news_items     │
├─────────────────┤       ├─────────────────┤
│ country_code(PK)│       │ id (PK)         │
│ country_name    │       │ source_url      │
│ total_users     │       │ original_title  │
│ total_tokens    │       │ summary_md      │
│ global_rank     │       │ category        │
└─────────────────┘       │ crawled_at      │
                          └─────────────────┘

┌─────────────────┐
│ daily_snapshots │
├─────────────────┤
│ id (PK)         │
│ snapshot_date   │
│ user_id (FK)    │
│ global_rank     │
│ country_rank    │
│ total_tokens    │
└─────────────────┘
```

### 2.2 Table Definitions

#### users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id TEXT UNIQUE NOT NULL,
  github_id TEXT UNIQUE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  email TEXT,
  country_code CHAR(2),
  timezone TEXT DEFAULT 'UTC',

  -- Denormalized stats (updated on submission)
  total_tokens BIGINT DEFAULT 0,
  total_cost DECIMAL(12, 4) DEFAULT 0,
  current_level INTEGER DEFAULT 1,
  global_rank INTEGER,
  country_rank INTEGER,

  -- Model tracking
  primary_model TEXT,
  primary_model_updated_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_submission_at TIMESTAMPTZ,

  -- Settings
  auto_sync_enabled BOOLEAN DEFAULT FALSE,
  profile_visible BOOLEAN DEFAULT TRUE,
  onboarding_completed BOOLEAN DEFAULT FALSE
);
```

#### usage_stats
```sql
CREATE TABLE usage_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,

  -- Token breakdown
  input_tokens BIGINT DEFAULT 0,
  output_tokens BIGINT DEFAULT 0,
  cache_read_tokens BIGINT DEFAULT 0,
  cache_write_tokens BIGINT DEFAULT 0,
  total_tokens BIGINT DEFAULT 0,

  -- Cost
  cost_usd DECIMAL(10, 4) DEFAULT 0,

  -- Model
  primary_model TEXT,

  -- Submission metadata
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  submission_source TEXT, -- 'cli', 'hook', 'api'
  validation_status TEXT DEFAULT 'approved',

  UNIQUE(user_id, date)
);
```

#### user_badges
```sql
CREATE TABLE user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  badge_type TEXT NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, badge_type)
);
```

#### badge_display
```sql
CREATE TABLE badge_display (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  displayed_badges TEXT[] DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### country_stats
```sql
CREATE TABLE country_stats (
  country_code CHAR(2) PRIMARY KEY,
  country_name TEXT NOT NULL,
  total_users INTEGER DEFAULT 0,
  total_tokens BIGINT DEFAULT 0,
  total_cost DECIMAL(14, 4) DEFAULT 0,
  global_rank INTEGER,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### news_items
```sql
CREATE TABLE news_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url TEXT UNIQUE NOT NULL,
  source_name TEXT NOT NULL,
  source_type TEXT,
  original_title TEXT NOT NULL,
  original_content TEXT,
  summary_md TEXT,
  key_points TEXT[],
  category TEXT,
  relevance_score INTEGER,
  published_at TIMESTAMPTZ,
  crawled_at TIMESTAMPTZ DEFAULT NOW(),
  summarized_at TIMESTAMPTZ,
  is_featured BOOLEAN DEFAULT FALSE,
  is_visible BOOLEAN DEFAULT TRUE
);
```

#### daily_snapshots
```sql
CREATE TABLE daily_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  global_rank INTEGER,
  country_rank INTEGER,
  total_tokens BIGINT,
  total_cost DECIMAL(12, 4),
  level INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(snapshot_date, user_id)
);
```

### 2.3 Indexes

```sql
CREATE INDEX idx_users_clerk_id ON users(clerk_id);
CREATE INDEX idx_users_country ON users(country_code);
CREATE INDEX idx_users_global_rank ON users(global_rank);
CREATE INDEX idx_users_total_tokens ON users(total_tokens DESC);

CREATE INDEX idx_usage_user_date ON usage_stats(user_id, date DESC);
CREATE INDEX idx_usage_date ON usage_stats(date DESC);

CREATE INDEX idx_badges_user ON user_badges(user_id);

CREATE INDEX idx_news_crawled ON news_items(crawled_at DESC);
CREATE INDEX idx_news_category ON news_items(category);

CREATE INDEX idx_snapshots_date ON daily_snapshots(snapshot_date DESC);
CREATE INDEX idx_snapshots_user ON daily_snapshots(user_id);
```

---

## 3. Row Level Security (RLS) Policies

### 3.1 users Table

```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Public can read visible profiles
CREATE POLICY "Public profiles viewable"
  ON users FOR SELECT
  USING (profile_visible = TRUE);

-- Users can read own profile (even if hidden)
CREATE POLICY "Users read own profile"
  ON users FOR SELECT
  USING (auth.uid()::text = clerk_id);

-- Users can update own profile
CREATE POLICY "Users update own profile"
  ON users FOR UPDATE
  USING (auth.uid()::text = clerk_id)
  WITH CHECK (auth.uid()::text = clerk_id);
```

### 3.2 usage_stats Table

```sql
ALTER TABLE usage_stats ENABLE ROW LEVEL SECURITY;

-- Public can read all stats
CREATE POLICY "Stats are public"
  ON usage_stats FOR SELECT
  USING (TRUE);

-- Users can insert own stats
CREATE POLICY "Users insert own stats"
  ON usage_stats FOR INSERT
  WITH CHECK (
    user_id IN (
      SELECT id FROM users WHERE clerk_id = auth.uid()::text
    )
  );

-- Users can update own stats (same day)
CREATE POLICY "Users update own stats"
  ON usage_stats FOR UPDATE
  USING (
    user_id IN (
      SELECT id FROM users WHERE clerk_id = auth.uid()::text
    )
  );
```

### 3.3 user_badges Table

```sql
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

-- Public can read badges
CREATE POLICY "Badges are public"
  ON user_badges FOR SELECT
  USING (TRUE);

-- Only service role can modify badges
-- (No INSERT/UPDATE policies for anon/authenticated)
```

### 3.4 Other Tables

```sql
-- country_stats: Public read-only (service role updates)
ALTER TABLE country_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Country stats public" ON country_stats FOR SELECT USING (TRUE);

-- news_items: Public read-only (service role inserts)
ALTER TABLE news_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "News public" ON news_items FOR SELECT USING (is_visible = TRUE);

-- daily_snapshots: Public read-only
ALTER TABLE daily_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Snapshots public" ON daily_snapshots FOR SELECT USING (TRUE);
```

---

## 4. API Endpoints

### 4.1 Public Endpoints

| Endpoint | Method | Description | Cache |
|----------|--------|-------------|-------|
| `/api/leaderboard` | GET | Get leaderboard | 30s |
| `/api/user/[username]` | GET | Get user profile | 60s |
| `/api/user/[username]/chart` | GET | Get chart data | 2min |
| `/api/countries` | GET | Get country stats | 5min |
| `/api/news` | GET | Get news feed | 5min |
| `/api/og/profile/[username]` | GET | Generate OG image | 1hr |

### 4.2 Protected Endpoints

| Endpoint | Method | Description | Rate Limit |
|----------|--------|-------------|------------|
| `/api/submit` | POST | Submit usage data | 6/hr |
| `/api/me` | GET | Get current user | - |
| `/api/me` | PATCH | Update profile | 10/hr |
| `/api/me/badges/display` | POST | Update badge display | 10/hr |

### 4.3 Webhook Endpoints

| Endpoint | Method | Source | Secret |
|----------|--------|--------|--------|
| `/api/webhooks/clerk` | POST | Clerk | CLERK_WEBHOOK_SECRET |

---

## 5. API Request/Response Schemas

### 5.1 GET /api/leaderboard

**Query Parameters:**
```typescript
interface LeaderboardQuery {
  period?: 'today' | '7d' | '30d' | 'all'; // default: 'all'
  country?: string; // ISO 3166-1 alpha-2
  sort?: 'tokens' | 'cost'; // default: 'tokens'
  page?: number; // default: 1
  limit?: number; // default: 25, max: 100
}
```

**Response:**
```typescript
interface LeaderboardResponse {
  data: {
    rank: number;
    rankChange: number;
    user: {
      username: string;
      displayName: string;
      avatarUrl: string;
      countryCode: string;
      level: number;
      primaryModel: string;
    };
    tokens: number;
    cost: number;
  }[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  meta: {
    period: string;
    country: string | null;
    sort: string;
    updatedAt: string;
  };
}
```

### 5.2 POST /api/submit

**Request:**
```typescript
interface SubmitRequest {
  date: string; // YYYY-MM-DD (UTC)
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  totalTokens: number;
  costUsd: number;
  primaryModel?: string;
  source: 'cli' | 'hook' | 'api';
}
```

**Response:**
```typescript
interface SubmitResponse {
  success: boolean;
  data: {
    submissionId: string;
    date: string;
    tokens: number;
    cost: number;
    rank: {
      global: number;
      globalChange: number;
      country: number;
      countryChange: number;
    };
  };
}
```

### 5.3 GET /api/user/[username]

**Response:**
```typescript
interface ProfileResponse {
  username: string;
  displayName: string;
  avatarUrl: string;
  countryCode: string;
  timezone: string;
  level: number;
  levelName: string;
  levelIcon: string;
  totalTokens: number;
  totalCost: number;
  globalRank: number;
  countryRank: number;
  primaryModel: string;
  badges: {
    type: string;
    earnedAt: string;
  }[];
  displayedBadges: string[];
  stats: {
    avgDailyCost: number;
    activeDays: number;
    currentStreak: number;
    longestStreak: number;
  };
  createdAt: string;
  lastSubmissionAt: string;
}
```

---

## 6. Data Validation

### 6.1 Submission Validation

```typescript
const submitSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  cacheReadTokens: z.number().int().min(0).optional(),
  cacheWriteTokens: z.number().int().min(0).optional(),
  totalTokens: z.number().int().min(0),
  costUsd: z.number().min(0),
  primaryModel: z.string().optional(),
  source: z.enum(['cli', 'hook', 'api']),
}).refine(
  (data) => {
    // Token math validation
    const cacheTokens = (data.cacheReadTokens || 0) + (data.cacheWriteTokens || 0);
    return data.totalTokens === data.inputTokens + data.outputTokens + cacheTokens;
  },
  { message: 'Token totals do not match' }
).refine(
  (data) => {
    // No future dates
    const submittedDate = new Date(data.date);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return submittedDate <= today;
  },
  { message: 'Cannot submit future dates' }
);
```

### 6.2 Anomaly Detection

```typescript
interface AnomalyCheck {
  // Hard limits (auto-reject)
  maxDailyCost: 5000; // $5,000
  maxDailyTokens: 500_000_000_000; // 500B

  // Soft limits (flag for review)
  suspiciousGrowthRate: 10; // 1000% increase
  suspiciousDailyCost: 1000; // $1,000
}
```

---

## 7. Database Functions

### 7.1 Rank Calculation

```sql
-- Trigger function: Update ranks after submission
CREATE OR REPLACE FUNCTION calculate_ranks()
RETURNS TRIGGER AS $$
BEGIN
  -- Update global ranks
  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY total_tokens DESC) as new_rank
    FROM users
    WHERE profile_visible = TRUE
  )
  UPDATE users u
  SET global_rank = r.new_rank
  FROM ranked r
  WHERE u.id = r.id;

  -- Update country ranks
  WITH country_ranked AS (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY country_code
        ORDER BY total_tokens DESC
      ) as new_country_rank
    FROM users
    WHERE profile_visible = TRUE AND country_code IS NOT NULL
  )
  UPDATE users u
  SET country_rank = cr.new_country_rank
  FROM country_ranked cr
  WHERE u.id = cr.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 7.2 User Stats Update

```sql
-- Trigger: Update user totals after usage_stats insert
CREATE OR REPLACE FUNCTION update_user_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE users
  SET
    total_tokens = (
      SELECT COALESCE(SUM(total_tokens), 0)
      FROM usage_stats
      WHERE user_id = NEW.user_id
    ),
    total_cost = (
      SELECT COALESCE(SUM(cost_usd), 0)
      FROM usage_stats
      WHERE user_id = NEW.user_id
    ),
    last_submission_at = NOW(),
    primary_model = NEW.primary_model,
    primary_model_updated_at = NOW(),
    updated_at = NOW()
  WHERE id = NEW.user_id;

  -- Calculate level
  UPDATE users
  SET current_level = calculate_level(total_tokens)
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_usage_insert
  AFTER INSERT OR UPDATE ON usage_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_user_stats();
```

### 7.3 Level Calculation

```sql
CREATE OR REPLACE FUNCTION calculate_level(tokens BIGINT)
RETURNS INTEGER AS $$
BEGIN
  RETURN CASE
    WHEN tokens >= 100000000000 THEN 10  -- 100B+
    WHEN tokens >= 30000000000 THEN 9    -- 30B+
    WHEN tokens >= 10000000000 THEN 8    -- 10B+
    WHEN tokens >= 3000000000 THEN 7     -- 3B+
    WHEN tokens >= 1000000000 THEN 6     -- 1B+
    WHEN tokens >= 500000000 THEN 5      -- 500M+
    WHEN tokens >= 200000000 THEN 4      -- 200M+
    WHEN tokens >= 50000000 THEN 3       -- 50M+
    WHEN tokens >= 10000000 THEN 2       -- 10M+
    ELSE 1
  END;
END;
$$ LANGUAGE plpgsql;
```

---

## 8. Edge Functions (Private)

### 8.1 News Crawler

```typescript
// supabase/functions/news-crawler/index.ts
// 🔒 PRIVATE - Not in GitHub

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from '@supabase/supabase-js';

serve(async (req) => {
  // Verify cron secret
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${Deno.env.get('CRON_SECRET')}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Crawl sources
  const sources = [
    { url: 'https://www.anthropic.com/news', type: 'official' },
    { url: 'https://github.com/anthropics/claude-code/releases', type: 'github' },
  ];

  // ... crawling logic

  return new Response(JSON.stringify({ crawled: items.length }));
});
```

### 8.2 AI Summarizer

```typescript
// supabase/functions/ai-summarizer/index.ts
// 🔒 PRIVATE - Not in GitHub

serve(async (req) => {
  // Get unsummarized items
  const { data: items } = await supabase
    .from('news_items')
    .select('*')
    .is('summary_md', null)
    .limit(10);

  for (const item of items) {
    const summary = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      messages: [{
        role: 'user',
        content: SUMMARIZE_PROMPT.replace('{{content}}', item.original_content)
      }]
    });

    // Update item with summary
  }

  return new Response(JSON.stringify({ summarized: items.length }));
});
```

### 8.3 Daily Snapshot

```typescript
// supabase/functions/daily-snapshot/index.ts
// Runs at UTC 00:00

serve(async (req) => {
  const today = new Date().toISOString().split('T')[0];

  // Get all users with their current ranks
  const { data: users } = await supabase
    .from('users')
    .select('id, global_rank, country_rank, total_tokens, total_cost, current_level');

  // Insert snapshots
  const snapshots = users.map(u => ({
    snapshot_date: today,
    user_id: u.id,
    global_rank: u.global_rank,
    country_rank: u.country_rank,
    total_tokens: u.total_tokens,
    total_cost: u.total_cost,
    level: u.current_level,
  }));

  await supabase.from('daily_snapshots').insert(snapshots);

  return new Response(JSON.stringify({ created: snapshots.length }));
});
```

---

## 9. Webhook Handler

### 9.1 Clerk Webhook

```typescript
// app/api/webhooks/clerk/route.ts

import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET!;

  const headerPayload = headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      'svix-id': svix_id!,
      'svix-timestamp': svix_timestamp!,
      'svix-signature': svix_signature!,
    }) as WebhookEvent;
  } catch (err) {
    return new Response('Webhook verification failed', { status: 400 });
  }

  switch (evt.type) {
    case 'user.created':
      await handleUserCreated(evt.data);
      break;
    case 'user.updated':
      await handleUserUpdated(evt.data);
      break;
    case 'user.deleted':
      await handleUserDeleted(evt.data);
      break;
  }

  return new Response('OK', { status: 200 });
}
```

---

## 10. Security Checklist

### 10.1 Authentication & Authorization

- [x] Clerk for auth (no custom auth)
- [x] RLS on all tables
- [x] Service role key server-only
- [x] Webhook signature verification
- [ ] Rate limiting on API routes
- [ ] Input validation with Zod

### 10.2 Data Protection

- [x] No sensitive data in public response
- [x] Profile visibility toggle
- [ ] Data export endpoint (GDPR)
- [ ] Account deletion (GDPR)
- [ ] Encrypted CLI tokens

### 10.3 API Security

- [ ] Rate limiting: 100 req/min per IP
- [ ] CORS configuration
- [ ] Input sanitization
- [ ] SQL injection prevention (Supabase handles)
- [ ] XSS prevention (React handles)

---

## 11. Monitoring & Logging

### 11.1 Metrics to Track

| Metric | Source | Alert Threshold |
|--------|--------|-----------------|
| API Response Time | Vercel | > 2s |
| DB Query Time | Supabase | > 500ms |
| Error Rate | Sentry | > 1% |
| Webhook Failures | Logs | > 3/hour |
| Submission Rate | DB | Anomaly detection |

### 11.2 Logging Strategy

```typescript
// Structured logging
const log = {
  info: (msg: string, meta?: object) => console.log(JSON.stringify({ level: 'info', msg, ...meta })),
  error: (msg: string, meta?: object) => console.error(JSON.stringify({ level: 'error', msg, ...meta })),
  warn: (msg: string, meta?: object) => console.warn(JSON.stringify({ level: 'warn', msg, ...meta })),
};

// Usage
log.info('Submission received', { userId: '...', tokens: 1000 });
log.error('Validation failed', { error: err.message, input: sanitized });
```

---

## 12. Implementation Priority

### Phase 1: Foundation (Week 1-2)
- [ ] Supabase project setup
- [ ] Database schema migration
- [ ] RLS policies
- [ ] Clerk webhook handler
- [ ] Basic API routes

### Phase 2: Core (Week 3-4)
- [ ] Leaderboard API
- [ ] Profile API
- [ ] Submit API
- [ ] Rank calculation triggers
- [ ] Rate limiting

### Phase 3: Enhancement (Week 5-6)
- [ ] Chart data API
- [ ] Country stats API
- [ ] Badge system triggers
- [ ] Daily snapshot function

### Phase 4: Private (Week 9-10)
- [ ] News crawler (Edge Function)
- [ ] AI summarizer (Edge Function)
- [ ] News API

---

**Document End**

*Backend Plan Version: 1.0*
*Last Updated: 2025-01-05*
