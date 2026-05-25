# Contributing

Thanks for considering a contribution.

## Ground rules

- **200-line file cap.** Split by responsibility before you exceed it.
- **No new dependencies** without justification in the PR description. We aim to stay close to the Go stdlib + chi + go-redis + logrus + uuid.
- **Tests required.** Every change ships a test. We use `miniredis` for Redis-backed code, so `go test ./...` runs without external services.
- **Coverage gate.** ≥80% line. Critical paths (rate limit, fingerprint, SCIM) target 100%.
- **`go vet ./...` clean.** `golangci-lint run` passes.

## Workflow

```bash
git clone https://github.com/finsavvyai/sdlc-gateway && cd sdlc-gateway
go mod download
go test ./...
```

Open a PR with a one-paragraph description of what changed and why.

## Issue triage

- **Bug**: provide a minimal reproduction, include `go version` and OS.
- **Feature request**: describe the use case before the API. We'd rather discuss the shape upfront than rewrite the PR three times.
- **Security**: do **not** open a public issue. Email security@sdlc.cc.

## License

By contributing you agree your work is licensed under Apache-2.0 (the same license as the project).
