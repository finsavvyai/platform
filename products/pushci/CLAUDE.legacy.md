# CLAUDE.md — PushCI.dev

## What This Is

**PushCI.dev** = AI-native CI/CD platform.
"The operating system for developer pipelines,
powered by your own infrastructure + AI."

Domain: pushci.dev (purchased)
Repo: github.com/finsavvyai/pushci
Parent: github.com/finsavvyai/amliq (in runlocal/)

## Why It Exists

GitHub Actions: $0.008/min, 50-line YAML, platform lock-in.
PushCI: $0 (your machine), zero config, works everywhere.
CI/CD market: $8-14B, growing 15-20%/yr. No competitor
combines AI + zero config + multi-platform + free compute.

## Product Stats (v1.7.5, May 2026 — verified counts, no estimates)

All numbers below are produced by direct grep / wc / jq against the
working tree. If you find a discrepancy, update CLAUDE.md in the same
PR and cite the verifying command — do not paper over.

### CLI (Go 1.22)

- **36 internal packages** under `internal/` — actions, agents, ai,
  artifacts, autofix, cache, cli, cloud, config, debug, deploy,
  detect, entitlement, gitops, heal, integrate, intel, mcp,
  middleware, migrate, nlp, notify, observe, pipeline, platform,
  plugin, preview, promote, rbac, runner, secrets, security, server,
  skill, templates, updater
- **196 `cmd_*.go` files** in `cmd/pushci/` covering **31 top-level
  command verbs**: actions, ai, cli, deploy, doctor, extend, flag,
  flags, heal, import, index, init, install, intel, login, migrate,
  plan, promote, register, release, report, run, scan, secrets,
  skill, tools, trace, trigger, troubleshoot, uninstall, voice
- **~36,723 LOC** of non-test Go (`find cmd internal -name '*.go'
  ! -name '*_test.go' | xargs wc -l`)
- **225 Go test files** under `cmd/` + `internal/`

### Stack & framework detection

- **35 language `Stack` constants** in `internal/detect/stack.go`
  (Bicep, Bun, Cabal, Cargo, Clojure, CMake, Composer, Cpanm, Cpp,
  Crystal, CSharp, Dart, Deno, Docker, Dotnet, Dune, Elixir, Erlang,
  Fortran, Foundry, Fpm, Gleam, Go, Gradle, Hardhat, Haskell, Helm,
  Java, Julia, Kotlin, Lein, Lua, Luarocks, Make, Maven, Mix, Nim,
  Nimble, Node, Npm, OCaml, Perl, Php, Pip, Pnpm, Poetry, Python,
  R, Ruby, Rust, Sbt, Scala, Shards, Solidity, Stack, Swift,
  Terraform, Vlang, Yarn, Zig — note: list mixes language and
  build-tool aliases by design)
- **33 `BuildTool` constants** in `internal/detect/` —
  maven, gradle, npm, pnpm, yarn, bun, pip, poetry, cargo, dotnet,
  bundler, composer, mix, cmake, make, sbt, stack, cabal, luarocks,
  cpanm, dune, nimble, shards, rebar3, helm, foundry, hardhat, fpm,
  clj, lein (subset shown — full list via grep `BuildTool = "`)
- **39 framework returns** across `internal/detect/framework_*.go`:
  actix, airflow, android, angular, aspnetcore, axum, blazor,
  celery, chi, cra, django, echo, electron, elysia, expo, fastapi,
  fiber, flask, gin, hono, kotlin, laravel, leptos, micronaut, ml,
  play, quarkus, rails, rocket, scrapy, sinatra, spring-boot,
  streamlit, symfony, t3, tauri, templ, vite, vue

### Deploy targets — 22 wired drivers

`internal/deploy/deploy.go` `var drivers` map (anti-bluff: count
verified by grep; orphan-detection test enforces every declared
`Target*` constant has a driver entry):

CloudflarePages, CloudflareWorkers, AWSECS, AWSLambda, AWSS3,
GCPCloudRun, GCPAppEngine, AzureAppService, AzureFunctions, Bicep,
Docker, K8s, Vercel, Railway, Fly, Render, Netlify, SSH, Terraform,
CloudFormation, Pulumi, Ansible.

### AI providers (7 paths)

`internal/ai/` — auto-selected by env-var presence in this priority
order (latency-first, see `client.go`): Groq → Anthropic Claude →
DeepSeek → OpenAI → Gemini/Google. Plus local llamafile lifecycle
(`llamafile_*.go`) and PushCI proxy (`claw_client.go`). Override via
`PUSHCI_AI_PROVIDER`. Model IDs centralized in `internal/ai/claude.go`
(`DefaultAnthropicModel`) and `api/src/ai-model.ts`.

### API (Cloudflare Workers + Hono + D1 + KV)

- **235 .ts files** in `api/src/`
- **81 `app.route()` mounts** in `api/src/index.ts` covering auth,
  user, billing, AI, cloud, NLP, autofix, pipeline, audit,
  governance, SSO, SAML, SCIM (`/scim/v2` + `/api/scim/v2` alias),
  artifacts, workspaces, skills, channels, logs, remediate,
  recommend, promote, builds, widgets, register, stats, settings
- **14 D1 migrations** in `api/migrations/` (governance, runner
  control plane, channels, billing, team, telemetry, plans,
  feature usage, MFA + audit chain, Paddle, user email, skills)
- **~27,683 LOC** non-test TS (`find api/src -name '*.ts'
  ! -name '*.test.ts' | xargs wc -l`); **61 .test.ts files**

### CI bridges — 7 imports + live-poll wired

Each has importer + (where applicable) live status bridge:
**AWS CodePipeline, Azure DevOps, Bitbucket, CircleCI, Gerrit,
GitLab, Jenkins**. Gerrit ships REST poll + Verified label
writeback (`gerrit-poll.ts`, `gerrit-callback.ts`,
`gerrit-webhook.ts`).

### Channel bridges — 5 platforms

`api/src/channel-*.ts` + `internal/nlp/`: **Slack, Discord,
WhatsApp, Telegram** are NLP-parsed inbound bridges (handlers in
`channel-parsers.ts`). **Email** is outbound notify + connector
type only — not inbound NLP-parsed. Dispatch via
`channel-dispatch.ts`, SSRF-guarded fetch in `bridge-url-guard.ts`.

### Enterprise surface (27 files)

SAML, SCIM, MFA, RBAC, audit chain (`audit-immutable.ts`,
`audit-siem.ts`), governance routes, DORA tenant scoping,
enterprise identity, enterprise dashboard.

### Web

- **Dashboard** (`web/dashboard/`): **29 page .tsx files**,
  **128 components**, ~16,469 TSX LOC. Pages: Overview, Runs,
  RunDetail, Projects, ProjectEnvironments, Runners, Channels,
  Artifacts, Analytics, AuditLog, Achievements, Billing, Team,
  Settings, Login, AuthCallback, CliAuth, MfaEnrollment, SsoSetup,
  SkillMarket, Chat, EnterpriseDashboard, MigrationWizard, Gerrit,
  CompanyRegistries, GitHubActionsImporter, GitLabImporter,
  BitbucketImporter, NotFound.
- **Landing** (`web/landing/`): **30 .tsx pages**, **43 components**.
  Pages include Product, Pricing, Enterprise, Compliance,
  Developers, AI Integration, Cost Calculator, Curb Your CI, Local
  Release, Norlys Pilot, Docs (multi-section), Contact, Privacy,
  NotFound.

### Mobile (Expo SDK)

`mobile/` — React Native + Expo. **6 screens** (Login, Projects,
Runs, Billing, Settings, Skills) plus components/hooks/navigation
under `mobile/src/`. Maestro test config, iOS prebuild artifacts.
Connects to the same Workers API.

### VS Code extension

`extensions/vscode/` — publisher `finsavvyai`, activates on
`pushci.yml`. **4 commands** (run, status, logs, init), sidebar
tree view (`pushci.runs`).

### Plugin system

`internal/plugin/` — built-in checks (`builtin.go`,
`builtin_ext.go`), Docker (`docker.go`), file-size cap
(`filesize.go`), shell-script plugin host (`script.go`), tenant
isolation (`tenantiq.go`).

### Embedded GitHub Actions runtime

`internal/actions/` — wraps `nektos/act`. Supports
`actions/checkout@v4`, `setup-node@v4`, `cache@v4`, matrix builds,
cross-job `needs.<job>.outputs.<name>`, composite actions, masked
secret injection, service containers (postgres/redis), dry-run.
Apple-Silicon auto-flag for `linux/amd64`.

### Security & scanning

`internal/security/` — `pipeline_scanner.go` + extended scanners
(supply, risk, ext), policy engine (`policy.go`),
`scanner_patterns.go`. SARIF 2.1.0 export. PipeWarden engine
hooks (`pushci scan --engine claude|heuristic`). Auth-related:
secrets store with AES-256-GCM (`internal/secrets/crypto.go`).

### MCP server

`internal/mcp/` — stdio + remote handlers, doctor, extended tools,
promote, recommend, scan tool, server. Exposes pipeline ops to
Claude in Chrome / VS Code.

### Agent platform (Rust workspace)

`agent-platform/` — separate Cargo workspace, **4 crates**:
`runtime`, `server`, `toolpack-pushci`, `tools`. Shared agent
runtime intended to host PushCI as the first tenant, with
OpenSyber and other internal products as planned tenants. Not
the place for PushCI control-plane logic; strictly the
conversation runtime, tool registry, session/streaming API,
toolpack loading, and multi-tenant policy boundaries.

### File-size guarantees

- Go source files **≤100 lines** (CI-enforced in
  `.github/workflows/ci.yml`)
- Everything else **≤200 lines** (portfolio CLAUDE.md rule)

### Distribution

- npm (`pushci`, self-contained tarball with 6 platform binaries
  via `prepack` hook — see Release section below)
- Homebrew tap (`finsavvyai/homebrew-tap`)
- curl installer (downloads from public `finsavvyai/pushci-cli`
  release assets)
- npx (one-shot)
- VS Code Marketplace (extension)

## Architecture

```
Developer → npx pushci init → detects stack
         → git push → pre-push hook runs tests
         → webhook → PushCI API (CF Workers)
         → dispatches to runner (local or cloud)
         → posts status to GitHub/GitLab/Bitbucket
         → dashboard shows results

WhatsApp/Slack/Discord/Telegram
         → webhook → Channel Bridge (CF Workers)
         → NLP parse → agent/Claude Haiku
         → dispatch response back to platform
```

```
┌─ CF Workers API (Hono + D1 + KV) ──────────┐
│  Webhooks │ Auth │ Runs │ AI │ Billing       │
├─────────────────────────────────────────────┤
│  Runner Fleet (self-hosted or managed)       │
│  Local │ Hetzner VPS │ Fly.io │ Docker       │
├─────────────────────────────────────────────┤
│  Claude AI (Haiku) │ MCP Server │ NLP        │
└─────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Tech |
|-------|------|
| CLI | Go 1.22 — 31 verb commands across 196 cmd_*.go files, 36 internal/ packages |
| API | Cloudflare Workers + Hono + D1 + KV — 235 .ts files, 81 route mounts, 14 D1 migrations |
| Landing | React 18 + Vite + Tailwind — 30 pages, 43 components |
| Dashboard | React 18 + Vite + Tailwind — 29 pages, 128 components |
| Mobile | React Native + Expo SDK 52 (iOS + Android) — 6 screens |
| AI | 7 providers: Anthropic Claude, Groq, DeepSeek, OpenAI, Gemini, local llamafile, PushCI proxy. Auto-routed by env var, latency-first. |
| Actions runtime | nektos/act embedded via `internal/actions/` — runs unmodified `.github/workflows/*.yml` end-to-end |
| Billing | Lemon Squeezy (live, merchant of record). Paddle (`billing-paddle.ts` + `2026-04-22_paddle.sql` migration) drafted but not wired into `index.ts` — verify before claiming dual-provider to customers |
| Secrets | AES-256-GCM machine-bound keys; HashiCorp Vault AppRole adapter + `vault://` env resolver (shipped v1.7.5, S3.6) |
| Auth | OAuth: GitHub, GitLab, Google, Microsoft, LinkedIn + JWT. Enterprise: SAML, SCIM, MFA |
| CI bridges | 7 importers + live polls: Jenkins, GitLab, Bitbucket, CircleCI, AWS CodePipeline, Azure DevOps, Gerrit (with Verified label writeback) |
| Channels | 4 inbound NLP-parsed bridges (Slack, Discord, WhatsApp, Telegram) + Email outbound notify — SSRF-guarded |
| Hosting | Cloudflare Pages + Workers |
| Distribution | npm (self-contained tarball), Homebrew tap, curl installer, npx, VS Code Marketplace (`go install` + Docker removed in v1.4.4 dual-repo split) |
| VS Code | Extension publisher `finsavvyai`, 4 commands (run/status/logs/init), sidebar tree view |
| Agent platform | `agent-platform/` Rust workspace, 4 crates (runtime, server, toolpack-pushci, tools) |

## Brand Voice & Viral Share Messages

When writing viral share messages, social copy, or marketing text
for PushCI, follow the **Curb Your Enthusiasm** tone:

- **Petty frustration** about absurd industry norms (paying per minute,
  writing 50 lines of YAML to run `npm test`, vendor lock-in)
- **Escalating indignation** — start calm, build to "what are we DOING here?"
- **Conversational rants** — talk directly at the reader like you're
  complaining to a friend at dinner
- **Deadpan disbelief** — "So you're telling me..." / "Let me get this straight..."
- **Awkward social moments** — the coworker stare, the DevOps guy going quiet,
  the intern who doesn't understand why there's no config
- Always end with `pushci.dev`
- Never use hashtags, emojis, or corporate speak
- Keep it under 280 characters when possible (tweet-friendly)
- The humor comes from the TRUTH — real developer pain, real pricing absurdity

See `web/landing/src/components/ViralShare.tsx` for the full message bank
and `web/landing/src/components/CurbShare.tsx` for the Curb-only variant.

### Examples of good messages:
- "So I'm looking at our GitHub Actions bill and I go — wait.
  We're paying... to LINT? We're paying someone to run eslint?"
- "Let me get this straight. You WROTE a config file. To TELL a computer.
  To run a TEST. That YOUR computer could run. For FREE."
- "I told my DevOps guy about PushCI. He said 'that can't be real.'
  I ran it. He watched. Long silence. 'Well this is embarrassing.'"

## Cross-Project Integration: PipeWarden

PushCI v1.2+ includes **pipeline security scanning** powered by **PipeWarden** — the DevSecOps orchestrator.

### New Commands & Features

#### `pushci scan`
Scans your pipeline for security vulnerabilities without running builds.

```bash
pushci scan                          # Scan all pipelines
pushci scan --repo myorg/myrepo      # Scan specific repo
pushci scan --engine heuristic       # Use rule-based scanner (fast)
pushci scan --engine claude          # Use Claude AI analyzer (comprehensive)
pushci scan --export sarif           # Export as SARIF 2.1.0 for GitHub Security
pushci scan --export json            # Export findings as JSON
```

#### `pushci run --security`
Runs your pipeline with security analysis enabled.

```bash
pushci run --security                # Run + scan + show findings inline
pushci run --security --fail-on=high # Fail if high-severity findings found
```

### MCP Tool: `pushci_scan`

AI agents and Claude in Chrome can invoke security scans directly:

```javascript
// Example: Claude agent scanning a pipeline
const result = await agent.invokeTool('pushci_scan', {
  repo: 'myorg/myrepo',
  engine: 'claude',  // AI-powered analysis
  failOnSeverity: 'high'
});

// Returns: { findings, riskScore, recommendations }
```

### Findings Format

All scans return structured findings:

```json
{
  "repo": "myorg/myrepo",
  "riskScore": 67,
  "findings": [
    {
      "id": "STEP_SEC_001",
      "severity": "high",
      "category": "step_security",
      "message": "Untrusted action step detected",
      "path": ".github/workflows/ci.yml:45",
      "remediation": "Pin action version and review permissions"
    }
  ],
  "sarif": { ... }  // SARIF 2.1.0 for GitHub Security tab
}
```

### Architecture

```
pushci scan
    ↓
PipeWarden engine (local or remote)
    ├─ Heuristic scanner (rule-based, 5ms)
    └─ Claude analyzer (AI, 2s)
    ↓
Findings + risk score + remediation
    ├─ Display in CLI
    ├─ Export as SARIF/JSON
    └─ Fail CI if threshold exceeded
```

### Connection to PipeWarden

- **No token required** — uses PipeWarden's embedded engine (open-source rules)
- **AI analysis optional** — requires `ANTHROPIC_API_KEY` for Claude analyzer
- **Cost tracking** — integrates with ClawPipe to show scan cost impact
- **Multi-platform** — scans GitHub Actions, GitLab CI/CD, Bitbucket Pipelines

## Cross-Project Integration: GitHub Actions (via act)

PushCI v1.3.1+ runs existing `.github/workflows/*.yml` files end-to-end
via the **embedded nektos/act runtime**. The wrapper lives in
`internal/actions/` and lets users migrate from GitHub Actions
without rewriting a single workflow file.

### What works (proven by integration tests)

- `actions/checkout@v4`, `actions/setup-node@v4`, `actions/cache@v4`
- Matrix builds: `strategy.matrix.*` with full `${{ }}` expression engine
- Cross-job outputs: `needs.<job>.outputs.<name>`
- Composite actions with inputs/outputs
- Secret injection with masked logs
- Service containers (postgres, redis sidecars)
- Dry-run validation without spawning Docker
- Any OpenAI-compatible or Anthropic action in the marketplace

### Commands

```bash
pushci actions list                    # enumerate workflows
pushci actions run                     # run all jobs for the push event
pushci actions run --job test          # run one job
pushci actions run --dry-run           # validate without containers
pushci actions validate                # lint every workflow
pushci actions doctor                  # print act + docker + workflow status
```

### Dispatcher

`internal/server/webhook.go:dispatch()` routes push events:

- **Has `.github/workflows/*.yml`** → dispatch via `actions.Runner` (act)
- **No workflows** → dispatch via the legacy pushci.yml runner
- **Workflows present but act missing** → fall back to legacy + log warning

See `.planning/phases/` or the commit `4e4729a` for the full design.

### Runtime dependency

`act` must be on the host PATH (`brew install act` / `curl …/install.sh`).
Docker daemon must be running. On Apple Silicon the wrapper auto-sets
`--container-architecture linux/amd64` because most published actions
only ship amd64 Docker images.

## Release & Distribution

**This is the section to re-read every time before shipping a release.**
Getting any step wrong breaks every `npm i -g pushci` user.

### Dual-repo architecture (v1.4.4+)

**Two GitHub repos back the PushCI product:**

| Repo | Visibility | Contents | Purpose |
|---|---|---|---|
| **`finsavvyai/pushci`** | **private** | Go CLI source, Cloudflare Workers API, React dashboard, React Native mobile app, landing page, tests, CI config, all proprietary code | Source of truth. Goreleaser builds binaries from here. This directory. |
| **`finsavvyai/pushci-cli`** | **public** | `bin/pushci.js` (npm shim), `LICENSE` (MIT for the shim), `README.md`, release tarballs uploaded via goreleaser's `release.github` target | Public distribution channel. Homebrew formula, curl installer, and npm shim GitHub-release-download fallback all pull tarballs from here anonymously. |

Why two repos: enterprise buyers need a GitHub URL on the install page for security review, but source must stay private for commercial reasons. GitHub doesn't support public releases on private repos — release asset visibility inherits from the repo. So the product source is private, and a separate public repo exists solely to host the release binaries.

**`go install` is not supported.** A private Go module cannot be resolved by the Go proxy without authentication. The `Go` install method was removed from the landing page in v1.4.4 and the `bin/pushci.js` shim's `printInstallHelp` no longer advertises it. Users who need a Go build must contact `hello@pushci.dev` for commercial licensing.

### Artifact stores

| Store | Populated by | Consumed by | Status |
|---|---|---|---|
| **`finsavvyai/pushci-cli` GitHub Releases** | goreleaser `release.github` targets this repo (not the private one) via `goreleaser release --clean` | curl installer, Homebrew tap, npm shim `downloadFromReleases()` fallback, end users copy-pasting install commands | **canonical, public, anonymous-accessible since v1.4.4** |
| **npm tarball `bin/pushci-<os>-<arch>`** | `scripts/build-bundled-binaries.sh` via `prepack` hook, ships from the private repo's `package.json` | `bin/pushci.js` shim at `tryResolveBinary()` step 2 | **canonical since v1.4.3** |
| **R2 bucket `pushci-releases`** | `workers/releases/worker.js` — deployed but never wired up to the release pipeline | nothing | **ORPHAN — superseded by pushci-cli public repo** |

### Why bundled binaries matter (the v1.4.2 sandbox disaster)

v1.4.2's tarball shipped with the shim expecting bundled binaries
at `bin/pushci-<os>-<arch>` — but `package.json` `files:` only
listed `bin/pushci.js`. Result: `npm i -g pushci` inside any
sandboxed environment (Claude Code, Cursor, Windsurf, air-gapped
CI) had no working resolution path. All 5 fall-throughs failed:
no bundled binary, no PATH binary, blocked GitHub Releases
download, no Go for source build, help text exit 1.

v1.4.3 fixed this by:
1. Adding all 6 platform binaries to `package.json` `files:` array
2. Adding `prepack` script that cross-compiles them via
   `scripts/build-bundled-binaries.sh`
3. Adding `PUSHCI_BINARY` env var as explicit escape hatch (step 0)
4. Short-circuiting `pushci version` / `--version` / `-v` so it
   never kicks off a 60s download just to print a version string
5. Loud multi-line warning when GIT_DIR bypass fires (was silent
   exit 0 — users thought pre-push checks ran when they didn't)

**Contract going forward:** the npm tarball MUST be self-contained.
Never ship a shim-only tarball again. The `prepack` hook enforces
this — `npm publish` refuses to run if binary cross-compilation
fails.

### The canonical release flow (what `git tag v1.4.0 && git push --tags` triggers)

1. Tag is pushed to the **private** `finsavvyai/pushci` repo (this one).
2. `.github/workflows/release.yml` fires — **currently blocked on billing**, so every v1.4.x release was cut via the local flow in step 2b below.
2b. **Local `goreleaser release --clean`** (uses `.goreleaser.yml`) — cross-compiles 6 platform binaries, creates `.tar.gz` / `.zip` archives, creates a release in the **public `finsavvyai/pushci-cli` repo** via `release.github.owner/name` (not the private source repo!), updates the `finsavvyai/homebrew-tap` formula with public-repo download URLs.
3. **`npm publish`** runs in this directory. `prepack` hook builds bundled binaries via `scripts/build-bundled-binaries.sh`. The tarball is self-contained.
4. **`postpublish` hook** runs `scripts/submit-registries.sh` which pings search engines and verifies AI discovery files.
5. **Wrangler deploys** for API, landing, and dashboard run separately via `wrangler deploy` / `wrangler pages deploy`.
6. Homebrew formula URLs point at `finsavvyai/pushci-cli/releases/download/v<X>/...` — anonymous-accessible.

### Manual release (when CI is broken or you want a local build)

```bash
pushci release --dry-run    # build + tarball, no publish
pushci release              # build + publish to GitHub + homebrew + npm
```

This shells out to `goreleaser release --clean`. Requires `GITHUB_TOKEN`
(pulled from `gh auth token` if unset) and `HOMEBREW_TAP_GITHUB_TOKEN`.

### Shim resolution order (as of v1.4.3)

`bin/pushci.js` → `tryResolveBinary()`:

0. `PUSHCI_BINARY` env var — explicit user override
1. Local dev build at `<pkg>/pushci` (pnpm link, goreleaser snapshot)
2. Bundled platform binary `bin/pushci-<os>-<arch>[.exe]` **(canonical)**
3. Existing `pushci` on PATH (Homebrew, go install, curl installer)
4. Download from GitHub Releases into `os.tmpdir()`
5. `go build` from source if Go is installed
6. Install help with offline guidance (exit 1)

Version reads from `package.json` — never hardcoded. Go module
path is `github.com/finsavvyai/pushci/cmd/pushci`. The repo was
renamed from `push-ci.dev` to `pushci` on 2026-05-16; GitHub
auto-redirects the old URL. Public release assets live in the
separate `finsavvyai/pushci-cli` repo (do not rename).

### Pre-release checklist

Before running `pushci release` or tagging:

- [ ] `go test ./...` passes (accept known-broken `internal/mcp` and
      `internal/security` pre-existing test files from earlier sessions)
- [ ] `go vet ./...` clean
- [ ] `pushci actions doctor` reports act + workflows OK
- [ ] Bump `package.json` version (shim reads from there automatically)
- [ ] Bump `cmd/pushci/main.go` `var version` if hardcoded
- [ ] Update `CHANGELOG.md` if it exists
- [ ] `pushci release --dry-run` to verify the build
- [ ] `npm pack` — inspect tarball contents, confirm all 6
      `bin/pushci-*` binaries are present (~8MB each)
- [ ] `git tag v<X.Y.Z> && git push --tags` to trigger full release
      (or local goreleaser if GH Actions billing is blocked)

### Known: GitHub Actions release workflow blocked on billing

`.github/workflows/release.yml` has been failing since v1.4.0 due
to a GitHub billing issue on the `finsavvyai` org ("recent account
payments have failed"). Every release v1.4.0 → v1.4.3 was cut via
the local `goreleaser release --clean` + `npm publish` flow. Not
a code bug — resolve at billing.github.com when possible.

### What the CI pre-push hook blocks

PushCI dogfoods itself. `.git/hooks/pre-push` runs `pushci run` on
every push. Known flaky check: `TestInitAndRun` requires network
access to download tsc/vitest/vite via npx — fails in hermetic
environments. Use `git push --no-verify` sparingly and only for
pre-existing flakes, never for your own broken code.

## Opensyber Dogfood Status (2026-04-11)

Bugs found while dogfooding `pushci init` against the opensyber
pnpm+turbo monorepo. All **FIXED** in commits
`3efe4af`, `bb3865e`, `4755dd2`:

1. ✅ pnpm workspaces not detected → workspace consolidation in
   `internal/detect/workspace.go`
2. ✅ Static `npm install` regardless of lockfile → lockfile-driven
   `DetectNodeBuildTool` in `internal/detect/node_buildtool.go`
3. ✅ `turbo.json` ignored → `buildTurboStages` in
   `cmd/pushci/cmd_init_generate.go`
4. ✅ `.next/.turbo/.cache/...` enumerated as projects → extended
   `skipDirs` in `internal/detect/find.go` (12 artifact dirs)
5. ✅ Redundant root install stage → absorbed by fix #1
6. ✅ `pushci run --help` silently ran the pipeline → `wantsHelp()`
   interception in `cmd/pushci/help_intercept.go`

Related issues filed as GitHub issues #1 (`run --help`), #2
(`deploy --help`), #3 (`deploy: trigger: push` silent prod deploys).
All three are fixed.

The opensyber fixture is captured as a regression test at
`internal/detect/dogfood_opensyber_test.go` — re-run it before any
change to `internal/detect/` or `cmd/pushci/cmd_init_*`.

## pushci.yml check schema: name-as-command shorthand

A subtle bit of the `pushci.yml` format that regularly surprises
new readers: a check **without** a `run:` field is not broken — the
runner falls back to `check.Name` as the shell command. See
`cmd/pushci/cmd_run_stage_checks.go:23`:

```go
cmd := check.Run
if cmd == "" {
    cmd = check.Name  // <- name becomes the command
}
```

So these two forms execute identically:

```yaml
# Explicit form
checks:
  - name: test
    run: npm test

# Shorthand — name IS the command
checks:
  - name: npm test
```

`pushci init` generates the shorthand form for common commands
like `npm test`, `go test ./...`, `cargo test` because the name
doubles as a human-readable label and an executable command. When
the command needs arguments with special characters (pipes,
redirects, multiline scripts), you must use the explicit `run:`
form.

**Don't be alarmed by `checks: [- name: build]` output from
`pushci init`** — it runs `build` as a shell command in the stage's
working directory. If your repo has a `build` script in
`package.json`, that script fires. If it doesn't, you'll see a
"command not found" error. Use `pushci init --force` with a
hand-written `run:` field when you need something more specific.

## AI provider selection (internal/ai/)

`ai.NewClient()` auto-picks an AI provider by env var in this
order (updated 2026-04-11 to prioritize latency for CI flows):

1. **`GROQ_API_KEY`** → Groq Llama 3.3 70B on LPUs, ~500 tok/sec,
   10× faster than any hosted Claude call. Default for CI
   diagnose/heal flows where latency dominates UX.
2. **`ANTHROPIC_API_KEY`** → Claude Haiku 4.5 via the Messages API.
   Best tool-use quality when you need it.
3. **`DEEPSEEK_API_KEY`** → cheapest OpenAI-compatible backend.
4. **`OPEN_AI_KEY` / `OPENAI_API_KEY`** → GPT-4o-mini fallback.
5. **`GEMINI_API_KEY`** → Google AI Studio, free tier.

Users with multiple keys set can force a specific provider via
**`PUSHCI_AI_PROVIDER=<name>`** (names: `anthropic`, `claude`,
`groq`, `deepseek`, `openai`, `gemini`, `google`). The override is
case-insensitive.

**Model IDs are centralized**, not hardcoded per call site:

- Go side: `internal/ai/claude.go::DefaultAnthropicModel` (alias,
  not a dated snapshot — so deprecations don't silently break
  every call). Override via `PUSHCI_AI_MODEL` in the env.
- API side: `api/src/ai-model.ts` exports `CLAUDE_HAIKU_MODEL`,
  `CLAUDE_SONNET_MODEL`, `CLAUDE_OPUS_MODEL`. Every handler that
  talks to Anthropic imports from this file — when Anthropic
  deprecates a snapshot, fix lands in one place instead of grep-
  and-replacing 12 files like we used to.

This was follow-up #23 from the opensyber session: the shim had
`claude-haiku-4-5-20251001` pinned across 12 call sites. Now
centralized to `claude-haiku-4-5` (stable alias) in one place each
for Go and TypeScript.

## Open-Core GTM Strategy (2026-05-04)

PushCI follows an open-core business model: free CLI + paid
cloud/enterprise features. Strategy derived from research into
GitLab, Cursor, Buildkite, and Earthly (which died trying to
monetize compute — the cautionary tale).

### Business model

- **Free CLI forever:** all 35 languages, 39 frameworks, 22 deploy
  targets, AI diagnose (BYOK), GitHub Actions runtime. Runs on
  your machine, $0.
- **Monetize team coordination + compliance:** dashboard, SSO,
  SCIM, RBAC, audit, SIEM — things the local CLI cannot provide.
- **Never monetize compute.** That's our brand differentiator.

### Pricing tiers

| Tier | Price | Gate |
|------|-------|------|
| Free | $0 forever | Individual devs |
| Pro | $9/mo | Dashboard, analytics, 22 deploy targets |
| Team | $29/seat/mo | SSO, SAML, audit, governance, SLA |
| Enterprise | from $25/user/mo | SCIM, 7-year audit, SIEM, dedicated tenant |

### License

BUSL-1.1 (Business Source License). Converts to MIT on 2029-04-06.
Allows all use except offering a competing hosted CI/CD service.
TrustBar on landing site reads "Source Available (BUSL-1.1)".

### Community health files

- `SECURITY.md` — vulnerability disclosure, 48h ack SLA
- `CODE_OF_CONDUCT.md` — Contributor Covenant v2.1
- `CONTRIBUTING.md` — good-first-issue categories, code standards
- `CHANGELOG.md` — Keep a Changelog format, v1.7.2–v1.7.5
- Issue templates: `bug_report.md`, `feature_request.md`

### GTM content drafts (local only, `.luna/gtm/`)

Ready for manual posting — review before publishing:

- `show-hn.md` — Show HN post with posting checklist
- `devto-github-actions-locally.md` — tutorial: run GH Actions locally
- `devto-curb-yaml.md` — Curb-voice opinion piece on YAML
- `reddit-posts.md` — r/devops, r/selfhosted, r/programming drafts
- `awesome-list-submissions.md` — 5 awesome-list PR drafts
- `champion-one-pager.md` — 1-page PDF for enterprise champions
- `compliance-matrix.md` — SOC 2, GDPR, ISO 27001 readiness matrix
- `case-study-template.md` — ready for Norlys pilot results

### GTM launch sequence (90-day plan)

1. **Wk 1-2:** Open-source CLI, optimize README, write 3 comparison
   SEO pages (already have 7 vs/ pages — verify content is fresh)
2. **Wk 3-4:** Show HN post, Reddit posts, Dev.to article #1
3. **Wk 5-8:** Dev.to article #2, awesome-list submissions, GitHub
   Discussions, good-first-issue labels
4. **Wk 9-12:** Close Norlys pilot, build case study, champion PDF,
   enterprise compliance page, Twitter/X building-in-public

### Key insight (Earthly post-mortem)

Earthly had great OSS adoption and still died. Their CLI was so
good locally that nobody needed to pay. PushCI's monetization wall
must be team coordination + compliance, NOT compute or speed. Build
for individuals, monetize teams. Cursor proved this at $200M ARR
without a single salesperson.

### Anti-bluff: marketing numbers

All marketing surfaces (landing, README, llms.txt, ai-plugin.json,
index.html, SocialProof, featuresData) were swept 2026-05-04.
Verified counts: 35 languages, 39 frameworks, 22 deploy targets.
Only `blog/v130.html` retains "33" — correct at time of v1.3.0
release (historical archive, not updated by design).

## Anti-Bluff Drill (Round 1, 2026-04-27)

Derived from real bluffs found by `/ll-no-bluf` in commits `6fe7e74`
and `ddad7b6`. See `.luna/pushci/no-bluf-report.md` for the original
findings and `.luna/pushci/drill-report.md` for the drill that
produced these rules.

- **Mount-path claims**: before stating a route prefix (e.g.
  `/api/foo`, `/scim/v2`) in a commit body, doc, or release note,
  grep `app\.route\(` in `api/src/index.ts` and copy the literal
  first arg. Memory-of-convention is not a source. The bluff that
  triggered this: commit `6fe7e74` body claimed `/api/scim/v2` but
  the actual mount is `/scim/v2` (no `/api` prefix).

- **Exact counts**: never write a numeric count (bots, files,
  tests, percentages, lines) without a verifying command. Either
  include the command + result inline, or replace the number with
  "approximately N" / "N+". The bluff that triggered this: commit
  `ddad7b6` claimed "31 named bot user-agents" — actual count is
  32 named + 1 wildcard.

- **CLI demo status**: when a demo, screenshot, or terminal
  recording shows commands (e.g. `pushci sso setup`), grep
  `cmd/pushci/cmd_<verb>.go` to confirm the binary supports it.
  If not implemented, label the demo "preview" or list the gap
  explicitly in the commit body. Commit `6fe7e74` did this
  correctly for the enterprise terminal demo — keep doing that.
