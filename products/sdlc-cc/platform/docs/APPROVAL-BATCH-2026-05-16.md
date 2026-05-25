# Approval Batch — Launch-Sprint External Actions (2026-05-16)

Every external-facing action queued by the Wave 1-4 autopilot is
listed below. Nothing has been pushed, deployed, or sent. Approve
in batch (or item-by-item) and I'll execute.

## Summary

| Bucket | Items | Status |
|---|---|---|
| **Code commit** | 1 — the whole pivot landing as commits | Ready |
| **Cloudflare Pages deploy** | 1 — landing-page/ to sdlc.cc | Ready (needs domain config check) |
| **LemonSqueezy products** | 4 SKUs (commercial license, setup, support, sponsor) | Ready (needs LS API key) |
| **Dev.to publishes** | 3 article drafts (technical, Curb, Seinfeld) | Ready (needs Dev.to API key) |
| **GitHub release** | v0.1.0 tag + GitHub release notes | Ready |
| **Awesome-list PRs** | 5 PRs to awesome-LLM / awesome-llmops / awesome-AI / awesome-self-hosted / awesome-legal-tech | Drafted but not opened |
| **Reddit posts** | 2 — r/LawFirm, r/lawyers (template ready) | Held — community-sensitive |
| **HN Show HN** | 1 post | Held — single shot, time it well |
| **Product Hunt launch** | 1 launch | Held — choose date |
| **Cold-email send** | 50 firm CTOs (manual, per template) | Held — needs target list |
| **Newsletter pitches** | 4 — Lawsites, ATL, Legaltech News, Law360 | Drafts only |
| **DLP migration follow-up** | 1 — add `tenant_dlp_policy.legal_preset` boolean | Code-ready |
| **README + OSS hygiene** | README rewritten, CONTRIBUTING / SECURITY / FUNDING.yml | Done |

---

## Bucket 1 — Code commit

**Action:** Commit and push everything from this session as a single
or split commit set.

**Files changed (summary):**
- Direction docs: `CLAUDE.md`, `STATUS.md`, `SUNSET.md`, `README.md`,
  `ROADMAP.md`, `LICENSE` (replaced with AGPL-3.0), `COMMERCIAL.md`
- New pivot doc: `docs/PIVOT-2026-05-16-LEGAL-AI.md`
- Research: `docs/research/2026-05-16-legal-ai-competitive-depth.md`
- Brand: `docs/brand/2026-05-16-brand-kit.md`
- DLP: 5 Go files + 2 test files + `docs/dlp/legal-patterns.md`
- Landing: 9 components + 3 modified files (Pages Router)
- Pricing: 4 files under `landing-page/src/app/pricing/`
- AI-discovery: 7 files under `landing-page/public/`
- Outreach: 10 files under `docs/marketing/outreach/`
- Dev.to drafts: 3 files under `docs/marketing/devto-drafts/`
- LemonSqueezy spec: 2 files under `docs/lemonsqueezy/`
- Memory: `memory/project_pivot_2026_05_16_legal_ai.md`

**Approval needed:** "commit it" (single commit) or "split commits"
(I'll group by concern: pivot docs, license, DLP code, landing,
pricing, outreach, marketing).

## Bucket 2 — Cloudflare Pages deploy

**Action:** Deploy `landing-page/` to `sdlc.cc` via wrangler.

**Pre-deploy checks needed:**
- Confirm `wrangler.toml` is pointed at the right Cloudflare account
- Confirm `sdlc.cc` DNS is still on Cloudflare
- Confirm `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` env is unset for first
  deploy (so the analytics stub stays silent)
- Add `./src/**/*.{ts,tsx}` to `tailwind.config.ts` content glob so
  the new pricing page styles compile (one-line tweak)

**Approval needed:** "deploy landing" — and confirm I should also
add the tailwind glob update.

## Bucket 3 — LemonSqueezy products

**Action:** Create 4 products from `docs/lemonsqueezy/products.json`
using the LemonSqueezy API. After products land, paste the variant
IDs into the landing-page `PLACEHOLDER_*` slots.

**Products:**
1. Commercial License — Annual (4 variants: 1/5/10/50 seats)
2. Setup Engagement — $5,000 one-time
3. Support Contract — Monthly (3 tiers: $500/$1,000/$2,000)
4. Sponsor — PWYW (optional, min $5)

**Approval needed:** "create LS products" + LS API key in env
(or paste here so I can use it for this call only).

## Bucket 4 — Dev.to publishes

**Action:** Set `published: true` and push to Dev.to via the API.
Schedule one per week so a single bad post doesn't burn the audience.

**Order suggestion:**
- Week 1: Technical (`01-technical-self-host.md`) — leads with
  Heppner + DLP code
- Week 2: Seinfeld (`03-seinfeld-style.md`) — softer, broadens reach
- Week 3: Curb (`02-curb-style.md`) — the in-group humor article

**Approval needed:** "publish dev.to week N" with Dev.to API key.

## Bucket 5 — GitHub release v0.1.0

**Action:** Tag the commit `v0.1.0`, push the tag, create a GitHub
release with the AGPL-3.0 disclosure + commercial-license note +
link to the technical Dev.to article + link to `COMMERCIAL.md`.

**Approval needed:** "tag v0.1.0".

## Bucket 6 — Awesome-list PRs

**Action:** Open PRs against these lists:

- `awesome-llm` ([github.com/Hannibal046/Awesome-LLM](https://github.com/Hannibal046/Awesome-LLM))
- `awesome-llmops` ([github.com/tensorchord/Awesome-LLMOps](https://github.com/tensorchord/Awesome-LLMOps))
- `awesome-ai-tools` ([github.com/mahseema/awesome-ai-tools](https://github.com/mahseema/awesome-ai-tools))
- `awesome-selfhosted` ([github.com/awesome-selfhosted/awesome-selfhosted](https://github.com/awesome-selfhosted/awesome-selfhosted))
- `awesome-legaltech` (find the active fork — there are several)

**Each PR adds** a single line linking to sdlc-platform under the
relevant section (Privacy, Gateway, Compliance, Self-hosted).

**Approval needed:** "open awesome PRs". I'll prepare the patches
as a single file you can review before each PR is opened.

## Bucket 7 — Reddit posts (held)

**Why held:** Community will flag obvious self-promo. Templates in
`docs/marketing/outreach/04-template-reddit-r-lawfirm.md` lead with
discussion, but you (the human) must choose the moment and post
under your real account.

**Approval needed:** None right now. Posts happen when you decide.

## Bucket 8 — HN Show HN (held)

**Why held:** Single shot. Best timed for a Tuesday-Thursday morning
(US Pacific) after the Dev.to technical article has at least 100
reads. Template ready in
`docs/marketing/outreach/05-template-hn-show-hn.md`.

**Approval needed:** None right now. You post manually.

## Bucket 9 — Product Hunt launch (held)

**Why held:** Schedule a launch date. Suggest **week 4-6** after
the OSS release, so we have GitHub stars + Dev.to traffic + at least
one external user testimonial before launch day. Template ready in
`docs/marketing/outreach/06-product-hunt-launch.md`.

**Approval needed:** Date selection. I'll set up the maker profile
copy when you pick a date.

## Bucket 10 — Cold-email send (held)

**Why held:** Needs a real target list (50 firm CTOs / Directors of
Innovation at mid-market firms). I can build the target list from
public sources (firm websites, LinkedIn public profiles, ABA member
directory) but the human sends each email from a warmed-up domain
to stay below spam thresholds. Templates in
`docs/marketing/outreach/01-template-firm-cto.md` +
`docs/marketing/outreach/07-followup-sequence.md`.

**Approval needed:** "build target list" — I'll spawn a research
agent to compile 50 candidates with public contact info.

## Bucket 11 — Newsletter pitches

**Action:** Send the pitch in
`docs/marketing/outreach/02-template-newsletter-pitch.md` to:

- Bob Ambrogi (Lawsites — `bob@bobambrogi.com`)
- Above the Law editorial (`tips@abovethelaw.com`)
- Legaltech News (`legaltechnews@law.com`)
- Law360 Pulse (`pulse-pitches@law360.com`)

**Approval needed:** "send newsletter pitches" + email setup.
You may want to send these manually from your own address rather
than via API.

## Bucket 12 — DLP migration follow-up

**Action:** Add a migration to `database/migrations/` that adds
`tenant_dlp_policy.legal_preset boolean default false`, and wire
`PgxPolicyLookup` to append `LegalPatterns()` to the `extra` slice
when the boolean is true. The DLP code is migration-agnostic — only
the activation switch is missing.

**Approval needed:** "ship dlp migration".

## Bucket 13 — OSS hygiene

**Already done in this session:**
- `LICENSE` → AGPL-3.0
- `COMMERCIAL.md` — full commercial-license terms
- `README.md` — public-OSS rewrite with Heppner hook
- `CONTRIBUTING.md` + `SECURITY.md` already existed; check before
  the v0.1.0 tag
- `.github/FUNDING.yml` already existed; verify GitHub Sponsors
  tier reads "Sponsor sdlc-platform — keeps the project AGPL"

**Pre-v0.1.0 verifications needed:**
- [ ] SPDX header on every new Go file (DLP files have it; spot-check
      others)
- [ ] No leftover BSL-1.1 references in code comments or docs
- [ ] CLA bot configured on the repo (e.g., CLA Assistant)
- [ ] `.github/FUNDING.yml` matches the OSS-public message

**Approval needed:** "verify OSS hygiene" — I'll run the spot-checks
and report back before the tag.

---

## Human-fill TODOs (across all agent outputs)

Each of these is a placeholder marker the agents left because they
couldn't fabricate. You fill them in before the relevant external
action ships.

| TODO | Where | Used by |
|---|---|---|
| `TODO: human-fill` contact email | `landing-page/public/llms.txt`, `llms-full.txt` | AI-discovery |
| `TODO: human-fill` community link | `landing-page/public/llms-full.txt` | AI-discovery |
| `TODO: human-fill` security email | `landing-page/public/.well-known/ai-plugin.json` | AI-discovery |
| `PLACEHOLDER_SEAT_LICENSE` | `components/law/LawPricing.tsx` + `src/app/pricing/checkout-button.tsx` | LemonSqueezy IDs |
| `PLACEHOLDER_SETUP_ENGAGEMENT` | same | LemonSqueezy IDs |
| `PLACEHOLDER_SUPPORT_CONTRACT` | same | LemonSqueezy IDs |
| `TODO(brand-kit)` font / palette overrides | `pages/_app.tsx`, `styles/globals.css` | Landing |
| Entity address (CAN-SPAM compliance) | `docs/marketing/outreach/01-template-firm-cto.md` | Outreach |
| Sample policy doc | `docs/marketing/outreach/01-template-firm-cto.md` | Outreach |
| Peer-firm permissions | `docs/marketing/outreach/01-template-firm-cto.md` | Outreach |
| Commercial-license one-pager | `docs/marketing/outreach/README.md` | Outreach |

---

## Scheduled loops (post-approval)

Once you approve at least Bucket 1 (commit) and Bucket 2 (deploy),
I'll set up:

- **Weekly metrics loop** — `ScheduleWakeup` every 7 days. Pulls
  GitHub stars / clones, Dev.to article views, Cloudflare Pages
  hits to `/pricing`, LemonSqueezy events, GitHub issue volume.
  Appends a one-line status to `docs/launch-log.md`. Tags any week
  with zero progress so the human can investigate.
- **Monthly cohort loop** — first Monday each month. Cross-correlates
  marketing-channel sources (utm tags from Plausible, referrers from
  GitHub Insights) with `/pricing` hits + LS conversions. Writes a
  cohort report to `docs/cohorts/YYYY-MM.md`.

Both loops are optional. You can disable either at any time.

---

## How to approve

Reply with the bucket numbers you want to ship now. Examples:

- "Approve buckets 1, 13" — commit + OSS hygiene verification only.
- "Approve buckets 1-6" — commit + deploy + LS products + Dev.to
  schedule + GH release + awesome PRs.
- "Approve all reversible (1, 13)" — code commit + hygiene verify;
  everything external held until you choose to ship.

I'll execute the approved buckets in order, report each one, and
queue any new follow-ups that emerge.
