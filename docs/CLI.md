# CCgather CLI Documentation

**Version:** 1.0.0
**Last Updated:** 2026-01-06

---

## Overview

CCgather CLI는 Claude Code 사용량을 리더보드에 제출하는 명령줄 도구입니다.

**설치 불필요** - `npx`로 바로 실행 가능

---

## Quick Start

```bash
npx ccgather
```

터미널에서 위 명령어를 실행하면:
1. Claude Code 사용량 데이터 감지 (cc.json 또는 세션 로그)
2. 요약 정보 표시 (토큰, 비용, 사용일수)
3. 확인 후 리더보드에 제출
4. 프로필 URL 제공

---

## Commands

| 명령어 | 설명 |
|--------|------|
| `npx ccgather` | 리더보드에 제출 (기본) |
| `npx ccgather rank` | 현재 순위 확인 |
| `npx ccgather --auto` | 자동 동기화 활성화 (선택) |
| `npx ccgather --manual` | 자동 동기화 비활성화 |
| `npx ccgather reset` | 설정 초기화 |
| `npx ccgather -y` | 확인 없이 바로 제출 |
| `npx ccgather --help` | 도움말 |

---

## Usage Flow

### 기본 사용 (수동 제출)

```
$ npx ccgather

🚀 CCgather Submission Tool v1.0.0

Detected GitHub username from repository: username
? GitHub username: username
? Found existing cc.json. Use this file? Yes
✓ Using cc.json

Summary:
  Total Cost: $1,927
  Total Tokens: 2,001,617,183
  Days Tracked: 29

? Submit to CCgather leaderboard? Yes
✔ Successfully submitted to CCgather!

View your profile at: https://ccgather.dev/u/username

Done! 🎉
```

### 순위 확인

```
$ npx ccgather rank

🏆 Your CCgather Ranking

Global Rank: #42
Total Tokens: 2,001,617,183
Total Spent: $1,927
Level: 🔥 Lv.15 Inferno
```

---

## Data Sources

CLI는 다음 위치에서 사용량 데이터를 감지합니다:

| 우선순위 | 경로 | 설명 |
|---------|------|------|
| 1 | `./cc.json` | 현재 디렉토리의 cc.json |
| 2 | `~/cc.json` | 홈 디렉토리의 cc.json |
| 3 | `~/.claude/cc.json` | Claude 설정 폴더의 cc.json |
| 4 | `~/.claude/projects/` | Claude Code 세션 로그 (JSONL) |

### cc.json 형식

```json
{
  "totalTokens": 2001617183,
  "totalCost": 1927.45,
  "inputTokens": 1200000000,
  "outputTokens": 801617183,
  "daysTracked": 29
}
```

---

## Auto-Sync (선택적 기능)

자동 동기화를 활성화하면 Claude Code 세션이 종료될 때마다 자동으로 데이터가 동기화됩니다.

### 활성화

```bash
npx ccgather --auto
```

1. GitHub OAuth 인증 (브라우저)
2. Claude Code Stop Hook 설치
3. 이후 자동 동기화

### 비활성화

```bash
npx ccgather --manual
# 또는
npx ccgather reset
```

### 설정 파일 위치 (Auto-Sync 전용)

| 파일 | 설명 |
|------|------|
| `~/.claude/settings.json` | Claude Code Stop Hook |
| `~/.claude/ccgather-sync.js` | 동기화 스크립트 |
| `~/.ccgather/config.json` | API 토큰 및 설정 |

---

## Comparison with ViberRank

| 기능 | CCgather | ViberRank |
|------|----------|-----------|
| 기본 방식 | 수동 제출 | 수동 제출 |
| 자동 동기화 | 선택적 (`--auto`) | 미지원 |
| 인증 | GitHub username | GitHub username |
| 데이터 소스 | cc.json + JSONL | cc.json |

---

## Troubleshooting

### "No usage data found"

- `cc.json` 파일이 존재하는지 확인
- Claude Code를 사용한 적이 있는지 확인
- `~/.claude/projects/` 디렉토리에 세션 로그가 있는지 확인

### Auto-sync가 작동하지 않음

```bash
# Hook 재설치
npx ccgather reset
npx ccgather --auto
```

### 인증 실패

- 브라우저에서 GitHub 로그인 상태 확인
- 네트워크 연결 확인

---

## Privacy

- **수집 데이터**: 토큰 사용량, 비용만 수집
- **미수집 데이터**: 대화 내용, 코드, 프로젝트 정보
- **저장 위치**: API 토큰은 로컬에만 저장 (`~/.ccgather/`)
- **전송**: HTTPS로 암호화 전송

---

## Development

### CLI 패키지 위치

```
packages/cli/
├── src/
│   ├── index.ts          # 진입점
│   ├── commands/
│   │   ├── submit.ts     # 제출 명령
│   │   ├── status.ts     # 순위 확인
│   │   ├── setup-auto.ts # 자동 동기화 설정
│   │   └── reset.ts      # 초기화
│   └── lib/
│       └── config.ts     # 설정 관리
├── package.json
└── tsconfig.json
```

### 빌드

```bash
cd packages/cli
pnpm build
```

### 로컬 테스트

```bash
cd packages/cli
pnpm start
```

---

## Version History

| 버전 | 날짜 | 변경사항 |
|------|------|----------|
| 1.0.0 | 2026-01-06 | 초기 릴리즈, 수동 제출 기본 |
