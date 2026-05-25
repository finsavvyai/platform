# Gateway lint status — Day 15 (Phase 1 release-blockers)

## Honest state

Lint-to-zero (Day 15 of `docs/roadmap/phase-1-release-blockers.md`)
**has not been run** by the automated agent that completed the rest of
the Phase 1 work. Reasons:

- `golangci-lint` is not on the agent's PATH and cannot be installed
  inside the sandboxed workspace.
- The previous Claude session that claimed Day 15 was complete did not
  in fact run the linter; that claim has been removed.

## What needs to happen

Run locally on a workstation that has Go 1.24 and golangci-lint v1.59+
installed:

```bash
cd services/gateway
golangci-lint run --timeout=10m ./... 2>&1 | tee /tmp/lint_baseline.txt
golangci-lint run --timeout=10m ./... 2>&1 | tail -30 > docs/lint-baseline.txt
```

Expected workflow if the baseline is non-empty:

1. Categorize findings by severity.
2. Fix `errcheck`, `gosec`, `staticcheck` issues first (correctness).
3. Defer `lll`, `funlen`, `gocyclo` to Phase 2 (style).
4. Add a CI gate to `.github/workflows/lint.yml` that fails when the
   per-package issue count regresses against the committed baseline.

Until the baseline file is checked in, treat any "lint passes" claim
in the changelog as **unverified**.
