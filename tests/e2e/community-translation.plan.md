# CCgather Community Auto-Translation - E2E Test Plan

## Application Overview

The CCgather Community feature is a multilingual social platform integrated into the leaderboard page, designed to connect Claude Code developers worldwide without language barriers. Key features include:

### Core Features
- **Auto-Translation System**: Batch translation of posts and comments using Gemini API
- **Translation Caching**: Intelligent caching system to minimize API costs
- **Shimmer Loading States**: Visual feedback during translation with TextShimmer component
- **User Preference Persistence**: Auto-translate toggle state saved to database
- **Language Detection**: Automatic detection of content language
- **Translation On-Demand**: Lazy loading of translations based on scroll visibility

### Community Stats
- **Hall of Fame**: Showcase of most-liked and most-replied posts (Today/Weekly/Monthly)
- **Top Countries**: Country rankings by post count and likes
- **Filter System**: Time period filters (Today/Weekly/Monthly)
- **Real-time Aggregation**: Live stats updated from post/comment interactions

### Technical Architecture
- **Translation API**: `/api/community/translate-batch` (batch processing, max 100 items)
- **Settings API**: `/api/community/settings` (GET/PATCH for user preferences)
- **Posts API**: `/api/community/posts` (returns auto_translate_enabled flag)
- **Hook**: `useLazyTranslation` for debounced batch translation
- **Component**: `CommunityFeedSection` with toggle control
- **Persistence**: `user_notification_settings` table stores `auto_translate` preference

---

## Mock Data Design

### Mock User Settings
```typescript
export interface MockCommunitySettings {
  settings: {
    notify_rank_updates: boolean;
    notify_level_up: boolean;
    notify_badges: boolean;
    notify_submissions: boolean;
    notify_post_likes: boolean;
    notify_post_comments: boolean;
    notify_comment_replies: boolean;
    auto_translate: boolean;
  };
  preferred_language: string;
  supported_languages: string[];
}

export function createMockCommunitySettings(
  autoTranslate: boolean = true,
  preferredLanguage: string = 'en'
): MockCommunitySettings {
  return {
    settings: {
      notify_rank_updates: true,
      notify_level_up: true,
      notify_badges: true,
      notify_submissions: true,
      notify_post_likes: true,
      notify_post_comments: true,
      notify_comment_replies: true,
      auto_translate: autoTranslate,
    },
    preferred_language: preferredLanguage,
    supported_languages: ['en', 'ko', 'ja', 'zh', 'es', 'fr', 'de', 'pt'],
  };
}
```

### Mock Community Posts
```typescript
export interface MockCommunityPost {
  id: string;
  author: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    current_level: number;
    country_code: string | null;
  };
  content: string;
  tab: 'vibes' | 'showcase' | 'help' | 'canu';
  original_language: string;
  created_at: string;
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
  liked_by: Array<{
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  }>;
  preview_comments: Array<{
    id: string;
    author: {
      id: string;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
      current_level: number;
    };
    content: string;
    original_language: string;
    likes_count: number;
    created_at: string;
    is_liked: boolean;
    replies_count: number;
  }>;
  has_more_comments: boolean;
}

export function createMockCommunityPosts(count: number = 20): MockCommunityPost[] {
  const languages = ['en', 'ko', 'ja', 'zh', 'es'];
  const tabs = ['vibes', 'showcase', 'help', 'canu'] as const;
  const countries = ['US', 'KR', 'JP', 'CN', 'ES', 'FR', 'DE'];

  const sampleContent: Record<string, string[]> = {
    en: [
      'Just got my CLI working! This is amazing!',
      'Sharing my latest project built with Claude Code',
      'How do I optimize token usage?',
      'Can anyone help me debug this error?',
    ],
    ko: [
      'Claude Code 정말 대박이네요!',
      '제가 만든 프로젝트 공유합니다',
      '토큰 사용량을 어떻게 최적화하나요?',
      '이 에러 좀 도와주실 수 있나요?',
    ],
    ja: [
      'Claude Code すごく便利です!',
      '新しいプロジェクトをシェアします',
      'トークン使用量を最適化するには?',
      'このエラーを助けてください',
    ],
    zh: [
      'Claude Code 太棒了！',
      '分享我的最新项目',
      '如何优化令牌使用？',
      '有人能帮我调试这个错误吗？',
    ],
    es: [
      '¡Claude Code es increíble!',
      'Compartiendo mi último proyecto',
      '¿Cómo optimizar el uso de tokens?',
      '¿Alguien puede ayudarme con este error?',
    ],
  };

  return Array.from({ length: count }, (_, i) => {
    const lang = languages[i % languages.length]!;
    const contentIndex = i % 4;
    const country = countries[i % countries.length]!;

    return {
      id: `post-${i + 1}`,
      author: {
        id: `user-${(i % 10) + 1}`,
        username: `developer${(i % 10) + 1}`,
        display_name: `Developer ${(i % 10) + 1}`,
        avatar_url: i % 3 === 0 ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${i}` : null,
        current_level: Math.floor(i / 5) + 1,
        country_code: country,
      },
      content: sampleContent[lang]![contentIndex]!,
      tab: tabs[i % tabs.length]!,
      original_language: lang,
      created_at: new Date(Date.now() - i * 3600000).toISOString(),
      likes_count: Math.floor(Math.random() * 50),
      comments_count: i % 3 === 0 ? Math.floor(Math.random() * 10) : 0,
      is_liked: i % 7 === 0,
      liked_by: [],
      preview_comments: [],
      has_more_comments: false,
    };
  });
}

export function createCommunityPostsResponse(
  posts: MockCommunityPost[],
  autoTranslateEnabled: boolean = true,
  preferredLanguage: string = 'en'
) {
  return {
    posts,
    total: posts.length,
    hasMore: false,
    auto_translate_enabled: autoTranslateEnabled,
    preferred_language: preferredLanguage,
  };
}
```

### Mock Translation Response
```typescript
export interface MockTranslationResult {
  id: string;
  type: 'post' | 'comment';
  translated_text: string;
  from_cache: boolean;
}

export function createMockTranslationResponse(
  items: Array<{ id: string; type: 'post' | 'comment'; text: string }>,
  targetLanguage: string
): { translations: MockTranslationResult[]; stats: { total: number; from_cache: number; translated: number } } {
  // Simple mock translation: prepend "[Translated]" to text
  const translations = items.map(item => ({
    id: item.id,
    type: item.type,
    translated_text: `[Translated to ${targetLanguage}] ${item.text}`,
    from_cache: Math.random() > 0.5, // Random cache hit
  }));

  const fromCacheCount = translations.filter(t => t.from_cache).length;

  return {
    translations,
    stats: {
      total: items.length,
      from_cache: fromCacheCount,
      translated: items.length - fromCacheCount,
    },
  };
}
```

### Mock Hall of Fame Response
```typescript
export interface MockHallOfFameEntry {
  id: string;
  postId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  count: number;
}

export function createMockHallOfFame(period: 'today' | 'weekly' | 'monthly') {
  const multiplier = period === 'today' ? 1 : period === 'weekly' ? 7 : 30;

  return {
    most_liked: Array.from({ length: 3 }, (_, i) => ({
      id: `hof-liked-${i + 1}`,
      postId: `post-${i + 1}`,
      userId: `user-${i + 1}`,
      userName: `TopDev${i + 1}`,
      userAvatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${i}`,
      count: (50 - i * 10) * multiplier,
    })),
    most_replied: Array.from({ length: 3 }, (_, i) => ({
      id: `hof-replied-${i + 1}`,
      postId: `post-${i + 4}`,
      userId: `user-${i + 4}`,
      userName: `ActiveDev${i + 1}`,
      userAvatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${i + 10}`,
      count: (30 - i * 7) * multiplier,
    })),
  };
}
```

### Mock Country Stats Response
```typescript
export interface MockCommunityCountryStat {
  code: string;
  name: string;
  posts: number;
  likes: number;
  contributors: number;
}

export function createMockCountryStats(): MockCommunityCountryStat[] {
  const countries = [
    { code: 'US', name: 'United States', base: 100 },
    { code: 'KR', name: 'South Korea', base: 85 },
    { code: 'JP', name: 'Japan', base: 70 },
    { code: 'CN', name: 'China', base: 60 },
    { code: 'DE', name: 'Germany', base: 45 },
    { code: 'FR', name: 'France', base: 40 },
    { code: 'ES', name: 'Spain', base: 35 },
    { code: 'BR', name: 'Brazil', base: 30 },
  ];

  return countries.map(c => ({
    code: c.code,
    name: c.name,
    posts: c.base + Math.floor(Math.random() * 20),
    likes: c.base * 2 + Math.floor(Math.random() * 50),
    contributors: Math.floor(c.base / 5) + Math.floor(Math.random() * 10),
  }));
}
```

---

## Test Scenarios

### Scenario 1: Guest User - Toggle Not Visible

**Objective**: Verify that non-authenticated users cannot see or interact with the auto-translate toggle.

**Prerequisites**:
- User is not signed in (no auth token)
- Fresh browser state (no cached auth)

**Steps**:
1. Navigate to `/leaderboard`
2. Wait for page to load (leaderboard table visible)
3. Click on "Community" tab
4. Wait for community feed to load

**Expected Results**:
- Auto-translate banner is visible
- Banner shows informational text: "Connect with Claude Code developers worldwide. No language barriers!"
- Toggle switch is **not visible** in the banner
- Posts are displayed in their original languages (no shimmer effects)
- API call to `/api/community/posts` returns `auto_translate_enabled: false` (or true with no effect)

**Verification Points**:
```javascript
// Toggle should not be visible
await expect(page.locator('button[aria-label*="auto-translate"]')).toHaveCount(0);

// Banner should be visible but without toggle
await expect(page.locator('text=Auto-translate')).toBeVisible();
await expect(page.getByText('Connect with Claude Code developers worldwide')).toBeVisible();

// Posts should display original content
const firstPost = page.locator('[data-testid="feed-card"]').first();
await expect(firstPost).toBeVisible();
// No shimmer effect
await expect(firstPost.locator('.shimmer')).toHaveCount(0);
```

---

### Scenario 2: Signed-in User - Toggle ON - Shimmer Effect

**Objective**: Verify that signed-in users see shimmer loading states when auto-translate is enabled and translations are being fetched.

**Prerequisites**:
- User is authenticated (mock auth state)
- User has `auto_translate: true` in settings
- User's `preferred_language: 'en'`

**Mock Setup**:
```typescript
// Mock /api/community/settings response
await page.route('/api/community/settings', async route => {
  await route.fulfill({
    json: createMockCommunitySettings(true, 'en'),
  });
});

// Mock /api/community/posts with non-English posts
const mockPosts = createMockCommunityPosts(10);
await page.route('/api/community/posts*', async route => {
  await route.fulfill({
    json: createCommunityPostsResponse(mockPosts, true, 'en'),
  });
});

// Mock translation API with delay to see shimmer
await page.route('/api/community/translate-batch', async route => {
  const request = route.request();
  const postData = request.postDataJSON();

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  await route.fulfill({
    json: createMockTranslationResponse(postData.items, postData.targetLanguage),
  });
});
```

**Steps**:
1. Navigate to `/leaderboard` (with mocked auth)
2. Click on "Community" tab
3. Wait for community feed to load
4. Observe posts with `original_language !== 'en'`

**Expected Results**:
- Toggle switch is **visible** and **ON** (cyan color)
- Banner shows: "Auto-translate" in cyan color
- Subtitle shows: "Posts appear in your language"
- Posts in foreign languages initially show **shimmer effect** (TextShimmer component)
- Translation loading indicator appears: "Translating..." with pulsing dot
- After ~1 second, shimmer resolves to translated text
- API call to `/api/community/translate-batch` is made with correct items
- Translated content displays with "[Translated to en]" prefix

**Verification Points**:
```javascript
// Toggle is visible and ON
const toggle = page.locator('button[aria-label="Disable auto-translate"]');
await expect(toggle).toBeVisible();
await expect(toggle).toHaveClass(/bg-\[var\(--color-accent-cyan\)\]/);

// Loading state visible
await expect(page.getByText('Translating...')).toBeVisible();
await expect(page.locator('.animate-ping')).toBeVisible();

// Shimmer effect on foreign posts
const foreignPost = page.locator('[data-testid="feed-card"]').filter({ has: page.locator('.shimmer') }).first();
await expect(foreignPost).toBeVisible();

// Wait for translation to complete
await page.waitForTimeout(1500);

// Shimmer should be gone
await expect(page.locator('.shimmer')).toHaveCount(0);

// Translated text visible
await expect(page.getByText(/\[Translated to en\]/)).toBeVisible();

// Loading indicator gone
await expect(page.getByText('Translating...')).toHaveCount(0);
```

---

### Scenario 3: Toggle OFF - Original Text Display

**Objective**: Verify that toggling auto-translate OFF shows original posts and saves preference to database.

**Prerequisites**:
- User is authenticated
- Auto-translate is currently ON

**Mock Setup**:
```typescript
let autoTranslateSetting = true;

// Mock GET settings
await page.route('/api/community/settings', async route => {
  await route.fulfill({
    json: createMockCommunitySettings(autoTranslateSetting, 'en'),
  });
});

// Mock PATCH settings
await page.route('/api/community/settings', async route => {
  if (route.request().method() === 'PATCH') {
    const body = route.request().postDataJSON();
    autoTranslateSetting = body.auto_translate;

    await route.fulfill({
      json: {
        settings: { ...createMockCommunitySettings(autoTranslateSetting, 'en').settings },
        preferred_language: 'en',
      },
    });
  }
});
```

**Steps**:
1. Navigate to `/leaderboard` with Community tab open
2. Verify toggle is ON (cyan)
3. Click toggle switch
4. Wait for state update

**Expected Results**:
- Toggle switches to OFF state (gray/white background)
- Banner text changes to: "Showing original posts"
- "Auto-translate" label color changes to muted gray
- All posts immediately show **original content** (no translations)
- No shimmer effects visible
- API call made: `PATCH /api/community/settings` with `{ auto_translate: false }`
- Response confirms update successful
- No calls to `/api/community/translate-batch`

**Verification Points**:
```javascript
// Click toggle
const toggle = page.locator('button[aria-label="Disable auto-translate"]');
await toggle.click();

// Wait for API call
const patchRequest = await page.waitForRequest(
  request => request.url().includes('/api/community/settings') && request.method() === 'PATCH'
);
expect(patchRequest.postDataJSON()).toMatchObject({ auto_translate: false });

// Toggle state changed
await expect(page.locator('button[aria-label="Enable auto-translate"]')).toBeVisible();
await expect(page.locator('button[aria-label="Enable auto-translate"]')).toHaveClass(/bg-\[var\(--color-bg-card\)\]/);

// Banner text updated
await expect(page.getByText('Showing original posts')).toBeVisible();
await expect(page.locator('text=Auto-translate').first()).toHaveClass(/text-\[var\(--color-text-muted\)\]/);

// Original content visible
await expect(page.getByText('Claude Code 정말 대박이네요!')).toBeVisible(); // Korean post
await expect(page.getByText('Claude Code すごく便利です!')).toBeVisible(); // Japanese post

// No translation requests
const translationCalls = [];
page.on('request', request => {
  if (request.url().includes('/api/community/translate-batch')) {
    translationCalls.push(request);
  }
});
await page.waitForTimeout(2000);
expect(translationCalls.length).toBe(0);
```

---

### Scenario 4: Infinite Scroll - Lazy Translation

**Objective**: Verify that newly loaded posts trigger translation when scrolled into view.

**Prerequisites**:
- User is authenticated
- Auto-translate is ON
- Infinite scroll enabled (hasMore: true)

**Mock Setup**:
```typescript
let offset = 0;
const allPosts = createMockCommunityPosts(50);

await page.route('/api/community/posts*', async route => {
  const url = new URL(route.request().url());
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const currentOffset = parseInt(url.searchParams.get('offset') || '0');

  const posts = allPosts.slice(currentOffset, currentOffset + limit);
  const hasMore = currentOffset + limit < allPosts.length;

  await route.fulfill({
    json: {
      posts,
      total: allPosts.length,
      hasMore,
      auto_translate_enabled: true,
      preferred_language: 'en',
    },
  });
});

// Track translation requests
const translationBatches = [];
await page.route('/api/community/translate-batch', async route => {
  const body = route.request().postDataJSON();
  translationBatches.push(body.items);

  await route.fulfill({
    json: createMockTranslationResponse(body.items, 'en'),
  });
});
```

**Steps**:
1. Navigate to Community feed
2. Wait for initial posts to load
3. Scroll to bottom of feed
4. Wait for "Loading more..." indicator
5. Wait for new posts to appear
6. Observe shimmer effects on new posts

**Expected Results**:
- Initial 20 posts load with shimmer → translation
- Scroll triggers `onLoadMore` callback
- "Loading more..." indicator appears
- API call: `GET /api/community/posts?offset=20&limit=20`
- New posts appear in feed
- New posts with foreign languages show shimmer effect
- Second translation batch API call made for new posts
- Translations complete, shimmers resolve

**Verification Points**:
```javascript
// Initial load
await expect(page.locator('[data-testid="feed-card"]')).toHaveCount(20);

// Scroll to bottom
const feedContainer = page.locator('.scrollbar-hide').first();
await feedContainer.evaluate(el => el.scrollTop = el.scrollHeight);

// Loading indicator
await expect(page.getByText('Loading more...')).toBeVisible();

// New posts loaded
await expect(page.locator('[data-testid="feed-card"]')).toHaveCount(40, { timeout: 5000 });

// Check translation batches
await page.waitForTimeout(1500);
expect(translationBatches.length).toBeGreaterThanOrEqual(2);

// Second batch contains new post IDs
const firstBatchIds = translationBatches[0].map(item => item.id);
const secondBatchIds = translationBatches[1].map(item => item.id);
const overlap = firstBatchIds.filter(id => secondBatchIds.includes(id));
expect(overlap.length).toBe(0); // No duplicate translations
```

---

### Scenario 5: Page Refresh - State Persistence

**Objective**: Verify that auto-translate toggle state persists across page refreshes.

**Prerequisites**:
- User is authenticated
- User has previously set `auto_translate: false`

**Mock Setup**:
```typescript
// Mock with auto_translate OFF from start
await page.route('/api/community/settings', async route => {
  await route.fulfill({
    json: createMockCommunitySettings(false, 'en'),
  });
});
```

**Steps**:
1. Navigate to `/leaderboard` Community tab
2. Verify toggle is OFF
3. Perform hard refresh (F5)
4. Wait for page reload
5. Navigate back to Community tab

**Expected Results**:
- After refresh, toggle remains **OFF**
- Banner shows "Showing original posts"
- No translation API calls made
- Posts display in original languages
- Settings API called on page load: `GET /api/community/settings`
- Response contains `auto_translate: false`

**Verification Points**:
```javascript
// Initial state - toggle OFF
await page.goto('/leaderboard');
await page.locator('text=Community').click();
await expect(page.locator('button[aria-label="Enable auto-translate"]')).toBeVisible();
await expect(page.getByText('Showing original posts')).toBeVisible();

// Refresh
await page.reload();
await page.locator('text=Community').click();

// State persisted
await expect(page.locator('button[aria-label="Enable auto-translate"]')).toBeVisible();
await expect(page.getByText('Showing original posts')).toBeVisible();

// Verify API call
const settingsRequest = await page.waitForRequest(
  request => request.url().includes('/api/community/settings') && request.method() === 'GET'
);
const settingsResponse = await settingsRequest.response();
const data = await settingsResponse?.json();
expect(data.settings.auto_translate).toBe(false);
```

---

### Scenario 6: Hall of Fame - Period Filtering

**Objective**: Verify that Hall of Fame displays correct stats for different time periods and updates on filter change.

**Prerequisites**:
- User is authenticated
- Hall of Fame component visible in sidebar

**Mock Setup**:
```typescript
await page.route('/api/community/hall-of-fame*', async route => {
  const url = new URL(route.request().url());
  const period = url.searchParams.get('period') || 'today';

  await route.fulfill({
    json: createMockHallOfFame(period as 'today' | 'weekly' | 'monthly'),
  });
});
```

**Steps**:
1. Navigate to Community tab
2. Locate Hall of Fame section
3. Verify default period is "Today"
4. Check top 3 most-liked posts
5. Check top 3 most-replied posts
6. Click "Weekly" filter
7. Wait for data refresh
8. Click "Monthly" filter
9. Wait for data refresh

**Expected Results**:
- Default shows "Today" stats
- Most-liked section displays 3 entries with rank badges (#1 crown, #2, #3)
- Most-replied section displays 3 entries
- Clicking "Weekly" triggers API call: `GET /api/community/hall-of-fame?period=weekly`
- Stats update with higher counts (multiplied by 7)
- Clicking "Monthly" triggers API call: `GET /api/community/hall-of-fame?period=monthly`
- Stats update with even higher counts (multiplied by 30)
- Crown icon visible for #1 ranks
- User avatars displayed correctly

**Verification Points**:
```javascript
// Locate Hall of Fame
const hallOfFame = page.locator('[data-testid="hall-of-fame"]').or(page.getByText('Hall of Fame').locator('..'));

// Default period
await expect(hallOfFame.locator('button:has-text("Today")')).toHaveClass(/active|selected/);

// Most-liked entries
const likedEntries = hallOfFame.locator('[data-category="liked"]').locator('[data-testid="hof-entry"]');
await expect(likedEntries).toHaveCount(3);

// Crown for #1
const firstEntry = likedEntries.first();
await expect(firstEntry.locator('svg').first()).toBeVisible(); // Crown icon

// Click Weekly
await hallOfFame.locator('button:has-text("Weekly")').click();

// Wait for API call
const weeklyRequest = await page.waitForRequest(
  request => request.url().includes('/api/community/hall-of-fame?period=weekly')
);
await weeklyRequest.response();

// Stats updated
await expect(likedEntries.first().locator('text=/\\d+/')).toContainText(/[0-9]{2,}/); // Higher count

// Click Monthly
await hallOfFame.locator('button:has-text("Monthly")').click();
const monthlyRequest = await page.waitForRequest(
  request => request.url().includes('/api/community/hall-of-fame?period=monthly')
);
await monthlyRequest.response();
```

---

### Scenario 7: Top Countries - Stats Aggregation

**Objective**: Verify that Top Countries section displays correct aggregated stats and supports sorting.

**Prerequisites**:
- User is authenticated
- Community Country Stats component visible

**Mock Setup**:
```typescript
await page.route('/api/community/country-stats*', async route => {
  await route.fulfill({
    json: createMockCountryStats(),
  });
});
```

**Steps**:
1. Navigate to Community tab
2. Locate Top Countries section
3. Verify default sorting (by posts)
4. Check top 5 countries display
5. Verify flag icons for each country
6. Click "Sort by Likes" button
7. Wait for re-sort animation
8. Verify order changed

**Expected Results**:
- Default shows countries sorted by **post count** descending
- Each country row shows:
  - Rank badge (#1 gold, #2 silver, #3 bronze)
  - Flag icon
  - Country name
  - Post count (cyan color when sorted by posts)
  - Likes count
- User's country highlighted with green indicator (🟢)
- Clicking "Sort by Likes" re-orders countries
- Likes count becomes cyan (active sort indicator)
- Post count becomes muted gray
- Bar chart updates to reflect current sort metric

**Verification Points**:
```javascript
// Locate Top Countries
const topCountries = page.locator('[data-testid="top-countries"]').or(page.getByText('Top Countries').locator('..'));

// Default sort by posts
await expect(topCountries.locator('button:has-text("Posts")').or(topCountries.locator('[data-sort="posts"]'))).toHaveClass(/active|text-cyan/);

// Country entries
const countryRows = topCountries.locator('[data-testid="country-row"]');
await expect(countryRows).toHaveCount(8);

// First country has highest posts
const firstCountry = countryRows.first();
await expect(firstCountry).toContainText(/#1/);
await expect(firstCountry.locator('[data-testid="flag-icon"]')).toBeVisible();

// User country highlighted (if KR in list)
const userCountry = countryRows.filter({ hasText: '🟢' });
if (await userCountry.count() > 0) {
  await expect(userCountry).toHaveClass(/bg-\[var\(--user-country-bg\)\]/);
}

// Sort by likes
await topCountries.locator('button:has-text("Likes")').or(topCountries.locator('[data-sort="likes"]')).click();

// Wait for animation
await page.waitForTimeout(500);

// Likes indicator active
await expect(topCountries.locator('button:has-text("Likes")').or(topCountries.locator('[data-sort="likes"]'))).toHaveClass(/active|text-coral/);

// Order may have changed
const firstCountryAfterSort = countryRows.first();
await expect(firstCountryAfterSort).toContainText(/#1/);
```

---

### Scenario 8: Translation Cache Behavior

**Objective**: Verify that translations are cached and reused to minimize API costs.

**Prerequisites**:
- User is authenticated
- Auto-translate is ON

**Mock Setup**:
```typescript
const translationCache = new Map<string, string>();
let apiCallCount = 0;

await page.route('/api/community/translate-batch', async route => {
  apiCallCount++;
  const body = route.request().postDataJSON();
  const items = body.items;

  const results = items.map(item => {
    const cacheKey = `${item.type}:${item.id}:${body.targetLanguage}`;

    if (translationCache.has(cacheKey)) {
      return {
        id: item.id,
        type: item.type,
        translated_text: translationCache.get(cacheKey),
        from_cache: true,
      };
    } else {
      const translation = `[Translated] ${item.text}`;
      translationCache.set(cacheKey, translation);
      return {
        id: item.id,
        type: item.type,
        translated_text: translation,
        from_cache: false,
      };
    }
  });

  const fromCacheCount = results.filter(r => r.from_cache).length;

  await route.fulfill({
    json: {
      translations: results,
      stats: {
        total: items.length,
        from_cache: fromCacheCount,
        translated: items.length - fromCacheCount,
      },
    },
  });
});
```

**Steps**:
1. Navigate to Community feed (auto-translate ON)
2. Wait for initial translation batch
3. Verify API call count
4. Toggle auto-translate OFF
5. Toggle auto-translate ON
6. Wait for re-translation
7. Verify cache hits

**Expected Results**:
- First load: API called with `from_cache: 0`
- Translations stored in cache
- Toggle OFF → ON: API called again for same posts
- Second response: `from_cache: 20` (all posts cached)
- API call count increases but no new translations generated
- Performance improved (faster display, lower costs)

**Verification Points**:
```javascript
// Initial load
await page.goto('/leaderboard');
await page.locator('text=Community').click();
await page.waitForTimeout(1500);

expect(apiCallCount).toBe(1);
expect(translationCache.size).toBeGreaterThan(0);

// Toggle OFF then ON
await page.locator('button[aria-label="Disable auto-translate"]').click();
await page.waitForTimeout(500);
await page.locator('button[aria-label="Enable auto-translate"]').click();

// Wait for re-fetch
await page.waitForTimeout(1500);

// API called again but with cache hits
expect(apiCallCount).toBe(2);

// Verify cache stats in response
const lastRequest = await page.waitForRequest(
  request => request.url().includes('/api/community/translate-batch')
);
const lastResponse = await lastRequest.response();
const data = await lastResponse?.json();
expect(data.stats.from_cache).toBeGreaterThan(0);
```

---

### Scenario 9: Error Handling - Translation Failure

**Objective**: Verify graceful degradation when translation API fails.

**Prerequisites**:
- User is authenticated
- Auto-translate is ON

**Mock Setup**:
```typescript
let shouldFail = true;

await page.route('/api/community/translate-batch', async route => {
  if (shouldFail) {
    await route.fulfill({
      status: 500,
      json: {
        error: 'Translation failed',
        details: 'Gemini API unavailable',
      },
    });
  } else {
    // Success case
    const body = route.request().postDataJSON();
    await route.fulfill({
      json: createMockTranslationResponse(body.items, body.targetLanguage),
    });
  }
});
```

**Steps**:
1. Navigate to Community feed
2. Wait for translation attempt
3. Observe error handling
4. Verify original content displayed
5. Retry after error resolved

**Expected Results**:
- Translation API returns 500 error
- Shimmer effects timeout and resolve to **original content** (fallback)
- No error toast/modal shown to user (silent failure)
- "Translating..." indicator disappears
- User can still read posts in original languages
- Console logs error for debugging
- After error resolved, next load attempts translation again

**Verification Points**:
```javascript
// Wait for translation attempt
await page.goto('/leaderboard');
await page.locator('text=Community').click();

// Loading indicator appears
await expect(page.getByText('Translating...')).toBeVisible();

// Wait for timeout
await page.waitForTimeout(3000);

// Loading indicator gone
await expect(page.getByText('Translating...')).toHaveCount(0);

// Original content visible (not "[Translated]")
await expect(page.getByText('Claude Code 정말 대박이네요!')).toBeVisible();

// No error modals
await expect(page.locator('[role="alert"]')).toHaveCount(0);

// Resolve error
shouldFail = false;

// Refresh feed
await page.locator('text=All').click(); // Switch tab to trigger reload
await page.locator('text=Vibes').click();

// Wait for successful translation
await page.waitForTimeout(2000);
await expect(page.getByText(/\[Translated\]/)).toBeVisible();
```

---

### Scenario 10: Mobile Responsiveness - Toggle Accessibility

**Objective**: Verify that auto-translate toggle works correctly on mobile viewports.

**Prerequisites**:
- Mobile viewport (375x667 - iPhone SE)
- User is authenticated

**Steps**:
1. Set viewport to mobile size
2. Navigate to `/leaderboard`
3. Tap Community tab
4. Verify toggle visibility and size
5. Tap toggle switch
6. Verify state change

**Expected Results**:
- Toggle renders at appropriate size for mobile (touch-friendly)
- Banner text wraps correctly on narrow screens
- Toggle remains accessible and easy to tap (min 44x44px touch target)
- Shimmer effects display correctly on mobile
- Feed cards are responsive and readable
- No horizontal scrolling issues

**Verification Points**:
```javascript
// Set mobile viewport
await page.setViewportSize({ width: 375, height: 667 });

await page.goto('/leaderboard');
await page.locator('text=Community').click();

// Toggle visible and appropriately sized
const toggle = page.locator('button[aria-label*="auto-translate"]');
await expect(toggle).toBeVisible();

const toggleBox = await toggle.boundingBox();
expect(toggleBox!.width).toBeGreaterThanOrEqual(36); // 9*4 = 36px minimum
expect(toggleBox!.height).toBeGreaterThanOrEqual(20); // 5*4 = 20px minimum

// Tap toggle
await toggle.tap();

// State changes
await expect(page.locator('button[aria-label*="auto-translate"]')).toBeVisible();

// Feed cards responsive
const feedCard = page.locator('[data-testid="feed-card"]').first();
const cardBox = await feedCard.boundingBox();
expect(cardBox!.width).toBeLessThanOrEqual(375); // No overflow

// No horizontal scroll
const horizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
expect(horizontalScroll).toBe(false);
```

---

## Test Execution Guidelines

### Test File Structure
```
tests/e2e/
├── community-translation.spec.ts      # Scenarios 1-3, 5, 8-9
├── community-translation-scroll.spec.ts   # Scenario 4 (infinite scroll)
├── community-stats.spec.ts           # Scenarios 6-7 (Hall of Fame, Top Countries)
├── community-responsive.spec.ts      # Scenario 10 (mobile)
└── fixtures/
    └── community-mocks.ts            # All mock data functions
```

### Setup and Teardown
- Use `beforeEach` to reset mock states
- Clear translation cache between tests
- Reset `auto_translate` setting to `true` by default
- Use authenticated test context for most tests
- Use unauthenticated context for Scenario 1

### Performance Benchmarks
- Initial feed load: < 2 seconds
- Translation batch API: < 1.5 seconds for 20 items
- Toggle state change: < 300ms
- Infinite scroll load: < 1 second

### Accessibility Checks
- Toggle has proper ARIA labels ("Enable/Disable auto-translate")
- Loading states announced to screen readers
- Keyboard navigation works (Tab to toggle, Space/Enter to activate)
- Color contrast meets WCAG AA standards

---

## Integration Points

### API Dependencies
- `GET /api/community/settings` - User preferences
- `PATCH /api/community/settings` - Update preferences
- `GET /api/community/posts` - Post list with auto_translate flag
- `POST /api/community/translate-batch` - Batch translation
- `GET /api/community/hall-of-fame?period=<today|weekly|monthly>` - Stats
- `GET /api/community/country-stats` - Country aggregations

### State Management
- `useLazyTranslation` hook manages translation state
- Parent component (`LeaderboardPage`) manages toggle state
- Settings persisted to `user_notification_settings` table
- Translations cached in `translations` table

### Error Recovery
- Translation failures fall back to original content
- Network errors retry with exponential backoff
- Cache misses trigger new API calls
- Invalid responses logged but don't break UI

---

## Success Criteria

### All Tests Must Pass
- ✅ Guest users cannot access toggle (Scenario 1)
- ✅ Shimmer effects display during translation (Scenario 2)
- ✅ Toggle OFF shows original content (Scenario 3)
- ✅ Infinite scroll triggers lazy translation (Scenario 4)
- ✅ Settings persist across refreshes (Scenario 5)
- ✅ Hall of Fame filters work correctly (Scenario 6)
- ✅ Top Countries sorting functions (Scenario 7)
- ✅ Translation cache reduces API calls (Scenario 8)
- ✅ Errors handled gracefully (Scenario 9)
- ✅ Mobile viewport fully functional (Scenario 10)

### Quality Gates
- Test coverage > 90% for translation logic
- No console errors during normal operation
- All API responses match schema definitions
- Accessibility score > 90 (Lighthouse)
- No memory leaks in long scrolling sessions

---

## Notes for QA Team

1. **Language Detection**: The system auto-detects post language using regex patterns. Test with various character sets (Korean, Japanese, Chinese, Spanish).

2. **Debouncing**: Translations are debounced by 300ms to batch requests. Multiple rapid scrolls should result in fewer API calls.

3. **Cache Invalidation**: Translation cache is keyed by `content_id + content_type + target_language`. Changing user's preferred language invalidates cache.

4. **Cost Tracking**: Production environment logs all translation API usage to `ai_usage_log` table. Monitor for excessive API calls.

5. **Rate Limiting**: Consider implementing rate limits on translation API to prevent abuse (currently unlimited for authenticated users).

6. **Fallback Strategy**: If Gemini API is unavailable, consider implementing a fallback translation service (e.g., Google Translate API).

---

## Future Test Scenarios

### Not in Current Scope
- Comment translation (follow same pattern as posts)
- Real-time translation updates (when new posts arrive via WebSocket)
- Translation quality assessment (BLEU score comparisons)
- Multi-language UI (translating interface elements)
- Translation revision history (showing both original and translated side-by-side)

---

**Document Version**: 1.0
**Last Updated**: 2026-01-30
**Author**: Claude Code QA Team
**Review Status**: Ready for Implementation
