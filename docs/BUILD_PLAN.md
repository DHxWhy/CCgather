# CCGather Integrated Build Plan

**Version:** 1.0
**Date:** 2025-01-05
**Status:** Approved

---

## Overview

이 문서는 CCGather 프로젝트의 **의존성 기반 Task 그룹**을 정의합니다. 각 Phase는 순차적으로 진행되며, Phase 내 Group들은 의존성이 없으면 병렬 실행 가능합니다.

---

## Phase 1: Foundation (Week 1-2)

**목표:** 프로젝트 기반 인프라 구축 및 인증 시스템 완성

### Group G1: Project Initialization
**의존성:** 없음
**병렬 가능:** G2와 병렬

| Task ID | Task | Description | Owner |
|---------|------|-------------|-------|
| G1.1 | pnpm 전환 | npm → pnpm 마이그레이션 | DevOps |
| G1.2 | Monorepo 설정 | pnpm-workspace.yaml 구성 | DevOps |
| G1.3 | TypeScript 설정 | tsconfig.json strict mode | FE |
| G1.4 | ESLint + Prettier | 코드 스타일 설정 | FE |
| G1.5 | Husky + lint-staged | Pre-commit hooks | DevOps |
| G1.6 | .env.example | 환경변수 템플릿 | DevOps |
| G1.7 | .gitignore 완성 | internal/, .env 제외 | DevOps |

**산출물:**
- pnpm-workspace.yaml
- tsconfig.json (strict)
- .eslintrc.json
- .prettierrc
- .husky/pre-commit
- .env.example
- .gitignore

---

### Group G2: Database Setup
**의존성:** 없음
**병렬 가능:** G1과 병렬

| Task ID | Task | Description | Owner |
|---------|------|-------------|-------|
| G2.1 | Supabase 프로젝트 생성 | Production 프로젝트 | BE |
| G2.2 | 스키마 마이그레이션 | 001_init.sql ~ 006_snapshots.sql | BE |
| G2.3 | RLS 정책 적용 | 모든 테이블 보안 설정 | BE |
| G2.4 | 인덱스 생성 | 성능 최적화 인덱스 | BE |
| G2.5 | DB Functions | calculate_level, update_stats | BE |
| G2.6 | Supabase 타입 생성 | supabase gen types | BE |

**산출물:**
- supabase/migrations/*.sql
- supabase/config.toml
- lib/supabase/types.ts

---

### Group G3: Next.js App Structure
**의존성:** G1 (TypeScript 설정 필요)

| Task ID | Task | Description | Owner |
|---------|------|-------------|-------|
| G3.1 | App Router 구조 | app/ 디렉토리 설정 | FE |
| G3.2 | 레이아웃 구성 | layout.tsx, providers.tsx | FE |
| G3.3 | globals.css | CSS 변수, Tailwind base | FE |
| G3.4 | Tailwind CSS 4 설정 | tailwind.config.ts | FE |
| G3.5 | shadcn/ui 초기화 | components.json, ui/ | FE |
| G3.6 | Font 설정 | Inter, JetBrains Mono | FE |

**산출물:**
- app/layout.tsx
- app/globals.css
- app/providers.tsx
- tailwind.config.ts
- components.json
- components/ui/*.tsx

---

### Group G4: Authentication Setup
**의존성:** G2 (DB), G3 (App 구조)

| Task ID | Task | Description | Owner |
|---------|------|-------------|-------|
| G4.1 | Clerk 설치 | @clerk/nextjs 패키지 | FE |
| G4.2 | Clerk 환경변수 | CLERK_* 키 설정 | DevOps |
| G4.3 | middleware.ts | clerkMiddleware 설정 | FE |
| G4.4 | Sign In 페이지 | app/(auth)/sign-in/[[...]] | FE |
| G4.5 | Sign Up 페이지 | app/(auth)/sign-up/[[...]] | FE |
| G4.6 | Clerk 테마 커스터마이징 | Dark theme 스타일링 | FE |
| G4.7 | Clerk Webhook | app/api/webhooks/clerk | BE |
| G4.8 | Webhook 테스트 | user.created 동기화 확인 | QA |

**산출물:**
- middleware.ts
- app/(auth)/sign-in/[[...sign-in]]/page.tsx
- app/(auth)/sign-up/[[...sign-up]]/page.tsx
- app/api/webhooks/clerk/route.ts

---

### Group G5: Basic Layout Components
**의존성:** G3 (shadcn/ui)

| Task ID | Task | Description | Owner |
|---------|------|-------------|-------|
| G5.1 | Header 컴포넌트 | 로고, 네비게이션, Auth 상태 | FE |
| G5.2 | Footer 컴포넌트 | 링크, 저작권 | FE |
| G5.3 | Mobile Nav | 햄버거 메뉴, Drawer | FE |
| G5.4 | 랜딩 페이지 기본 | Hero section | FE |

**산출물:**
- components/layout/header.tsx
- components/layout/footer.tsx
- components/layout/mobile-nav.tsx
- app/(main)/page.tsx

---

### Group G6: Onboarding Flow
**의존성:** G4 (Auth), G5 (Layout)

| Task ID | Task | Description | Owner |
|---------|------|-------------|-------|
| G6.1 | 온보딩 페이지 | app/(main)/onboarding | FE |
| G6.2 | Country Selector | 국가 선택 드롭다운 | FE |
| G6.3 | Timezone Detector | 자동 감지 + 수정 | FE |
| G6.4 | 온보딩 API | PATCH /api/me | BE |
| G6.5 | 온보딩 리다이렉트 | 첫 로그인 시 자동 이동 | FE |

**산출물:**
- app/(main)/onboarding/page.tsx
- components/onboarding/country-selector.tsx
- components/onboarding/timezone-detector.tsx
- app/api/me/route.ts

---

## Phase 2: Core Features (Week 3-4)

**목표:** 리더보드 핵심 기능 및 CLI 패키지 구현

### Group G7: Leaderboard API
**의존성:** G2 (DB), G4 (Auth)

| Task ID | Task | Description | Owner |
|---------|------|-------------|-------|
| G7.1 | GET /api/leaderboard | 쿼리 파라미터 처리 | BE |
| G7.2 | 필터링 로직 | period, country, sort | BE |
| G7.3 | 페이지네이션 | offset/limit 구현 | BE |
| G7.4 | 캐싱 설정 | stale-while-revalidate | BE |
| G7.5 | 응답 타입 정의 | Zod schema | BE |

**산출물:**
- app/api/leaderboard/route.ts
- lib/validations/leaderboard.ts

---

### Group G8: Leaderboard UI
**의존성:** G7 (API), G5 (Layout)

| Task ID | Task | Description | Owner |
|---------|------|-------------|-------|
| G8.1 | 리더보드 페이지 | app/(main)/leaderboard | FE |
| G8.2 | LeaderboardTable | 테이블 컴포넌트 | FE |
| G8.3 | LeaderboardRow | 행 컴포넌트 + hover | FE |
| G8.4 | TopThreePodium | 1, 2, 3위 쇼케이스 | FE |
| G8.5 | PeriodFilter | Today/7D/30D/All | FE |
| G8.6 | CountryFilter | 국가 드롭다운 | FE |
| G8.7 | Pagination | 페이지네이션 UI | FE |
| G8.8 | RankChangeBadge | ↑↓ 표시 | FE |
| G8.9 | TanStack Query 훅 | useLeaderboard | FE |

**산출물:**
- app/(main)/leaderboard/page.tsx
- components/leaderboard/*.tsx
- lib/hooks/use-leaderboard.ts

---

### Group G9: Submit API
**의존성:** G2 (DB), G4 (Auth)

| Task ID | Task | Description | Owner |
|---------|------|-------------|-------|
| G9.1 | POST /api/submit | 데이터 제출 엔드포인트 | BE |
| G9.2 | 입력 검증 | Zod schema + 이상치 | BE |
| G9.3 | Upsert 로직 | 같은 날짜 = 더 높은 값 | BE |
| G9.4 | 순위 재계산 | Trigger 호출 | BE |
| G9.5 | Rate Limiting | 6회/시간 | BE |
| G9.6 | 응답 포맷 | 순위 변동 포함 | BE |

**산출물:**
- app/api/submit/route.ts
- lib/validations/submit.ts

---

### Group G10: CLI Package Setup
**의존성:** G9 (Submit API)

| Task ID | Task | Description | Owner |
|---------|------|-------------|-------|
| G10.1 | packages/cli 구조 | Monorepo 패키지 | CLI |
| G10.2 | package.json | 메타데이터, bin 설정 | CLI |
| G10.3 | Commander.js 설정 | CLI 프레임워크 | CLI |
| G10.4 | Chalk 설정 | 컬러 출력 | CLI |
| G10.5 | ASCII 로고 | ascii-logo.ts | CLI |
| G10.6 | 웰컴 메시지 | welcome.ts | CLI |

**산출물:**
- packages/cli/package.json
- packages/cli/src/ui/ascii-logo.ts
- packages/cli/src/ui/welcome.ts
- packages/cli/src/ui/colors.ts

---

### Group G11: CLI Core Commands
**의존성:** G10 (CLI Setup)

| Task ID | Task | Description | Owner |
|---------|------|-------------|-------|
| G11.1 | ccgather (기본) | 인터랙티브 메뉴 | CLI |
| G11.2 | ccgather submit | 즉시 제출 | CLI |
| G11.3 | ccgather status | 현재 상태 확인 | CLI |
| G11.4 | ccusage 연동 | 데이터 추출 | CLI |
| G11.5 | GitHub OAuth | 브라우저 인증 | CLI |
| G11.6 | 토큰 저장 | ~/.ccgather/config.json | CLI |

**산출물:**
- packages/cli/src/commands/submit.ts
- packages/cli/src/commands/status.ts
- packages/cli/src/utils/auth.ts
- packages/cli/src/utils/ccusage.ts

---

### Group G12: CLI Auto-Sync
**의존성:** G11 (Core Commands)

| Task ID | Task | Description | Owner |
|---------|------|-------------|-------|
| G12.1 | ccgather setup | 자동 동기화 설정 | CLI |
| G12.2 | Hook 설치 | Claude Code stop hook | CLI |
| G12.3 | ccgather pause | 일시 중지 | CLI |
| G12.4 | ccgather resume | 재개 | CLI |
| G12.5 | ccgather uninstall | 완전 삭제 | CLI |

**산출물:**
- packages/cli/src/commands/setup.ts
- packages/cli/src/commands/pause.ts
- packages/cli/src/commands/resume.ts
- packages/cli/src/commands/uninstall.ts
- packages/cli/src/utils/hook.ts

---

## Phase 3: Profile & Visualization (Week 5-6)

**목표:** 프로필 시스템 및 데이터 시각화 구현

### Group G13: Profile API
**의존성:** G2 (DB)

| Task ID | Task | Description | Owner |
|---------|------|-------------|-------|
| G13.1 | GET /api/user/[username] | 프로필 데이터 | BE |
| G13.2 | GET /api/user/[username]/chart | 차트 데이터 | BE |
| G13.3 | 스트릭 계산 | 연속 사용일 계산 | BE |
| G13.4 | 캐싱 설정 | 60s / 2min | BE |

**산출물:**
- app/api/user/[username]/route.ts
- app/api/user/[username]/chart/route.ts

---

### ~~Group G14: Profile Page~~ (삭제됨)
> **결정사항:** 2025-01-06 - 프로필 전용 페이지를 삭제하고 ProfileSidePanel만 유지하기로 결정

---

### Group G15: Profile Side Panel (✅ 완료)
**의존성:** G13 (Profile API), G8 (Leaderboard)

| Task ID | Task | Description | Owner |
|---------|------|-------------|-------|
| G15.1 | ProfileSidePanel | Desktop drawer | FE |
| G15.2 | Zustand 연동 | 패널 상태 관리 | FE |
| G15.3 | LeaderboardRow 연동 | 클릭 시 패널 오픈 | FE |
| G15.4 | ESC/Outside 닫기 | 키보드/클릭 핸들링 | FE |

**산출물:**
- components/profile/profile-side-panel.tsx
- stores/ui-store.ts (확장)

---

### Group G16: Data Visualization
**의존성:** G13 (Chart API), G15 (Profile Side Panel)

| Task ID | Task | Description | Owner |
|---------|------|-------------|-------|
| G16.1 | ProfileChart | Recharts Area Chart | FE |
| G16.2 | 기간 필터 | Today/7D/30D/All | FE |
| G16.3 | ActivityHeatmap | GitHub 스타일 히트맵 | FE |
| G16.4 | 툴팁 스타일링 | 커스텀 툴팁 | FE |

**산출물:**
- components/profile/profile-chart.tsx
- components/profile/activity-heatmap.tsx

---

### Group G17: Realtime Updates
**의존성:** G8 (Leaderboard UI), G2 (DB)

| Task ID | Task | Description | Owner |
|---------|------|-------------|-------|
| G17.1 | Supabase Realtime 설정 | Channel 구독 | FE |
| G17.2 | 리더보드 실시간 | 순위 변동 감지 | FE |
| G17.3 | 애니메이션 트리거 | 변동 시 하이라이트 | FE |
| G17.4 | useRealtime 훅 | 재사용 가능 훅 | FE |

**산출물:**
- lib/hooks/use-realtime.ts
- lib/supabase/realtime.ts

---

## Phase 4: Gamification & Social (Week 7-8)

**목표:** 뱃지, 레벨 시스템 및 소셜 공유 기능

### Group G18: Badge System
**의존성:** G2 (DB), G13 (Profile)

| Task ID | Task | Description | Owner |
|---------|------|-------------|-------|
| G18.1 | 뱃지 정의 | lib/constants/badges.ts | FE |
| G18.2 | 뱃지 획득 로직 | DB Trigger/Function | BE |
| G18.3 | BadgeCollection | 뱃지 그리드 UI | FE |
| G18.4 | BadgeItem | 개별 뱃지 + 툴팁 | FE |
| G18.5 | 뱃지 표시 설정 | POST /api/me/badges/display | BE |
| G18.6 | 뱃지 SVG 에셋 | public/badges/*.svg | Design |

**산출물:**
- lib/constants/badges.ts
- components/profile/badge-collection.tsx
- components/profile/badge-item.tsx
- public/badges/*.svg

---

### Group G19: Level System UI
**의존성:** G15 (Profile Side Panel), G18 (Badge)

| Task ID | Task | Description | Owner |
|---------|------|-------------|-------|
| G19.1 | 레벨 정의 | lib/constants/levels.ts | FE |
| G19.2 | 레벨 업 알림 | Toast + Confetti | FE |
| G19.3 | 레벨 프로그레스 | 다음 레벨까지 진행률 | FE |

**산출물:**
- lib/constants/levels.ts
- components/shared/level-progress.tsx

---

### Group G20: Country League
**의존성:** G7 (Leaderboard API), G8 (UI)

| Task ID | Task | Description | Owner |
|---------|------|-------------|-------|
| G20.1 | GET /api/countries | 국가 통계 API | BE |
| G20.2 | 리그 페이지 | app/(main)/league/[country] | FE |
| G20.3 | 국가 헤더 | 국기, 통계 표시 | FE |
| G20.4 | 국가 대항전 카드 | 랜딩 페이지용 | FE |

**산출물:**
- app/api/countries/route.ts
- app/(main)/league/[country]/page.tsx
- components/landing/country-battle.tsx

---

### Group G21: Social Sharing
**의존성:** G15 (Profile Side Panel), G20 (Country)

| Task ID | Task | Description | Owner |
|---------|------|-------------|-------|
| G21.1 | 동적 OG 이미지 | /api/og/profile/[username] | BE |
| G21.2 | Twitter 공유 | 텍스트 + URL | FE |
| G21.3 | LinkedIn 공유 | 프로필 공유 | FE |
| G21.4 | 복사 버튼 | URL 클립보드 복사 | FE |
| G21.5 | 공유 모달 | Share 버튼 UI | FE |

**산출물:**
- app/api/og/profile/[username]/route.tsx
- components/shared/share-modal.tsx

---

## Phase 5: News & Polish (Week 9-10)

**목표:** 뉴스피드 시스템 및 최종 다듬기

### Group G22: News System (Public)
**의존성:** G2 (DB)

| Task ID | Task | Description | Owner |
|---------|------|-------------|-------|
| G22.1 | GET /api/news | 뉴스 조회 API | BE |
| G22.2 | 뉴스 페이지 | app/(main)/news | FE |
| G22.3 | NewsFeed | 뉴스 리스트 | FE |
| G22.4 | NewsCard | 개별 뉴스 카드 | FE |
| G22.5 | 카테고리 필터 | Tab UI | FE |

**산출물:**
- app/api/news/route.ts
- app/(main)/news/page.tsx
- components/news/*.tsx

---

### Group G23: News System (Private)
**의존성:** G22 (Public), Supabase Edge 접근

| Task ID | Task | Description | Owner |
|---------|------|-------------|-------|
| G23.1 | 크롤러 Edge Function | 🔒 Supabase 직접 배포 | BE |
| G23.2 | AI 요약 Edge Function | 🔒 Supabase 직접 배포 | BE |
| G23.3 | Cron 스케줄 설정 | 2시간마다 실행 | DevOps |

**산출물:** (GitHub에 포함되지 않음)
- supabase/functions/news-crawler/
- supabase/functions/ai-summarizer/

---

### Group G24: SEO & Metadata
**의존성:** G21 (OG Image), G22 (News)

| Task ID | Task | Description | Owner |
|---------|------|-------------|-------|
| G24.1 | 메타데이터 설정 | app/layout.tsx | FE |
| G24.2 | 동적 메타데이터 | 각 페이지별 | FE |
| G24.3 | Sitemap | app/sitemap.ts | FE |
| G24.4 | robots.txt | app/robots.ts | FE |
| G24.5 | 구조화 데이터 | JSON-LD Schema | FE |

**산출물:**
- app/sitemap.ts
- app/robots.ts

---

### Group G25: Performance Optimization
**의존성:** 모든 UI 그룹 완료

| Task ID | Task | Description | Owner |
|---------|------|-------------|-------|
| G25.1 | Bundle 분석 | @next/bundle-analyzer | FE |
| G25.2 | Code Splitting | Dynamic imports | FE |
| G25.3 | Image 최적화 | next/image 활용 | FE |
| G25.4 | Lighthouse 테스트 | Core Web Vitals | QA |
| G25.5 | 캐싱 최적화 | Headers, ISR | BE |

**산출물:**
- Lighthouse 리포트 (90+ 목표)

---

### Group G26: Error Handling & Monitoring
**의존성:** G25 (Optimization)

| Task ID | Task | Description | Owner |
|---------|------|-------------|-------|
| G26.1 | Sentry 설정 | @sentry/nextjs | DevOps |
| G26.2 | Error Boundary | 전역/페이지별 | FE |
| G26.3 | Loading States | Skeleton UI | FE |
| G26.4 | 404/500 페이지 | 커스텀 에러 페이지 | FE |
| G26.5 | Vercel Analytics | 활성화 | DevOps |

**산출물:**
- app/error.tsx
- app/not-found.tsx
- app/loading.tsx

---

### Group G27: Documentation
**의존성:** 모든 개발 완료

| Task ID | Task | Description | Owner |
|---------|------|-------------|-------|
| G27.1 | README.md | 프로젝트 소개, 설치 가이드 | Docs |
| G27.2 | API 문서 | 엔드포인트 명세 | Docs |
| G27.3 | CLI README | packages/cli/README.md | Docs |
| G27.4 | 기여 가이드 | CONTRIBUTING.md | Docs |
| G27.5 | 개인정보처리방침 | /privacy | Legal |
| G27.6 | 이용약관 | /terms | Legal |

**산출물:**
- README.md
- CONTRIBUTING.md
- packages/cli/README.md

---

## Phase 6: Launch (Week 11)

**목표:** 런칭 및 초기 모니터링

### Group G28: Pre-Launch Checklist
**의존성:** 모든 Phase 완료

| Task ID | Task | Description | Owner |
|---------|------|-------------|-------|
| G28.1 | 도메인 연결 | ccgather.com → Vercel | DevOps |
| G28.2 | SSL 확인 | HTTPS 강제 | DevOps |
| G28.3 | Clerk Production | 키 교체 | DevOps |
| G28.4 | Supabase Production | 환경 분리 | DevOps |
| G28.5 | 환경변수 확인 | 모든 키 설정 | DevOps |
| G28.6 | 보안 감사 | .gitignore, RLS 확인 | Security |

---

### Group G29: CLI Publish
**의존성:** G28 (Pre-Launch)

| Task ID | Task | Description | Owner |
|---------|------|-------------|-------|
| G29.1 | npm 계정 설정 | 패키지 publish 권한 | DevOps |
| G29.2 | 버전 태깅 | v1.0.0 | DevOps |
| G29.3 | npm publish | ccgather 패키지 배포 | DevOps |
| G29.4 | npx 테스트 | 설치 및 실행 확인 | QA |

---

### Group G30: Launch
**의존성:** G28, G29

| Task ID | Task | Description | Owner |
|---------|------|-------------|-------|
| G30.1 | Production 배포 | Vercel main 브랜치 | DevOps |
| G30.2 | 모니터링 활성화 | Sentry, Vercel | DevOps |
| G30.3 | Product Hunt 런칭 | 게시물 작성 | Marketing |
| G30.4 | Twitter/X 공지 | 런칭 트윗 | Marketing |
| G30.5 | 커뮤니티 공유 | 긱뉴스, 디스콰이엇 | Marketing |

---

## Dependency Graph Summary

```
Phase 1 (Foundation)
├── G1 (Project Init) ─────────┐
├── G2 (Database) ─────────────┼───┐
│                              │   │
└── G3 (App Structure) ────────┘   │
         │                         │
         ▼                         │
    G4 (Auth) ◀────────────────────┘
         │
         ▼
    G5 (Layout) ──────┐
         │            │
         ▼            │
    G6 (Onboarding) ◀─┘

Phase 2 (Core)
├── G7 (Leaderboard API) ◀─── G2, G4
│        │
│        ▼
├── G8 (Leaderboard UI) ◀─── G7, G5
│
├── G9 (Submit API) ◀─── G2, G4
│        │
│        ▼
├── G10 (CLI Setup) ◀─── G9
│        │
│        ▼
├── G11 (CLI Core) ◀─── G10
│        │
│        ▼
└── G12 (CLI Auto-Sync) ◀─── G11

Phase 3 (Profile)
├── G13 (Profile API) ◀─── G2
│        │
│        ▼
├── G14 (삭제됨 - Side Panel만 유지)
│
├── G15 (Side Panel) ◀─── G13, G8
│
├── G16 (Visualization) ◀─── G13, G15
│
└── G17 (Realtime) ◀─── G8, G2

Phase 4 (Gamification)
├── G18 (Badge) ◀─── G2, G13
├── G19 (Level UI) ◀─── G15, G18
├── G20 (Country League) ◀─── G7, G8
└── G21 (Social) ◀─── G15, G20

Phase 5 (Polish)
├── G22 (News Public) ◀─── G2
├── G23 (News Private) ◀─── G22
├── G24 (SEO) ◀─── G21, G22
├── G25 (Performance) ◀─── All UI
├── G26 (Error Handling) ◀─── G25
└── G27 (Documentation) ◀─── All

Phase 6 (Launch)
├── G28 (Pre-Launch) ◀─── All
├── G29 (CLI Publish) ◀─── G28
└── G30 (Launch) ◀─── G28, G29
```

---

## Success Criteria

| Phase | Criteria | Verification |
|-------|----------|--------------|
| Phase 1 | 로그인/온보딩 동작 | E2E 테스트 |
| Phase 2 | 리더보드 + CLI 동작 | npx ccgather 실행 |
| Phase 3 | 프로필 + 차트 동작 | 시각화 확인 |
| Phase 4 | 뱃지 + 공유 동작 | OG 이미지 확인 |
| Phase 5 | LCP < 2.5s | Lighthouse |
| Phase 6 | 안정적 운영 | 모니터링 |

---

**Document End**

*Build Plan Version: 1.1*
*Last Updated: 2025-01-06*
*변경사항: G14 삭제 (프로필 페이지 → Side Panel만 유지), G16 기간필터 수정 (Today/7D/30D/All)*
