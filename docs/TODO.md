# CCgather Setup TODO

**Last Updated:** 2026-01-06

---

## 개발 완료 항목

### ✅ 프론트엔드
- [x] Next.js 16 + App Router 설정
- [x] Tailwind CSS 4 설정
- [x] 다크 테마 UI 구현
- [x] 랜딩 페이지
- [x] 리더보드 페이지 (필터: Global/Country, Period)
- [x] 뉴스 페이지
- [x] CLI 모달 (헤더, 랜딩페이지 연동)
- [x] 레벨/뱃지 시스템 UI
- [x] 프로필 사이드 패널

### ✅ CLI 패키지
- [x] `npx ccgather` - 수동 제출 (ViberRank 방식)
- [x] `npx ccgather rank` - 순위 확인
- [x] `npx ccgather --auto` - 자동 동기화 (선택)
- [x] `npx ccgather reset` - 초기화
- [x] cc.json 및 JSONL 파싱

---

## 설정 체크리스트 (배포 전 필수)

### 1. Git (버전 관리)
- [ ] GitHub 레포지토리 생성
- [ ] 첫 커밋 및 푸시
- [ ] .gitignore 확인 (internal/, .env 제외)
- [ ] 브랜치 전략 설정 (main, develop)

### 2. Supabase (데이터베이스)
- [ ] Supabase 프로젝트 생성
- [ ] `NEXT_PUBLIC_SUPABASE_URL` 발급
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` 발급
- [ ] `SUPABASE_SERVICE_ROLE_KEY` 발급
- [ ] 마이그레이션 실행 (`supabase/migrations/`)
- [ ] RLS 정책 적용
- [ ] DB Functions 생성 (calculate_level, update_stats)
- [ ] Supabase 타입 생성 (`supabase gen types`)

### 3. Clerk (인증)
- [ ] Clerk 계정 생성
- [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` 발급
- [ ] `CLERK_SECRET_KEY` 발급
- [ ] `CLERK_WEBHOOK_SECRET` 설정
- [ ] OAuth 제공자 설정 (GitHub)
- [ ] 리다이렉트 URL 설정
- [ ] Webhook 엔드포인트 등록 (`/api/webhooks/clerk`)

### 4. Vercel (배포)
- [ ] Vercel 프로젝트 생성
- [ ] GitHub 레포 연결
- [ ] 환경변수 설정 (모든 .env 값)
- [ ] 도메인 연결 (ccgather.com)
- [ ] SSL 인증서 확인
- [ ] Preview 배포 테스트

### 5. 크롤링 & AI (뉴스 시스템)
- [ ] Supabase Edge Functions 설정
- [ ] `news-crawler` 함수 배포
- [ ] `ai-summarizer` 함수 배포
- [ ] `ANTHROPIC_API_KEY` 발급
- [ ] Cron 스케줄 설정 (2시간마다)

### 6. Analytics & Monitoring (선택)
- [ ] Vercel Analytics 활성화
- [ ] `NEXT_PUBLIC_VERCEL_ANALYTICS_ID` 설정
- [ ] Sentry 프로젝트 생성
- [ ] `SENTRY_DSN` 설정

---

## CLI 명령어 요약

```bash
npx ccgather              # 리더보드에 제출 (기본)
npx ccgather rank         # 현재 순위 확인
npx ccgather --auto       # 자동 동기화 활성화 (선택)
npx ccgather --manual     # 자동 동기화 비활성화
npx ccgather reset        # 설정 초기화
npx ccgather -y           # 확인 없이 바로 제출
```

자세한 내용: [CLI.md](./CLI.md)

---

## 우선순위

```
🔴 필수 (런칭 전)
├── 1. Git
├── 2. Supabase
├── 3. Clerk
└── 4. Vercel

🟡 중요 (기능 완성)
├── 5. 크롤링 (뉴스 기능)
└── 5. AI 요약 (뉴스 기능)

🟢 선택 (운영 최적화)
├── 6. Vercel Analytics
└── 6. Sentry
```

---

## 환경변수 요약

```env
# App
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_APP_NAME=CCgather

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI (Internal)
ANTHROPIC_API_KEY=

# Analytics (Optional)
NEXT_PUBLIC_VERCEL_ANALYTICS_ID=
SENTRY_DSN=
```

---

## 진행 상황

| 항목 | 상태 | 비고 |
|------|------|------|
| 프론트엔드 | ✅ 완료 | UI 구현 완료 |
| CLI 패키지 | ✅ 완료 | 수동 제출 방식 |
| Git | ⬜ 미완료 | |
| Supabase | ⬜ 미완료 | |
| Clerk | ⬜ 미완료 | |
| Vercel | ⬜ 미완료 | |
| 크롤링 | ⬜ 미완료 | |
| Analytics | ⬜ 미완료 | 선택 |

**범례:** ✅ 완료 | 🔄 진행중 | ⬜ 미완료
