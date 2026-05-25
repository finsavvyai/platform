# OpenSyber Migration Notes

Round 4, Days 61-90. Agent: SDLC-OPENSYBER.

## Source

| Source repo | SHA (HEAD at copy) | New path |
|---|---|---|
| `portfolio/opensyber` | `77af1c7ce3e0d3b5ac893a7f22f9a7514478aed1` | `products/opensyber/` |

Copy date: 2026-05-25. Last upstream commit: 2026-05-24. Git history not preserved.

Note: a sibling worktree `portfolio/opensyber.agent1` exists but was NOT migrated (parallel-agent worktree variant per addendum §3 — these are scheduled for archive by the ARCHIVE-WEBSITE agent).

## Exclusions applied

Standard rsync excludes plus:
- `.turbo/` (Turborepo build cache; ~1.8GB of `.tar.zst` artifacts)
- `.open-next/` (OpenNext Cloudflare build output)
- All standard build/cache patterns from round-4 conventions

## File counts (after exclusions)

- `products/opensyber/`: 3338 files, 50M
- Source before excludes: ~138k files, 7G

## Known broken imports

- `@finsavvyai/auth` — 3 files reference this. Exists in `finsavvyai-platform/packages/auth` (resolves once added to workspace) AND in `oss/design-system/auth` (collision; see HANDOFF).

## Files exceeding 200-line cap

97 source files exceed the 200-line cap. Migrated as-is per round-4 convention.

## Cross-product references found

OpenSyber explicitly defines shared types for sibling products:
- `packages/shared/src/types/sdlc.ts` — types contract with SDLC.cc
- `packages/shared/src/types/pipewarden.ts` + `pipewarden.test.ts` — types contract with PipeWarden OSS
- `packages/shared/src/types/agent-run-contract.ts` — agent run schema (cross-product)

These confirm the addendum thesis: SDLC.cc + OpenSyber + PipeWarden form a tight runtime-security/governance triangle. Future work should hoist these shared types to `packages/shared-types/` (where AMLIQ already publishes) to avoid drift.

## Secrets

See `SECRETS_TO_TRIAGE.md` in this directory. Multiple `.env*` files copied from source.

## Notable extras in source not migrated as code

- `~$*.docx` Microsoft Office lock files (5 of them) — harmless byproducts of an open Word session at copy time. Safe to delete.
- `files.zip` at root — opaque archive, did not inspect contents.
- `OpenSyber_*.docx` (strategy, test reports, UX review) — copied verbatim, treat as design context not source.
- `implementation-plan.jsx` at root — looks misnamed (planning doc with JSX extension).
