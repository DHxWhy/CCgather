# CCgather TODO

## Future Enhancements

### Dynamic Popular Leagues (Priority: Low)
**Status:** Pending - implement when user base grows

**Current State:**
- `TOP_COUNTRIES` in `lib/constants/countries.ts` is a static list of 8 countries
- Displayed as "추천 리그" on onboarding page

**Future Implementation:**
1. Create API endpoint `/api/countries/popular`
2. Query database for country user counts:
   ```sql
   SELECT country_code, COUNT(*) as user_count
   FROM users
   WHERE country_code IS NOT NULL
   GROUP BY country_code
   ORDER BY user_count DESC
   LIMIT 8
   ```
3. Replace static `TOP_COUNTRIES` with dynamic API call
4. Add caching (revalidate every hour)
5. Show actual user count per country

**Trigger:** Implement when total users > 100

---

### Team/Enterprise CCplan Detection (Priority: Medium)
**Status:** Monitoring via admin alerts

**Current State:**
- Unknown ccplan values are logged to `admin_alerts` table
- UI only shows: free, pro, max leagues
- Team tab hidden until subscription type confirmed

**Action Required:**
- Monitor admin alerts for team/enterprise submissions
- Once detected, add proper handling and UI

---

## Completed

- [x] Remove dummy data from onboarding (2024-01)
- [x] FlagIcon emoji fallback (2024-01)
- [x] Remove Map view feature (2024-01)
- [x] Admin alerts for unknown ccplan (2024-01)
