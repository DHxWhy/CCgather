# CCGather Frontend Development Plan

**Version:** 1.0
**Date:** 2025-01-05
**Status:** Approved

---

## 1. Technology Stack

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| **Framework** | Next.js | 15.x | App Router, RSC |
| **Language** | TypeScript | 5.x | Strict mode |
| **Styling** | Tailwind CSS | 4.x | Utility-first |
| **Components** | shadcn/ui | Latest | Base components |
| **State (Server)** | TanStack Query | v5 | Server state |
| **State (Client)** | Zustand | Latest | Client state |
| **Animation** | Framer Motion | 11.x | Transitions |
| **Charts** | Recharts | 2.x | Data visualization |
| **Icons** | Lucide React | Latest | Icon system |
| **Forms** | React Hook Form | Latest | Form handling |
| **Validation** | Zod | Latest | Schema validation |
| **Auth** | Clerk | Latest | GitHub OAuth |

---

## 2. Page Structure

| Route | Page | Description | Auth | Priority |
|-------|------|-------------|------|----------|
| `/` | Landing | Hero, Live leaderboard preview | Public | P0 |
| `/leaderboard` | Leaderboard | Full leaderboard with filters | Public | P0 |
| `/league/[country]` | Country League | Country-specific ranking | Public | P1 |
| `/u/[username]` | Profile | User stats, charts, badges | Public | P0 |
| `/news` | News Feed | Claude Code updates | Public | P2 |
| `/settings` | Settings | User preferences | Private | P1 |
| `/onboarding` | Onboarding | Country selection | Private | P0 |
| `/sign-in/[[...]]` | Sign In | Clerk sign in | Public | P0 |
| `/sign-up/[[...]]` | Sign Up | Clerk sign up | Public | P0 |

---

## 3. Component Hierarchy

```
📂 components/
│
├── 📂 ui/                          # shadcn/ui (auto-generated)
│   ├── button.tsx
│   ├── card.tsx
│   ├── dialog.tsx
│   ├── dropdown-menu.tsx
│   ├── input.tsx
│   ├── select.tsx
│   ├── skeleton.tsx
│   ├── table.tsx
│   ├── tabs.tsx
│   ├── toast.tsx
│   └── tooltip.tsx
│
├── 📂 layout/
│   ├── header.tsx                  # Navigation, Auth status
│   ├── footer.tsx                  # Links, Copyright
│   ├── sidebar.tsx                 # Mobile navigation
│   └── mobile-nav.tsx              # Mobile menu
│
├── 📂 leaderboard/
│   ├── leaderboard-table.tsx       # Main table component
│   ├── leaderboard-row.tsx         # Single row with hover
│   ├── top-three-podium.tsx        # 1st, 2nd, 3rd showcase
│   ├── rank-change-badge.tsx       # ↑3 ↓1 indicator
│   ├── period-filter.tsx           # Today/7D/30D/All
│   ├── country-filter.tsx          # Country dropdown
│   ├── sort-toggle.tsx             # Tokens/Cost sort
│   └── leaderboard-skeleton.tsx    # Loading state
│
├── 📂 profile/
│   ├── profile-header.tsx          # Avatar, name, level
│   ├── profile-stats.tsx           # Stats cards grid
│   ├── profile-chart.tsx           # Usage area chart
│   ├── activity-heatmap.tsx        # GitHub-style heatmap
│   ├── badge-collection.tsx        # Badge grid
│   ├── badge-item.tsx              # Single badge
│   ├── profile-side-panel.tsx      # Desktop side drawer
│   └── profile-skeleton.tsx        # Loading state
│
├── 📂 news/
│   ├── news-feed.tsx               # News list container
│   ├── news-card.tsx               # Single news item
│   ├── news-category-tabs.tsx      # Category filter
│   └── news-skeleton.tsx           # Loading state
│
├── 📂 onboarding/
│   ├── country-selector.tsx        # Country dropdown
│   ├── timezone-detector.tsx       # Auto-detect timezone
│   └── onboarding-form.tsx         # Complete form
│
├── 📂 shared/
│   ├── animated-counter.tsx        # Number animation
│   ├── glass-card.tsx              # Glassmorphism card
│   ├── level-badge.tsx             # Level indicator
│   ├── country-flag.tsx            # Flag emoji wrapper
│   ├── model-badge.tsx             # Claude model badge
│   ├── loading-spinner.tsx         # Spinner component
│   └── error-message.tsx           # Error display
│
└── 📂 landing/
    ├── hero-section.tsx            # Main hero
    ├── live-stats.tsx              # Animated stats
    ├── how-it-works.tsx            # Steps section
    └── country-battle.tsx          # Country preview
```

---

## 4. State Management Design

### 4.1 Server State (TanStack Query)

| Query Key | Data | Stale Time | GC Time |
|-----------|------|------------|---------|
| `['leaderboard', filters]` | Leaderboard data | 30s | 5min |
| `['profile', username]` | User profile | 60s | 10min |
| `['profile', 'chart', username]` | Chart data | 2min | 10min |
| `['countries']` | Country stats | 5min | 30min |
| `['news', category]` | News items | 5min | 30min |
| `['user', 'me']` | Current user | 60s | 10min |

### 4.2 Client State (Zustand)

```typescript
// stores/ui-store.ts
interface UIStore {
  // Theme
  theme: 'dark' | 'light';
  toggleTheme: () => void;

  // Side Panel
  profilePanelOpen: boolean;
  selectedUsername: string | null;
  openProfilePanel: (username: string) => void;
  closeProfilePanel: () => void;

  // Filters (persisted)
  leaderboardPeriod: 'today' | '7d' | '30d' | 'all';
  leaderboardCountry: string | null;
  leaderboardSort: 'tokens' | 'cost';
  setLeaderboardFilters: (filters: Partial<...>) => void;
}

// stores/user-store.ts
interface UserStore {
  // Settings
  autoSyncEnabled: boolean;
  notificationsEnabled: boolean;
  setSettings: (settings: Partial<...>) => void;
}
```

---

## 5. API Integration Points

| Endpoint | Method | Component | Query/Mutation |
|----------|--------|-----------|----------------|
| `/api/leaderboard` | GET | LeaderboardTable | Query |
| `/api/user/[username]` | GET | ProfileHeader, ProfileStats | Query |
| `/api/user/[username]/chart` | GET | ProfileChart | Query |
| `/api/countries` | GET | CountryFilter, CountryBattle | Query |
| `/api/news` | GET | NewsFeed | Query |
| `/api/me` | GET | Settings | Query |
| `/api/me` | PATCH | SettingsForm | Mutation |
| `/api/me/badges/display` | POST | BadgeCollection | Mutation |
| `/api/submit` | POST | CLI (external) | - |

---

## 6. Design System

### 6.1 Color Palette

```css
:root {
  /* Primary - Orange Gradient */
  --primary: #FF6B35;
  --primary-light: #FF8C5A;
  --primary-dark: #E85A2A;
  --primary-gradient: linear-gradient(135deg, #FF6B35, #F7931E);

  /* Background - Deep Dark */
  --bg-primary: #0A0A0B;
  --bg-secondary: #111113;
  --bg-card: #18181B;
  --bg-card-hover: #1F1F23;
  --bg-elevated: #27272A;

  /* Glass Effect */
  --glass-bg: rgba(255, 255, 255, 0.03);
  --glass-border: rgba(255, 255, 255, 0.08);

  /* Accent Colors */
  --accent-green: #10B981;
  --accent-red: #EF4444;
  --accent-blue: #3B82F6;
  --accent-purple: #8B5CF6;
  --accent-yellow: #EAB308;

  /* Text */
  --text-primary: #FAFAFA;
  --text-secondary: #A1A1AA;
  --text-muted: #71717A;

  /* Glow Effects */
  --glow-primary: 0 0 20px rgba(255, 107, 53, 0.3);
  --glow-gold: 0 0 30px rgba(255, 215, 0, 0.4);
}
```

### 6.2 Typography

```css
/* Font Family */
--font-sans: 'Inter', -apple-system, sans-serif;
--font-mono: 'JetBrains Mono', monospace;

/* Font Sizes */
--text-xs: 0.75rem;     /* 12px */
--text-sm: 0.875rem;    /* 14px */
--text-base: 1rem;      /* 16px */
--text-lg: 1.125rem;    /* 18px */
--text-xl: 1.25rem;     /* 20px */
--text-2xl: 1.5rem;     /* 24px */
--text-3xl: 1.875rem;   /* 30px */
--text-4xl: 2.25rem;    /* 36px */
```

### 6.3 Component Patterns

```tsx
// Glass Card Pattern
<div className="
  rounded-2xl
  border border-white/10
  bg-gradient-to-br from-white/5 to-white/[0.02]
  backdrop-blur-xl
  shadow-xl
">
  {children}
</div>

// Glow Button Pattern
<button className="
  px-6 py-3 rounded-xl
  bg-gradient-to-r from-[#FF6B35] to-[#F7931E]
  text-white font-semibold
  shadow-[0_0_20px_rgba(255,107,53,0.3)]
  hover:shadow-[0_0_30px_rgba(255,107,53,0.5)]
  hover:scale-105
  transition-all duration-300
">
  {children}
</button>

// Rank Badge Pattern
<span className={cn(
  "flex items-center gap-1 font-mono text-sm",
  change > 0 && "text-emerald-400",
  change < 0 && "text-red-400",
  change === 0 && "text-zinc-500"
)}>
  {change > 0 && <TrendingUp className="w-4 h-4" />}
  {change < 0 && <TrendingDown className="w-4 h-4" />}
  {change !== 0 && Math.abs(change)}
</span>
```

---

## 7. Animation Guidelines

### 7.1 Framer Motion Patterns

```typescript
// Page transitions
const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
};

// Stagger children
const containerVariants = {
  animate: {
    transition: { staggerChildren: 0.05 }
  }
};

// Rank change animation
const rankChangeVariants = {
  initial: { scale: 1.2, color: '#10B981' },
  animate: { scale: 1, transition: { duration: 0.5 } }
};

// Counter animation (for numbers)
// Use framer-motion's useSpring or custom hook
```

### 7.2 Animation Timing

| Animation | Duration | Easing |
|-----------|----------|--------|
| Page transition | 300ms | ease-out |
| Hover effects | 200ms | ease-in-out |
| Modal open/close | 200ms | ease-out |
| Number counter | 1000ms | spring |
| Rank change | 500ms | spring |
| Toast | 3000ms (visible) | - |

---

## 8. Responsive Design

### 8.1 Breakpoints

```typescript
const breakpoints = {
  sm: '640px',   // Mobile landscape
  md: '768px',   // Tablet
  lg: '1024px',  // Desktop
  xl: '1280px',  // Large desktop
  '2xl': '1536px' // Extra large
};
```

### 8.2 Layout Strategy

| Viewport | Leaderboard | Profile | Navigation |
|----------|-------------|---------|------------|
| Mobile (<768px) | Single column | Full page | Bottom nav |
| Tablet (768-1024px) | Full width | Full page | Top nav |
| Desktop (>1024px) | With side panel | Side panel | Top nav + sidebar |

---

## 9. Performance Optimization

### 9.1 Code Splitting

```typescript
// Dynamic imports for heavy components
const ProfileChart = dynamic(() => import('./profile-chart'), {
  loading: () => <ChartSkeleton />,
  ssr: false // Charts don't need SSR
});

const ActivityHeatmap = dynamic(() => import('./activity-heatmap'), {
  loading: () => <HeatmapSkeleton />,
  ssr: false
});
```

### 9.2 Image Optimization

```typescript
// Avatar images
<Image
  src={user.avatarUrl}
  alt={user.displayName}
  width={48}
  height={48}
  className="rounded-full"
  priority={isTopThree}
/>

// Badge SVGs
// Use inline SVG or SVG sprite for badges
```

### 9.3 Performance Targets

| Metric | Target | Strategy |
|--------|--------|----------|
| LCP | < 2.5s | RSC + Streaming |
| FID | < 100ms | Minimal client JS |
| CLS | < 0.1 | Reserved heights |
| JS Bundle | < 150KB | Code splitting |
| First Paint | < 1s | Edge + ISR |

---

## 10. Accessibility (WCAG 2.1 AA)

### 10.1 Requirements

- [ ] Keyboard navigation
- [ ] Focus indicators
- [ ] Screen reader support
- [ ] Color contrast (4.5:1)
- [ ] ARIA labels
- [ ] Skip links
- [ ] Reduced motion support

### 10.2 Implementation

```tsx
// Focus visible styles
className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"

// ARIA labels
<button aria-label="Sort by tokens">
  <SortIcon />
</button>

// Reduced motion
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 11. Testing Strategy

### 11.1 Unit Tests

| Component | Test Cases |
|-----------|------------|
| AnimatedCounter | Correct final value, animation timing |
| RankChangeBadge | Up/down/neutral states |
| LevelBadge | All 10 levels render correctly |
| CountryFlag | Emoji rendering |

### 11.2 Integration Tests

| Feature | Test Cases |
|---------|------------|
| Leaderboard | Filter changes, pagination, sorting |
| Profile Panel | Open/close, data loading |
| Auth Flow | Sign in, sign out, protected routes |

### 11.3 E2E Tests (Playwright)

| Flow | Steps |
|------|-------|
| User Registration | Sign up → Onboarding → Dashboard |
| View Leaderboard | Navigate → Filter → Paginate → View profile |
| Settings Update | Login → Settings → Update → Verify |

---

## 12. File Naming Conventions

```
components/
├── leaderboard-table.tsx      # kebab-case for files
├── LeaderboardTable           # PascalCase for components
├── useLeaderboard.ts          # camelCase hooks
├── leaderboard.types.ts       # Types file
└── leaderboard.test.tsx       # Test file
```

---

## 13. Implementation Priority

### Phase 1: Foundation (Week 1-2)
- [ ] Next.js setup with App Router
- [ ] Tailwind CSS 4 + shadcn/ui
- [ ] Clerk integration
- [ ] Basic layout (Header, Footer)
- [ ] Auth pages (Sign in/up)
- [ ] Onboarding page

### Phase 2: Core (Week 3-4)
- [ ] Leaderboard table
- [ ] Top 3 Podium
- [ ] Period/Country filters
- [ ] Pagination
- [ ] Basic profile page

### Phase 3: Visualization (Week 5-6)
- [ ] Profile side panel
- [ ] Usage chart (Recharts)
- [ ] Activity heatmap
- [ ] Animated counters
- [ ] Level badges

### Phase 4: Polish (Week 7-8)
- [ ] Badge system UI
- [ ] News feed
- [ ] Framer Motion animations
- [ ] Mobile responsive
- [ ] Dark/Light theme

---

**Document End**

*Frontend Plan Version: 1.0*
*Last Updated: 2025-01-05*
