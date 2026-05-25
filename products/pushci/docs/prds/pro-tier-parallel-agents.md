# PRD: Pro Tier — Hosted Parallel Agents Alongside Local CI

**Status:** Draft for review
**Author:** roadmap-2026-05-16
**Tracks issue:** #23
**Last updated:** 2026-05-16

## Problem

PushCI's free tier already does what most paying CI customers wish
they had: zero-config, runs on your machine, $0/run. Adoption is
healthy, but the gap between "individual developer wins" and "team
pays us money" is wide. We need a monetization surface that does
not betray the open-core promise:

> **The local CLI must remain fully usable without any paid
> feature.** This is the anti-Earthly rule. Earthly's CLI was so
> good that nobody needed to pay; they died trying to monetize
> the runtime itself.

The Pro tier candidate: **hosted parallel agents** that run
*alongside* a developer's local pipeline. While `pushci run`
exercises unit tests on the laptop, hosted agents in parallel
exercise:

- Flaky-test detection (re-run failures across 3 different
  CPU/RAM/locale combinations the laptop cannot easily produce)
- Security scan (PipeWarden's Claude analyzer, currently
  optional and BYOK; with Pro it's bundled and on by default)
- AI diagnose against the same commit — pulls in repo history,
  cross-references prior failures, surfaces the most likely
  root cause before the developer even sees the failure
- Cross-platform smoke (Linux/macOS/Windows matrix without
  emulator pain on each developer machine)

Results stream back to the dashboard. The developer keeps their
local feedback loop fast; the team gets coordinated, deeper
analysis they can't get from a laptop alone.

## Who this is for

- **Target tier:** existing Pro ($9/mo) is individual-focused.
  The parallel-agents surface lives in **Team ($29/seat/mo)**.
  Free and Pro stay unchanged in their *capabilities*; Team gets
  the new surface as an opt-in.
- **Target workflow:** teams of 3–50 engineers shipping a
  monorepo or a small constellation of services. Smaller than
  that, you're closer to "individual + collaborators" and the
  Pro tier already covers it. Bigger than that, Enterprise
  ($25/user/mo+) is the right shape and SCIM/SAML are the
  hooks.
- **Anti-target:** OSS maintainers and individual developers.
  The free + Pro path must continue to do everything they need.

## Anti-Earthly check

| Capability | Free | Pro ($9) | Team ($29/seat) | Enterprise |
|---|---|---|---|---|
| Local `pushci run` | ✅ | ✅ | ✅ | ✅ |
| Local `pushci heal` (AI diagnose, BYOK) | ✅ | ✅ | ✅ | ✅ |
| Local `pushci scan` (PipeWarden heuristic) | ✅ | ✅ | ✅ | ✅ |
| Local `pushci deploy <target>` | ✅ | ✅ | ✅ | ✅ |
| Dashboard | ❌ | ✅ | ✅ | ✅ |
| 22 deploy drivers | ✅ | ✅ | ✅ | ✅ |
| SSO/SAML/SCIM/audit | ❌ | ❌ | partial | ✅ |
| **Hosted parallel agents** | ❌ | ❌ | ✅ | ✅ |
| Hosted flaky-detection | ❌ | ❌ | ✅ | ✅ |
| Hosted security scan (Claude analyzer) | BYOK | BYOK | bundled | bundled |
| Hosted cross-platform matrix | ❌ | ❌ | ✅ | ✅ |

**The rule:** Nothing in the "Local" rows ever degrades because
a team did not pay. If a developer joins a Team-tier org but
runs `pushci` from a personal laptop on a public OSS fork, every
local command keeps working at full fidelity.

## Pricing model

- **$29/seat/month**, billed monthly with annual discount.
- Comp range: Buildkite $25/seat, CircleCI $30/seat, GitHub
  Enterprise Cloud $21/seat (but compute is metered on top —
  the seat fee for them is just the access fee). PushCI at $29
  bundles seat + parallel agents + dashboard; metered compute
  is still $0.
- **Free seats up to 3** within a Team org — so a 3-person team
  can demo the surface end-to-end before paying. Lemon Squeezy
  already supports per-tier seat counts, so this is config, not
  code.
- **Bring your own Anthropic / Groq / DeepSeek key** stays
  supported; the bundled-AI option exists for teams that don't
  want a separate AI-vendor relationship.

## Technical sketch (which existing surfaces to reuse)

- **Cloudflare Workers API** (existing, `api/src/index.ts`,
  81 routes): adds a new mount `/agents/v1/*` for agent task
  creation, status polling, result fetch.
- **`agent-platform/` Rust workspace** (existing, 4 crates):
  this is exactly the runtime it was built for. `runtime` +
  `server` host the multi-tenant boundary; `toolpack-pushci`
  exposes the PushCI tools to the agent (scan, run, deploy
  dry-run); `tools` is the registry. Today the workspace is
  unwired from Pro/Team; this PRD wires it as the first paid
  tenant.
- **Runner fleet** (existing concept, `internal/runner/`):
  hosted runners on Hetzner VPS pool, autoscaled by job count.
  Same runner code as self-hosted — only the placement and the
  billing label differ.
- **Dashboard** (existing, `web/dashboard/`, 29 pages): adds
  a new "Parallel Runs" tab per commit. Result stream renders
  via existing run-detail components, just with multiple
  parallel result panes.

No new languages, no new providers, no new infrastructure
categories. Everything is wiring existing surfaces together.

## Failure modes

| Failure | What happens today | What must happen with Pro |
|---|---|---|
| Hosted agent service is down | N/A | Local `pushci run` still works; dashboard shows "agents unavailable, retrying" |
| Agent quota exhausted on bundled AI | N/A | Falls back to BYOK key if set; otherwise surfaces "AI bundle used up, BYOK or upgrade" |
| Customer's repo is private with no access token | Wrangler/git fail | Agent surfaces "can't clone — set PUSHCI_GIT_TOKEN" with a deeplink to settings |
| Cross-platform Windows runner unhealthy | N/A | Job marked "windows: skipped — runner pool issue", does not fail the overall PR check |
| Customer triggers 100s of parallel agents per minute | N/A | Token-bucket rate limit at the org level, surfaces "throttled, queued" |
| BYOK AI provider returns 429 | Local `pushci heal` errors out | Hosted agent transparently switches to the bundled provider; commit notes the swap |

## 90-day rollout

1. **Wk 1–2:** Wire `agent-platform/` `runtime` + `server` into
   the Workers API behind a feature flag. Tenant boundary
   enforced via Workers KV (org_id → allowed-toolpack-set).
   Internal test against PushCI's own monorepo.
2. **Wk 3–4:** Hosted flaky-detection MVP. Runs the same commit
   3× with shuffled test order on a Linux + macOS + Windows
   runner. Reports flakiness % per test in the dashboard.
3. **Wk 5–6:** Hosted security scan. Same PipeWarden engine,
   no BYOK required; bundled Anthropic via Claw Gateway.
4. **Wk 7–8:** Hosted AI diagnose. Reads the same context as
   local `pushci heal`, runs on commit-time, results stream to
   dashboard.
5. **Wk 9–10:** Closed beta with 5 design-partner teams.
   Feedback loop: weekly office hours, dedicated Slack channel.
6. **Wk 11–12:** Public Team-tier launch on Lemon Squeezy.
   Landing page section, Curb-voice headline, comparison
   matrix vs Buildkite/CircleCI.

## Out of scope (for this PRD)

- Cross-org sharing of parallel-agent results (i.e. a public
  result page for OSS projects). Tracked separately under the
  Marketplace PRD — #24 — because the surface area is mostly
  trust and discovery, not runtime.
- Self-hosted Team-tier (running parallel agents on the
  customer's own infrastructure). Possible Enterprise lever
  later; not on the 90-day path.
- Marketplace billing — paid templates, revenue share. Same
  reason: separate PRD, separate surface.

## Open questions

- **Quota model on bundled AI:** flat token allowance per seat
  per month vs metered with cap? Recommend flat allowance
  (10M tokens/seat/mo Sonnet-equivalent) for forecastability.
- **Runner pool sizing:** start with 10 always-warm Linux + 4
  macOS + 2 Windows? Need cost model from Hetzner + MacStadium
  + Vagrant-on-Hetzner before committing.
- **Per-commit pricing for non-Team orgs:** worth offering a
  pay-as-you-go path (per-commit hosted agent run, $0.50/commit)
  for individual Pro users who want to try? Risk: cannibalises
  Team. Recommend: no, keep the wall clean.
