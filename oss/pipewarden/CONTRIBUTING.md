# Contributing to PipeWarden

PipeWarden is open-source under the MIT license. Contributions are
welcome — particularly new rule definitions and rule-engine bug fixes.

## Quick checklist

Before opening a PR:

- [ ] Tests added or updated. No PR is merged without a test.
- [ ] `go test ./...` passes locally.
- [ ] `go vet ./...` clean.
- [ ] Linter clean (project uses `golangci-lint`; config in
      `.golangci.yml` if present).
- [ ] If you added a new rule: include a positive **and** negative fixture
      under `rules/` and update the rule index doc.
- [ ] No new dependency that is not MIT-compatible.
- [ ] Coverage did not regress for `internal/policy/`.

## Running the test suite

```bash
# Unit + table-driven tests
go test ./...

# With race detector (CI runs this)
go test -race ./...

# Coverage report
go test -coverprofile=coverage.out ./...
go tool cover -func=coverage.out

# Server integration smoke (requires Docker)
make test-integration
```

If `make` targets are missing, the underlying commands are documented in
`scripts/`.

## Code style

- Go: standard `gofmt` + `goimports`. CI rejects unformatted code.
- Filenames: `lowercase_with_underscores.go`.
- Package names: short, lowercase, no underscores.
- Errors: wrap with `fmt.Errorf("context: %w", err)`. Never swallow.
- Constants for stable error identifiers used by clients.
- 200-line max per file. Split by responsibility if approaching the cap.

## Writing a new rule

1. Add the rule definition under `rules/<category>/<name>.yml` (or
   the language used by the rule loader; see `internal/rules/loader.go`).
2. Add a positive fixture: `rules/<category>/fixtures/<name>_match.*`.
3. Add a negative fixture: `rules/<category>/fixtures/<name>_no_match.*`.
4. Add a Go test in `internal/policy/<category>_test.go` exercising
   both fixtures.
5. Update `docs/rules.md` with the rule ID, what it catches, and the
   recommended remediation.

## PR process

1. Fork the repo or branch from `main`.
2. Open a PR against `main` with a description that explains the **why**,
   not just the **what**.
3. Ensure CI is green. Required checks: `typecheck`, `test`, `coverage`,
   `audit`, `secret-scan` (mesh contract — round-3 conventions).
4. A maintainer will review within 5 business days for non-trivial PRs.
5. Squash-merge is the default. Keep the commit message conventional:
   `<type>(<scope>): <subject>` (e.g. `feat(rules): add k8s privileged
   container rule`).

## Reporting bugs

- Open an issue with a minimal reproduction.
- For security vulnerabilities: email `security@finsavvyai.com` instead
  of opening a public issue. We aim to respond within 5 business days.

## Contributor License Agreement (CLA)

**Placeholder.** PipeWarden does **not** currently require a CLA. If a
CLA becomes required for hosted-product integration, this section will
be updated and existing contributors will be notified before any
enforcement begins. By submitting a PR today, you affirm that you have
the right to license your contribution under the MIT license.

## Code of Conduct

Be respectful. Disagree on technical merit, not on people. Maintainers
have final discretion on PR acceptance.

## Questions

Open a discussion in the repo or ask in the `#pipewarden` channel of the
FinsavvyAI Discord (link in main `README.md`).
