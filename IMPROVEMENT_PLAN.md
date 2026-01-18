# 🛠️ CCgather 코드 개선 계획

**작성일**: 2026-01-19
**목표**: 발견된 모든 개선사항의 체계적 해결
**총 예상 소요**: 약 20-25시간 (2-3주)

---

## 📊 개선 대상 총괄

| ID | 이슈 | 우선순위 | 소요시간 | Phase |
|----|------|----------|----------|-------|
| FIX-01 | Clerk deprecated prop | 🔴 높음 | 15분 | 1 |
| FIX-02 | PostHog debug mode | 🔴 높음 | 10분 | 1 |
| FIX-03 | 이미지 최적화 (9곳) | 🟠 중간 | 2시간 | 2 |
| FIX-04 | React Hook 의존성 (12곳) | 🟠 중간 | 3시간 | 2 |
| FIX-05 | 미사용 변수 정리 (8곳) | 🟡 낮음 | 1시간 | 2 |
| FIX-06 | console.log 정리 (592회) | 🟠 중간 | 4시간 | 3 |
| FIX-07 | 분산 Rate Limiter | 🟠 중간 | 4시간 | 3 |
| FIX-08 | 인라인 스타일 개선 | 🟡 낮음 | 4시간 | 4 |
| FIX-09 | Admin 권한 로직 개선 | 🟡 낮음 | 30분 | 4 |
| FIX-10 | 단위 테스트 추가 | 🟡 낮음 | 8시간+ | 4 |

---

## 🚀 Phase 1: 런칭 전 필수 (30분)

### 목표
- 런타임 경고 제거
- 향후 호환성 확보

---

### FIX-01: Clerk deprecated prop 수정

**현재 상태**
```
콘솔 경고: Clerk: The prop "afterSignInUrl" is deprecated
```

**작업 내용**

#### Step 1: ClerkProvider 위치 확인
```bash
# 파일 위치 확인
grep -rn "afterSignInUrl\|afterSignUpUrl" --include="*.tsx" --include="*.ts"
```

#### Step 2: 코드 수정

**파일**: `app/layout.tsx` 또는 `app/providers.tsx`

```tsx
// ❌ 변경 전
<ClerkProvider
  appearance={{
    baseTheme: dark,
    variables: { colorPrimary: "#DA7756" },
  }}
>

// ✅ 변경 후
<ClerkProvider
  appearance={{
    baseTheme: dark,
    variables: { colorPrimary: "#DA7756" },
  }}
  afterSignInUrl="/"           // 제거
  afterSignUpUrl="/onboarding" // 제거
  // 새로운 방식으로 교체 (필요시)
  signInFallbackRedirectUrl="/"
  signUpFallbackRedirectUrl="/onboarding"
>
```

#### Step 3: 환경변수 확인

**파일**: `.env.example` 및 `.env.local`

```bash
# 기존 (유지)
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding
```

#### Step 4: 검증
```bash
# 개발 서버 실행 후 콘솔 확인
pnpm dev
# 브라우저 콘솔에서 Clerk 경고 없어야 함
```

**완료 조건**
- [ ] 콘솔에 Clerk deprecated 경고 없음
- [ ] 로그인 후 정상 리다이렉트
- [ ] 회원가입 후 온보딩으로 이동

---

### FIX-02: PostHog debug mode 비활성화

**현재 상태**
```
콘솔 로그: You're now in debug mode. All calls to PostHog will be logged...
```

**작업 내용**

#### Step 1: PostHog 설정 파일 확인

**파일**: `components/providers/PostHogProvider.tsx` 또는 유사 위치

#### Step 2: 코드 수정

```tsx
// ❌ 변경 전
posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
  api_host: "/ingest",
  // debug가 항상 true이거나 조건 없이 설정됨
});

// ✅ 변경 후
posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
  api_host: "/ingest",
  loaded: (posthog) => {
    // 개발 환경에서만 debug 활성화
    if (process.env.NODE_ENV === 'development') {
      posthog.debug();
    }
  },
});
```

#### Step 3: 검증
```bash
# 프로덕션 빌드 테스트
pnpm build && pnpm start
# 브라우저 콘솔에서 PostHog debug 로그 없어야 함
```

**완료 조건**
- [ ] 개발 환경: debug 로그 정상 출력
- [ ] 프로덕션 빌드: debug 로그 없음

---

## 🔧 Phase 2: 런칭 후 1주차 (6시간)

### 목표
- 사용자 체감 성능 개선
- ESLint 경고 제거
- 코드 품질 향상

---

### FIX-03: 이미지 최적화 적용 (9곳)

**현재 상태**
- `<img>` 태그 직접 사용으로 Next.js Image 최적화 미적용
- 외부 이미지 원본 크기 그대로 로드

**영향받는 파일**

| 파일 | 라인 | 용도 |
|------|------|------|
| `components/landing/LeaderboardPreview.tsx` | 174, 417 | 미리보기 아바타 |
| `components/leaderboard/TopThreeCard.tsx` | 148 | Top 3 아바타 |
| `components/leaderboard/RankingCard.tsx` | 64 | 랭킹 카드 아바타 |
| `components/leaderboard/RankingRow.tsx` | 61 | 랭킹 행 아바타 |
| `components/leaderboard/ProfileSidePanel.tsx` | 1090 | 프로필 패널 |
| `app/(main)/leaderboard/page.tsx` | 833 | 리더보드 |
| `app/(main)/settings/usage/page.tsx` | 244 | 설정 |
| `app/(main)/usage/page.tsx` | 317 | 사용량 |

**작업 내용**

#### Step 1: next.config.ts 이미지 도메인 확인

```typescript
// next.config.ts - 이미 설정되어 있음
images: {
  remotePatterns: [
    {
      protocol: "https",
      hostname: "**",  // 모든 외부 도메인 허용
    },
  ],
},
```

#### Step 2: 각 파일별 수정

**예시 - `components/leaderboard/RankingRow.tsx:61`**

```tsx
// ❌ 변경 전
<img
  src={user.avatar_url}
  alt={user.username}
  className="w-7 h-7 rounded-full object-cover"
/>

// ✅ 변경 후
import Image from 'next/image';

<Image
  src={user.avatar_url || '/default-avatar.png'}
  alt={user.username}
  width={28}
  height={28}
  className="rounded-full object-cover"
  unoptimized={user.avatar_url?.includes('clerk.com')} // Clerk 이미지는 이미 최적화됨
/>
```

**예시 - `components/leaderboard/TopThreeCard.tsx:148`**

```tsx
// ❌ 변경 전
<img
  src={user.avatar_url}
  alt={user.display_name}
  className="w-16 h-16 rounded-full border-2 border-white/20"
/>

// ✅ 변경 후
<Image
  src={user.avatar_url || '/default-avatar.png'}
  alt={user.display_name}
  width={64}
  height={64}
  className="rounded-full border-2 border-white/20"
  priority={rank <= 3}  // Top 3는 우선 로드
/>
```

#### Step 3: 기본 아바타 이미지 추가

```bash
# public 폴더에 기본 아바타 추가
# /public/default-avatar.png (32x32, 64x64 크기)
```

#### Step 4: 검증

```bash
# 빌드 후 네트워크 탭에서 이미지 요청 확인
pnpm build && pnpm start

# 확인사항:
# - /_next/image?url=... 형태로 요청되는지
# - 이미지 크기가 요청한 width/height로 최적화되었는지
```

**완료 조건**
- [ ] 모든 아바타 이미지가 `<Image>` 컴포넌트 사용
- [ ] 네트워크 탭에서 `/_next/image` 경로로 로드 확인
- [ ] ESLint `@next/next/no-img-element` 경고 0건

---

### FIX-04: React Hook 의존성 경고 수정 (12곳)

**현재 상태**
```
warning  React Hook useEffect has a missing dependency: 'fetchStats'
```

**영향받는 파일**

| 파일 | 라인 | Hook | 누락된 의존성 |
|------|------|------|--------------|
| `app/(admin)/admin/ai-usage/page.tsx` | 407 | useEffect | fetchStats |
| `app/(main)/cli/auth/page.tsx` | 31 | useEffect | authorizeDirectly |
| `app/(main)/leaderboard/page.tsx` | 236 | useCallback | clerkUser.id |
| `app/(main)/leaderboard/page.tsx` | 315 | useEffect | fetchLeaderboard |
| `components/admin/CronScheduler.tsx` | 82 | useEffect | fetchJobStatus |
| `components/admin/CronScheduler.tsx` | 127 | useCallback | fetchJobStatus |
| `components/leaderboard/LeaderboardTable.tsx` | 63 | useEffect | fetchLeaderboard, initialUsers.length |
| `components/leaderboard/ProfileSidePanel.tsx` | 528 | useMemo | categories |
| `components/leaderboard/ProfileSidePanel.tsx` | 776 | useEffect | user |
| `components/leaderboard/ProfileSidePanel.tsx` | 908 | useEffect | user |

**작업 내용**

#### 패턴 1: useCallback으로 함수 메모이제이션

**파일**: `app/(main)/leaderboard/page.tsx`

```tsx
// ❌ 변경 전
const fetchLeaderboard = async () => {
  // fetch logic
};

useEffect(() => {
  fetchLeaderboard();
}, []); // fetchLeaderboard 누락

// ✅ 변경 후
const fetchLeaderboard = useCallback(async () => {
  // fetch logic
}, [period, sortBy, ccplanFilter]); // 실제 의존성만 포함

useEffect(() => {
  fetchLeaderboard();
}, [fetchLeaderboard]);
```

#### 패턴 2: 의존성 명시적 추가

**파일**: `components/leaderboard/ProfileSidePanel.tsx`

```tsx
// ❌ 변경 전
useEffect(() => {
  if (user) {
    // user 관련 로직
  }
}, []); // user 누락

// ✅ 변경 후
useEffect(() => {
  if (user) {
    // user 관련 로직
  }
}, [user?.id]); // user 전체 대신 필요한 속성만
```

#### 패턴 3: 불필요한 의존성 제거

**파일**: `app/(main)/leaderboard/page.tsx:236`

```tsx
// ❌ 변경 전
const handleClick = useCallback(() => {
  // clerkUser.id를 사용하지 않는 로직
}, [clerkUser.id]); // 불필요한 의존성

// ✅ 변경 후
const handleClick = useCallback(() => {
  // 로직
}, []); // 실제 필요한 의존성만
```

#### Step: 검증

```bash
# ESLint로 확인
pnpm lint

# react-hooks/exhaustive-deps 경고 0건이어야 함
```

**완료 조건**
- [ ] `react-hooks/exhaustive-deps` 경고 0건
- [ ] 기존 기능 정상 동작 확인

---

### FIX-05: 미사용 변수 정리 (8곳)

**영향받는 파일**

| 파일 | 라인 | 변수 | 조치 |
|------|------|------|------|
| `components/auth/AccountRecoveryModal.tsx` | 54 | err | `_err`로 변경 또는 로깅 추가 |
| `components/auth/AccountRecoveryModal.tsx` | 65 | err | `_err`로 변경 또는 로깅 추가 |
| `components/settings/AccountDeleteModal.tsx` | 45 | err | `_err`로 변경 또는 로깅 추가 |
| `packages/cli/src/commands/submit.ts` | 3 | isAuthenticated | import 제거 |
| `packages/cli/src/commands/submit.ts` | 22 | warning | import 제거 또는 사용 |
| `packages/cli/src/commands/submit.ts` | 441 | planDetectionReason | `_` 접두사 또는 사용 |
| `packages/cli/src/index.ts` | 6 | updateNotifier | import 제거 |
| `packages/cli/src/index.ts` | 8 | status | import 제거 |
| `packages/cli/src/lib/claude.ts` | 99 | error | `_error`로 변경 |

**작업 내용**

#### 패턴 1: catch 블록 에러 변수

```tsx
// ❌ 변경 전
} catch (err) {
  setError("Failed to recover");
}

// ✅ 변경 후 (옵션 A: 무시 명시)
} catch (_err) {
  setError("Failed to recover");
}

// ✅ 변경 후 (옵션 B: 로깅 추가)
} catch (err) {
  console.error("Recovery failed:", err);
  setError("Failed to recover");
}
```

#### 패턴 2: 미사용 import

```tsx
// ❌ 변경 전
import { isAuthenticated, warning } from '../lib/ui';

// ✅ 변경 후
import { /* 필요한 것만 */ } from '../lib/ui';
```

**완료 조건**
- [ ] `@typescript-eslint/no-unused-vars` 경고 0건

---

## ⚙️ Phase 3: 런칭 후 2주차 (8시간)

### 목표
- 프로덕션 로깅 정리
- 보안 강화 (분산 Rate Limiter)

---

### FIX-06: console.log 정리 (592회)

**현재 상태**
- 109개 파일에 592회의 console 문
- API 응답, 에러 상세 등 포함

**작업 전략**

#### Step 1: 로깅 유틸리티 생성

**파일**: `lib/logger.ts` (새로 생성)

```typescript
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerOptions {
  level: LogLevel;
  context?: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const CURRENT_LEVEL = process.env.NODE_ENV === 'production' ? 'warn' : 'debug';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[CURRENT_LEVEL];
}

export const logger = {
  debug: (message: string, data?: unknown) => {
    if (shouldLog('debug')) {
      console.log(`[DEBUG] ${message}`, data ?? '');
    }
  },

  info: (message: string, data?: unknown) => {
    if (shouldLog('info')) {
      console.log(`[INFO] ${message}`, data ?? '');
    }
  },

  warn: (message: string, data?: unknown) => {
    if (shouldLog('warn')) {
      console.warn(`[WARN] ${message}`, data ?? '');
    }
  },

  error: (message: string, error?: unknown) => {
    if (shouldLog('error')) {
      console.error(`[ERROR] ${message}`, error ?? '');
      // 프로덕션에서는 Sentry로 전송
      // if (process.env.NODE_ENV === 'production') {
      //   Sentry.captureException(error);
      // }
    }
  },
};
```

#### Step 2: 우선순위별 교체

**높은 우선순위 (API 라우트)** - 먼저 처리

```bash
# API 라우트의 console 사용 확인
grep -rn "console\." app/api/ --include="*.ts" | wc -l
```

```typescript
// ❌ 변경 전
console.error("Failed to fetch:", error);

// ✅ 변경 후
import { logger } from '@/lib/logger';
logger.error("Failed to fetch", error);
```

**중간 우선순위 (컴포넌트)** - 다음 처리

```typescript
// ❌ 변경 전
console.log("User data:", user);

// ✅ 변경 후
logger.debug("User data loaded", { userId: user.id });
```

**낮은 우선순위 (CLI, 스크립트)** - 마지막 처리

```typescript
// CLI는 console 사용 유지 (사용자 출력용)
// 단, 민감 정보 제거
```

#### Step 3: ESLint 규칙 추가

**파일**: `eslint.config.mjs`

```javascript
{
  rules: {
    'no-console': ['warn', {
      allow: ['warn', 'error']
    }],
  },
}
```

**완료 조건**
- [ ] API 라우트에서 직접 console 사용 0건
- [ ] 컴포넌트에서 console.log 사용 0건
- [ ] logger 유틸리티로 통일

---

### FIX-07: 분산 Rate Limiter 구현

**현재 상태**
```typescript
// lib/rate-limit.ts
const rateLimitStore = new Map<string, RateLimitEntry>();
// 문제: 서버리스 환경에서 인스턴스간 공유 안됨
```

**작업 내용**

#### Step 1: Upstash 계정 및 Redis 생성

```bash
# 1. https://upstash.com 가입
# 2. Redis 데이터베이스 생성 (무료 티어)
# 3. REST URL 및 Token 복사
```

#### Step 2: 환경변수 추가

**파일**: `.env.local` 및 `.env.example`

```bash
# Rate Limiting (Upstash Redis)
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxxxx
```

#### Step 3: 의존성 설치

```bash
pnpm add @upstash/redis @upstash/ratelimit
```

#### Step 4: Rate Limiter 재구현

**파일**: `lib/rate-limit.ts` (전체 교체)

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Redis 클라이언트 (환경변수 자동 사용)
const redis = Redis.fromEnv();

// Rate Limiter 인스턴스들
export const rateLimiters = {
  /** Submit API: 10 requests per hour */
  submit: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 h"),
    prefix: "ratelimit:submit",
    analytics: true,
  }),

  /** Profile update: 20 requests per hour */
  profileUpdate: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, "1 h"),
    prefix: "ratelimit:profile",
  }),

  /** API key generation: 5 requests per day */
  apiKeyGen: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "24 h"),
    prefix: "ratelimit:apikey",
  }),

  /** General API: 100 requests per minute */
  general: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, "1 m"),
    prefix: "ratelimit:general",
  }),

  /** Bulk submit: 5 requests per hour */
  bulkSubmit: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "1 h"),
    prefix: "ratelimit:bulk",
  }),
};

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Check rate limit for a given identifier
 */
export async function checkRateLimit(
  limiter: Ratelimit,
  identifier: string
): Promise<RateLimitResult> {
  const { success, limit, remaining, reset } = await limiter.limit(identifier);

  return {
    success,
    limit,
    remaining,
    reset,
  };
}

/**
 * Create rate limit headers for response
 */
export function createRateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.reset.toString(),
  };
}

/**
 * Get client identifier from request
 */
export function getClientIdentifier(
  request: Request,
  apiKey?: string
): string {
  if (apiKey) {
    return `key:${apiKey}`;
  }

  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
  return `ip:${ip}`;
}
```

#### Step 5: API 라우트 업데이트

**파일**: `app/api/submit/route.ts`

```typescript
// ❌ 변경 전
const rateLimitResult = rateLimiters.submit(clientId);

// ✅ 변경 후
const rateLimitResult = await checkRateLimit(
  rateLimiters.submit,
  clientId
);
```

#### Step 6: 검증

```bash
# 로컬 테스트
curl -X POST http://localhost:3000/api/submit \
  -H "Content-Type: application/json" \
  -d '{"api_key": "test", "input_tokens": 100, "output_tokens": 50}'

# 11번째 요청에서 429 응답 확인
```

**완료 조건**
- [ ] Upstash Redis 연동
- [ ] 모든 rate limiter가 분산 환경에서 동작
- [ ] 기존 API 동작 정상

---

## 🧹 Phase 4: 런칭 후 1개월 (12시간+)

### 목표
- 코드 품질 완성
- 테스트 커버리지 확보

---

### FIX-08: 인라인 스타일 개선 (116곳)

**전략**: 모든 곳을 수정하는 것은 비효율적. 성능 영향이 큰 곳만 선별 개선.

**우선순위 높음** (자주 리렌더되는 컴포넌트)

| 파일 | 이유 |
|------|------|
| `components/leaderboard/*` | 리스트 아이템, 빈번한 업데이트 |
| `components/news/NewsCard.tsx` | 리스트 아이템 |
| `app/(main)/leaderboard/page.tsx` | 메인 페이지 |

**작업 패턴**

```tsx
// ❌ 변경 전
<div style={{ padding: 10, margin: 5 }}>

// ✅ 변경 후 (Tailwind 사용)
<div className="p-2.5 m-1.25">

// ✅ 변경 후 (동적 값이 필요한 경우)
const containerStyle = useMemo(() => ({
  width: calculatedWidth,
  height: calculatedHeight,
}), [calculatedWidth, calculatedHeight]);

<div style={containerStyle}>
```

**완료 조건**
- [ ] 주요 리스트 컴포넌트에서 인라인 스타일 제거
- [ ] 동적 스타일은 useMemo로 메모이제이션

---

### FIX-09: Admin 권한 로직 개선

**현재 상태**

```typescript
// lib/admin/guard.ts:21-24
if (process.env.NODE_ENV === "development") {
  return userId;  // 개발환경에서 모든 사용자가 admin
}
```

**작업 내용**

```typescript
// ✅ 변경 후
export async function checkAdmin(): Promise<string | null> {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  // 개발환경에서도 실제 admin 체크 (옵션)
  // 또는 환경변수로 제어
  if (process.env.NODE_ENV === "development") {
    // 특정 사용자만 허용하거나
    const devAdmins = process.env.DEV_ADMIN_IDS?.split(',') || [];
    if (devAdmins.length > 0 && !devAdmins.includes(userId)) {
      return null;
    }
    return userId;
  }

  // 프로덕션: DB에서 admin 체크
  // ... 기존 로직
}
```

**완료 조건**
- [ ] 개발환경에서도 admin 권한 제어 가능
- [ ] 환경변수로 개발 admin 지정 가능

---

### FIX-10: 단위 테스트 추가

**현재 상태**
- E2E 테스트: 39개 파일 (Playwright)
- 단위 테스트: 없음

**목표**
- 핵심 유틸리티 함수 테스트 커버리지 50%+
- API 라우트 통합 테스트

**작업 내용**

#### Step 1: 테스트 환경 설정

```bash
pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

**파일**: `vitest.config.ts` (새로 생성)

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules', 'tests/e2e'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
```

#### Step 2: 유틸리티 함수 테스트

**파일**: `lib/utils/__tests__/sanitize.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { sanitizeHtml, isNewArticle } from '../sanitize';

describe('sanitizeHtml', () => {
  it('removes script tags', () => {
    const input = '<p>Hello</p><script>alert("xss")</script>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('script');
    expect(result).toContain('<p>Hello</p>');
  });

  it('removes event handlers', () => {
    const input = '<div onclick="alert()">Click</div>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('onclick');
  });

  it('allows safe tags', () => {
    const input = '<p><strong>Bold</strong> and <em>italic</em></p>';
    const result = sanitizeHtml(input);
    expect(result).toBe(input);
  });

  it('adds rel="noopener noreferrer" to links', () => {
    const input = '<a href="https://example.com">Link</a>';
    const result = sanitizeHtml(input);
    expect(result).toContain('rel="noopener noreferrer"');
  });
});

describe('isNewArticle', () => {
  it('returns true for articles less than 24 hours old', () => {
    const recentDate = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    expect(isNewArticle(recentDate, recentDate)).toBe(true);
  });

  it('returns false for articles more than 24 hours old', () => {
    const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    expect(isNewArticle(oldDate, oldDate)).toBe(false);
  });
});
```

#### Step 3: Rate Limiter 테스트

**파일**: `lib/__tests__/rate-limit.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getClientIdentifier } from '../rate-limit';

describe('getClientIdentifier', () => {
  it('returns API key identifier when provided', () => {
    const mockRequest = new Request('http://localhost');
    const result = getClientIdentifier(mockRequest, 'test-key');
    expect(result).toBe('key:test-key');
  });

  it('returns IP identifier when no API key', () => {
    const mockRequest = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '192.168.1.1' },
    });
    const result = getClientIdentifier(mockRequest);
    expect(result).toBe('ip:192.168.1.1');
  });
});
```

#### Step 4: package.json 스크립트 추가

```json
{
  "scripts": {
    "test": "vitest",
    "test:coverage": "vitest --coverage"
  }
}
```

**완료 조건**
- [ ] vitest 설정 완료
- [ ] 핵심 유틸리티 테스트 작성
- [ ] `pnpm test` 통과
- [ ] 커버리지 50%+ (핵심 유틸리티)

---

## 📅 실행 일정 요약

```
Week 0 (런칭일)
├── FIX-01: Clerk prop (15분) ✅
└── FIX-02: PostHog debug (10분) ✅

Week 1
├── FIX-03: 이미지 최적화 (2시간)
├── FIX-04: React Hook (3시간)
└── FIX-05: 미사용 변수 (1시간)

Week 2
├── FIX-06: console.log 정리 (4시간)
└── FIX-07: 분산 Rate Limiter (4시간)

Week 3-4
├── FIX-08: 인라인 스타일 (4시간)
├── FIX-09: Admin 권한 (30분)
└── FIX-10: 단위 테스트 (8시간+)
```

---

## ✅ 체크리스트

### Phase 1 완료 조건
- [ ] Clerk deprecated 경고 제거
- [ ] PostHog debug 프로덕션 비활성화
- [ ] 런칭 준비 완료

### Phase 2 완료 조건
- [ ] ESLint `@next/next/no-img-element` 경고 0건
- [ ] ESLint `react-hooks/exhaustive-deps` 경고 0건
- [ ] ESLint `no-unused-vars` 경고 0건

### Phase 3 완료 조건
- [ ] logger 유틸리티로 console 통일
- [ ] Upstash Redis Rate Limiter 동작
- [ ] 프로덕션 로그 정리

### Phase 4 완료 조건
- [ ] 주요 컴포넌트 인라인 스타일 제거
- [ ] Admin 권한 로직 개선
- [ ] 테스트 커버리지 50%+

---

*이 계획서는 발견된 모든 이슈의 체계적 해결을 위한 가이드입니다.*
*각 Phase는 독립적으로 진행 가능하며, 우선순위에 따라 조정할 수 있습니다.*
