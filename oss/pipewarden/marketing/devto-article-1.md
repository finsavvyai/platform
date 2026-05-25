# How I Built a CI/CD Pipeline Security Scanner in Go

*Tags: #security #go #devops #cicd*

---

Last year, I watched a friend's company get hit by a supply chain attack. The attacker never touched a single line of application code. They compromised a GitHub Actions workflow — specifically a third-party action pinned to a floating `@latest` tag — and used the pipeline's write access to exfiltrate AWS credentials during a production deploy.

Every SAST tool they had installed came back clean. No vulnerable code. No CVEs in the application. The pipeline just... did something it wasn't supposed to do.

That's the gap I built [PipeWarden](https://github.com/finsavvyai/pipewarden) to close.

## The Threat Model: Pipelines Do Things Code Doesn't

When you think about application security, you think about code: SQL injection, XSS, unpatched dependencies. The tools are good at this. Snyk, Semgrep, Dependabot — they all scan what's in your repository.

But your CI/CD pipeline has capabilities your application code doesn't:

- **Write access to your repository** (push to main, create releases)
- **Access to production secrets** (AWS keys, deployment tokens, signing certificates)
- **Network access** to internal systems (staging databases, internal APIs)
- **Trusted execution context** (pipeline runs are often excluded from rate limits and security controls)

The SolarWinds attack compromised the build server. The Codecov breach injected a malicious bash uploader via CI. The 3CX supply chain attack started with a poisoned dependency pulled during a pipeline build.

In all three cases: clean source code, compromised pipeline.

## Architecture Decisions

Before writing code, I needed to answer a few design questions.

### Why Go?

The Jenkins use case sold it. PipeWarden needs to run as a sidecar in Jenkins — a binary that executes after a build, calls the PipeWarden API, and exits with code 0/1/2 for pass/findings/error. That means:

- Single static binary, no runtime dependencies
- Cross-compile for linux/amd64, darwin/arm64, windows/amd64 in one `goreleaser` command
- Low memory footprint in a constrained Jenkins agent

Go also made the provider interface pattern clean in a way that was harder with other options I considered.

### The Provider Interface

The core design challenge: 6 different CI/CD platforms (GitHub Actions, GitLab CI, Bitbucket Pipelines, Jenkins, Azure DevOps, CircleCI) that all expose fundamentally the same information — pipelines, runs, steps, status — through completely different APIs.

```go
type Provider interface {
    TestConnection(ctx context.Context) error
    ListPipelines(ctx context.Context) ([]Pipeline, error)
    GetPipelineRun(ctx context.Context, runID string) (*Run, error)
    ListPipelineRuns(ctx context.Context, pipelineID string) ([]Run, error)
    TriggerPipeline(ctx context.Context, pipelineID string) error
}
```

Each platform is ~280 lines plus tests. Adding CircleCI (the sixth platform) was about 4 hours of work: implement the interface, write `httptest` mocks, register in the `buildProvider` factory. Zero changes to analysis, routing, or storage.

The analysis pipeline doesn't know which CI/CD platform produced a finding. It just receives a `Run` with steps and logs.

### The Analysis Pipeline

Findings flow through four stages:

```
Pipeline Run
     │
     ▼
1. Heuristic Analyzer    ← fast, zero external calls, runs always
     │
     ▼
2. DLP Scanner           ← regex pattern matching (13 patterns)
     │                     + live validity checking
     ▼
3. SCA Scanner           ← OSV.dev batch API (no API key)
     │
     ▼
4. SAST (Semgrep)        ← optional, graceful degradation
     │
     ▼
5. Claude AI             ← optional, expensive, only for high/critical
     │
     ▼
Findings → SIEM routing
```

Heuristic runs first because it's free and fast — it catches the obvious stuff (missing required checks, floating action pins, too-broad permissions) without any network calls. DLP runs second. SCA and SAST are parallel. Claude runs last, only when something critical warrants the API cost.

## The Hardest Part: Live Secret Validity Checking

Pattern-matching on secrets produces false positives. A lot of them. Rotated tokens that weren't removed from old files. Example tokens in documentation. Test fixtures.

What actually matters is whether a found token is *currently active*.

So after the DLP scanner finds a match, the validator calls the actual API:

```go
func (v *SecretValidator) validateAWSKey(ctx context.Context, secret string) *ValidateResult {
    // Parse "AKIAIOSFODNN7EXAMPLE:wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
    parts := strings.SplitN(secret, ":", 2)
    // ...
    // Call AWS STS GetCallerIdentity with a temporary credential
    // If 200: ValidityActive, with the account/ARN as Identity
    // If 403: ValidityInvalid (key exists but no permissions)
    // If network error: ValidityUnknown (don't fail the scan)
}
```

For GitHub tokens: `GET /user` with `Authorization: Bearer <token>`.
For GitLab tokens: `GET /api/v4/user`.
For Slack tokens: `POST slack.com/api/auth.test`.
For JWTs: parse the `exp` claim, check if it's past `time.Now()`.

The result upgrades the finding's confidence score. A DLP match alone is `Confidence: 0.7`. A DLP match with a confirmed-active AWS key is `Confidence: 1.0` and goes straight to PagerDuty.

The implementation detail that matters: all validation calls use a short timeout (5 seconds) and the validator returns `ValidityUnknown` on any error. You never want a network blip to block a scan.

## OPA-Style Policy Engine in 200 Lines

I wanted policy rules that teams could extend without modifying core code. The structure:

```go
type Policy struct {
    ID          string
    Name        string
    Description string
    Severity    Severity
    Evaluate    func(run *Run) *PolicyViolation
}
```

Default policies ship with PipeWarden:

- `require-tests` — pipeline must have a test step
- `no-secrets-in-env` — env vars must not match secret patterns
- `pin-actions-to-hash` — `uses: actions/checkout@v4` is rejected, requires SHA
- `require-sast` — at least one SAST step (Semgrep, CodeQL, etc.) must be present
- `restrict-write-permissions` — `permissions: write-all` is flagged
- `require-branch-protection` — no direct pushes to main
- `scan-dependencies` — dependency install steps must have integrity checks
- `no-curl-bash` — `curl ... | bash` patterns in run steps are flagged

Custom policies are a Go function that takes a `*Run` and returns a `*PolicyViolation`. Teams can register them at startup. No DSL, no YAML policy language — just Go functions.

## SQLite in Dev, Postgres in Production

This was a deliberate decision, not laziness. PipeWarden's development experience is `go run cmd/pipewarden/main.go` — no Docker, no database setup, no migrations to run manually. SQLite handles everything.

In production (Railway, Render, Fly.io), the `DATABASE_URL` env var points to Postgres and the connection pool gets proper defaults:

```go
func NewFromConfig(cfg Config) (*DB, error) {
    if resolveDriver(cfg) == EnginePostgres {
        if cfg.MaxOpenConns == 0 { cfg.MaxOpenConns = 25 }
        if cfg.MaxIdleConns == 0 { cfg.MaxIdleConns = 5 }
        if cfg.ConnMaxLifetime == 0 { cfg.ConnMaxLifetime = 5 * time.Minute }
    }
    return Open(cfg)
}
```

Same schema, same queries. The `storage.DB` abstraction doesn't know which engine it's talking to — it just runs SQL that works on both.

## Credential Vault: AES-256-GCM

Every CI/CD provider connection stores a token. Those tokens go in a vault encrypted with AES-256-GCM:

```go
// Encrypt uses AES-256-GCM with a random nonce prepended to the ciphertext.
// Format: [12-byte nonce][ciphertext]
func (v *Vault) Encrypt(plaintext string) (string, error) {
    nonce := make([]byte, gcm.NonceSize())
    if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
        return "", err
    }
    ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
    return base64.StdEncoding.EncodeToString(ciphertext), nil
}
```

The vault key is set via `PIPEWARDEN_VAULT_KEY` — 32 random bytes, base64 encoded. If it's not set, the vault is disabled and any attempt to persist a connection returns an error. You can't accidentally store plaintext tokens.

## What I'd Do Differently

**More integration tests, fewer unit tests**. I have 491 test functions, mostly unit tests with `httptest` mocks. They pass. But what they don't catch is the interaction between the GitHub rate limiter behavior and the connection pool, or what happens when a GitLab instance returns pagination headers in a format I didn't anticipate. More real-API tests with mock servers that behave badly would have caught several bugs earlier.

**Start with PostgreSQL**. The SQLite-in-dev path is great for DX, but the SQLite→Postgres migration required more careful attention to query compatibility than I expected. Type handling is different (`RETURNING` clause behavior, `bool` storage, JSON columns). I'd still offer both, but I'd develop against Postgres and treat SQLite as a compatibility target, not the other way around.

**SARIF output from the start**. SARIF 2.1.0 is the right output format — GitHub, GitLab, Azure DevOps all import it natively. I added it in phase 2 and had to carefully map my internal `Finding` type to the SARIF schema. If I'd designed `Finding` with SARIF in mind from day one, the export would have been cleaner.

## Try It

```bash
# Single binary
go install github.com/finsavvyai/pipewarden/cmd/pipewarden@latest
pipewarden --db pipewarden.db

# Docker
docker run -p 8080:8080 -e PIPEWARDEN_VAULT_KEY=$(openssl rand -base64 32) \
  ghcr.io/finsavvyai/pipewarden:latest

# Dashboard at http://localhost:8080
```

Free tier: 1 connection, 10 scans/month, heuristic analysis only.

Source: [github.com/finsavvyai/pipewarden](https://github.com/finsavvyai/pipewarden)
Demo: [pipewarden.com](https://pipewarden.com)

---

*Questions about the architecture or threat model? Drop them in the comments. I read everything.*
