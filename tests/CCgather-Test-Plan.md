# CCgather Application - Comprehensive Test Plan

## Application Overview

CCgather is a Next.js-based leaderboard application for Claude Code developers that tracks and ranks users based on their AI token usage and spending. The application features:

- **Authentication**: Clerk-based OAuth with GitHub integration
- **Onboarding Flow**: Country selection for new users
- **Leaderboard System**: Global and country-specific rankings with time-based filtering
- **User Profiles**: Settings management, country selection, CLI token generation
- **Real-time Data**: Supabase backend with API-driven data synchronization
- **Responsive Design**: Mobile-first with glassmorphism UI elements
- **Theme Support**: Light/Dark mode switching

### Tech Stack
- Frontend: Next.js 16, React 19, TypeScript
- Authentication: Clerk
- Database: Supabase
- Styling: TailwindCSS
- Testing: Playwright (available)

### Key User Flows
1. **Anonymous → Sign Up → Onboarding → Leaderboard**
2. **Returning User → Sign In → Leaderboard (skip onboarding)**
3. **Authenticated User → Settings → Update Profile**
4. **View Rankings → Filter → Paginate → View User Profile**

---

## Test Scenarios

### 1. Authentication Flow

**Seed:** N/A (Clerk OAuth flow)

#### 1.1 Sign In with GitHub - New User
**Prerequisites:**
- Application running at http://localhost:3002
- User not previously registered
- Valid GitHub account

**Steps:**
1. Navigate to http://localhost:3002
2. Verify "Get Started" button is visible in hero section
3. Click "Get Started" button
4. Clerk modal appears with GitHub OAuth option
5. Click "Continue with GitHub"
6. Complete GitHub OAuth flow in popup
7. OAuth completes and modal closes

**Expected Results:**
- User is redirected to `/onboarding` page
- OnboardingGuard detects no country_code in user profile
- Onboarding page displays with country selection UI
- User data created in Supabase `users` table with `onboarding_completed: false`

#### 1.2 Sign In - Returning User (Onboarding Complete)
**Prerequisites:**
- User exists in database
- User has `country_code` set
- User has `onboarding_completed: true`

**Steps:**
1. Navigate to http://localhost:3002
2. Click "Get Started" or "Sign In"
3. Complete GitHub OAuth flow
4. Wait for authentication to complete

**Expected Results:**
- OnboardingGuard checks `/api/me` endpoint
- User has country_code and onboarding_completed = true
- User redirected to `/leaderboard` (skips onboarding)
- Header shows UserButton with user avatar
- Settings link visible in header

#### 1.3 Sign In - User Without Country (Incomplete Onboarding)
**Prerequisites:**
- User exists in database
- User has `country_code: null` OR `onboarding_completed: false`

**Steps:**
1. Navigate to http://localhost:3002
2. Sign in with GitHub OAuth
3. Wait for authentication

**Expected Results:**
- OnboardingGuard detects incomplete onboarding
- User forced to `/onboarding` page
- Cannot access other protected pages until onboarding complete

#### 1.4 Sign Out
**Prerequisites:**
- User currently signed in

**Steps:**
1. Click UserButton (avatar) in header
2. Click "Sign Out" in dropdown menu
3. Confirm sign out

**Expected Results:**
- User signed out of Clerk session
- Redirected to home page (`/`)
- Header shows "Get Started" button instead of UserButton
- Protected routes redirect to sign-in when accessed

---

### 2. Onboarding Flow

**Seed:** Fresh user account without country selection

#### 2.1 Complete Onboarding - Search and Select Country
**Prerequisites:**
- New user just completed OAuth
- On `/onboarding` page

**Steps:**
1. Verify onboarding page displays:
   - 🌐 globe emoji
   - "Welcome to CCgather!" heading
   - Country search input
   - "Popular Countries" grid (8 countries: US, GB, KR, JP, DE, FR, CA, AU)
   - "All Countries" scrollable list
2. Type "South Korea" in search input
3. Verify filtered results show only matching countries
4. Click "South Korea" from results
5. Verify selected country appears at top with flag and name
6. Click "Continue" button
7. Wait for API call to complete

**Expected Results:**
- Search filters countries in real-time
- Selected country highlighted with primary color background
- Selected country displays at top with remove (X) button
- Continue button enabled only when country selected
- API PATCH to `/api/me` with:
  ```json
  {
    "country_code": "KR",
    "timezone": "Asia/Seoul",
    "onboarding_completed": true
  }
  ```
- User redirected to `/leaderboard` on success
- Database updated with country_code and onboarding_completed flag

#### 2.2 Select from Popular Countries
**Steps:**
1. On `/onboarding` page (no search query)
2. Click "United States" from "Popular Countries" grid
3. Verify selection
4. Click "Continue"

**Expected Results:**
- Country selected immediately without search
- Selection highlighted
- Successfully completes onboarding with country_code "US"
- Redirected to leaderboard

#### 2.3 Clear Country Selection
**Steps:**
1. Select a country (e.g., "Germany")
2. Verify country appears in selected display
3. Click X button on selected country
4. Verify selection cleared

**Expected Results:**
- Selected country removed
- Continue button disabled
- Can select different country

#### 2.4 Search No Results
**Steps:**
1. Type "ZZZZZ" or nonsense text in search
2. Verify no results display

**Expected Results:**
- Shows "🔍 No countries found for 'ZZZZZ'" message
- Popular countries hidden during search
- Can clear search to restore list

#### 2.5 Attempt to Skip Onboarding
**Prerequisites:**
- User has incomplete onboarding

**Steps:**
1. From `/onboarding` page
2. Manually navigate to `/leaderboard` via URL bar
3. Press Enter

**Expected Results:**
- OnboardingGuard intercepts navigation
- User redirected back to `/onboarding`
- Cannot access protected pages without completing onboarding

---

### 3. Leaderboard - Core Functionality

**Seed:** Multiple users in database with token usage data

#### 3.1 View Global Leaderboard (All Time)
**Prerequisites:**
- User authenticated and onboarding complete
- Database has users with ranking data

**Steps:**
1. Navigate to `/leaderboard`
2. Wait for data to load
3. Verify default view shows:
   - "Global Leaderboard" heading
   - 🌍 globe filter selected
   - "All Time" period selected
   - 🪙 tokens sort selected
   - Leaderboard table with users

**Expected Results:**
- API call to `/api/leaderboard?page=1&limit=20&period=all`
- Table displays with columns:
  - Rank (🥇/🥈/🥉 for top 3, #4+ for others)
  - C (Country flag)
  - User (avatar + display name)
  - Level (badge with color)
  - Cost ($ amount)
  - Tokens (formatted: 45.3M, 1.2K, etc.)
- Users ordered by global_rank ascending
- Top 3 users have larger avatars and medals
- If current user (DHxYoon) in top 20, row highlighted with primary/5 background
- Pagination shows if total > 20 users
- Loading spinner while fetching

#### 3.2 Filter by Country
**Prerequisites:**
- User has country_code set (e.g., "KR")
- Multiple users exist from same country

**Steps:**
1. On `/leaderboard` page
2. Click country flag button (🇰🇷) in scope filter
3. Wait for data to reload

**Expected Results:**
- Heading changes to "🇰🇷 Country Leaderboard"
- API call includes `country=KR` parameter
- Table shows only users with country_code = "KR"
- Users ordered by country_rank
- Rank numbers reset (1, 2, 3... for country-specific ranking)
- Page resets to 1

#### 3.3 Filter by Period - Today
**Steps:**
1. Click "1D" (Today) button in period filter
2. Wait for data reload

**Expected Results:**
- API call with `period=today`
- Backend aggregates usage_stats for current date
- Users ranked by period_tokens (today's usage only)
- Rank column shows period_rank
- Cost and Tokens columns show today's values
- Users without usage today not shown
- Empty state shows if no usage today

#### 3.4 Filter by Period - 7 Days
**Steps:**
1. Click "7D" button
2. Verify data updates

**Expected Results:**
- API aggregates last 7 days of usage_stats
- Shows period_tokens and period_cost for last 7 days
- Ranking based on 7-day token total
- More users visible than "Today" filter

#### 3.5 Filter by Period - 30 Days
**Steps:**
1. Click "30D" button
2. Verify data updates

**Expected Results:**
- API aggregates last 30 days
- 30-day token and cost totals displayed
- Broader dataset than 7D

#### 3.6 Sort by Cost
**Prerequisites:**
- Viewing leaderboard with multiple users

**Steps:**
1. Click 💵 (cost) button in sort filter
2. Wait for re-sorting

**Expected Results:**
- Users re-ranked by cost_usd (descending)
- Rank numbers recalculated based on spending
- Highest spender gets rank #1
- Token column still visible but not primary sort

#### 3.7 Sort by Tokens (Default)
**Steps:**
1. From cost-sorted view
2. Click 🪙 (tokens) button

**Expected Results:**
- Users re-sorted by total_tokens
- Back to default token-based ranking

#### 3.8 Pagination - Navigate Pages
**Prerequisites:**
- Database has 50+ users

**Steps:**
1. Scroll to bottom of leaderboard
2. Verify pagination controls visible
3. Note current page is 1 (highlighted)
4. Click page "2" button
5. Wait for data load

**Expected Results:**
- API call with `page=2`
- Table shows users ranked 21-40
- Page 2 button highlighted
- URL updates (or state updates)
- Scroll position resets to top
- Animation plays on row load

#### 3.9 Pagination - Next/Previous
**Steps:**
1. On page 1
2. Click "›" (next) button
3. Verify page 2 loads
4. Click "‹" (previous) button

**Expected Results:**
- Next button advances to next page
- Previous button goes back
- Buttons disabled at boundaries (page 1 = no previous, last page = no next)
- Total users count displayed below pagination

#### 3.10 My Rank - Jump to Current User
**Prerequisites:**
- Current user (DHxYoon) exists in leaderboard
- DHxYoon is ranked beyond page 1 (e.g., rank 45)

**Steps:**
1. On leaderboard page 1
2. Note "📍 My Rank #45" button in top right
3. Click "My Rank" button
4. Wait for page change

**Expected Results:**
- Calculates page: Math.ceil(45 / 20) = page 3
- Navigates to page 3
- DHxYoon's row highlighted with coral glow effect
- Highlight animation plays
- Row has ring-2 border with primary color
- Highlight clears on filter change or other interaction

#### 3.11 Combined Filters - Country + Period + Sort
**Steps:**
1. Select Country filter (🇰🇷)
2. Select period "7D"
3. Select sort "💵 Cost"
4. Verify correct data loads

**Expected Results:**
- API call: `/api/leaderboard?page=1&limit=20&period=7d&country=KR`
- Shows only Korean users
- Ranked by 7-day spending
- All three filters visually active/highlighted
- Data correctly aggregated

---

### 4. Leaderboard - User Interaction

**Seed:** Users with complete profile data

#### 4.1 Click User Row - Open Profile Panel
**Prerequisites:**
- Leaderboard with users

**Steps:**
1. Click on any user row in table
2. Observe profile panel animation

**Expected Results:**
- ProfileSidePanel slides in from right
- Panel displays selected user's:
  - Avatar
  - Display name
  - Username (@username)
  - Country flag
  - Level badge with progress
  - Total tokens
  - Total cost
  - Rank information
- Clicked row background changes to hover color
- Panel overlay visible on mobile

#### 4.2 Close Profile Panel
**Steps:**
1. With profile panel open
2. Click X button in panel header
3. OR click outside panel on overlay
4. OR press Escape key

**Expected Results:**
- Panel slides out to right
- Row highlight clears
- Focus returns to leaderboard

#### 4.3 Switch Users While Panel Open
**Steps:**
1. Open profile panel for User A
2. Click different user row (User B) without closing panel
3. Observe panel update

**Expected Results:**
- Panel smoothly updates to show User B data
- User B row now highlighted
- User A row returns to normal state
- No panel close/reopen animation

#### 4.4 Level Badge Hover - Tooltip
**Steps:**
1. On desktop view
2. Hover mouse over any user's level badge (e.g., "Lv.3")
3. Wait 200ms

**Expected Results:**
- Tooltip appears below badge
- Shows complete level system:
  - All levels (Lv.1 through Lv.10)
  - Level names (Novice, Apprentice, etc.)
  - Token ranges for each level
  - Current user's level highlighted
- Formatted token ranges (1K - 10K, 10K - 50K, etc.)
- Tooltip disappears on mouse out

#### 4.5 Country Flag Hover - Country Code
**Steps:**
1. Hover over country flag in user row
2. Observe tooltip

**Expected Results:**
- Small tooltip shows country code (e.g., "KR", "US")
- Positioned near flag
- Minimal delay
- Disappears on mouse out

#### 4.6 Mobile - Level Display
**Steps:**
1. Resize browser to mobile width (<768px)
2. Observe leaderboard table

**Expected Results:**
- Level column shows only emoji icon (no "Lv.X" text)
- Saves horizontal space
- Emoji still recognizable

---

### 5. Settings Page

**Seed:** Authenticated user (DHxYoon)

#### 5.1 View Settings Page
**Prerequisites:**
- User authenticated

**Steps:**
1. Click "Settings" link in header
2. Navigate to `/settings`
3. Observe page load

**Expected Results:**
- Page displays three sections:
  1. Profile (with country selection)
  2. CLI Connection
  3. Danger Zone
- Profile section shows:
  - User avatar (circular)
  - Display name "DHxYoon" (or full name if set)
  - Username "@DHxYoon"
  - Current country (if set)
- All sections have glass card styling

#### 5.2 Update Country - Search and Select
**Steps:**
1. In Profile section
2. Type "Japan" in country search input
3. Wait for filtering
4. Click "Japan" from filtered results
5. Verify "Japan" selected (highlighted)
6. Click "Update Profile" button
7. Wait for API response

**Expected Results:**
- Real-time filtering as typing
- Shows max 10 results
- Selected country highlighted with primary/20 background
- API PATCH to `/api/me`:
  ```json
  {
    "country_code": "JP"
  }
  ```
- Success message appears: "✓ Profile updated successfully!"
- Success message auto-hides after 3 seconds
- Button shows "Updating..." during API call
- Button disabled during update

#### 5.3 Country Search - Clear Query
**Steps:**
1. Type "Germany" in search
2. Note filtered results
3. Clear search input
4. Observe list restore

**Expected Results:**
- Full country list (ALL_COUNTRIES) restored
- Shows all 195 countries
- Search clears immediately
- Can scroll through all options

#### 5.4 Update Profile - Validation
**Steps:**
1. Leave country unselected
2. Try clicking "Update Profile"

**Expected Results:**
- Button disabled (opacity-50, cursor-not-allowed)
- No API call made
- Must select country before update

#### 5.5 CLI Connection - View Instructions
**Steps:**
1. Scroll to CLI Connection section
2. Read displayed command

**Expected Results:**
- Shows command: `npx ccgather-cli setup`
- Command displayed in mono font
- Background is white/5 (code block style)
- "Generate New Token" button visible but not functional (placeholder)

#### 5.6 Danger Zone - View Warning
**Steps:**
1. Scroll to Danger Zone section
2. Observe styling and buttons

**Expected Results:**
- Section has red-500/20 border
- Heading "Danger Zone" in red-400
- Warning text: "These actions are irreversible. Please proceed with caution."
- Two buttons visible:
  - "Reset Stats"
  - "Delete Account"
- Both styled with red-500/20 background
- Buttons not functional (placeholders)

---

### 6. Home Page (Landing)

**Seed:** N/A

#### 6.1 View as Anonymous User
**Steps:**
1. Ensure signed out
2. Navigate to http://localhost:3002
3. Observe hero section

**Expected Results:**
- Header shows CCgather logo and "Get Started" button
- Hero displays:
  - "Claude Code Leaderboard" label
  - "Track your usage. Compete globally." heading
  - Description text
  - "Get Started" primary button
  - "Explore" secondary button
- Stats grid shows:
  - "2.3K Developers"
  - "45T Tokens"
  - "$123K Spent"
  - "42 Countries"
- "How It Works" section with 3 steps
- CLI section with install command
- Footer with GitHub link

#### 6.2 View as Authenticated User
**Steps:**
1. Sign in
2. Navigate to home page

**Expected Results:**
- Hero "Get Started" replaced with "View Rankings" button
- "View Rankings" links to `/leaderboard`
- "Explore" button still visible
- Header shows UserButton instead of Sign In

#### 6.3 Navigate to Leaderboard via Explore
**Steps:**
1. Click "Explore" button
2. Verify navigation

**Expected Results:**
- Navigates to `/leaderboard`
- Works for both signed in and signed out users
- Signed out users can view leaderboard without auth

#### 6.4 CLI Modal - Open and Close
**Steps:**
1. Click "CLI" in header navigation
2. Observe modal open
3. Read CLI commands
4. Click X or outside modal to close

**Expected Results:**
- Modal opens with CLI documentation
- Shows commands and usage
- Modal backdrop blurs background
- Escape key closes modal
- Click outside closes modal

---

### 7. Navigation and Routing

**Seed:** N/A

#### 7.1 Header Navigation - Desktop
**Steps:**
1. On desktop view (>768px width)
2. Click "Leaderboard" in header
3. Click "News" in header
4. Click "CLI" button
5. Click "Settings" (if signed in)

**Expected Results:**
- Each link navigates to correct page
- Active page has underline indicator
- Underline animates on hover for inactive links
- Navigation smooth with no full page reload
- Current page highlighted in header

#### 7.2 Header Navigation - Mobile
**Steps:**
1. Resize to mobile (<768px)
2. Click hamburger menu (☰) button
3. Observe drawer slide in from right
4. Click "Leaderboard"
5. Verify drawer closes and page navigates

**Expected Results:**
- Drawer slides in smoothly
- Shows all nav links vertically
- Theme switcher visible in drawer
- Sign In button at bottom (if signed out)
- Clicking link closes drawer and navigates
- X button closes drawer

#### 7.3 Logo Click - Return Home
**Steps:**
1. From any page
2. Click "CCgather" logo in header

**Expected Results:**
- Navigates to home page (`/`)
- Works from all pages

#### 7.4 Direct URL Access - Protected Route (Signed Out)
**Steps:**
1. Sign out
2. Navigate directly to `/settings` via URL bar

**Expected Results:**
- Clerk middleware intercepts
- Redirects to sign-in page
- After sign in, redirects back to `/settings`

#### 7.5 Direct URL Access - Onboarding Required
**Steps:**
1. User with incomplete onboarding
2. Navigate to `/leaderboard` via URL

**Expected Results:**
- OnboardingGuard intercepts
- Redirects to `/onboarding`
- Must complete onboarding before accessing leaderboard

---

### 8. Responsive Design

**Seed:** N/A

#### 8.1 Mobile View - Leaderboard Table
**Steps:**
1. Resize browser to 375px width (iPhone)
2. Navigate to `/leaderboard`
3. Scroll table horizontally if needed

**Expected Results:**
- Table adapts to mobile with fixed column widths
- Rank column shows medals/numbers
- Country flags visible
- User column truncates long names
- Level shows emoji only
- Cost shows shortened format ($45k instead of $45,000)
- Tokens shows shortened format (1.2M)
- Table scrollable horizontally if needed
- Touch-friendly row heights

#### 8.2 Tablet View - Leaderboard
**Steps:**
1. Resize to 768px width (iPad)
2. View leaderboard

**Expected Results:**
- Table shows more columns
- Level shows "Lv.3" format
- Full column headers visible
- Profile panel slides over table (overlay mode)

#### 8.3 Desktop View - Leaderboard with Panel
**Steps:**
1. Resize to 1440px+ width
2. Open profile panel

**Expected Results:**
- Panel pushes content left (not overlay)
- Leaderboard margin adjusts for panel width
- Smooth transition between states
- No content jump

#### 8.4 Mobile - Onboarding
**Steps:**
1. Mobile view (375px)
2. Navigate to `/onboarding`

**Expected Results:**
- Country search full width
- Popular countries grid 2 columns
- All countries list full width
- Touch-friendly buttons
- Scrollable country list
- Continue button full width

#### 8.5 Mobile - Settings
**Steps:**
1. Mobile view
2. Navigate to `/settings`

**Expected Results:**
- Cards stack vertically
- Full width inputs
- Touch-friendly buttons
- Country dropdown accessible
- Danger zone buttons wrap if needed

---

### 9. Theme Switching

**Seed:** N/A

#### 9.1 Switch to Dark Mode
**Prerequisites:**
- Currently in light mode

**Steps:**
1. Click ThemeSwitcher in header
2. Select "Dark" option
3. Observe theme change

**Expected Results:**
- Background changes to dark
- Text colors invert for contrast
- Glass cards adjust opacity
- Borders adjust to white/10
- Logo/icons adjust for dark mode
- Theme persists in localStorage
- Smooth transition animation

#### 9.2 Switch to Light Mode
**Steps:**
1. From dark mode
2. Click ThemeSwitcher
3. Select "Light"

**Expected Results:**
- Background changes to light
- Text darkens
- Glass effects adjust
- Border colors lighten
- Smooth transition

#### 9.3 System Preference
**Steps:**
1. Select "System" in ThemeSwitcher
2. Change OS dark mode setting

**Expected Results:**
- App follows OS preference
- Updates automatically when OS changes
- Preference saved

---

### 10. Error Handling

**Seed:** Various error conditions

#### 10.1 Leaderboard - API Error
**Prerequisites:**
- Supabase unavailable or API endpoint broken

**Steps:**
1. Navigate to `/leaderboard`
2. Wait for API call to fail

**Expected Results:**
- Loading spinner shows initially
- After error, shows:
  - ⚠️ warning icon
  - Error message (e.g., "Failed to fetch leaderboard")
  - "Retry" button
- Clicking retry re-fetches data
- No console errors visible to user

#### 10.2 Leaderboard - Empty State
**Prerequisites:**
- Database has 0 users
- OR filter combination yields no results

**Steps:**
1. Apply filters that return no users
2. Observe empty state

**Expected Results:**
- Shows 📭 mailbox icon
- Message: "No users found"
- Sub-message: "Be the first to join the leaderboard!"
- No table shown
- Filters still accessible

#### 10.3 Settings - API Update Failure
**Steps:**
1. Disconnect network
2. Try updating country
3. Observe error handling

**Expected Results:**
- Button shows "Updating..."
- API call fails
- Error logged to console
- No success message
- User can retry after reconnecting
- UI doesn't break

#### 10.4 Network Offline - Page Load
**Steps:**
1. Disconnect network
2. Try navigating to `/leaderboard`

**Expected Results:**
- Loading state shows
- Eventually times out or shows error
- Graceful error message
- No white screen of death

---

### 11. Performance

**Seed:** Large dataset (1000+ users)

#### 11.1 Leaderboard - Initial Load Time
**Steps:**
1. Clear cache
2. Navigate to `/leaderboard`
3. Measure time to interactive

**Expected Results:**
- Initial data loads in <2 seconds
- Skeleton/loading state visible immediately
- Progressive rendering of rows
- No layout shift after data loads
- Smooth fade-in animations

#### 11.2 Pagination - Page Change Speed
**Steps:**
1. Click through pages quickly
2. Observe loading

**Expected Results:**
- New page data loads in <500ms
- Smooth transition between pages
- No flickering
- Previous data clears cleanly

#### 11.3 Filter Change - Response Time
**Steps:**
1. Rapidly switch between filters
2. Observe responsiveness

**Expected Results:**
- Filter UI responds immediately
- API call debounced if needed
- Loading state shown during fetch
- No race conditions
- Latest filter always wins

#### 11.4 Mobile - Scroll Performance
**Steps:**
1. Mobile device
2. Scroll leaderboard quickly

**Expected Results:**
- 60fps scrolling
- No jank
- Smooth animations
- Table doesn't lag

---

### 12. Accessibility

**Seed:** N/A

#### 12.1 Keyboard Navigation - Leaderboard
**Steps:**
1. Navigate to `/leaderboard` using keyboard only
2. Press Tab to move through interactive elements
3. Press Enter to activate buttons/links

**Expected Results:**
- Tab order logical (filters → table rows → pagination)
- Focus visible on all interactive elements
- Enter activates buttons
- Space toggles where appropriate
- Escape closes modals/panels

#### 12.2 Screen Reader - Table Structure
**Steps:**
1. Enable screen reader (NVDA/JAWS/VoiceOver)
2. Navigate leaderboard table

**Expected Results:**
- Table announced as table
- Headers read correctly
- Row/column count announced
- Cell contents read in order
- Rank, Country, User, Level, Cost, Tokens all announced

#### 12.3 Focus Management - Modal
**Steps:**
1. Open profile panel with keyboard
2. Tab through panel elements
3. Close panel

**Expected Results:**
- Focus trapped in panel while open
- Tab cycles through panel elements
- Escape closes and returns focus
- No focus lost

#### 12.4 Color Contrast
**Steps:**
1. Check text colors against backgrounds
2. Verify WCAG AA compliance

**Expected Results:**
- All text meets 4.5:1 contrast ratio
- Interactive elements meet 3:1
- Hover states clearly visible
- Theme toggle accessible in both modes

---

### 13. Edge Cases

**Seed:** Special data conditions

#### 13.1 User with 0 Tokens
**Prerequisites:**
- User in database with total_tokens = 0

**Steps:**
1. View leaderboard
2. Find user with 0 tokens

**Expected Results:**
- User appears at bottom of ranking
- Displays "0" or "0K" for tokens
- No division by zero errors
- Level shows Lv.1 Novice

#### 13.2 User with Extremely High Tokens
**Prerequisites:**
- User with 999,999,999,999+ tokens (test data)

**Steps:**
1. View that user in leaderboard

**Expected Results:**
- Number formatted as "999.9B" or "1.0T"
- No overflow
- No scientific notation shown to user
- UI doesn't break

#### 13.3 Very Long Username
**Prerequisites:**
- User with 50+ character username

**Steps:**
1. View in leaderboard table
2. Check mobile view

**Expected Results:**
- Username truncates with ellipsis (...)
- Doesn't break table layout
- Full name visible in profile panel
- Tooltip shows full name on hover

#### 13.4 Missing Avatar
**Prerequisites:**
- User with avatar_url = null

**Steps:**
1. View user in leaderboard

**Expected Results:**
- Shows gradient circle with first letter of username
- Colors based on username hash
- Consistent across sessions
- Looks intentional, not broken

#### 13.5 Country Not in List
**Prerequisites:**
- User has country_code not in ALL_COUNTRIES

**Steps:**
1. View user in leaderboard

**Expected Results:**
- Shows country code as text
- OR shows default flag
- No error thrown
- User still ranks correctly

#### 13.6 Simultaneous Filter Changes
**Steps:**
1. Quickly click Country → Period → Sort in rapid succession
2. Observe data loading

**Expected Results:**
- Latest filter combination wins
- No race conditions
- Data consistent with final filter state
- Loading state shown during transition

---

### 14. Data Integrity

**Seed:** Real database data

#### 14.1 Rank Consistency - Global
**Prerequisites:**
- Multiple users with different token amounts

**Steps:**
1. View global leaderboard
2. Verify ranks are sequential (1, 2, 3, 4...)
3. Verify tokens decrease down the list
4. Check no duplicate ranks

**Expected Results:**
- global_rank column matches display rank
- No gaps in ranking (no 1, 2, 4, 5)
- Higher tokens = lower rank number
- Ties handled consistently

#### 14.2 Rank Consistency - Country
**Steps:**
1. Filter by country
2. Verify country_rank sequential
3. Compare to global rank

**Expected Results:**
- country_rank starts at 1 for top user in that country
- Sequential with no gaps
- country_rank may differ from global_rank
- Consistent within country filter

#### 14.3 Cost Calculation Accuracy
**Steps:**
1. View user with known token count
2. Verify cost matches expected calculation
3. Check cost_usd precision

**Expected Results:**
- Cost displays 2 decimal places
- Calculation matches Sonnet 4.5 pricing
- No rounding errors in display
- Consistent across all views

#### 14.4 Period Aggregation - 7 Days
**Prerequisites:**
- User has usage_stats entries for last 7 days

**Steps:**
1. Filter to "7D"
2. Verify period_tokens is sum of last 7 days
3. Check period_cost matches

**Expected Results:**
- Correct date range (today - 7 days)
- All days included
- Sum accurate
- No duplicate counting

#### 14.5 Pagination Total Count
**Steps:**
1. Note total users count at bottom
2. Navigate through all pages
3. Count users manually

**Expected Results:**
- Total count matches actual users
- Last page shows correct number
- No missing users between pages
- No duplicate users across pages

---

### 15. Real User Testing (DHxYoon)

**Seed:** Actual DHxYoon account with real usage data

#### 15.1 DHxYoon - View Own Profile
**Prerequisites:**
- Signed in as DHxYoon
- DHxYoon has token usage data

**Steps:**
1. Navigate to `/leaderboard`
2. Find DHxYoon in list (or use "My Rank" button)
3. Click on DHxYoon's row
4. Observe profile panel

**Expected Results:**
- DHxYoon's row has light primary background (isCurrentUser)
- Profile panel shows:
  - Real avatar from Clerk
  - Display name
  - @DHxYoon username
  - Country flag (if set)
  - Actual level based on real tokens
  - Real total_tokens value
  - Real total_cost value
  - Accurate global_rank
  - Accurate country_rank (if country set)

#### 15.2 DHxYoon - Update Country to Korea
**Steps:**
1. Navigate to `/settings`
2. Search and select "South Korea"
3. Click "Update Profile"
4. Wait for success message
5. Navigate to `/leaderboard`
6. Click country filter (🇰🇷)

**Expected Results:**
- Country updates successfully
- Success message appears
- DHxYoon appears in Korean leaderboard
- Korean flag shows in leaderboard row
- country_rank reflects position among Korean users

#### 15.3 DHxYoon - Verify "My Rank" Button
**Steps:**
1. On `/leaderboard`
2. Verify "My Rank" button appears
3. Note displayed rank number
4. Click button

**Expected Results:**
- Button shows DHxYoon's current rank
- Clicking navigates to correct page
- DHxYoon's row highlighted with glow effect
- Rank number matches position in table

#### 15.4 DHxYoon - Check Across Time Periods
**Steps:**
1. View DHxYoon in "All Time" filter
2. Note rank and tokens
3. Switch to "7D"
4. Note period rank and period tokens
5. Compare values

**Expected Results:**
- All Time shows total_tokens from profile
- 7D shows aggregated tokens from last 7 days
- 7D tokens ≤ All Time tokens
- Ranks may differ between periods
- Data accurate for each time range

#### 15.5 DHxYoon - Mobile Experience
**Steps:**
1. Sign in as DHxYoon on mobile device (or emulator)
2. Complete onboarding if needed
3. Navigate leaderboard
4. Open profile panel
5. Update settings

**Expected Results:**
- All features work on mobile
- Touch targets appropriately sized
- Panel overlays on mobile
- No horizontal scroll needed
- Forms usable on mobile keyboard

---

## Test Execution Guidelines

### Manual Testing
1. **Environment Setup**
   - Ensure app running at http://localhost:3002
   - Database seeded with test data
   - Clerk auth configured
   - Supabase connected

2. **Test Data Requirements**
   - At least 50 users for pagination testing
   - Users from multiple countries
   - Users with varying token amounts (0 to billions)
   - Users with and without avatars
   - DHxYoon account with real data

3. **Browser Coverage**
   - Chrome (primary)
   - Firefox
   - Safari
   - Edge
   - Mobile Safari (iOS)
   - Chrome Mobile (Android)

### Playwright Automation

**Test File Structure:**
```
tests/
├── auth.spec.ts           # Scenarios 1.*
├── onboarding.spec.ts     # Scenarios 2.*
├── leaderboard.spec.ts    # Scenarios 3.*, 4.*
├── settings.spec.ts       # Scenarios 5.*
├── navigation.spec.ts     # Scenarios 6.*, 7.*
├── responsive.spec.ts     # Scenarios 8.*
└── e2e.spec.ts           # Full user flows
```

**Example Test (Playwright):**
```typescript
import { test, expect } from '@playwright/test';

test.describe('Leaderboard', () => {
  test('should display global leaderboard', async ({ page }) => {
    await page.goto('http://localhost:3002/leaderboard');

    // Wait for data load
    await page.waitForSelector('table tbody tr');

    // Verify heading
    await expect(page.locator('h1')).toContainText('Global Leaderboard');

    // Verify filters
    await expect(page.locator('text=🌍')).toHaveClass(/bg-\[var\(--color-claude-coral\)\]/);

    // Verify table
    const rows = await page.locator('table tbody tr').count();
    expect(rows).toBeGreaterThan(0);
    expect(rows).toBeLessThanOrEqual(20);

    // Verify first row has rank 1
    const firstRank = await page.locator('table tbody tr:first-child td:first-child').textContent();
    expect(firstRank).toContain('🥇');
  });
});
```

### Regression Testing Priority

**Critical (P0) - Must Pass:**
- Authentication flow (1.1, 1.2)
- Onboarding completion (2.1)
- Leaderboard display (3.1)
- Filter functionality (3.2, 3.3)
- Settings update (5.2)

**High (P1) - Should Pass:**
- Pagination (3.8, 3.9)
- Profile panel (4.1)
- Mobile responsive (8.1)
- Error handling (10.1, 10.2)

**Medium (P2) - Nice to Have:**
- Hover states (4.4, 4.5)
- Theme switching (9.1, 9.2)
- Accessibility (12.*)
- Edge cases (13.*)

---

## Known Issues / Future Enhancements

1. **CLI Token Generation** - Currently placeholder in settings
2. **Reset Stats / Delete Account** - Not implemented
3. **Real-time Updates** - Leaderboard doesn't auto-refresh
4. **Advanced Filtering** - No search by username yet
5. **User Profiles** - Limited data in profile panel
6. **Achievement System** - Badges shown but not functional
7. **Admin Panel** - Exists but not tested here

---

## Test Data Requirements

### Minimal Seed
```sql
-- User with complete profile
INSERT INTO users (clerk_id, username, display_name, country_code, total_tokens, total_cost, onboarding_completed)
VALUES ('user_abc123', 'DHxYoon', 'DHxYoon', 'KR', 1500000, 45.50, true);

-- User without country (for onboarding test)
INSERT INTO users (clerk_id, username, country_code, onboarding_completed)
VALUES ('user_new456', 'newuser', NULL, false);

-- Multiple users for leaderboard
-- (repeat with varying tokens: 5000000, 2500000, 1000000, 500000, etc.)
```

### Comprehensive Seed
- 100+ users across 20+ countries
- Varied token amounts (0 to 10B)
- usage_stats entries for last 30 days
- Mix of users with/without avatars
- Users with edge case names (very long, special chars)

---

## Success Criteria

**Test Suite Passes If:**
- ✓ All P0 scenarios pass
- ✓ >90% of P1 scenarios pass
- ✓ >70% of P2 scenarios pass
- ✓ No critical bugs found
- ✓ Performance within acceptable limits (<2s initial load)
- ✓ Mobile experience functional
- ✓ Accessibility basics met (keyboard nav, screen reader)

**Ready for Production If:**
- ✓ All manual test scenarios documented
- ✓ Playwright test coverage >60%
- ✓ All auth flows secure
- ✓ Data integrity validated
- ✓ Real user (DHxYoon) testing complete
- ✓ Cross-browser testing passed
- ✓ Error handling graceful

---

## Appendix

### Test Environment URLs
- **Local Dev:** http://localhost:3002
- **Staging:** (not specified)
- **Production:** https://ccgather.com

### API Endpoints Tested
- `GET /api/me` - User profile
- `PATCH /api/me` - Update profile
- `GET /api/leaderboard` - Leaderboard data
- `POST /api/webhooks/clerk` - Auth sync (indirect)

### Key Technologies
- **Frontend:** Next.js 16, React 19, TypeScript
- **Auth:** Clerk (GitHub OAuth)
- **Database:** Supabase (PostgreSQL)
- **Testing:** Playwright
- **Styling:** TailwindCSS

### Related Documentation
- [README.md](../README.md) - Project overview
- [Supabase Schema](../supabase/schema.sql) - Database structure
- [API Routes](../app/api/) - Backend endpoints
- [Components](../components/) - UI components

---

**Document Version:** 1.0
**Last Updated:** 2026-01-07
**Created By:** AI Test Planner
**Target Application:** CCgather v1.0.0
