# Contributing to PushCI

Thanks for your interest in contributing to PushCI! We welcome contributions of all sizes.

## Quick Start

```bash
git clone https://github.com/finsavvyai/pushci
cd pushci

# CLI (Go)
go build ./cmd/pushci/
./pushci --version

# API (Cloudflare Workers)
cd api && npm install && npx wrangler dev

# Dashboard (React)
cd web/dashboard && npm install && npm run dev

# Landing (React)
cd web/landing && npm install && npm run dev
```

## What to Contribute

### Good First Issues
- Add a new skill to the marketplace (`api/src/skills.ts`)
- Add a new framework detector (`internal/detect/`)
- Add a new deploy target (`internal/deploy/`)
- Improve error messages in the CLI
- Add tests for existing functionality

### Medium Complexity
- New comparison page (vs another CI tool)
- Dashboard component improvements
- New CLI command
- MCP tool addition

### Advanced
- New runner provider integration
- Security scanner integration
- AI model integration

## Code Standards

- **Go files**: `go vet`, `go test -race`, max 200 lines per file
- **TypeScript**: strict mode, ESLint, max 200 lines per file
- **Tests**: every bug fix needs a failing test first
- **Commits**: conventional commits (`feat:`, `fix:`, `docs:`)
- **PRs**: include test plan, keep under 400 lines changed

## Architecture

```
cmd/pushci/       — CLI commands (Go)
internal/         — Core packages (Go)
api/src/          — Cloudflare Workers API (TypeScript)
web/dashboard/    — React dashboard (TypeScript)
web/landing/      — Marketing site (TypeScript)
```

## CI checks you'll see on PRs

Every pull request runs the following jobs (defined in
`.github/workflows/ci.yml`). All must pass before merge.

- **pushci** — Go CLI: `go build`, `go vet`, golangci-lint, gosec,
  govulncheck, gitleaks, license compliance, full pipeline run,
  ≥90% coverage gate.
- **mobile** — Expo app: `tsc --noEmit`, Maestro flow `--dry-run`
  lint against `.maestro/*.yaml`. Maestro artifacts uploaded on
  failure. (Note: emulator-based Maestro execution is not yet
  wired into CI; lint validates flow YAML syntax only.)
- **api** — Cloudflare Workers: `vitest run --coverage` with
  thresholds ≥90% line / ≥85% branch / ≥90% function / ≥90%
  statement (`api/vitest.config.ts`). Coverage report uploaded.
- **rust** — `agent-platform/` Cargo workspace: `cargo fmt --check`,
  `cargo clippy --workspace --all-targets -- -D warnings`,
  `cargo test --workspace`. Toolchain pinned via
  `agent-platform/rust-toolchain.toml`.

All four jobs run in parallel — total wall-clock time on a PR
is the slowest single job, not the sum.

## Community

- GitHub Discussions: https://github.com/finsavvyai/pushci/discussions
- Issues: https://github.com/finsavvyai/pushci/issues

## License

BUSL-1.1 — see LICENSE file.
