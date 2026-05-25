# PushCI

> AI-native CI/CD that runs on your machine. Zero config, zero cost.
> Works inside AI agent sandboxes (Claude, Cursor, Windsurf).

PushCI is the **primary developer-adoption wedge** for the FinsavvyAI
platform. Developers install it to get hosted-CI parity locally; the
upgrade path leads into the rest of the platform — Qestro for runtime
QA, OpenSyber for runtime AI security, SDLC.cc for governance.

This directory is the monorepo home for PushCI as of the round-4
consolidation (May 2026). See `MIGRATION_NOTES.md` for provenance.

## Positioning (per consolidation plan §3)

| Layer | Component | Role |
|---|---|---|
| Free / adoption | **PushCI CLI** | Local CI/CD, zero-cost, Tailscale mesh |
| Upgrade path 1 | Qestro | Runtime QA on top of PushCI run output |
| Upgrade path 2 | OpenSyber | Runtime AI security for the same pipelines |
| Upgrade path 3 | SDLC.cc | Governance + policy across PushCI fleets |

The CLI MUST NOT degrade the local experience to force upgrades. Cross-sells
surface as opt-in commands, never as mandatory steps.

## Layout

```
products/pushci/
  agent-platform/       Rust agent runtime (binary excludes target/)
  api/                  Cloudflare Worker (SaaS upgrade path)
  bin/                  Pre-built CLI binaries (npm-distributed)
  cmd/pushci/           Go CLI entrypoint
  docs/                 Public docs
  extensions/           VSCode + Cursor extensions
  Formula/              Homebrew tap formula
  internal/             Go internal packages
  mobile/               Expo control surface (no job execution)
  web/dashboard/        Authenticated dashboard (Vite + React)
  web/landing/          push-ci.dev marketing site
  website/POINTER.md    Note: push-ci.dev is a symlink alias to pushci
  workers/              Cloudflare worker scripts
  MIGRATION_NOTES.md    Source SHA + exclusions + known issues
  CLAUDE.md             Product-level CLAUDE rules (extends portfolio)
  CLAUDE.legacy.md      Pre-monorepo CLAUDE doc, preserved for reference
  README.md             This file
  README.npm.md         User-facing npm package README
```

## Quickstart (CLI users)

See `README.npm.md` — it is the user-facing README that ships in the
published npm package. The instructions below are for monorepo
contributors.

## Monorepo developer commands

```bash
# Build the Go CLI for the current host
go build -o pushci ./cmd/pushci

# Run unit tests
go test ./...

# Run E2E tests (requires Playwright)
cd e2e && pnpm install && pnpm test

# Build the landing site
cd web/landing && pnpm install && pnpm build

# Build the dashboard
cd web/dashboard && pnpm install && pnpm build

# Build the API worker
cd api && pnpm install && pnpm test
```

## Workspace integration

PushCI is **not** in the root `pnpm-workspace.yaml`. None of its TS
subpackages currently import `@finsavvyai/*` workspace packages. If a
future change adds such a dep, the relevant subpackage must be added to
the workspace and that decision documented in `MIGRATION_NOTES.md` under
a "NEW WORKSPACE PACKAGES" heading.

Future integration opportunities (do not silently wire):

- `api/` could consume `@finsavvyai/auth` for token verification
- `api/` could consume `@finsavvyai/billing` for entitlement checks
- `api/` could consume `@finsavvyai/telemetry` for analytics events
- `web/dashboard/` could consume `@finsavvyai/auth` for session UX

## Rules

This product extends portfolio rules in `/Users/shaharsolomon/dev/projects/CLAUDE.md`
and adds stricter requirements in `./CLAUDE.md`. Both are binding.

## License

Business Source License 1.1. See `LICENSE`.
