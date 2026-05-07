# CCgather 옵션 B-1 — 랜딩+리더보드 통합 개편

> 작성: 2026-05-08 08:08 KST

## 목적

ccgather.com `/`(랜딩 페이지)를 풀 라이브 리더보드로 전환하여:

1. **검색 의도-콘텐츠 일치도 ↑** — Viberank가 우리보다 자산이 적은데 SEO 1위인 이유는 "claude code leaderboard" 검색 의도와 페이지가 즉시 일치하기 때문. 우리도 같은 구조로 1위 도전.
2. **폐쇄성 인식 해소** — 현재 랜딩의 mock 데이터(`user_1, user_2…`)가 "이 사이트 살아있나?" 의문을 만듦. 라이브 실데이터 노출로 즉시 신뢰 구축.
3. **USP 전면화** — "Claude는 30일 후 잊지만, 우리는 영원히 기억" 차별화를 첫 화면에 명시.
4. **Globe 1개 통합** — 현재 hero globe(장식) + data globe(인터랙티브) 2개 → 인터랙티브 1개로 통합 (디자인 일관성 + LCP 개선).

## 배경 (진단)

- GSC 우상향 중이나 회원 가입 0
- 트래픽 1위: Viberank (대시보드 직행), 2위: CCgather (랜딩)
- 카테고리 표준: CLI 제출 (ccusage `npx ccusage --json` → submit)
- 헤비유저 타겟 (일반 사용자는 토큰 절약 본능, 자랑 동기 X)
- 사용자 가치 제안 2가지:
  1. 글로벌 순위 (parity)
  2. **30일 만료 데이터 영구 보존 (유일한 진짜 USP)**

## 변경 범위

### 변경

| 영역 | Before | After |
|---|---|---|
| `/` (랜딩) | LandingHero (globe + headline + stats + CTA + 스텝) → LeaderboardPreview (mock 5명) → HowItWorks → WhyCCgather → SocialProof → Footer | **USP 띠** (압축된 LandingHero, globe 제거) → **/leaderboard 콘텐츠 통째 이동** (GlobeStatsSection + FilterBar + LeaderboardTable + 페이지네이션) → HowItWorks → WhyCCgather → SocialProof → Footer |
| `/leaderboard` (별도 풀 페이지) | 풀 leaderboard 페이지 (가상 스크롤) | **`/` 로 301 redirect** (디렉터리는 유지하되 redirect 우선) |
| `LeaderboardPreview.tsx` | mock 데이터 5명 표시 | **삭제** (이제 `/`에서 실데이터 표시) |
| `LeaderboardTable` | 가상 스크롤 | **페이지네이션** (한 페이지 20명, URL `?page=N` 동기화) |
| 헤드라인 | "Claude Code Leaderboard / Track & Compare Globally" | "Don't let Claude forget your journey" / "Claude는 30일 후 잊지만, 우리는 영원히 기억합니다" |
| OAuth | GitHub만 | **GitHub + Google** |

### 변경하지 않음

- `/community`, `/u/...`, `/league/...`, `/cli`, `/settings/usage` 등 기존 라우트
- 자체 CLI 흐름 (`npx ccgather`) — 카테고리 표준
- DB 스키마 / Supabase migrations
- 컬러 토큰, 폰트, 글래스모피즘, Framer Motion 인터랙션 등 디자인 시스템
- GlobeStatsSection의 인터랙티브 동작 (필터 연동, MobileGlobePanel, particles)
- 회원가입/로그인 시스템 본질

## 와이어 (데스크톱)

```
┌────────────────────────────────────────────────────────────┐
│ Header (그대로)                                              │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ ✨ USP 띠 (LandingHero 압축, globe 제거)                     │
│ "Don't let Claude forget your journey"                     │
│ Stats(40+ countries / tokens / spent)                      │
│ [Sign in with GitHub]  [Continue with Google]              │
│ Quick Start: 🔐 → ⚡ npx ccgather → 📊                       │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ Live Leaderboard (이전 /leaderboard 콘텐츠 통째 이동)        │
│ ┌──────────┐  ┌──────────────────────────────────────────┐ │
│ │ Globe    │←→│ FilterBar 🌐|🇰🇷 [All][7d][30d] 🔍       │ │
│ │ Stats    │  ├──────────────────────────────────────────┤ │
│ │ Section  │  │ # Flag User       Level   Cost   Tokens   │ │
│ │ (필터연동)│  │ 🥇 🇺🇸 @geoff    Lv.7   $458K  12.9B    │ │
│ │          │  │ 🥈 🇰🇷 @dhxwhy   Lv.6   $30K   8.5B     │ │
│ │ Mobile   │  │ ⋮                                          │ │
│ │ →panel   │  │ [< 1 2 3 4 5 >] (페이지네이션, ?page=N)   │ │
│ └──────────┘  └──────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ HowItWorks (그대로)                                          │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ WhyCCgather (그대로)                                         │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ SocialProof + Footer (그대로)                                │
└────────────────────────────────────────────────────────────┘
```

## 디자인 가드레일 (변경 절대 금지)

- 컬러 토큰 (`#DA7756` Claude coral 포함, 모든 `--color-*` 변수)
- 폰트/타이포 위계
- 글래스모피즘 (`.glass`)
- Framer Motion 마이크로 인터랙션 (scroll-reveal, panel-reveal, shimmer-text 등)
- 라운드/spacing 리듬 (`rounded-xl`, `rounded-lg`, `gap-*`, `py-*` 기존 값)
- GlobeStatsSection의 인터랙티브 동작 100% 보존
- 레벨/뱃지/플래그 아이콘 시스템

## perf KPI (배포 전 검증)

| 지표 | 목표 | 보호 전략 |
|---|---|---|
| LCP | < 2.5s | dynamic import + ISR + GlobePlaceholder |
| INP | < 200ms | 페이지네이션 (가상스크롤보다 가벼움 — 보너스) |
| CLS | < 0.1 | placeholder fixed dimension |

위반 시: lazy load + Suspense + dynamic import 강화. 그래도 안 풀리면 사용자 보고 후 중단.

## 마이그레이션 단계

1. 단계 0: 브랜치 준비 (bun.lock commit + `feat/option-b-landing-redesign` 생성)
2. 단계 1: spec 작성 (이 문서)
3. 단계 2: Google OAuth 추가 (Clerk)
4. 단계 3: LandingHero 압축 (globe 제거, 헤드라인 USP, CTA 두 OAuth)
5. 단계 4: `/leaderboard` 콘텐츠를 `/`로 통합
6. 단계 5: LeaderboardTable 페이지네이션 리팩토링
7. 단계 6: `/leaderboard` → `/` 301 redirect
8. 단계 7: mock LeaderboardPreview 삭제
9. 단계 8: 검증 (typecheck + lint + build, 디자인 가드레일 점검)
10. 단계 9: push + Vercel preview URL 보고

## 롤백

- production 영향 X (preview URL only)
- 사용자 컨펌 후 main merge
- merge 후 문제 시 Vercel 대시보드에서 이전 production deploy로 즉시 revert
- 또는 `git revert <merge-commit>` 후 main push

## 품질 게이트 (push 전 필수, 모두 통과 시에만 push)

### 1. 빌드 검증
- [ ] `bunx tsc --noEmit` 통과 (타입 에러 0)
- [ ] `bun run lint` 통과 (lint 경고 0)
- [ ] `bun run build` 통과 (production build 성공)

### 2. 동작 검증 (manual test, `bun dev`)
- [ ] `/` 접속 — 페이지 정상 렌더 (콘솔 에러 0)
- [ ] USP 띠: 헤드라인/Stats/Quick Start/CTA 표시 확인
- [ ] GlobeStatsSection 인터랙티브:
  - [ ] Global ↔ Country 필터 클릭 시 globe markers 업데이트
  - [ ] All/7d/30d 기간 필터 정상 동작
  - [ ] 검색 정상 동작
  - [ ] 모바일 → MobileGlobePanel 정상 동작
- [ ] LeaderboardTable 페이지네이션:
  - [ ] `[< 1 2 3 4 5 >]` 클릭 시 페이지 전환
  - [ ] URL `?page=N` 동기화 + 새로고침 시 상태 유지
  - [ ] 필터 변경 시 페이지 1로 리셋
- [ ] `/leaderboard` 접속 → `/` 301 redirect (network tab 확인)
- [ ] GitHub OAuth 흐름 정상
- [ ] Google OAuth 흐름 정상 (Clerk 콘솔에 Google provider 활성화 필요)
- [ ] 로그인 후 `/onboarding` 또는 `/leaderboard` 정상 진입
- [ ] HowItWorks/WhyCCgather/SocialProof/Footer 정상 표시

### 3. 모순 검토 (코드 일관성)
- [ ] 데이터 흐름: server fetch → component → render 단계별 타입 일치
- [ ] import 정리: dead import, 미사용 컴포넌트 0
- [ ] mock 흔적 0: `grep -r "MOCK_\|user_1\|user_2\|user_3\|user_4\|user_5"` 결과 코드 영역에 없음
- [ ] 디자인 토큰 변경 0: 새 색상/폰트/spacing 추가 X
- [ ] middleware.ts public route 일관성 (redirect 추가 후 영향 검토)
- [ ] 두 globe 동시 존재 X (LandingHero hero globe 완전 삭제 확인)

### 4. 반응형 검증
- [ ] 데스크톱 (1280px+): globe + table 좌우 균형
- [ ] 태블릿 (768~1024px): globe 작게, table 그대로
- [ ] 모바일 (<768px): MobileGlobePanel 동작, table 세로 압축

### 5. perf 검증 (로컬 Lighthouse)
- [ ] LCP < 2.5s — 위반 시 lazy load/Suspense 강화
- [ ] INP < 200ms — 위반 시 인터랙션 핸들러 디바운스/RAF 검토
- [ ] CLS < 0.1 — 위반 시 placeholder fixed dimension 추가
- [ ] 결과 이 spec 끝의 "perf 측정 결과" 섹션에 기록

### 6. 근본 해결 (디버깅 — 임시 우회 절대 금지)
이슈 발견 시 CLAUDE.md "Fix Loop 자가 검증" 절차 준수:
1. 근본 원인 1~2문장 문서화 (왜 이전 수정이 실패했는지)
2. 데이터 흐름 전수 추적 — 생성→전달→소비 각 단계 실제 타입/값 확인
3. 수정 전 영향 범위 grep — 식별자(함수명/prop/컬럼) 전체 검색
4. 수정 후 E2E 시뮬레이션 — 클릭→API→state→렌더 흐름 코드로 한번 더
5. 결과 spec에 기록 — 이전 실패 원인 / 이번 수정 / 검증

같은 이슈 3회 재발 또는 typecheck/build 3회 이상 실패 시 → **사용자에게 보고하고 중단** (절대 우회 금지, `--no-verify` 금지).

## perf 측정 결과 (Ralph 작업 후 채움)

| 지표 | 측정값 | 통과? |
|---|---|---|
| LCP | TBD | TBD |
| INP | TBD | TBD |
| CLS | TBD | TBD |
| Lighthouse Performance | TBD | TBD |

## 다음 단계 (Ralph 작업 완료 후)

1. 사용자가 Vercel preview URL에서 디자인 검토
2. 피드백 반복 (commit + push로 preview 자동 업데이트)
3. 합의 → PR 생성 → main merge → production 배포
4. 1~2주 모니터링: GSC 순위 / Lighthouse CWV / 가입자 수 (before 30일 vs after 30일)
5. 결과에 따라 다음 개선 사이클 (시뮬 위젯, ccusage upload 등) 결정

## 참조

- 이전 카테고리 1위: [Viberank](https://www.viberank.app/) (sculptdotfun/viberank, 98 stars)
- ccusage 표준: [ryoppippi/ccusage](https://github.com/ryoppippi/ccusage) (13.8k stars)
- ccusage 통합 issue: [#234](https://github.com/ryoppippi/ccusage/issues/234)
- 사례: Geoff Huntley `$458,000 / 12.9B` Viberank #1
