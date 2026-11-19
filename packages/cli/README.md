# ccgather

**The CLI for [CCgather](https://ccgather.com), the open-source Claude Code usage leaderboard.**

It reads your local Claude Code logs, adds up your daily tokens and cost, and submits them, so you can see where you rank — worldwide, in your country, and each month.

[![npm](https://img.shields.io/npm/v/ccgather?style=flat-square&color=da7756)](https://www.npmjs.com/package/ccgather)
[![Developers](https://img.shields.io/endpoint?url=https%3A%2F%2Fccgather.com%2Fapi%2Fstats%2Fbadge%3Fmetric%3Ddevelopers&style=flat-square)](https://ccgather.com/stats)
[![Claude Code tokens logged](https://img.shields.io/endpoint?url=https%3A%2F%2Fccgather.com%2Fapi%2Fstats%2Fbadge%3Fmetric%3Dtokens&style=flat-square)](https://ccgather.com/stats)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue?style=flat-square)](https://github.com/DHxWhy/CCgather/blob/main/LICENSE)

## Use it

```bash
npx ccgather@latest                    # menu: sign in with GitHub, submit, auto-submit, settings
npx ccgather@latest submit             # submit without any prompt, for schedulers (exit 0 = submitted)
npx ccgather@latest autosubmit on      # submit once a day through your OS scheduler
npx ccgather@latest autosubmit status  # what the scheduler has and what the last run did
npx ccgather@latest autosubmit off     # remove it
```

Claude Code keeps about 30 days of local logs. CCgather keeps your daily totals after that.

## How it counts

- Tokens = input + output + cache writes + cache reads, the same definition [ccusage](https://github.com/ryoppippi/ccusage) uses.
- Each Claude Code response is counted once.
- Costs use Anthropic's official API prices.
- It reads `~/.claude`, other Claude Code data folders beside it (it asks first) and the folder `CLAUDE_CONFIG_DIR` names.

## What it sends

- **Sent:** daily token and cost totals per model, session counts, one-way session fingerprints that stop the same session from being submitted twice, a one-way device ID, the CLI version and your Claude plan type
- **Never sent:** prompts, conversations, code, file contents or file paths
- **Public:** your GitHub username, avatar and country on the leaderboard

## Requirements

Node.js 18 or later on Windows, macOS or Linux.

## Links

- [Leaderboard](https://ccgather.com/leaderboard) · [All-time ranking](https://ccgather.com/leaderboard?period=all) · [Live stats](https://ccgather.com/stats)
- [Full guide: scheduled submits and auto-submit on each OS](https://github.com/DHxWhy/CCgather#cli)
- [Report a bug](https://github.com/DHxWhy/CCgather/issues)

Apache License 2.0.
