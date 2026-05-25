# PipeWarden — open-core split plan

**Status:** v2 — reality-checked against actual code · **Owner:** Shahar · **Last touched:** 2026-05-17

> **v2 corrections** (from reading the real import graph):
>
> 1. `cmd/pipewarden` is a MONOLITH today — same binary serves CLI
>    subcommands AND boots the SaaS server (handlers + router + Claude
>    wiring). The split requires a new public entry point.
> 2. `internal/analysis` is MIXED — deterministic files (heuristic,
>    dlp, sarif, action_pinning, egress, analysis.go types) live next
>    to Claude-only files (claude.go, claude_call.go, claude_prompt.go,
>    claude_mythos.go). Must split at file granularity, not package.
> 3. `internal/clawpipe` is PUBLIC-SAFE despite the name. It's just an
>    HTTP client + cheap-routing constants. The moat is the gateway
>    service itself; the client is fine open.
> 4. `internal/tracing`, `internal/mesh` are server-only infrastructure
>    (Tailscale mesh, OTel exporter). Keep PRIVATE.
> 5. `internal/integrations` is clean: every CI/CD provider client
>    depends only on `config` + `logging`. Safe public unit.
> 6. `internal/webhooks/sender.go` carries the `FindingEvent` type the
>    OpenSRE bridge uses — must be PUBLIC so both repos resolve the
>    same struct shape.

The brief: make the *deterministic* scanning surface public so install /
brew / GitHub Marketplace / HN / Claude Code skill all work, while
keeping the AI prompts, ML routing, SaaS backend, billing, and
internal-only docs private.

The whole exercise exists so we can do the things in `GO_TO_MARKET_PLAN.html`
without (a) handing competitors our Claude analyzer prompts and (b)
publishing internal strategy + the "no real customers yet" admission.

---

## 1. Two-repo target

| Repo | Visibility | What lives here |
|---|---|---|
| `finsavvyai/pipewarden` (NEW name: `pipewarden-cli`) | **public** | The Go binary, deterministic rules, integrations, MCP server, install scripts, Homebrew tap glue |
| `finsavvyai/pipewarden-saas` (rename of current repo) | **private** | Cloudflare worker, Claude prompts, billing, hosted handlers, GTM docs, marketing site |

Two-repo > monorepo with build tags because:
- Public Go module import path (`github.com/finsavvyai/pipewarden`) is stable
  regardless of internal repo changes
- Contributors don't need access to the private repo to PR against CLI
- Marketing site + GTM strategy never accidentally land in a public commit

The private repo imports the public one as a regular Go module.

---

## 2. File-by-file allocation

### Goes PUBLIC (`pipewarden-cli`)

```
cmd/pipewarden/                          ← NEW: thin main.go that dispatches
    main.go                              ← only scan/dlp/trace/test-provider
    scan.go                              ← (already CLI-only, stdlib imports)
    scan_http.go scan_output.go scan_sse.go
    dlp.go                               ← imports internal/analysis only
    test_provider.go                     ← imports config + integrations only
    trace.go                             ← imports internal/tracing  ⚠ see note
    init_logging.go                      ← logging bootstrap for CLI
    + matching _test.go files
cmd/testconnections/                     ← provider smoke tool
cmd/migrate/                             ← sqlite-path migration runner only

internal/analysis/                       ← SPLIT BY FILE (see §2a below)
    analysis.go                          ← Finding/Severity/Category types  ✓
    heuristic.go + _test.go              ← deterministic rule engine
    dlp.go + _test.go                    ← 13 secret patterns
    dlp_patterns.go dlp_extract.go dlp_modern_patterns_test.go
    sarif.go + _test.go                  ← output format
    action_pinning.go + _test.go         ← deterministic checks
    egress.go egress_baseline.go egress_test.go  ← deterministic checks

internal/clawpipe/                       ← UPGRADED to public — HTTP client only
    client.go + _test.go                 ← REST client to clawpipe.ai
    cheap_routing.go + _test.go          ← public-safe routing table
    cost_tracker.go + _test.go           ← local cost accounting
    airgap.go offline.go                 ← local-LLM fallbacks
    models.go + _test.go                 ← model name registry
    llamafile_checksums.go

internal/policy/                         ← OPA evaluator + 22 default policies
internal/security/owasp.go + _test.go    ← deterministic audit checks
internal/osv/                            ← OSV.dev REST client (Wave 2)
internal/aicommit/                       ← AI-author detection (Wave 2)
internal/halludep/                       ← registry existence probes (Wave 2)
internal/integrations/                   ← 6 CI/CD provider clients
internal/vault/                          ← AES-256-GCM credential vault
internal/storage/                        ← SQLite layer + migrations
internal/config/                         ← Viper config loader
internal/logging/                        ← zap wrapper
internal/errors/                         ← typed error codes
internal/webhooks/
    sender.go + _test.go                 ← FindingEvent shared contract
    opensre_sender.go + _test.go         ← OpenSRE bridge (HMAC sender only)
    retry_queue.go + _test.go
internal/telemetry/                      ← opt-in PostHog (Wave 2)
pkg/mcp/                                 ← MCP server (tool schemas + server)
integrations/claude-code/                ← skill + hooks (Wave 3)
integrations/cursor-mcp/                 ← MCP wiring (Wave 3)
.goreleaser.yml                          ← public release pipeline
.github/workflows/{ci,release,sbom}.yml
scripts/install.sh
scripts/update-homebrew-formula.sh
packaging/homebrew/pipewarden.rb
README.md (rewritten — no SaaS feature list)
LICENSE  (MIT)
docs/                                    ← public docs only (cli, policies, mcp)
```

### §2a — `internal/analysis/` file split (BREAKING)

The package keeps its name; the Claude-touching files move to a
separate `internal/aianalysis/` package in the **private** repo. Callers
update from `analysis.NewClaudeAnalyzer(...)` to
`aianalysis.NewClaudeAnalyzer(...)`. There are exactly 3 call sites:

```
internal/handlers/handlers.go:20    (struct field)
internal/router/router.go:21        (constructor param)
cmd/pipewarden/setup.go:82          (buildClaudeAnalyzer — moves to private)
```

All three live in the private repo, so the rename touches private code
only — public callers never see `ClaudeAnalyzer` at all.

Files that move to private `internal/aianalysis/`:

```
claude.go                                ← Anthropic Messages API client
claude_call.go                           ← request orchestration
claude_prompt.go                         ← THE prompts (the moat)
claude_mythos.go + _test.go              ← prompt-injection containment
claude_test.go
claude_airgap_test.go
coverage_boost_test.go + coverage_boost2_test.go  (Claude-focused)
```

### Stays PRIVATE (`pipewarden-saas`)

```
cmd/pipewarden-server/                   ← NEW: extracted from cmd/pipewarden/
    main.go                              ← server-mode entry (no subcommand routing)
    setup.go                             ← buildClaudeAnalyzer + handler wiring
    + setup_test.go

internal/aianalysis/                     ← NEW: extracted from internal/analysis/
    claude.go                            ← Anthropic Messages API client
    claude_call.go                       ← request orchestration
    claude_prompt.go                     ← the prompts (THE moat)
    claude_mythos.go + _test.go          ← prompt-injection containment
    claude_test.go
    claude_airgap_test.go
    coverage_boost_test.go               ← Claude-focused coverage

internal/ai/                             ← claw_client.go + pushci_bridge.go
internal/billing/                        ← LemonSqueezy + plan enforcement
internal/payment/                        ← plans.go + checkout flow
internal/handlers/                       ← hosted HTTP API (signup, OAuth, team admin,
                                            recovery, passkeys, billing, dashboard…)
internal/auth/                           ← GitHub App OAuth, WebAuthn, JWT
internal/router/                         ← full hosted route registration
internal/middleware/                     ← rate limit, auth gates, billing gates
internal/email/                          ← SMTP delivery
internal/siem/                           ← Slack/PagerDuty/Jira routing
internal/search/                         ← findings search + local index
internal/mesh/                           ← inter-service mesh (Tailscale)
internal/metrics/                        ← Prometheus metrics
internal/tracing/                        ← OTel  ⚠ see note below
internal/web/                            ← dashboard SPA
internal/db/                             ← hosted Postgres path
internal/exports/                        ← hosted-only export pipelines
internal/jenkins/                        ← Jenkins runtime adapter (if hosted-specific)
internal/webhooks/audit.go               ← audit-event sender (hosted billing/compliance)
worker/proxy.js                          ← Cloudflare Worker
wrangler.toml                            ← CF deploy config
scripts/deploy.sh                        ← orchestrated deploy with voice
website/                                 ← marketing site
docs/PROD_HANDOFF.md                     ← internal runbook
GO_TO_MARKET_PLAN.html                   ← strategy doc
.planning/                               ← all internal planning docs
.env / .env.example                      ← never published
```

> **`internal/tracing` note**: the package itself is leaf (zero internal
> deps) and would be safe to ship public — but no public-side code
> actually uses it. `cmd/pipewarden/trace.go` does, so if we want the
> `pipewarden trace` subcommand in the CLI we must either move tracing
> to public OR drop the trace subcommand from the OSS binary. **Recommend
> moving tracing to public** so the CLI keeps its full subcommand set.

### SHARED CONTRACT (must agree across both)

```
internal/analysis/analysis.go (types: Finding, Severity, Category)
internal/webhooks/sender.go    (FindingEvent JSON shape)
pkg/mcp/tools.go               (MCP tool schemas)
```

The shared contract goes in the **public** repo; the private repo
imports it. No duplication, no drift.

### §2b — Ground-truth evidence (reverse-checked)

Output of `go list -deps ./internal/<pkg> | grep finsavvyai`,
filtered for each proposed-public package. Empty lines mean zero
internal deps (perfect leaf — safe to publish).

```
internal/osv             — leaf, no internal deps                ✓
internal/aicommit        — leaf, no internal deps                ✓
internal/halludep        — leaf, no internal deps                ✓
internal/telemetry       — leaf, no internal deps                ✓
internal/policy          — leaf, no internal deps                ✓
internal/vault           — leaf, no internal deps                ✓
internal/storage         — leaf, no internal deps                ✓
internal/config          — leaf, no internal deps                ✓
internal/errors          — leaf, no internal deps                ✓
internal/security        — leaf, no internal deps                ✓
internal/logging         — depends on config                     ✓ (config also public)
internal/integrations    — depends on config + logging           ✓ (both public)
internal/clawpipe        — leaf, no internal deps                ✓
internal/metrics         — leaf, no internal deps                ✓ (move PUBLIC too)

internal/analysis        — depends on clawpipe, config,
                           integrations, logging, metrics,
                           security, tracing                     ✗ MIXED (split per §2a)
```

The `analysis → metrics` edge comes from `claude_call.go` only. When
that file moves to the private `internal/aianalysis/` package per §2a,
the remaining `internal/analysis/` package no longer touches metrics.
So the public side gets:

- analysis (deterministic files only) → clawpipe, config, integrations,
  logging, security
- clawpipe → leaf
- metrics → leaf (still public; private handlers/middleware import it)

No package needs an architectural change. The split is purely (a) move
the four claude_*.go files to a new private package, (b) extract a new
public main.go that doesn't pull in handlers/router.

---

## 3. Import-path migration

Today's module: `github.com/finsavvyai/pipewarden`

After the split:

- Public repo keeps the module path `github.com/finsavvyai/pipewarden`
  (so existing `go get` and CLI users see zero change).
- Private repo gets a NEW module path
  `github.com/finsavvyai/pipewarden-saas`, and imports
  `github.com/finsavvyai/pipewarden` for shared types + CLI helpers.

This means the private repo has the simpler diff (it loses the
public-going code; everything left compiles against the public Go
module).

---

## 4. Migration sequence

> **v2 amendment:** the split requires real refactors first, then
> filter-repo. Don't try to do it as a single git-only rewrite — the
> code wouldn't compile on either side. The order below interleaves
> code changes with git surgery so HEAD is green after every step.

```
Step 0  Snapshot the current repo (just in case).
        git clone --mirror finsavvyai/pipewarden  pipewarden-snapshot.git

Step PRE-1  In the CURRENT private repo, do the in-tree refactor first:
        a) Create internal/aianalysis/ and `git mv` claude.go,
           claude_call.go, claude_prompt.go, claude_mythos.go +
           their _test.go counterparts into it.
        b) Update package declaration to `package aianalysis`.
        c) Find all callers of `analysis.ClaudeAnalyzer` / `analysis.NewClaudeAnalyzer`
           (3 call sites: handlers/handlers.go, router/router.go,
           cmd/pipewarden/setup.go) and rewrite to `aianalysis.*`.
        d) Create cmd/pipewarden-server/ with the current main.go +
           setup.go (server boot path).
        e) Slim cmd/pipewarden/main.go to only dispatch
           scan/dlp/trace/test-provider subcommands.
        f) `go build ./...` + `make test` + `make smoke` must stay green.
        g) Commit on a branch `chore/prep-open-core-split`.
        h) Merge to main; tag the merge commit as `pre-split`.

Step 1  Create the public repo on GitHub (still empty, public).
        gh repo create finsavvyai/pipewarden-cli --public --description '…'

Step 2  Use git-filter-repo to extract the OSS subset into the public repo.
        git clone finsavvyai/pipewarden pipewarden-cli
        cd pipewarden-cli
        git remote rename origin saas-backup
        git remote add origin git@github.com:finsavvyai/pipewarden-cli.git
        # NB: after Step PRE-1, internal/analysis no longer contains
        # claude_*.go (those moved to internal/aianalysis), and
        # cmd/pipewarden is now the thin CLI dispatcher (the SaaS
        # server lives at cmd/pipewarden-server).
        git filter-repo \
          --path cmd/pipewarden \
          --path cmd/testconnections \
          --path cmd/migrate \
          --path internal/analysis \
          --path internal/clawpipe \
          --path internal/metrics \
          --path internal/policy \
          --path internal/security/owasp.go \
          --path internal/security/owasp_test.go \
          --path internal/osv \
          --path internal/aicommit \
          --path internal/halludep \
          --path internal/integrations \
          --path internal/vault \
          --path internal/storage \
          --path internal/config \
          --path internal/logging \
          --path internal/errors \
          --path internal/tracing \
          --path internal/webhooks/opensre_sender.go \
          --path internal/webhooks/opensre_sender_test.go \
          --path internal/webhooks/sender.go \
          --path internal/webhooks/sender_test.go \
          --path internal/webhooks/retry_queue.go \
          --path internal/webhooks/retry_queue_test.go \
          --path internal/telemetry \
          --path pkg/mcp \
          --path integrations \
          --path .goreleaser.yml \
          --path .github/workflows/ci.yml \
          --path .github/workflows/release.yml \
          --path .github/workflows/sbom.yml \
          --path scripts/install.sh \
          --path scripts/update-homebrew-formula.sh \
          --path packaging/homebrew \
          --path LICENSE \
          --path README.md \
          --path go.mod --path go.sum \
          --path-glob 'docs/cli-*' \
          --path-glob 'docs/policies-*' \
          --path-glob 'docs/mcp-*'

        # NOTE on internal/security: only owasp.go is public-safe.
        # Other files in that package (mythos_sanitizer.go etc) are
        # Claude-prompt-injection guards that ARE the moat — confirm
        # what else lives there before adding broader --path internal/security.

        # Files that have SECRETS in history get a second pass:
        git filter-repo --invert-paths --path GO_TO_MARKET_PLAN.html
        git filter-repo --invert-paths --path .env --path .env.local

        git push origin --all
        git push origin --tags

Step 3  Trim the private repo to only the SaaS surface.
        cd ../pipewarden  (private — same name retained)
        git filter-repo --invert-paths \
          --path internal/osv \
          --path internal/aicommit \
          --path internal/halludep \
          --path internal/telemetry \
          --path pkg/mcp \
          --path integrations/claude-code \
          --path integrations/cursor-mcp \
          --path packaging/homebrew \
          --path scripts/install.sh \
          --path scripts/update-homebrew-formula.sh
        # NOTE: only the duplicate copy is removed; types in
        # internal/analysis/analysis.go etc. become imports.

        # Update go.mod:
        #   require github.com/finsavvyai/pipewarden v1.0.0
        # Replace direct imports of the now-public packages.
        find . -name '*.go' -exec sed -i '' \
          -e 's|"github.com/finsavvyai/pipewarden/internal/osv"|"github.com/finsavvyai/pipewarden/internal/osv"|g' \
          # …repeat for every moved package… {} \;
        # (sed is a no-op since the import path stays the same — the
        # only change is that those packages are now resolved via the
        # public Go module, not local files.)

        # Rename the private module path to avoid the same-name clash:
        # go.mod  module github.com/finsavvyai/pipewarden  → module github.com/finsavvyai/pipewarden-saas
        # …then `gofmt -w` and `go mod tidy`.

        git remote set-url origin git@github.com:finsavvyai/pipewarden-saas.git
        gh repo rename pipewarden-saas

Step 4  Re-create the public Action / Marketplace listing pointing at
        the public repo's release tarballs.

Step 5  Update GitHub Action consumers:
        - users(@v1)  →  uses: finsavvyai/pipewarden-cli@v1
          (publish a v1 alias tag on the new repo so old refs auto-rewrite)

Step 6  Re-run `make smoke` in both repos. Tag `v1.0.0` on the public repo.
        Goreleaser publishes brew + tarballs + cosign-signed binaries.
```

---

## 5. CI changes

### Public repo (`pipewarden-cli`)
- Keep `.github/workflows/ci.yml` (test/lint/security) — runs on every PR.
- Keep `.github/workflows/release.yml` — fires on `v*` tag.
- Keep `.github/workflows/sbom.yml`.
- NEW: dependabot config can stay; PRs welcome from the public.

### Private repo (`pipewarden-saas`)
- Keep CI, drop the public-only jobs (Marketplace, homebrew tap update).
- Add a "verify public module" step that fetches the latest tag of
  `github.com/finsavvyai/pipewarden` and runs the SaaS build against it.
  Catches breaking changes the moment the public side ships them.

---

## 6. Risks + mitigations

| Risk | Mitigation |
|---|---|
| Internal docs leak via history rewrite mistake | Snapshot in step 0; verify `git log --all` on the public side has zero hits for `Anthropic`, `cfat_`, `Claude prompt`, `GO_TO_MARKET`, `customer` before pushing |
| Competitors fork the rules engine | Acceptable — heuristic rules are not the moat, the *Claude prompts + tier routing + cost model* are |
| Two CI pipelines drift | The "verify public module" step in private CI tests the boundary every commit |
| Existing GitHub Action users break | Publish a v1 alias tag on the new public repo + keep the old private one redirecting via a README note for 90 days |
| Public OSV/halludep packages used in private SaaS go through public Go module proxy | Acceptable — public modules cache fine on proxy.golang.org |
| Some test fixtures reference Anthropic key paths | `git filter-repo` pass to redact `sk-ant-api03-` blob content from history (covered in step 2) |

---

## 7. Open questions for owner

1. **Repo names.** Going with `pipewarden-cli` (public) + `pipewarden-saas` (private). If you'd rather the public one be just `pipewarden` (cleaner brand, matches the binary name), rename the *current* repo to `pipewarden-saas` first, then create `pipewarden` fresh — slightly more dance but the public name reads better. The Go module path can stay `github.com/finsavvyai/pipewarden` either way.
2. **License.** README says MIT. Confirm MIT for the public CLI. Apache 2.0 is more common in DevSecOps but MIT is fine.
3. **Contributor agreement.** Need a CLA on the public repo? If you ever want to relicense or sell the OSS rules engine: yes. Apache 2.0 + DCO is the lighter alternative.
4. **Will the OpenSRE bridge live in the public CLI?** YES per ground-truth check: `internal/webhooks/opensre_sender.go` is just a signed HMAC POST sender with no SaaS coupling. Final confirmation needed.
5. **`pkg/mcp/` tool schemas in the open?** Schemas include `pipewarden_compliance` which advertises the Team-tier compliance-pack feature. The schema definition is fine to publish; the implementation stays private. Final confirmation needed.
6. **NEW: `internal/tracing` in the open?** Required by `cmd/pipewarden/trace.go` (the `pipewarden trace` subcommand). Either move tracing public (recommended — it's a leaf, no SaaS leakage) or drop the `trace` subcommand from the OSS binary. Pick.
7. **NEW: `internal/metrics` in the open?** Same situation — leaf package, used by the cost summary handler (which stays private). Public side doesn't *need* it after we move Claude code out, but harmless to publish since hosted handlers will import it. Recommend public for symmetry with clawpipe.
8. **NEW: `internal/storage` ships full SQLite schema in the open.** All 21 tables (users, sessions, passkeys, recovery codes, billing, etc.) become public. Is that acceptable? They reveal the data model but not the hosting infra. Most OSS tools do this (Gitea, Forgejo, etc.). Recommend yes.
9. **NEW: Refactor commit landing strategy.** Step PRE-1 is a substantial in-tree refactor (~3 file moves + package rename + cmd entry split). Land as a single squashed commit on main, or a stack of 4 small PRs? Single squash is faster; PR stack is safer for review.

---

## 8. What lands when

| Day | What |
|---|---|
| 0 (today) | Owner confirms scope + answers section 7 |
| 1 | Snapshot, run `git filter-repo` steps locally, verify zero leak |
| 2 | Push public repo, run `make smoke`, tag v1.0.0, release |
| 3 | Update Homebrew tap, install.sh works against new releases |
| 4 | Update GitHub Marketplace listing |
| 5 | Update Claude Code skill marketplace + Cursor MCP registry submissions |
| 6 | Rename private repo, update its CI, kick a green build |
| 7 | Write the launch blog post: "We split PipeWarden into open-core. Here's exactly what's in each." → HN traction angle |

Reads like a week. Realistic for one person + this plan.

---

## 9. What this plan deliberately omits

- Migration of issues + PRs from the current repo (do that manually for
  any open issue; close anything stale).
- Renaming Docker Hub images (separate task; new namespace
  `pipewarden/cli` vs `pipewarden/saas`).
- Customer-facing repo URL change in onboarding emails — there are no
  customers yet so this is a noop today.
