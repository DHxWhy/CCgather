# Mock Data for Development

This folder contains mock/dummy data for development and testing purposes.

## Structure

```
data/mock/
├── index.ts           # Main export file
├── users.ts           # Mock user data (100 users)
├── usage-history.ts   # Mock usage history per user
└── README.md          # This file
```

## Features

### Users (`users.ts`)
- **100 mock users** with realistic distribution
- **12 countries**: US, KR, JP, DE, GB, CN, FR, CA, AU, IN, BR, SG
- **4 tiers**: free (40%), pro (40%), team (15%), enterprise (5%)
- **Power-law token distribution**: Top users have significantly more tokens
- **Badges**: Automatically assigned based on rank and tokens
- **Seeded random**: Consistent data across page reloads

### Usage History (`usage-history.ts`)
- **30-day history** per user
- **Weekday/weekend patterns**: Less usage on weekends
- **Model breakdown**: claude-3-5-sonnet, haiku, opus distribution
- **Cost calculation**: Based on blended token rates

## Usage

```typescript
import { MOCK_USERS, getPaginatedMockUsers, getMockUserHistory } from '@/data/mock';

// Get all users
const users = MOCK_USERS;

// Get paginated users with filters
const { users, total, totalPages } = getPaginatedMockUsers(1, 20, {
  country: 'KR',
  tier: 'pro',
  search: 'dev',
});

// Get user's usage history
const history = getMockUserHistory('user-1-devcode42', 15_000_000_000);
```

## Removing Mock Data

When connecting to a real API:

1. **Delete this entire folder**: `rm -rf data/mock`

2. **Update imports** in these files:
   - `app/(main)/leaderboard/page.tsx`
   - `app/(main)/u/[username]/page.tsx`
   - Any file with `import ... from '@/data/mock'`

3. **Replace with real API calls**:
   ```typescript
   // Before (mock)
   import { MOCK_USERS } from '@/data/mock';

   // After (real API)
   const users = await fetch('/api/leaderboard').then(r => r.json());
   ```

## Data Characteristics

| Metric | Value |
|--------|-------|
| Total Users | 100 |
| Top User Tokens | ~15B |
| Token Range | ~1M - 15B |
| Cost Range | ~$36 - $540,000 |
| Countries | 12 |
| Tiers | 4 |
