# News Tab Major Migration Plan

> **모드**: 🏗️ Major (전면 리팩토링)
> **생성일**: 2026-01-12
> **목적**: 신뢰도 향상을 위한 News 탭 전면 개편

---

## 📋 Migration Overview

### 변경 사유
- **문제점**: Claude Code 버전 정보를 직접 재창작하여 제공 중
- **리스크**: 누락/오류 시 서비스 신뢰도 하락
- **해결책**: 공식 자료는 하이퍼링크로 제공, 뉴스 콘텐츠만 자체 운영

### AS-IS (현재 구조)
```
News Tab
├── Changelog (버전 정보 직접 제공)
│   ├── 버전별 상세 페이지
│   └── Highlights (가이드)
├── FOR BEGINNERS (용어 사전)
│   └── 개별 용어 상세 페이지
├── Anthropic Official (뉴스)
└── Press News (뉴스)
```

### TO-BE (목표 구조)
```
News Tab (리뉴얼)
├── 🔗 Quick Links (하이퍼링크 버튼)
│   ├── Claude Code Changelog (공식)
│   ├── Anthropic News (공식)
│   └── Claude Code Docs (공식)
└── 📰 News
    ├── Claude Code News (키워드 뉴스 → CCgather 페르소나 재작성)
    └── AI News (AI 관련 뉴스 → CCgather 페르소나 재작성)
```

---

## 🗑️ Phase 1: 제거 대상 분석

### 1.1 Frontend 제거 대상

| 경로 | 설명 | 영향 |
|------|------|------|
| `app/(main)/news/changelog/` | 체인지로그 메인 + 상세 페이지 | 전체 삭제 |
| `app/(main)/news/changelog/[version]/` | 버전별 상세 페이지 | 전체 삭제 |
| `app/(main)/news/beginners/` | FOR BEGINNERS 메인 페이지 | 전체 삭제 |
| `app/(main)/news/beginners/[slug]/` | 용어 상세 페이지 | 전체 삭제 |
| `app/(main)/news/guides/[slug]/` | 가이드 상세 페이지 | 전체 삭제 |
| `app/(main)/news/updates/[slug]/` | 업데이트 상세 페이지 | 전체 삭제 |
| `app/(main)/news/page.tsx` | 메인 페이지 | **리뉴얼** (제거 아님) |

### 1.2 API 제거 대상

| 경로 | 설명 | 영향 |
|------|------|------|
| `app/api/news/changelog/` | 체인지로그 API | 전체 삭제 |
| `app/api/news/changelog/[version]/` | 버전 상세 API | 전체 삭제 |
| `app/api/news/beginners/` | FOR BEGINNERS API | 전체 삭제 |
| `app/api/news/beginners/[slug]/` | 용어 상세 API | 전체 삭제 |
| `app/api/news/beginners/search/` | 용어 검색 API | 전체 삭제 |
| `app/api/news/guides/[slug]/` | 가이드 API | 전체 삭제 |
| `app/api/admin/changelog/` | Admin 체인지로그 관리 | 전체 삭제 |
| `app/api/admin/changelog/generate/` | AI 생성 API | 전체 삭제 |
| `app/api/admin/changelog/items/` | 항목 관리 API | 전체 삭제 |
| `app/api/admin/beginners/` | Admin FOR BEGINNERS 관리 | 전체 삭제 |
| `app/api/admin/beginners/generate/` | AI 생성 API | 전체 삭제 |

### 1.3 Database 제거 대상 (Supabase)

| 테이블/뷰 | 설명 | 마이그레이션 |
|-----------|------|--------------|
| `changelog_versions` | 버전 목록 | DROP TABLE |
| `changelog_items` | 변경 항목 | DROP TABLE |
| `beginners_dictionary` | 용어 사전 | DROP TABLE |
| `content_generation_logs` | AI 처리 로그 | DROP TABLE |
| `changelog_versions_with_counts` (View) | 버전 집계 뷰 | DROP VIEW |
| `beginners_category_counts` (View) | 카테고리 집계 뷰 | DROP VIEW |

### 1.4 기타 제거 대상

| 경로 | 설명 |
|------|------|
| `lib/data/news-content.ts` | 정적 뉴스/업데이트 데이터 |
| `types/changelog.ts` (일부) | Changelog, Beginners 타입 |
| `components/news/` (일부) | Changelog, Beginners 컴포넌트 |
| `tests/e2e/news-changelog.spec.ts` | 체인지로그 테스트 |
| `tests/e2e/news-beginners.spec.ts` | FOR BEGINNERS 테스트 |
| `tests/e2e/news-guides.spec.ts` | 가이드 테스트 |

---

## ✅ Phase 2: 유지 대상

### 2.1 유지할 DB 테이블

| 테이블 | 용도 | 비고 |
|--------|------|------|
| `contents` | 뉴스 콘텐츠 저장 | 뉴스 탭 핵심 |
| `admin_settings` | 자동화 설정 | 뉴스 크롤링 설정 |
| `ai_usage_log` | AI 사용 로그 | 비용 추적 (선택적 유지) |

### 2.2 유지/수정할 API

| 경로 | 용도 | 비고 |
|------|------|------|
| `app/api/news/route.ts` | 뉴스 목록 | 유지 |
| `app/api/news/contents/route.ts` | 콘텐츠 관리 | 유지 |
| `app/api/admin/contents/` | Admin 콘텐츠 관리 | 유지 |
| `app/api/admin/crawl/` | 크롤링 API | 유지 |

---

## 📐 Phase 3: 실행 계획

### Step 1: Git 브랜치 생성 (롤백 준비)
```bash
git checkout -b refactor/news-tab-renewal
```

### Step 2: Frontend 코드 제거
1. `app/(main)/news/changelog/` 폴더 삭제
2. `app/(main)/news/beginners/` 폴더 삭제
3. `app/(main)/news/guides/` 폴더 삭제
4. `app/(main)/news/updates/` 폴더 삭제

### Step 3: API 코드 제거
1. `app/api/news/changelog/` 폴더 삭제
2. `app/api/news/beginners/` 폴더 삭제
3. `app/api/news/guides/` 폴더 삭제
4. `app/api/admin/changelog/` 폴더 삭제
5. `app/api/admin/beginners/` 폴더 삭제

### Step 4: 컴포넌트/타입/유틸 정리
1. `lib/data/news-content.ts` 삭제 또는 정리
2. `types/changelog.ts` 불필요 타입 제거
3. `components/news/` 불필요 컴포넌트 제거

### Step 5: Supabase 마이그레이션 작성
```sql
-- 023_remove_changelog_beginners.sql
DROP VIEW IF EXISTS public.changelog_versions_with_counts;
DROP VIEW IF EXISTS public.beginners_category_counts;
DROP TABLE IF EXISTS public.content_generation_logs;
DROP TABLE IF EXISTS public.beginners_dictionary;
DROP TABLE IF EXISTS public.changelog_items;
DROP TABLE IF EXISTS public.changelog_versions;
```

### Step 6: 테스트 파일 정리
1. `tests/e2e/news-changelog.spec.ts` 삭제
2. `tests/e2e/news-beginners.spec.ts` 삭제
3. `tests/e2e/news-guides.spec.ts` 삭제

### Step 7: News 메인 페이지 리뉴얼
- Quick Links 섹션 추가
- Claude Code News / AI News 섹션 구성

### Step 8: 빌드 검증
```bash
pnpm typecheck
pnpm lint
pnpm build
```

### Step 9: Supabase 마이그레이션 적용
```bash
npx supabase db push
```

---

## ⚠️ 체크포인트

- [x] Step 2 완료: Frontend 제거 → `pnpm typecheck` 통과 ✅
- [x] Step 3 완료: API 제거 → `pnpm typecheck` 통과 ✅
- [x] Step 4 완료: 컴포넌트 정리 → `pnpm typecheck` 통과 ✅
- [x] Step 6 완료: 테스트 정리 → 기존 테스트 통과 ✅
- [x] Step 7 완료: 페이지 리뉴얼 → 로컬 확인 ✅
- [x] Step 8 완료: 빌드 성공 ✅
- [x] Step 9 완료: DB 마이그레이션 적용 ✅ (2026-01-12)

---

## 🔄 롤백 전략

```bash
# 문제 발생 시
git checkout main
git branch -D refactor/news-tab-renewal
```

---

## 📝 Phase 4: 전문가 패널 논의 대기 항목

마이그레이션 완료 후 논의할 내용:

1. **CCgather 페르소나 (프롬프트)**
   - 뉴스 재작성 시 사용할 톤앤매너
   - AI 프롬프트 컨텍스트 설계

2. **콘텐츠 선정 기준**
   - Claude Code News 키워드/소스
   - AI News 범위 및 필터링

3. **News 탭 UX/UI**
   - Quick Links 디자인
   - 뉴스 카드 레이아웃

4. **SEO 전략**
   - 메타데이터 최적화
   - 구조화된 데이터

---

## 📊 영향 범위 요약

| 카테고리 | 제거 | 유지 | 수정 |
|----------|------|------|------|
| 페이지 | 6개 | 1개 | 1개 |
| API 라우트 | 11개 | 4개 | - |
| DB 테이블 | 4개 | 2-3개 | - |
| 컴포넌트 | TBD | TBD | - |
| 테스트 | 3개 | TBD | - |

**총 영향 파일**: ~30개 이상
**위험도**: 🔴 High (전면 리팩토링)
**예상 작업량**: Major 모드

---

## 📌 세션 맥락 유지 참고

> 이 문서는 세션이 압축되거나 새로운 세션에서 작업을 이어갈 때 참고용입니다.
> 현재 진행 상황은 체크포인트 섹션을 확인하세요.

**현재 단계**: Phase 1 분석 완료, 사용자 확인 대기 중
