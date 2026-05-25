# Sprint status — Week 1 (pipewarden)

**Run date:** 2026-05-19  
**Last verified:** 2026-05-20

| Task | Status | Notes |
|------|--------|-------|
| Fix `src/auth/jwt.ts` TS2769 | N/A | PipeWarden is Go-only; session JWT in `internal/auth/sessions.go` |
| GoReleaser darwin + windows targets | Done | On `main`: linux/darwin/windows archives + zig in `release.yml` |
| Homebrew tap skeleton | Done | https://github.com/finsavvyai/homebrew-pipewarden |
| Wire `internal/osv` into scan pipeline | Done (merged) | PR #20 merged to `main` |
| Website viewz-tier polish | Done (merged) | PR #21 merged to `main` |
| `go build ./...` + `go test -short ./...` | Pass | Re-verified on `main` and `agent1/wk1-website-viewz-polish` |

## PRs
- https://github.com/finsavvyai/pipewarden/pull/20 — merged (`[wk1] Wire OSV client into heuristic and SCA scan pipeline`)
- https://github.com/finsavvyai/pipewarden/pull/21 — merged (`[wk1] viewz-tier polish for marketing site`)
- https://github.com/finsavvyai/homebrew-pipewarden — tap skeleton on `main`

## CI blocker (not code)
GitHub Actions jobs fail immediately: *"recent account payments have failed or spending limit needs to be increased"*. Local `golangci-lint run ./...`, `make test`, and `make build` all pass.

## Reviewer
@shacharsol
