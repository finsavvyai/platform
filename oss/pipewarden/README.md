# PipeWarden

> Open-source policy engine and rule scanner for CI/CD pipelines.
> The OSS foundation under FinsavvyAI's hosted policy services.

PipeWarden is the **primary OSS asset** of the FinsavvyAI platform per the
consolidation plan (addendum §3). It is the rule engine that backs the hosted
`platform/policy-engine` package and the upstream rule contributions that drive
adoption.

This directory is the monorepo home for PipeWarden as of the round-4
consolidation (May 2026). See `MIGRATION_NOTES.md` for provenance.

## License

**MIT** — see `LICENSE`. This is intentionally permissive to encourage
external rule contributions and integrations.

## Layout

```
oss/pipewarden/
  action/               GitHub Action wrapper
  cmd/                  Go binary entrypoints (pipewarden, pipewarden-server)
  configs/              Default rule configs
  deploy/               Kubernetes + container manifests
  design-system/        Web UI design tokens
  docs/                 Public docs
  functions/            Cloudflare Functions
  internal/             Go internal packages
  rules/                Rule definitions (includes folded-in code-safety-suite)
  scripts/              Release + ops scripts
  tests/                Test fixtures and integration suites
  website/              Marketing site source
  workers/              Cloudflare Workers
  MIGRATION_NOTES.md    Source SHA + exclusions
  CLAUDE.md             Product-level CLAUDE rules
  CLAUDE.legacy.md      Pre-monorepo CLAUDE doc, preserved for reference
  README.md             This file
  README.legacy.md      Pre-monorepo README
  CONTRIBUTING.md       How to contribute new rules and fixes
  LICENSE               MIT
```

## Build

```bash
# CLI scanner
go build -o pipewarden ./cmd/pipewarden

# Long-running server (policy decisions over HTTP)
go build -o pipewarden-server ./cmd/pipewarden-server

# Run tests
go test ./...

# Coverage (portfolio threshold: >=90% lines)
go test -coverprofile=coverage.out ./...
go tool cover -func=coverage.out
```

## Air-gapped builds

The `.goreleaser.airgap.yml` pipeline produces releases that have no
network egress at runtime, for regulated and offline environments.

## Hosted relationship

The hosted policy engine at `packages/policy-engine/` (or its successor at
`platform/policy-engine/`) consumes PipeWarden's rule definitions. Changes
to rule schemas in PipeWarden require coordination with the hosted package
to avoid contract drift.

## Folded-in component

The legacy `code-safety-suite` repo was folded into `rules/` per
addendum §3. See `rules/MIGRATION_NOTES.md` for that fold's provenance.

## Contributing

See `CONTRIBUTING.md`. New rule contributions are the most welcome PRs.

## Rules

This product extends portfolio rules in `/Users/shaharsolomon/dev/projects/CLAUDE.md`
and adds stricter requirements in `./CLAUDE.md`. Both are binding.
