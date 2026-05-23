# Security Policy

CCgather is an open-source project tracking Claude Code usage. We take the security of our users' data — including their Clerk sessions, Supabase records, and GitHub-derived identity — seriously. This document explains how to report vulnerabilities and what to expect from us.

## Supported Versions

We only support the latest deployed version of `main` (https://ccgather.com). Older commits and feature branches do not receive security patches.

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security problems.** Public disclosure before a fix is available puts users at risk.

Instead, use one of these private channels:

1. **GitHub Security Advisory** (preferred): https://github.com/DHxWhy/CCgather/security/advisories/new
2. **Email**: `105179499+DHxWhy@users.noreply.github.com`

Please include:

- A clear description of the issue and its impact
- Steps to reproduce (or a proof-of-concept)
- The version / commit hash if you can pin it down
- Your contact info so we can follow up

## Scope

In scope:

- Authentication bypass (Clerk session, Supabase RLS)
- Data exposure (other users' tokens, costs, emails)
- Account takeover (referral hijack, OAuth linking flaws)
- CSRF / XSS / SQL injection in the web app or APIs
- Webhook spoofing (Clerk `/api/webhooks/clerk`)
- Privilege escalation (regular user → admin)

Out of scope:

- Self-XSS or social engineering
- Denial of service from unauthenticated traffic
- Findings that require physical access to a user's device
- Outdated dependencies without a known exploit path
- Vulnerabilities in third-party services (Clerk, Supabase, Vercel) — report to those vendors

## Response

- We aim to **acknowledge** reports within **3 business days**.
- We aim to **triage and confirm** within **7 business days**.
- Critical fixes are typically deployed within **48 hours** of confirmation.
- We will credit reporters in the changelog unless you ask otherwise.

## Coordinated Disclosure

We ask reporters to give us **a reasonable window (typically 30 days)** to fix issues before public disclosure. Critical issues affecting user data may extend this window if a complex migration is required.

Thank you for helping keep CCgather and its users safe.
