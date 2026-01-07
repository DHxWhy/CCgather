# CCGather UX/UI 개선 계획서

## 📋 개요

Synk 웹사이트의 모던한 디자인 패턴을 분석하여 CCGather에 적용 가능한 UX/UI 개선 사항을 도출했습니다.
Claude 아이덴티티(오렌지 → Claude Coral/Terracotta)를 포인트 컬러로 활용하여 개발자 친화적인 경험을 제공합니다.

**핵심 요구사항:**
- 라이트 모드 / 다크 모드 완전 지원
- PC / 태블릿 / 모바일 완전 반응형
- 커스텀 커서 애니메이션 (PC 전용)

---

## 🎨 1. 색상 시스템 재정의 (Claude Identity + 듀얼 테마)

### 1.1 CSS 변수 기반 테마 시스템

```css
/* ========================================
   LIGHT MODE (기본)
   ======================================== */
:root {
  /* Claude Primary Colors */
  --color-claude-coral: #DA7756;
  --color-claude-terracotta: #D4714E;
  --color-claude-peach: #E8A087;
  --color-claude-rust: #B85C3D;
  --color-claude-sand: #F5E6D3;
  --color-claude-cream: #FFF8F0;

  /* Primary (테마 공통) */
  --color-primary: #DA7756;
  --color-primary-light: #E8A087;
  --color-primary-dark: #B85C3D;

  /* Light Mode Backgrounds */
  --color-bg-primary: #FFFFFF;
  --color-bg-secondary: #FAFAFA;
  --color-bg-card: #FFFFFF;
  --color-bg-card-hover: #F5F5F5;
  --color-bg-elevated: #F0F0F0;

  /* Light Mode Text */
  --color-text-primary: #18181B;
  --color-text-secondary: #52525B;
  --color-text-muted: #71717A;
  --color-text-disabled: #A1A1AA;

  /* Light Mode Borders */
  --border-default: rgba(0, 0, 0, 0.08);
  --border-hover: rgba(0, 0, 0, 0.15);

  /* Light Mode Glass Effect */
  --glass-bg: rgba(255, 255, 255, 0.8);
  --glass-border: rgba(0, 0, 0, 0.06);

  /* Light Mode Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
  --shadow-glow: 0 0 20px rgba(218, 119, 86, 0.2);

  /* Gradients */
  --gradient-claude: linear-gradient(135deg, #DA7756 0%, #D4714E 50%, #B85C3D 100%);
  --gradient-bg-glow: radial-gradient(ellipse 80% 50% at 50% -20%, rgba(218, 119, 86, 0.08) 0%, transparent 50%);
}

/* ========================================
   DARK MODE
   ======================================== */
:root.dark {
  /* Dark Mode Backgrounds (Synk 스타일) */
  --color-bg-primary: #030303;
  --color-bg-secondary: #0a0a0b;
  --color-bg-card: #111113;
  --color-bg-card-hover: #18181b;
  --color-bg-elevated: #1f1f23;

  /* Dark Mode Text */
  --color-text-primary: #FAFAFA;
  --color-text-secondary: #A1A1AA;
  --color-text-muted: #71717A;
  --color-text-disabled: #52525B;

  /* Dark Mode Borders */
  --border-default: rgba(255, 255, 255, 0.08);
  --border-hover: rgba(255, 255, 255, 0.15);

  /* Dark Mode Glass Effect */
  --glass-bg: rgba(255, 255, 255, 0.03);
  --glass-border: rgba(255, 255, 255, 0.08);

  /* Dark Mode Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.5);
  --shadow-glow: 0 0 20px rgba(218, 119, 86, 0.4);

  /* Dark Gradient Glow (더 강한 효과) */
  --gradient-bg-glow: radial-gradient(ellipse 80% 50% at 50% -20%, rgba(218, 119, 86, 0.15) 0%, transparent 50%);
}
```

### 1.2 시맨틱 컬러 토큰

```css
/* Accent Colors (테마 공통) */
--color-success: #10b981;
--color-success-bg: rgba(16, 185, 129, 0.1);
--color-error: #ef4444;
--color-error-bg: rgba(239, 68, 68, 0.1);
--color-warning: #eab308;
--color-warning-bg: rgba(234, 179, 8, 0.1);
--color-info: #3b82f6;
--color-info-bg: rgba(59, 130, 246, 0.1);

/* Ranking Colors */
--color-rank-gold: #FFD700;
--color-rank-silver: #C0C0C0;
--color-rank-bronze: #CD7F32;
```

### 1.3 Tailwind CSS 통합

```js
// tailwind.config.js
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Claude Identity
        claude: {
          coral: 'var(--color-claude-coral)',
          terracotta: 'var(--color-claude-terracotta)',
          peach: 'var(--color-claude-peach)',
          rust: 'var(--color-claude-rust)',
          sand: 'var(--color-claude-sand)',
          cream: 'var(--color-claude-cream)',
        },
        // Semantic
        primary: 'var(--color-primary)',
        'primary-light': 'var(--color-primary-light)',
        'primary-dark': 'var(--color-primary-dark)',
        // Backgrounds
        bg: {
          primary: 'var(--color-bg-primary)',
          secondary: 'var(--color-bg-secondary)',
          card: 'var(--color-bg-card)',
          'card-hover': 'var(--color-bg-card-hover)',
          elevated: 'var(--color-bg-elevated)',
        },
        // Text
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
          disabled: 'var(--color-text-disabled)',
        },
      },
      boxShadow: {
        'glow': 'var(--shadow-glow)',
        'glow-lg': '0 0 30px rgba(218, 119, 86, 0.5)',
      },
    },
  },
};
```

---

## 🖱️ 2. 커스텀 커서 애니메이션 시스템

### 2.1 커서 컴포넌트 구조
```
components/
  ui/
    cursor/
      CustomCursor.tsx       # 메인 커서 컴포넌트
      CursorContext.tsx      # 커서 상태 관리
      CursorTrail.tsx        # 커서 트레일 효과
```

### 2.2 커서 디자인 명세

#### 기본 커서
```tsx
interface CursorState {
  type: 'default' | 'pointer' | 'text' | 'loading' | 'drag';
  scale: number;      // 1 = default, 1.5 = hover
  opacity: number;
  color: string;      // Claude coral gradient
}
```

#### 커서 외형
- **메인 커서**: 12px 원형, Claude Coral (#DA7756) 테두리
- **내부 도트**: 4px 실선, 흰색
- **호버 링**: 32px 확장, 투명 배경 + 코랄 테두리

#### 애니메이션 효과
```css
/* 커서 기본 애니메이션 */
.cursor-main {
  width: 12px;
  height: 12px;
  border: 2px solid var(--color-claude-coral);
  border-radius: 50%;
  transition: transform 0.15s ease-out, opacity 0.15s ease;
  mix-blend-mode: difference;
}

/* 호버 시 확장 */
.cursor-main.hover {
  transform: scale(2.5);
  background: rgba(218, 119, 86, 0.1);
  border-color: var(--color-claude-peach);
}

/* 클릭 효과 */
.cursor-main.click {
  transform: scale(0.8);
  background: var(--color-claude-coral);
}

/* 커서 트레일 */
.cursor-trail {
  position: fixed;
  width: 8px;
  height: 8px;
  background: var(--color-claude-coral);
  border-radius: 50%;
  opacity: 0.3;
  pointer-events: none;
  animation: trail-fade 0.5s ease-out forwards;
}

@keyframes trail-fade {
  to {
    opacity: 0;
    transform: scale(0.5);
  }
}
```

### 2.3 인터랙티브 요소별 커서 변형

| 요소 | 커서 상태 | 효과 |
|------|----------|------|
| 버튼, 링크 | `pointer` | 확장 + glow |
| 텍스트 입력 | `text` | 수직 바 형태 |
| 드래그 가능 | `drag` | 손바닥 아이콘 |
| 로딩 | `loading` | 회전 애니메이션 |
| 랭킹 카드 호버 | `pointer` | 커서 + 카드 하이라이트 |

---

## 🧱 3. 컴포넌트 개선 명세

### 3.1 네비게이션 (Synk 스타일 적용)

#### 현재
- 단순한 고정 헤더
- 기본적인 링크 스타일

#### 개선안
```tsx
// components/layout/header.tsx
<header className="fixed top-0 z-50 w-full">
  {/* 글래스모피즘 배경 */}
  <div className="absolute inset-0 bg-[#030303]/80 backdrop-blur-xl border-b border-white/[0.08]" />

  <nav className="relative mx-auto max-w-[1200px] h-16 flex items-center justify-between px-6">
    {/* 로고 - Claude 스타일 그라데이션 */}
    <Link href="/" className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#DA7756] to-[#B85C3D] flex items-center justify-center">
        <span className="text-white font-bold text-sm">CC</span>
      </div>
      <span className="text-lg font-semibold text-white">CCGather</span>
    </Link>

    {/* 네비게이션 링크 - 언더라인 애니메이션 */}
    <div className="flex items-center gap-8">
      {links.map(link => (
        <NavLink
          key={link.href}
          className="relative text-[#a1a1aa] hover:text-white transition-colors group"
        >
          {link.label}
          <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-[#DA7756] to-[#B85C3D] transition-all group-hover:w-full" />
        </NavLink>
      ))}
    </div>

    {/* CTA 버튼 - Claude 그라데이션 */}
    <button className="px-5 py-2.5 rounded-full bg-gradient-to-r from-[#DA7756] to-[#B85C3D] text-white font-medium hover:shadow-[0_0_20px_rgba(218,119,86,0.4)] transition-shadow">
      Sign In
    </button>
  </nav>
</header>
```

### 3.2 히어로 섹션 (Synk 스타일)

```tsx
// components/sections/Hero.tsx
<section className="relative min-h-[800px] flex items-center justify-center overflow-hidden">
  {/* 배경 그라데이션 마스크 */}
  <div
    className="absolute inset-0"
    style={{
      background: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(218, 119, 86, 0.15) 0%, transparent 50%)',
    }}
  />

  {/* 그리드 패턴 오버레이 */}
  <div
    className="absolute inset-0 opacity-20"
    style={{
      backgroundImage: `
        linear-gradient(rgba(218, 119, 86, 0.1) 1px, transparent 1px),
        linear-gradient(90deg, rgba(218, 119, 86, 0.1) 1px, transparent 1px)
      `,
      backgroundSize: '60px 60px',
    }}
  />

  {/* 콘텐츠 */}
  <div className="relative z-10 text-center max-w-[800px] px-6">
    {/* 배지 */}
    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.08] mb-8">
      <span className="w-2 h-2 rounded-full bg-[#DA7756] animate-pulse" />
      <span className="text-sm text-[#a1a1aa]">Real-time Developer Rankings</span>
    </div>

    {/* 메인 타이틀 */}
    <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
      Where <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#DA7756] to-[#E8A087]">Claude Code</span><br />
      Developers Gather
    </h1>

    {/* 서브타이틀 */}
    <p className="text-lg text-[#71717a] mb-10 max-w-[500px] mx-auto">
      Track your Claude Code usage, compete globally, and climb the leaderboard.
    </p>

    {/* CTA 버튼 그룹 */}
    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
      <button className="px-8 py-4 rounded-full bg-gradient-to-r from-[#DA7756] to-[#B85C3D] text-white font-semibold text-lg hover:shadow-[0_0_30px_rgba(218,119,86,0.5)] transition-all">
        Get Started
      </button>
      <button className="px-8 py-4 rounded-full bg-white/[0.03] border border-white/[0.08] text-white font-medium hover:bg-white/[0.06] transition-colors">
        View Leaderboard
      </button>
    </div>
  </div>
</section>
```

### 3.3 카드 컴포넌트 시스템

```tsx
// components/ui/Card.tsx
interface CardProps {
  variant: 'default' | 'glass' | 'glow' | 'ranking';
  hoverable?: boolean;
  children: React.ReactNode;
}

// 기본 카드
<div className="
  relative p-6 rounded-2xl
  bg-[#111113]
  border border-white/[0.08]
  transition-all duration-300
  hover:border-white/[0.15]
  hover:bg-[#18181b]
">
  {children}
</div>

// 글래스 카드 (Synk 스타일)
<div className="
  relative p-6 rounded-2xl
  bg-white/[0.03]
  backdrop-blur-xl
  border border-white/[0.08]
  transition-all duration-300
  hover:border-[#DA7756]/30
  hover:shadow-[0_0_40px_rgba(218,119,86,0.1)]
">
  {children}
</div>

// 랭킹 카드 (호버 시 하이라이트)
<div className="
  group relative p-4 rounded-xl
  bg-[#0a0a0b]
  border border-white/[0.05]
  transition-all duration-300
  hover:bg-[#111113]
  hover:border-[#DA7756]/20
  cursor-pointer
">
  {/* 왼쪽 랭크 하이라이트 바 */}
  <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl bg-gradient-to-b from-[#DA7756] to-[#B85C3D] opacity-0 group-hover:opacity-100 transition-opacity" />
  {children}
</div>
```

### 3.4 버튼 시스템

```tsx
// components/ui/Button.tsx
const buttonVariants = {
  // Primary - Claude Gradient
  primary: `
    px-6 py-3 rounded-full
    bg-gradient-to-r from-[#DA7756] to-[#B85C3D]
    text-white font-medium
    hover:shadow-[0_0_20px_rgba(218,119,86,0.4)]
    active:scale-95
    transition-all duration-200
  `,

  // Secondary - Ghost
  secondary: `
    px-6 py-3 rounded-full
    bg-white/[0.03]
    border border-white/[0.08]
    text-white font-medium
    hover:bg-white/[0.06]
    hover:border-white/[0.15]
    transition-all duration-200
  `,

  // Outline - Claude Border
  outline: `
    px-6 py-3 rounded-full
    bg-transparent
    border border-[#DA7756]/50
    text-[#DA7756]
    hover:bg-[#DA7756]/10
    hover:border-[#DA7756]
    transition-all duration-200
  `,

  // Tab 스타일
  tab: `
    px-4 py-2 rounded-lg
    text-[#a1a1aa]
    hover:text-white
    hover:bg-white/[0.05]
    data-[active=true]:text-white
    data-[active=true]:bg-white/[0.10]
    transition-all duration-200
  `,
};
```

### 3.5 입력 필드

```tsx
// components/ui/Input.tsx
<div className="relative">
  <input
    type="text"
    className="
      w-full px-4 py-3 rounded-xl
      bg-[#111113]
      border border-white/[0.08]
      text-white placeholder-[#52525b]
      focus:outline-none
      focus:border-[#DA7756]/50
      focus:shadow-[0_0_0_3px_rgba(218,119,86,0.1)]
      transition-all duration-200
    "
    placeholder="Search developers..."
  />
  {/* 검색 아이콘 */}
  <SearchIcon className="absolute right-4 top-1/2 -translate-y-1/2 text-[#52525b]" />
</div>
```

---

## ✨ 4. 애니메이션 시스템

### 4.1 페이지 전환 애니메이션

```tsx
// Framer Motion 기반
const pageTransition = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: { duration: 0.3, ease: 'easeOut' }
};
```

### 4.2 스크롤 기반 애니메이션

```tsx
// 요소 등장 애니메이션
const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: 'easeOut' }
  }
};

// Stagger 효과 (목록 아이템)
const staggerContainer = {
  visible: {
    transition: {
      staggerChildren: 0.1
    }
  }
};
```

### 4.3 마이크로 인터랙션

```css
/* 호버 시 부유 효과 */
.hover-float {
  transition: transform 0.3s ease;
}
.hover-float:hover {
  transform: translateY(-4px);
}

/* 숫자 카운트업 애니메이션 */
@keyframes countup {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 글로우 펄스 */
@keyframes glow-pulse {
  0%, 100% { box-shadow: 0 0 20px rgba(218, 119, 86, 0.3); }
  50% { box-shadow: 0 0 30px rgba(218, 119, 86, 0.5); }
}

/* 랭킹 변동 표시 */
@keyframes rank-up {
  0% { background-color: rgba(16, 185, 129, 0.3); }
  100% { background-color: transparent; }
}

@keyframes rank-down {
  0% { background-color: rgba(239, 68, 68, 0.3); }
  100% { background-color: transparent; }
}
```

---

## 📱 5. 완전 반응형 시스템 (PC / 태블릿 / 모바일)

### 5.1 브레이크포인트 정의

```css
/* Tailwind 기반 커스텀 브레이크포인트 */
screens: {
  'xs': '375px',     /* 소형 모바일 */
  'sm': '640px',     /* 대형 모바일 */
  'md': '768px',     /* 태블릿 세로 */
  'lg': '1024px',    /* 태블릿 가로 / 소형 데스크톱 */
  'xl': '1280px',    /* 데스크톱 */
  '2xl': '1536px',   /* 대형 데스크톱 */
}
```

### 5.2 컨테이너 시스템

```tsx
// components/layout/Container.tsx
interface ContainerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  children: React.ReactNode;
}

const containerSizes = {
  sm: 'max-w-2xl',    // 672px
  md: 'max-w-4xl',    // 896px
  lg: 'max-w-6xl',    // 1152px
  xl: 'max-w-7xl',    // 1280px
  full: 'max-w-full',
};

<div className={cn(
  'mx-auto w-full',
  'px-4 sm:px-6 lg:px-8',  // 반응형 패딩
  containerSizes[size]
)}>
  {children}
</div>
```

### 5.3 반응형 네비게이션

```tsx
// 모바일: 햄버거 메뉴 (< 768px)
// 태블릿: 축소된 메뉴 (768px - 1023px)
// 데스크톱: 전체 메뉴 (>= 1024px)

<header className="fixed top-0 z-50 w-full">
  <nav className="mx-auto flex h-14 md:h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">

    {/* 로고 - 모바일에서 축소 */}
    <Link href="/" className="flex items-center gap-2 md:gap-3">
      <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-gradient-claude" />
      <span className="text-base md:text-lg font-semibold">CCGather</span>
    </Link>

    {/* 데스크톱 네비게이션 */}
    <div className="hidden lg:flex items-center gap-6 xl:gap-8">
      {navLinks.map(link => (
        <NavLink key={link.href} href={link.href}>
          {link.label}
        </NavLink>
      ))}
    </div>

    {/* 태블릿 축소 네비게이션 */}
    <div className="hidden md:flex lg:hidden items-center gap-4">
      {navLinks.slice(0, 2).map(link => (
        <NavLink key={link.href} href={link.href}>
          {link.label}
        </NavLink>
      ))}
      <MoreMenu links={navLinks.slice(2)} />
    </div>

    {/* 모바일 햄버거 메뉴 */}
    <button className="md:hidden p-2 -mr-2">
      <Menu className="w-5 h-5" />
    </button>

    {/* CTA 버튼 - 모바일에서 숨김 */}
    <div className="hidden md:flex items-center gap-3">
      <ThemeSwitcher />
      <SignInButton />
    </div>
  </nav>

  {/* 모바일 드로어 메뉴 */}
  <MobileDrawer open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)}>
    <div className="flex flex-col gap-2 p-4">
      {navLinks.map(link => (
        <MobileNavLink key={link.href} href={link.href}>
          {link.label}
        </MobileNavLink>
      ))}
      <div className="mt-4 pt-4 border-t border-border-default">
        <ThemeSwitcher />
        <SignInButton fullWidth />
      </div>
    </div>
  </MobileDrawer>
</header>
```

### 5.4 반응형 그리드 시스템

```tsx
// 리더보드 그리드 - 반응형 열 수
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
  {items.map(item => <Card key={item.id} {...item} />)}
</div>

// 상위 3인 레이아웃
<div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8">
  {/* 2등 - 모바일에서 순서 변경 */}
  <div className="order-2 md:order-1 w-full md:w-auto">
    <TopThreeCard rank={2} />
  </div>
  {/* 1등 - 중앙, 더 크게 */}
  <div className="order-1 md:order-2 w-full md:w-auto md:scale-110">
    <TopThreeCard rank={1} />
  </div>
  {/* 3등 */}
  <div className="order-3 w-full md:w-auto">
    <TopThreeCard rank={3} />
  </div>
</div>
```

### 5.5 반응형 테이블 → 카드 변환

```tsx
// 데스크톱: 테이블 형태
// 모바일: 카드 스택 형태

{/* 데스크톱 테이블 */}
<table className="hidden md:table w-full">
  <thead>...</thead>
  <tbody>...</tbody>
</table>

{/* 모바일 카드 리스트 */}
<div className="md:hidden space-y-3">
  {rankings.map(rank => (
    <div key={rank.id} className="p-4 rounded-xl bg-bg-card border border-border-default">
      <div className="flex items-center justify-between mb-3">
        <span className="text-lg font-bold text-primary">#{rank.position}</span>
        <RankChange change={rank.change} />
      </div>
      <div className="flex items-center gap-3 mb-2">
        <Avatar src={rank.avatar} size="md" />
        <div>
          <p className="font-medium text-text-primary">{rank.username}</p>
          <p className="text-sm text-text-muted">{rank.country}</p>
        </div>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-text-secondary">Tokens</span>
        <span className="font-mono text-text-primary">{rank.tokens}</span>
      </div>
    </div>
  ))}
</div>
```

### 5.6 반응형 타이포그래피

```css
/* 유동적 타이포그래피 */
.text-responsive-hero {
  font-size: clamp(2rem, 5vw + 1rem, 4.5rem);
  line-height: 1.1;
}

.text-responsive-title {
  font-size: clamp(1.5rem, 3vw + 0.5rem, 2.5rem);
  line-height: 1.2;
}

.text-responsive-body {
  font-size: clamp(0.875rem, 1vw + 0.5rem, 1.125rem);
  line-height: 1.6;
}
```

### 5.7 터치 최적화 (모바일)

```css
/* 터치 타겟 최소 크기: 44px */
.touch-target {
  min-height: 44px;
  min-width: 44px;
}

/* 모바일 탭 제스처 영역 */
@media (max-width: 767px) {
  .interactive {
    padding: 12px 16px;
  }

  .button {
    min-height: 48px;
    font-size: 16px; /* iOS 줌 방지 */
  }

  input, select, textarea {
    font-size: 16px; /* iOS 줌 방지 */
  }
}

/* 호버 효과 비활성화 (터치 디바이스) */
@media (hover: none) {
  .hover-effect:hover {
    transform: none;
    box-shadow: none;
  }
}
```

### 5.8 디바이스별 커서 처리

```tsx
// 커서는 PC에서만 표시 (마우스 있을 때)
// 터치 디바이스에서는 기본 커서 사용

const CustomCursor = () => {
  const [isMouseDevice, setIsMouseDevice] = useState(false);

  useEffect(() => {
    // 마우스 감지
    const checkMouse = () => {
      setIsMouseDevice(window.matchMedia('(hover: hover) and (pointer: fine)').matches);
    };

    checkMouse();
    window.addEventListener('resize', checkMouse);
    return () => window.removeEventListener('resize', checkMouse);
  }, []);

  // 터치 디바이스면 렌더링하지 않음
  if (!isMouseDevice) return null;

  return <CursorComponent />;
};
```

---

## 🏆 6. 리더보드 특화 개선

### 6.1 상위 3인 특별 표시

```tsx
// 1등 - Gold Glow
<div className="relative">
  <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 rounded-xl blur-xl" />
  <div className="relative p-6 border-2 border-yellow-500/30 rounded-xl bg-[#111113]">
    <Crown className="absolute -top-3 left-1/2 -translate-x-1/2 text-yellow-500" />
    {/* 콘텐츠 */}
  </div>
</div>

// 2등 - Silver
// 3등 - Bronze
```

### 6.2 실시간 업데이트 인디케이터

```tsx
<div className="flex items-center gap-2">
  <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
  <span className="text-xs text-[#71717a]">Live</span>
</div>
```

### 6.3 랭킹 변동 표시

```tsx
// 랭킹 상승
<span className="flex items-center gap-1 text-[#10b981] text-sm">
  <TrendingUp size={14} />
  <span>+3</span>
</span>

// 랭킹 하락
<span className="flex items-center gap-1 text-[#ef4444] text-sm">
  <TrendingDown size={14} />
  <span>-2</span>
</span>
```

---

## 📁 7. 파일 구조 제안

```
components/
├── ui/
│   ├── cursor/
│   │   ├── CustomCursor.tsx
│   │   ├── CursorContext.tsx
│   │   └── CursorTrail.tsx
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── Input.tsx
│   ├── Badge.tsx
│   ├── Avatar.tsx
│   └── Tooltip.tsx
├── layout/
│   ├── Header.tsx
│   ├── Footer.tsx
│   ├── Sidebar.tsx
│   └── Container.tsx
├── sections/
│   ├── Hero.tsx
│   ├── Stats.tsx
│   ├── Features.tsx
│   └── CTA.tsx
└── leaderboard/
    ├── LeaderboardTable.tsx
    ├── RankingCard.tsx
    ├── TopThree.tsx
    └── FilterBar.tsx

styles/
├── globals.css           # 글로벌 스타일 + CSS 변수
├── animations.css        # 애니메이션 정의
└── cursor.css           # 커서 스타일
```

---

## 📊 8. 구현 우선순위 및 로드맵

### 8.1 Phase 1 - 기반 시스템 (Week 1)

| 우선순위 | 항목 | 복잡도 | 파일 |
|---------|------|--------|------|
| 🔴 P0 | 듀얼 테마 색상 시스템 | Low | `globals.css`, `tailwind.config.js` |
| 🔴 P0 | 테마 스위처 개선 | Low | `theme-switcher.tsx` |
| 🔴 P0 | CSS 변수 마이그레이션 | Medium | 전체 컴포넌트 |

### 8.2 Phase 2 - 커스텀 커서 (Week 1-2)

| 우선순위 | 항목 | 복잡도 | 파일 |
|---------|------|--------|------|
| 🔴 P0 | 커서 컨텍스트 | Medium | `CursorContext.tsx` |
| 🔴 P0 | 메인 커서 컴포넌트 | Medium | `CustomCursor.tsx` |
| 🟡 P1 | 커서 트레일 효과 | Medium | `CursorTrail.tsx` |
| 🟡 P1 | 요소별 커서 상태 | Low | `useCursor.ts` |

### 8.3 Phase 3 - 반응형 레이아웃 (Week 2)

| 우선순위 | 항목 | 복잡도 | 파일 |
|---------|------|--------|------|
| 🔴 P0 | 반응형 네비게이션 | Medium | `Header.tsx` |
| 🔴 P0 | 모바일 드로어 메뉴 | Medium | `MobileDrawer.tsx` |
| 🟡 P1 | 반응형 컨테이너 | Low | `Container.tsx` |
| 🟡 P1 | 터치 최적화 | Low | 전체 인터랙티브 요소 |

### 8.4 Phase 4 - UI 컴포넌트 (Week 2-3)

| 우선순위 | 항목 | 복잡도 | 파일 |
|---------|------|--------|------|
| 🟡 P1 | 버튼 시스템 | Low | `Button.tsx` |
| 🟡 P1 | 카드 시스템 | Low | `Card.tsx` |
| 🟡 P1 | 입력 필드 | Low | `Input.tsx` |
| 🟢 P2 | 배지/태그 | Low | `Badge.tsx` |
| 🟢 P2 | 아바타 | Low | `Avatar.tsx` |

### 8.5 Phase 5 - 페이지 개선 (Week 3-4)

| 우선순위 | 항목 | 복잡도 | 파일 |
|---------|------|--------|------|
| 🟡 P1 | 히어로 섹션 | Medium | `Hero.tsx` |
| 🟡 P1 | 리더보드 반응형 | High | `LeaderboardPage.tsx` |
| 🟢 P2 | 상위 3인 카드 | Medium | `TopThree.tsx` |
| 🟢 P2 | 애니메이션 시스템 | Medium | `animations.css` |

---

## 🧪 9. 테스트 체크리스트

### 9.1 테마 테스트
- [ ] 라이트 모드 → 다크 모드 전환 시 모든 요소 정상 표시
- [ ] 시스템 설정 자동 감지 동작
- [ ] 새로고침 후 테마 유지 (localStorage)
- [ ] 테마 전환 시 깜빡임 없음

### 9.2 반응형 테스트
- [ ] 모바일 (375px, 414px)
- [ ] 태블릿 세로 (768px)
- [ ] 태블릿 가로 (1024px)
- [ ] 소형 데스크톱 (1280px)
- [ ] 대형 데스크톱 (1920px+)

### 9.3 커서 테스트
- [ ] PC 마우스에서 커스텀 커서 표시
- [ ] 터치 디바이스에서 기본 커서 (커스텀 커서 비활성화)
- [ ] 호버/클릭 상태 변화
- [ ] 성능 (60fps 유지)

### 9.4 접근성 테스트
- [ ] 키보드 네비게이션
- [ ] 스크린 리더 호환
- [ ] 색상 대비 (WCAG AA)
- [ ] 포커스 표시

---

## 🎯 10. 예상 결과

### 10.1 사용자 경험 개선
1. **브랜드 일관성**: Claude 아이덴티티를 통한 명확한 브랜드 인지
2. **개발자 친화적**: 다크/라이트 테마 + 모노스페이스 폰트 + 코드 스타일 UI
3. **프리미엄 느낌**: Synk 스타일 글래스모피즘 + 섬세한 애니메이션
4. **차별화된 경험**: 커스텀 커서로 독특한 인터랙션 제공
5. **완벽한 접근성**: 모든 디바이스와 테마에서 최적화된 경험

### 10.2 기술적 품질
1. **CSS 변수 기반 테마**: 유지보수 용이, 일관된 디자인 시스템
2. **Tailwind 통합**: 빠른 개발, 작은 번들 사이즈
3. **반응형 우선**: 모바일 → 데스크톱 점진적 향상
4. **성능 최적화**: 커서 애니메이션 60fps, 테마 전환 0 깜빡임

---

## 📚 11. 참고 자료

### 디자인 레퍼런스
- Synk (https://synk.framer.website/) - 글래스모피즘, 그리드 레이아웃
- Claude.ai - 브랜드 컬러, 타이포그래피
- Linear.app - 다크 테마, 애니메이션
- Vercel.com - 반응형 네비게이션

### 기술 문서
- Tailwind CSS v3 - Dark Mode: https://tailwindcss.com/docs/dark-mode
- Framer Motion - https://www.framer.com/motion/
- CSS Custom Properties - https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties
