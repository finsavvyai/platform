# Qestro Migration Notes

## Source

- Path: `/Users/shaharsolomon/dev/projects/portfolio/qestro/`
- Commit SHA at copy time: `78953d52f17e56283a59af41bce58c089b2e2039`
- Last commit timestamp: `2026-05-24T18:34:35+03:00`
- Migration date: 2026-05-25
- Migrated by: QESTRO-LUNAOS agent (round 4)

## Method

`rsync -av` with the standard round-4 exclusions:

```
node_modules/  dist/  build/  coverage/  .git/  .wrangler/  .next/
venv/  vendor/  __pycache__/  *.log  .DS_Store  .pytest_cache/
.coverage  *.egg-info/
```

Git history was NOT preserved.

## Size

- Source (raw, including node_modules etc.): 4.1 GB
- Target (after exclusions): 1.6 GB
- File count after copy: ~32,516 files

## Workspace integration

- The root `products/qestro/package.json` has name `questro-saas` and is
  picked up by the existing `products/*` glob in
  `pnpm-workspace.yaml` — no edit required.
- Qestro ships a nested `packages/` directory with internally-bundled
  `@finsavvyai/*` packages (auth, monitor, llm, ui, pay, cf-stack,
  test-config). These are NOT visible to pnpm at the root because the
  workspace glob is single-level. They remain self-contained inside the
  product, which is intentional for this round (no merge attempted).

## Known issues / broken imports

- Qestro source imports `@finsavvyai/auth`, `@finsavvyai/monitor`,
  `@finsavvyai/llm`, `@finsavvyai/ui` — these are currently satisfied by
  the bundled copies under `products/qestro/packages/`. At some point
  these should reconcile with the canonical packages at
  `/packages/auth`, `/packages/telemetry`, etc. (handed off below).
- Files exceeding the 200-line cap: ~5,087. All are pre-existing
  product code copied as-is per round-4 rule.
- Cross-product references: two files in
  `frontend/src/contexts/OnboardingContext.tsx` and
  `frontend/src/components/onboarding/OnboardingWidget.tsx` mention
  `luna-os dashboard` as a design source. No code dependency, doc-only.

## Workspace package count visible at root

| Path | Package name |
|---|---|
| `products/qestro/` (root) | `questro-saas` |

Nested packages (NOT in root workspace) remain inside Qestro:
`@qestro/api`, `@qestro/mcp-server`, `@qestro/mcp-connectors`,
`@qestro/self-healing`, `qestro-frontend`, `questro-backend`,
`questro-browser-extension`, `qestro-cli`, `qestro-mobile`,
`questro-app-product`, `questro-io-marketing`, `playwright-service`,
and bundled `@finsavvyai/{auth,monitor,llm,ui,pay,cf-stack,test-config}`.
