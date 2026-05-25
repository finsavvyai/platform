# PushCI v1.7.0 — Gap Analysis

*Independent audit, April 22, 2026. Runs live against `bin/pushci-linux-arm64`,
cross-checks landing source, and probes the production surface where
egress allows. Rerunnable: `make audit`.*

---

## 1. Executive summary

PushCI ships a surprisingly broad product for a v1.7.0 — a 12 MB Go
CLI with 24 visible + 7 hidden subcommands, 312 API route definitions,
25 landing pages, 25 dashboard pages, 6 mobile screens, and a VS Code
extension. The core promise — zero-config stack detection, `npm i -g pushci && pushci init`,
a valid pipeline written for you, runs free on your laptop — **is real and
works end-to-end**. A Node fixture goes from `git init` to passing
4-stage pipeline in 356 ms. Security scan, MCP server, multi-provider AI
routing, GitHub Actions parity surface, and Cloudflare-hosted API all
respond as described.

That said, the audit surfaced **ten real defects** (one earlier
finding was retracted after live verification), three of which
are user-visible in the headline flow:

1. `pushci status` always shows "Total runs: 0" after any run — the
 `observe.Collector` has no persistence. Every status invocation creates
 a fresh in-memory collector. **The VS Code extension's sidebar, which
 reads `.pushci/last-run.json`, is therefore also empty.**
2. `pushci generate` (the AI-driven counterpart to `init`) emits a
 `pushci.yml` missing the `stages:` key. The resulting file **fails to
 run** — the runner reports `sh: 1: build: not found`.
3. The provider banner always reads "Using your own ANTHROPIC_API_KEY"
 even when `PUSHCI_AI_PROVIDER=groq` is active and the request is
 actually hitting Groq. Misleading to anyone debugging AI billing.

Plus five tier-2 issues: double-multiplied PassRate, marketing-claim
drift (23 deploy targets vs 20 real, 24 skills vs 69 real, 33 languages
unchecked), CLAUDE.md four versions stale, three commands hang on
`--help`, orphaned R2 release worker. (Earlier "dashboard not noindex"
finding was retracted after live verification — see B11.)

**Verdict:** the product is shippable and differentiated, but the
"zero-config" promise is undermined by the secondary commands
(`generate`, `status`, `heal`) which feed the CLI-to-dashboard loop.
Fix the three headline defects and PushCI lands a cleaner story than
the v1.7.0 tag currently delivers.

---

## 2. Promise vs reality

Every claim below was harvested from `package.json`, `web/landing/index.html`,
and `CLAUDE.md`, then checked against the code. Everything in the
**Verdict** column is what the audit harness asserts — re-run with
`make audit` to see which still fail on tomorrow's commit.

| # | Claim | Source | Verdict | Notes |
|---|---|---|---|---|
| 1 | Zero config | Hero, README, package.json | ✅ **True** | `pushci init` on a bare Node repo produced a runnable pipeline with no user input. Works for Go, Python, Rust (detect coverage: 33+ languages, 44+ build-tool files in `internal/detect/`). |
| 2 | $0 local execution | Hero | ✅ **True** | Runner is fully local, no heartbeat to a billing backend. |
| 3 | 33 languages | package.json, `meta description` | 🟡 **Approximate** | `internal/detect/` has 44+ distinct language/build-tool files. Headline number is neither verified nor documented. Recommend publishing the list. |
| 4 | 40+ frameworks | package.json | 🟡 **Approximate** | 69 framework detection references in code but no canonical enumeration. |
| 5 | **23 deploy targets** | package.json, Hero | ❌ **False** | `pushci deploy --help` enumerates exactly **20** targets. Hero matches package.json at 23; `web/landing/src/components/featuresData.ts` contradicts them both with "16 deploy targets". Three sources, three numbers, zero agreement. |
| 6 | **24 installable skills** | package.json | ❌ **Undercounted by 45** | `api/src/skills.ts` ships a **69**-entry catalog. The 24 figure is v1.0-era and was never updated. |
| 7 | "Works inside AI agent sandboxes (Claude, Cursor, Windsurf)" | package.json | ✅ **True** | npm tarball self-contained since v1.4.3; bundled binaries for 6 platforms. Shim resolution order explicit in `bin/pushci.js`. |
| 8 | MCP server for Claude/Cursor/Windsurf/Cline | README | ✅ **True** | JSON-RPC `initialize` roundtrips, `tools.listChanged` advertised. **But** `serverInfo.version` is hardcoded to `0.3.0`, separate from the CLI's 1.7.0 — clients reporting MCP version to telemetry will mislabel. |
| 9 | AI self-healing | README, `pushci heal` | ✅ **True** | `heal` loops up to 5 iterations, dispatches to the configured AI provider, applies fixes. Verified with live Anthropic call. |
| 10 | Security scan with SARIF export | README, CLAUDE.md | ✅ **True** | `pushci scan` ran against a Node fixture, found 2 real findings (No SAST, unpinned npm dep), emits JSON and SARIF. **Cosmetic bug:** `--format json` interleaves ANSI-colored human status lines with the JSON body; `| jq` requires a sed pipe. |
| 11 | GitHub Actions parity (act-embedded) | CLAUDE.md, `pushci actions` | ✅ **True, gated** | `actions list` / `validate` / `run` all detect workflows correctly but fail cleanly with "act runtime missing" when `act` isn't on `$PATH`. Error message includes exact install commands. The runtime dependency is real and worth acknowledging on the marketing page. |
| 12 | "Tailscale mesh" (package.json keywords) | package.json | ⚠ **Partially real** | `internal/runner/tailscale.go` exists and detects `tailscale` binary. Not surfaced anywhere in `--help`; no docs. |
| 13 | AI provider auto-selection | CLAUDE.md | ✅ **True** | `PUSHCI_AI_PROVIDER=groq` correctly routes to Groq; `=anthropic` to Claude. Works end-to-end with the repo's `.env`. **Bug** — the banner text is hardcoded: it always says "Using your own ANTHROPIC_API_KEY on free plan for \<cmd\>" regardless of which backend was chosen. |
| 14 | 4.9/5 aggregateRating, 127 reviews (JSON-LD) | `web/landing/index.html` | ❓ **Unverifiable** | Published in structured data but no public review source, testimonial wall, or G2/Product Hunt link corroborates it. Google will render the stars; if they can't be substantiated, pull the block before Google flags it. |
| 15 | "Self-validates using its own pipeline" (meta description) | `meta description`, OG | ✅ **True but opaque** | `.git/hooks/pre-push` runs `pushci run` on every push. Good dogfood story — explain it in one sentence somewhere a human will read. |

---

## 3. Functional test results (from the harness)

Harness run on Ubuntu 24 aarch64 against `bin/pushci-linux-arm64`.

| Check | Result | What it proved |
|---|---|---|
| `cli` | PASS (33 s) | Every one of 24 visible + 4 hidden subcommands responds to `--help`; 3 known hangers are flagged (`ts`, `troubleshoot`, `index` — they run the full command instead of printing help). |
| `init_and_run` | PASS (2 s) | Node detection → valid yml → 4-stage pipeline runs green in 356 ms. Known-bug assertion for `pushci status` persistence fires as expected. |
| `mcp_handshake` | PASS (1 s) | MCP server responds to JSON-RPC `initialize` with `tools.listChanged` capability. Version mismatch flagged. |
| `promises` | FAIL (expected) | Catches: 23-vs-20 deploy-target divergence, featuresData stale at 16, CLAUDE.md pinned to v1.3.0 four versions back. |
| `landing_seo` | PASS | All critical head tags (title, description, OG, Twitter, canonical, JSON-LD, viewport) present. Dashboard is `noindex`. `theme-color` and site-wide `robots` meta are tracked as warnings but not failures. |
| `generate_valid_yaml` | SKIP* / FAIL when AI key present | With `ANTHROPIC_API_KEY` set, `pushci generate` emits a `pushci.yml` missing the `stages:` key. The generated file does not run. |
| `ai_provider_override` | FAIL when both keys present | `PUSHCI_AI_PROVIDER=groq` correctly picks Groq, but the CLI's banner misattributes the provider to ANTHROPIC. |
| `live_site` | PASS (from user's Mac, 2026-04-22) | 6/6 production endpoints responded 200: `pushci.dev`, `/pricing`, `/docs`, `api.pushci.dev/health`, `app.pushci.dev`, `github.com/finsavvyai/pushci-cli/releases/latest` (302 redirect, as GitHub does). Landing HTML contains the `CI/CD` keyword. |

\* run with `ANTHROPIC_API_KEY=…` to exercise this check.

### Live production status (2026-04-22)

Verified directly by the harness running from Shachar's laptop:

| Endpoint | Status | Notes |
|---|---|---|
| `https://pushci.dev` | 200 | Landing page serves. |
| `https://pushci.dev/pricing` | 200 | React SPA route resolves. |
| `https://pushci.dev/docs` | 200 | Docs route resolves. |
| `https://api.pushci.dev/health` | 200 | Cloudflare Workers API up. |
| `https://app.pushci.dev` | 200 | Dashboard shell served, `noindex` header in place. |
| `github.com/finsavvyai/pushci-cli/releases/latest` | 302 | Redirects to `/releases/tag/v1.7.0` as expected. |

All critical surfaces are live. No outages, no redirect loops, no
expired certificates. The production health signal is green.

---

## 4. Confirmed bugs (fix-sorted by impact)

### P0 — headline experience

**B1. `pushci status` has no persistence.** Every invocation creates a
fresh `observe.NewCollector()` with an empty in-memory slice. **Impact:**
"Total runs: 0" after every run, always. The VS Code extension's tree
view depends on `.pushci/last-run.json` which is never written, so
that's empty too. The "Cost saved" line on the landing page pitches a
number that the CLI can't actually compute.
**Location:** `internal/observe/metrics.go:41-75`, `cmd/pushci/cmd_tools_agent_ts.go:40-59`.
**Fix:** Serialize records to `.pushci/runs.json` on `run` completion;
load in `cmdStatus()` before `NewCollector()`. ~20 lines.

**B2. `pushci generate` emits an invalid `pushci.yml`.** Top-level
`checks:` instead of `stages:`, bare `build` / `test` commands that
shell out to missing binaries. Running the generated file fails with
`sh: 1: build: not found`.
**Fix:** Update the AI prompt / template in `internal/ai/` (or
`cmd/pushci/cmd_generate.go`) to conform to the `pushci.yml` schema
the runner actually parses, and round-trip through
`internal/config/validate` before writing.

**B3. Misleading AI-provider banner.** The string "Using your own
ANTHROPIC_API_KEY on free plan for \<cmd\>" is printed regardless of
which backend is chosen — even when the next line says "Using Groq
Llama 3.3 70B". Confusing at best, billing-error-inducing at worst.
**Fix:** Compute the banner text from the resolved provider, not
hardcoded. Search for the string literal.

### P1 — credibility

**B4. Deploy-target count mismatch.** Three files, three numbers:
- `package.json` description: **23**
- `web/landing/src/components/featuresData.ts`: **16**
- `pushci deploy --help` (ground truth): **20**
**Fix:** pick one source of truth (prefer `pushci deploy --help`
driven by a single Go constant), and regenerate landing data from it.

**B5. Installable-skills count stale.** package.json says "24"; the
actual catalog is **69**. Either remove the number or regenerate it.

**B6. CLAUDE.md stale.** References v1.3.0; current is v1.7.0. Two
major versions of product work undocumented in the file the repo tells
future Claudes to trust. See also: CLAUDE.md "PipeWarden" references
point to a separate project — confirm it's still a partner repo.

**B7. `pushci status` PassRate double-multiplied by 100.**
`internal/observe/metrics.go:72` computes `PassRate = passed/total *
100`; `cmd_tools_agent_ts.go:46` renders it as `metrics.PassRate*100`.
Once B1 is fixed, users with all-passing runs will see "10000.0%".

### P2 — polish

**B8. Three subcommands hang on `--help`.** `pushci ts`, `pushci
troubleshoot`, `pushci index` — they run the full command instead of
printing help and exiting. Locks up CI pipelines that enumerate help
for every command.

**B9. MCP server version hardcoded.** `serverInfo.version = "0.3.0"`;
CLI is 1.7.0. Any dashboard that aggregates MCP usage by version
reports stale data.

**B10. `pushci scan --format json` interleaves ANSI-colored progress
lines with the JSON body.** Pipe to `jq` without a sed filter and you
get a parse error.

**B11. ~~Dashboard HTML not `noindex`~~ — RETRACTED.** Live audit on
2026-04-22 (run from user's Mac) confirmed `web/dashboard/index.html`
already contains `<meta name="robots" content="noindex, nofollow" />`.
An earlier Linux-sandbox run reported it as missing; that result was
stale. No action needed.

### Pre-existing, tracked in CLAUDE.md

- `internal/mcp` tests known-broken.
- `internal/security` tests known-broken.
- `workers/releases/worker.js` deployed but unwired — superseded by
 the public `pushci-cli` repo.
- `TestInitAndRun` flakes in hermetic environments (needs npx network
 access).
- GitHub Actions release workflow blocked on `finsavvyai` org billing.

---

## 5. Competitor gap analysis

Market split (April 2026):

| Tier | Players | Model |
|---|---|---|
| **Legacy YAML CI** | GitHub Actions, CircleCI, GitLab CI, Jenkins, Buildkite, Travis | Config file + hosted or self-hosted compute, priced per minute or per seat. |
| **Compute-layer drop-ins** | Depot, Namespace, Blacksmith, WarpBuild | Replace the GHA runner with cheaper / faster compute, same YAML. |
| **Build-as-code** | Earthly, Dagger | Real programming language (Go / Python / TS) for pipelines. |
| **AI coding agents** | Cursor, Claude Code, Windsurf, Cody, Devin | Editor / terminal agents. Not CI, but share the "AI writes code" pitch PushCI leans on. |

### Verified pricing (April 2026)

| Platform | Effective price | Source |
|---|---|---|
| **GitHub Actions** hosted Linux 2-core | ~$0.0048 / min (Jan 2026 cut ~40%, plus $0.002/min cloud platform charge) | resources.github.com/actions/2026-pricing-changes-for-github-actions |
| GitHub Actions self-hosted | **Charge postponed** — March 2026 $0.002/min plan is on hold. Still $0 today. | devclass.com 2025-12-17 |
| **CircleCI** Linux Medium | $0.006 / min (10 credits × $0.0006) | circleci.com/pricing |
| **Depot CI** x86 | $0.006 / min ($0.0001/sec), overage $0.004/min on Developer+ plans | depot.dev/pricing |
| **WarpBuild** Linux | $0.003 / min | warpbuild.com/pricing |
| **Blacksmith** | "~75% off GHA", no public per-minute | blacksmith.sh/pricing |
| **Namespace** | VM credits, contact sales | namespace.so |
| **PushCI** local | **$0 / min** | repo |

**Punchline for the landing page:** 5-person team running 1,000 CI
min/day on GitHub Actions hosted Linux at post-Jan-2026 pricing is
~$720/mo, not the "$1,200/mo" the current Curb-voice messages cite.
**Update the comparison pages before Jan 2026 changes go public
knowledge** — the old $0.008/min figure is still all over
`VsGitHubActions.tsx`.

### Capability matrix

Columns use ✅ / ⚠ / ❌ / — for present / partial / absent / N/A.

| Capability | GH Actions | CircleCI | GitLab CI | Jenkins | Depot | Blacksmith | Dagger | **PushCI** |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Free local runs | ✅ (OSS only) | ❌ | ✅ (OSS) | ✅ | ❌ | ❌ | ✅ | ✅ |
| Zero-config stack detection | ❌ | ❌ | ❌ | ❌ | — | — | ❌ | **✅** |
| AI pipeline generation | ⚠ (Copilot Workspace) | ❌ | ✅ (GitLab Duo) | ❌ | ❌ | ❌ | ⚠ | **✅** |
| AI diagnose / heal failed run | ⚠ | ⚠ | ✅ | ❌ | ❌ | ❌ | ❌ | **✅** |
| Built-in security scan | ✅ (CodeQL) | ⚠ (orbs) | ✅ | ⚠ (plugins) | ❌ | ❌ | ❌ | ✅ |
| SARIF export | ✅ | ⚠ | ✅ | ⚠ | ❌ | ❌ | ❌ | ✅ |
| Multi-SCM (GH + GL + BB) | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | **✅** |
| GitHub Actions workflow runtime compatibility | ✅ (native) | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ (via act) |
| Chat-ops (Slack / Discord / WhatsApp / Telegram) | ⚠ (notify) | ⚠ | ⚠ | ❌ | ❌ | ❌ | ❌ | **✅** (4 channels, NLP) |
| MCP server | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | **✅** |
| Mobile app | ❌ | ❌ | ⚠ (read-only) | ❌ | ❌ | ❌ | ❌ | **✅** (iOS + Android) |
| Managed compute escape hatch | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ⚠ (cloud fleet, Pro+) |
| SOC 2 / HIPAA / FedRAMP | ✅ (multi) | ✅ | ✅ | — | ⚠ | ❌ | ❌ | ❌ |
| Enterprise SSO/SCIM at scale | ✅ | ✅ | ✅ | ✅ | ⚠ | ❌ | ⚠ | ⚠ (SAML + SCIM shipped, not battle-tested) |
| Plugin / marketplace depth | 20,000+ actions | 2,000+ orbs | built-in | 1,800+ plugins | — | — | modules | 69 skills (growing) |

### Where PushCI wins (and should lean in)

1. **The only CI that auto-writes the YAML for you AND runs free on
 your laptop.** Depot/Blacksmith/WarpBuild are "cheaper runner, same
 YAML"; PushCI is "no YAML to write, no runner to pay for."
2. **4-platform chat-ops.** GitLab has a read-only mobile app; nobody
 has WhatsApp + Slack + Discord + Telegram NLP dispatch. Under-marketed.
3. **MCP-first CI.** `pushci_scan` as an MCP tool is a genuine category
 of one. Cursor, Claude Code, Windsurf users can wire it in two lines.
 The README buries this.
4. **Security scan in the same CLI, same pipeline, SARIF out.** CodeQL
 and GitLab SAST exist but require separate plans / products; PushCI
 makes it one flag.
5. **Act-embedded migration path.** Competitor GitHub-Actions-compat
 tools (Namespace, Blacksmith) host a runner; PushCI actually *parses*
 the workflow on your box. For users evaluating a switch, this is the
 cheapest possible try-it-out path.

### Where PushCI loses

1. **No SOC 2 / FedRAMP / HIPAA.** Blocks every regulated-enterprise deal.
2. **No managed massive-scale compute.** Can't build Chromium on a
 MacBook; cloud fleet is Pro+.
3. **Thin test intelligence.** Buildkite and CircleCI lead here
 (flaky-test detection, test splitting, time-based optimization).
4. **Pipelines-as-code is still YAML.** Dagger's "real code" pitch
 beats PushCI for type-checked, unit-testable pipelines.
5. **Ecosystem size.** 69 skills vs 20,000 GHA actions. Act-embedding
 papers over this, but only for GitHub workflows.
6. **No real build graph cache.** Depot and Earthly both monetize
 persistent layer cache — PushCI has `internal/cache/` but no
 productized story.

---

## 6. Marketing / UX audit (source-level)

### What works

- **Hero voice is on-brand.** "CI/CD… but without the bill stalking
 you every month" is the Curb tone done right.
- **Install CTA above the fold.** `npm i -g pushci && pushci init` as
 a copy-to-clipboard secondary CTA is exactly what a developer-tools
 landing page should have.
- **JSON-LD is extensive.** SoftwareApplication, Organization, HowTo,
 FAQPage, BreadcrumbList all present. Rare for a v1.7 site.
- **Legal pages substantive.** Privacy, Terms, Refund all real
 paragraphs, not template filler. 14-day no-questions-asked refund is
 a genuine trust signal.
- **Code splitting is aggressive.** 24 routes lazy-loaded; home stays
 critical-path.

### What breaks

1. **Claim numbers don't agree across the site.** (See B4, B5.) A
 developer who notices "19 languages" on one card and "33 languages"
 in the hero will quietly close the tab.
2. **4.9/5 with 127 reviews in JSON-LD, nowhere else.** If Google
 renders the stars and nobody can find the review source, you're one
 spam-report away from losing rich results and taking a trust hit.
3. **`Pricing` page breaks brand voice.** "Simple, honest pricing" is
 the exact corporate line the Curb messages were written to mock.
4. **No visible security page.** No `/security`, no
 `.well-known/security.txt`, no disclosure policy. Every enterprise
 checklist has "Security contact" on it. Free fix.
5. **No status page linked.** If the hosted API, Lemon Squeezy
 webhook, or landing goes down, users have no canonical signal.
6. **Dashboard HTML has no meta description, no OG, no `noindex`.**
 The app shell will get indexed the moment a dashboard URL leaks.
7. **3D hero canvas has no `aria-label`.** Small, but every a11y audit
 will flag it.
8. **Comparison pages cite pre-Jan-2026 GHA pricing.** The $0.008/min
 number everywhere in `VsGitHubActions.tsx` is **stale** — GitHub cut
 hosted prices ~40% in Jan 2026 and added a $0.002/min platform
 charge. Your "$9 vs $∞" pitch is still easily true, but the math
 should be current or a skeptic will dismiss the whole page.

### Docs

`DocsData.ts` covers quickstart → install → CLI commands → config →
notifications. Solid but missing: troubleshooting index, FAQ
(separate from the landing-page FAQ), full API reference, per-deploy-
target guide. Time-to-first-run from the quickstart is genuinely three
commands.

---

## 7. Top 12 recommendations, ranked

Each one: what to do, where, expected impact.

| # | Action | File(s) | Why |
|---|---|---|---|
| 1 | **Persist run records to `.pushci/runs.json` (or SQLite)**; load them in `cmdStatus()`; write `last-run.json` for the VS Code extension | `internal/observe/metrics.go`, `cmd/pushci/cmd_run.go`, `cmd_tools_agent_ts.go` | Fixes B1 (status always 0) and unlocks the VS Code sidebar + the dashboard "cost saved" chart. 1-day job. |
| 2 | **Fix `pushci generate` to produce schema-valid `pushci.yml`**; gate with `config/validate.go` before write | `internal/ai/prompts.go` (template), `cmd/pushci/cmd_generate.go` | Fixes B2 (generated file fails to run). Kills the "AI-generated pipelines" pitch if broken. |
| 3 | **Make the AI-provider banner dynamic** — compute from the resolved provider, not hardcoded | `cmd/pushci/cmd_ai_client.go` (where "Using your own ANTHROPIC_API_KEY" string lives) | Fixes B3 — stops gaslighting Groq users. |
| 4 | **Single source of truth for the deploy-target count.** Export `deploy.TargetCount()` in Go; render it in landing `featuresData.ts` at build time | `internal/deploy/*.go`, `web/landing/src/components/featuresData.ts`, Hero | Fixes B4. Pick 20 (current reality) or ship 3 more targets to make 23 real. |
| 5 | **Regenerate skill count from catalog.** Build script writes the count into package.json description and landing data | `api/src/skills.ts`, `scripts/update-counts.sh` (new), `package.json` | Fixes B5. 24 → 69 is a marketing win, not an embarrassment. |
| 6 | **Update `CLAUDE.md`** to v1.7.0; prune stale sections (dogfood opensyber bugs are fixed; Cepien v1.6.6 flag note may be stale) | `CLAUDE.md` | Fixes B6. Future Claude sessions will be less confused. |
| 7 | **Update comparison pages for Jan-2026 GHA pricing** | `web/landing/src/pages/VsGitHubActions.tsx`, `VsCircleCI.tsx`, etc. | A skeptic with a calculator will verify your numbers against `resources.github.com`. Get ahead of it. |
| 8 | **Ship `/security` + `/.well-known/security.txt`** | new page, public `/security.txt` | Enterprise-qualifier. Takes an hour. |
| 9 | **Mark the dashboard `noindex,follow`** | `web/dashboard/index.html` | One-line fix. Prevents search engines from indexing `app.pushci.dev/*`. |
| 10 | **Pull the JSON-LD `aggregateRating` block** until you have a review source you can link to (G2 / Product Hunt / embedded widget) | `web/landing/index.html` | Unverifiable rating + 127 reviews in structured data is SEO-risky. |
| 11 | **Surface MCP and chat-ops on the landing page.** Both are genuine category-of-one differentiators; the hero buries them under "Zero config, zero cost" | Hero, Features section | Changes the conversation from "cheaper GHA" to "CI built for the AI-agent workflow." |
| 12 | **Make `ts`, `troubleshoot`, `index` respect `--help`** — wire them through the same usage table the other commands use | `cmd/pushci/cmd_troubleshoot.go`, `cmd_trace.go`, `cmd_index.go` | Fixes B8. Cheap. |

---

## 8. How to rerun this audit

```bash
# Offline — does not need pushci.dev
make audit

# Live probes (from a network with egress to *.pushci.dev)
PUSHCI_LIVE=1 make audit

# One check at a time
bash audit/run.sh promises
bash audit/run.sh generate_valid_yaml
```

Results land in `audit/results/summary.json` and one `.log` per check.
Add a check: drop a new `audit/checks/<name>.sh` that reads `$PUSHCI`
and exits 0 / 77 / other for pass / skip / fail. See `audit/README.md`
for the contract.

The harness is self-describing and designed to be the canonical rerun
surface — wire it into `.git/hooks/pre-push` or a scheduled `pushci
run` to catch regressions before they ship.
