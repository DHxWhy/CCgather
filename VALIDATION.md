# Data Validation & Integrity

> Last updated: 2026-05-29 17:21 KST

How CCgather keeps leaderboard data trustworthy — **without ever blocking a
contributor.** Every claim below maps to real code you can read in this repo.

---

## Philosophy

> **Token usage is not a score to police — it's a record of exploration.**

CCgather does **not** reject your submission over how big your numbers are. A
power user who genuinely burns billions of cache-read tokens in a day is exactly
who this leaderboard is for. So our validation is **observe-only**: we verify
data integrity, surface anything unusual for a human to look at, and **let every
submission through**.

The goal is a leaderboard that is *both* welcoming to heavy users *and* honest
about its numbers.

---

## How we protect data integrity

These run on every CLI submission, independent of the advisory validators below.

| Layer | What it does | Where |
|-------|--------------|-------|
| **Token auth** | Submissions require a Bearer API token mapped to a real account. | `app/api/cli/submit/route.ts` |
| **Server-side cost** | `cost_usd` is **recomputed on the server** from token counts × current [LiteLLM](https://github.com/BerriAI/litellm) prices. An outdated or tampered CLI cannot inflate cost. | `lib/services/pricing.ts` |
| **1 Project, 1 Person** | Each session file is SHA-256 fingerprinted. If another account already submitted those sessions, the duplicate is rejected (409). You can't claim someone else's work. | `supabase/migrations/031_session_fingerprints.sql`, `app/api/cli/submit/route.ts` |
| **Device-aware dedup** | `UNIQUE(user_id, date, device_id)` — re-submitting the same day overwrites instead of stacking. Multi-device usage is tracked separately and summed. | `supabase/migrations/054_device_aware_usage.sql` |
| **Rate limiting** | Max 2 submissions/hour per user. | `app/api/cli/submit/route.ts` |
| **Cumulative recompute** | `users.total_tokens` is recomputed as `SUM(usage_stats)` on every submission, so the displayed total always equals the raw rows. | `app/api/cli/submit/route.ts` |

---

## What we validate (advisory)

On top of integrity, each submission is checked against a set of advisory
validators. **None of these block the submission** — they annotate it.

| Code | Checks | Severity |
|------|--------|----------|
| `V1_breakdown_*` | input + output + cache_read + cache_write vs. reported total | INFO / SOFT |
| `V2_daily_*` | unusually large single-day token / cost vs. calibrated caps | SOFT / *(advisory)* |
| `V2_aggregate_*` | same date split across multiple entries to dodge a per-day check | SOFT |
| `V4_future_date` | dates beyond today (UTC, +1 day buffer) | *(advisory)* |
| `V6_cache_ratio_high` | cache-read share far beyond what real heavy-cache users show | SOFT |
| `V8` / `V9` | payload shape & numeric overflow guards | *(advisory)* |

Thresholds are calibrated against real heavy-user data and carry a wide safety
margin (the daily token cap sits at ~5× the largest day we've ever observed), so
legitimate power users are not flagged. Exact values live in
[`lib/config/validation-thresholds.ts`](lib/config/validation-thresholds.ts) —
open source, no hidden rules.

---

## What happens when something looks off

```
Submission with an unusual pattern
  → still succeeds (HTTP 200, always)
  → flags recorded on the row (validation_flags, submission_review_status)
  → a high-severity finding notifies the team (Discord) + an admin dashboard entry
  → a human reviews it
```

No automatic rejection. No automatic score deletion. A person looks at flagged
submissions and decides — and the raw data stays intact either way.

Validation runs in one of three modes (`SUBMIT_VALIDATION_MODE`): `off`, `log`,
or `notify`. **None of them block a user** — they only change how much we record
and alert. Code: [`lib/services/submit-validators.ts`](lib/services/submit-validators.ts),
[`lib/services/validation-notify.ts`](lib/services/validation-notify.ts).

---

## What we deliberately DON'T do

Transparency cuts both ways — here's what we *don't* do:

- ❌ **We don't block or reject** a submission for having large numbers.
- ❌ **We don't silently delete** scores. Flagged data is kept; any correction is a deliberate, logged human action.
- ❌ **We don't hide caps.** Every threshold is in open-source config, not a secret.
- ❌ **We don't trust client-reported cost.** It's always recomputed server-side.

---

## Verifiable

This isn't a marketing promise — it's code.

- Source: <https://github.com/DHxWhy/ccgather>
- Validators: [`lib/services/submit-validators.ts`](lib/services/submit-validators.ts)
- Thresholds: [`lib/config/validation-thresholds.ts`](lib/config/validation-thresholds.ts)
- Submission endpoint: [`app/api/cli/submit/route.ts`](app/api/cli/submit/route.ts)
- License: Apache 2.0

Found a gap? [Open an issue.](https://github.com/DHxWhy/ccgather/issues)
