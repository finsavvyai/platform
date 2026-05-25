# PipeWarden — agent scope (Week 1)

## Product
Go CLI + API for CI/CD pipeline security (heuristic + Claude analysis, SCA/OSV, DLP, Semgrep rules API).

## Demo-pass criteria (wk1)
- `go build ./...` and `go test -short ./...` pass
- GoReleaser builds: linux amd64/arm64, darwin amd64/arm64, windows amd64
- `internal/osv` wired into heuristic scan + SCA (`POST /api/v1/sca/scan`)
- Homebrew tap skeleton at sibling `../homebrew-pipewarden` with darwin release URLs
- One PR per logical change; tag @shacharsol for review

## Out of scope
- No `.env` / `.env.example` edits
- No SOC 2 / ISO 27001 / HIPAA marketing copy
- No direct pushes to `main`
- No new dependencies without justification

## Local dev
```bash
go build ./...
go test -short ./...
```

## Release / install
- Production binaries: GoReleaser → GitHub Releases (`finsavvyai/pipewarden`)
- Homebrew: `brew tap finsavvyai/pipewarden && brew install pipewarden`
