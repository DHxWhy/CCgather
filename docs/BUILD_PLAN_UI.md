# BUILD_PLAN - UI/UX 개선 (Synk 스타일 + Claude Identity)

> 참조 문서: `docs/UI_UX_IMPROVEMENT_PLAN.md`

---

## 개요

CCGather UI/UX 개선 프로젝트의 구현 계획입니다.
dev_agent.md의 α/β 사이클 패턴을 적용하여 병렬 빌드를 수행합니다.

---

## Phase 1: 기반 시스템 (Foundation)

### Group G1: CSS 변수 시스템 (의존성: 없음)

**목표**: 듀얼 테마(Light/Dark) CSS 변수 시스템 구축

#### Task 1.1: globals.css 리팩토링
```
파일: src/app/globals.css
작업:
- Claude Identity 색상 변수 정의
- Light Mode 변수 정의
- Dark Mode 변수 정의 (:root.dark)
- 시맨틱 컬러 토큰 추가
- 글래스모피즘 변수 추가
- 그라데이션 변수 추가

생성할 CSS 변수:
--color-claude-coral: #DA7756
--color-claude-terracotta: #D4714E
--color-claude-peach: #E8A087
--color-claude-rust: #B85C3D
--color-bg-primary/secondary/card/elevated
--color-text-primary/secondary/muted/disabled
--border-default/hover
--glass-bg/border
--shadow-sm/md/lg/glow
--gradient-claude
```

#### Task 1.2: Tailwind 설정 확장
```
파일: tailwind.config.ts (또는 .js)
작업:
- darkMode: 'class' 설정
- CSS 변수 기반 색상 확장
- Claude 색상 팔레트 추가
- 커스텀 박스섀도우 추가
- 반응형 브레이크포인트 확장

colors 확장:
- claude.coral/terracotta/peach/rust/sand/cream
- bg.primary/secondary/card/card-hover/elevated
- text.primary/secondary/muted/disabled
```

---

### Group G2: 테마 스위처 개선 (의존성: G1)

**목표**: 기존 theme-switcher.tsx를 CSS 변수 시스템과 연동

#### Task 2.1: ThemeSwitcher 컴포넌트 개선
```
파일: components/ui/theme-switcher.tsx
작업:
- CSS 변수 시스템 연동
- 테마 전환 시 깜빡임 방지 (suppressHydrationWarning)
- 시스템 테마 감지 개선
- 애니메이션 추가

검증:
- 라이트 ↔ 다크 전환 정상
- 시스템 설정 자동 감지
- localStorage 저장/복원
- SSR hydration mismatch 없음
```

---

## Phase 2: 커스텀 커서 시스템 (Cursor)

### Group G3: 커서 컨텍스트 및 훅 (의존성: G1)

**목표**: 커서 상태 관리 시스템 구축

#### Task 3.1: CursorContext 생성
```
파일: components/ui/cursor/CursorContext.tsx
작업:
- 커서 상태 타입 정의 (default/pointer/text/loading/drag)
- Context Provider 생성
- 커서 위치 상태 관리
- 커서 스케일/투명도 상태 관리

인터페이스:
interface CursorState {
  type: 'default' | 'pointer' | 'text' | 'loading' | 'drag';
  scale: number;
  opacity: number;
  isVisible: boolean;
}
```

#### Task 3.2: useCursor 훅 생성
```
파일: lib/hooks/useCursor.ts
작업:
- 커서 상태 접근 훅
- 커서 상태 변경 함수
- 요소 호버 감지 유틸리티
- 디바이스 감지 (마우스 vs 터치)

함수:
- useCursor(): { cursorState, setCursorType, ... }
- useCursorHover(type): refCallback
```

---

### Group G4: 커서 컴포넌트 (의존성: G3)

**목표**: 시각적 커서 컴포넌트 구현

#### Task 4.1: CustomCursor 메인 컴포넌트
```
파일: components/ui/cursor/CustomCursor.tsx
작업:
- 마우스 위치 추적 (requestAnimationFrame)
- 커서 렌더링 (메인 원 + 내부 도트)
- 상태별 스타일 변형
- 터치 디바이스 자동 비활성화
- 60fps 성능 최적화

스타일:
- 기본: 12px 원형, Claude Coral 테두리
- 호버: 2.5배 확장, glow 효과
- 클릭: 0.8배 축소, 채워진 배경
```

#### Task 4.2: CursorTrail 효과 (선택)
```
파일: components/ui/cursor/CursorTrail.tsx
작업:
- 커서 이동 경로에 잔상 효과
- fade-out 애니메이션
- 성능 최적화 (최대 10개 트레일)

CSS:
@keyframes trail-fade {
  to { opacity: 0; transform: scale(0.5); }
}
```

#### Task 4.3: 커서 스타일 CSS
```
파일: styles/cursor.css
작업:
- .cursor-main 기본 스타일
- .cursor-main.hover 호버 스타일
- .cursor-main.click 클릭 스타일
- .cursor-trail 트레일 스타일
- mix-blend-mode: difference
```

---

## Phase 3: 반응형 레이아웃 (Responsive)

### Group G5: 레이아웃 컴포넌트 (의존성: G1, G2)

**목표**: 반응형 레이아웃 컴포넌트 구축

#### Task 5.1: Container 컴포넌트
```
파일: components/layout/Container.tsx
작업:
- 반응형 max-width 시스템
- 반응형 패딩 (px-4 sm:px-6 lg:px-8)
- size variants (sm/md/lg/xl/full)

Props:
- size: 'sm' | 'md' | 'lg' | 'xl' | 'full'
- className?: string
- children: ReactNode
```

#### Task 5.2: Header 리팩토링
```
파일: components/layout/header.tsx
작업:
- 글래스모피즘 배경 적용
- 반응형 네비게이션:
  - 모바일 (< 768px): 햄버거 메뉴
  - 태블릿 (768-1023px): 축소 메뉴
  - 데스크톱 (>= 1024px): 전체 메뉴
- 로고 Claude 그라데이션 적용
- 링크 언더라인 애니메이션
- CTA 버튼 glow 효과
- 테마 스위처 통합

검증:
- 모든 브레이크포인트에서 정상 표시
- 모바일 메뉴 열기/닫기 동작
- 테마 전환 시 스타일 유지
```

#### Task 5.3: MobileDrawer 컴포넌트
```
파일: components/layout/MobileDrawer.tsx
작업:
- 슬라이드-인 애니메이션
- 오버레이 배경
- 닫기 버튼/외부 클릭 닫기
- 포커스 트랩 (접근성)
- 스크롤 잠금

Props:
- open: boolean
- onClose: () => void
- children: ReactNode
```

#### Task 5.4: Footer 리팩토링
```
파일: components/layout/footer.tsx
작업:
- CSS 변수 적용
- 반응형 레이아웃
- Claude 그라데이션 로고
- 호버 효과 개선
```

---

## Phase 4: UI 컴포넌트 시스템

### Group G6: 기본 UI 컴포넌트 (의존성: G1)

**목표**: 디자인 시스템 기반 UI 컴포넌트

#### Task 6.1: Button 컴포넌트
```
파일: components/ui/Button.tsx
작업:
- variant: primary/secondary/outline/ghost/tab
- size: sm/md/lg
- Claude 그라데이션 primary
- glow 호버 효과
- 로딩 상태
- 아이콘 지원 (leftIcon/rightIcon)

Primary 스타일:
bg-gradient-to-r from-claude-coral to-claude-rust
hover:shadow-glow
active:scale-95
```

#### Task 6.2: Card 컴포넌트
```
파일: components/ui/Card.tsx
작업:
- variant: default/glass/glow/ranking
- hoverable 옵션
- 라이트/다크 테마 대응
- 호버 시 border 하이라이트

Glass 스타일:
bg-glass-bg backdrop-blur-xl border-glass-border
hover:border-claude-coral/30
hover:shadow-[0_0_40px_rgba(218,119,86,0.1)]
```

#### Task 6.3: Input 컴포넌트
```
파일: components/ui/Input.tsx
작업:
- 기본 텍스트 입력
- 아이콘 지원 (prefix/suffix)
- 에러/성공 상태
- 포커스 시 Claude coral ring
- 라이트/다크 테마 대응

Focus 스타일:
focus:border-claude-coral/50
focus:ring-2 focus:ring-claude-coral/20
```

#### Task 6.4: Badge 컴포넌트
```
파일: components/ui/Badge.tsx
작업:
- variant: default/success/error/warning/info
- size: sm/md
- 랭킹 변동 표시용 (상승/하락)
- 아이콘 지원
```

#### Task 6.5: Avatar 컴포넌트
```
파일: components/ui/Avatar.tsx
작업:
- size: xs/sm/md/lg/xl
- 이미지/폴백 지원
- 온라인 상태 표시
- 랭킹 메달 오버레이 (1/2/3등)
```

---

### Group G7: 리더보드 전용 컴포넌트 (의존성: G6)

**목표**: 리더보드 페이지 전용 컴포넌트

#### Task 7.1: TopThreeCard 컴포넌트
```
파일: components/leaderboard/TopThreeCard.tsx
작업:
- 1/2/3등 차등 디자인
- Gold/Silver/Bronze glow 효과
- 왕관 아이콘 (1등)
- 반응형 레이아웃

1등 스타일:
border-2 border-rank-gold/30
shadow-[0_0_30px_rgba(255,215,0,0.2)]
```

#### Task 7.2: RankingRow 컴포넌트
```
파일: components/leaderboard/RankingRow.tsx
작업:
- 테이블 행 (데스크톱)
- 호버 시 왼쪽 하이라이트 바
- 랭킹 변동 표시
- 커서 호버 연동
```

#### Task 7.3: RankingCard 컴포넌트
```
파일: components/leaderboard/RankingCard.tsx
작업:
- 모바일용 카드 형태
- 모든 정보 세로 배치
- 터치 친화적 크기 (min-height: 44px)
```

#### Task 7.4: FilterBar 컴포넌트
```
파일: components/leaderboard/FilterBar.tsx
작업:
- 기간 필터 탭 (Today/7D/30D/All Time)
- 국가 선택 드롭다운
- 반응형 레이아웃
- 탭 스타일 버튼
```

---

## Phase 5: 페이지 개선

### Group G8: 랜딩/히어로 섹션 (의존성: G5, G6)

**목표**: Synk 스타일 히어로 섹션

#### Task 8.1: Hero 섹션 컴포넌트
```
파일: components/sections/Hero.tsx
작업:
- 라디얼 그라데이션 배경 glow
- 그리드 패턴 오버레이
- 실시간 랭킹 배지 (애니메이션 펄스)
- 메인 타이틀 + Claude 그라데이션 텍스트
- CTA 버튼 그룹
- 반응형 타이포그래피 (clamp)

배경:
radial-gradient(ellipse 80% 50% at 50% -20%,
  rgba(218, 119, 86, var(--glow-opacity)) 0%, transparent 50%)
```

---

### Group G9: 리더보드 페이지 (의존성: G7, G8)

**목표**: 반응형 리더보드 페이지

#### Task 9.1: LeaderboardPage 리팩토링
```
파일: app/(main)/leaderboard/page.tsx
작업:
- 상위 3인 섹션 (TopThreeCard)
- 필터바 (FilterBar)
- 데스크톱: 테이블 (RankingRow)
- 모바일: 카드 리스트 (RankingCard)
- 페이지네이션 개선
- 실시간 업데이트 인디케이터

레이아웃:
- 모바일: 세로 스택
- 데스크톱: Top3 → Filter → Table
```

---

## 의존성 그래프

```
Phase 1:
  G1 (CSS 변수) ─┬─────────────────────────────┐
                 │                             │
                 ▼                             ▼
  G2 (테마)      G3 (커서 컨텍스트)            G5 (레이아웃)
                 │                             │
                 ▼                             │
  G4 (커서 UI) ──┘                             │
                                               ▼
Phase 4:                                    G6 (UI 컴포넌트)
                                               │
                                               ▼
                                            G7 (리더보드 컴포넌트)
                                               │
                                               ▼
Phase 5:                                    G8 (히어로) ──► G9 (리더보드 페이지)
```

---

## Wave 실행 계획

### Wave 1 (병렬 실행)
- **G1**: CSS 변수 시스템

### Wave 2 (G1 완료 후 병렬 실행)
- **G2**: 테마 스위처
- **G3**: 커서 컨텍스트
- **G5**: 레이아웃 컴포넌트
- **G6**: UI 컴포넌트

### Wave 3 (Wave 2 완료 후 병렬 실행)
- **G4**: 커서 UI
- **G7**: 리더보드 컴포넌트

### Wave 4 (Wave 3 완료 후)
- **G8**: 히어로 섹션

### Wave 5 (Wave 4 완료 후)
- **G9**: 리더보드 페이지

---

## 품질 게이트

각 Task 완료 전 필수 확인:
- [ ] TypeScript 컴파일 성공
- [ ] ESLint 에러 없음
- [ ] 라이트/다크 테마 모두 정상
- [ ] 모바일/태블릿/데스크톱 반응형 정상
- [ ] 커서 효과 정상 (PC)
- [ ] 터치 디바이스 정상 동작
- [ ] 접근성 기본 체크 (키보드, 포커스)

---

## 실행

1. 이 BUILD_PLAN을 기반으로 Wave별 병렬 실행
2. 각 Task는 α-Team(구현) → β-Team(검증) → α-Team(수정) 사이클
3. 모든 Group 완료까지 진행
