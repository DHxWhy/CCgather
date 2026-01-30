# CCgather Community Auto-Translation - Enhanced E2E Test Plan

## Executive Summary

This test plan provides comprehensive E2E testing scenarios for the CCgather Community auto-translation feature, covering user flows, edge cases, error handling, and integration testing. The plan addresses the technical constraints of Next.js Server Components and Playwright's API mocking limitations.

---

## Application Architecture Overview

### Component Hierarchy
```
LeaderboardPage (Client Component)
└── CommunityFeedSection (Memoized)
    ├── Auto-translate Toggle Banner
    ├── FeedCard (Virtualized with react-virtuoso)
    │   ├── Post Content (with TextShimmer during translation)
    │   └── Comment Section
    ├── HallOfFame (Lazy loaded)
    └── CommunityCountryStats (Lazy loaded)
```

### Data Flow
```
User Toggle Action
→ PATCH /api/community/settings { auto_translate: boolean }
→ State update in LeaderboardPage
→ useLazyTranslation hook triggered
→ POST /api/community/translate-batch { items[], targetLanguage }
→ Gemini API translation (with caching)
→ Update FeedCard with translated_content
→ Remove shimmer, display translated text
```

### Key Technical Constraints
1. **Server Components Limitation**: Cannot mock API calls server-side with page.route
2. **Solution**: Direct `/community` navigation avoids SSR, enables full client-side mocking
3. **Virtualization**: react-virtuoso only renders visible posts, affects test selectors
4. **Debouncing**: 300ms delay in `useLazyTranslation` batches translation requests
5. **Cache Strategy**: Translations cached by `content_id + content_type + target_language`

---

## Test Environment Setup

### Prerequisites
- Node.js 18+ installed
- Playwright installed: `npm install -D @playwright/test`
- Development server running: `npm run dev` on `http://localhost:3000`
- Mock data fixtures created in `tests/e2e/fixtures/community-mocks.ts`

### Test Configuration
```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'], channel: 'chrome' } },
  ],
});
```

### Mock Data Requirements

#### Essential Mocks for All Tests
```typescript
// Base mocks required for community page functionality
- GET /api/me → User authentication state
- GET /api/leaderboard → Leaderboard data (for page initialization)
- GET /api/community/settings → User translation preferences
- GET /api/community/posts → Post feed data
- GET /api/community/hall-of-fame?period=<today|weekly|monthly>
- GET /api/community/country-stats
- GET /api/community/notifications
- POST /api/community/translate-batch → Translation API
- PATCH /api/community/settings → Preference updates
```

#### Mock Community Posts Structure
```typescript
interface MockCommunityPost {
  id: string;
  author: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    current_level: number;
    country_code: string; // For language detection
  };
  content: string;
  original_language: string; // 'en', 'ko', 'ja', 'zh', 'es'
  translated_content?: string; // Populated by batch API
  is_translated: boolean;
  tab: 'vibes' | 'canu' | 'showcase' | 'questions';
  created_at: string;
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
  preview_comments: MockComment[];
}

// Sample multi-language posts
const mockPosts = [
  { id: 'p1', content: 'Claude Code is amazing!', original_language: 'en' },
  { id: 'p2', content: 'Claude Code 정말 대박이네요!', original_language: 'ko' },
  { id: 'p3', content: 'Claude Code すごく便利です!', original_language: 'ja' },
  { id: 'p4', content: 'Claude Code 太棒了！', original_language: 'zh' },
  { id: 'p5', content: '¡Claude Code es increíble!', original_language: 'es' },
];
```

---

## Test Scenarios

### Scenario 1: Basic Translation Flow (Happy Path)

**Objective**: Verify complete translation lifecycle from page load to display

**User Journey**:
1. Authenticated user with `auto_translate: true`, `preferred_language: 'en'`
2. Navigate to Community page
3. View posts in multiple languages
4. System automatically translates foreign posts to English
5. Shimmer effect displays during translation
6. Translated content appears after API response

**Test Steps**:
```typescript
test('Scenario 1: Basic translation flow', async ({ page }) => {
  // Setup: Mock authenticated user
  await page.route('**/api/me', async (route) => {
    await route.fulfill({
      json: {
        id: 'user-1',
        username: 'testuser',
        country_code: 'US',
        preferred_language: 'en',
      }
    });
  });

  // Mock: User settings with auto-translate ON
  await page.route('**/api/community/settings', async (route) => {
    await route.fulfill({
      json: {
        settings: { auto_translate: true },
        preferred_language: 'en',
      }
    });
  });

  // Mock: Posts with multiple languages
  const mockPosts = createMockCommunityPosts(10); // Contains en, ko, ja, zh, es
  await page.route('**/api/community/posts*', async (route) => {
    await route.fulfill({
      json: {
        posts: mockPosts,
        total: 10,
        hasMore: false,
        auto_translate_enabled: true,
        preferred_language: 'en',
      }
    });
  });

  // Mock: Translation API with delay to observe shimmer
  await page.route('**/api/community/translate-batch', async (route) => {
    const body = route.request().postDataJSON();

    // Simulate network latency
    await new Promise(resolve => setTimeout(resolve, 800));

    const translations = body.items.map((item: any) => ({
      id: item.id,
      type: item.type,
      translated_text: `[EN] ${item.text}`,
      from_cache: false,
    }));

    await route.fulfill({
      json: {
        translations,
        stats: { total: translations.length, from_cache: 0, translated: translations.length }
      }
    });
  });

  // Navigate directly to /community (avoids SSR issues)
  await page.goto('/community');

  // Wait for feed to load
  await page.waitForSelector('[data-feed-card]', { timeout: 10000 });

  // ASSERT 1: Auto-translate banner visible
  await expect(page.getByText('Auto-translate')).toBeVisible();

  // ASSERT 2: Toggle is ON (cyan background)
  const toggle = page.locator('button[role="switch"]');
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');

  // ASSERT 3: Loading indicator appears
  await expect(page.getByText('Translating...')).toBeVisible({ timeout: 3000 });

  // ASSERT 4: Shimmer effects on foreign posts
  const shimmerElements = page.locator('[aria-label="Loading translation..."]');
  await expect(shimmerElements.first()).toBeVisible({ timeout: 2000 });

  // ASSERT 5: Wait for translation to complete (800ms + buffer)
  await page.waitForTimeout(1500);

  // ASSERT 6: Shimmer effects disappear
  await expect(shimmerElements).toHaveCount(0, { timeout: 2000 });

  // ASSERT 7: Translated content visible
  await expect(page.getByText(/\[EN\]/)).toBeVisible({ timeout: 3000 });

  // ASSERT 8: Original English posts remain unchanged
  await expect(page.getByText('Claude Code is amazing!')).toBeVisible();

  // ASSERT 9: Loading indicator gone
  await expect(page.getByText('Translating...')).toHaveCount(0);
});
```

**Expected Results**:
- ✅ Auto-translate toggle visible and ON
- ✅ "Translating..." indicator shows during API call
- ✅ Shimmer effects display on foreign posts (Korean, Japanese, Chinese, Spanish)
- ✅ English posts show no shimmer (same language as preferred)
- ✅ Translated text displays after ~800ms
- ✅ Language indicator shows: `KO → EN`, `JA → EN`, etc.
- ✅ API call made: `POST /api/community/translate-batch` with correct items
- ✅ No console errors

**Success Criteria**:
- Translation completes within 2 seconds
- All foreign posts translated
- English posts unchanged
- No UI flicker or layout shift

---

### Scenario 2: Toggle OFF - Original Content Display

**Objective**: Verify toggle OFF stops translation and displays original content

**User Journey**:
1. User starts with auto-translate ON
2. Posts are being translated
3. User clicks toggle to turn OFF
4. System immediately stops translation
5. All posts display in original languages
6. Preference saved to database

**Test Steps**:
```typescript
test('Scenario 2: Toggle OFF shows original content', async ({ page }) => {
  let autoTranslateState = true;
  let patchCalled = false;

  // Setup base mocks
  await setupBaseMocks(page);

  // Mock: Settings with state tracking
  await page.route('**/api/community/settings', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        json: {
          settings: { auto_translate: autoTranslateState },
          preferred_language: 'en',
        }
      });
    } else if (route.request().method() === 'PATCH') {
      patchCalled = true;
      const body = route.request().postDataJSON();
      autoTranslateState = body.auto_translate;

      await route.fulfill({
        json: {
          settings: { auto_translate: autoTranslateState },
          preferred_language: 'en',
        }
      });
    }
  });

  // Mock: Posts
  const mockPosts = createMockCommunityPosts(10);
  await page.route('**/api/community/posts*', async (route) => {
    await route.fulfill({
      json: {
        posts: mockPosts,
        total: 10,
        hasMore: false,
        auto_translate_enabled: autoTranslateState,
        preferred_language: 'en',
      }
    });
  });

  // Track translation API calls
  const translationCalls: any[] = [];
  await page.route('**/api/community/translate-batch', async (route) => {
    translationCalls.push(Date.now());
    const body = route.request().postDataJSON();

    await route.fulfill({
      json: createMockTranslationResponse(body.items, 'en')
    });
  });

  await page.goto('/community');
  await page.waitForSelector('[data-feed-card]', { timeout: 10000 });

  // Wait for initial translation
  await page.waitForTimeout(1500);

  // ASSERT 1: Toggle is initially ON
  const toggle = page.locator('button[role="switch"]');
  await expect(toggle).toHaveAttribute('aria-checked', 'true');

  // ASSERT 2: Initial translation happened
  expect(translationCalls.length).toBeGreaterThanOrEqual(1);

  // ACTION: Click toggle to turn OFF
  await toggle.click();

  // ASSERT 3: PATCH request sent
  await page.waitForTimeout(500);
  expect(patchCalled).toBe(true);

  // ASSERT 4: Toggle state changed to OFF
  await expect(toggle).toHaveAttribute('aria-checked', 'false');

  // ASSERT 5: Banner text updated
  await expect(page.getByText('Showing original posts')).toBeVisible({ timeout: 3000 });

  // ASSERT 6: Auto-translate label color changed (muted gray)
  const banner = page.locator('text=Auto-translate').first();
  await expect(banner).toHaveClass(/text-\[var\(--color-text-muted\)\]/);

  // ASSERT 7: Original Korean content visible
  await expect(page.getByText('Claude Code 정말 대박이네요!')).toBeVisible({ timeout: 3000 });

  // ASSERT 8: Original Japanese content visible
  await expect(page.getByText('Claude Code すごく便利です!')).toBeVisible({ timeout: 3000 });

  // ASSERT 9: No new translation calls made
  const callsBeforeToggle = translationCalls.length;
  await page.waitForTimeout(2000);
  expect(translationCalls.length).toBe(callsBeforeToggle);

  // ASSERT 10: No shimmer effects
  await expect(page.locator('[aria-label="Loading translation..."]')).toHaveCount(0);
});
```

**Expected Results**:
- ✅ Toggle switches from cyan to gray
- ✅ Banner shows "Showing original posts"
- ✅ API call: `PATCH /api/community/settings` with `{ auto_translate: false }`
- ✅ All posts immediately show original content
- ✅ No translation API calls after toggle OFF
- ✅ No shimmer effects

**Success Criteria**:
- Toggle state persists (verified by PATCH success)
- Original content displays within 500ms
- No unnecessary API calls

---

### Scenario 3: Infinite Scroll - Lazy Translation

**Objective**: Verify new posts trigger translation when scrolled into view

**User Journey**:
1. User views initial 20 posts (translated)
2. User scrolls to bottom of feed
3. System loads next 20 posts
4. New posts show shimmer effect
5. Translation triggered for new batch
6. Previous translations remain intact (cached)

**Test Steps**:
```typescript
test('Scenario 3: Infinite scroll triggers lazy translation', async ({ page }) => {
  const allPosts = createMockCommunityPosts(50);
  const translationBatches: any[] = [];

  await setupBaseMocks(page);

  // Mock: Paginated posts
  await page.route('**/api/community/posts*', async (route) => {
    const url = new URL(route.request().url());
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const posts = allPosts.slice(offset, offset + limit);
    const hasMore = offset + limit < allPosts.length;

    await route.fulfill({
      json: {
        posts,
        total: allPosts.length,
        hasMore,
        auto_translate_enabled: true,
        preferred_language: 'en',
      }
    });
  });

  // Track translation batches
  await page.route('**/api/community/translate-batch', async (route) => {
    const body = route.request().postDataJSON();
    translationBatches.push({
      timestamp: Date.now(),
      itemCount: body.items.length,
      itemIds: body.items.map((i: any) => i.id),
    });

    await route.fulfill({
      json: createMockTranslationResponse(body.items, 'en')
    });
  });

  await page.goto('/community');
  await page.waitForSelector('[data-feed-card]', { timeout: 10000 });

  // Wait for initial load
  await page.waitForTimeout(1500);

  // ASSERT 1: Initial posts loaded (first 20)
  const initialCards = page.locator('[data-feed-card]');
  await expect(initialCards).toHaveCount(20, { timeout: 5000 });

  // ASSERT 2: Initial translation batch processed
  expect(translationBatches.length).toBeGreaterThanOrEqual(1);
  const firstBatchIds = translationBatches[0].itemIds;

  // ACTION: Scroll to bottom
  const feedContainer = page.locator('.scrollbar-hide').first();
  await feedContainer.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });

  // ASSERT 3: Loading indicator appears
  await expect(page.getByText('Loading more...')).toBeVisible({ timeout: 3000 });

  // Wait for new posts to load
  await page.waitForTimeout(2000);

  // ASSERT 4: More posts loaded (40 total)
  await expect(initialCards).toHaveCount(40, { timeout: 5000 });

  // ASSERT 5: Second translation batch processed
  expect(translationBatches.length).toBeGreaterThanOrEqual(2);
  const secondBatchIds = translationBatches[1].itemIds;

  // ASSERT 6: No duplicate translations (cache working)
  const overlap = firstBatchIds.filter((id: string) => secondBatchIds.includes(id));
  expect(overlap.length).toBe(0);

  // ASSERT 7: Shimmer effects on new posts (briefly)
  // Note: May have already resolved by this point

  // ASSERT 8: All posts now show translated content
  await page.waitForTimeout(1000);
  const translatedPosts = page.locator('text=/\\[EN\\]/');
  await expect(translatedPosts.first()).toBeVisible({ timeout: 3000 });
});
```

**Expected Results**:
- ✅ Initial 20 posts translated
- ✅ Scroll triggers `onLoadMore` callback
- ✅ API: `GET /api/community/posts?offset=20&limit=20`
- ✅ New posts display shimmer effect
- ✅ Second translation batch API call
- ✅ No duplicate translations (cache prevents re-translation of visible posts)
- ✅ Smooth scrolling (no layout shift)

**Success Criteria**:
- New batch translates within 2 seconds
- Previous translations remain visible
- No duplicate API calls for same posts

---

### Scenario 4: Page Refresh - State Persistence

**Objective**: Verify toggle state persists across page refreshes

**User Journey**:
1. User turns auto-translate OFF
2. User refreshes page (F5)
3. Page reloads
4. Auto-translate remains OFF
5. Settings loaded from database

**Test Steps**:
```typescript
test('Scenario 4: State persists across page refresh', async ({ page }) => {
  await setupBaseMocks(page);

  // Mock: Settings with auto_translate OFF (persisted state)
  await page.route('**/api/community/settings', async (route) => {
    await route.fulfill({
      json: {
        settings: { auto_translate: false },
        preferred_language: 'en',
      }
    });
  });

  const mockPosts = createMockCommunityPosts(10);
  await page.route('**/api/community/posts*', async (route) => {
    await route.fulfill({
      json: {
        posts: mockPosts,
        total: 10,
        hasMore: false,
        auto_translate_enabled: false,
        preferred_language: 'en',
      }
    });
  });

  // First visit
  await page.goto('/community');
  await page.waitForSelector('[data-feed-card]', { timeout: 10000 });

  // ASSERT 1: Toggle is OFF
  await expect(page.getByText('Showing original posts')).toBeVisible({ timeout: 5000 });
  const toggle = page.locator('button[role="switch"]');
  await expect(toggle).toHaveAttribute('aria-checked', 'false');

  // ASSERT 2: Original content displayed
  await expect(page.getByText('Claude Code 정말 대박이네요!')).toBeVisible();

  // ACTION: Refresh page
  await page.reload();

  // Wait for page to reload fully
  await page.waitForSelector('[data-feed-card]', { timeout: 10000 });

  // ASSERT 3: Toggle remains OFF after refresh
  await expect(page.getByText('Showing original posts')).toBeVisible({ timeout: 5000 });
  await expect(toggle).toHaveAttribute('aria-checked', 'false');

  // ASSERT 4: Original content still displayed
  await expect(page.getByText('Claude Code 정말 대박이네요!')).toBeVisible();

  // ASSERT 5: Settings API was called on reload
  const settingsRequest = await page.waitForRequest(
    request => request.url().includes('/api/community/settings') && request.method() === 'GET'
  );
  expect(settingsRequest).toBeTruthy();
});
```

**Expected Results**:
- ✅ Toggle state OFF persists after refresh
- ✅ Original content remains displayed
- ✅ Settings API called on page load
- ✅ No translation API calls

**Success Criteria**:
- Settings loaded from database within 1 second
- User preference honored

---

### Scenario 5: Translation Cache Behavior

**Objective**: Verify translations are cached and reused to minimize API costs

**User Journey**:
1. User views posts (translations fetched)
2. User toggles OFF then ON
3. Same posts re-appear
4. System serves translations from cache
5. API call made but with high cache hit rate

**Test Steps**:
```typescript
test('Scenario 5: Translation cache minimizes API calls', async ({ page }) => {
  const translationCache = new Map<string, string>();
  let apiCallCount = 0;

  await setupBaseMocks(page);

  // Mock: Translation API with cache simulation
  await page.route('**/api/community/translate-batch', async (route) => {
    apiCallCount++;
    const body = route.request().postDataJSON();
    const items = body.items;

    const results = items.map((item: any) => {
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

    const fromCacheCount = results.filter((r: any) => r.from_cache).length;

    await route.fulfill({
      json: {
        translations: results,
        stats: {
          total: items.length,
          from_cache: fromCacheCount,
          translated: items.length - fromCacheCount,
        },
      }
    });
  });

  await page.goto('/community');
  await page.waitForSelector('[data-feed-card]', { timeout: 10000 });
  await page.waitForTimeout(1500);

  // ASSERT 1: Initial API call made
  expect(apiCallCount).toBe(1);

  // ASSERT 2: Cache populated
  expect(translationCache.size).toBeGreaterThan(0);
  const initialCacheSize = translationCache.size;

  // ACTION: Toggle OFF then ON
  const toggle = page.locator('button[role="switch"]');
  await toggle.click();
  await page.waitForTimeout(500);
  await toggle.click();
  await page.waitForTimeout(1500);

  // ASSERT 3: Second API call made
  expect(apiCallCount).toBe(2);

  // ASSERT 4: Cache hit rate is high (all or most items from cache)
  // Note: In real implementation, check response stats.from_cache
  expect(translationCache.size).toBe(initialCacheSize); // No new translations needed

  // ASSERT 5: Translated content visible (from cache)
  await expect(page.getByText(/\[Translated\]/)).toBeVisible({ timeout: 3000 });
});
```

**Expected Results**:
- ✅ First load: All translations fetched fresh (`from_cache: 0`)
- ✅ Second load: All translations served from cache (`from_cache: 10`)
- ✅ API call count increases but no new Gemini API calls
- ✅ Performance improved (faster display)

**Success Criteria**:
- Cache hit rate > 90% on second load
- Response time < 500ms for cached translations

---

### Scenario 6: Error Handling - Translation API Failure

**Objective**: Verify graceful degradation when translation API fails

**User Journey**:
1. User loads community page
2. Translation API returns 500 error
3. System falls back to original content
4. No error modal blocks UI
5. User can still read posts

**Test Steps**:
```typescript
test('Scenario 6: Graceful error handling on API failure', async ({ page }) => {
  let shouldFail = true;

  await setupBaseMocks(page);

  // Mock: Translation API to fail initially
  await page.route('**/api/community/translate-batch', async (route) => {
    if (shouldFail) {
      await route.fulfill({
        status: 500,
        json: {
          error: 'Translation failed',
          details: 'Gemini API unavailable',
        },
      });
    } else {
      const body = route.request().postDataJSON();
      await route.fulfill({
        json: createMockTranslationResponse(body.items, 'en')
      });
    }
  });

  await page.goto('/community');
  await page.waitForSelector('[data-feed-card]', { timeout: 10000 });

  // ASSERT 1: Loading indicator appears
  await expect(page.getByText('Translating...')).toBeVisible({ timeout: 3000 });

  // Wait for error handling
  await page.waitForTimeout(3000);

  // ASSERT 2: Loading indicator disappears
  await expect(page.getByText('Translating...')).toHaveCount(0, { timeout: 3000 });

  // ASSERT 3: Original content displayed (fallback)
  await expect(page.getByText('Claude Code 정말 대박이네요!')).toBeVisible({ timeout: 3000 });

  // ASSERT 4: No error modal blocking UI
  await expect(page.locator('[role="alert"][aria-live="assertive"]')).toHaveCount(0);

  // ASSERT 5: User can still interact with posts
  const likeButton = page.locator('[data-feed-card]').first().locator('button').first();
  await expect(likeButton).toBeEnabled();

  // ACTION: Resolve error and retry
  shouldFail = false;

  // Toggle OFF and ON to trigger retry
  const toggle = page.locator('button[role="switch"]');
  await toggle.click();
  await page.waitForTimeout(500);
  await toggle.click();
  await page.waitForTimeout(1500);

  // ASSERT 6: Translation succeeds after recovery
  await expect(page.getByText(/\[Translated\]/)).toBeVisible({ timeout: 3000 });
});
```

**Expected Results**:
- ✅ Shimmer effects timeout (no indefinite loading)
- ✅ Original content displayed as fallback
- ✅ No error toast or modal
- ✅ Error logged to console (for debugging)
- ✅ UI remains functional

**Success Criteria**:
- Fallback within 3 seconds
- No UI freeze or crash
- User can read posts in original languages

---

### Scenario 7: Guest User - Toggle Not Visible

**Objective**: Verify non-authenticated users cannot access toggle

**User Journey**:
1. Guest user navigates to Community
2. Posts display in original languages
3. No toggle visible
4. Banner shows informational text only

**Test Steps**:
```typescript
test('Scenario 7: Guest users cannot see toggle', async ({ page }) => {
  // Setup base mocks without auth
  await setupBaseMocks(page);

  // Mock: Unauthorized user
  await page.route('**/api/me', async (route) => {
    await route.fulfill({
      status: 401,
      json: { error: 'Unauthorized' }
    });
  });

  // Mock: Unauthorized settings
  await page.route('**/api/community/settings', async (route) => {
    await route.fulfill({
      status: 401,
      json: { error: 'Unauthorized' }
    });
  });

  const mockPosts = createMockCommunityPosts(10);
  await page.route('**/api/community/posts*', async (route) => {
    await route.fulfill({
      json: {
        posts: mockPosts,
        total: 10,
        hasMore: false,
        auto_translate_enabled: false, // Guest cannot translate
        preferred_language: null,
      }
    });
  });

  await page.goto('/community');
  await page.waitForSelector('[data-feed-card]', { timeout: 10000 });

  // ASSERT 1: Banner visible
  await expect(page.getByText('Auto-translate')).toBeVisible();

  // ASSERT 2: Toggle NOT visible
  const toggle = page.locator('button[role="switch"]');
  await expect(toggle).toHaveCount(0);

  // ASSERT 3: Informational text visible
  await expect(page.getByText('Connect with Claude Code developers worldwide')).toBeVisible();

  // ASSERT 4: Posts display in original languages
  await expect(page.getByText('Claude Code 정말 대박이네요!')).toBeVisible();

  // ASSERT 5: No shimmer effects
  await expect(page.locator('[aria-label="Loading translation..."]')).toHaveCount(0);

  // ASSERT 6: No translation API calls
  const requests: any[] = [];
  page.on('request', request => {
    if (request.url().includes('/api/community/translate-batch')) {
      requests.push(request);
    }
  });
  await page.waitForTimeout(2000);
  expect(requests.length).toBe(0);
});
```

**Expected Results**:
- ✅ Toggle not rendered
- ✅ Banner shows info text only
- ✅ Posts in original languages
- ✅ No translation API calls
- ✅ No shimmer effects

**Success Criteria**:
- Guest can read posts without translation
- No errors in console

---

### Scenario 8: Mobile Responsiveness

**Objective**: Verify auto-translate toggle works on mobile viewports

**User Journey**:
1. User accesses Community on mobile device
2. Toggle renders at touch-friendly size
3. User taps toggle
4. State changes correctly
5. No horizontal scrolling issues

**Test Steps**:
```typescript
test('Scenario 8: Mobile viewport toggle accessibility', async ({ page }) => {
  // Set mobile viewport (iPhone SE)
  await page.setViewportSize({ width: 375, height: 667 });

  await setupBaseMocks(page);

  await page.goto('/community');
  await page.waitForSelector('[data-feed-card]', { timeout: 10000 });

  // ASSERT 1: Toggle visible
  const toggle = page.locator('button[role="switch"]');
  await expect(toggle).toBeVisible({ timeout: 5000 });

  // ASSERT 2: Toggle meets touch target size (min 44x44px)
  const toggleBox = await toggle.boundingBox();
  expect(toggleBox).toBeTruthy();
  expect(toggleBox!.width).toBeGreaterThanOrEqual(36); // w-9 = 36px
  expect(toggleBox!.height).toBeGreaterThanOrEqual(20); // h-5 = 20px

  // ASSERT 3: Banner text wraps correctly
  const bannerText = page.locator('text=Auto-translate').first();
  const bannerBox = await bannerText.boundingBox();
  expect(bannerBox!.width).toBeLessThanOrEqual(375); // No overflow

  // ACTION: Tap toggle
  await toggle.tap();

  // ASSERT 4: State changes
  await expect(page.getByText('Showing original posts')).toBeVisible({ timeout: 3000 });

  // ASSERT 5: No horizontal scroll
  const horizontalScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(horizontalScroll).toBe(false);

  // ASSERT 6: Feed cards are responsive
  const feedCard = page.locator('[data-feed-card]').first();
  const cardBox = await feedCard.boundingBox();
  expect(cardBox!.width).toBeLessThanOrEqual(375);

  // ASSERT 7: Shimmer effects scale correctly
  await toggle.tap(); // Turn back ON
  await page.waitForTimeout(500);
  const shimmer = page.locator('[aria-label="Loading translation..."]').first();
  if (await shimmer.isVisible()) {
    const shimmerBox = await shimmer.boundingBox();
    expect(shimmerBox!.width).toBeLessThanOrEqual(375);
  }
});
```

**Expected Results**:
- ✅ Toggle renders at appropriate size (36x20px minimum)
- ✅ Text wraps correctly on narrow screens
- ✅ No horizontal scrolling
- ✅ Touch targets meet accessibility guidelines (44x44px recommended)
- ✅ Shimmer effects scale properly

**Success Criteria**:
- WCAG touch target size met
- No layout issues on mobile
- Smooth tap interactions

---

## Advanced Scenarios

### Scenario 9: Comment Translation (Future Feature)

**Objective**: Verify comments are translated alongside posts

**Note**: Currently not implemented. Placeholder for future testing.

**Steps**:
1. Load post with comments
2. Verify comments have `original_language` field
3. Batch translation includes comment IDs
4. Translated comments display correctly
5. Reply threads maintain translation

---

### Scenario 10: Real-Time Translation Updates

**Objective**: Verify new posts arriving via updates are translated

**Note**: Requires WebSocket or polling implementation.

**Steps**:
1. User viewing feed with auto-translate ON
2. New post arrives (simulated via mock update)
3. Post appears with shimmer effect
4. Translation triggered automatically
5. Translated post appears in feed

---

## Integration Testing

### Test Suite: End-to-End User Flow

**Objective**: Simulate complete user session with multiple interactions

```typescript
test('E2E: Complete user session with translation', async ({ page }) => {
  await setupBaseMocks(page);

  // 1. Navigate to Community
  await page.goto('/community');
  await page.waitForSelector('[data-feed-card]', { timeout: 10000 });
  await page.waitForTimeout(1500);

  // 2. Verify initial translation
  await expect(page.getByText(/\[EN\]/)).toBeVisible({ timeout: 5000 });

  // 3. Toggle OFF
  const toggle = page.locator('button[role="switch"]');
  await toggle.click();
  await page.waitForTimeout(500);
  await expect(page.getByText('Showing original posts')).toBeVisible();

  // 4. Scroll to load more posts
  const feedContainer = page.locator('.scrollbar-hide').first();
  await feedContainer.evaluate((el) => el.scrollTop = el.scrollHeight);
  await page.waitForTimeout(2000);

  // 5. Toggle ON
  await toggle.click();
  await page.waitForTimeout(1500);

  // 6. Verify translation of newly loaded posts
  const translatedPosts = page.locator('text=/\\[EN\\]/');
  await expect(translatedPosts).toHaveCount(20, { timeout: 5000 });

  // 7. Refresh page
  await page.reload();
  await page.waitForSelector('[data-feed-card]', { timeout: 10000 });

  // 8. Verify state persisted (toggle ON)
  await expect(toggle).toHaveAttribute('aria-checked', 'true');

  // 9. Interact with translated post (like)
  const likeButton = page.locator('[data-feed-card]').first().locator('button[aria-label*="Like"]');
  await likeButton.click();

  // 10. Verify like count updated
  await expect(page.locator('[data-feed-card]').first()).toContainText(/\d+/);
});
```

---

## Performance Benchmarks

### Target Metrics
| Operation | Target Time | Measurement |
|-----------|-------------|-------------|
| Initial page load | < 2s | Time to Interactive (TTI) |
| Translation batch (20 items) | < 1.5s | API response time |
| Toggle state change | < 300ms | UI update delay |
| Infinite scroll load | < 1s | New posts visible |
| Cache hit response | < 500ms | Cached translation display |

### Monitoring
```typescript
test('Performance: Translation speed', async ({ page }) => {
  await setupBaseMocks(page);

  const startTime = Date.now();

  await page.goto('/community');
  await page.waitForSelector('[data-feed-card]', { timeout: 10000 });

  const loadTime = Date.now() - startTime;

  // ASSERT: Page loads within 2 seconds
  expect(loadTime).toBeLessThan(2000);

  // Track translation time
  const translationStart = Date.now();
  await expect(page.getByText(/\[EN\]/)).toBeVisible({ timeout: 5000 });
  const translationTime = Date.now() - translationStart;

  // ASSERT: Translation completes within 1.5 seconds
  expect(translationTime).toBeLessThan(1500);

  console.log(`Load time: ${loadTime}ms, Translation time: ${translationTime}ms`);
});
```

---

## Accessibility Testing

### WCAG Compliance Checks

```typescript
test('Accessibility: Toggle and banner', async ({ page }) => {
  await setupBaseMocks(page);
  await page.goto('/community');
  await page.waitForSelector('[data-feed-card]', { timeout: 10000 });

  // ASSERT 1: Toggle has ARIA label
  const toggle = page.locator('button[role="switch"]');
  const ariaLabel = await toggle.getAttribute('aria-label');
  expect(ariaLabel).toBeTruthy();
  expect(ariaLabel).toMatch(/auto-translate/i);

  // ASSERT 2: Toggle has aria-checked state
  const ariaChecked = await toggle.getAttribute('aria-checked');
  expect(['true', 'false']).toContain(ariaChecked!);

  // ASSERT 3: Keyboard navigation works
  await toggle.focus();
  await page.keyboard.press('Space');
  await page.waitForTimeout(500);

  // Toggle should change state
  const newAriaChecked = await toggle.getAttribute('aria-checked');
  expect(newAriaChecked).not.toBe(ariaChecked);

  // ASSERT 4: Loading states announced to screen readers
  // Note: Check for aria-live regions
  const liveRegion = page.locator('[aria-live]');
  if (await liveRegion.isVisible()) {
    expect(await liveRegion.getAttribute('aria-live')).toBe('polite');
  }

  // ASSERT 5: Color contrast meets WCAG AA
  // Note: Manual verification required or use axe-core
});
```

---

## Error Recovery Scenarios

### Network Timeout
```typescript
test('Error Recovery: Network timeout', async ({ page }) => {
  await setupBaseMocks(page);

  // Mock: Delay translation API beyond timeout
  await page.route('**/api/community/translate-batch', async (route) => {
    await new Promise(resolve => setTimeout(resolve, 10000)); // 10s delay
    await route.fulfill({ json: createMockTranslationResponse([], 'en') });
  });

  await page.goto('/community');
  await page.waitForSelector('[data-feed-card]', { timeout: 10000 });

  // ASSERT: Original content displayed after timeout
  await expect(page.getByText('Claude Code 정말 대박이네요!')).toBeVisible({ timeout: 15000 });
});
```

### Partial Translation Failure
```typescript
test('Error Recovery: Partial translation failure', async ({ page }) => {
  await setupBaseMocks(page);

  // Mock: Return partial translations (some items fail)
  await page.route('**/api/community/translate-batch', async (route) => {
    const body = route.request().postDataJSON();
    const translations = body.items.slice(0, Math.floor(body.items.length / 2)).map((item: any) => ({
      id: item.id,
      type: item.type,
      translated_text: `[EN] ${item.text}`,
      from_cache: false,
    }));

    await route.fulfill({
      json: {
        translations,
        stats: { total: body.items.length, from_cache: 0, translated: translations.length }
      }
    });
  });

  await page.goto('/community');
  await page.waitForSelector('[data-feed-card]', { timeout: 10000 });
  await page.waitForTimeout(2000);

  // ASSERT: Translated posts show translation
  await expect(page.getByText(/\[EN\]/)).toBeVisible();

  // ASSERT: Untranslated posts show original content
  await expect(page.getByText('Claude Code 정말 대박이네요!')).toBeVisible();
});
```

---

## Test Execution Strategy

### Running Tests

```bash
# Run all translation tests
npx playwright test tests/e2e/community-translation.spec.ts

# Run specific scenario
npx playwright test tests/e2e/community-translation.spec.ts -g "Scenario 1"

# Run with UI mode for debugging
npx playwright test tests/e2e/community-translation.spec.ts --ui

# Run on mobile viewport only
npx playwright test tests/e2e/community-translation.spec.ts --project=mobile-chrome

# Generate HTML report
npx playwright test tests/e2e/community-translation.spec.ts --reporter=html
```

### Debugging Failed Tests

```bash
# Run with headed browser
npx playwright test tests/e2e/community-translation.spec.ts --headed

# Enable debug mode
PWDEBUG=1 npx playwright test tests/e2e/community-translation.spec.ts

# Record trace for failed test
npx playwright test tests/e2e/community-translation.spec.ts --trace on

# View trace
npx playwright show-trace trace.zip
```

---

## Test Maintenance

### Mock Data Updates

When community features change:
1. Update `tests/e2e/fixtures/community-mocks.ts`
2. Add new fields to mock types
3. Update `createMockCommunityPosts()` function
4. Regenerate mock responses

### API Schema Changes

When APIs change:
1. Update route mocks in `setupBaseMocks()`
2. Update type definitions in test files
3. Verify response structure matches new schema
4. Update assertions to match new fields

---

## Success Criteria Summary

### All Scenarios Must Pass
- ✅ Basic translation flow (Scenario 1)
- ✅ Toggle OFF shows original content (Scenario 2)
- ✅ Infinite scroll triggers lazy translation (Scenario 3)
- ✅ State persists across refreshes (Scenario 4)
- ✅ Translation cache minimizes API calls (Scenario 5)
- ✅ Graceful error handling on API failure (Scenario 6)
- ✅ Guest users cannot see toggle (Scenario 7)
- ✅ Mobile viewport fully functional (Scenario 8)

### Quality Gates
- Test coverage > 90% for translation logic
- No console errors during normal operation
- All API responses match schema definitions
- Accessibility score > 90 (Lighthouse)
- Performance benchmarks met
- No memory leaks in long scrolling sessions

---

## Appendix: Technical Notes

### Playwright API Route Mocking Limitations

**Issue**: Next.js Server Components render on server-side, Playwright's `page.route()` only intercepts client-side fetch/XHR requests.

**Solution**:
- Navigate directly to `/community` (client-side route)
- Avoid server-side rendering paths like navigating from `/leaderboard` on first load
- Mock all required APIs before navigation

### React Virtualization Considerations

**Issue**: `react-virtuoso` only renders visible posts, test selectors may not find off-screen posts.

**Solution**:
- Use `page.locator('[data-feed-card]')` for visible posts
- Scroll before asserting on later posts
- Count visible posts, not total posts

### Debouncing Effects

**Issue**: `useLazyTranslation` debounces requests by 300ms, tests must account for delay.

**Solution**:
- Add `await page.waitForTimeout(500)` after actions that trigger translation
- Expect shimmer effects to appear, then wait for resolution
- Use `timeout` in `expect()` assertions (e.g., `{ timeout: 5000 }`)

---

**Document Version**: 2.0
**Last Updated**: 2026-01-30
**Author**: Claude Code QA Team
**Review Status**: Enhanced for Production Testing
