<div align="center">

# CCGather

### Document Your Claude Code Journey

**Global Leaderboard | Community | Levels & Badges | PWA App**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?style=flat-square&logo=supabase)](https://supabase.com/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue?style=flat-square)](LICENSE)

[Website](https://ccgather.com) · [Report Bug](https://github.com/DHxWhy/ccgather/issues) · [Request Feature](https://github.com/DHxWhy/ccgather/issues)

<!-- 📸 IMAGE: hero-screenshot.png (메인 화면 전체 - 3D 지구본 + 리더보드 보이는 풀샷) -->

</div>

---

## Quick Start

<table>
<tr>
<th width="80">Step</th>
<th>Description</th>
</tr>
<tr><td align="center"><b>1</b></td><td>Sign in with GitHub at <a href="https://ccgather.com">ccgather.com</a></td></tr>
<tr><td align="center"><b>2</b></td><td>Run <code>npx ccgather</code> in your terminal</td></tr>
<tr><td align="center"><b>3</b></td><td>Done! Your Claude Code usage syncs automatically</td></tr>
</table>

---

## Why I Built This

### I'm Not a Developer

I started vibe coding in August 2025 with Cursor and Lovable, then discovered Claude Code. For months, I spent 16+ hours daily—not using automation tools, but engaging in every conversation, asking Claude to explain concepts at a 15-year-old's level so I could truly understand.

**CCgather was built in about 3 weeks.**

I aimed for an MVP, but ended up trying many features for the sake of learning—and went through 2 major refactoring overhauls along the way.

Countless trade-offs were made between the 3D globe, animations, visual polish, and rendering performance.

I tried to bring every UX detail I imagined to life.

### The Problem

Claude Code only keeps usage history for 30 days. The leaderboard service I was using stopped working one day. So I decided: **"I'll just build it myself."**

### The Philosophy

**Token usage is NOT a measure of skill.** More tokens mean more attempts, more experiments, more exploration. This number represents your **spirit of exploration** and **passion**.

### The Vision

Developers worldwide use the same tools, but struggle to communicate due to different languages. **The community feature was built to break down these barriers.**

---

## Features

### 🏆 Global Leaderboard

See your passion among developers worldwide. Track your ranking by token usage and connect with developers who share your passion.

<!-- 📸 IMAGE: leaderboard.png (리더보드 화면 - 순위, 레벨, 국가 표시) -->

### 🌍 Country League

A country-based league system that gives you a sense of belonging. Cheer each other on with developers connected through Claude Code, regardless of nationality.

### 🌐 3D Globe

Visualize developer activity worldwide in real-time. See at a glance which countries are actively coding.

<!-- 📸 IMAGE: globe.gif (3D 지구본 회전 + 마커 표시되는 GIF) -->

### 💬 Global Community

**Write in your native language.**

Posts are automatically translated by AI. They're displayed in the reader's language based on their onboarding country setting.

<!-- 📸 IMAGE: community.png (커뮤니티 피드 - 번역 전/후 보이면 좋음) -->

**Community Features:**
- Posts and comments
- Likes and interactions
- Hall of Fame
- Link previews

### 📊 Activity Heatmap

Visualize your daily usage patterns with a GitHub-style activity heatmap. See your coding journey at a glance.

<!-- 📸 IMAGE: heatmap.png (프로필의 히트맵 부분) -->

### 📱 PWA App & Push Notifications

**Install it like an app.**

Add to your home screen from your web browser and use it like a native app. Receive push notifications for community activity (comments, likes).

### 🤝 Referral System

Invite friends with your unique invite link. Earn badges when your invited friends sign up.

<table>
<tr>
<th width="80">Invites</th>
<th width="140">Badge</th>
<th>Tier</th>
</tr>
<tr><td align="center">5+</td><td>📢 Recruiter</td><td>⚪ Common</td></tr>
<tr><td align="center">10+</td><td>🔗 Networker</td><td>🔵 Rare</td></tr>
<tr><td align="center">20+</td><td>📣 Influencer</td><td>🔵 Rare</td></tr>
<tr><td align="center">30+</td><td>⭐ Social Star</td><td>🟣 Epic</td></tr>
<tr><td align="center">50+</td><td>👑 Social Legend</td><td>🟡 Legendary</td></tr>
</table>

### 🎨 Light/Dark Mode

Choose your theme to match your environment. Follow system settings or switch manually.

### 📱 Responsive Design

Optimized experience across mobile, tablet, and desktop.

---

## Level System

10-tier level system based on token usage

<table>
<tr>
<th width="80">Level</th>
<th width="80">Icon</th>
<th width="140">Name</th>
<th width="140">Tokens</th>
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

## Badge System

27 badges · 4 tiers

<table>
<tr>
<th width="140">Tier</th>
<th width="300">Description</th>
</tr>
<tr><td>🟡 Legendary</td><td>Highest difficulty achievements (6)</td></tr>
<tr><td>🟣 Epic</td><td>Advanced achievements (7)</td></tr>
<tr><td>🔵 Rare</td><td>Intermediate achievements (8)</td></tr>
<tr><td>⚪ Common</td><td>Entry-level achievements (6)</td></tr>
</table>

**Categories:**
- 🔥 **Streak**: Consecutive activity days (7 days ~ 180 days)
- 💎 **Tokens**: Cumulative usage (1M ~ 10B)
- 🏆 **Rank**: Ranking achievements (Top 50 ~ #1)
- 🎭 **Model**: Usage patterns (Haiku, Sonnet, Opus)
- 🤝 **Social**: Friend referrals (5 ~ 50 people)

---

## CLI

```bash
npx ccgather
```

<!-- 📸 IMAGE: cli.gif (CLI 실행 → 메뉴 선택 → 제출 완료 GIF) -->

<table>
<tr>
<th width="80">Menu</th>
<th width="180">Function</th>
<th>Description</th>
</tr>
<tr><td align="center">📤</td><td>Submit Usage Data</td><td>Scan and submit Claude Code usage</td></tr>
<tr><td align="center">🌐</td><td>Open Leaderboard</td><td>Check rankings in browser</td></tr>
<tr><td align="center">⚙️</td><td>Settings</td><td>Re-authenticate or change account</td></tr>
</table>

---

## The Name

```
CC = Claude Code
Gather = Come together + Collect

"Where Claude Code developers worldwide gather"
```

---

## Tech Stack

<table>
<tr>
<th width="140">Area</th>
<th>Technology</th>
</tr>
<tr><td><b>Frontend</b></td><td>Next.js 16, React 19, TypeScript 5.9, Tailwind CSS 4</td></tr>
<tr><td><b>Backend</b></td><td>Supabase (PostgreSQL), Clerk (Auth)</td></tr>
<tr><td><b>State Management</b></td><td>TanStack Query</td></tr>
<tr><td><b>UI</b></td><td>Radix UI, Lucide React</td></tr>
<tr><td><b>Visualization</b></td><td>Framer Motion, Recharts, Cobe</td></tr>
<tr><td><b>AI</b></td><td>Google Gemini (Translation)</td></tr>
<tr><td><b>PWA</b></td><td>next-pwa, Web Push API</td></tr>
<tr><td><b>Testing</b></td><td>Playwright</td></tr>
<tr><td><b>Code Quality</b></td><td>ESLint, Prettier, Husky</td></tr>
</table>

---

## Acknowledgements

This project was inspired by the following projects:

<table>
<tr>
<th width="200">Project</th>
<th>Description</th>
</tr>
<tr>
<td><a href="https://github.com/ryoppippi/ccusage">ccusage</a></td>
<td>Claude Code usage analyzer that inspired our CLI implementation (by <a href="https://github.com/ryoppippi">@ryoppippi</a>)</td>
</tr>
<tr>
<td><a href="https://github.com/shuding/cobe">cobe</a></td>
<td>3D globe visualization library (by <a href="https://github.com/shuding">@shuding</a>, Vercel)</td>
</tr>
</table>

---

## License

This project is distributed under the Apache License 2.0. See [`LICENSE`](LICENSE) for details.

---

<div align="center">

**Record. Track. Grow.**

[ccgather.com](https://ccgather.com)

</div>
