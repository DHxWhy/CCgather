/**
 * Mock Data Index
 * ===============
 *
 * HOW TO REMOVE MOCK DATA:
 * 1. Delete the entire `data/mock` folder
 * 2. Update imports in components to use real API
 * 3. Remove `data/mock` related imports from:
 *    - app/(main)/leaderboard/page.tsx
 *    - app/(main)/u/[username]/page.tsx
 *    - Any other files importing from '@/data/mock'
 */

export * from './users';
export * from './usage-history';

// Re-export commonly used items
export { MOCK_USERS, getPaginatedMockUsers, getMockUsersByCountry } from './users';
export { getMockUserHistory } from './usage-history';
