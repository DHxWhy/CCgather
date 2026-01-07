<div align="center">

# CCGather

### Where Claude Code Developers Gather

**Real-time Global Leaderboard | Country Rankings | Level System**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-3FCF8E?style=flat-square&logo=supabase)](https://supabase.com/)
[![License](https://img.shields.io/badge/License-Proprietary-red?style=flat-square)](LICENSE)

[Website](https://ccgather.com) · [Report Bug](https://github.com/DHxYoon/ccgather/issues) · [Request Feature](https://github.com/DHxYoon/ccgather/issues)

</div>

---

## Overview

**CCGather** is a community platform where Claude Code developers worldwide track their token usage, share progress through global/country leaderboards, and grow together.

```
CC = Claude Code
Gather = Come together + Collect

"Where Claude Code developers worldwide gather"
```

<br/>

## Quick Start

### 1. Sign Up
Sign in with GitHub at [ccgather.com](https://ccgather.com)

### 2. Install CLI
```bash
npx ccgather
```

### 3. Done!
Your Claude Code usage will be synced automatically.

<br/>

## CLI Commands

```bash
npx ccgather              # Default run (submit)
npx ccgather status       # Check current ranking
npx ccgather sync         # Manual sync
npx ccgather --help       # Help
```

<br/>

## Features

### 🏆 Global Leaderboard
See where you stand among developers worldwide. Track rankings by token usage and cost.

### 🌍 Country League
Country-based league system for a sense of belonging. Connect with developers from your region.

### 📊 Level System

10-tier level system based on token usage

| Level | Icon | Name | Tokens |
|:-----:|:----:|------|--------|
| 1 | 🌱 | Rookie | 0 - 10M |
| 2 | ⚡ | Coder | 10M - 50M |
| 3 | 🔨 | Builder | 50M - 200M |
| 4 | 🏗️ | Architect | 200M - 500M |
| 5 | 💎 | Expert | 500M - 1B |
| 6 | 🔥 | Master | 1B - 3B |
| 7 | ⚔️ | Grandmaster | 3B - 10B |
| 8 | 👑 | Legend | 10B - 30B |
| 9 | 🌟 | Titan | 30B - 100B |
| 10 | 🏆 | Immortal | 100B+ |

### 🎖️ Badge System

27 badges · 4 rarity tiers: 🟡 Legendary · 🟣 Epic · 🔵 Rare · ⚪ Common

<table>
<tr>
<td width="50%">

**🔥 Streak** (6)
| Badge | Condition | Rarity |
|-------|-----------|:------:|
| Week Starter | 7 days streak | ⚪ |
| Fortnight Fighter | 14 days streak | ⚪ |
| Monthly Warrior | 30 days streak | 🔵 |
| Two-Month Titan | 60 days streak | 🔵 |
| Quarter Master | 90 days streak | 🟣 |
| Half-Year Hero | 180 days streak | 🟡 |

</td>
<td width="50%">

**💎 Tokens** (6)
| Badge | Condition | Rarity |
|-------|-----------|:------:|
| First Million | 1M tokens | ⚪ |
| 100M Club | 100M tokens | 🔵 |
| Big Spender | $5,000 spent | 🔵 |
| Billion Club | 1B tokens | 🟣 |
| Whale | $10,000 spent | 🟣 |
| 10B Club | 10B tokens | 🟡 |

</td>
</tr>
<tr>
<td>

**🏆 Rank** (6)
| Badge | Condition | Rarity |
|-------|-----------|:------:|
| Rising Star | 100+ rank gain/week | 🔵 |
| Global 50 | Global Top 50 | 🔵 |
| National Champion | #1 in country | 🟣 |
| Trailblazer | First 10 in country | 🟡 |
| Podium | Global Top 3 | 🟡 |
| Global Champion | Global #1 | 🟡 |

</td>
<td>

**🎭 Model** (4) + **🤝 Social** (5)
| Badge | Condition | Rarity |
|-------|-----------|:------:|
| Haiku Ninja | 70%+ on Haiku | ⚪ |
| Sonnet Master | 70%+ on Sonnet | 🔵 |
| Model Explorer | Used all models | 🔵 |
| Opus Connoisseur | 70%+ on Opus | 🟣 |
| Recruiter ~ Social Legend | 5~50 referrals | ⚪~🟡 |

</td>
</tr>
</table>

### ⚡ CLI Auto-Sync
One command to install, automatic usage sync.

```bash
npx ccgather
```

### 📰 News Hub
AI-summarized latest news about Claude Code. *(Coming Soon)*

<br/>

## Tech Stack

<table>
<tr>
<td align="center" width="25%">

**Frontend**

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript)
![TailwindCSS](https://img.shields.io/badge/Tailwind-4-06B6D4?style=flat-square&logo=tailwindcss)

</td>
<td align="center" width="25%">

**Backend**

![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?style=flat-square&logo=supabase)
![Clerk](https://img.shields.io/badge/Clerk-Auth-6C47FF?style=flat-square&logo=clerk)

</td>
<td align="center" width="25%">

**State**

![TanStack](https://img.shields.io/badge/TanStack-Query-FF4154?style=flat-square&logo=reactquery)
![Zustand](https://img.shields.io/badge/Zustand-Client-brown?style=flat-square)

</td>
<td align="center" width="25%">

**UI/UX**

![Framer](https://img.shields.io/badge/Framer-Motion-0055FF?style=flat-square&logo=framer)
![Recharts](https://img.shields.io/badge/Recharts-Charts-22C55E?style=flat-square)

</td>
</tr>
</table>

<br/>

## Contributing

Contributions are welcome! Feel free to submit a Pull Request.

<details>
<summary><b>Development Setup</b></summary>

### Prerequisites
- Node.js 20+
- pnpm 9+

### Installation

```bash
# Clone the repository
git clone https://github.com/DHxYoon/ccgather.git
cd ccgather

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local

# Start development server
pnpm dev
```

### Project Structure

```
ccgather/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Authentication pages
│   ├── (main)/            # Main application pages
│   └── api/               # API routes
├── components/            # React components
├── lib/                   # Utilities & helpers
├── packages/cli/          # CLI tool
└── supabase/              # Database migrations
```

</details>

<br/>

## License

This project is proprietary. See [`LICENSE`](LICENSE) for more information.

<br/>

---

<div align="center">

**Gather. Track. Rise.**

Made with ❤️ by Claude Code enthusiasts

</div>
