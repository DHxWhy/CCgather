# CCgather Login Page Design Specification

## Overview
기존의 단순한 Clerk 기본 모달 대신, 좌우 분리된 풀스크린 로그인 페이지로 전환하여 브랜드 아이덴티티를 강화하고 사용자 경험을 개선합니다.

---

## Design Concept

### Visual Theme: "Developer's Journey"
CCgather는 Claude Code 사용량 리더보드입니다. 로그인 페이지는 개발자들이 AI 시대의 선구자로서 자신의 여정을 시작하는 관문(Gateway)의 느낌을 줘야 합니다.

### Color Palette (기존 디자인 시스템 활용)
- **Primary**: `#DA7756` (Claude Coral)
- **Background**: `#0D0D0F` (Synk Dark)
- **Card**: `#1A1A1E`
- **Border**: `rgba(255, 255, 255, 0.12)`
- **Text Primary**: `#F9F9F8`
- **Text Muted**: `#71717A`

---

## Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                    Full Screen (min-h-screen)                    │
├─────────────────────────────────┬───────────────────────────────┤
│                                 │                               │
│     LEFT PANEL (55%)            │    RIGHT PANEL (45%)          │
│     Brand & Visual              │    Clerk SignIn               │
│                                 │                               │
│  ┌───────────────────────────┐  │  ┌─────────────────────────┐  │
│  │                           │  │  │                         │  │
│  │    [Animated Visual]      │  │  │  CCgather Logo          │  │
│  │                           │  │  │                         │  │
│  │    - Code snippets        │  │  │  "Welcome back"         │  │
│  │    - Terminal animation   │  │  │  "Sign in to continue"  │  │
│  │    - Globe (optional)     │  │  │                         │  │
│  │                           │  │  │  [GitHub Button]        │  │
│  │    "Every line of code    │  │  │                         │  │
│  │     is a step forward"    │  │  │  ──────────────         │  │
│  │                           │  │  │                         │  │
│  │    Stats:                 │  │  │  [Sign up link]         │  │
│  │    - X+ developers        │  │  │                         │  │
│  │    - Y+ countries         │  │  │  [Secured by Clerk]     │  │
│  │                           │  │  │                         │  │
│  └───────────────────────────┘  │  └─────────────────────────┘  │
│                                 │                               │
├─────────────────────────────────┴───────────────────────────────┤
│                    Mobile: Stack vertically                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Left Panel Design Options

### Option A: Terminal Animation (Recommended)
```
┌─────────────────────────────────────────────┐
│  ● ● ●                              terminal │
├─────────────────────────────────────────────┤
│                                             │
│  $ npx ccgather submit                      │
│  ▸ Scanning Claude Code usage...            │
│  ▸ Found 1,234,567 tokens                   │
│  ▸ Calculating rank...                      │
│                                             │
│  ✓ Success! You're now #42 globally         │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │  Your Stats                          │    │
│  │  ──────────────────────────────────  │    │
│  │  Tokens:    1,234,567               │    │
│  │  Cost:      $45.67                  │    │
│  │  Rank:      #42 → #38               │    │
│  └─────────────────────────────────────┘    │
│                                             │
└─────────────────────────────────────────────┘

    "Proof of your Claude Code dedication"

    ┌──────────────────────────────────────┐
    │  70+ Countries   │   100M+ Tokens    │
    └──────────────────────────────────────┘
```

**장점:**
- CCgather의 핵심 기능(CLI 제출)을 시각적으로 보여줌
- 개발자 친화적인 터미널 UI
- 타이핑 애니메이션으로 동적인 느낌

### Option B: Globe + Floating Icons
```
┌─────────────────────────────────────────────┐
│                                             │
│         [React Icon]     [TS Icon]          │
│                  \       /                  │
│      [Next.js]    ╭─────╮    [Claude]       │
│                  │ 🌍  │                    │
│      [VSCode]    ╰─────╯    [Git]           │
│                  /       \                  │
│         [Node]        [Python]              │
│                                             │
│                                             │
│      "Join the global community"            │
│      "of AI-powered developers"             │
│                                             │
│     ● 70+ Countries  ● 500+ Developers      │
│                                             │
└─────────────────────────────────────────────┘
```

**장점:**
- 랜딩 페이지의 Globe 재사용 가능
- 글로벌 커뮤니티 느낌 강조
- 참고 이미지와 유사한 스타일

### Option C: Code-to-Stats Flow
```
┌─────────────────────────────────────────────┐
│                                             │
│     [Code Block with syntax highlight]      │
│     ┌─────────────────────────────────┐     │
│     │ async function buildFeature() { │     │
│     │   const ai = await claude();    │     │
│     │   return ai.generate(spec);     │     │
│     │ }                               │     │
│     └─────────────────────────────────┘     │
│                    ↓                        │
│              [Animated Arrow]               │
│                    ↓                        │
│     ┌─────────────────────────────────┐     │
│     │  📊 Your Impact                 │     │
│     │                                 │     │
│     │  1.2M tokens → Top 5% global    │     │
│     └─────────────────────────────────┘     │
│                                             │
│      "Transform your code journey"          │
│      "into measurable achievements"         │
│                                             │
└─────────────────────────────────────────────┘
```

**장점:**
- 코드 → 성과 변환 스토리텔링
- 개발자에게 친숙한 코드 블록 UI

---

## Right Panel Design

### Header
```tsx
// Logo
<div className="flex items-center gap-2 mb-8">
  <Logo size={32} />
  <span className="text-xl font-bold">CCgather</span>
</div>

// Welcome text
<h1 className="text-2xl font-bold text-white mb-2">
  Welcome back
</h1>
<p className="text-text-muted mb-8">
  Sign in to track your Claude Code journey
</p>
```

### Clerk SignIn Customization
```tsx
<SignIn
  appearance={{
    elements: {
      rootBox: 'w-full',
      card: 'bg-transparent shadow-none p-0',
      headerTitle: 'hidden',
      headerSubtitle: 'hidden',
      socialButtonsBlockButton: `
        bg-white/5
        border border-white/10
        text-white
        hover:bg-white/10
        transition-all
        rounded-xl
        py-3
      `,
      socialButtonsBlockButtonText: 'text-white font-medium',
      dividerLine: 'bg-white/10',
      dividerText: 'text-text-muted text-xs',
      footerActionText: 'text-text-muted',
      footerActionLink: 'text-claude-coral hover:text-claude-peach',
      formFieldInput: `
        bg-bg-card
        border-white/10
        text-white
        rounded-xl
        focus:border-claude-coral
        focus:ring-claude-coral/20
      `,
    },
  }}
/>
```

### Footer
```tsx
<div className="mt-8 pt-6 border-t border-white/10">
  <p className="text-xs text-text-muted text-center">
    By signing in, you agree to our{' '}
    <Link href="/terms" className="text-claude-coral hover:underline">
      Terms
    </Link>{' '}
    and{' '}
    <Link href="/privacy" className="text-claude-coral hover:underline">
      Privacy Policy
    </Link>
  </p>
</div>
```

---

## Responsive Design

### Desktop (lg+)
- 좌우 분리 레이아웃 (55% : 45%)
- 왼쪽: 풀 애니메이션 + 통계
- 오른쪽: 로그인 폼

### Tablet (md)
- 좌우 분리 유지 (50% : 50%)
- 왼쪽: 간소화된 비주얼
- 애니메이션 축소

### Mobile (< md)
- 수직 스택
- 상단: 간단한 브랜드 영역 (로고 + 한 줄 메시지)
- 하단: 로그인 폼
- 배경에 subtle 그라디언트만 유지

```
Mobile Layout:
┌─────────────────────┐
│                     │
│    [Logo]           │
│    CCgather         │
│                     │
│  "Your AI coding    │
│   journey awaits"   │
│                     │
├─────────────────────┤
│                     │
│  Welcome back       │
│  Sign in to continue│
│                     │
│  [GitHub Button]    │
│                     │
│  ─────────────────  │
│                     │
│  [Sign up link]     │
│                     │
└─────────────────────┘
```

---

## Animation Specifications

### Terminal Typing Animation (Option A)
```css
/* 타이핑 커서 */
.terminal-cursor {
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* 텍스트 타이핑 */
.typing-text {
  overflow: hidden;
  white-space: nowrap;
  animation: typing 2s steps(40, end);
}

@keyframes typing {
  from { width: 0; }
  to { width: 100%; }
}
```

### Floating Icons Animation (Option B)
```css
.floating-icon {
  animation: float 6s ease-in-out infinite;
}

.floating-icon:nth-child(odd) {
  animation-delay: -3s;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0px) rotate(0deg);
  }
  50% {
    transform: translateY(-20px) rotate(5deg);
  }
}
```

### Entrance Animation
```css
/* Left panel - slide from left */
.panel-left {
  animation: slideFromLeft 0.6s ease-out;
}

@keyframes slideFromLeft {
  from {
    opacity: 0;
    transform: translateX(-30px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* Right panel - fade in */
.panel-right {
  animation: fadeIn 0.6s ease-out 0.2s both;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

---

## Technical Implementation Notes

### File Structure
```
app/(auth)/
├── layout.tsx              # ClerkProviderWrapper
├── sign-in/
│   └── [[...sign-in]]/
│       └── page.tsx        # New split-screen design
└── sign-up/
    └── [[...sign-up]]/
        └── page.tsx        # Similar design for consistency

components/auth/
├── AuthLeftPanel.tsx       # Brand/visual panel component
├── AuthTerminalAnimation.tsx  # Option A: Terminal animation
├── AuthFloatingIcons.tsx   # Option B: Floating icons
└── AuthStats.tsx           # Statistics display
```

### Performance Considerations
1. **Lazy load animations**: 왼쪽 패널의 복잡한 애니메이션은 `dynamic` import
2. **Reduced motion**: `prefers-reduced-motion` 미디어 쿼리 존중
3. **Mobile optimization**: 모바일에서는 간소화된 버전 사용
4. **SSR compatibility**: Clerk 컴포넌트는 클라이언트 전용

---

## Design Decision Required

### 왼쪽 패널 디자인 선택

| Option | 설명 | 장점 | 단점 |
|--------|------|------|------|
| **A: Terminal** | CLI 애니메이션 | CCgather 핵심 기능 표현 | 구현 복잡도 높음 |
| **B: Globe + Icons** | 참고 이미지 스타일 | 글로벌 느낌, 익숙한 패턴 | 랜딩과 중복 |
| **C: Code Flow** | 코드→성과 스토리 | 가치 제안 명확 | 애니메이션 복잡 |

### Recommendation
**Option A (Terminal Animation)**을 권장합니다:
- CCgather의 고유한 아이덴티티 (CLI 기반 서비스)
- 개발자 타겟에 적합한 터미널 UI
- 랜딩 페이지와 차별화
- 참고 이미지의 "Animated Login" 컨셉과 일치

---

## Next Steps

1. **디자인 옵션 선택**: A, B, C 중 선택
2. **컴포넌트 구현**: 선택된 옵션에 따라 구현
3. **Sign-up 페이지 동기화**: 동일한 디자인 언어 적용
4. **테스트**: 반응형, 접근성, 성능 테스트

---

## Appendix: Reference Resources

### Design System Variables (globals.css)
- `--color-claude-coral: #DA7756`
- `--color-bg-primary: #0D0D0F`
- `--color-bg-card: #1A1A1E`
- `--gradient-claude: linear-gradient(135deg, #da7756 0%, #d4714e 50%, #b85c3d 100%)`

### Clerk Appearance API
- https://clerk.com/docs/components/customization/overview

### Animation Libraries (optional)
- Framer Motion (already in project)
- CSS Animations (preferred for performance)
