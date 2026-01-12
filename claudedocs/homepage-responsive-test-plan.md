# CCgather Homepage - Responsive UI Test Plan

## Application Overview

The CCgather homepage is a Next.js-based landing page showcasing Claude Code usage leaderboard features. The page implements a responsive design system using Tailwind CSS with three primary breakpoints:

**Technology Stack:**
- Framework: Next.js 16 with React 19
- Styling: Tailwind CSS 4 with custom CSS variables
- Authentication: Clerk
- Animations: Framer Motion
- State: React hooks

**Responsive Breakpoints:**
- Mobile: 375px - 767px (default Tailwind: < 768px)
- Tablet: 768px - 1279px (Tailwind md breakpoint)
- Desktop: 1280px+ (Tailwind xl breakpoint)

**Key Features:**
- Fixed header with glassmorphism effect
- Hero section with CTA buttons
- Live stats ticker with country rotation
- "How it works" 3-step grid
- CLI section with 2x2 feature grid
- Footer with links

---

## Test Environment Setup

### Prerequisites
```bash
# Start development server
pnpm dev --port 3002

# Run Playwright tests
npx playwright test tests/e2e/homepage-responsive.spec.ts

# Run with UI mode for debugging
npx playwright test --ui
```

### Viewport Configurations
```typescript
// Mobile - iPhone SE
{ width: 375, height: 667 }

// Tablet - iPad
{ width: 768, height: 1024 }

// Desktop - Standard
{ width: 1280, height: 720 }

// Desktop - Large
{ width: 1920, height: 1080 }
```

---

## Test Scenarios

### Scenario 1: Header Navigation Responsive Behavior

**Objective:** Verify header navigation adapts correctly across all viewport sizes.

**Seed:** `tests/e2e/seed.spec.ts`

#### 1.1 Desktop Header (1280px+)
**Steps:**
1. Navigate to `http://localhost:3002`
2. Set viewport to 1280x720
3. Wait for page load and network idle

**Verify:**
- Header is fixed at top with glassmorphism effect (backdrop-blur-xl)
- Logo visible: CCgather logo (32x32px) + text "CCgather"
- Desktop navigation visible: "Leaderboard", "News", "Community", "CLI" links
- Right section shows: Theme switcher + "Sign In" button OR Settings icon (if logged in)
- Mobile menu button (hamburger) is hidden
- Header height is 64px (h-16)
- Navigation links have hover underline animation
- All links are horizontally aligned in center

**Expected Results:**
- Navigation links display: `md:flex` class is active
- Mobile button display: `md:hidden` hides the hamburger menu
- Theme switcher is visible and functional
- Sign In button has coral background (#E87F5E)
- Touch targets meet minimum 44x44px for buttons

#### 1.2 Tablet Header (768px)
**Steps:**
1. Navigate to `http://localhost:3002`
2. Set viewport to 768x1024
3. Wait for page load

**Verify:**
- Header layout same as desktop (md breakpoint active)
- Navigation links still visible horizontally
- Header height is 64px (h-16)
- Logo size: 32x32px (w-8 h-8)
- All elements properly spaced with gap-6

**Expected Results:**
- All desktop header features remain active at 768px
- No layout shifts or overflow
- Interactive elements maintain touch target size

#### 1.3 Mobile Header (375px)
**Steps:**
1. Navigate to `http://localhost:3002`
2. Set viewport to 375x667
3. Wait for page load

**Verify:**
- Header shows only: Logo + Mobile menu button
- Desktop navigation links are hidden
- Mobile menu button (hamburger icon) is visible top-right
- Header height is 56px (h-14)
- Logo size: 28x28px (w-7 h-7)
- Logo text "CCgather" remains visible
- Sign In button and Theme switcher are hidden from header

**Expected Results:**
- Desktop nav hidden: `hidden md:flex` hides navigation
- Mobile button visible: `md:hidden` shows hamburger menu
- Logo and menu button have adequate spacing
- No horizontal overflow or scroll

#### 1.4 Mobile Drawer Functionality
**Steps:**
1. Set viewport to 375x667
2. Navigate to homepage
3. Click mobile menu button (hamburger icon)
4. Wait for drawer animation

**Verify:**
- Drawer slides in from right side
- Drawer shows all navigation links: "Leaderboard", "News", "Community", "CLI"
- Links are vertically stacked with adequate spacing
- Theme switcher section visible at bottom
- "Sign In" button displayed full-width at bottom
- Each link has touch-friendly padding (px-4 py-3)
- Active page has highlighted background (glass effect)
- Drawer has close button or swipe gesture

**Expected Results:**
- Drawer animation smooth (Framer Motion)
- All interactive elements have min 44x44px touch targets
- Links navigate correctly when clicked
- Drawer closes after navigation
- Backdrop overlay dims page content

---

### Scenario 2: Hero Section Layout

**Objective:** Verify hero section text, buttons, and layout adapt responsively.

**Seed:** `tests/e2e/seed.spec.ts`

#### 2.1 Desktop Hero (1280px)
**Steps:**
1. Navigate to `http://localhost:3002`
2. Set viewport to 1280x720
3. Scroll to hero section (top of main content)

**Verify:**
- Container max-width: 672px (max-w-2xl) centered
- "CLAUDE CODE LEADERBOARD" label in coral color
- H1 heading: "Track your usage. Compete globally."
  - Font size: 2.25rem (text-4xl via md:text-4xl)
  - Line breaks after "usage."
  - Second line in muted color
- Description paragraph max-width: 448px (max-w-md)
- CTA buttons horizontal layout with gap-3
  - "Get Started" button (coral background)
  - "Explore" button (glass background with border)
- Buttons have equal padding: px-5 py-2.5

**Expected Results:**
- Text is center-aligned
- Heading is large and readable
- Buttons are side-by-side, not stacked
- Adequate whitespace around all elements
- No text overflow or wrapping issues

#### 2.2 Tablet Hero (768px)
**Steps:**
1. Navigate to homepage
2. Set viewport to 768x1024
3. Observe hero section

**Verify:**
- Layout same as desktop (md breakpoint active)
- H1 font size: 2.25rem (text-4xl)
- Buttons remain horizontal
- All spacing and alignment preserved

**Expected Results:**
- No layout shifts from desktop
- Text remains center-aligned and readable
- Button widths appropriate for tablet

#### 2.3 Mobile Hero (375px)
**Steps:**
1. Navigate to homepage
2. Set viewport to 375x667
3. Observe hero section

**Verify:**
- Container padding: px-6 (24px sides)
- H1 heading font size: 1.875rem (text-3xl, smaller than desktop)
- Heading text wraps naturally on two lines
- Description text remains readable
- CTA buttons maintain horizontal layout with gap-3
- Buttons auto-size to fit content, not full-width
- All text content fits within viewport width

**Expected Results:**
- H1 uses smaller text-3xl (responsive class)
- Buttons remain horizontal due to adequate space
- No horizontal scrolling required
- Touch targets are at least 44x44px

#### 2.4 CTA Button States
**Steps:**
1. Navigate to homepage at any viewport
2. Hover over "Get Started" button (desktop)
3. Tap "Get Started" button (mobile)
4. Observe hover/active states

**Verify:**
- Hover: opacity-90 transition on desktop
- Active/Press: visual feedback present
- Focus: visible focus outline for accessibility
- Disabled state: not applicable (always enabled)

**Expected Results:**
- Smooth transitions (transition-opacity)
- Button states clearly visible
- No layout shift on interaction
- Accessible focus indicators present

---

### Scenario 3: Live Stats Ticker Component

**Objective:** Verify live stats ticker displays and animates correctly at all sizes.

**Seed:** `tests/e2e/seed.spec.ts`

#### 3.1 Desktop Live Stats (1280px)
**Steps:**
1. Navigate to homepage
2. Set viewport to 1280x720
3. Scroll to Live Stats section (below CTA buttons)
4. Wait for country rotation animation (3 seconds)

**Verify:**
- Component uses "full" variant
- Container: max-w-lg (512px) centered
- Glass card styling: border and subtle background
- Header shows:
  - Green pulse dot animation
  - "LIVE STATS" label
  - Global totals: "59.0B tokens" and "$213.7K spent"
- Country ticker section:
  - Flag icon (FlagIcon component, size="md")
  - Country name
  - Rank indicator (e.g., "#1 in token usage")
  - Token count (right-aligned)
  - Cost amount (right-aligned)
- Progress dots at bottom (8 dots, active highlighted)
- Smooth slide animation every 3 seconds

**Expected Results:**
- All elements visible and properly aligned
- Animation smooth (Framer Motion)
- No layout shift during country rotation
- Text remains readable throughout animation
- Numbers use tabular-nums for stable width

#### 3.2 Mobile Live Stats (375px)
**Steps:**
1. Navigate to homepage
2. Set viewport to 375x667
3. Observe Live Stats section

**Verify:**
- Component maintains full variant layout
- Container fits within mobile viewport (px-6 padding)
- Header content may stack on mobile if needed
- Country ticker remains single-line
- Flag icon and text scale appropriately
- Progress dots remain visible and centered
- Touch area covers entire component for modal opening

**Expected Results:**
- No horizontal overflow
- All content readable on small screen
- Animation performance smooth
- Ticker text doesn't wrap awkwardly

#### 3.3 Live Stats Interaction
**Steps:**
1. Set any viewport size
2. Click/tap on Live Stats component
3. Wait for modal to open

**Verify:**
- Click opens CountryStatsModal
- Modal displays full country rankings list
- Modal responsive to viewport size
- Modal has close button/gesture
- Background overlay present

**Expected Results:**
- Modal opens smoothly
- Content accessible in modal
- Can close modal and return to page

---

### Scenario 4: "How It Works" 3-Column Grid

**Objective:** Verify the 3-step process grid layout responds correctly.

**Seed:** `tests/e2e/seed.spec.ts`

#### 4.1 Desktop How It Works (1280px)
**Steps:**
1. Navigate to homepage
2. Set viewport to 1280x720
3. Scroll to "How it works" section

**Verify:**
- Section label: "HOW IT WORKS" in uppercase, small font
- Grid layout: 3 columns (`grid grid-cols-3 gap-4`)
- Each step card contains:
  - Step number ("01", "02", "03") in coral color, mono font
  - Title ("Sign in", "Install", "Track")
  - Description ("Quick & secure", "npx ccgather", "Auto sync")
- Cards evenly spaced with gap-4 (16px)
- All cards same width (flex-1 implicit)
- Text center-aligned within each card

**Expected Results:**
- Three cards side-by-side
- Equal column widths
- All content visible without overflow
- Vertical alignment consistent

#### 4.2 Tablet How It Works (768px)
**Steps:**
1. Navigate to homepage
2. Set viewport to 768x1024
3. Observe "How it works" section

**Verify:**
- Grid maintains 3-column layout (grid-cols-3 has no md: override)
- Cards remain side-by-side
- Text still readable
- Gap spacing preserved

**Expected Results:**
- Layout identical to desktop
- No wrapping or stacking
- Text not cramped

#### 4.3 Mobile How It Works (375px)
**Steps:**
1. Navigate to homepage
2. Set viewport to 375x667
3. Scroll to "How it works" section

**Verify:**
- Grid REMAINS 3 columns (`grid-cols-3` with no breakpoint)
- Cards compressed horizontally to fit
- Step numbers still visible
- Titles and descriptions may have smaller font
- Text may wrap within each card

**Expected Results:**
- Three cards visible side-by-side (may be cramped)
- Content readable despite smaller size
- No horizontal scroll
- Cards maintain equal width

**Known Issue:**
- Grid doesn't stack on mobile, could be tight fit
- Consider if this is intentional design or needs improvement

#### 4.4 How It Works Typography Scaling
**Steps:**
1. Compare text sizes across viewports
2. Check readability at 375px, 768px, 1280px

**Verify:**
- Step numbers: text-[10px] at all sizes
- Titles: text-xs at all sizes
- Descriptions: text-[10px] at all sizes
- Font sizes are fixed, no responsive scaling

**Expected Results:**
- Text readable at all sizes
- No typography bugs or misalignment
- Consistent styling across breakpoints

---

### Scenario 5: CLI Section 2-Column Grid

**Objective:** Verify CLI feature grid adapts from 2-column to single-column.

**Seed:** `tests/e2e/seed.spec.ts`

#### 5.1 Desktop CLI Section (1280px)
**Steps:**
1. Navigate to homepage
2. Set viewport to 1280x720
3. Scroll to CLI section (below "How it works")

**Verify:**
- Section container: max-w-2xl (672px) centered
- Section label: "COMMAND LINE INTERFACE"
- H2 heading: "One command to rule them all" (text-2xl on md)
- CLI install card:
  - Glass background styling
  - "Quick Install" label with green "Ready" indicator
  - Command: `$ npx ccgather` in monospace font
- Feature grid: 2 columns (`grid grid-cols-2 gap-3`)
- Four feature cards:
  - "⚡ Auto Sync"
  - "🔐 Secure"
  - "📊 Real-time"
  - "🎯 Zero Config"
- Each card: emoji, title, description
- "View all commands →" button centered at bottom

**Expected Results:**
- 2x2 grid layout for features
- CLI command card full-width above grid
- All cards glass styling with consistent padding
- Text aligned left within cards

#### 5.2 Tablet CLI Section (768px)
**Steps:**
1. Navigate to homepage
2. Set viewport to 768x1024
3. Observe CLI section

**Verify:**
- Layout same as desktop (md breakpoint active)
- H2 heading: text-2xl (1.5rem)
- 2-column grid maintained
- All spacing preserved

**Expected Results:**
- Identical to desktop layout
- No wrapping or overflow issues

#### 5.3 Mobile CLI Section (375px)
**Steps:**
1. Navigate to homepage
2. Set viewport to 375x667
3. Scroll to CLI section

**Verify:**
- Container padding: px-6
- H2 heading size: text-xl (1.25rem, smaller than desktop)
- CLI command card fits within viewport
- Feature grid REMAINS 2 columns (`grid-cols-2` no breakpoint)
- Four cards displayed 2x2 on mobile
- Cards compressed but content visible

**Expected Results:**
- H2 uses smaller text-xl on mobile
- 2-column grid maintained (design choice)
- Cards fit within mobile viewport
- Text readable despite smaller cards
- No horizontal overflow

#### 5.4 CLI Button Interaction
**Steps:**
1. Set any viewport
2. Click "View all commands →" button
3. Wait for CLI modal to open

**Verify:**
- Button opens CLIModal component
- Modal displays CLI commands documentation
- Modal responsive to viewport
- Modal has close functionality

**Expected Results:**
- Modal opens smoothly
- Content accessible
- Can close and return

---

### Scenario 6: Footer Responsive Layout

**Objective:** Verify footer adapts from horizontal to stacked layout.

**Seed:** `tests/e2e/seed.spec.ts`

#### 6.1 Desktop Footer (1280px)
**Steps:**
1. Navigate to homepage
2. Set viewport to 1280x720
3. Scroll to footer at bottom

**Verify:**
- Footer contentinfo element present
- Layout: horizontal with space-between
- Left section: Logo + "CCgather" + "© 2026"
- Right section: Links ("Privacy", "Terms", "GitHub")
- All items aligned horizontally
- Footer has top border separator
- Background matches page theme

**Expected Results:**
- Logo and links on same row
- Links have adequate spacing (gap-4 or similar)
- All links functional and styled correctly
- Footer doesn't stick to bottom (static positioning)

#### 6.2 Tablet Footer (768px)
**Steps:**
1. Navigate to homepage
2. Set viewport to 768x1024
3. Observe footer

**Verify:**
- Layout likely same as desktop
- All elements remain horizontal
- Links don't wrap

**Expected Results:**
- Identical to desktop layout
- No stacking or wrapping

#### 6.3 Mobile Footer (375px)
**Steps:**
1. Navigate to homepage
2. Set viewport to 375x667
3. Scroll to footer

**Verify:**
- Check if layout stacks vertically
- Logo section may move above links
- Links may stack or remain horizontal
- Adequate padding on sides (px-4)
- Year "© 2026" remains visible

**Expected Results:**
- Footer adapts to mobile width
- All content visible and accessible
- No horizontal overflow
- Links remain tappable

**Note:** Need to check footer.tsx for exact responsive behavior.

#### 6.4 Footer Link Touch Targets
**Steps:**
1. Set viewport to 375x667
2. Test tapping each footer link
3. Measure touch target size

**Verify:**
- Each link has minimum 44x44px touch target
- Links have adequate spacing to avoid mis-taps
- Hover/active states visible (if applicable on mobile)

**Expected Results:**
- All links easily tappable on mobile
- No accidental clicks on wrong link
- Visual feedback on tap

---

### Scenario 7: Button and Link Touch Targets

**Objective:** Verify all interactive elements meet minimum touch target size requirements.

**Seed:** `tests/e2e/seed.spec.ts`

#### 7.1 Primary Buttons
**Steps:**
1. Navigate to homepage at 375x667
2. Identify all primary buttons:
   - "Get Started" / "View Rankings"
   - "Explore"
   - "View all commands →"
3. Measure each button's touch target

**Verify:**
- Each button height at least 44px (py-2.5 = 10px top + 10px bottom + content)
- Button width adequate for text + padding
- Buttons have visual padding: px-5 py-2.5
- No buttons too small to tap accurately

**Expected Results:**
- All primary buttons meet 44x44px minimum
- Adequate spacing between buttons (gap-3)
- Easy to tap without mis-taps

#### 7.2 Header Interactive Elements
**Steps:**
1. Set viewport to 375x667
2. Open mobile menu
3. Test tapping each navigation link

**Verify:**
- Mobile menu links: px-4 py-3 provides adequate touch area
- Desktop navigation links: adequate height and click area
- Theme switcher buttons: meet touch target size
- Sign In button: at least 44x44px
- Mobile hamburger menu button: adequate size

**Expected Results:**
- All header elements easily tappable
- No mis-taps on adjacent elements
- Touch feedback present

#### 7.3 Footer Links
**Steps:**
1. Set viewport to 375x667
2. Scroll to footer
3. Test tapping each link

**Verify:**
- Links have adequate padding or size
- Spacing between links prevents mis-taps

**Expected Results:**
- All footer links meet accessibility standards
- Easy to tap on small screens

---

### Scenario 8: Scroll Behavior and Fixed Header

**Objective:** Verify header remains fixed during scroll and doesn't obscure content.

**Seed:** `tests/e2e/seed.spec.ts`

#### 8.1 Desktop Scroll
**Steps:**
1. Navigate to homepage at 1280x720
2. Scroll down to bottom of page
3. Scroll back to top

**Verify:**
- Header remains fixed at top during scroll
- Header has glassmorphism effect (backdrop-blur-xl)
- Header doesn't overlap important content
- Page content has top padding to account for fixed header (pt-32)

**Expected Results:**
- Header always visible and functional
- No content hidden behind header
- Smooth scroll performance

#### 8.2 Mobile Scroll
**Steps:**
1. Navigate to homepage at 375x667
2. Scroll down slowly
3. Observe header behavior

**Verify:**
- Header remains fixed (position: fixed)
- Mobile menu button always accessible
- No scroll performance issues
- Page content has adequate top padding (pt-32)

**Expected Results:**
- Fixed header works on mobile
- No content inaccessible due to header
- Smooth scrolling on touch devices

#### 8.3 Mobile Menu During Scroll
**Steps:**
1. Set viewport to 375x667
2. Open mobile menu
3. Try to scroll page content

**Verify:**
- Page scroll locked when menu open (body scroll lock)
- Can scroll within menu if content overflows
- Menu closes when tapping backdrop

**Expected Results:**
- No accidental page scrolling with menu open
- Menu content scrollable if needed
- Intuitive close behavior

---

### Scenario 9: Theme Switcher Responsive Behavior

**Objective:** Verify theme switcher works and displays correctly at all sizes.

**Seed:** `tests/e2e/seed.spec.ts`

#### 9.1 Desktop Theme Switcher
**Steps:**
1. Navigate to homepage at 1280x720
2. Locate theme switcher in header (right section)
3. Click theme switcher

**Verify:**
- Theme switcher visible as icon button or group
- Shows three options: System, Light, Dark
- Current theme highlighted
- Clicking option changes theme immediately
- Page theme variables update

**Expected Results:**
- Theme switcher functional
- Visual feedback on selection
- Smooth theme transition

#### 9.2 Mobile Theme Switcher
**Steps:**
1. Navigate to homepage at 375x667
2. Open mobile menu
3. Locate theme switcher in menu

**Verify:**
- Theme switcher present in mobile drawer
- Located in dedicated section with label "Theme"
- Same three options available
- Size="sm" version used
- Functional same as desktop

**Expected Results:**
- Easy to access in mobile menu
- Clear which theme is selected
- Changes apply immediately

#### 9.3 Theme Persistence
**Steps:**
1. Select Dark theme
2. Navigate to different page
3. Return to homepage

**Verify:**
- Theme selection persists across pages
- No flash of wrong theme on load
- System theme respects OS preference

**Expected Results:**
- Theme remembered in session/localStorage
- Consistent theme across site

---

### Scenario 10: Viewport Edge Cases

**Objective:** Test layout behavior at breakpoint boundaries and extreme sizes.

**Seed:** `tests/e2e/seed.spec.ts`

#### 10.1 Breakpoint Boundaries
**Steps:**
1. Test at 767px (just below md breakpoint)
2. Test at 768px (exactly at md breakpoint)
3. Test at 769px (just above md breakpoint)
4. Observe layout changes

**Verify:**
- No layout flash or jump at breakpoint
- Elements transition smoothly
- No broken layouts at boundary
- Header switches from desktop to mobile correctly

**Expected Results:**
- Clean breakpoint transitions
- No content overlap or disappearance
- Consistent behavior at exact breakpoint

#### 10.2 Very Small Mobile (320px)
**Steps:**
1. Set viewport to 320x568 (iPhone SE 1st gen)
2. Navigate homepage
3. Check all sections

**Verify:**
- All content still visible
- No horizontal overflow
- Text remains readable
- Buttons still tappable
- How It Works grid fits (though cramped)

**Expected Results:**
- Site usable on smallest common phones
- Layout doesn't break
- May be tight but functional

#### 10.3 Large Desktop (1920px)
**Steps:**
1. Set viewport to 1920x1080
2. Navigate homepage
3. Observe max-width constraints

**Verify:**
- Content doesn't stretch too wide
- Max-width containers (max-w-2xl, max-w-lg) center content
- Adequate margins on sides
- Design maintains intended aesthetics

**Expected Results:**
- Page looks good on large screens
- Content not uncomfortably wide
- Good use of whitespace

#### 10.4 Landscape Mobile (667x375)
**Steps:**
1. Set viewport to 667x375 (landscape)
2. Navigate homepage
3. Check header and content

**Verify:**
- Fixed header doesn't take too much vertical space
- Content scrollable
- Layout adapts or remains functional
- No severe layout issues

**Expected Results:**
- Usable in landscape orientation
- May not be optimized but shouldn't break
- Key content accessible

---

### Scenario 11: Animation Performance

**Objective:** Verify animations perform smoothly across devices/viewports.

**Seed:** `tests/e2e/seed.spec.ts`

#### 11.1 Live Stats Animation
**Steps:**
1. Navigate to homepage at various viewports
2. Observe country ticker animation
3. Monitor frame rate and smoothness

**Verify:**
- Animation runs every 3 seconds
- Framer Motion transitions smooth
- No jank or stuttering
- Animation doesn't block main thread

**Expected Results:**
- 60fps animation performance
- Consistent timing across devices
- No layout shift during animation

#### 11.2 Header Underline Animation
**Steps:**
1. Set desktop viewport
2. Hover over navigation links
3. Observe underline animation

**Verify:**
- Underline animates from 0 to full width
- Transition smooth (duration-300)
- No flicker or jump

**Expected Results:**
- Elegant hover effect
- Consistent across all nav links

#### 11.3 Button Hover Transitions
**Steps:**
1. Test all button hover effects
2. Check opacity and color transitions

**Verify:**
- Hover state changes smooth
- No abrupt color jumps
- Transition timing feels natural

**Expected Results:**
- Professional button interactions
- Accessible hover states

---

## Accessibility Considerations

### Touch Target Sizes
- Minimum 44x44px for all interactive elements
- Adequate spacing to prevent mis-taps
- Buttons with touch-target class where needed

### Focus States
- Visible focus indicators on all interactive elements
- Focus trap in modals (mobile menu, CLI modal)
- Keyboard navigation works correctly

### Color Contrast
- Text meets WCAG AA standards
- Theme switcher supports high contrast mode
- Links distinguishable from body text

### Screen Reader Support
- Semantic HTML (header, nav, main, footer)
- ARIA labels where needed
- Image alt text present

---

## Performance Benchmarks

### Load Time
- Initial page load < 2 seconds on 3G
- First Contentful Paint < 1.5 seconds
- Time to Interactive < 3 seconds

### Layout Shifts
- Cumulative Layout Shift (CLS) < 0.1
- No major shifts during country ticker animation
- Fixed header doesn't cause reflow

### Network
- Lazy load images below fold
- Critical CSS inlined
- Fonts optimized (Next.js font optimization)

---

## Known Issues and Design Notes

### How It Works Grid
- Maintains 3-column layout on mobile (grid-cols-3)
- No responsive breakpoint to stack on small screens
- Content may feel cramped on 375px viewport
- **Consider:** Adding `grid-cols-1 md:grid-cols-3` for better mobile UX

### CLI Feature Grid
- Maintains 2-column layout on mobile (grid-cols-2)
- Cards compressed but functional on 375px
- **Current behavior:** Design choice to keep grid
- **Alternative:** Could stack to single column on mobile

### Footer Layout
- Need to verify stacking behavior on mobile
- Check footer.tsx for exact responsive implementation

### LiveStatsTicker Variant
- Homepage uses "full" variant
- Component also has "compact" variant for other pages
- Test both variants separately if needed

---

## Test Execution Summary

### Critical Tests (Must Pass)
1. Header navigation switches mobile/desktop at 768px
2. Hero CTA buttons visible and tappable at all sizes
3. No horizontal overflow at 375px viewport
4. Fixed header doesn't obscure content
5. All interactive elements meet 44x44px minimum

### Important Tests (Should Pass)
6. Live Stats animation smooth at all sizes
7. Theme switcher accessible in both desktop and mobile
8. Footer links tappable on mobile
9. Breakpoint transitions smooth
10. Text readable at all viewport sizes

### Nice-to-Have Tests (Enhancement)
11. Performance benchmarks met
12. Landscape orientation usable
13. 320px viewport functional
14. Large desktop (1920px) looks good
15. Animation performance consistent

---

## Appendix: Responsive Classes Reference

### Common Tailwind Breakpoint Patterns
```css
/* Mobile-first approach */
.class             /* 0px+ (mobile) */
md:.class          /* 768px+ (tablet) */
xl:.class          /* 1280px+ (desktop) */

/* Examples from homepage */
text-3xl md:text-4xl     /* H1: 1.875rem mobile, 2.25rem desktop */
text-xl md:text-2xl      /* H2: 1.25rem mobile, 1.5rem desktop */
h-14 md:h-16             /* Header: 56px mobile, 64px desktop */
w-7 h-7 md:w-8 md:h-8    /* Logo: 28px mobile, 32px desktop */
hidden md:flex           /* Desktop nav: hidden mobile, flex desktop */
md:hidden                /* Mobile button: visible mobile, hidden desktop */
```

### Custom CSS Variables
```css
--color-bg-primary       /* Page background */
--color-text-primary     /* Primary text */
--color-text-secondary   /* Secondary text */
--color-text-muted       /* Muted/subtle text */
--color-claude-coral     /* Brand coral (#E87F5E) */
--glass-bg               /* Glassmorphism background */
--border-default         /* Default border color */
```

---

## Test Automation Notes

### Playwright Test Structure
```typescript
// Example test structure
test.describe('Homepage Responsive Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Desktop header layout @desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    // Test implementation
  });

  test('Mobile header layout @mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    // Test implementation
  });
});
```

### Useful Playwright Commands
```typescript
// Viewport sizing
await page.setViewportSize({ width: 375, height: 667 });

// Check element visibility
await expect(page.locator('.desktop-nav')).toBeVisible();
await expect(page.locator('.mobile-menu-btn')).toBeHidden();

// Check computed styles
const fontSize = await page.locator('h1').evaluate(el =>
  window.getComputedStyle(el).fontSize
);

// Check touch target size
const box = await page.locator('button').boundingBox();
expect(box.width).toBeGreaterThanOrEqual(44);
expect(box.height).toBeGreaterThanOrEqual(44);

// Test animations
await page.hover('.nav-link');
await page.waitForTimeout(300); // Wait for transition
// Check underline presence

// Screenshot comparison (visual regression)
await expect(page).toHaveScreenshot('homepage-mobile.png');
```

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-12 | Claude | Initial comprehensive test plan created |

---

**End of Test Plan**
