# News Tab Unified Migration - Comprehensive Test Plan

## Application Overview

The unified News page (`/news`) consolidates all news-related content into a single, filterable interface. Key features:

- **Header**: Page title "AI & Dev News" with subtitle
- **Quick Links**: Three external links (Claude Code Changelog, Anthropic News, Claude Code Docs)
- **Filter Sidebar**: Four filter tabs (All, Claude, Dev Tools, Industry)
- **News Grid**: Dynamic news card display with featured/list variants
- **Footer**: Disclaimer and official source guidance

## Test Architecture - Parallel Execution Groups

### Group A: Static UI Tests (Parallel Safe)
No state dependencies, read-only operations. Can run in parallel.

### Group B: Filter Interaction Tests (Sequential)
URL parameter changes, must run sequentially to avoid state conflicts.

### Group C: Responsive Viewport Tests (Parallel Safe)
Independent viewport sizes, no state sharing. Can run in parallel.

---

## Test Scenarios

### Group A: Static UI Tests

**Seed:** `tests/e2e/news-unified-seed.spec.ts`

#### A.1 Page Load and Header Display
**File:** `tests/e2e/news/group-a/page-load.spec.ts`
**Steps:**
1. Navigate to /news
2. Verify page title contains "News | CCgather"
3. Verify main heading "AI & Dev News" is visible
4. Verify subtitle "Claude에 몰입해도 시야를 잃지 마세요" is visible
5. Verify Globe icon is visible in header

**Expected Results:**
- Page loads successfully with correct meta title
- Main heading displays with gradient icon
- Subtitle displays with muted text color

#### A.2 Quick Links Section Display
**File:** `tests/e2e/news/group-a/quick-links.spec.ts`
**Steps:**
1. Navigate to /news
2. Verify Quick Links section is visible
3. Verify "Claude Code Changelog" card is visible with correct href
4. Verify "Anthropic News" card is visible with correct href
5. Verify "Claude Code Docs" card is visible with correct href
6. Verify all cards have external link icons
7. Verify cards have correct logo images

**Expected Results:**
- Three Quick Link cards display in grid layout
- Each card has title, description, logo, and external link icon
- Links point to correct external URLs

#### A.3 Filter Sidebar Initial State
**File:** `tests/e2e/news/group-a/filter-sidebar.spec.ts`
**Steps:**
1. Navigate to /news (no tag parameter)
2. Verify filter navigation is visible
3. Verify "필터" label is visible
4. Verify "All" filter is selected by default
5. Verify "Claude" filter is visible with orange theme
6. Verify "Dev Tools" filter is visible with green theme
7. Verify "Industry" filter is visible with purple theme
8. Verify each filter shows description text

**Expected Results:**
- Filter sidebar displays on left (desktop) or top (mobile)
- "All" filter has active/pressed state
- Each filter shows icon, label, and description
- Color coding matches design (blue, orange, green, purple)

#### A.4 News Grid Initial Display
**File:** `tests/e2e/news/group-a/news-grid.spec.ts`
**Steps:**
1. Navigate to /news
2. Verify news grid container is visible
3. Verify "All News" label with count is visible
4. Verify at least one news card is displayed (or empty state)
5. If cards exist, verify first card has featured styling (LATEST badge)
6. Verify news cards have title, date, and thumbnail

**Expected Results:**
- News grid displays with correct header
- First card (if exists) shows LATEST badge and featured layout
- Subsequent cards show list layout
- Empty state displays if no news

#### A.5 Footer Section Display
**File:** `tests/e2e/news/group-a/footer-section.spec.ts`
**Steps:**
1. Navigate to /news
2. Scroll to bottom of page
3. Verify footer section is visible
4. Verify Sparkles icon and guidance text is visible
5. Verify disclaimer text about CCgather curation is visible

**Expected Results:**
- Footer displays with border separator
- Official source guidance text is visible
- Disclaimer text displays in small font

#### A.6 Accessibility - ARIA Labels
**File:** `tests/e2e/news/group-a/accessibility.spec.ts`
**Steps:**
1. Navigate to /news
2. Verify filter navigation has aria-label="뉴스 필터"
3. Verify filter buttons have aria-pressed attributes
4. Verify Quick Link cards have aria-label with title and description
5. Verify news cards have aria-label with article title
6. Verify empty state has role="status" and aria-live="polite"

**Expected Results:**
- All interactive elements have proper ARIA attributes
- Screen readers can navigate the page effectively
- Focus states are visible on keyboard navigation

---

### Group B: Filter Interaction Tests

**Seed:** `tests/e2e/news-unified-seed.spec.ts`

#### B.1 Filter to Claude Category
**File:** `tests/e2e/news/group-b/filter-claude.spec.ts`
**Steps:**
1. Navigate to /news
2. Click "Claude" filter button
3. Wait for URL to update to /news?tag=claude
4. Verify "Claude" filter shows selected state
5. Verify news grid header shows "Claude News"
6. Verify loading state appears briefly (Loader2 icon)
7. Verify news cards display Claude-related content

**Expected Results:**
- URL updates with tag=claude parameter
- Filter button shows active state with orange background
- News grid filters to Claude/Anthropic related news
- Count updates to reflect filtered items

#### B.2 Filter to Dev Tools Category
**File:** `tests/e2e/news/group-b/filter-dev-tools.spec.ts`
**Steps:**
1. Navigate to /news
2. Click "Dev Tools" filter button
3. Wait for URL to update to /news?tag=dev-tools
4. Verify "Dev Tools" filter shows selected state
5. Verify news grid header shows "Dev Tools News"
6. Verify filtered news cards are displayed

**Expected Results:**
- URL updates with tag=dev-tools parameter
- Filter button shows active state with green background
- News grid filters to developer tools news

#### B.3 Filter to Industry Category
**File:** `tests/e2e/news/group-b/filter-industry.spec.ts`
**Steps:**
1. Navigate to /news
2. Click "Industry" filter button
3. Wait for URL to update to /news?tag=industry
4. Verify "Industry" filter shows selected state
5. Verify news grid header shows "Industry News"
6. Verify filtered news cards are displayed

**Expected Results:**
- URL updates with tag=industry parameter
- Filter button shows active state with purple background
- News grid filters to industry news (OpenAI, Google, Meta)

#### B.4 Reset Filter to All
**File:** `tests/e2e/news/group-b/filter-reset.spec.ts`
**Steps:**
1. Navigate to /news?tag=claude
2. Verify "Claude" filter is selected
3. Click "All" filter button
4. Wait for URL to update to /news (no tag parameter)
5. Verify "All" filter shows selected state
6. Verify news grid header shows "All News"

**Expected Results:**
- URL removes tag parameter
- Filter resets to show all news
- First card shows LATEST badge (featured variant)

#### B.5 Direct URL Navigation with Tag
**File:** `tests/e2e/news/group-b/url-navigation.spec.ts`
**Steps:**
1. Navigate directly to /news?tag=industry
2. Verify "Industry" filter is pre-selected
3. Verify news grid shows Industry filtered content
4. Navigate to /news?tag=invalid
5. Verify fallback to "All" filter

**Expected Results:**
- Filter state syncs with URL parameter
- Invalid tags fallback to "All" filter
- Page handles malformed URLs gracefully

---

### Group C: Responsive Viewport Tests

**Seed:** `tests/e2e/news-unified-seed.spec.ts`

#### C.1 Mobile Viewport (375x812 - iPhone)
**File:** `tests/e2e/news/group-c/mobile-viewport.spec.ts`
**Steps:**
1. Set viewport to 375x812
2. Navigate to /news
3. Verify header stacks vertically with appropriate font sizes
4. Verify Quick Links display in single column
5. Verify filter sidebar displays above news grid
6. Verify news cards display in full width
7. Verify all content is accessible without horizontal scroll
8. Test filter interaction on mobile

**Expected Results:**
- Layout adapts to single column
- No horizontal overflow
- Filter pills are touch-friendly
- News cards show mobile-optimized layout

#### C.2 Tablet Viewport (768x1024 - iPad)
**File:** `tests/e2e/news/group-c/tablet-viewport.spec.ts`
**Steps:**
1. Set viewport to 768x1024
2. Navigate to /news
3. Verify header displays with medium font sizes
4. Verify Quick Links display in 3-column grid
5. Verify filter sidebar starts showing on left
6. Verify news cards maintain readable width
7. Test filter interaction on tablet

**Expected Results:**
- 3-column grid for Quick Links (md:grid-cols-3)
- Filter sidebar may show horizontally or start sidebar layout
- News cards maintain good proportions

#### C.3 Desktop Viewport (1280x800)
**File:** `tests/e2e/news/group-c/desktop-viewport.spec.ts`
**Steps:**
1. Set viewport to 1280x800
2. Navigate to /news
3. Verify header displays with large font sizes (xl:text-4xl)
4. Verify Quick Links display in 3-column grid
5. Verify filter sidebar is sticky on left (lg:w-48)
6. Verify news grid takes remaining space (flex-1)
7. Verify max-width constraint (max-w-7xl)
8. Test filter interaction on desktop

**Expected Results:**
- Full sidebar layout (lg:flex-row)
- Sticky filter sidebar
- Optimal content width
- All interactive elements accessible

#### C.4 Large Desktop Viewport (1920x1080)
**File:** `tests/e2e/news/group-c/large-desktop-viewport.spec.ts`
**Steps:**
1. Set viewport to 1920x1080
2. Navigate to /news
3. Verify content stays within max-width container
4. Verify proper spacing and padding
5. Verify no layout issues at large width
6. Verify news cards don't stretch excessively

**Expected Results:**
- Content centered with max-w-7xl
- Consistent spacing and proportions
- Professional appearance at large screens

---

## Test File Structure

```
tests/e2e/
├── news-unified-seed.spec.ts
└── news/
    ├── group-a/                    # Parallel Safe
    │   ├── page-load.spec.ts
    │   ├── quick-links.spec.ts
    │   ├── filter-sidebar.spec.ts
    │   ├── news-grid.spec.ts
    │   ├── footer-section.spec.ts
    │   └── accessibility.spec.ts
    ├── group-b/                    # Sequential
    │   ├── filter-claude.spec.ts
    │   ├── filter-dev-tools.spec.ts
    │   ├── filter-industry.spec.ts
    │   ├── filter-reset.spec.ts
    │   └── url-navigation.spec.ts
    └── group-c/                    # Parallel Safe
        ├── mobile-viewport.spec.ts
        ├── tablet-viewport.spec.ts
        ├── desktop-viewport.spec.ts
        └── large-desktop-viewport.spec.ts
```

## Parallel Execution Strategy

```yaml
parallel_groups:
  - name: "Group A + Group C"
    tests:
      - "tests/e2e/news/group-a/**/*.spec.ts"
      - "tests/e2e/news/group-c/**/*.spec.ts"
    reason: "Read-only operations, no state conflicts"

  - name: "Group B"
    tests:
      - "tests/e2e/news/group-b/**/*.spec.ts"
    reason: "URL parameter changes, must run sequentially"
    serial: true
```

## Cookie/Authentication Setup

For authenticated tests, inject Clerk session cookies:
- `clerk_active_context`: Session token for localhost

## Notes

- All tests use `http://localhost:3000` as baseURL
- Tests assume server is already running
- Group B tests must wait for route transitions
- Responsive tests reset viewport after each test
