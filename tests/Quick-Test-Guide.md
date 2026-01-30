# CCgather Quick Test Guide

Quick reference for manual testing the CCgather application with real DHxYoon account.

## Prerequisites

- [ ] App running at http://localhost:3002
- [ ] Supabase database connected and seeded
- [ ] Clerk authentication configured
- [ ] DHxYoon account exists in Clerk
- [ ] Browser DevTools open (Network tab)

## Quick Smoke Test (5 minutes)

### 1. Authentication ✓
```
1. Open http://localhost:3002
2. Click "Get Started"
3. Sign in with GitHub (DHxYoon account)
4. Should redirect to /onboarding OR /leaderboard
```

### 2. Onboarding (if new user) ✓
```
1. Search for "Korea"
2. Select "South Korea"
3. Click "Continue"
4. Should redirect to /leaderboard
```

### 3. Leaderboard Basics ✓
```
1. Verify table displays with users
2. Click country filter (🇰🇷)
3. Click period filter (7D)
4. Verify data updates
5. Click user row
6. Verify profile panel opens
```

### 4. Settings ✓
```
1. Click "Settings" in header
2. Change country to "Japan"
3. Click "Update Profile"
4. Verify success message
5. Return to leaderboard
6. Verify country updated
```

## Full Test Checklist (30 minutes)

### Authentication (5 min)
- [ ] Sign in as new user → redirects to onboarding
- [ ] Sign in as existing user → redirects to leaderboard
- [ ] Sign out → returns to home page
- [ ] Protected routes blocked when signed out

### Onboarding (3 min)
- [ ] Search countries works
- [ ] Popular countries display
- [ ] Select country works
- [ ] Clear selection works
- [ ] Submit updates database

### Leaderboard - Filters (5 min)
- [ ] Global filter (🌍) shows all users
- [ ] Country filter (🇰🇷) shows only country users
- [ ] Period filters (1D, 7D, 30D, All) update data
- [ ] Sort by cost (💵) reorders
- [ ] Sort by tokens (🪙) reorders
- [ ] Combined filters work correctly

### Leaderboard - Interaction (5 min)
- [ ] Click user row opens profile panel
- [ ] Panel shows correct user data
- [ ] Close panel works (X, outside click, Esc)
- [ ] Hover level badge shows tooltip
- [ ] Hover country flag shows code
- [ ] "My Rank" button navigates to user

### Leaderboard - Pagination (3 min)
- [ ] Page numbers display correctly
- [ ] Click page number navigates
- [ ] Next/Previous buttons work
- [ ] Buttons disabled at boundaries
- [ ] Total count displays

### Settings (4 min)
- [ ] Profile displays user data
- [ ] Country search filters
- [ ] Update country works
- [ ] Success message appears
- [ ] CLI section displays
- [ ] Danger zone displays

### Navigation (3 min)
- [ ] Header links work
- [ ] Logo returns to home
- [ ] Mobile menu works
- [ ] Active page highlighted
- [ ] Settings link visible when signed in

### Responsive (2 min)
- [ ] Mobile view (375px) - leaderboard readable
- [ ] Tablet view (768px) - layout adjusts
- [ ] Desktop view (1440px) - full features
- [ ] Profile panel responsive

## DHxYoon Specific Tests

### Verify Real Data
```
1. Sign in as DHxYoon
2. Go to /leaderboard
3. Verify DHxYoon appears in list
4. Click DHxYoon row
5. Profile panel should show:
   - Real avatar from GitHub
   - Username: @DHxYoon
   - Real token count
   - Real cost amount
   - Real rank position
   - Country flag if set
```

### My Rank Button
```
1. On leaderboard, find "My Rank" button
2. Note rank number displayed
3. Click button
4. Should navigate to page with DHxYoon
5. Row should be highlighted with glow
```

### Settings Update
```
1. Go to /settings
2. Current country should display
3. Change to different country
4. Submit update
5. Verify success message
6. Go to /leaderboard
7. Country filter should show new country
8. DHxYoon should appear in that country's leaderboard
```

## Common Issues Checklist

### If leaderboard doesn't load:
- [ ] Check Network tab for API errors
- [ ] Verify Supabase connection
- [ ] Check database has users
- [ ] Verify onboarding_completed = true for users

### If onboarding loops:
- [ ] Check user has country_code in database
- [ ] Verify onboarding_completed flag
- [ ] Clear browser cache/cookies
- [ ] Check OnboardingGuard logic

### If authentication fails:
- [ ] Verify Clerk keys in .env
- [ ] Check Clerk dashboard for user
- [ ] Verify webhook working
- [ ] Check user exists in Supabase

### If filters don't work:
- [ ] Check API endpoint response
- [ ] Verify period parameter handling
- [ ] Check date range calculations
- [ ] Verify country code uppercase

## Performance Checks

### Measure These:
- [ ] Initial page load: <2 seconds
- [ ] Leaderboard API call: <500ms
- [ ] Filter change response: <500ms
- [ ] Page navigation: <200ms
- [ ] Profile panel open: smooth animation

### Monitor in DevTools:
- Network tab: API response times
- Performance tab: FPS during animations
- Console: No errors
- Application tab: localStorage for theme

## Test Data Validation

### Verify Database:
```sql
-- Check DHxYoon exists
SELECT * FROM users WHERE username = 'DHxYoon';

-- Check has country
SELECT country_code, onboarding_completed FROM users WHERE username = 'DHxYoon';

-- Check has usage stats
SELECT COUNT(*) FROM usage_stats WHERE user_id = (SELECT id FROM users WHERE username = 'DHxYoon');

-- Check rank calculation
SELECT username, global_rank, country_rank, total_tokens
FROM users
WHERE country_code = 'KR'
ORDER BY country_rank;
```

## Browser Testing Matrix

### Desktop
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (if Mac)
- [ ] Edge (latest)

### Mobile
- [ ] Chrome Mobile (Android)
- [ ] Safari Mobile (iOS)
- [ ] Responsive mode in DevTools

### Features to Test Per Browser:
1. Authentication flow
2. Leaderboard display
3. Filters work
4. Profile panel
5. Theme switching

## Accessibility Quick Check

### Keyboard Navigation:
- [ ] Tab through all interactive elements
- [ ] Enter activates buttons
- [ ] Escape closes modals
- [ ] Focus visible on all elements

### Screen Reader (if available):
- [ ] Table announced correctly
- [ ] Headers read
- [ ] Button labels clear

## API Testing (Optional)

### Using curl or Postman:

**Get current user:**
```bash
curl http://localhost:3002/api/me \
  -H "Cookie: YOUR_SESSION_COOKIE"
```

**Get leaderboard:**
```bash
curl http://localhost:3002/api/leaderboard?period=all&page=1&limit=20
```

**Update profile:**
```bash
curl -X PATCH http://localhost:3002/api/me \
  -H "Cookie: YOUR_SESSION_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"country_code": "JP"}'
```

## Recording Test Results

### Template:
```
Test Date: YYYY-MM-DD
Tester: [Name]
Browser: [Chrome 120 / Firefox 115 / etc]
Device: [Desktop / Mobile / Tablet]

Scenarios Tested: [X/15 categories]
Issues Found: [Number]
Critical Bugs: [Number]

Pass Rate: [%]

Notes:
- [Any observations]
- [Performance issues]
- [UX feedback]
```

## Quick Bug Report Template

```
Title: [Short description]
Severity: [Critical / High / Medium / Low]

Steps to Reproduce:
1. [Step 1]
2. [Step 2]
3. [Step 3]

Expected Result:
[What should happen]

Actual Result:
[What actually happened]

Environment:
- Browser: [Chrome 120.0]
- OS: [Windows 11]
- Screen Size: [1920x1080]
- User: [DHxYoon]

Screenshot: [If applicable]
Console Errors: [If any]
```

## Success Criteria Summary

### Must Pass (Critical):
- ✓ User can sign in
- ✓ Onboarding completes
- ✓ Leaderboard displays
- ✓ Filters work
- ✓ Settings update works
- ✓ No console errors

### Should Pass (High):
- ✓ Pagination works
- ✓ Profile panel works
- ✓ Mobile responsive
- ✓ Theme switching works

### Nice to Have (Medium):
- ✓ Animations smooth
- ✓ Tooltips work
- ✓ Accessibility basics
- ✓ Performance good

---

**Time Estimates:**
- Quick Smoke Test: 5 minutes
- Full Manual Test: 30 minutes
- Browser Testing: 15 minutes per browser
- DHxYoon Specific: 10 minutes
- Total Comprehensive: ~2 hours

**Next Steps After Testing:**
1. Document all issues found
2. Prioritize by severity
3. Create GitHub issues
4. Add Playwright automation for critical paths
5. Retest after fixes
