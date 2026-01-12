# CCgather Leaderboard - Responsive UI Test Plan

## Executive Summary

This test plan covers the responsive behavior of the CCgather leaderboard page across three breakpoint tiers: Mobile (<640px), Tablet (640-1039px), and Desktop (≥1040px). The focus is on verifying adaptive layouts, touch interactions, filter transformations, panel behaviors, and visual element adjustments that optimize the user experience across different viewport sizes.

**Test Target**: `/leaderboard` page
**Breakpoints**:
- Mobile: 375px (iPhone SE)
- Tablet: 768px (iPad)
- Desktop: 1280px

**Key Components Tested**:
- Table layout and column visibility
- Filter controls (button groups vs dropdowns)
- CCplan tabs responsiveness
- ProfileSidePanel (overlay vs push modes)
- LiveStatsTicker positioning
- Pagination controls
- Touch gesture support

---

## Test Environment Setup

### Prerequisites
- Local server running on `http://localhost:3002`
- Test data populated in leaderboard
- Multiple users with different ranks, countries, and CCplan tiers

### Device Simulation Settings
```javascript
// Mobile (iPhone SE)
viewport: { width: 375, height: 667 }

// Tablet (iPad)
viewport: { width: 768, height: 1024 }

// Desktop
viewport: { width: 1280, height: 720 }
```

---

## Test Scenarios

### 1. Table Layout Responsiveness

#### 1.1 Desktop Table - All Columns Visible (≥1040px)
**Viewport**: 1280px width
**Steps**:
1. Navigate to `/leaderboard`
2. Wait for table to load (20 rows)
3. Verify all columns are visible:
   - Rank column (width: 60px)
   - Country flag column (width: 44px)
   - User column (flexible width)
   - Level column (width: 70px) - **Desktop only**
   - Cost column (width: 90px with full text)
   - Tokens column (width: 70px with full text)

**Expected Results**:
- Level badges display with hover tooltips
- Cost shows full format: "$12,345"
- Tokens column header shows "Tokens" text
- Cost column header shows "Cost" text
- All 6 columns visible and properly spaced

#### 1.2 Tablet Table - Level Column Hidden (640-1039px)
**Viewport**: 768px width
**Steps**:
1. Navigate to `/leaderboard`
2. Wait for table to load
3. Check column count and visibility

**Expected Results**:
- Level column is hidden (uses `hidden md:table-cell` - only shows ≥768px)
- **CORRECTION**: At 768px, Level column SHOULD be visible (md breakpoint)
- 6 columns total visible at 768px
- Rank: 60px, Flag: 44px, User: flex, Level: 70px, Cost: 90px, Tokens: 70px

#### 1.3 Mobile Table - Compact Layout (<640px)
**Viewport**: 375px width
**Steps**:
1. Navigate to `/leaderboard`
2. Wait for table to load
3. Verify column adjustments

**Expected Results**:
- Level column hidden (no level badges visible)
- Rank column narrower: 40px (was 60px)
- Flag column narrower: 28px (was 44px)
- Cost column narrower: 50px (was 90px)
- Cost shows compact format: "$12k" (not "$12,345")
- Tokens column narrower: 52px (was 70px)
- Column headers show icons: "$" and "🪙" (not "Cost" and "Tokens")
- 5 columns total (Rank, Flag, User, Cost, Tokens)

#### 1.4 Row Sizing Responsiveness
**Viewport**: Test at 375px and 1280px
**Steps**:
1. Load leaderboard
2. Inspect rank 1, rank 2, and rank 4 rows
3. Measure avatar sizes and padding

**Expected Results - Mobile (375px)**:
- Rank 1: Avatar 24px (w-6 h-6), padding py-2
- Rank 2-3: Avatar 24px (w-6 h-6), padding py-2
- Rank 4+: Avatar 24px (w-6 h-6), padding py-2

**Expected Results - Desktop (1280px)**:
- Rank 1: Avatar 32px (w-8 h-8), padding py-3
- Rank 2-3: Avatar 28px (w-7 h-7), padding py-2.5
- Rank 4+: Avatar 24px (w-6 h-6), padding py-2

---

### 2. Filter Controls Transformation

#### 2.1 Desktop Filter Layout (≥640px)
**Viewport**: 1280px width
**Steps**:
1. Navigate to `/leaderboard`
2. Locate filter bar below CCplan tabs
3. Verify filter control types

**Expected Results**:
- **Scope Filter**: Button group (🌍 Global | Flag Country)
- **Period Filter**: Button group with 4 buttons
  - Desktop shows full text: "All Time", "Today", "7D", "30D"
  - Buttons use `px-3 py-1.5` spacing
- **My Rank Button**: Shows full text "My Rank" + rank number
- **Sort Filter**: Button group (💵 Cost | 🪙 Tokens)
- All filters horizontally aligned with gap-3
- Divider visible between scope and period filters

#### 2.2 Tablet Filter Layout (640-1039px)
**Viewport**: 768px width
**Steps**:
1. Navigate to `/leaderboard`
2. Check period filter button labels

**Expected Results**:
- Period filter buttons show short labels: "∞", "1D", "7D", "30D"
- Button group still visible (not dropdown)
- Buttons use `px-2.5` spacing (smaller than desktop)
- "My Rank" button hides text label, shows only icon + number on smallest tablet sizes

#### 2.3 Mobile Filter Layout (<640px)
**Viewport**: 375px width
**Steps**:
1. Navigate to `/leaderboard`
2. Locate period filter control
3. Verify transformation to dropdown

**Expected Results**:
- **Period Filter becomes SELECT dropdown** (hidden on sm:, shown on mobile)
- Dropdown options: "All Time", "Today", "7D", "30D"
- Dropdown has custom arrow icon (▼) on right side
- Background: `var(--color-filter-bg)`
- Border: `var(--border-default)`
- Scope filter remains as button group
- Sort filter remains as button group
- Gaps reduced to `gap-1.5` instead of `gap-3`
- Divider hidden between filters

#### 2.4 My Rank Button Responsiveness
**Viewport**: Test at 375px, 768px, 1280px
**Steps**:
1. Ensure user is logged in and has rank
2. Observe "My Rank" button layout changes

**Expected Results**:
- **Mobile (375px)**: Icon + rank only (no "My Rank" text)
  - Shows: `📍 #42`
  - Text hidden with `hidden lg:inline`
- **Tablet (768px)**: Same as mobile (icon + rank only)
- **Desktop (1280px)**: Full layout with text
  - Shows: `📍 My Rank #42`
- Button remains functional at all sizes

---

### 3. CCplan Tabs Responsive Behavior

#### 3.1 Desktop CCplan Tabs (≥640px)
**Viewport**: 1280px width
**Steps**:
1. Navigate to `/leaderboard`
2. Locate CCplan tabs above filter bar
3. Verify tab layout

**Expected Results**:
- Tab container: `p-1` padding, `gap-1` between tabs
- Each tab button: `px-3 py-1.5` spacing
- All tab labels fully visible: "All League", "Max", "Pro", "Free"
- Icons visible before each label
- Active tab has colored background (Max: gold, Pro: coral, Free: blue)
- Smooth hover effects on inactive tabs

#### 3.2 Tablet CCplan Tabs (640-1039px)
**Viewport**: 768px width
**Steps**:
1. Navigate to `/leaderboard`
2. Check tab button sizing

**Expected Results**:
- Tab buttons adjust to `px-2.5` spacing (medium screens)
- Labels still fully visible
- Container maintains responsive padding

#### 3.3 Mobile CCplan Tabs (<640px)
**Viewport**: 375px width
**Steps**:
1. Navigate to `/leaderboard`
2. Verify tab compactness

**Expected Results**:
- Tab container: `p-0.5` padding (reduced), `gap-0.5` between tabs
- Each tab button: `px-2 py-1.5` spacing (more compact)
- All 4 tabs fit horizontally without wrapping
- Labels may be slightly compressed but remain readable
- Icons remain visible
- Touch-friendly tap targets maintained (minimum 44x44px)

---

### 4. ProfileSidePanel - Overlay vs Push Mode

#### 4.1 Desktop Push Mode (≥1040px)
**Viewport**: 1280px width
**Steps**:
1. Navigate to `/leaderboard`
2. Click on any user row to open panel
3. Observe page layout adjustment

**Expected Results**:
- Panel opens from right side
- Panel width: 440px
- **Main content PUSHES LEFT** (not overlaid)
- Content margin-right adjusts to `440px`
- Panel has fixed positioning: `fixed top-0 right-0 h-full`
- No backdrop overlay visible
- Panel shows:
  - Profile header with 48px avatar
  - Social links visible in header (not mobile)
  - Full width stats grid (2 columns)
  - Level progress bar
  - Usage chart
  - Activity heatmap
  - Badge grid (5 columns)
- Close button (X) in top-right
- ESC key closes panel
- Clicking outside panel closes it

#### 4.2 Tablet Push Mode (640-1039px)
**Viewport**: 768px width
**Steps**:
1. Navigate to `/leaderboard`
2. Click on user row
3. Verify panel behavior

**Expected Results**:
- Panel width: 320px (narrower than desktop)
- **Content PUSHES LEFT** by 320px
- Main content area remains at least 320px+ wide (768 - 320 = 448px)
- No backdrop overlay
- Panel shows same content as desktop but more compact:
  - Profile header with smaller elements
  - Stats grid remains 2 columns
  - Badge grid compressed to 5 columns with smaller badges
- Social links shown in header (not in mobile position)
- Close with X button or ESC key
- Clicking outside closes panel

#### 4.3 Mobile Overlay Mode (<640px)
**Viewport**: 375px width
**Steps**:
1. Navigate to `/leaderboard`
2. Click on user row
3. Observe full-screen overlay behavior

**Expected Results**:
- Panel width: `calc(100% - 56px)` (leaves 56px margin on left)
- **OVERLAY MODE**: Content does NOT push, panel overlays
- Dark backdrop visible: `bg-black/50` covering entire screen
- Body scroll locked (`overflow: hidden`)
- Panel slides in from right with animation
- Close methods:
  - X button in top-right
  - ESC key
  - Tap on backdrop overlay
  - **Swipe right gesture** (horizontal drag to close)
- Swipe gesture details:
  - Touch start tracked
  - Horizontal vs vertical scroll detected
  - If vertical scroll, swipe disabled (allows content scrolling)
  - If horizontal drag >100px right, panel closes
  - Visual feedback: panel follows finger during drag
- Social links positioned below username (mobile layout)

#### 4.4 Panel Content Responsiveness
**Viewport**: Test at 375px, 768px, 1280px
**Steps**:
1. Open panel at each viewport
2. Scroll through panel content
3. Verify component adjustments

**Expected Results**:

**Mobile (375px)**:
- Narrow mode detection: `isNarrow` true if width < 400px
- Stats cards:
  - Cost display: Shows "12K" format if >= 100K
  - Tokens display: Shows "1.2B" format if >= 1B
  - Font sizes reduce on narrow screens
- Level progress bar: Compact with smaller tooltips
- Usage chart: Adjusted axis tick count
- Badge grid: 5 columns but more compressed
- Social links row: Positioned below username in header

**Tablet (768px)**:
- Standard compact layout
- Stats cards: Regular number formatting
- All sections visible and properly spaced
- Badge popovers open on left/right based on column position

**Desktop (1280px)**:
- Full layout with maximum spacing
- Large font sizes for stats
- Spacious badge grid with hover popovers
- Smooth scrolling within panel

---

### 5. LiveStatsTicker Positioning

#### 5.1 Desktop Ticker Position (≥640px)
**Viewport**: 1280px width
**Steps**:
1. Navigate to `/leaderboard`
2. Locate LiveStatsTicker in header area

**Expected Results**:
- Ticker positioned in **top-right of header**
- Always visible above filter bar
- Layout: 2-row vertical compact format
- Row 1: Global stats (🌍 tokens | cost)
- Row 2: Country ticker (flag + name, animated)
- Background: `var(--color-filter-bg)`
- Border: `var(--border-default)`
- Minimum width: 120px
- Font size: 11px
- Clickable to open CountryStatsModal

#### 5.2 Mobile Ticker Position (<640px)
**Viewport**: 375px width
**Steps**:
1. Navigate to `/leaderboard`
2. Verify ticker remains in header

**Expected Results**:
- Ticker stays in **top-right position** (same as desktop)
- Same 2-row compact layout
- Still clickable and functional
- Country name may truncate if very long
- Ticker adapts padding to fit mobile header
- No layout shift between breakpoints

---

### 6. Pagination Controls

#### 6.1 Desktop Pagination (≥640px)
**Viewport**: 1280px width
**Steps**:
1. Navigate to `/leaderboard`
2. Scroll to bottom to see pagination
3. Verify button layout

**Expected Results**:
- Pagination centered below table
- Buttons: `w-10 h-10` (40x40px)
- Gap between buttons: `gap-2`
- Previous/Next arrows: ‹ and ›
- Page numbers displayed with ellipsis logic:
  - Shows: 1 ... 5 6 7 ... 20 (when on page 6)
  - Total pages <= 7: All pages shown
- Active page: Coral background
- Inactive pages: Hover effect with `hover:bg-white/10`
- User count shown: "320 users" on right side
- All elements properly spaced

#### 6.2 Tablet Pagination (640-1039px)
**Viewport**: 768px width
**Steps**:
1. Navigate to pagination area
2. Verify responsive adjustments

**Expected Results**:
- Same button sizes as desktop: `w-10 h-10`
- Same gap: `gap-2`
- Page number logic identical
- User count text may have smaller font
- All interactive elements remain touch-friendly

#### 6.3 Mobile Pagination (<640px)
**Viewport**: 375px width
**Steps**:
1. Scroll to pagination controls
2. Test button interactions

**Expected Results**:
- Button sizes remain `w-10 h-10` (touch-friendly)
- Gap may reduce slightly if page numbers overflow
- Fewer page numbers shown in ellipsis logic (to fit width)
- Previous/Next buttons always visible
- User count text potentially hidden or smaller
- Buttons remain tappable with adequate spacing
- No horizontal scrolling required

---

### 7. Touch Gesture Support (Mobile)

#### 7.1 Swipe to Close Panel
**Viewport**: 375px width
**Steps**:
1. Open user profile panel
2. Touch panel content area
3. Drag finger from left to right
4. Drag at least 100px
5. Release finger

**Expected Results**:
- Panel follows finger during drag
- Visual feedback: Panel transforms with swipe offset
- After 100px threshold and release: Panel closes smoothly
- Backdrop fades out
- Body scroll re-enabled
- Animation duration: 300ms

#### 7.2 Vertical Scroll vs Horizontal Swipe Detection
**Viewport**: 375px width
**Steps**:
1. Open panel
2. Attempt to scroll panel content vertically
3. Then attempt horizontal swipe

**Expected Results**:
- **Vertical scroll**: Content scrolls normally, no swipe activation
- First touch movement determines gesture type:
  - If abs(deltaY) > abs(deltaX): Vertical scroll enabled
  - If abs(deltaX) > abs(deltaY): Horizontal swipe enabled
- Minimum threshold: 10px movement before direction determined
- Once direction set, gesture locked (prevents accidental swipes during scroll)
- Swipe only triggers if horizontal movement detected first

#### 7.3 Backdrop Tap to Close
**Viewport**: 375px width
**Steps**:
1. Open profile panel
2. Tap on dark backdrop area (outside panel)

**Expected Results**:
- Panel closes immediately
- Backdrop fades out
- No content interaction on backdrop tap
- Body scroll restored

---

### 8. Header and Title Responsiveness

#### 8.1 Desktop Header Layout (≥1040px)
**Viewport**: 1280px width
**Steps**:
1. Navigate to `/leaderboard`
2. Inspect header section

**Expected Results**:
- "Rankings" label (top-left): 12px font, coral color
- LiveStatsTicker (top-right): Always visible
- Main title: "Global Leaderboard" - 32px font (3xl)
- Subtitle: "Top Claude Code developers ranked by..." - 14px font
- Filter bar below with full desktop layout
- Proper spacing between all elements (mb-6)

#### 8.2 Tablet Header Layout (640-1039px)
**Viewport**: 768px width
**Steps**:
1. Check header text sizing
2. Verify ticker position

**Expected Results**:
- Main title: 24px font (2xl - smaller than desktop)
- Subtitle: Same 14px font
- LiveStatsTicker remains top-right
- All elements visible and properly spaced

#### 8.3 Mobile Header Layout (<640px)
**Viewport**: 375px width
**Steps**:
1. Inspect header on mobile
2. Verify text readability

**Expected Results**:
- Main title: 24px font (2xl)
- Country flag in title (if Country scope): 24px size
- Subtitle: 14px font, may wrap to 2 lines if needed
- LiveStatsTicker: Stays top-right, compact format
- Rankings label: Still visible at 12px
- Header padding adjusted: `px-4 py-8`

---

### 9. Visual Transitions and Animations

#### 9.1 Panel Open/Close Animation
**Viewport**: Test at all sizes
**Steps**:
1. Click user row
2. Observe panel animation
3. Close panel with X button
4. Observe close animation

**Expected Results**:
- **Open animation**: 300ms ease-out
  - Panel slides in from right: `translate-x-0`
  - Backdrop fades in (mobile only): `opacity-100`
  - Content area shifts left (desktop/tablet): Smooth transition
- **Close animation**: 300ms ease-out
  - Panel slides out right: `translate-x-full`
  - Backdrop fades out (mobile): `opacity-0`
  - Content area returns to center (desktop/tablet)
- During swipe (mobile): No animation, follows touch instantly
- After swipe release: Animation re-enables for close

#### 9.2 Table Row Fade-In Animation
**Viewport**: 1280px width
**Steps**:
1. Change filter (e.g., Period from All to Today)
2. Observe table reload animation

**Expected Results**:
- Each row fades in sequentially
- Animation: `fadeSlideIn 0.2s ease-out`
- Stagger delay: Based on index with formula `Math.pow(index, 0.35) * 0.225s`
- Row 1: ~0.225s delay
- Row 5: ~0.32s delay
- Row 10: ~0.40s delay
- Creates smooth cascade effect
- Animation only on filter change, not initial load

#### 9.3 Filter Button State Transitions
**Viewport**: Test at all sizes
**Steps**:
1. Click between filter options
2. Observe active state changes

**Expected Results**:
- Background color transition: 200ms
- Text color transition: Smooth
- Active state: Immediate visual feedback
- Hover state: `hover:bg-[var(--color-filter-hover)]` transition
- No layout shift between states

---

### 10. Edge Cases and Boundary Testing

#### 10.1 Viewport at Exact Breakpoints
**Viewports**: 640px, 1040px
**Steps**:
1. Set viewport to exactly 640px
2. Verify behavior is tablet mode
3. Set viewport to exactly 1040px
4. Verify behavior is desktop mode

**Expected Results**:
- **At 640px**: Tablet mode activates
  - Period filter shows button group (not dropdown)
  - Level column visible in table
  - Panel push mode (320px width)
- **At 1040px**: Desktop mode activates
  - Panel width: 440px
  - Full desktop layout enabled
  - All spacing at maximum values

#### 10.2 Panel Content Overflow Handling
**Viewport**: 375px width
**Steps**:
1. Open panel for user with many badges
2. Scroll to bottom of panel
3. Verify scroll behavior

**Expected Results**:
- Panel content scrollable: `overflow-y-auto`
- Header remains fixed at top
- Compact stats bar appears when scrolling past main stats
- Bottom padding: `pb-24` (prevents content cutoff)
- Smooth scrolling on touch devices
- No horizontal overflow: `overflow-x-clip`

#### 10.3 Very Long Usernames and Display Names
**Viewport**: Test at 375px, 768px, 1280px
**Steps**:
1. Find user with long name (>20 characters)
2. Verify text truncation in table
3. Check panel header display

**Expected Results**:
- **Table**: Username truncates with `truncate` class
- **Panel Header**: Display name may wrap or truncate based on width
- No horizontal scrolling in table or panel
- Ellipsis (...) shown for truncated text
- Full name visible in panel title

#### 10.4 No Users / Empty State
**Viewport**: 1280px width
**Steps**:
1. Apply filters that return 0 results
2. Observe empty state display

**Expected Results**:
- Empty state centered: `py-20`
- Icon: 📭 (large 4xl size)
- Message: "No users found"
- Subtitle: "Be the first to join the leaderboard!"
- Filters remain visible and functional
- No table or pagination shown

---

## Test Execution Guidelines

### Manual Testing Checklist

For each test scenario:
1. ✅ Set specified viewport size
2. ✅ Clear browser cache and reload
3. ✅ Take screenshot for visual regression
4. ✅ Test all interactive elements (hover, click, swipe)
5. ✅ Verify no console errors
6. ✅ Check network tab for API calls
7. ✅ Test with keyboard navigation
8. ✅ Verify touch targets are ≥44x44px

### Automated Testing Approach

```typescript
// Example Playwright test structure
test.describe('Responsive Leaderboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3002/leaderboard');
    await expect(page.locator('table tbody tr')).toHaveCount(20, { timeout: 15000 });
  });

  test('Mobile: Period filter shows dropdown', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // Desktop button group should be hidden
    await expect(page.locator('.hidden.sm\\:flex')).toBeHidden();

    // Mobile dropdown should be visible
    const dropdown = page.locator('select').filter({ has: page.locator('option[value="all"]') });
    await expect(dropdown).toBeVisible();
  });

  test('Desktop: Panel push mode', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    // Click user row
    await page.locator('table tbody tr').first().click();
    await page.waitForTimeout(400);

    // Verify panel width
    const panel = page.locator('[class*="fixed"][class*="right-0"]');
    const box = await panel.boundingBox();
    expect(box?.width).toBe(440);

    // Verify no backdrop
    await expect(page.locator('.fixed.inset-0.bg-black\\/50')).toBeHidden();
  });

  test('Mobile: Swipe to close panel', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // Open panel
    await page.locator('table tbody tr').first().click();
    await page.waitForTimeout(400);

    // Simulate swipe gesture (requires touch events)
    const panel = page.locator('[class*="fixed"][class*="right-0"]');
    await panel.dispatchEvent('touchstart', {
      touches: [{ clientX: 300, clientY: 300 }]
    });
    await panel.dispatchEvent('touchmove', {
      touches: [{ clientX: 450, clientY: 300 }]
    });
    await panel.dispatchEvent('touchend', {});

    // Verify panel closed
    await expect(page.getByText('Profile Details')).not.toBeVisible({ timeout: 5000 });
  });
});
```

---

## Success Criteria

✅ **All responsive breakpoints function correctly** without layout breaks
✅ **Touch interactions work smoothly** on mobile devices
✅ **Filter transformations** (buttons ↔ dropdown) occur at correct breakpoints
✅ **Panel behavior** switches correctly between overlay and push modes
✅ **Table columns** show/hide appropriately based on viewport width
✅ **Pagination controls** remain usable and properly sized on all screens
✅ **Animations** are smooth and performant (60fps)
✅ **No horizontal scrolling** occurs at any standard viewport size
✅ **Touch targets** meet WCAG guidelines (minimum 44x44px)
✅ **Content remains readable** at all breakpoints

---

## Known Issues & Limitations

### Current Implementation Notes:

1. **Level Column Breakpoint**: Uses `md:` breakpoint (768px), visible on tablet
2. **Period Filter Dropdown**: Only shows on mobile (<640px), desktop/tablet use buttons
3. **Panel Swipe Gesture**: Only available in mobile overlay mode, not on desktop/tablet
4. **Badge Grid Compression**: On very narrow screens (<350px), badges may become cramped
5. **Country Name Truncation**: Very long country names may truncate in ticker

### Recommended Future Improvements:

- Consider making Level column hidden on small tablets (640-767px range)
- Add landscape mode optimizations for mobile devices
- Implement horizontal scroll for table on extremely narrow screens (< 320px)
- Add progressive web app touch gesture hints for first-time users
- Enhance badge grid for ultra-wide screens (>1920px)

---

## Test Data Requirements

### Minimum Test Data:
- **20+ users** with various ranks
- **3+ countries** represented
- **All CCplan tiers** (Max, Pro, Free)
- **Mix of avatar types** (uploaded images and gradient initials)
- **Users with 0-10+ badges**
- **Users with and without social links**
- **Various display name lengths** (short and long)
- **Current user must have rank** for "My Rank" button testing

---

## Appendix: CSS Breakpoint Reference

```css
/* Tailwind Breakpoints Used */
sm: 640px   /* Tablet start - filter buttons appear */
md: 768px   /* Tablet mid - level column appears */
lg: 1024px  /* Desktop start - full text labels */
xl: 1280px  /* Large desktop - maximum spacing */

/* Custom Breakpoints in Code */
Mobile:        < 640px  (isMobile = width < 640)
Tablet:        640-1039px (isTabletPortrait = width >= 640 && width < 1040)
Desktop:       >= 1040px (panel push mode activates)

/* Panel Width Logic */
Mobile:        calc(100% - 56px) - Overlay mode
Tablet:        320px - Push mode
Desktop:       440px - Push mode
```

---

**Test Plan Version**: 1.0
**Last Updated**: 2026-01-12
**Author**: Claude Code
**Review Status**: Ready for execution
