# CCgather News Page - Responsive UI Test Plan

## Application Overview

The CCgather News Page (`/news`) is a comprehensive information hub that aggregates Claude Code updates, changelogs, beginner tutorials, official announcements, and press coverage. The page features a responsive grid-based layout that adapts across mobile, tablet, and desktop viewports.

### Page Structure

The news page consists of five main sections:

1. **Changelog Section**: Displays latest version releases with version cards in a responsive grid (1→2→3→4 columns)
2. **Highlights Subsection**: Shows featured changelog items in a responsive grid (2→3→4→5 columns)
3. **FOR BEGINNERS Section**: Features beginner-friendly tutorials and guides (2→3→4→5 columns)
4. **Anthropic Official Section**: Displays official announcements in a full-width card layout
5. **Press News Section**: Shows media coverage in a responsive grid (1→2→3→4 columns)

### Responsive Breakpoints

- **Mobile**: 375px (iPhone SE) - Base mobile experience
- **Tablet**: 768px (iPad) - Medium screen layout
- **Desktop**: 1280px - Large screen experience
- **Intermediate Breakpoints**: 640px (sm), 1024px (lg), 1536px (xl)

### Design Characteristics

- Dark theme with glass-morphism effects (border-white/10, bg-white/[0.02])
- Hover states with color transitions and border highlights
- Icon-based section headers with contextual colors
- Consistent spacing and typography across breakpoints
- Full-width container with responsive padding (px-4 → px-6 → px-8)

## Test Scenarios

### 1. Changelog Section Grid Layout

**Seed:** `tests/e2e/seed-news-responsive.spec.ts`

#### 1.1 Mobile Layout (375px)
**Steps:**
1. Set viewport to 375px width
2. Navigate to `/news`
3. Scroll to Changelog section
4. Verify version cards layout

**Expected Results:**
- Changelog section displays with header and "View all" link aligned horizontally
- Version cards arrange in single column (grid-cols-1)
- Each version card displays:
  - Version badge (e.g., "v2.1.4") with green background
  - Release type badge (PATCH/MINOR/MAJOR) aligned to right
  - Change count and highlight count (⭐) below badges
  - "View details" link with arrow icon
- Card spacing is 12px (gap-3)
- All cards have equal width and proper padding (p-4)

#### 1.2 Small Tablet Layout (640px - sm breakpoint)
**Steps:**
1. Set viewport to 640px width
2. Navigate to `/news`
3. Scroll to Changelog section
4. Verify grid transition

**Expected Results:**
- Version cards transition to 2-column grid (sm:grid-cols-2)
- Cards maintain aspect ratio and padding
- Gap between cards remains 12px
- No horizontal overflow
- Header and "View all" link remain properly aligned

#### 1.3 Medium Tablet Layout (768px - md breakpoint)
**Steps:**
1. Set viewport to 768px width
2. Navigate to `/news`
3. Scroll to Changelog section
4. Verify grid expansion

**Expected Results:**
- Version cards arrange in 3-column grid (md:grid-cols-3)
- Each card maintains hover states (border-green-500/30 on hover)
- Text content remains readable without wrapping issues
- Section padding increases appropriately

#### 1.4 Desktop Layout (1280px - xl breakpoint)
**Steps:**
1. Set viewport to 1280px width
2. Navigate to `/news`
3. Scroll to Changelog section
4. Verify full desktop layout

**Expected Results:**
- Version cards display in 4-column grid (xl:grid-cols-4)
- Maximum container width applies (max-w-7xl)
- Horizontal padding increases to px-8
- All interactive elements remain accessible
- Card hover effects work smoothly

#### 1.5 Changelog Grid - No Content State
**Steps:**
1. Set viewport to 768px width
2. Mock empty versions array response
3. Navigate to `/news`
4. Verify empty state display

**Expected Results:**
- Empty state message displays: "Changelog coming soon"
- History icon shows centered with reduced opacity
- Container has proper styling (bg-white/[0.02], border-white/10)
- Empty state is vertically centered with py-6 padding

### 2. Highlights Subsection Grid Layout

**Seed:** `tests/e2e/seed-news-responsive.spec.ts`

#### 2.1 Mobile Layout (375px)
**Steps:**
1. Set viewport to 375px width
2. Navigate to `/news`
3. Scroll to Recent Highlights subsection under Changelog
4. Verify highlights display

**Expected Results:**
- Section header displays "Recent Highlights" with Sparkles icon
- Highlight cards arrange in 2-column grid (grid-cols-2)
- Each highlight card shows:
  - Sparkles icon with version number
  - Title text (line-clamp-2 truncation)
  - Overview text (line-clamp-2 truncation) if available
- Card spacing is 8px (gap-2)
- Hover effect changes border to yellow-500/30

#### 2.2 Tablet Layout (768px - md breakpoint)
**Steps:**
1. Set viewport to 768px width
2. Navigate to `/news`
3. Verify highlights grid transition

**Expected Results:**
- Highlight cards transition to 3-column grid (md:grid-cols-3)
- All 4 highlight cards display (if available)
- Text truncation works properly
- Cards maintain equal height

#### 2.3 Large Tablet Layout (1024px - lg breakpoint)
**Steps:**
1. Set viewport to 1024px width
2. Navigate to `/news`
3. Verify 4-column layout

**Expected Results:**
- Highlight cards arrange in 4-column grid (lg:grid-cols-4)
- Gap spacing remains 8px
- All cards fit within container without overflow

#### 2.4 Desktop Layout (1280px - xl breakpoint)
**Steps:**
1. Set viewport to 1280px width
2. Navigate to `/news`
3. Verify maximum grid expansion

**Expected Results:**
- Highlight cards display in 5-column grid (xl:grid-cols-5)
- All cards have equal width
- Hover states work on all cards
- Text content remains readable

#### 2.5 Highlights - Partial Content Display
**Steps:**
1. Set viewport to 768px width
2. Mock response with only 2 highlight items
3. Navigate to `/news`
4. Verify partial grid display

**Expected Results:**
- Grid displays 2 cards properly aligned
- Empty grid cells don't show placeholder content
- Cards don't stretch to fill entire row width unnaturally
- Grid maintains proper spacing

### 3. FOR BEGINNERS Section Grid Layout

**Seed:** `tests/e2e/seed-news-responsive.spec.ts`

#### 3.1 Mobile Layout (375px)
**Steps:**
1. Set viewport to 375px width
2. Navigate to `/news`
3. Scroll to FOR BEGINNERS section
4. Verify beginner cards layout

**Expected Results:**
- Section header displays "FOR BEGINNERS" with BookOpen icon
- "View dictionary" link appears on right side
- Beginner cards arrange in 2-column grid (grid-cols-2)
- Each card displays:
  - Category icon (BookOpen) with colored badge
  - Category label (session/agents/speed)
  - Command name as heading (e.g., "/teleport")
  - Description text (line-clamp-2)
- Card spacing is 8px (gap-2)
- Hover effect changes border to blue-500/30

#### 3.2 Tablet Layout (768px - md breakpoint)
**Steps:**
1. Set viewport to 768px width
2. Navigate to `/news`
3. Verify beginners grid expansion

**Expected Results:**
- Beginner cards transition to 3-column grid (md:grid-cols-3)
- All 4 featured items display (if available)
- Category badges remain visible and properly styled
- Text truncation maintains readability

#### 3.3 Large Tablet Layout (1024px - lg breakpoint)
**Steps:**
1. Set viewport to 1024px width
2. Navigate to `/news`
3. Verify 4-column layout

**Expected Results:**
- Beginner cards arrange in 4-column grid (lg:grid-cols-4)
- Cards maintain equal height
- All text content remains visible
- Icons and badges properly aligned

#### 3.4 Desktop Layout (1280px - xl breakpoint)
**Steps:**
1. Set viewport to 1280px width
2. Navigate to `/news`
3. Verify maximum grid expansion

**Expected Results:**
- Beginner cards display in 5-column grid (xl:grid-cols-5)
- Hover states work smoothly
- Links to beginner detail pages remain functional
- Category colors remain distinct (blue-500/20 backgrounds)

#### 3.5 Beginners - Empty State
**Steps:**
1. Set viewport to 768px width
2. Mock empty beginners array response
3. Navigate to `/news`
4. Verify empty state display

**Expected Results:**
- Empty state shows: "Beginner's guide coming soon"
- BookOpen icon displays centered with reduced opacity
- Container maintains proper styling
- Section header remains visible

### 4. Anthropic Official Section Layout

**Seed:** `tests/e2e/seed-news-responsive.spec.ts`

#### 4.1 Mobile Layout (375px)
**Steps:**
1. Set viewport to 375px width
2. Navigate to `/news`
3. Scroll to Anthropic Official section
4. Verify card layout

**Expected Results:**
- Section header displays "Anthropic Official" with Building2 icon
- Official news cards stack vertically (space-y-3)
- Each card (OfficialNewsCard component) displays:
  - Thumbnail image (if available)
  - Source badge and published date
  - Title text
  - Summary/description text
- Cards have full width
- Spacing between cards is 12px

#### 4.2 Tablet Layout (768px)
**Steps:**
1. Set viewport to 768px width
2. Navigate to `/news`
3. Verify official news card display

**Expected Results:**
- Cards continue stacking vertically (not grid layout)
- Card width adapts to container
- Text content scales appropriately
- Images maintain aspect ratio
- Hover effects remain functional

#### 4.3 Desktop Layout (1280px)
**Steps:**
1. Set viewport to 1280px width
2. Navigate to `/news`
3. Verify full-width card layout

**Expected Results:**
- Official news cards maintain vertical stack layout
- Maximum container width applies
- Card content is well-spaced and readable
- No horizontal scrolling occurs
- Links to full articles work correctly

#### 4.4 Official News - Empty State
**Steps:**
1. Set viewport to 768px width
2. Mock empty official news array
3. Navigate to `/news`
4. Verify empty state display

**Expected Results:**
- Empty state shows: "No official announcements yet"
- Building2 icon displays centered
- Empty state container has proper styling
- Section header remains visible with icon and subtitle

#### 4.5 Official News - Multiple Cards
**Steps:**
1. Set viewport to 768px width
2. Mock response with 5 official news items
3. Navigate to `/news`
4. Verify card stacking behavior

**Expected Results:**
- All 5 cards display in vertical stack
- Spacing between cards is consistent (12px)
- No layout shift or overflow
- All cards are fully visible without truncation

### 5. Press News Section Grid Layout

**Seed:** `tests/e2e/seed-news-responsive.spec.ts`

#### 5.1 Mobile Layout (375px)
**Steps:**
1. Set viewport to 375px width
2. Navigate to `/news`
3. Scroll to Press News section
4. Verify press news cards layout

**Expected Results:**
- Section header displays "Press News" with Newspaper icon
- Press news cards arrange in single column (grid-cols-1)
- Each card (PressNewsCard component) displays:
  - Source link with external icon
  - Published date with clock icon
  - Article title (line-clamp-2)
  - Summary text (line-clamp-2)
- Card spacing is 12px (gap-3)
- Hover effects change border and text colors

#### 5.2 Small Tablet Layout (640px - sm breakpoint)
**Steps:**
1. Set viewport to 640px width
2. Navigate to `/news`
3. Verify press news grid transition

**Expected Results:**
- Press news cards transition to 2-column grid (sm:grid-cols-2)
- Cards maintain equal height within rows
- Source badges remain visible
- Text truncation works properly

#### 5.3 Large Tablet Layout (1024px - lg breakpoint)
**Steps:**
1. Set viewport to 1024px width
2. Navigate to `/news`
3. Verify 3-column layout

**Expected Results:**
- Press news cards arrange in 3-column grid (lg:grid-cols-3)
- All cards fit without horizontal overflow
- Hover states work on all cards
- External links maintain proper spacing

#### 5.4 Desktop Layout (1280px - xl breakpoint)
**Steps:**
1. Set viewport to 1280px width
2. Navigate to `/news`
3. Verify maximum grid expansion

**Expected Results:**
- Press news cards display in 4-column grid (xl:grid-cols-4)
- Grid displays up to 9 press news items (as per limit)
- All cards have consistent styling
- Links to external sources work correctly

#### 5.5 Press News - Fallback Static Content
**Steps:**
1. Set viewport to 768px width
2. Mock scenario where database has no content (hasDbContent = false)
3. Navigate to `/news`
4. Verify fallback to NEWS_ARTICLES data

**Expected Results:**
- Press news section displays static fallback articles from NEWS_ARTICLES
- NewsCard component renders instead of PressNewsCard
- Cards maintain same grid layout (1→2→3→4 columns)
- All fallback articles display properly
- External links work correctly

### 6. Section Headers and Navigation Elements

**Seed:** `tests/e2e/seed-news-responsive.spec.ts`

#### 6.1 Header Alignment - Mobile (375px)
**Steps:**
1. Set viewport to 375px width
2. Navigate to `/news`
3. Inspect all section headers

**Expected Results:**
- Each section header displays:
  - Icon in colored background container (p-2 rounded-lg)
  - Section title text
  - Subtitle text in smaller font
- "View all" links appear on same line as headers
- Headers use flex layout with space-between justification
- Icons and text properly aligned vertically

#### 6.2 Header Alignment - Tablet (768px)
**Steps:**
1. Set viewport to 768px width
2. Navigate to `/news`
3. Verify header scaling

**Expected Results:**
- Header text sizes increase (text-sm → text-base)
- Icon sizes remain consistent
- "View all" links remain visible and aligned
- No text wrapping in section titles

#### 6.3 Header Alignment - Desktop (1280px)
**Steps:**
1. Set viewport to 1280px width
2. Navigate to `/news`
3. Verify full desktop header display

**Expected Results:**
- All section headers properly spaced
- Icon containers maintain consistent sizing
- Text scales appropriately
- Hover effects on "View all" links work smoothly

#### 6.4 "View all" Link Functionality
**Steps:**
1. Set viewport to 768px width
2. Navigate to `/news`
3. Test each "View all" link

**Expected Results:**
- Changelog "View all" links to `/news/changelog`
- FOR BEGINNERS "View dictionary" links to `/news/beginners`
- Links have hover state (text-muted → color transition)
- Arrow icons display next to link text
- Links are keyboard accessible (Tab navigation)

#### 6.5 Section Color Consistency
**Steps:**
1. Set viewport to 768px width
2. Navigate to `/news`
3. Verify color coding across sections

**Expected Results:**
- Changelog: Green theme (bg-green-500/10, text-green-400)
- Highlights: Yellow theme (text-yellow-400)
- FOR BEGINNERS: Blue theme (bg-blue-500/10, text-blue-400)
- Anthropic Official: Orange theme (bg-orange-500/10, text-orange-400)
- Press News: Purple theme (bg-purple-500/10, text-purple-400)
- Colors remain consistent across all breakpoints

### 7. Page Header and Container Behavior

**Seed:** `tests/e2e/seed-news-responsive.spec.ts`

#### 7.1 Page Header - Mobile (375px)
**Steps:**
1. Set viewport to 375px width
2. Navigate to `/news`
3. Verify main page header

**Expected Results:**
- Page title "News & Updates" displays at text-2xl
- Subtitle "Stay updated with Claude Code releases..." displays below
- Header has bottom margin (mb-8)
- Container padding is px-4
- No horizontal overflow

#### 7.2 Page Header - Tablet (768px - md breakpoint)
**Steps:**
1. Set viewport to 768px width
2. Navigate to `/news`
3. Verify header scaling

**Expected Results:**
- Page title scales to text-3xl
- Subtitle scales to text-base
- Header margin increases (mb-10)
- Container padding increases to px-6

#### 7.3 Page Header - Desktop (1280px - xl breakpoint)
**Steps:**
1. Set viewport to 1280px width
2. Navigate to `/news`
3. Verify full desktop header

**Expected Results:**
- Page title scales to text-4xl
- Header margin increases to mb-12
- Container padding increases to px-8
- Maximum width constraint applies (max-w-7xl)
- Content is horizontally centered

#### 7.4 Container Vertical Spacing
**Steps:**
1. Set viewport to 768px width
2. Navigate to `/news`
3. Scroll through entire page
4. Measure spacing between sections

**Expected Results:**
- Page top/bottom padding: py-8 (mobile) → py-10 (md) → py-12 (xl)
- Section spacing: mb-10 (mobile) → mb-12 (xl)
- Consistent vertical rhythm throughout page
- No layout shift when resizing viewport

#### 7.5 Maximum Width and Centering
**Steps:**
1. Set viewport to 1920px width (ultra-wide)
2. Navigate to `/news`
3. Verify content centering

**Expected Results:**
- Content container limited to max-w-7xl (1280px)
- Content is horizontally centered (mx-auto)
- Equal whitespace on left and right sides
- All sections maintain centered alignment

### 8. Hover States and Interactions

**Seed:** `tests/e2e/seed-news-responsive.spec.ts`

#### 8.1 Card Hover States - Desktop
**Steps:**
1. Set viewport to 1280px width
2. Navigate to `/news`
3. Hover over each card type

**Expected Results:**
- Version cards: border-white/10 → border-green-500/30, bg increases opacity
- Highlight cards: border changes to border-yellow-500/30
- Beginner cards: border changes to border-blue-500/30
- Press news cards: border changes, text-primary color transition
- All hover transitions are smooth (transition-all)

#### 8.2 Link Hover States
**Steps:**
1. Set viewport to 1280px width
2. Navigate to `/news`
3. Hover over various links

**Expected Results:**
- "View all" links: text-muted → specific color (green-400, blue-400)
- Card titles: change to accent color on hover
- External source links: include hover color transition
- All transitions are visible and smooth

#### 8.3 Touch Interactions - Mobile
**Steps:**
1. Set viewport to 375px width (simulate touch device)
2. Navigate to `/news`
3. Tap on cards and links

**Expected Results:**
- Cards are tappable with adequate touch target size (min 44x44px)
- No accidental activations from small touch areas
- Active/pressed states provide visual feedback
- Links navigate correctly on tap

#### 8.4 Keyboard Navigation
**Steps:**
1. Set viewport to 1280px width
2. Navigate to `/news`
3. Use Tab key to navigate through page

**Expected Results:**
- All interactive elements are keyboard accessible
- Focus indicators are visible on focused elements
- Tab order follows logical reading order
- Enter key activates links and buttons

#### 8.5 Focus States
**Steps:**
1. Set viewport to 1280px width
2. Navigate to `/news` using keyboard
3. Tab through all interactive elements

**Expected Results:**
- Visible focus outlines on all focusable elements
- Focus indicators have sufficient contrast
- Focus order matches visual layout
- No focus traps

### 9. Content Loading and Empty States

**Seed:** `tests/e2e/seed-news-responsive.spec.ts`

#### 9.1 All Sections Empty
**Steps:**
1. Set viewport to 768px width
2. Mock all data arrays as empty
3. Navigate to `/news`
4. Verify all empty states display

**Expected Results:**
- Changelog shows: "Changelog coming soon" with History icon
- FOR BEGINNERS shows: "Beginner's guide coming soon" with BookOpen icon
- Anthropic Official shows: "No official announcements yet" with Building2 icon
- Press News shows fallback static content (NEWS_ARTICLES)
- All empty states have consistent styling
- Section headers remain visible

#### 9.2 Partial Content Loading
**Steps:**
1. Set viewport to 768px width
2. Mock mixed scenario (some sections with data, some empty)
3. Navigate to `/news`
4. Verify mixed state display

**Expected Results:**
- Sections with data display normally
- Empty sections show appropriate empty states
- No layout shift between populated and empty sections
- Page remains visually balanced

#### 9.3 Loading State Behavior
**Steps:**
1. Set viewport to 768px width
2. Navigate to `/news` with slow network
3. Observe loading behavior

**Expected Results:**
- Page waits for data before rendering sections
- No flash of empty content before data loads
- Loading state is handled gracefully
- No console errors during loading

#### 9.4 Error Handling
**Steps:**
1. Set viewport to 768px width
2. Mock API error responses
3. Navigate to `/news`
4. Verify error state handling

**Expected Results:**
- Page handles errors gracefully (try/catch blocks)
- Empty arrays returned on error: `{ versions: [], highlights: [], beginners: [], official: [], press: [] }`
- Empty states display instead of error messages
- Page remains functional with fallback content

#### 9.5 Data Limits Respected
**Steps:**
1. Set viewport to 768px width
2. Mock large data responses exceeding limits
3. Navigate to `/news`
4. Verify data limiting

**Expected Results:**
- Changelog: Maximum 3 versions displayed (limit(3))
- Highlights: Maximum 4 items displayed (limit(4))
- Beginners: Maximum 4 featured items (limit(4))
- Official News: Maximum 5 items (limit(5))
- Press News: Maximum 9 items (limit(9))
- No pagination controls visible

### 10. Typography and Text Truncation

**Seed:** `tests/e2e/seed-news-responsive.spec.ts`

#### 10.1 Title Text Truncation - Mobile
**Steps:**
1. Set viewport to 375px width
2. Navigate to `/news`
3. Inspect card titles across all sections

**Expected Results:**
- Highlight card titles: line-clamp-2 (max 2 lines)
- Press news titles: line-clamp-2 (max 2 lines)
- Long titles show ellipsis (...) after 2 lines
- Titles remain readable without text overlap

#### 10.2 Description Text Truncation
**Steps:**
1. Set viewport to 375px width
2. Navigate to `/news`
3. Inspect description text in cards

**Expected Results:**
- Highlight overviews: line-clamp-2
- Beginner descriptions: line-clamp-2
- Press news summaries: line-clamp-2
- Text truncation works consistently
- Ellipsis appears when content exceeds limit

#### 10.3 Font Size Scaling - Across Breakpoints
**Steps:**
1. Test at 375px, 768px, and 1280px widths
2. Navigate to `/news`
3. Compare font sizes across viewports

**Expected Results:**
- Page header: text-2xl → text-3xl → text-4xl
- Section headers: text-sm remains consistent
- Card titles: text-sm remains consistent
- Body text: text-[11px] to text-[10px] remains small
- Font scaling is appropriate for viewport

#### 10.4 Text Readability - Dark Theme
**Steps:**
1. Set viewport to 768px width
2. Ensure dark theme is active
3. Navigate to `/news`
4. Verify text contrast

**Expected Results:**
- Primary text: var(--color-text-primary) has sufficient contrast
- Secondary text: text-text-secondary is readable
- Muted text: text-text-muted is distinguishable
- All text meets WCAG AA contrast standards
- Hover states improve text visibility

#### 10.5 Monospace Font Usage
**Steps:**
1. Set viewport to 768px width
2. Navigate to `/news`
3. Identify monospace text elements

**Expected Results:**
- Version numbers use font-mono (e.g., "v2.1.4")
- Version badges in highlights use font-mono
- Monospace font is consistently applied
- Font fallback works if custom font unavailable

### 11. Image and Icon Display

**Seed:** `tests/e2e/seed-news-responsive.spec.ts`

#### 11.1 Section Header Icons
**Steps:**
1. Set viewport to 768px width
2. Navigate to `/news`
3. Verify all section header icons

**Expected Results:**
- Changelog: History icon (w-4 h-4, text-green-400)
- Highlights: Sparkles icon (w-3 h-3, text-yellow-400)
- FOR BEGINNERS: BookOpen icon (w-4 h-4, text-blue-400)
- Anthropic Official: Building2 icon (w-4 h-4, text-orange-400)
- Press News: Newspaper icon (w-4 h-4, text-purple-400)
- All icons render correctly with proper sizing

#### 11.2 Card Icons
**Steps:**
1. Set viewport to 768px width
2. Navigate to `/news`
3. Verify icons within cards

**Expected Results:**
- ArrowRight icons in "View details" links (w-3 h-3)
- Clock icons in press news dates (w-2.5 h-2.5)
- ExternalLink icons in source links (w-2.5 h-2.5)
- All icons maintain proper alignment with text
- Icon colors match their context

#### 11.3 Empty State Icons
**Steps:**
1. Set viewport to 768px width
2. Mock empty data responses
3. Navigate to `/news`
4. Verify empty state icons

**Expected Results:**
- Empty state icons are larger (w-6 h-6)
- Icons have reduced opacity (opacity-40)
- Icons are centered horizontally
- Icons appear above empty state text

#### 11.4 Icon Responsiveness
**Steps:**
1. Test at 375px, 768px, and 1280px widths
2. Navigate to `/news`
3. Verify icon sizing across breakpoints

**Expected Results:**
- Icon sizes remain consistent across breakpoints
- Icons don't distort or pixelate
- Icons maintain proper spacing from text
- No layout shift caused by icon rendering

#### 11.5 Thumbnail Images (Official News)
**Steps:**
1. Set viewport to 768px width
2. Mock official news with thumbnail images
3. Navigate to `/news`
4. Verify image display

**Expected Results:**
- Thumbnails load properly in OfficialNewsCard
- Images maintain aspect ratio
- Images have proper fallback if loading fails
- Images don't cause layout shift

### 12. Accessibility and Semantic HTML

**Seed:** `tests/e2e/seed-news-responsive.spec.ts`

#### 12.1 Heading Hierarchy
**Steps:**
1. Set viewport to 768px width
2. Navigate to `/news`
3. Verify heading structure

**Expected Results:**
- Page title is `<h1>`: "News & Updates"
- Section titles are `<h2>`: "Changelog", "FOR BEGINNERS", etc.
- Highlights subsection is `<h3>`: "Recent Highlights"
- Card titles are `<h3>` where appropriate
- No skipped heading levels

#### 12.2 Semantic HTML Elements
**Steps:**
1. Set viewport to 768px width
2. Navigate to `/news`
3. Inspect page structure

**Expected Results:**
- Sections use `<section>` tags
- Header uses `<header>` tag
- News cards use `<article>` tags
- Navigation links use `<nav>` or proper `<a>` tags
- Proper semantic structure throughout

#### 12.3 ARIA Labels and Roles
**Steps:**
1. Set viewport to 768px width
2. Navigate to `/news`
3. Verify ARIA attributes

**Expected Results:**
- Icons have appropriate aria-hidden or aria-label
- Links have descriptive text or aria-label
- Interactive elements have proper roles
- Screen reader navigation is logical

#### 12.4 Keyboard Navigation Order
**Steps:**
1. Set viewport to 768px width
2. Navigate to `/news` using keyboard
3. Tab through entire page

**Expected Results:**
- Tab order follows visual layout top to bottom
- No trapped focus
- All interactive elements are reachable
- Skip to content option available (if implemented)

#### 12.5 Color Contrast Compliance
**Steps:**
1. Set viewport to 768px width
2. Navigate to `/news`
3. Test color contrast ratios

**Expected Results:**
- All text meets WCAG AA standards (4.5:1 for normal, 3:1 for large)
- Interactive elements have sufficient contrast
- Hover/focus states improve contrast
- Color is not the only means of conveying information

### 13. Performance and Optimization

**Seed:** `tests/e2e/seed-news-responsive.spec.ts`

#### 13.1 Initial Page Load
**Steps:**
1. Set viewport to 768px width
2. Clear browser cache
3. Navigate to `/news`
4. Measure load time

**Expected Results:**
- Page loads within 3 seconds on standard connection
- No layout shift during load (CLS < 0.1)
- Content renders progressively
- Critical CSS loads first

#### 13.2 Image Loading Performance
**Steps:**
1. Set viewport to 768px width
2. Navigate to `/news`
3. Monitor image loading

**Expected Results:**
- Images use lazy loading where appropriate
- Thumbnails are optimized file sizes
- Images have width/height attributes to prevent layout shift
- No excessive image downloads

#### 13.3 Responsive Image Strategy
**Steps:**
1. Test at 375px, 768px, and 1280px widths
2. Navigate to `/news`
3. Monitor network requests

**Expected Results:**
- Appropriate image sizes loaded for viewport
- No unnecessary large images on mobile
- Images use modern formats (WebP with fallback)
- srcset attributes used where applicable

#### 13.4 CSS Performance
**Steps:**
1. Set viewport to 768px width
2. Navigate to `/news`
3. Inspect CSS delivery

**Expected Results:**
- Tailwind CSS is optimized and purged
- No unused CSS in production bundle
- Critical CSS inlined
- CSS file size is reasonable (< 50KB)

#### 13.5 JavaScript Performance
**Steps:**
1. Set viewport to 768px width
2. Navigate to `/news`
3. Monitor JavaScript execution

**Expected Results:**
- Minimal JavaScript required for initial render (SSR/SSG)
- Hydration is fast (< 1 second)
- No blocking JavaScript
- Interactive elements respond quickly

### 14. Cross-Browser Compatibility

**Seed:** `tests/e2e/seed-news-responsive.spec.ts`

#### 14.1 Chrome/Chromium Rendering
**Steps:**
1. Set viewport to 768px width
2. Open `/news` in Chrome
3. Verify all layouts and interactions

**Expected Results:**
- All grid layouts render correctly
- Hover states work properly
- CSS custom properties render correctly
- No console errors

#### 14.2 Firefox Rendering
**Steps:**
1. Set viewport to 768px width
2. Open `/news` in Firefox
3. Verify rendering consistency

**Expected Results:**
- Layout matches Chrome rendering
- Grid gaps are consistent
- Flexbox layouts work identically
- Font rendering is acceptable

#### 14.3 Safari Rendering
**Steps:**
1. Set viewport to 768px width
2. Open `/news` in Safari
3. Verify WebKit compatibility

**Expected Results:**
- Backdrop filters work correctly (glass-morphism)
- Grid layouts render properly
- Transitions and animations work
- No webkit-specific issues

#### 14.4 Mobile Browser Rendering (iOS Safari)
**Steps:**
1. Set viewport to 375px width
2. Open `/news` on iPhone Safari
3. Test mobile interactions

**Expected Results:**
- Touch targets are adequate (min 44x44px)
- No horizontal scrolling
- Smooth scrolling behavior
- Pinch-to-zoom disabled where appropriate

#### 14.5 Mobile Browser Rendering (Android Chrome)
**Steps:**
1. Set viewport to 375px width
2. Open `/news` on Android Chrome
3. Test mobile experience

**Expected Results:**
- Layout matches iOS rendering
- Touch interactions work smoothly
- No performance issues
- Viewport meta tag configured correctly

### 15. Edge Cases and Boundary Conditions

**Seed:** `tests/e2e/seed-news-responsive.spec.ts`

#### 15.1 Very Long Titles
**Steps:**
1. Set viewport to 768px width
2. Mock data with extremely long titles (200+ characters)
3. Navigate to `/news`
4. Verify truncation

**Expected Results:**
- Titles truncate with line-clamp-2
- Ellipsis appears correctly
- No text overflow beyond container
- Layout remains intact

#### 15.2 Missing Optional Data
**Steps:**
1. Set viewport to 768px width
2. Mock data with null/undefined optional fields
3. Navigate to `/news`
4. Verify graceful handling

**Expected Results:**
- Cards render without optional fields (e.g., overview, thumbnail)
- No console errors
- Layout adjusts appropriately
- No blank spaces for missing content

#### 15.3 Special Characters in Content
**Steps:**
1. Set viewport to 768px width
2. Mock data with special characters (emoji, Unicode, HTML entities)
3. Navigate to `/news`
4. Verify proper rendering

**Expected Results:**
- Special characters render correctly
- Emojis display properly (⭐ for highlights)
- No HTML injection vulnerabilities
- Text encoding is correct (UTF-8)

#### 15.4 Very Small Viewport (320px)
**Steps:**
1. Set viewport to 320px width (older iPhone SE)
2. Navigate to `/news`
3. Verify minimum width support

**Expected Results:**
- Page renders without horizontal scroll
- Text remains readable
- Buttons and links are still tappable
- Grid layouts adapt (may stay at mobile layout)

#### 15.5 Very Large Viewport (2560px)
**Steps:**
1. Set viewport to 2560px width (4K monitor)
2. Navigate to `/news`
3. Verify maximum width behavior

**Expected Results:**
- Content respects max-w-7xl constraint (1280px)
- Content remains centered
- No excessive whitespace within content
- Layout doesn't appear stretched

### 16. Navigation and Routing

**Seed:** `tests/e2e/seed-news-responsive.spec.ts`

#### 16.1 Internal Link Navigation
**Steps:**
1. Set viewport to 768px width
2. Navigate to `/news`
3. Click "View all" for Changelog

**Expected Results:**
- Browser navigates to `/news/changelog`
- URL updates correctly
- Back button returns to `/news`
- No page refresh (client-side navigation)

#### 16.2 Card Link Navigation
**Steps:**
1. Set viewport to 768px width
2. Navigate to `/news`
3. Click on a version card (e.g., v2.1.4)

**Expected Results:**
- Browser navigates to `/news/changelog/v2-1-4`
- Correct version detail page loads
- Navigation is smooth
- Browser history is maintained

#### 16.3 External Link Navigation
**Steps:**
1. Set viewport to 768px width
2. Navigate to `/news`
3. Click external source link in press news

**Expected Results:**
- Link opens in new tab (target="_blank")
- Original page remains open
- Security attributes present (rel="noopener noreferrer")
- External icon indicates new tab behavior

#### 16.4 Beginner Dictionary Navigation
**Steps:**
1. Set viewport to 768px width
2. Navigate to `/news`
3. Click "View dictionary" link

**Expected Results:**
- Browser navigates to `/news/beginners`
- Beginners dictionary page loads
- Navigation history preserved
- Back button returns to `/news`

#### 16.5 Deep Link Support
**Steps:**
1. Set viewport to 768px width
2. Directly navigate to `/news` with URL parameters
3. Verify page renders correctly

**Expected Results:**
- Page renders normally regardless of entry point
- No errors on direct URL access
- Server-side rendering works for SEO
- Meta tags are correctly set

## Test Execution Strategy

### Recommended Test Approach

1. **Prioritization**: Execute scenarios in order by section (1-16), focusing on critical layout tests first (scenarios 1-5)
2. **Automation**: Automate grid layout tests, viewport transitions, and empty state handling
3. **Manual Testing**: Manually verify visual design quality, color contrast, and cross-browser rendering
4. **Performance**: Use Lighthouse and Playwright performance APIs for scenario 13
5. **Accessibility**: Use axe-core or similar tools for WCAG compliance testing (scenario 12)

### Test Data Requirements

- **Minimal Set**: 3 versions, 4 highlights, 4 beginners, 0 official, 3 press articles
- **Full Set**: 3 versions, 4 highlights, 4 beginners, 5 official, 9 press articles
- **Empty Set**: All arrays empty to test empty states
- **Mixed Set**: Some sections populated, others empty

### Environment Setup

- **Local Development**: `http://localhost:3002/news` with dev server running
- **Viewport Emulation**: Use Playwright's `setViewportSize()` for consistent testing
- **Theme**: Test in dark mode (default) primarily, light mode secondarily
- **Browser**: Chromium (primary), Firefox, WebKit (secondary)

### Success Criteria

- **Layout Integrity**: No horizontal scroll, no overlapping elements, proper grid transitions
- **Responsive Behavior**: Correct column counts at each breakpoint
- **Content Display**: All text readable, images load correctly, no broken links
- **Performance**: Page load < 3s, LCP < 2.5s, CLS < 0.1
- **Accessibility**: WCAG AA compliance, keyboard navigable, screen reader friendly
- **Cross-Browser**: Consistent rendering across Chrome, Firefox, Safari

## Known Issues and Considerations

1. **Highlights Grid**: With only 4 items, the 5-column layout (xl:grid-cols-5) may look sparse at ultra-wide viewports
2. **Empty States**: Only Press News has fallback content; other sections rely on empty state messages
3. **Official News**: Uses vertical stack instead of grid layout at all breakpoints
4. **Text Truncation**: line-clamp-2 may cut off important information; consider tooltip on hover
5. **Touch Targets**: Some small icons (2.5px × 2.5px) may be too small for comfortable tapping on mobile

## Appendix: CSS Classes Reference

### Grid Layouts
- Changelog versions: `grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4`
- Highlights: `grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`
- Beginners: `grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`
- Press News: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`

### Spacing
- Grid gaps: `gap-3` (12px) for larger cards, `gap-2` (8px) for smaller cards
- Section margins: `mb-10` (mobile) → `mb-12` (xl)
- Container padding: `px-4` → `px-6` (md) → `px-8` (xl)

### Colors
- Changelog: Green (`green-500`, `green-400`)
- Highlights: Yellow (`yellow-400`, `yellow-500`)
- Beginners: Blue (`blue-400`, `blue-500`)
- Official: Orange (`orange-400`, `orange-500`)
- Press: Purple (`purple-400`, `purple-500`)

### Typography
- Page title: `text-2xl md:text-3xl xl:text-4xl`
- Section headers: `text-sm font-semibold`
- Card titles: `text-sm font-medium`
- Body text: `text-[11px]` or `text-[10px]`
- Truncation: `line-clamp-2`
