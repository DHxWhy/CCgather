<div align="center">

# CCGather

### 당신의 Claude Code 여정을 기록하세요

**글로벌 리더보드 | 커뮤니티 | 레벨 & 뱃지 | PWA 앱**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?style=flat-square&logo=supabase)](https://supabase.com/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue?style=flat-square)](LICENSE)

[웹사이트](https://ccgather.com) · [버그 제보](https://github.com/DHxWhy/ccgather/issues) · [기능 제안](https://github.com/DHxWhy/ccgather/issues)

<!-- 📸 IMAGE: hero-screenshot.png (메인 화면 전체 - 3D 지구본 + 리더보드 보이는 풀샷) -->

</div>

---

## 빠른 시작

<table>
<tr>
<th width="80">단계</th>
<th>설명</th>
</tr>
<tr><td align="center"><b>1</b></td><td><a href="https://ccgather.com">ccgather.com</a>에서 GitHub으로 로그인</td></tr>
<tr><td align="center"><b>2</b></td><td>터미널에서 <code>npx ccgather</code> 실행</td></tr>
<tr><td align="center"><b>3</b></td><td>끝! Claude Code 사용 기록이 자동으로 동기화됩니다</td></tr>
</table>

---

## 왜 만들었나요?

### 저는 개발자가 아닙니다

2025년 8월, Cursor와 Lovable로 바이브 코딩을 시작했고, 이후 Claude Code를 만났습니다. 몇 달간 하루 16시간 이상을 코딩에 쏟았습니다.
자동화 에이전트 파이프라인을 직접 만들수도 있지만, 더 알고 싶고, 더 잘 만들고 싶어서 매 대화마다 직접 참여하며 어려운 개념은 초보자 눈높이로 설명을 요구하며 매순간 개입했습니다.

**CCgather는 약 3주 만에 만들어졌습니다.**

MVP를 목표로 했지만, 학습 차원에서 다양한 기능을 시도했고, 그 과정에서 대수술급 리팩토링을 2번 경험했습니다.

3D 지구본, 애니메이션, 시각적 요소와 렌더링 최적화 사이에서 수많은 저울질을 했습니다.

UX를 위해 상상한 것들을 최대한 반영해보려고 노력했습니다.

사용자가 늘어나면, 경량화를 고려해보겠습니다.

### 30일 후 사라지는 기록들

Claude Code는 사용 기록을 약 30일만 보관하고 슬라이딩 윈도우 형태로 사라집니다. 매일 불태운 토큰의 기록, 그 열정의 흔적이, 한 달이 지나면 조용히 사라집니다.

**"내가 얼마나 열심히 했는지, 어딘가에 남기고 싶었습니다."**

### 직접 만들게 된 계기

기존에 사용하던 리더보드 서비스로 인해 매일 제출을 하며 동기부여를 얻었습니다.
2026년 해가 바뀌면서 해당 서비스는 에러가 생겼고, 수정해달라고 기다렸지만, 아무 소식이 없었습니다. 그래서 직접 만들어 보기로 결심했습니다.

**"그냥 내가 만들자."**

### 단순한 숫자 제출이 아닌, 경험을 만들고 싶었습니다

PC 앞에서 묵묵히 코드를 작성하는 개발자들. 그들이 이 서비스에 접속했을 때, 단순히 토큰 수치를 확인하는 것 이상의 무언가를 느꼈으면 했습니다.

그래서 3D 지구본, 애니메이션, 시각적 요소에 많은 공을 들였습니다. 작은 즐거움이라도 드리고 싶었습니다.

### 리더보드 : 토큰 사용량이 의미하는 것

**토큰 사용량은 실력을 증명하는 지표가 아닙니다.**

더 많은 토큰은 더 많은 시도, 더 많은 실험, 더 많은 탐구를 의미합니다. 이 숫자는 당신의 **탐구 정신**과 **열정**을 보여주는 기록입니다.

### 커뮤니티 : 언어 장벽을 넘어

개발하면서 느꼈습니다. 전 세계 개발자들이 같은 도구를 사용하지만, 서로 다른 언어 때문에 소통하기 어렵다는 것을.

**커뮤니티 기능은 이 장벽을 허물기 위해 만들었습니다.** 한국, 일본, 미국, 유럽... 어디에 있든, Claude Code를 사용하는 개발자라면 언어 장벽 없이 스몰톡 할 수 있는 공간을 구현해 두었습니다.

---

## 주요 기능

### 🏆 글로벌 리더보드

전 세계 개발자들 사이에서 내 열정을 확인하세요. 토큰 사용량으로 순위를 추적하고, 같은 열정을 가진 개발자들과 컨택하세요.

<!-- 📸 IMAGE: leaderboard.png (리더보드 화면 - 순위, 레벨, 국가 표시) -->

### 🌍 국가별 리그

소속감을 느낄 수 있는 국가 기반 리그 시스템. 국적이 달라도 Claude Code로 연결 된 개발자들과 서로의 여정을 응원하세요.

### 🌐 3D 지구본

실시간으로 전 세계 개발자 활동을 시각화합니다. 어느 나라에서 얼마나 활발하게 코딩하고 있는지 한눈에 볼 수 있습니다.

<!-- 📸 IMAGE: globe.gif (3D 지구본 회전 + 마커 표시되는 GIF) -->

### 💬 글로벌 커뮤니티

**모국어로 작성하세요.**

게시글은 AI가 자동으로 번역합니다. 읽는 사람의 온보딩 국가 설정에 맞춰 해당 언어로 표시됩니다. 한국어로 쓰면, 일본 사용자에게는 일본어로, 미국 사용자에게는 영어로 보입니다.

언어가 달라도 소통할 수 있습니다.

<!-- 📸 IMAGE: community.png (커뮤니티 피드 - 번역 전/후 보이면 좋음) -->

**커뮤니티 기능:**
- 게시글 및 댓글 작성
- 좋아요 및 상호작용
- Hall of Fame (명예의 전당)
- 링크 미리보기

### 📊 Activity Heatmap

GitHub 스타일의 활동 히트맵으로 일별 사용 패턴을 시각화합니다. 자신의 코딩 여정을 한눈에 확인하세요.

<!-- 📸 IMAGE: heatmap.png (프로필의 히트맵 부분) -->

### 📱 PWA 앱 & Push 알림

**앱처럼 설치하세요.**

웹 브라우저에서 홈 화면에 추가하면 네이티브 앱처럼 사용할 수 있습니다. 커뮤니티 활동(댓글, 좋아요)에 대한 Push 알림을 받을 수 있습니다.

### 🤝 친구 초대 시스템

고유한 초대 링크로 친구를 초대하세요. 초대한 친구가 가입하면 뱃지를 획득할 수 있습니다.

<table>
<tr>
<th width="80">초대 수</th>
<th width="140">뱃지</th>
<th>등급</th>
</tr>
<tr><td align="center">5+</td><td>📢 Recruiter</td><td>⚪ Common</td></tr>
<tr><td align="center">10+</td><td>🔗 Networker</td><td>🔵 Rare</td></tr>
<tr><td align="center">20+</td><td>📣 Influencer</td><td>🔵 Rare</td></tr>
<tr><td align="center">30+</td><td>⭐ Social Star</td><td>🟣 Epic</td></tr>
<tr><td align="center">50+</td><td>👑 Social Legend</td><td>🟡 Legendary</td></tr>
</table>

### 🎨 라이트/다크 모드

사용자 환경에 맞게 테마를 선택하세요. 시스템 설정을 따르거나 수동으로 전환할 수 있습니다.

### 📱 반응형 디자인

모바일, 태블릿, 데스크톱 모든 환경에서 최적화된 경험을 제공합니다.

---

## 레벨 시스템

토큰 사용량 기반 10단계 레벨 시스템

<table>
<tr>
<th width="80">레벨</th>
<th width="80">아이콘</th>
<th width="140">이름</th>
<th width="140">토큰</th>
</tr>
<tr><td align="center">1</td><td align="center">🌱</td><td>Rookie</td><td>0 - 10M</td></tr>
<tr><td align="center">2</td><td align="center">⚡</td><td>Coder</td><td>10M - 50M</td></tr>
<tr><td align="center">3</td><td align="center">🔨</td><td>Builder</td><td>50M - 200M</td></tr>
<tr><td align="center">4</td><td align="center">🏗️</td><td>Architect</td><td>200M - 500M</td></tr>
<tr><td align="center">5</td><td align="center">💎</td><td>Expert</td><td>500M - 1B</td></tr>
<tr><td align="center">6</td><td align="center">🔥</td><td>Master</td><td>1B - 3B</td></tr>
<tr><td align="center">7</td><td align="center">⚔️</td><td>Grandmaster</td><td>3B - 10B</td></tr>
<tr><td align="center">8</td><td align="center">👑</td><td>Legend</td><td>10B - 30B</td></tr>
<tr><td align="center">9</td><td align="center">🌟</td><td>Titan</td><td>30B - 100B</td></tr>
<tr><td align="center">10</td><td align="center">🏆</td><td>Immortal</td><td>100B+</td></tr>
</table>

---

## 뱃지 시스템

27개 뱃지 · 4가지 등급

<table>
<tr>
<th width="140">등급</th>
<th width="300">설명</th>
</tr>
<tr><td>🟡 Legendary</td><td>최고 난이도 달성 (6개)</td></tr>
<tr><td>🟣 Epic</td><td>상위 달성 (7개)</td></tr>
<tr><td>🔵 Rare</td><td>중급 달성 (8개)</td></tr>
<tr><td>⚪ Common</td><td>입문 달성 (6개)</td></tr>
</table>

**카테고리:**
- 🔥 **스트릭**: 연속 활동일 (7일 ~ 180일)
- 💎 **토큰**: 누적 사용량 (1M ~ 10B)
- 🏆 **랭크**: 순위 달성 (Top 50 ~ #1)
- 🎭 **모델**: 사용 패턴 (Haiku, Sonnet, Opus)
- 🤝 **소셜**: 친구 초대 (5명 ~ 50명)

---

## CLI

```bash
npx ccgather
```

<!-- 📸 IMAGE: cli.gif (CLI 실행 → 메뉴 선택 → 제출 완료 GIF) -->

<table>
<tr>
<th width="80">메뉴</th>
<th width="180">기능</th>
<th>설명</th>
</tr>
<tr><td align="center">📤</td><td>사용 데이터 제출</td><td>Claude Code 사용량 스캔 및 제출</td></tr>
<tr><td align="center">🌐</td><td>리더보드 열기</td><td>브라우저에서 순위 확인</td></tr>
<tr><td align="center">⚙️</td><td>설정</td><td>재인증 또는 계정 변경</td></tr>
</table>

---

## 이름의 의미

```
CC = Claude Code
Gather = 모이다 + 모으다

"전 세계 Claude Code 개발자들이 모이는 곳"
```

---

## 기술 스택

<table>
<tr>
<th width="140">영역</th>
<th>기술</th>
</tr>
<tr><td><b>프론트엔드</b></td><td>Next.js 16, React 19, TypeScript 5.9, Tailwind CSS 4</td></tr>
<tr><td><b>백엔드</b></td><td>Supabase (PostgreSQL), Clerk (인증)</td></tr>
<tr><td><b>상태관리</b></td><td>TanStack Query</td></tr>
<tr><td><b>UI</b></td><td>Radix UI, Lucide React</td></tr>
<tr><td><b>시각화</b></td><td>Framer Motion, Recharts, Cobe</td></tr>
<tr><td><b>AI</b></td><td>Google Gemini (번역)</td></tr>
<tr><td><b>PWA</b></td><td>next-pwa, Web Push API</td></tr>
<tr><td><b>테스트</b></td><td>Playwright</td></tr>
<tr><td><b>코드 품질</b></td><td>ESLint, Prettier, Husky</td></tr>
</table>

---

## 감사의 말

이 프로젝트는 다음 프로젝트들에서 영감을 받았습니다:

<table>
<tr>
<th width="200">프로젝트</th>
<th>설명</th>
</tr>
<tr>
<td><a href="https://github.com/ryoppippi/ccusage">ccusage</a></td>
<td>CLI 구현에 영감을 준 Claude Code 사용량 분석기 (by <a href="https://github.com/ryoppippi">@ryoppippi</a>)</td>
</tr>
<tr>
<td><a href="https://github.com/shuding/cobe">cobe</a></td>
<td>3D 지구본 시각화 라이브러리 (by <a href="https://github.com/shuding">@shuding</a>, Vercel)</td>
</tr>
</table>

---

## 라이선스

이 프로젝트는 Apache License 2.0 하에 배포됩니다. 자세한 내용은 [`LICENSE`](LICENSE)를 참조하세요.

---

<div align="center">

**기록하고. 추적하고. 성장하세요.**

[ccgather.com](https://ccgather.com)

</div>
