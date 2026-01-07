# 🌐 CCGather - Product Requirements Document (PRD)

**Version:** 1.3 (Complete Edition)  
**Date:** 2025-01-05  
**Status:** Final  
**Domain:** ccgather.com  
**Repository:** github.com/DHxYoon/ccgather (Public)  
**License:** MIT

---

# 📋 Executive Summary

## 서비스 개요

**CCGather**는 전 세계 Claude Code 개발자들의 사용량을 실시간으로 트래킹하고, 글로벌/국가별 리더보드를 통해 경쟁하며 함께 성장하는 커뮤니티 플랫폼입니다.

### 네이밍 의미
```
CC = Claude Code
Gather = 모이다 + 수집하다

"전 세계 Claude Code 개발자들이 모이는 곳"
"사용량 데이터를 수집하는 플랫폼"
```

### 태그라인
```
"Where CC Developers Gather"
"Gather. Compete. Rise."
```

---

## 핵심 가치 제안

| 가치 | 설명 |
|------|------|
| **🌍 글로벌 경쟁** | 전 세계 개발자들과 실시간으로 순위 경쟁 |
| **🇰🇷 국가별 연합** | 국가 리그를 통한 소속감과 국가 대항전 |
| **📊 데이터 인사이트** | 개인 사용 패턴 분석 및 시각화 |
| **🏆 게이미피케이션** | 뱃지, 레벨 시스템을 통한 동기 부여 |
| **📰 뉴스 허브** | Claude Code 관련 최신 소식 AI 요약 |

---

## 타겟 사용자

### Primary
- Claude Code 헤비 유저 (월 1B+ 토큰)
- Vibe Coding 실천자
- AI-assisted 개발에 진심인 개발자

### Secondary
- Claude Code 입문자 (벤치마킹 목적)
- 개발 팀 리더 (팀원 사용량 파악)
- AI 코딩 도구 트렌드에 관심 있는 개발자

---

# 🏗️ 기술 아키텍처

## 레포지토리 전략: Monorepo + Private 분리

### Public vs Private 분리

```
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Repository                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📂 ccgather (PUBLIC)          ← github.com/DHxYoon/ccgather│
│  │                                                          │
│  │  ✅ 프론트엔드 코드                                       │
│  │  ✅ CLI 패키지                                            │
│  │  ✅ 기본 API Routes                                       │
│  │  ✅ DB 스키마                                             │
│  │  ✅ README, 문서                                          │
│  │                                                          │
│  │  🔒 /internal/ (.gitignore로 제외)                       │
│  │     ├── 크롤링 로직                                       │
│  │     ├── AI 요약 프롬프트/파이프라인                        │
│  │     └── 어드민 도구                                       │
│  │                                                          │
└─────────────────────────────────────────────────────────────┘
```

### 공개/비공개 구분

| 구분 | 공개 여부 | 이유 |
|------|----------|------|
| 프론트엔드 | ✅ Public | 신뢰 구축, 오픈소스 |
| CLI | ✅ Public | 사용자가 코드 확인 가능 |
| 기본 API | ✅ Public | 투명성 |
| DB 스키마 | ✅ Public | 데이터 구조 공개 |
| **크롤링 로직** | 🔒 Private | 핵심 기술 보호 |
| **AI 요약 프롬프트** | 🔒 Private | 핵심 기술 보호 |
| **어드민 도구** | 🔒 Private | 보안 |

---

## Monorepo 폴더 구조

```
📂 ccgather/
│
├── 📂 app/                      # ✅ PUBLIC - Next.js App Router
│   ├── 📂 (auth)/
│   │   ├── sign-in/[[...sign-in]]/page.tsx   # Clerk
│   │   └── sign-up/[[...sign-up]]/page.tsx   # Clerk
│   ├── 📂 (main)/
│   │   ├── page.tsx             # 랜딩 페이지
│   │   ├── leaderboard/page.tsx
│   │   ├── league/[country]/page.tsx
│   │   ├── u/[username]/page.tsx
│   │   ├── news/page.tsx
│   │   └── settings/page.tsx
│   ├── 📂 api/
│   │   ├── webhooks/
│   │   │   └── clerk/route.ts   # Clerk → Supabase 동기화
│   │   ├── submit/route.ts
│   │   ├── leaderboard/route.ts
│   │   ├── user/[username]/route.ts
│   │   ├── countries/route.ts
│   │   ├── news/route.ts
│   │   └── og/profile/[username]/route.tsx
│   ├── layout.tsx
│   ├── globals.css
│   └── providers.tsx
│
├── 📂 components/               # ✅ PUBLIC - UI 컴포넌트
│   ├── 📂 ui/                   # shadcn/ui 컴포넌트
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   └── ...
│   ├── 📂 layout/
│   │   ├── header.tsx
│   │   ├── footer.tsx
│   │   └── sidebar.tsx
│   ├── 📂 leaderboard/
│   │   ├── leaderboard-table.tsx
│   │   ├── leaderboard-row.tsx
│   │   ├── top-three-podium.tsx
│   │   ├── rank-change-badge.tsx
│   │   └── country-filter.tsx
│   ├── 📂 profile/
│   │   ├── profile-header.tsx
│   │   ├── profile-stats.tsx
│   │   ├── profile-chart.tsx
│   │   ├── activity-heatmap.tsx
│   │   └── badge-collection.tsx
│   ├── 📂 news/
│   │   ├── news-feed.tsx
│   │   └── news-card.tsx
│   └── 📂 shared/
│       ├── animated-counter.tsx
│       ├── glass-card.tsx
│       ├── level-badge.tsx
│       └── country-flag.tsx
│
├── 📂 lib/                      # ✅ PUBLIC - 유틸리티
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── types.ts
│   ├── utils/
│   │   ├── format.ts            # 숫자 포맷팅
│   │   ├── date.ts              # 날짜 처리
│   │   └── countries.ts         # 국가 데이터
│   ├── constants/
│   │   ├── levels.ts            # 레벨 정의
│   │   ├── badges.ts            # 뱃지 정의
│   │   └── config.ts
│   └── hooks/
│       ├── use-leaderboard.ts
│       ├── use-profile.ts
│       └── use-realtime.ts
│
├── 📂 packages/                 # ✅ PUBLIC - CLI 패키지
│   └── 📂 cli/
│       ├── package.json
│       ├── bin/
│       │   └── ccgather.js
│       ├── src/
│       │   ├── index.ts
│       │   ├── commands/
│       │   │   ├── submit.ts
│       │   │   ├── setup.ts
│       │   │   ├── status.ts
│       │   │   └── uninstall.ts
│       │   ├── ui/
│       │   │   ├── ascii-logo.ts    # ASCII 아트 로고
│       │   │   ├── welcome.ts       # 웰컴 메시지
│       │   │   └── colors.ts        # 컬러 테마
│       │   ├── utils/
│       │   │   ├── auth.ts
│       │   │   ├── ccusage.ts
│       │   │   └── hook.ts
│       │   └── types.ts
│       └── README.md
│
├── 📂 supabase/                 # ✅ PUBLIC - DB 관련
│   ├── 📂 migrations/
│   │   ├── 001_init.sql
│   │   ├── 002_users.sql
│   │   ├── 003_usage_stats.sql
│   │   ├── 004_badges.sql
│   │   ├── 005_news.sql
│   │   └── 006_daily_snapshots.sql
│   ├── 📂 functions/
│   │   ├── submit/index.ts
│   │   └── calculate-ranks/index.ts
│   ├── config.toml
│   └── seed.sql
│
├── 📂 public/                   # ✅ PUBLIC - 정적 파일
│   ├── favicon.ico
│   ├── og-image.png
│   ├── logo.svg
│   └── badges/
│       ├── streak-7.svg
│       ├── billion-club.svg
│       └── ...
│
│
│  ╔═══════════════════════════════════════════════════════╗
│  ║  🔒 PRIVATE ZONE - .gitignore로 제외됨                 ║
│  ╚═══════════════════════════════════════════════════════╝
│
├── 📂 internal/                 # 🔒 PRIVATE (.gitignore)
│   │
│   ├── 📂 crawler/              # 🔒 뉴스 크롤링
│   │   ├── sources/
│   │   │   ├── anthropic.ts
│   │   │   ├── github.ts
│   │   │   ├── reddit.ts
│   │   │   └── twitter.ts
│   │   ├── scheduler.ts
│   │   ├── parser.ts
│   │   └── index.ts
│   │
│   ├── 📂 ai/                   # 🔒 AI 요약
│   │   ├── summarizer.ts
│   │   ├── prompts/
│   │   │   ├── summarize.txt
│   │   │   └── categorize.txt
│   │   └── index.ts
│   │
│   ├── 📂 admin/                # 🔒 어드민 도구
│   │   ├── dashboard.tsx
│   │   ├── user-management.ts
│   │   └── analytics.ts
│   │
│   ├── 📂 scripts/              # 🔒 운영 스크립트
│   │   ├── backfill-ranks.ts
│   │   ├── cleanup-old-data.ts
│   │   └── sync-badges.ts
│   │
│   └── README.md
│
│
│  ╔═══════════════════════════════════════════════════════╗
│  ║  ⚙️ CONFIG FILES                                       ║
│  ╚═══════════════════════════════════════════════════════╝
│
├── .env.example                 # ✅ PUBLIC
├── .env.local                   # 🔒 PRIVATE
├── .gitignore                   # ✅ PUBLIC
├── .eslintrc.json
├── .prettierrc
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── pnpm-workspace.yaml
├── LICENSE                      # MIT
└── README.md
```

---

## .gitignore 설정

```gitignore
# ══════════════════════════════════════════════════════════
# 🔒 PRIVATE - 절대 GitHub에 올라가면 안 되는 것들
# ══════════════════════════════════════════════════════════

# 🔒 Internal 폴더 (크롤링, AI, 어드민)
/internal/

# 🔒 환경변수 (API 키, 시크릿)
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
.env.production

# 🔒 비밀 키
*.pem
*.key
secrets/


# ══════════════════════════════════════════════════════════
# 📦 Dependencies
# ══════════════════════════════════════════════════════════
node_modules/
.pnpm-store/


# ══════════════════════════════════════════════════════════
# 🔨 Build Outputs
# ══════════════════════════════════════════════════════════
.next/
out/
dist/
build/
.turbo/


# ══════════════════════════════════════════════════════════
# 🧪 Testing
# ══════════════════════════════════════════════════════════
coverage/
.nyc_output/


# ══════════════════════════════════════════════════════════
# 💻 IDE & OS
# ══════════════════════════════════════════════════════════
.idea/
.vscode/
*.swp
*.swo
.DS_Store
Thumbs.db


# ══════════════════════════════════════════════════════════
# 📝 Logs
# ══════════════════════════════════════════════════════════
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*


# ══════════════════════════════════════════════════════════
# 🗄️ Database
# ══════════════════════════════════════════════════════════
*.sqlite
*.db


# ══════════════════════════════════════════════════════════
# 📊 Misc
# ══════════════════════════════════════════════════════════
.vercel/
.netlify/
*.tsbuildinfo
next-env.d.ts
```

---

## 환경변수 설정

### .env.example (Public - 템플릿)

```env
# ══════════════════════════════════════════════════════════
# 🌐 App
# ══════════════════════════════════════════════════════════
NEXT_PUBLIC_APP_URL=https://ccgather.com
NEXT_PUBLIC_APP_NAME=CCGather

# ══════════════════════════════════════════════════════════
# 🔐 Clerk (Authentication)
# ══════════════════════════════════════════════════════════
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_SECRET_KEY=sk_test_xxxxx
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding
CLERK_WEBHOOK_SECRET=whsec_xxxxx

# ══════════════════════════════════════════════════════════
# 🗄️ Supabase (Database)
# ══════════════════════════════════════════════════════════
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# ══════════════════════════════════════════════════════════
# 🤖 AI (for news summarization) - INTERNAL USE ONLY
# ══════════════════════════════════════════════════════════
ANTHROPIC_API_KEY=your_anthropic_api_key

# ══════════════════════════════════════════════════════════
# 📊 Analytics
# ══════════════════════════════════════════════════════════
NEXT_PUBLIC_VERCEL_ANALYTICS_ID=your_analytics_id

# ══════════════════════════════════════════════════════════
# 🐛 Error Tracking
# ══════════════════════════════════════════════════════════
SENTRY_DSN=your_sentry_dsn
```

---

## 프론트엔드 스택

```yaml
Framework: Next.js 15 (App Router)
Language: TypeScript 5.x
Package Manager: pnpm (Monorepo 지원)

Authentication: Clerk
  - GitHub OAuth
  - 10,000 MAU 무료
  - 빌트인 UI 컴포넌트

Styling:
  - Tailwind CSS 4.x
  - shadcn/ui (최신)
  - CSS Variables for theming

Animation:
  - Framer Motion 11.x
  - CSS Transitions

Charts:
  - Recharts 2.x
  - Custom Activity Heatmap

Components:
  - 21st.dev registry
  - Lucide React (icons)
  - React Icons (보조)

State Management:
  - TanStack Query v5 (서버 상태)
  - Zustand (클라이언트 상태)

Forms:
  - React Hook Form
  - Zod (validation)
```

## 백엔드 스택

```yaml
Database: Supabase (PostgreSQL)
  - Row Level Security (RLS)
  - Real-time subscriptions
  - Edge Functions

Auth: Clerk
  - GitHub OAuth provider
  - Webhook → Supabase 동기화

Storage: Supabase Storage
  - OG images cache
  - User uploads (future)

Hosting: Vercel
  - Edge Runtime
  - ISR (Incremental Static Regeneration)
  - Edge Functions

Analytics:
  - Vercel Analytics
  - Vercel Speed Insights

Monitoring:
  - Sentry (에러 트래킹)
  - Vercel Logs
```

## 인프라 구조

```
┌─────────────────────────────────────────────────────────────┐
│                         Vercel                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Next.js   │  │    Edge     │  │   Static    │         │
│  │     App     │  │  Functions  │  │   Assets    │         │
│  └──────┬──────┘  └──────┬──────┘  └─────────────┘         │
│         │                │                                  │
└─────────┼────────────────┼──────────────────────────────────┘
          │                │
          ▼                ▼
┌──────────────┐    ┌─────────────────────────────────────────┐
│    Clerk     │    │                Supabase                 │
│  ┌────────┐  │    │  ┌──────────┐  ┌─────────┐  ┌────────┐ │
│  │ Auth   │──┼────┼─▶│PostgreSQL│  │Realtime │  │Storage │ │
│  │ GitHub │  │    │  │    DB    │  │ Server  │  │        │ │
│  └────────┘  │    │  └──────────┘  └─────────┘  └────────┘ │
└──────────────┘    │  ┌──────────────────────────┐          │
     Webhook        │  │  🔒 Private Edge Funcs   │          │
        │           │  │  - news-crawler          │          │
        └──────────▶│  │  - ai-summarizer         │          │
                    │  └──────────────────────────┘          │
                    └─────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                    External Services                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   GitHub    │  │  Anthropic  │  │   Crawling  │         │
│  │    OAuth    │  │  Claude API │  │   Sources   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

---

## 인증 시스템: Clerk + Supabase 연동

### 인증 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                     Authentication Flow                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────┐      ┌───────────┐      ┌───────────┐       │
│  │   User    │─────▶│   Clerk   │─────▶│  GitHub   │       │
│  │           │      │  (Auth)   │◀─────│   OAuth   │       │
│  └───────────┘      └─────┬─────┘      └───────────┘       │
│                           │                                 │
│                    Webhook│(user.created)                   │
│                           │                                 │
│                           ▼                                 │
│                    ┌─────────────┐                          │
│                    │  Supabase   │                          │
│                    │    (DB)     │                          │
│                    │             │                          │
│                    │ users table │                          │
│                    └─────────────┘                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Clerk 설정

```typescript
// middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/leaderboard(.*)',
  '/u/(.*)',
  '/league/(.*)',
  '/news(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks/(.*)',
  '/api/og/(.*)',
]);

export default clerkMiddleware((auth, req) => {
  if (!isPublicRoute(req)) {
    auth().protect();
  }
});

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
```

### Clerk → Supabase 동기화 Webhook

```typescript
// app/api/webhooks/clerk/route.ts
import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET!;
  
  const headerPayload = headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      'svix-id': svix_id!,
      'svix-timestamp': svix_timestamp!,
      'svix-signature': svix_signature!,
    }) as WebhookEvent;
  } catch (err) {
    return new Response('Webhook verification failed', { status: 400 });
  }

  // Handle user.created event
  if (evt.type === 'user.created') {
    const { id, username, image_url, external_accounts } = evt.data;
    
    const githubAccount = external_accounts?.find(
      (acc) => acc.provider === 'github'
    );

    await supabase.from('users').insert({
      clerk_id: id,
      github_id: githubAccount?.provider_user_id,
      username: username || githubAccount?.username,
      display_name: evt.data.first_name || username,
      avatar_url: image_url,
      email: evt.data.email_addresses?.[0]?.email_address,
    });
  }

  // Handle user.updated event
  if (evt.type === 'user.updated') {
    const { id, username, image_url } = evt.data;
    
    await supabase
      .from('users')
      .update({
        username: username,
        avatar_url: image_url,
        updated_at: new Date().toISOString(),
      })
      .eq('clerk_id', id);
  }

  // Handle user.deleted event
  if (evt.type === 'user.deleted') {
    await supabase
      .from('users')
      .delete()
      .eq('clerk_id', evt.data.id);
  }

  return new Response('Webhook processed', { status: 200 });
}
```

### Clerk UI 커스터마이징

```tsx
// app/(auth)/sign-in/[[...sign-in]]/page.tsx
import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0A0B]">
      <SignIn 
        appearance={{
          elements: {
            rootBox: 'mx-auto',
            card: 'bg-[#18181B] border border-white/10',
            headerTitle: 'text-white',
            headerSubtitle: 'text-gray-400',
            socialButtonsBlockButton: 
              'bg-white/5 border-white/10 text-white hover:bg-white/10',
            socialButtonsBlockButtonText: 'text-white font-medium',
            formButtonPrimary: 
              'bg-gradient-to-r from-[#FF6B35] to-[#F7931E] hover:opacity-90',
            footerActionLink: 'text-[#FF6B35] hover:text-[#F7931E]',
          },
        }}
      />
    </div>
  );
}
```

### 온보딩 플로우

```
1. GitHub 로그인 버튼 클릭 (Clerk UI)
2. GitHub OAuth 인증
3. Clerk Webhook → Supabase 유저 생성
4. 첫 로그인 감지 → 온보딩 페이지 리다이렉트
5. 국가 선택 (필수)
   - 검색 가능한 드롭다운
   - 국기 이모지 + 국가명
   - 상위 노출: 🇰🇷 🇺🇸 🇯🇵 🇩🇪 🇬🇧 🇫🇷 🇨🇳 🇮🇳
6. 타임존 자동 감지 (수정 가능)
7. 프로필 완성 → 대시보드 이동
```

---

## 데이터베이스 스키마

```sql
-- =====================
-- Users Table
-- =====================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id TEXT UNIQUE NOT NULL,        -- Clerk user ID
  github_id TEXT UNIQUE,                 -- GitHub user ID
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  email TEXT,
  country_code CHAR(2),                  -- 온보딩에서 설정
  timezone TEXT DEFAULT 'UTC',
  
  -- Stats (denormalized for performance)
  total_tokens BIGINT DEFAULT 0,
  total_cost DECIMAL(12, 4) DEFAULT 0,
  current_level INTEGER DEFAULT 1,
  global_rank INTEGER,
  country_rank INTEGER,
  
  -- Primary model tracking
  primary_model TEXT,
  primary_model_updated_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_submission_at TIMESTAMPTZ,
  
  -- Settings
  auto_sync_enabled BOOLEAN DEFAULT FALSE,
  profile_visible BOOLEAN DEFAULT TRUE,
  onboarding_completed BOOLEAN DEFAULT FALSE
);

-- =====================
-- Usage Stats Table
-- =====================
CREATE TABLE usage_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Date (UTC)
  date DATE NOT NULL,
  
  -- Token breakdown
  input_tokens BIGINT DEFAULT 0,
  output_tokens BIGINT DEFAULT 0,
  cache_read_tokens BIGINT DEFAULT 0,
  cache_write_tokens BIGINT DEFAULT 0,
  total_tokens BIGINT DEFAULT 0,
  
  -- Cost
  cost_usd DECIMAL(10, 4) DEFAULT 0,
  
  -- Model used most that day
  primary_model TEXT,
  
  -- Submission metadata
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  submission_source TEXT, -- 'cli', 'hook', 'api'
  
  -- Validation
  validation_status TEXT DEFAULT 'approved', -- 'approved', 'flagged', 'rejected'
  
  UNIQUE(user_id, date)
);

-- =====================
-- User Badges Table
-- =====================
CREATE TABLE user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  badge_type TEXT NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, badge_type)
);

-- =====================
-- Badge Display Table
-- =====================
CREATE TABLE badge_display (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  displayed_badges TEXT[] DEFAULT '{}', -- Max 8 badge_types
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- Country Stats Table (Materialized)
-- =====================
CREATE TABLE country_stats (
  country_code CHAR(2) PRIMARY KEY,
  country_name TEXT NOT NULL,
  total_users INTEGER DEFAULT 0,
  total_tokens BIGINT DEFAULT 0,
  total_cost DECIMAL(14, 4) DEFAULT 0,
  global_rank INTEGER,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- News Items Table
-- =====================
CREATE TABLE news_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source info
  source_url TEXT UNIQUE NOT NULL,
  source_name TEXT NOT NULL,
  source_type TEXT, -- 'official', 'github', 'reddit', 'twitter'
  
  -- Original content
  original_title TEXT NOT NULL,
  original_content TEXT,
  
  -- AI summary (🔒 생성 로직은 private)
  summary_md TEXT, -- Markdown format
  key_points TEXT[], -- Array of key points
  category TEXT, -- 'update', 'feature', 'community', 'tip'
  relevance_score INTEGER, -- 0-100
  
  -- Metadata
  published_at TIMESTAMPTZ,
  crawled_at TIMESTAMPTZ DEFAULT NOW(),
  summarized_at TIMESTAMPTZ,
  
  -- Display
  is_featured BOOLEAN DEFAULT FALSE,
  is_visible BOOLEAN DEFAULT TRUE
);

-- =====================
-- Daily Snapshots Table (for historical rankings)
-- =====================
CREATE TABLE daily_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  global_rank INTEGER,
  country_rank INTEGER,
  total_tokens BIGINT,
  total_cost DECIMAL(12, 4),
  level INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(snapshot_date, user_id)
);

-- =====================
-- Indexes
-- =====================
CREATE INDEX idx_users_clerk_id ON users(clerk_id);
CREATE INDEX idx_usage_user_date ON usage_stats(user_id, date DESC);
CREATE INDEX idx_usage_date ON usage_stats(date DESC);
CREATE INDEX idx_users_country ON users(country_code);
CREATE INDEX idx_users_global_rank ON users(global_rank);
CREATE INDEX idx_users_total_tokens ON users(total_tokens DESC);
CREATE INDEX idx_news_crawled ON news_items(crawled_at DESC);
CREATE INDEX idx_news_category ON news_items(category);
CREATE INDEX idx_snapshots_date ON daily_snapshots(snapshot_date DESC);

-- =====================
-- Row Level Security
-- =====================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

-- Public read for profiles
CREATE POLICY "Public profiles are viewable by everyone"
  ON users FOR SELECT
  USING (profile_visible = TRUE);

-- Users can update own profile
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid()::text = clerk_id);

-- Usage stats are public
CREATE POLICY "Usage stats are viewable by everyone"
  ON usage_stats FOR SELECT
  USING (TRUE);

-- Users can insert own stats
CREATE POLICY "Users can insert own stats"
  ON usage_stats FOR INSERT
  WITH CHECK (
    user_id IN (
      SELECT id FROM users WHERE clerk_id = auth.uid()::text
    )
  );
```

---

# 🎯 기능 명세

## 1. 리더보드 시스템

### 1.1 글로벌 리더보드

```
URL: /leaderboard

필터 옵션:
├── 기간: [Today] [7D] [30D] [All Time]
├── 정렬: [Tokens ↓] [Cost ↓]
└── 범위: [🌍 Global] [🇰🇷 Korea] [🇺🇸 USA] ...
```

### 1.2 리더보드 테이블 구조

| 컬럼 | 설명 | 정렬 |
|------|------|------|
| Rank | 순위 + 변동 | - |
| Country | 국기 이모지 | - |
| User | 아바타 + 이름 + @username | - |
| Level | 레벨 아이콘 + 숫자 | - |
| Model | 주 사용 모델 | - |
| Tokens | 토큰 사용량 | ✅ |
| Cost | 비용 (USD) | ✅ |
| Trend | 순위 변동 (↑3, ↓1, -) | - |

### 1.3 페이지네이션

```typescript
// 데스크탑: 페이지네이션
const ITEMS_PER_PAGE = 25;

// 기능
- 페이지 번호 네비게이션
- "내 순위로 바로가기" 버튼 (로그인 시)
- 키보드 단축키: ← → 페이지 이동, G 내 순위
```

### 1.4 Top 3 Podium

```
┌─────────────────────────────────────────┐
│           🥇 1st Place                  │
│         ┌─────────────┐                 │
│         │   Avatar    │                 │
│         │   Crown     │                 │
│         │  Username   │                 │
│         │  12.5B 토큰 │                 │
│         │   $4,521    │                 │
│         └─────────────┘                 │
│    🥈 2nd          🥉 3rd               │
│  ┌───────┐      ┌───────┐              │
│  │Avatar │      │Avatar │              │
│  │ Name  │      │ Name  │              │
│  │ Stats │      │ Stats │              │
│  └───────┘      └───────┘              │
└─────────────────────────────────────────┘

* Framer Motion으로 입장 애니메이션
* 글로우 이펙트 (1위: 금색, 2위: 은색, 3위: 동색)
```

### 1.5 실시간 업데이트

```typescript
// Supabase Realtime 구독
const channel = supabase
  .channel('leaderboard-changes')
  .on(
    'postgres_changes',
    { 
      event: '*', 
      schema: 'public', 
      table: 'usage_stats' 
    },
    (payload) => {
      // 순위 재계산 및 애니메이션 트리거
      recalculateRankings();
      animateRankChange(payload);
    }
  )
  .subscribe();
```

---

## 2. 국가별 리그 시스템

### 2.1 국가 리그 페이지

```
URL: /league/kr (국가 코드)

구성:
├── 국가 헤더 (국기 + 국가명 + 통계)
├── 국가 내 리더보드
├── 국가 총 사용량 차트
└── 글로벌 국가 순위
```

### 2.2 국가 대항전

```typescript
interface CountryStats {
  countryCode: string;
  countryName: string;
  totalUsers: number;
  totalTokens: bigint;
  totalCost: number;
  globalRank: number;
  weeklyGrowth: number; // 퍼센트
}

// 국가 순위 기준
// 1. 총 토큰 사용량
// 2. 활성 사용자 수
// 3. 주간 성장률
```

### 2.3 국가 통계 표시

```
┌─────────────────────────────────────────┐
│  🇰🇷 South Korea                        │
│  ─────────────────────────────────────  │
│  Global Rank: #3                        │
│  Total Developers: 1,234                │
│  Total Tokens: 456.7B                   │
│  Total Spent: $12,345                   │
│  This Week: +15.3% 📈                   │
└─────────────────────────────────────────┘
```

---

## 3. 프로필 시스템

### 3.1 프로필 URL 구조

```
/u/{username}  또는  /profile/{username}
예: ccgather.com/u/logan
```

### 3.2 프로필 표시 방식 (하이브리드)

**Desktop: Side Panel**
```
┌────────────────────────┬─────────────────┐
│                        │                 │
│     Leaderboard        │    Profile      │
│     (축소 유지)         │    Side Panel   │
│                        │    (Drawer)     │
│                        │                 │
│     ← 클릭하면 패널 →   │    [Full View]  │
│                        │                 │
└────────────────────────┴─────────────────┘

- 리더보드 행 클릭 → 우측 패널 슬라이드
- 패널 내 "View Full Profile" 링크
- ESC 또는 바깥 클릭으로 닫기
```

**Mobile: 새 페이지**
```
리더보드 행 탭 → /u/{username} 페이지 이동
← 뒤로가기로 리더보드 복귀
```

### 3.3 프로필 페이지 구성

```
┌─────────────────────────────────────────────────────────────┐
│  Profile Header                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  [Avatar]  @username                                    ││
│  │            Display Name                                 ││
│  │            🇰🇷 South Korea                              ││
│  │            Level 7 ⚔️ Grandmaster                       ││
│  │                                                         ││
│  │  🏅 뱃지 아이콘들 (최대 8개 표시)                          ││
│  │                                                         ││
│  │  Global #42 (↑3) │ Korea #7 (↑1)                       ││
│  │                                                         ││
│  │  [GitHub] [Share] [Export]                              ││
│  └─────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│  Stats Cards                                                │
│  ┌───────────┬───────────┬───────────┬───────────┐         │
│  │Total Cost │Total Token│  Avg/Day  │Active Days│         │
│  │  $1,234   │   45.6B   │   $41     │    142    │         │
│  │  💰       │   📊      │   📈      │    🔥     │         │
│  └───────────┴───────────┴───────────┴───────────┘         │
├─────────────────────────────────────────────────────────────┤
│  Primary Model                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Currently using: claude-sonnet-4-5-20250929            ││
│  │  Previously: claude-opus-4-5-20251101                   ││
│  └─────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│  Usage Chart (Recharts Area)                                │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  [7D] [30D] [90D] [All]                                 ││
│  │                                                         ││
│  │  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~            ││
│  │     (일별 비용/토큰 Area Chart)                          ││
│  │                                                         ││
│  └─────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│  Activity Heatmap (GitHub Style)                            │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Mon ░░▓▓░░▓▓▓▓░░░░▓▓▓▓▓▓░░▓▓░░░░▓▓▓▓░░▓▓▓▓▓▓          ││
│  │  Tue ▓▓▓▓░░▓▓░░▓▓░░▓▓▓▓░░▓▓░░▓▓▓▓░░▓▓▓▓░░▓▓▓▓          ││
│  │  Wed ░░▓▓▓▓░░▓▓▓▓▓▓░░▓▓▓▓▓▓▓▓░░▓▓░░▓▓▓▓▓▓░░▓▓          ││
│  │  ...                                                    ││
│  │  Less ░░░░▓▓▓▓████ More                                ││
│  └─────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│  Badges Collection                                          │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  🔥 Streak Master    💎 Diamond Hands    🌙 Night Owl   ││
│  │  🚀 Rocket           🎯 Consistent       🏆 Top 10      ││
│  │  (잠긴 뱃지는 흐리게 표시)                                ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## 4. 레벨 시스템

### 4.1 레벨 테이블 (누적 토큰 기준)

| Level | 명칭 | 토큰 범위 | 아이콘 | 색상 |
|-------|------|----------|--------|------|
| 1 | Rookie | 0 ~ 10M | 🌱 | #22C55E |
| 2 | Coder | 10M ~ 50M | ⚡ | #3B82F6 |
| 3 | Builder | 50M ~ 200M | 🔨 | #8B5CF6 |
| 4 | Architect | 200M ~ 500M | 🏗️ | #EC4899 |
| 5 | Expert | 500M ~ 1B | 💎 | #06B6D4 |
| 6 | Master | 1B ~ 3B | 🔥 | #F97316 |
| 7 | Grandmaster | 3B ~ 10B | ⚔️ | #EF4444 |
| 8 | Legend | 10B ~ 30B | 👑 | #EAB308 |
| 9 | Titan | 30B ~ 100B | 🌟 | #A855F7 |
| 10 | Immortal | 100B+ | 🏆 | #FFD700 (금색 글로우) |

### 4.2 레벨 업 알림

```typescript
// 레벨 업 시 토스트 + 애니메이션
const levelUpNotification = {
  title: "🎉 Level Up!",
  message: "You've reached Level 7: Grandmaster ⚔️",
  animation: "confetti", // 색종이 애니메이션
  sound: true // 선택적 효과음
};
```

---

## 5. 뱃지 시스템

### 5.1 뱃지 목록

**활동 관련**
| 뱃지 | 이름 | 조건 | 아이콘 |
|------|------|------|--------|
| streak_7 | Week Warrior | 7일 연속 사용 | 🔥 |
| streak_30 | Monthly Master | 30일 연속 사용 | 🔥🔥 |
| streak_100 | Centurion | 100일 연속 사용 | 🔥🔥🔥 |
| early_bird | Early Bird | 오전 6-9시 사용 70%+ | ☀️ |
| night_owl | Night Owl | 오후 10시-2시 사용 70%+ | 🌙 |
| weekend_warrior | Weekend Warrior | 주말 사용량 > 평일 | 🎮 |

**사용량 관련**
| 뱃지 | 이름 | 조건 | 아이콘 |
|------|------|------|--------|
| billion_club | Billion Club | 누적 1B+ 토큰 | 💎 |
| 10b_club | 10B Club | 누적 10B+ 토큰 | 💎💎 |
| big_spender | Big Spender | 월 $500+ 사용 | 💰 |
| whale | Whale | 월 $1,000+ 사용 | 🐋 |

**순위 관련**
| 뱃지 | 이름 | 조건 | 아이콘 |
|------|------|------|--------|
| top_100 | Global 100 | 글로벌 Top 100 진입 | 🏅 |
| top_10 | Elite 10 | 글로벌 Top 10 진입 | 🏆 |
| country_first | National Champion | 국가 1위 달성 | 👑 |
| rising_star | Rising Star | 주간 순위 상승 50+ | 🚀 |

**특별 뱃지**
| 뱃지 | 이름 | 조건 | 아이콘 |
|------|------|------|--------|
| early_adopter | Early Adopter | 서비스 초기 가입자 | ⭐ |
| bug_hunter | Bug Hunter | 버그 리포트 기여 | 🐛 |
| contributor | Contributor | 오픈소스 기여 | 🤝 |

### 5.2 뱃지 표시

```typescript
// 프로필에 표시할 뱃지 선택 (최대 8개)
interface UserBadgeDisplay {
  userId: string;
  displayedBadges: string[]; // badge_id 배열, max 8
  totalBadges: number;
}
```

---

## 6. 뉴스피드 시스템

### 6.1 크롤링 소스 (🔒 Private)

```yaml
공식 소스:
  - url: https://www.anthropic.com/news
    type: blog
    priority: high
  - url: https://docs.anthropic.com/changelog
    type: changelog
    priority: high

GitHub:
  - repo: anthropics/claude-code
    type: releases
    priority: high
  - repo: anthropics/claude-code
    type: issues (labeled: announcement)
    priority: medium

커뮤니티:
  - url: https://www.reddit.com/r/ClaudeAI
    type: reddit
    filter: hot, top (weekly)
    priority: medium
  - source: Hacker News
    search: "Claude Code" OR "Anthropic"
    priority: medium

소셜:
  - account: @AnthropicAI
    platform: X/Twitter
    priority: medium
```

### 6.2 AI 요약 파이프라인 (🔒 Private)

```typescript
interface NewsItem {
  id: string;
  sourceUrl: string;
  sourceName: string;
  originalTitle: string;
  originalContent: string;
  crawledAt: Date;
  
  // AI 처리 결과
  summary: string; // 마크다운, 3-5문장
  keyPoints: string[]; // 핵심 포인트 3개
  category: 'update' | 'feature' | 'community' | 'tip';
  relevanceScore: number; // 0-100
}

// AI 요약 프롬프트 (🔒 Private - internal/ai/prompts/)
const summaryPrompt = `
다음 기사를 Claude Code 사용자 관점에서 요약해주세요.

요구사항:
- 마크다운 형식
- 3-5문장으로 핵심만
- 기술적 세부사항 포함
- 한국어와 영어 모두 지원

출력 형식:
## 요약
[요약 내용]

### 핵심 포인트
- [포인트 1]
- [포인트 2]
- [포인트 3]

> 출처: [원문 제목](원문 URL)
`;
```

### 6.3 뉴스피드 UI

```
URL: /news 또는 /updates

┌─────────────────────────────────────────────────────────────┐
│  📰 Latest Updates                                          │
│  ─────────────────────────────────────────────────────────  │
│  [All] [Updates] [Features] [Community] [Tips]              │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 🆕 Claude Code 1.2.0 Released                          ││
│  │ 2 hours ago • anthropic.com                            ││
│  │                                                         ││
│  │ Claude Code 1.2.0에서 새로운 MCP 서버 지원과             ││
│  │ 성능 개선이 이루어졌습니다. 특히 대용량 파일 처리          ││
│  │ 속도가 40% 향상되었습니다.                               ││
│  │                                                         ││
│  │ • MCP 서버 네이티브 지원                                 ││
│  │ • 파일 처리 성능 40% 향상                               ││
│  │ • 새로운 /compact 명령어 추가                           ││
│  │                                                         ││
│  │ > 출처: [Claude Code 1.2.0 Release](https://...)       ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 💡 Community Tip: Optimizing Token Usage                ││
│  │ 1 day ago • reddit.com/r/ClaudeAI                      ││
│  │ ...                                                     ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### 6.4 크롤링 스케줄 (🔒 Private)

```yaml
schedule:
  anthropic_official: "0 */2 * * *"  # 2시간마다
  github_releases: "0 */6 * * *"      # 6시간마다
  reddit: "0 */12 * * *"              # 12시간마다
  twitter: "0 */4 * * *"              # 4시간마다
  
rate_limits:
  max_items_per_crawl: 20
  ai_summary_batch_size: 10
  
retention:
  keep_days: 90
  archive_after: 30
```

### 6.5 데이터 흐름

```
┌─────────────────────────────────────────────────────────────┐
│  🔒 PRIVATE (Supabase Edge Functions)                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Cron: 2시간마다]                                           │
│         │                                                   │
│         ▼                                                   │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │   Crawler   │───▶│  AI 요약    │───▶│  DB 저장    │     │
│  │  (크롤링)   │    │  (Claude)   │    │ (Supabase)  │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│                                                             │
│  * 이 코드는 GitHub에 없음                                   │
│  * Supabase Dashboard에서만 관리                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│  ✅ PUBLIC (Next.js API)                                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  GET /api/news                                              │
│         │                                                   │
│         ▼                                                   │
│  ┌─────────────┐    ┌─────────────┐                        │
│  │  DB에서     │───▶│  클라이언트 │                        │
│  │  읽기만     │    │  표시       │                        │
│  └─────────────┘    └─────────────┘                        │
│                                                             │
│  * 단순 조회 로직만 공개                                     │
│  * 크롤링/AI 로직 없음                                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. 데이터 제출 시스템

### 7.1 제출 방식 (2-Tier)

```
┌─────────────────────────────────────────────────────────────┐
│                  🎯 Tier 1: Quick Submit                    │
│                  (원할 때 수동 제출)                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   $ npx ccgather                                            │
│                                                             │
│   실행 플로우:                                               │
│   1. 첫 실행 시: 브라우저에서 GitHub OAuth                   │
│   2. ccusage 자동 실행 → 데이터 추출                         │
│   3. 서버로 제출                                             │
│   4. 결과 출력:                                              │
│      ┌────────────────────────────────────┐                │
│      │ ✅ Submitted successfully!         │                │
│      │                                    │                │
│      │ Today: 234,567 tokens ($8.42)     │                │
│      │ Global Rank: #42 (↑3)             │                │
│      │ Korea Rank: #7 (↑1)               │                │
│      │                                    │                │
│      │ 🔗 ccgather.com/u/logan           │                │
│      └────────────────────────────────────┘                │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                 ⚡ Tier 2: Auto Sync                        │
│                 (설정 후 자동 제출)                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   $ npx ccgather setup                                      │
│                                                             │
│   설정 플로우:                                               │
│   1. GitHub OAuth 인증 (최초 1회)                           │
│   2. Claude Code Stop Hook 자동 설치                        │
│      → ~/.claude/settings.json 수정                        │
│   3. 인증 토큰 저장                                          │
│      → ~/.ccgather/config.json                             │
│                                                             │
│   이후 동작:                                                 │
│   - Claude Code 세션 종료 시 자동 제출                       │
│   - 백그라운드로 조용히 동작                                  │
│   - 터미널에 간단한 결과만 출력                               │
│                                                             │
│   관리 명령어:                                               │
│   $ npx ccgather status    # 현재 상태 확인                 │
│   $ npx ccgather pause     # 자동 제출 일시 중지             │
│   $ npx ccgather resume    # 자동 제출 재개                  │
│   $ npx ccgather uninstall # 완전 삭제 + 계정 삭제 옵션      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 데이터 검증

```typescript
interface UsageValidation {
  // 필수 검증 (자동 거부)
  tokenMathValid: boolean;      // input + output + cache = total
  noNegativeValues: boolean;    // 모든 값 >= 0
  noFutureDates: boolean;       // 미래 날짜 없음
  
  // 이상치 검사 (플래그)
  dailyCostUnder5000: boolean;  // 일 $5,000 미만
  dailyTokensUnder500B: boolean; // 일 500B 토큰 미만
  growthRateNormal: boolean;    // 전일 대비 1000% 미만 증가
}

// 검증 결과
type ValidationResult = 
  | { status: 'approved'; submissionId: string }
  | { status: 'flagged'; reason: string; reviewId: string }
  | { status: 'rejected'; errors: string[] };
```

### 7.3 제출 정책

```yaml
rate_limits:
  min_interval: 10 minutes
  max_daily: 24 submissions
  
merging:
  same_date: keep_higher_value
  different_date: append
  no_deletion: true # 기존 데이터 절대 삭제 안 함

leaderboard_update:
  frequency: real-time
  daily_snapshot: "00:00 UTC"
```

### 7.4 프라이버시

```yaml
collected:
  ✅ token_usage:
    - input_tokens
    - output_tokens  
    - cache_read_tokens
    - cache_write_tokens
    - total_tokens
  ✅ cost_usd
  ✅ model_name
  ✅ date (UTC)
  ✅ github_profile (public info only)

not_collected:
  ❌ prompt_content
  ❌ response_content
  ❌ project_names
  ❌ file_paths
  ❌ file_content
  ❌ ip_address (hashed for abuse prevention)
```

---

## 8. 시간 표준화 시스템

### 8.1 UTC 기준 운영

```typescript
// 모든 데이터 저장: UTC
// 모든 리더보드 계산: UTC 00:00 기준

interface TimeConfig {
  storage: 'UTC';
  dailyReset: '00:00 UTC';
  weeklyReset: 'Monday 00:00 UTC';
  monthlyReset: '1st 00:00 UTC';
}

// 사용자 표시: 로컬 타임존으로 변환
function displayTime(utcTime: Date, userTimezone: string): string {
  return utcTime.toLocaleString('en-US', { 
    timeZone: userTimezone 
  });
}
```

### 8.2 타임존 처리

```typescript
// 온보딩 시 자동 감지
const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

// 수동 변경 가능 (설정에서)
// 지원 타임존: IANA timezone database 전체
```

---

## 9. 소셜 공유 시스템

### 9.1 동적 OG 이미지 생성

```typescript
// /api/og/profile/[username]

import { ImageResponse } from 'next/og';

export async function GET(
  request: Request,
  { params }: { params: { username: string } }
) {
  const user = await getUser(params.username);
  
  return new ImageResponse(
    (
      <div style={{
        width: '1200px',
        height: '630px',
        background: 'linear-gradient(135deg, #0A0A0B 0%, #18181B 100%)',
        display: 'flex',
        padding: '60px',
      }}>
        {/* 좌측: 유저 정보 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <img 
            src={user.avatarUrl} 
            style={{ 
              width: '120px', 
              height: '120px', 
              borderRadius: '60px',
              border: '4px solid #FF6B35'
            }} 
          />
          <h1 style={{ 
            color: '#FAFAFA', 
            fontSize: '48px',
            marginTop: '24px'
          }}>
            {user.displayName}
          </h1>
          <p style={{ color: '#A1A1AA', fontSize: '24px' }}>
            @{user.username} • {user.countryFlag}
          </p>
          <p style={{ 
            color: '#FF6B35', 
            fontSize: '32px',
            marginTop: '16px'
          }}>
            Level {user.level} {user.levelIcon} {user.levelName}
          </p>
        </div>
        
        {/* 우측: 통계 */}
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-end'
        }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ color: '#A1A1AA', fontSize: '20px' }}>Total Tokens</p>
            <p style={{ color: '#FAFAFA', fontSize: '56px', fontWeight: 'bold' }}>
              {formatTokens(user.totalTokens)}
            </p>
          </div>
          <div style={{ textAlign: 'right', marginTop: '32px' }}>
            <p style={{ color: '#A1A1AA', fontSize: '20px' }}>Global Rank</p>
            <p style={{ color: '#10B981', fontSize: '48px', fontWeight: 'bold' }}>
              #{user.globalRank}
            </p>
          </div>
        </div>
        
        {/* 하단: 로고 */}
        <div style={{ 
          position: 'absolute', 
          bottom: '40px', 
          right: '60px',
          display: 'flex',
          alignItems: 'center'
        }}>
          <span style={{ color: '#FF6B35', fontSize: '24px' }}>
            🌐 CCGather
          </span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
```

### 9.2 공유 버튼

```typescript
// 공유 옵션
const shareOptions = {
  twitter: {
    text: `I'm ranked #${rank} on CCGather! 🏆\n\n${formatTokens(tokens)} tokens used\nLevel ${level} ${levelIcon}\n\nTrack your Claude Code usage:`,
    url: `https://ccgather.com/u/${username}`,
    hashtags: ['CCGather', 'ClaudeCode', 'VibeCoding']
  },
  linkedin: {
    title: `My Claude Code Stats on CCGather`,
    summary: `Ranked #${rank} globally with ${formatTokens(tokens)} tokens`,
    url: `https://ccgather.com/u/${username}`
  },
  copy: {
    text: `https://ccgather.com/u/${username}`
  }
};
```

---

# 🖥️ CLI 시스템

## CLI ASCII 아트 디자인

### 메인 로고 (웰컴 화면)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│     ██████╗ ██████╗ ██████╗  █████╗ ████████╗██╗  ██╗███████╗██████╗       │
│    ██╔════╝██╔════╝██╔════╝ ██╔══██╗╚══██╔══╝██║  ██║██╔════╝██╔══██╗      │
│    ██║     ██║     ██║  ███╗███████║   ██║   ███████║█████╗  ██████╔╝      │
│    ██║     ██║     ██║   ██║██╔══██║   ██║   ██╔══██║██╔══╝  ██╔══██╗      │
│    ╚██████╗╚██████╗╚██████╔╝██║  ██║   ██║   ██║  ██║███████╗██║  ██║      │
│     ╚═════╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝      │
│                                                                             │
│                  Where Claude Code Developers Gather                        │
│                        Gather. Compete. Rise.                               │
│                                                                             │
│                           v1.0.0 • ccgather.com                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 컬러 버전 (터미널 출력)

```typescript
// packages/cli/src/ui/ascii-logo.ts
import chalk from 'chalk';

const orange = chalk.hex('#FF6B35');
const gold = chalk.hex('#F7931E');
const gray = chalk.gray;
const white = chalk.white;

export const LOGO = `
${orange('    ██████╗ ██████╗')}${gold(' ██████╗  █████╗ ████████╗██╗  ██╗███████╗██████╗ ')}
${orange('   ██╔════╝██╔════╝')}${gold('██╔════╝ ██╔══██╗╚══██╔══╝██║  ██║██╔════╝██╔══██╗')}
${orange('   ██║     ██║     ')}${gold('██║  ███╗███████║   ██║   ███████║█████╗  ██████╔╝')}
${orange('   ██║     ██║     ')}${gold('██║   ██║██╔══██║   ██║   ██╔══██║██╔══╝  ██╔══██╗')}
${orange('   ╚██████╗╚██████╗')}${gold('╚██████╔╝██║  ██║   ██║   ██║  ██║███████╗██║  ██║')}
${orange('    ╚═════╝ ╚═════╝')}${gold(' ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝')}
`;

export const TAGLINE = `
${white('              Where Claude Code Developers Gather')}
${gray('                    Gather. Compete. Rise.')}
`;

export const VERSION_LINE = (version: string) => `
${gray(`                        v${version} • ccgather.com`)}
`;
```

### 웰컴 메시지 (로그인 후)

```typescript
// packages/cli/src/ui/welcome.ts
import chalk from 'chalk';
import { LOGO, TAGLINE, VERSION_LINE } from './ascii-logo';

const orange = chalk.hex('#FF6B35');
const green = chalk.hex('#10B981');
const gray = chalk.gray;
const white = chalk.white;
const bold = chalk.bold;

export function showWelcome(user: {
  username: string;
  level: number;
  levelName: string;
  levelIcon: string;
  globalRank: number;
  countryRank: number;
  countryFlag: string;
}) {
  console.log(LOGO);
  console.log(TAGLINE);
  console.log(VERSION_LINE('1.0.0'));
  console.log();
  
  // 유저 정보 박스
  console.log(gray('  ┌─────────────────────────────────────────────┐'));
  console.log(gray('  │') + white(`  👋 Welcome back, ${bold(user.username)}!`) + gray('                │'));
  console.log(gray('  │') + `  ${user.levelIcon} Level ${user.level} • ${orange(user.levelName)}` + gray('              │'));
  console.log(gray('  │') + `  🌍 Global Rank: ${green('#' + user.globalRank)}` + gray('                     │'));
  console.log(gray('  │') + `  ${user.countryFlag} Country Rank: ${green('#' + user.countryRank)}` + gray('                   │'));
  console.log(gray('  └─────────────────────────────────────────────┘'));
  console.log();
}

export function showSubmitSuccess(result: {
  tokens: number;
  cost: number;
  globalRank: number;
  rankChange: number;
  profileUrl: string;
}) {
  const rankIndicator = result.rankChange > 0 
    ? green(`↑${result.rankChange}`) 
    : result.rankChange < 0 
    ? chalk.red(`↓${Math.abs(result.rankChange)}`)
    : gray('─');

  console.log();
  console.log(green('  ✅ Submitted successfully!'));
  console.log();
  console.log(gray('  ┌─────────────────────────────────────────────┐'));
  console.log(gray('  │') + white(`  📊 Today's Stats`) + gray('                            │'));
  console.log(gray('  │') + `     Tokens: ${orange(formatNumber(result.tokens))}` + gray('                    │'));
  console.log(gray('  │') + `     Cost:   ${orange('$' + result.cost.toFixed(2))}` + gray('                        │'));
  console.log(gray('  │') + gray('                                             │'));
  console.log(gray('  │') + white(`  🏆 Your Ranking`) + gray('                             │'));
  console.log(gray('  │') + `     Global: ${green('#' + result.globalRank)} (${rankIndicator})` + gray('              │'));
  console.log(gray('  │') + gray('                                             │'));
  console.log(gray('  │') + `  🔗 ${chalk.underline(result.profileUrl)}` + gray('      │'));
  console.log(gray('  └─────────────────────────────────────────────┘'));
  console.log();
}
```

### 터미널 출력 예시

```bash
$ npx ccgather

    ██████╗ ██████╗ ██████╗  █████╗ ████████╗██╗  ██╗███████╗██████╗ 
   ██╔════╝██╔════╝██╔════╝ ██╔══██╗╚══██╔══╝██║  ██║██╔════╝██╔══██╗
   ██║     ██║     ██║  ███╗███████║   ██║   ███████║█████╗  ██████╔╝
   ██║     ██║     ██║   ██║██╔══██║   ██║   ██╔══██║██╔══╝  ██╔══██╗
   ╚██████╗╚██████╗╚██████╔╝██║  ██║   ██║   ██║  ██║███████╗██║  ██║
    ╚═════╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝

              Where Claude Code Developers Gather
                    Gather. Compete. Rise.

                        v1.0.0 • ccgather.com

  ┌─────────────────────────────────────────────┐
  │  👋 Welcome back, logan!                    │
  │  ⚔️ Level 7 • Grandmaster                   │
  │  🌍 Global Rank: #42                        │
  │  🇰🇷 Country Rank: #7                        │
  └─────────────────────────────────────────────┘

? What would you like to do? (Use arrow keys)
❯ 📤 Submit usage data
  📊 View my stats
  ⚙️  Setup auto-sync
  🔧 Settings
  ❓ Help
```

---

## CLI 명령어 전체 목록

```bash
# 기본 사용
npx ccgather              # 인터랙티브 메뉴 (ASCII 로고 표시)
npx ccgather submit       # 즉시 제출
npx ccgather setup        # 자동 동기화 설정

# 상태 확인
npx ccgather status       # 현재 상태 및 순위
npx ccgather stats        # 상세 통계

# 자동 동기화 관리
npx ccgather pause        # 일시 중지
npx ccgather resume       # 재개

# 계정 관리
npx ccgather login        # GitHub 로그인
npx ccgather logout       # 로그아웃
npx ccgather uninstall    # 완전 삭제

# 도움말
npx ccgather --help       # 도움말
npx ccgather --version    # 버전 (ASCII 로고 포함)
```

---

# 🎨 디자인 시스템

## 컬러 팔레트

```css
:root {
  /* Primary - Orange Gradient */
  --primary: #FF6B35;
  --primary-light: #FF8C5A;
  --primary-dark: #E85A2A;
  --primary-gradient: linear-gradient(135deg, #FF6B35 0%, #F7931E 100%);
  
  /* Background - Deep Dark */
  --bg-primary: #0A0A0B;
  --bg-secondary: #111113;
  --bg-card: #18181B;
  --bg-card-hover: #1F1F23;
  --bg-elevated: #27272A;
  
  /* Glass Effect */
  --glass-bg: rgba(255, 255, 255, 0.03);
  --glass-border: rgba(255, 255, 255, 0.08);
  --glass-blur: 12px;
  
  /* Accent Colors */
  --accent-green: #10B981;
  --accent-red: #EF4444;
  --accent-blue: #3B82F6;
  --accent-purple: #8B5CF6;
  --accent-yellow: #EAB308;
  --accent-cyan: #06B6D4;
  
  /* Text */
  --text-primary: #FAFAFA;
  --text-secondary: #A1A1AA;
  --text-muted: #71717A;
  --text-disabled: #52525B;
  
  /* Borders */
  --border-default: rgba(255, 255, 255, 0.08);
  --border-hover: rgba(255, 255, 255, 0.15);
  --border-focus: var(--primary);
  
  /* Glow Effects */
  --glow-primary: 0 0 20px rgba(255, 107, 53, 0.3);
  --glow-green: 0 0 20px rgba(16, 185, 129, 0.3);
  --glow-gold: 0 0 30px rgba(255, 215, 0, 0.4);
  
  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.5);
  --shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.6);
}
```

## 타이포그래피

```css
/* Font Family */
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;

/* Font Sizes */
--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;   /* 18px */
--text-xl: 1.25rem;    /* 20px */
--text-2xl: 1.5rem;    /* 24px */
--text-3xl: 1.875rem;  /* 30px */
--text-4xl: 2.25rem;   /* 36px */
--text-5xl: 3rem;      /* 48px */

/* Font Weights */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;

/* Line Heights */
--leading-tight: 1.25;
--leading-normal: 1.5;
--leading-relaxed: 1.75;
```

## 컴포넌트 스타일

### Glass Card
```tsx
<div className="
  relative rounded-2xl 
  border border-white/10
  bg-gradient-to-br from-white/5 to-white/[0.02]
  backdrop-blur-xl
  shadow-xl
">
  {children}
</div>
```

### Glow Button
```tsx
<button className="
  px-6 py-3 rounded-xl
  bg-gradient-to-r from-[#FF6B35] to-[#F7931E]
  text-white font-semibold
  shadow-[0_0_20px_rgba(255,107,53,0.3)]
  hover:shadow-[0_0_30px_rgba(255,107,53,0.5)]
  transition-all duration-300
  hover:scale-105
">
  {children}
</button>
```

### Rank Change Badge
```tsx
// 상승
<span className="flex items-center gap-1 text-emerald-400">
  <TrendingUp className="w-4 h-4" />
  <span className="font-mono text-sm">+{change}</span>
</span>

// 하락
<span className="flex items-center gap-1 text-red-400">
  <TrendingDown className="w-4 h-4" />
  <span className="font-mono text-sm">{change}</span>
</span>
```

---

# 🔍 SEO 전략

## 메타데이터

```typescript
// app/layout.tsx
export const metadata: Metadata = {
  metadataBase: new URL('https://ccgather.com'),
  title: {
    default: 'CCGather - Where Claude Code Developers Gather',
    template: '%s | CCGather'
  },
  description: 'Real-time global leaderboard for Claude Code usage. Track your tokens, compete with developers worldwide, and rise through the ranks. Join the gathering!',
  keywords: [
    'Claude Code', 'Claude Code leaderboard', 'Claude Code usage',
    'AI coding', 'vibe coding', 'developer leaderboard',
    'token tracker', 'Anthropic', 'Claude AI',
    'AI development', 'code assistant stats'
  ],
  authors: [{ name: 'CCGather' }],
  creator: 'CCGather',
  publisher: 'CCGather',
  
  openGraph: {
    type: 'website',
    locale: 'en_US',
    alternateLocale: ['ko_KR', 'ja_JP', 'zh_CN'],
    url: 'https://ccgather.com',
    siteName: 'CCGather',
    title: 'CCGather - Where Claude Code Developers Gather',
    description: 'Real-time global leaderboard for Claude Code usage. Track, compete, and rise!',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'CCGather - Claude Code Leaderboard'
      }
    ]
  },
  
  twitter: {
    card: 'summary_large_image',
    title: 'CCGather - Where Claude Code Developers Gather',
    description: 'Real-time global leaderboard for Claude Code usage',
    images: ['/og-image.png'],
    creator: '@ccgather'
  },
  
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    }
  },
  
  verification: {
    google: 'google-site-verification-code',
  }
};
```

## 동적 메타데이터

```typescript
// app/u/[username]/page.tsx
export async function generateMetadata({ params }): Promise<Metadata> {
  const user = await getUser(params.username);
  
  return {
    title: `${user.displayName} (@${user.username}) - CCGather`,
    description: `${user.displayName} is Level ${user.level} ${user.levelName} with ${formatTokens(user.totalTokens)} tokens. Global Rank #${user.globalRank}. View their Claude Code usage stats on CCGather.`,
    openGraph: {
      title: `${user.displayName} on CCGather`,
      description: `Level ${user.level} ${user.levelIcon} | ${formatTokens(user.totalTokens)} tokens | Global #${user.globalRank}`,
      images: [`/api/og/profile/${user.username}`],
      type: 'profile',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${user.displayName} on CCGather`,
      description: `Level ${user.level} | ${formatTokens(user.totalTokens)} tokens | Rank #${user.globalRank}`,
      images: [`/api/og/profile/${user.username}`],
    }
  };
}
```

## Sitemap

```typescript
// app/sitemap.ts
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const users = await getAllUsers();
  const countries = await getActiveCountries();
  
  const staticPages = [
    { url: 'https://ccgather.com', priority: 1.0, changeFrequency: 'hourly' as const },
    { url: 'https://ccgather.com/leaderboard', priority: 0.95, changeFrequency: 'hourly' as const },
    { url: 'https://ccgather.com/news', priority: 0.8, changeFrequency: 'daily' as const },
  ];
  
  const userPages = users.map(user => ({
    url: `https://ccgather.com/u/${user.username}`,
    lastModified: user.lastSubmissionAt,
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }));
  
  const countryPages = countries.map(country => ({
    url: `https://ccgather.com/league/${country.code.toLowerCase()}`,
    lastModified: new Date(),
    changeFrequency: 'hourly' as const,
    priority: 0.85,
  }));
  
  return [...staticPages, ...userPages, ...countryPages];
}
```

## 구조화된 데이터

```typescript
// Leaderboard Schema
const leaderboardSchema = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "CCGather Global Leaderboard",
  "description": "Top Claude Code developers ranked by token usage",
  "numberOfItems": totalUsers,
  "itemListElement": topUsers.map((user, index) => ({
    "@type": "ListItem",
    "position": index + 1,
    "item": {
      "@type": "Person",
      "name": user.displayName,
      "identifier": user.username,
      "url": `https://ccgather.com/u/${user.username}`
    }
  }))
};

// Profile Schema
const profileSchema = {
  "@context": "https://schema.org",
  "@type": "ProfilePage",
  "mainEntity": {
    "@type": "Person",
    "name": user.displayName,
    "identifier": user.username,
    "url": `https://ccgather.com/u/${user.username}`,
    "sameAs": `https://github.com/${user.username}`
  }
};

// Organization Schema
const orgSchema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "CCGather",
  "url": "https://ccgather.com",
  "applicationCategory": "DeveloperApplication",
  "operatingSystem": "Web",
  "description": "Real-time leaderboard for Claude Code developers"
};
```

---

# 📱 페이지 구조

## 라우팅 맵

```
/                       # 랜딩 페이지
/leaderboard            # 글로벌 리더보드
/league/[country]       # 국가별 리그 (e.g., /league/kr)
/u/[username]           # 유저 프로필
/news                   # 뉴스피드
/settings               # 사용자 설정
/sign-in                # Clerk 로그인
/sign-up                # Clerk 회원가입
/onboarding             # 온보딩 (국가 선택)

/api/
├── webhooks/clerk      # Clerk Webhook
├── submit              # 데이터 제출
├── og/profile/[user]   # 동적 OG 이미지
├── leaderboard         # 리더보드 API
├── user/[username]     # 유저 데이터 API
├── countries           # 국가 통계 API
└── news                # 뉴스 API
```

## 랜딩 페이지 와이어프레임

```
┌─────────────────────────────────────────────────────────────┐
│  [Logo] CCGather                    [Leaderboard] [Sign In] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│              Where Claude Code                              │
│              Developers Gather                              │
│                                                             │
│         Track your usage. Compete globally.                 │
│               Rise through the ranks.                       │
│                                                             │
│              [🔗 Sign in with GitHub]                       │
│                                                             │
│  ┌─────────┬─────────┬─────────┬─────────┐                 │
│  │  2,345  │  45.6T  │ $123.4K │   42    │                 │
│  │Developers│ Tokens │  Spent  │Countries│                 │
│  └─────────┴─────────┴─────────┴─────────┘                 │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  🏆 Live Leaderboard                    [View Full →]       │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ #1 🇺🇸 @user1    12.5B tokens    $4,521   🏆 Immortal  ││
│  │ #2 🇰🇷 @user2    10.2B tokens    $3,892   👑 Legend    ││
│  │ #3 🇯🇵 @user3     8.7B tokens    $3,124   👑 Legend    ││
│  │ ...                                                     ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  🌍 Country Battle                      [View All →]        │
│  ┌─────────┬─────────┬─────────┐                           │
│  │ 🥇 🇺🇸  │ 🥈 🇰🇷  │ 🥉 🇯🇵  │                           │
│  │  USA    │ Korea   │ Japan   │                           │
│  │ 234.5B  │ 198.2B  │ 156.7B  │                           │
│  └─────────┴─────────┴─────────┘                           │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  ⚡ How It Works                                            │
│                                                             │
│  1️⃣ Sign in          2️⃣ Install CLI       3️⃣ Auto Track    │
│  GitHub OAuth       npx ccgather setup    Rise in ranks!   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  📰 Latest Updates                      [View All →]        │
│  • Claude Code 1.2.0 Released - 2h ago                     │
│  • New MCP Server Support - 1d ago                         │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Footer: Links | GitHub | Twitter | Terms | Privacy        │
└─────────────────────────────────────────────────────────────┘
```

---

# 📅 개발 로드맵

## Phase 1: Foundation (Week 1-2)

### 목표
- 프로젝트 셋업 및 기본 인프라 구축
- 인증 시스템 완성

### 태스크
- [ ] Next.js 15 프로젝트 초기화
- [ ] Tailwind + shadcn/ui 설정
- [ ] Clerk 설정 (GitHub OAuth)
- [ ] Supabase 프로젝트 생성
- [ ] DB 스키마 구축 (users, usage_stats)
- [ ] Clerk → Supabase Webhook 연동
- [ ] 온보딩 플로우 (국가 선택)
- [ ] 기본 레이아웃 및 네비게이션

### 산출물
- 로그인 가능한 기본 앱
- DB 연동 완료

---

## Phase 2: Core Features (Week 3-4)

### 목표
- 리더보드 핵심 기능 완성
- 데이터 제출 시스템 구축

### 태스크
- [ ] 리더보드 페이지 구현
- [ ] 페이지네이션 + "내 순위로" 기능
- [ ] 국가별 필터링
- [ ] 기간별 필터링 (Today/7D/30D/All)
- [ ] Top 3 Podium 컴포넌트
- [ ] CLI 패키지 개발 (npx ccgather)
- [ ] CLI ASCII 아트 로고 구현
- [ ] Hook 자동 설치 기능
- [ ] 데이터 검증 로직

### 산출물
- 동작하는 리더보드
- CLI 패키지 npm 배포

---

## Phase 3: Profile & Visualization (Week 5-6)

### 목표
- 프로필 시스템 완성
- 차트 및 시각화

### 태스크
- [ ] 프로필 페이지 구현
- [ ] Side Panel (데스크탑) 구현
- [ ] Recharts 일별 사용량 차트
- [ ] GitHub 스타일 Activity Heatmap
- [ ] 레벨 시스템 구현
- [ ] 주 사용 모델 표시
- [ ] Supabase Realtime 연동 (실시간 업데이트)
- [ ] Framer Motion 애니메이션

### 산출물
- 완성된 프로필 페이지
- 실시간 업데이트 리더보드

---

## Phase 4: Gamification & Social (Week 7-8)

### 목표
- 게이미피케이션 요소 추가
- 소셜 기능

### 태스크
- [ ] 뱃지 시스템 구현 (15종+)
- [ ] 뱃지 획득 로직 및 알림
- [ ] 레벨 업 애니메이션 (confetti)
- [ ] 국가 대항전 페이지
- [ ] 동적 OG 이미지 생성
- [ ] 소셜 공유 버튼
- [ ] 프로필 공유 카드

### 산출물
- 완성된 게이미피케이션
- 공유 가능한 프로필 카드

---

## Phase 5: News & Polish (Week 9-10)

### 목표
- 뉴스피드 시스템
- 최종 다듬기 및 런칭 준비

### 태스크
- [ ] 🔒 크롤링 시스템 구축 (Private)
- [ ] 🔒 AI 요약 파이프라인 (Private)
- [ ] 뉴스피드 UI
- [ ] SEO 최적화 (sitemap, schema)
- [ ] 성능 최적화 (Core Web Vitals)
- [ ] 모바일 반응형 완성
- [ ] 에러 핸들링 및 로딩 상태
- [ ] 문서화 (README, API docs)

### 산출물
- 프로덕션 레디 앱
- 런칭 준비 완료

---

## Phase 6: Launch (Week 11)

### 목표
- 공개 런칭

### 태스크
- [ ] 베타 테스터 피드백 반영
- [ ] Product Hunt 런칭
- [ ] Twitter/X 공지
- [ ] 개발자 커뮤니티 공유 (긱뉴스, 디스콰이엇)
- [ ] 모니터링 및 버그 수정

---

# 📊 성공 지표 (KPIs)

## 사용자 지표

| 지표 | 목표 (Launch+30일) | 목표 (Launch+90일) |
|------|-------------------|-------------------|
| 총 가입자 | 500+ | 2,000+ |
| MAU | 300+ | 1,500+ |
| DAU | 100+ | 500+ |
| 일일 제출 수 | 200+ | 1,000+ |

## 참여 지표

| 지표 | 목표 |
|------|------|
| 프로필 공유율 | 20%+ |
| Auto-sync 설정률 | 40%+ |
| 7일 리텐션 | 30%+ |
| 30일 리텐션 | 15%+ |

## 기술 지표

| 지표 | 목표 |
|------|------|
| 페이지 로드 시간 | < 2초 |
| LCP (Largest Contentful Paint) | < 2.5초 |
| FID (First Input Delay) | < 100ms |
| CLS (Cumulative Layout Shift) | < 0.1 |
| 가용성 (Uptime) | 99.9%+ |

---

# 📝 부록

## A. API 엔드포인트

```yaml
# Public APIs (인증 불필요)
GET /api/leaderboard
  params: period, country, sort, page, limit
  
GET /api/user/:username
  returns: public profile data
  
GET /api/countries
  returns: country stats list

GET /api/news
  params: category, limit

# Protected APIs (인증 필요)
POST /api/submit
  body: usage data
  header: Authorization: Bearer <token>
  
GET /api/me
  returns: current user profile
  
PATCH /api/me
  body: profile updates
  
POST /api/me/badges/display
  body: { badges: string[] }
```

---

# 🔄 Git 워크플로우

## 커밋 컨벤션

```bash
# 형식
타입: 간단한 설명

# 타입
feat:     새 기능
fix:      버그 수정
docs:     문서
style:    포맷팅
refactor: 리팩토링
chore:    기타

# 예시
git commit -m "feat: 리더보드 페이지 구현"
git commit -m "feat: CLI ASCII 로고 추가"
git commit -m "fix: 순위 계산 버그 수정"
```

## 배포 플로우

```bash
# Public 코드 (자동 배포)
git push origin main
# → Vercel 자동 배포

# Private Edge Functions (수동 배포)
supabase functions deploy news-crawler
supabase functions deploy ai-summarizer
```

---

# ✅ 체크리스트

## 런칭 전 필수

- [ ] 도메인 ccgather.com 연결
- [ ] SSL 인증서 확인
- [ ] Clerk 프로덕션 설정
- [ ] Clerk → Supabase Webhook 연결
- [ ] Supabase 프로덕션 환경
- [ ] .gitignore 확인 (internal/ 제외)
- [ ] 환경변수 설정 완료
- [ ] CLI npm 패키지 배포
- [ ] 에러 모니터링 (Sentry) 설정
- [ ] 백업 정책 수립
- [ ] 개인정보처리방침 작성
- [ ] 이용약관 작성

## 보안 확인

- [ ] /internal/ 폴더 GitHub에 없음 확인
- [ ] .env 파일 GitHub에 없음 확인
- [ ] API 키 노출 없음 확인
- [ ] Clerk Webhook Secret 설정

## 런칭 후 모니터링

- [ ] 실시간 에러 모니터링
- [ ] 성능 메트릭 확인
- [ ] 사용자 피드백 수집
- [ ] 버그 리포트 대응

---

**Document End**

*Version: 1.3 (Complete Edition)*
*Created: 2025-01-05*
*Last Updated: 2025-01-05*
*Author: CCGather Team*