# News Tab Redesign - Design Specification

## 1. Current State Analysis

### 1.1 Existing Structure
```
app/(main)/news/
├── page.tsx          # Main news page with NewsCard, UpdateCard
├── layout.tsx        # Simple layout wrapper
└── updates/[slug]/   # Individual update detail pages

lib/data/news-content.ts  # Static data (NEWS_ARTICLES, UPDATE_POSTS)
```

### 1.2 Current Data Flow
```
Static Data (news-content.ts)
    ↓
NEWS_ARTICLES → NewsCard component
UPDATE_POSTS → UpdateCard component
    ↓
Rendered on page.tsx
```

### 1.3 Current DB Structure (contents table)
```sql
contents (
  id, type, title, source_url, source_name,
  thumbnail_url,  -- Currently underutilized
  summary_md, key_points, category,
  status, published_at, ...
)
```

**Issue**: `category` field exists but lacks proper content_type differentiation for:
- Version Updates
- Official Announcements
- Press News

---

## 2. Proposed Redesign

### 2.1 Three-Section Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  News & Updates                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  🔄 Version Updates                                             │
│  ┌───────┬───────┬───────┬───────┬─────────────────────────────┐ │
│  │v1.0.23│v1.0.22│v1.0.21│v1.0.20│  ← scroll →                 │ │
│  │ 최신  │       │       │       │                             │ │
│  └───────┴───────┴───────┴───────┴─────────────────────────────┘ │
│  (Horizontal Carousel - newest on left, scrolls right)          │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  📢 Anthropic Official                                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ [🖼️ Thumbnail]  Title: Official Announcement            │   │
│  │                 Summary: Claude 4.0 released...         │   │
│  │                 Source: blog.anthropic.com              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  📰 Press News                                                  │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ │
│  │ [🖼️ Thumbnail]   │ │ [🖼️ Thumbnail]   │ │ [🖼️ Thumbnail]   │ │
│  │ TechCrunch       │ │ TheVerge         │ │ Wired            │ │
│  │ Title...         │ │ Title...         │ │ Title...         │ │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Content Type Definitions

| Type | Description | Source | Display |
|------|-------------|--------|---------|
| `version_update` | Claude Code version releases | Internal/Manual | Carousel |
| `official` | Anthropic official announcements | anthropic.com, blog.anthropic.com | List with thumbnail |
| `press` | Third-party news coverage | techcrunch, theverge, etc. | Grid with thumbnail |

---

## 3. Database Schema Changes

### 3.1 Migration: Add content_type column

```sql
-- 018_contents_content_type.sql
ALTER TABLE public.contents
ADD COLUMN IF NOT EXISTS content_type TEXT
CHECK (content_type IN ('version_update', 'official', 'press', 'community', 'youtube'));

-- Migrate existing data
UPDATE public.contents
SET content_type = CASE
  WHEN source_name IN ('Anthropic', 'blog.anthropic.com', 'claude.ai') THEN 'official'
  ELSE 'press'
END
WHERE type = 'news' AND content_type IS NULL;

-- Index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_contents_content_type
ON public.contents(content_type);
```

### 3.2 Updated automation_targets Category Mapping

| automation_targets.category | → contents.content_type |
|----------------------------|------------------------|
| `official` | `official` |
| `news`, `blog` | `press` |
| `community` | `community` |
| `youtube` | `youtube` |

---

## 4. Horizontal Carousel Design (Version Updates)

### 4.1 Component Structure

```tsx
// components/news/VersionCarousel.tsx
interface VersionCarouselProps {
  updates: UpdatePost[];
}

// Features:
// - Newest item positioned at LEFT
// - Horizontal scroll with touch/mouse drag
// - Scroll indicators (dots or arrows)
// - Responsive: 4 items on desktop, 2 on tablet, 1 on mobile
```

### 4.2 Visual Specification

```
Desktop (4 visible):
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐  →
│v1.0.23 │ │v1.0.22 │ │v1.0.21 │ │v1.0.20 │
│ 🆕     │ │        │ │        │ │        │
│ title  │ │ title  │ │ title  │ │ title  │
│ date   │ │ date   │ │ date   │ │ date   │
└────────┘ └────────┘ └────────┘ └────────┘

- Card Width: 240px
- Gap: 16px
- Height: 180px
- Version badge: Green bg, white text
- NEW badge: Coral bg for latest
```

### 4.3 Scroll Behavior

```typescript
// Scroll Configuration
const carouselConfig = {
  scrollBehavior: 'smooth',
  scrollAmount: 256, // card width + gap
  showArrows: true,  // Desktop only
  showDots: false,   // Optional indicator
  autoScroll: false, // No auto-scroll
  touchEnabled: true,
  mouseWheelEnabled: true, // Horizontal scroll on hover
};
```

---

## 5. Gemini Thumbnail Integration

### 5.1 Architecture

```
[News Article URL]
       ↓
[Cron Job: collect-news]
       ↓
[Gemini API: Generate Thumbnail]
       ↓
[Upload to Supabase Storage]
       ↓
[Save thumbnail_url to contents]
```

### 5.2 Gemini API Integration

```typescript
// lib/gemini/thumbnail-generator.ts

import { GoogleGenerativeAI } from "@google/generative-ai";

interface ThumbnailGeneratorConfig {
  model: "gemini-2.0-flash-exp"; // or "gemini-1.5-flash"
  style: "minimalist" | "tech" | "news";
  size: { width: 400, height: 225 }; // 16:9 ratio
}

async function generateThumbnail(article: {
  title: string;
  summary: string;
  source: string;
}): Promise<string> {
  // 1. Create prompt for thumbnail concept
  // 2. Generate image using Gemini Imagen
  // 3. Upload to Supabase Storage
  // 4. Return public URL
}
```

### 5.3 Thumbnail Generation Prompt Template

```
Generate a minimalist, tech-style thumbnail for a news article.

Article: "${title}"
Topic: Claude Code / AI Development Tools
Style: Modern, dark background (#0a0a0a), accent color (#FF6B4A)
Avoid: Text, faces, complex scenes

Create a simple, iconic representation that conveys:
- Technology / AI theme
- Professional news feel
- Clean, modern aesthetic
```

### 5.4 Fallback Strategy

```
Priority Order:
1. Gemini-generated thumbnail
2. OG Image from source URL (meta tag)
3. Default placeholder based on content_type
```

---

## 6. Implementation Plan

### Phase 1: Database & Types (Migration)
```
Wave 1 (Parallel):
├─ Create migration 018_contents_content_type.sql
├─ Update types/automation.ts with ContentType
└─ Update lib/agents/config.ts SOURCE_CATEGORIES mapping
```

### Phase 2: Components
```
Wave 2 (Parallel):
├─ Create components/news/VersionCarousel.tsx
├─ Create components/news/OfficialNewsCard.tsx
├─ Create components/news/PressNewsCard.tsx
└─ Create lib/gemini/thumbnail-generator.ts (stub)
```

### Phase 3: Page Integration
```
Wave 3 (Sequential):
├─ Update app/(main)/news/page.tsx
│   ├─ Fetch from DB instead of static data
│   ├─ Integrate 3-section layout
│   └─ Add VersionCarousel
└─ Update API routes for content_type filtering
```

### Phase 4: Gemini Integration
```
Wave 4 (Sequential):
├─ Implement Gemini thumbnail generator
├─ Update cron/collect-news to generate thumbnails
└─ Add thumbnail fallback logic
```

---

## 7. API Changes

### 7.1 New Endpoint: GET /api/news

```typescript
// Query params
interface NewsQueryParams {
  content_type?: 'version_update' | 'official' | 'press';
  limit?: number;
  offset?: number;
}

// Response
interface NewsResponse {
  items: {
    id: string;
    content_type: string;
    title: string;
    summary: string;
    source_name: string;
    source_url: string;
    thumbnail_url: string | null;
    published_at: string;
  }[];
  total: number;
}
```

### 7.2 Version Updates Source

```typescript
// Option A: Continue using static UPDATE_POSTS
// Option B: Migrate to DB with content_type = 'version_update'

// Recommended: Hybrid approach
// - Manual version updates stay in news-content.ts (curated)
// - Automated news goes to DB (official, press)
```

---

## 8. Environment Variables

```env
# .env.example additions
GOOGLE_GEMINI_API_KEY=your-gemini-api-key
THUMBNAIL_GENERATION_ENABLED=true
THUMBNAIL_FALLBACK_URL=/images/news-placeholder.png
```

---

## 9. Responsive Design

### Desktop (>1024px)
- Carousel: 4 visible cards
- Official: Full-width card with large thumbnail
- Press: 3-column grid

### Tablet (768px - 1024px)
- Carousel: 2-3 visible cards
- Official: Full-width, smaller thumbnail
- Press: 2-column grid

### Mobile (<768px)
- Carousel: 1 visible card, full swipe
- Official: Stacked, vertical layout
- Press: 1-column list

---

## 10. Performance Considerations

### 10.1 Image Optimization
```typescript
// Use Next.js Image with blur placeholder
<Image
  src={thumbnail_url}
  alt={title}
  width={400}
  height={225}
  placeholder="blur"
  blurDataURL={PLACEHOLDER_BLUR}
  loading="lazy"
/>
```

### 10.2 Data Fetching Strategy
```typescript
// Server Components for initial load
// Client-side infinite scroll for "Load More"

// Cache Strategy
export const revalidate = 300; // 5 minutes
```

---

## 11. File Structure After Implementation

```
components/
├── news/
│   ├── VersionCarousel.tsx      # Horizontal scroll carousel
│   ├── VersionCard.tsx          # Individual version card
│   ├── OfficialNewsCard.tsx     # Large format official news
│   ├── PressNewsCard.tsx        # Grid format press news
│   └── NewsThumbnail.tsx        # Thumbnail with fallback

lib/
├── gemini/
│   └── thumbnail-generator.ts   # Gemini API integration

app/
├── (main)/news/
│   └── page.tsx                 # Updated 3-section layout
└── api/
    └── news/
        └── route.ts             # News API endpoint
```

---

## 12. Summary

| Feature | Description | Priority |
|---------|-------------|----------|
| 3-Section Layout | Version / Official / Press | P0 |
| Version Carousel | Horizontal scroll, newest-left | P0 |
| Content Type Column | DB schema migration | P0 |
| Gemini Thumbnails | AI-generated news images | P1 |
| Responsive Design | Mobile/Tablet/Desktop | P0 |
| API Endpoint | Filter by content_type | P1 |

**Estimated Implementation**: 5 development waves
**Dependencies**: Gemini API key required for thumbnail generation
