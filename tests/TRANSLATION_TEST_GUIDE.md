# Community Auto-Translation Testing Guide

Quick reference guide for testing the CCgather Community auto-translation feature.

## Test Files Location

```
tests/e2e/
├── community-translation.spec.ts              # Existing tests (10 scenarios)
├── community-translation-enhanced.plan.md     # NEW: Comprehensive test plan
├── community-stats.spec.ts                    # Hall of Fame & Country Stats
└── fixtures/
    └── community-mocks.ts                     # Mock data generators
```

## Quick Start

### Run All Translation Tests
```bash
# All translation scenarios
npx playwright test tests/e2e/community-translation.spec.ts

# With UI for debugging
npx playwright test tests/e2e/community-translation.spec.ts --ui

# Specific scenario
npx playwright test -g "Scenario 1"
```

### Run on Mobile
```bash
npx playwright test tests/e2e/community-translation.spec.ts --project=mobile-chrome
```

## Test Coverage Summary

### Implemented Tests (community-translation.spec.ts)
✅ **Scenario 1**: Guest user - toggle not visible
✅ **Scenario 2**: Signed-in user - shimmer effect during translation
✅ **Scenario 3**: Toggle OFF - original text display
✅ **Scenario 4**: Infinite scroll - lazy translation
✅ **Scenario 5**: Page refresh - state persistence
✅ **Scenario 8**: Translation cache behavior
✅ **Scenario 9**: Error handling - translation failure
✅ **Scenario 10**: Mobile responsiveness

### Additional Tests (community-stats.spec.ts)
✅ **Scenario 6**: Hall of Fame - period filtering
✅ **Scenario 7**: Top Countries - stats aggregation

## Key Features Being Tested

### 1. Auto-Translate Toggle
- **Location**: Banner at top of Community feed
- **Behavior**: ON (cyan) = translate, OFF (gray) = show original
- **Persistence**: Saved to `user_notification_settings.auto_translate`

### 2. Translation Flow
```
User loads Community
→ useLazyTranslation hook checks preferred_language
→ Batch translation request (300ms debounce)
→ POST /api/community/translate-batch
→ Shimmer effect during loading
→ Translated content displays
→ Cache saved to translations table
```

### 3. Shimmer Loading State
- **Component**: `<TextShimmer>` from `@/components/ui/TextShimmer`
- **Trigger**: Foreign language post + auto_translate ON + translation pending
- **Duration**: ~800ms (API latency)
- **Selector**: `[aria-label="Loading translation..."]`

### 4. Translation Cache
- **Key**: `content_id + content_type + target_language`
- **Table**: `translations` (Supabase)
- **Behavior**: Cache hit returns existing translation, cache miss calls Gemini API

## API Endpoints Tested

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/community/settings` | GET | Load user preferences |
| `/api/community/settings` | PATCH | Save toggle state |
| `/api/community/posts` | GET | Load post feed (with auto_translate flag) |
| `/api/community/translate-batch` | POST | Batch translate posts/comments |
| `/api/community/hall-of-fame` | GET | Hall of Fame stats |
| `/api/community/country-stats` | GET | Country rankings |

## Mock Data Structure

### Posts with Multiple Languages
```typescript
const mockPosts = [
  { id: 'p1', content: 'Claude Code is amazing!', original_language: 'en' },
  { id: 'p2', content: 'Claude Code 정말 대박이네요!', original_language: 'ko' },
  { id: 'p3', content: 'Claude Code すごく便利です!', original_language: 'ja' },
  { id: 'p4', content: 'Claude Code 太棒了！', original_language: 'zh' },
  { id: 'p5', content: '¡Claude Code es increíble!', original_language: 'es' },
];
```

### Translation Response
```typescript
{
  translations: [
    {
      id: 'p2',
      type: 'post',
      translated_text: '[EN] Claude Code is really awesome!',
      from_cache: false
    }
  ],
  stats: {
    total: 5,
    from_cache: 2,
    translated: 3
  }
}
```

## Common Test Patterns

### Pattern 1: Wait for Translation Complete
```typescript
// Shimmer appears
await expect(page.locator('[aria-label="Loading translation..."]').first()).toBeVisible();

// Wait for translation
await page.waitForTimeout(1500);

// Shimmer disappears
await expect(page.locator('[aria-label="Loading translation..."]')).toHaveCount(0);

// Translated content visible
await expect(page.getByText(/\[EN\]/)).toBeVisible();
```

### Pattern 2: Toggle State Change
```typescript
const toggle = page.locator('button[role="switch"]');

// Click toggle
await toggle.click();

// Wait for API call
await page.waitForTimeout(500);

// Verify state
await expect(toggle).toHaveAttribute('aria-checked', 'false');
await expect(page.getByText('Showing original posts')).toBeVisible();
```

### Pattern 3: Infinite Scroll
```typescript
// Scroll to bottom
const feedContainer = page.locator('.scrollbar-hide').first();
await feedContainer.evaluate((el) => el.scrollTop = el.scrollHeight);

// Wait for loading indicator
await expect(page.getByText('Loading more...')).toBeVisible();

// Wait for new posts
await page.waitForTimeout(2000);

// Verify count increased
await expect(page.locator('[data-feed-card]')).toHaveCount(40);
```

## Debugging Tips

### 1. View Test in Browser
```bash
npx playwright test --headed --project=chromium
```

### 2. Enable Debug Mode
```bash
PWDEBUG=1 npx playwright test tests/e2e/community-translation.spec.ts
```

### 3. Take Screenshots on Failure
```typescript
test('my test', async ({ page }) => {
  try {
    // test steps
  } catch (error) {
    await page.screenshot({ path: 'failure.png', fullPage: true });
    throw error;
  }
});
```

### 4. Check Network Requests
```typescript
page.on('request', request => {
  if (request.url().includes('/api/community/')) {
    console.log('API call:', request.method(), request.url());
  }
});
```

### 5. View Mock Data Logs
```typescript
await page.route('**/api/community/translate-batch', async (route) => {
  const body = route.request().postDataJSON();
  console.log('Translation request:', body.items.length, 'items');

  await route.fulfill({ json: mockResponse });
});
```

## Expected Test Results

### All Tests Passing
```
✅ Scenario 1: Guest user - toggle not visible (5.2s)
✅ Scenario 2: Shimmer effect during translation (8.1s)
✅ Scenario 3: Toggle OFF shows original content (6.3s)
✅ Scenario 4: Infinite scroll lazy translation (9.5s)
✅ Scenario 5: State persists across refresh (7.8s)
✅ Scenario 6: Hall of Fame period filtering (5.6s)
✅ Scenario 7: Top Countries stats (4.9s)
✅ Scenario 8: Translation cache behavior (8.7s)
✅ Scenario 9: Error handling graceful (6.4s)
✅ Scenario 10: Mobile responsiveness (5.1s)

10 passed (1.2m)
```

## Common Failures & Solutions

### Issue 1: Timeout waiting for feed card
```
Error: page.waitForSelector: Timeout 10000ms exceeded
  locator: [data-feed-card]
```
**Solution**: Increase timeout or check if mocks are properly set up
```typescript
await page.waitForSelector('[data-feed-card]', { timeout: 15000 });
```

### Issue 2: Shimmer never appears
```
Expected locator [aria-label="Loading translation..."] to be visible
```
**Solution**: Check if posts have foreign languages and auto_translate is ON
```typescript
// Verify mock has non-English posts
const mockPosts = createMockCommunityPosts(10);
const foreignPosts = mockPosts.filter(p => p.original_language !== 'en');
expect(foreignPosts.length).toBeGreaterThan(0);
```

### Issue 3: Toggle not clickable
```
Error: element is not visible
```
**Solution**: Ensure user is authenticated in mock
```typescript
await page.route('**/api/me', async (route) => {
  await route.fulfill({
    json: { id: 'user-1', username: 'testuser' }
  });
});
```

## Performance Benchmarks

| Metric | Target | Typical |
|--------|--------|---------|
| Page load | < 2s | ~1.5s |
| Translation batch | < 1.5s | ~800ms |
| Toggle response | < 300ms | ~150ms |
| Infinite scroll | < 1s | ~700ms |

## Next Steps

### 1. Review Enhanced Test Plan
Read `tests/e2e/community-translation-enhanced.plan.md` for:
- Detailed scenario descriptions
- Step-by-step test procedures
- Expected results for each test
- Edge case coverage

### 2. Run Existing Tests
```bash
# Quick validation
npx playwright test tests/e2e/community-translation.spec.ts --project=chromium

# Full suite (desktop + mobile)
npx playwright test tests/e2e/community-translation.spec.ts
```

### 3. Implement New Scenarios
Refer to enhanced plan for:
- Advanced error recovery tests
- Performance monitoring tests
- Accessibility compliance tests

### 4. Generate Test Report
```bash
npx playwright test tests/e2e/community-translation.spec.ts --reporter=html
npx playwright show-report
```

## Resources

- **Test Plan**: `tests/e2e/community-translation-enhanced.plan.md`
- **Mock Fixtures**: `tests/e2e/fixtures/community-mocks.ts`
- **Component Source**: `components/community/CommunityFeedSection.tsx`
- **Hook Source**: `hooks/useLazyTranslation.ts`
- **API Source**: `app/api/community/translate-batch/route.ts`

## Support

If tests fail:
1. Check console logs in browser devtools
2. Review mock data structure
3. Verify API routes are mocked before navigation
4. Use `--headed` mode to see visual behavior
5. Add `console.log()` in mocks to trace requests

---

**Quick Reference Card**:
- Run tests: `npx playwright test tests/e2e/community-translation.spec.ts`
- Debug mode: `PWDEBUG=1 npx playwright test`
- UI mode: `npx playwright test --ui`
- Mobile only: `npx playwright test --project=mobile-chrome`
- Generate report: `npx playwright test --reporter=html`
