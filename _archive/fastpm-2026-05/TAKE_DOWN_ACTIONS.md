# FastPM — Take-Down Actions

Founder decision (2026-05-25): **archive now, take site down, redirect domain.**

Original code: `/Users/shaharsolomon/dev/projects/portfolio/autoboot/` (don't confuse with the sprint harness root-level scripts — those stay).

This document tracks manual actions the user must execute outside the repo.

## Actions

| # | Action | Owner | Status | Notes |
|---|---|---|---|---|
| 1 | Take down `fastpm.dev` site (Netlify or wherever it deploys) | user | ☐ | Confirm site root returns 404 or redirect |
| 2 | Configure DNS for `fastpm.dev` → 301 redirect to `https://finsavvyai.com` | user | ☐ | Cloudflare DNS UI |
| 3 | Cancel any active Netlify / Vercel / Cloudflare Pages project for FastPM | user | ☐ | Removes hosting bill |
| 4 | Pause / cancel LemonSqueezy product for FastPM (if any active subscriptions, notify customers first) | user | ☐ | Check for paying customers; refund or migrate before pause |
| 5 | Unpublish VSCode extension marketplace listing | user | ☐ | If published |
| 6 | Unpublish IntelliJ plugin marketplace listing | user | ☐ | If published |
| 7 | Archive GitHub repo (Settings → Archive this repository) | user | ☐ | Read-only, no further changes |
| 8 | Add `[ARCHIVED 2026-05-25]` prefix to GitHub repo description | user | ☐ | Signals to anyone who finds it |
| 9 | Snapshot final repo state to `_archive/fastpm-2026-05/snapshot/` if useful primitives need preserving | optional | ☐ | MCP server skeleton + LemonSqueezy boilerplate may be worth folding into `oss/automationhub/` |
| 10 | Manual delete `/portfolio/autoboot/` after the above verified | user | ☐ | Final step; do last |

## Why archive

- Domain (`fastpm.dev`) was already marked for park in master plan.
- Product is "MCP server for dev-server restart" — developer tool with low strategic fit to the AI-infra thesis.
- Full sales infrastructure shipped (login, register, payments, IDE extensions) but no traction signal.
- Rebrand from AutoBoot → FastPM + recent payment integration suggests a commercialization attempt that didn't get distribution.

## Useful primitives to recover (optional)

Before deleting `/portfolio/autoboot/`, consider folding these into `oss/automationhub/`:

- MCP server skeleton (Netlify Functions + Hono)
- LemonSqueezy payment integration boilerplate
- VSCode + IntelliJ plugin templates

If recovered, document the fold in `oss/automationhub/MIGRATION_NOTES.md`.

## Not in scope

- Sprint harness (`harness.sh`, `_harness/`, `sprint*.py`, etc. at portfolio root) — separate decision, stays as INFRA. See `_archive/migration-status.md`.

## Original archive manifest

Preserved in this same directory as `ARCHIVED.md` (was previously at `_archive/portfolio-snapshots/autoboot/ARCHIVED.md`).
