# PushCI.dev — Capabilities (v1.7.5, May 2026)

> AI-native CI/CD platform. Zero config. Your machine. Works everywhere.
> "The operating system for developer pipelines, powered by your own infrastructure + AI."

All counts below verified by direct grep/wc against the working tree.
Last verified: 2026-05-23. Discrepancies vs CLAUDE.md noted inline.

---

## 1. Distribution

| Channel | Status | Notes |
|---|---|---|
| **npm** (`pushci`) | live | Self-contained tarball, 6 platform binaries shipped via `prepack` hook |
| **Homebrew tap** (`finsavvyai/homebrew-tap`) | live @ v1.7.5 | Auto-bumped by goreleaser, real sha256s |
| **curl installer** | live | Downloads from public `finsavvyai/pushci-cli` releases |
| **npx** (one-shot) | live | `npx pushci init` |
| **VS Code Marketplace** | live | Publisher `finsavvyai`, 4 commands, sidebar tree view |
| **Mobile (Expo)** | builds | iOS + Android, 6 screens, not store-published |
| `go install` | **removed** v1.4.4 | Private Go module — can't be resolved by Go proxy |

---

## 2. CLI (Go 1.22)

- **208 `cmd_*.go` files** in `cmd/pushci/` (CLAUDE.md says 196 — outdated)
- **37 internal/ packages** (CLAUDE.md says 36 — outdated)
- **~40,238 LOC** non-test Go (CLAUDE.md says ~36,723 — outdated)
- **241 Go test files**

### 31 top-level command verbs

`actions, ai, cli, deploy, doctor, extend, flag, flags, heal, import,
index, init, install, intel, login, migrate, plan, promote, register,
release, report, run, scan, secrets, skill, tools, trace, trigger,
troubleshoot, uninstall, voice`

### Internal packages (37)

actions · agents · ai · artifacts · autofix · cache · cli · cloud ·
config · debug · deploy · detect · entitlement · gitops · heal ·
integrate · intel · mcp · middleware · migrate · nlp · notify ·
observe · pipeline · platform · plugin · preview · promote · rbac ·
runner · secrets · security · server · skill · templates · updater

---

## 3. Stack & framework detection

- **35 language `Stack` constants** in `internal/detect/stack.go` —
  Bicep, Bun, Cabal, Cargo, Clojure, CMake, Composer, Cpanm, Cpp,
  Crystal, CSharp, Dart, Deno, Docker, Dotnet, Dune, Elixir, Erlang,
  Fortran, Foundry, Fpm, Gleam, Go, Gradle, Hardhat, Haskell, Helm,
  Java, Julia, Kotlin, Lein, Lua, Luarocks, Make, Maven, Mix, Nim,
  Nimble, Node, Npm, OCaml, Perl, Php, Pip, Pnpm, Poetry, Python,
  R, Ruby, Rust, Sbt, Scala, Shards, Solidity, Stack, Swift,
  Terraform, Vlang, Yarn, Zig (list mixes lang + build-tool aliases)
- **33 `BuildTool` constants** (subset shown in CLAUDE.md)
- **39 framework returns** across 14 `internal/detect/framework_*.go` —
  actix, airflow, android, angular, aspnetcore, axum, blazor, celery,
  chi, cra, django, echo, electron, elysia, expo, fastapi, fiber,
  flask, gin, hono, kotlin, laravel, leptos, micronaut, ml, play,
  quarkus, rails, rocket, scrapy, sinatra, spring-boot, streamlit,
  symfony, t3, tauri, templ, vite, vue

---

## 4. Deploy targets (22 wired drivers)

`internal/deploy/deploy.go` `var drivers` map — orphan-detection test
enforces every `Target*` constant has a driver entry.

CloudflarePages · CloudflareWorkers · AWSECS · AWSLambda · AWSS3 ·
GCPCloudRun · GCPAppEngine · AzureAppService · AzureFunctions ·
Bicep · Docker · K8s · Vercel · Railway · Fly · Render · Netlify ·
SSH · Terraform · CloudFormation · Pulumi · Ansible

---

## 5. AI providers (7 paths, latency-first)

`internal/ai/` — auto-selected by env var presence in this order
(`PUSHCI_AI_PROVIDER` overrides; case-insensitive):

1. **Groq** Llama 3.3 70B on LPUs (~500 tok/sec) — default for CI
2. **Anthropic Claude** — best tool-use quality
3. **DeepSeek** — cheapest OpenAI-compatible
4. **OpenAI** — GPT-4o-mini fallback
5. **Gemini** / Google AI Studio — free tier
6. **Local llamafile** lifecycle (`llamafile_*.go`)
7. **PushCI proxy** (`claw_client.go`)

Model IDs centralized: Go side `internal/ai/claude.go::DefaultAnthropicModel`,
TS side `api/src/ai-model.ts`. Override via `PUSHCI_AI_MODEL`.

---

## 6. API (Cloudflare Workers + Hono + D1 + KV)

- **175 non-test `.ts` files** + **61 test files** (236 total)
- **~27,727 LOC** non-test TS
- **81 `app.route()` mounts** in `api/src/index.ts`
- **14 D1 migrations** in `api/migrations/`

### Route coverage

auth · user · billing · AI · cloud · NLP · autofix · pipeline · audit ·
governance · SSO · SAML · SCIM (`/scim/v2` + `/api/scim/v2` alias) ·
artifacts · workspaces · skills · channels · logs · remediate ·
recommend · promote · builds · widgets · register · stats · settings

### D1 migrations (14)

governance · runner control plane · channels · billing · team ·
telemetry · plans · feature usage · MFA + audit chain · Paddle ·
user email · skills (+ 2 more)

---

## 7. CI bridges (7 importers, all live-poll)

`AWS CodePipeline · Azure DevOps · Bitbucket · CircleCI · Gerrit ·
GitLab · Jenkins`

Gerrit ships REST poll + Verified label writeback
(`gerrit-poll.ts`, `gerrit-callback.ts`, `gerrit-webhook.ts`).

---

## 8. Channel bridges (5 platforms)

| Platform | Direction | NLP-parsed |
|---|---|---|
| Slack | inbound + outbound | yes |
| Discord | inbound + outbound | yes |
| WhatsApp | inbound + outbound | yes |
| Telegram | inbound + outbound | yes |
| Email | **outbound only** | no |

Dispatch via `channel-dispatch.ts`. SSRF-guarded fetch in
`bridge-url-guard.ts`. NLP handlers in `channel-parsers.ts` + `internal/nlp/`.

---

## 9. Enterprise surface (27 files)

- **SAML** SSO
- **SCIM** v2 provisioning (dual mount: `/scim/v2` + `/api/scim/v2`)
- **MFA** enrollment + audit chain
- **RBAC** (admin, developer, viewer, auditor)
- **Audit chain** — immutable (`audit-immutable.ts`) + SIEM forwarder (`audit-siem.ts`)
- **DORA metrics** tenant-scoped
- **Enterprise identity** + **dashboard**

---

## 10. Web surfaces

### Dashboard (`web/dashboard/`)

- **35 pages** (CLAUDE.md says 29 — outdated)
- **155 components** (CLAUDE.md says 128 — outdated)
- ~16,469 TSX LOC

Pages: Overview, Runs, RunDetail, Projects, ProjectEnvironments,
Runners, Channels, Artifacts, Analytics, AuditLog, Achievements,
Billing, Team, Settings, Login, AuthCallback, CliAuth, MfaEnrollment,
SsoSetup, SkillMarket, Chat, EnterpriseDashboard, MigrationWizard,
Gerrit, CompanyRegistries, GitHubActionsImporter, GitLabImporter,
BitbucketImporter, NotFound (+ 6 more recent).

### Landing (`web/landing/`)

- **33 pages** (CLAUDE.md says 30 — outdated)
- **39 components** (CLAUDE.md says 43 — outdated, likely cleanup)

Pages: Product · Pricing · Enterprise · Compliance · Developers ·
AI Integration · Cost Calculator · Curb Your CI · Local Release ·
Norlys Pilot · Docs (multi-section) · Contact · Privacy · `/vs/*`
competitor pages (7) · NotFound

---

## 11. Mobile (Expo SDK 52)

`mobile/` — React Native. **6 screens**: Login, Projects, Runs,
Billing, Settings, Skills. Maestro test config. iOS prebuild
artifacts. Connects to same Workers API.

---

## 12. VS Code extension

`extensions/vscode/` — publisher `finsavvyai`, activates on `pushci.yml`.
**4 commands**: run, status, logs, init. Sidebar tree view (`pushci.runs`).

---

## 13. Plugin system

`internal/plugin/` — built-in checks, Docker, file-size cap,
shell-script plugin host, tenant isolation.

---

## 14. GitHub Actions runtime (embedded)

`internal/actions/` — wraps `nektos/act`. Runs unmodified
`.github/workflows/*.yml` end-to-end. Apple Silicon auto-flag for
`linux/amd64`.

**Works:** `actions/checkout@v4`, `setup-node@v4`, `cache@v4`,
matrix builds, cross-job `needs.<job>.outputs.<name>`, composite
actions, masked secret injection, service containers (postgres/redis),
dry-run.

### Commands

```bash
pushci actions list       # enumerate workflows
pushci actions run        # run all jobs for push event
pushci actions run --job test
pushci actions run --dry-run
pushci actions validate   # lint every workflow
pushci actions doctor     # print act + docker + workflow status
```

### Dispatcher

`internal/server/webhook.go:dispatch()` routes push events:
- workflows present → `actions.Runner` (act)
- no workflows → legacy `pushci.yml` runner
- workflows + act missing → fall back + warn

---

## 15. PipeWarden — pipeline security scanning

```bash
pushci scan                          # scan all pipelines
pushci scan --engine heuristic       # rule-based (5ms)
pushci scan --engine claude          # AI-powered (2s)
pushci scan --export sarif           # SARIF 2.1.0 for GitHub Security
pushci run --security --fail-on=high # gate CI on findings
```

MCP tool `pushci_scan` exposes this to Claude / agents.
Output: findings, risk score, remediation, SARIF.

---

## 16. MCP server

`internal/mcp/` — stdio + remote handlers, doctor, extended tools,
promote, recommend, scan, server. Exposes pipeline ops to **Claude in
Chrome** + **VS Code**.

---

## 17. Secrets (v1.7.5)

- AES-256-GCM machine-bound keys
- **macOS Keychain** scheme: `keychain://` + `pushci secrets keychain` CLI
- **HashiCorp Vault** AppRole adapter + `vault://` env resolver
- Pattern scanner + secret leak detection in logs + auto-rotate

---

## 18. Agent platform (Rust workspace)

`agent-platform/` — separate Cargo workspace, **4 crates**:
- `runtime`
- `server`
- `toolpack-pushci`
- `tools`

Shared conversation runtime, tool registry, session/streaming API,
multi-tenant policy. Will host PushCI as first tenant, OpenSyber +
others planned. **Not** the place for PushCI control-plane logic.

---

## 19. Billing

| Provider | Status |
|---|---|
| **Lemon Squeezy** | live, merchant of record, e2e wired (landing → dashboard → checkout → webhook) |
| **Paddle** | drafted (`billing-paddle.ts` + `2026-04-22_paddle.sql`) — **not wired in `index.ts`** |

### Pricing tiers

| Tier | Price | Gate |
|---|---|---|
| Free | $0 forever | individuals |
| Pro | $9/mo | dashboard, analytics, 22 deploy targets |
| Team | $29/seat/mo | SSO, SAML, audit, governance, SLA |
| Enterprise | from $25/user/mo | SCIM, 7-year audit, SIEM, dedicated tenant |

---

## 20. Auth

- **OAuth providers (5):** GitHub, GitLab, Google, Microsoft, LinkedIn
- **JWT** sessions
- **Enterprise:** SAML, SCIM, MFA

---

## 21. License & repo split

| Repo | Visibility | Purpose |
|---|---|---|
| `finsavvyai/pushci` | **private** | Source (this repo) |
| `finsavvyai/pushci-cli` | **public** | Release binaries (Homebrew, curl, npm fallback) |
| `finsavvyai/homebrew-tap` | **public** | Brew formula |

**License:** BUSL-1.1. Converts to MIT on 2029-04-06. Allows all use
except offering a competing hosted CI/CD service.

---

## 22. File-size guarantees (CI-enforced)

- Go source files **≤100 lines**
- All other source **≤200 lines** (portfolio CLAUDE.md rule)

---

## Discrepancies vs CLAUDE.md (suggest updating)

| Metric | CLAUDE.md | Actual | Δ |
|---|---|---|---|
| `cmd_*.go` files | 196 | **208** | +12 |
| `internal/` packages | 36 | **37** | +1 |
| Go non-test LOC | 36,723 | **40,238** | +3,515 |
| Dashboard pages | 29 | **35** | +6 |
| Dashboard components | 128 | **155** | +27 |
| Landing pages | 30 | **33** | +3 |
| Landing components | 43 | **39** | −4 |

Net: 7 of 7 surfaces grew; landing components consolidated.
Bump CLAUDE.md product-stats block in next maintenance commit.
