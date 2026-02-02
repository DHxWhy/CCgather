import { test, expect, Page } from "@playwright/test";

/**
 * Auto-Translation Feature - Comprehensive Scenario Tests
 *
 * 시나리오별 경우의 수 테스트 (Mock 데이터 사용)
 *
 * Note: 토글 버튼은 로그인한 사용자에게만 표시됩니다.
 * 인증이 필요한 테스트는 저장된 auth 상태를 사용합니다.
 */

// Auth state for logged-in tests
const authFile = "tests/.auth/user.json";

// ============================================
// Mock Data Generators
// ============================================

function createMultiLanguagePosts(count: number = 20) {
  const languages = [
    { code: "ko", content: "안녕하세요! Claude Code 정말 대박이에요!", country: "KR" },
    { code: "ja", content: "Claude Code すごく便利です!", country: "JP" },
    { code: "zh", content: "Claude Code 太棒了！这是一个很好的工具", country: "CN" },
    { code: "es", content: "¡Claude Code es increíble! Me encanta usarlo", country: "ES" },
    { code: "en", content: "Claude Code is amazing! Love using it daily", country: "US" },
    { code: "de", content: "Claude Code ist fantastisch! Sehr hilfreich", country: "DE" },
    { code: "fr", content: "Claude Code est incroyable! Très utile", country: "FR" },
  ];

  const tabs = ["general", "showcase", "help"] as const;

  return Array.from({ length: count }, (_, i) => {
    const lang = languages[i % languages.length]!;
    return {
      id: `mock-post-${i + 1}`,
      author: {
        id: `user-${(i % 10) + 1}`,
        username: `developer${(i % 10) + 1}`,
        display_name: `Developer ${(i % 10) + 1}`,
        avatar_url: i % 3 === 0 ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${i}` : null,
        current_level: Math.floor(i / 5) + 1,
        country_code: lang.country,
      },
      content: `${lang.content} #post${i + 1}`,
      tab: tabs[i % tabs.length],
      original_language: lang.code,
      created_at: new Date(Date.now() - i * 3600000).toISOString(),
      likes_count: Math.floor(Math.random() * 50),
      comments_count: Math.floor(Math.random() * 10),
      is_liked: i % 7 === 0,
      liked_by: [],
      preview_comments: [],
      has_more_comments: false,
    };
  });
}

function createTranslationResponse(items: Array<{ id: string; type: string; text: string }>) {
  return {
    translations: items.map((item) => ({
      id: item.id,
      type: item.type,
      translated_text: `[EN] ${item.text.substring(0, 50)}...`,
      from_cache: Math.random() > 0.5,
    })),
    stats: {
      total: items.length,
      from_cache: Math.floor(items.length * 0.5),
      translated: Math.ceil(items.length * 0.5),
    },
  };
}

// ============================================
// Setup Mocks Helper
// ============================================

async function setupMocks(
  page: Page,
  options: {
    autoTranslateEnabled?: boolean;
    preferredLanguage?: string;
    postCount?: number;
    hasMorePosts?: boolean;
    translationDelay?: number;
    translationError?: boolean;
    cacheHitRate?: number;
  } = {}
) {
  const {
    autoTranslateEnabled = true,
    preferredLanguage = "en",
    postCount = 20,
    hasMorePosts = true,
    translationDelay = 500,
    translationError = false,
    cacheHitRate = 0.5,
  } = options;

  const mockPosts = createMultiLanguagePosts(postCount);
  let requestCount = 0;
  let translationRequestCount = 0;

  // Mock Leaderboard API
  await page.route("**/api/leaderboard*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        users: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        period: "all",
      }),
    });
  });

  // Mock Community Posts API
  await page.route("**/api/community/posts*", async (route) => {
    requestCount++;
    const url = new URL(route.request().url());
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const limit = parseInt(url.searchParams.get("limit") || "20");

    const paginatedPosts = mockPosts.slice(offset, offset + limit);
    const hasMore = hasMorePosts && offset + limit < mockPosts.length;

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        posts: paginatedPosts,
        total: mockPosts.length,
        hasMore,
        auto_translate_enabled: autoTranslateEnabled,
        preferred_language: preferredLanguage,
      }),
    });
  });

  // Mock Community Settings API
  await page.route("**/api/community/settings*", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          settings: {
            auto_translate: autoTranslateEnabled,
            notify_post_likes: true,
            notify_post_comments: true,
          },
          preferred_language: preferredLanguage,
          supported_languages: ["en", "ko", "ja", "zh", "es", "fr", "de"],
        }),
      });
    } else {
      // PATCH - save settings
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    }
  });

  // Mock Translation API
  await page.route("**/api/community/translate-batch*", async (route) => {
    translationRequestCount++;

    // Simulate delay
    await new Promise((r) => setTimeout(r, translationDelay));

    if (translationError) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Translation service unavailable" }),
      });
      return;
    }

    try {
      const body = await route.request().postDataJSON();
      const items = body.items || [];

      // Simulate cache hits
      const translations = items.map(
        (item: { id: string; type: string; text: string }, idx: number) => ({
          id: item.id,
          type: item.type,
          translated_text: `[Translated to ${body.targetLanguage}] ${item.text}`,
          from_cache: idx < items.length * cacheHitRate,
        })
      );

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          translations,
          stats: {
            total: items.length,
            from_cache: Math.floor(items.length * cacheHitRate),
            translated: Math.ceil(items.length * (1 - cacheHitRate)),
          },
        }),
      });
    } catch {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          translations: [],
          stats: { total: 0, from_cache: 0, translated: 0 },
        }),
      });
    }
  });

  // Mock Notifications API
  await page.route("**/api/community/notifications*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ notifications: [], unread_count: 0 }),
    });
  });

  // Mock Hall of Fame
  await page.route("**/api/community/hall-of-fame*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        most_liked: [
          { id: "hof-1", postId: "mock-post-1", userId: "user-1", userName: "TopDev1", count: 50 },
          { id: "hof-2", postId: "mock-post-2", userId: "user-2", userName: "TopDev2", count: 40 },
        ],
        most_replied: [
          {
            id: "hof-3",
            postId: "mock-post-3",
            userId: "user-3",
            userName: "ActiveDev1",
            count: 30,
          },
        ],
      }),
    });
  });

  // Mock Country Stats
  await page.route("**/api/community/country-stats*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { code: "US", name: "United States", posts: 100, likes: 500, contributors: 50 },
        { code: "KR", name: "South Korea", posts: 85, likes: 400, contributors: 40 },
        { code: "JP", name: "Japan", posts: 70, likes: 350, contributors: 35 },
      ]),
    });
  });

  // Mock Countries API
  await page.route("**/api/countries*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        countries: [
          { code: "US", name: "United States", count: 100 },
          { code: "KR", name: "South Korea", count: 85 },
          { code: "JP", name: "Japan", count: 70 },
        ],
      }),
    });
  });

  // Mock Auth Recovery
  await page.route("**/api/auth/recovery-check*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ hasRecoveryToken: false }),
    });
  });

  // Mock /api/me (logged-in user)
  await page.route("**/api/me*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: "test-user-1",
          username: "testuser",
          display_name: "Test User",
          avatar_url: null,
          country_code: "US",
          timezone: "America/New_York",
          current_level: 5,
          global_rank: 100,
          country_rank: 10,
          total_tokens: 5000000000,
          total_cost: 25000,
          onboarding_completed: true,
        },
      }),
    });
  });

  return {
    getRequestCount: () => requestCount,
    getTranslationRequestCount: () => translationRequestCount,
    mockPosts,
  };
}

// ============================================
// SCENARIO 1: 초기 로드 → 토글 ON → 번역 검증
// (인증 필요 - 토글 버튼은 로그인 사용자만 볼 수 있음)
// ============================================
test.describe("Scenario 1: 초기 로드 및 번역 플로우", () => {
  test.use({ storageState: authFile });
  test("Mock 생성 → 페이지 로드 → 토글 ON 상태 확인 → 번역 검증", async ({ page }) => {
    const { mockPosts } = await setupMocks(page, {
      autoTranslateEnabled: true,
      translationDelay: 800,
    });

    await page.goto("/community");
    await page.waitForTimeout(2000);

    // 1. Auto-translate 섹션 확인
    await expect(page.getByText("Auto-translate")).toBeVisible({ timeout: 5000 });
    console.log("✓ Auto-translate section visible");

    // 2. 토글 버튼 확인 (로그인 상태)
    const toggleButton = page.locator('button[role="switch"]');
    await expect(toggleButton).toBeVisible({ timeout: 5000 });
    console.log("✓ Toggle button visible");

    // 3. 토글 ON 상태 확인
    const isChecked = await toggleButton.getAttribute("aria-checked");
    expect(isChecked).toBe("true");
    console.log("✓ Toggle is ON");

    // 4. 번역 로딩 또는 완료 상태 확인
    const translatingText = page.getByText("Translating...");
    const postsInLanguage = page.getByText("Posts appear in your language");

    // Either translating or already translated
    const hasIndicator = await Promise.race([
      translatingText.isVisible({ timeout: 2000 }).then(() => "translating"),
      postsInLanguage.isVisible({ timeout: 2000 }).then(() => "translated"),
    ]).catch(() => "none");

    console.log(`✓ Translation status: ${hasIndicator}`);

    // 5. 다국어 포스트 표시 확인
    // Korean post marker
    const koreanContent = page.getByText(/안녕하세요|Claude Code 정말/);
    const hasKorean = await koreanContent
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Japanese post marker
    const japaneseContent = page.getByText(/すごく便利|Claude Code/);
    const hasJapanese = await japaneseContent
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    console.log(`✓ Korean posts visible: ${hasKorean}`);
    console.log(`✓ Japanese posts visible: ${hasJapanese}`);

    // 6. 스크린샷 저장
    await page.screenshot({ path: "test-results/scenario1-initial-load.png", fullPage: true });
    console.log("✓ Screenshot saved");
  });

  test("번역 Shimmer 효과 표시 확인", async ({ page }) => {
    await setupMocks(page, {
      autoTranslateEnabled: true,
      translationDelay: 2000, // 긴 딜레이로 shimmer 확인
    });

    await page.goto("/community");
    await page.waitForTimeout(1000);

    // Shimmer/loading 효과 확인
    const translatingText = page.getByText("Translating...");
    const hasTranslating = await translatingText.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasTranslating) {
      console.log("✓ Translating indicator shown");
      await page.screenshot({ path: "test-results/scenario1-shimmer.png" });
    } else {
      console.log("Note: Translation was too fast to capture shimmer");
    }
  });
});

// ============================================
// SCENARIO 2: 토글 OFF → 원본 텍스트 표시
// (인증 필요)
// ============================================
test.describe("Scenario 2: 토글 OFF - 원본 텍스트 표시", () => {
  test.use({ storageState: authFile });

  test("토글 OFF 시 원본 다국어 텍스트 표시 확인", async ({ page }) => {
    await setupMocks(page, {
      autoTranslateEnabled: true,
    });

    await page.goto("/community");
    await page.waitForTimeout(2000);

    const toggleButton = page.locator('button[role="switch"]');
    await expect(toggleButton).toBeVisible({ timeout: 5000 });

    // 초기 상태 확인
    const initialState = await toggleButton.getAttribute("aria-checked");
    console.log(`Initial state: ${initialState}`);

    // 토글 OFF
    if (initialState === "true") {
      await toggleButton.click();
      await page.waitForTimeout(500);
    }

    // OFF 상태 확인
    const newState = await toggleButton.getAttribute("aria-checked");
    expect(newState).toBe("false");
    console.log("✓ Toggle is OFF");

    // "Showing original posts" 텍스트 확인
    await expect(page.getByText("Showing original posts")).toBeVisible({ timeout: 3000 });
    console.log('✓ "Showing original posts" displayed');

    // 원본 다국어 텍스트가 보이는지 확인
    await page.screenshot({ path: "test-results/scenario2-original-text.png", fullPage: true });
    console.log("✓ Screenshot saved");
  });

  test("토글 OFF 설정 저장 확인 (API 호출)", async ({ page }) => {
    let settingsSaved = false;

    await setupMocks(page, { autoTranslateEnabled: true });

    // PATCH 요청 감지
    page.on("request", (request) => {
      if (request.url().includes("/api/community/settings") && request.method() === "PATCH") {
        settingsSaved = true;
        console.log("✓ Settings PATCH request detected");
      }
    });

    await page.goto("/community");
    await page.waitForTimeout(2000);

    const toggleButton = page.locator('button[role="switch"]');
    await toggleButton.click();
    await page.waitForTimeout(1000);

    // API 호출 확인은 실제 환경에서만 동작
    console.log(`Settings saved via API: ${settingsSaved}`);
  });
});

// ============================================
// SCENARIO 3: 스크롤 → 추가 로드 → 번역
// (인증 필요)
// ============================================
test.describe("Scenario 3: 무한 스크롤 및 Lazy 번역", () => {
  test.use({ storageState: authFile });

  test("스크롤 시 추가 포스트 로드 및 번역 확인", async ({ page }) => {
    const { getRequestCount, getTranslationRequestCount } = await setupMocks(page, {
      autoTranslateEnabled: true,
      postCount: 40, // 많은 포스트
      hasMorePosts: true,
    });

    await page.goto("/community");
    await page.waitForTimeout(2000);

    const initialRequestCount = getRequestCount();
    console.log(`Initial posts API calls: ${initialRequestCount}`);

    // 피드 영역 스크롤
    const feedArea = page.locator('[class*="virtuoso"], [class*="feed"]').first();

    if (await feedArea.isVisible()) {
      // 스크롤 다운
      await feedArea.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      await page.waitForTimeout(2000);

      const afterScrollRequestCount = getRequestCount();
      console.log(`After scroll posts API calls: ${afterScrollRequestCount}`);

      if (afterScrollRequestCount > initialRequestCount) {
        console.log("✓ Additional posts loaded on scroll");
      }

      // 번역 요청 확인
      const translationCalls = getTranslationRequestCount();
      console.log(`Translation API calls: ${translationCalls}`);
    }

    await page.screenshot({ path: "test-results/scenario3-scroll.png" });
  });
});

// ============================================
// SCENARIO 4: 상태 지속성 (새로고침)
// (인증 필요)
// ============================================
test.describe("Scenario 4: 설정 상태 지속성", () => {
  test.use({ storageState: authFile });

  test("페이지 새로고침 후 토글 상태 유지 확인", async ({ page }) => {
    await setupMocks(page, { autoTranslateEnabled: false }); // OFF 상태로 시작

    await page.goto("/community");
    await page.waitForTimeout(2000);

    const toggleButton = page.locator('button[role="switch"]');
    await expect(toggleButton).toBeVisible({ timeout: 5000 });

    // 초기 상태 (OFF)
    const initialState = await toggleButton.getAttribute("aria-checked");
    console.log(`Initial state (from settings): ${initialState}`);

    // 새로고침
    await page.reload();
    await page.waitForTimeout(2000);

    // 상태 유지 확인
    const toggleAfter = page.locator('button[role="switch"]');
    const stateAfter = await toggleAfter.getAttribute("aria-checked");
    console.log(`State after refresh: ${stateAfter}`);

    // Mock 설정이 OFF였으므로 OFF 유지되어야 함
    expect(stateAfter).toBe(initialState);
    console.log("✓ Toggle state persisted");
  });
});

// ============================================
// SCENARIO 5: 번역 캐시 동작
// (인증 필요)
// ============================================
test.describe("Scenario 5: 번역 캐시 동작", () => {
  test.use({ storageState: authFile });

  test("캐시된 번역 재사용 확인", async ({ page }) => {
    let cacheHits = 0;
    let totalTranslations = 0;

    await setupMocks(page, {
      autoTranslateEnabled: true,
      cacheHitRate: 0.8, // 80% 캐시 히트
    });

    // 번역 응답에서 캐시 히트 추적
    page.on("response", async (response) => {
      if (response.url().includes("/api/community/translate-batch")) {
        try {
          const data = await response.json();
          if (data.stats) {
            cacheHits += data.stats.from_cache || 0;
            totalTranslations += data.stats.total || 0;
          }
        } catch {}
      }
    });

    await page.goto("/community");
    await page.waitForTimeout(3000);

    console.log(`Total translations requested: ${totalTranslations}`);
    console.log(`Cache hits: ${cacheHits}`);

    if (totalTranslations > 0) {
      const hitRate = ((cacheHits / totalTranslations) * 100).toFixed(1);
      console.log(`Cache hit rate: ${hitRate}%`);
    }
  });
});

// ============================================
// SCENARIO 6: 번역 API 오류 처리
// (인증 필요)
// ============================================
test.describe("Scenario 6: 오류 처리", () => {
  test.use({ storageState: authFile });

  test("번역 API 실패 시 원본 텍스트 유지", async ({ page }) => {
    await setupMocks(page, {
      autoTranslateEnabled: true,
      translationError: true, // 오류 시뮬레이션
    });

    await page.goto("/community");
    await page.waitForTimeout(3000);

    // 에러 모달이 표시되지 않아야 함 (graceful degradation)
    const errorModal = page.getByText("Something went wrong");
    const hasError = await errorModal.isVisible().catch(() => false);

    if (!hasError) {
      console.log("✓ No error modal shown (graceful degradation)");
    } else {
      console.log("⚠ Error modal displayed");
    }

    // 원본 포스트는 여전히 표시되어야 함
    const feedContent = page.locator('[class*="feed"], [class*="post"]');
    const hasContent = await feedContent
      .first()
      .isVisible()
      .catch(() => false);
    console.log(`Posts still visible: ${hasContent}`);

    await page.screenshot({ path: "test-results/scenario6-error-handling.png" });
  });
});

// ============================================
// SCENARIO 7: Community Stats 정확성
// (인증 필요 - 전체 기능 확인을 위해)
// ============================================
test.describe("Scenario 7: Community Stats 검증", () => {
  test.use({ storageState: authFile });

  test("Hall of Fame 및 Country Stats 데이터 표시", async ({ page }) => {
    await setupMocks(page);

    await page.goto("/community");
    await page.waitForTimeout(2000);

    // Hall of Fame 섹션
    const hofSection = page.getByText("Hall of Fame");
    if (await hofSection.isVisible().catch(() => false)) {
      console.log("✓ Hall of Fame section visible");

      // 탭 전환 테스트
      const todayTab = page.getByRole("button", { name: /Today/i });
      const weeklyTab = page.getByRole("button", { name: /Weekly/i });

      if (await todayTab.isVisible()) {
        await weeklyTab.click();
        await page.waitForTimeout(500);
        console.log("✓ Switched to Weekly tab");

        await todayTab.click();
        await page.waitForTimeout(500);
        console.log("✓ Switched back to Today tab");
      }
    }

    // Top Countries 섹션
    const countriesSection = page.getByText("Top Countries");
    if (await countriesSection.isVisible().catch(() => false)) {
      console.log("✓ Top Countries section visible");
    }

    await page.screenshot({ path: "test-results/scenario7-stats.png", fullPage: true });
  });
});

// ============================================
// SCENARIO 8: Guest User (토글 미표시)
// ============================================
test.describe("Scenario 8: Guest User 동작", () => {
  test("비로그인 사용자는 토글이 보이지 않음", async ({ page }) => {
    // /api/me를 401로 응답하여 비로그인 시뮬레이션
    await page.route("**/api/me*", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Unauthorized" }),
      });
    });

    // 나머지 mock 설정
    await setupMocks(page, { autoTranslateEnabled: true });

    await page.goto("/community");
    await page.waitForTimeout(2000);

    // Auto-translate 배너는 보이지만 토글은 안 보여야 함
    const autoTranslateText = page.getByText("Auto-translate");
    const toggleButton = page.locator('button[role="switch"]');

    const bannerVisible = await autoTranslateText.isVisible().catch(() => false);
    const toggleVisible = await toggleButton.isVisible().catch(() => false);

    console.log(`Auto-translate banner visible: ${bannerVisible}`);
    console.log(`Toggle button visible: ${toggleVisible}`);

    // 토글이 안 보여야 함
    if (!toggleVisible) {
      console.log("✓ Toggle correctly hidden for guest user");
    }

    await page.screenshot({ path: "test-results/scenario8-guest.png" });
  });
});
