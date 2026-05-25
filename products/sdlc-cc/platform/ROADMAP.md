# Roadmap — Privacy Gateway + 3-Product Trust Bundle (2026-05-20)

> Direction set by [`docs/PIVOT-2026-05-20-PRIVACY-GATEWAY.md`](docs/PIVOT-2026-05-20-PRIVACY-GATEWAY.md).
> Supersedes the 2026-05-16 legal-AI version and the 2026-05-14
> "Path 6 only" sunset version. Both recoverable from git history.

## TL;DR

| Track | What it ships | Earliest revenue | Effort |
|---|---|---|---|
| **A — OSS gateway + AGPL** | `services/gateway` public release with PII/secrets DLP + legal preset | First Team-tier sub in 4-8 weeks | 2 weeks |
| **B — Commercial license** | Buyout of AGPL at $4K+/yr/seat for closed-source embedders | Same as A | 1 week |
| **D — Browser extension** | Chrome/Edge/Firefox/Safari shim that intercepts ChatGPT/Claude/Gemini prompts | Free→paid funnel in ~6 weeks | 2-3 weeks |
| **E — IDE addin** | VS Code + JetBrains + Cursor — scrub prompts before Copilot/Codeium/Cursor | Bundled w/ Team tier | 2 weeks |
| **F — Office addin** | Word + Outlook — scrub before M365 Copilot | Bundled w/ Business tier | 2 weeks |
| **T — Trust Bundle** | Cross-product Trust Center + single MSA for sdlc-platform + AMLIQ + OpenSyber | Enterprise deal unblock | 1 week setup, ongoing |
| **C — Consulting** | $5K setup + $500-2K/mo retainer | First client in 4-8 weeks | Per-client |
| **6 — AMLIQ port** | Move audit/RBAC/DLP/spend into aegis so AMLIQ uses the gateway primitives | None (unlocks bundle) | 1-2 weeks |

Tracks A + B remain the OSS+commercial anchor. **Tracks D + E + F**
are the new distribution surfaces — same Go backend, thin shims.
**Track T** is the bundle wrapper: one Trust Center + one MSA across
all three portfolio products. **Track 6** is now load-bearing for
the bundle, not a side project.

Yr-1 ARR target: **$90-220K solo**, funded by Team-tier extension
subs ($39/seat/mo) + Business tier ($79/seat/mo) + one or two
commercial-license customers + consulting.

---

## Track A + B — OSS gateway + commercial license (2 weeks)

### Phase A1 — Repo hygiene (Days 1-3)
- [x] **A1.1** Swap `LICENSE` to AGPL-3.0; SPDX headers on all Go files.
- [x] **A1.2** Write `COMMERCIAL.md` — dual-license model + buyout terms. *(rewritten 2026-05-20 to tiered model: Free · Team $39/seat/mo · Business $79/seat/mo · Enterprise from $4K/seat/yr)*
- [x] **A1.3** Rewrite `README.md` for OSS-public consumption; hero shot, install steps, AGPL note, commercial CTA. *(rewritten 2026-05-20 for privacy-gateway framing + 3-product Trust Bundle, 174 lines)*
- [x] **A1.4** Update `CONTRIBUTING.md` + CLA requirement.
- [x] **A1.5** `SECURITY.md` disclosure policy.
- [x] **A1.6** `.github/FUNDING.yml` sponsors tier. *(points at finsavvyai org + sdlc.cc pricing CTA)*

### Phase A2 — DLP presets (Days 4-7)
- [x] **A2.1** `pii_default` preset — emails, phones, SSN, credit cards, addresses, names (NER-backed). *(2026-05-22: `dlp_pii_default.go` adds `phone_e164`, `phone_us` (NANP area-code anchored), `us_street_address` (USPS suffix anchored), `us_zip` (label or state-prefix only, bare 5-digit deliberately excluded to avoid order-ID false-positives), `person_name` (honorific-prefixed form only — Dr./Mr./Sen./Capt. etc.). Always-on via `init()` append to global `patterns` — no per-tenant config. 10/10 behaviour tests in `dlp_pii_default_test.go` (positive + false-positive on dates/build numbers/bare capitalised bigrams). Full middleware + gateway test suites green. Production-grade NER (e.g. Microsoft Presidio) remains the documented upgrade path via `Detector.DetectWith(extra)`.)*
- [x] **A2.2** `secrets` preset — API key regexes, JWTs, AWS/GCP/Azure tokens, private keys. *(in `dlp.go` patterns: anthropic_key, openai_key, aws_access_key, github_token, slack_token, stripe_key, jwt, plus private-key armor; `dlp_secrets_test.go` covers positive + false-positive cases)*
- [x] **A2.3** `legal` preset — privileged-communication markers, work-product flags, docket/case numbers (from 2026-05-16 plan). *(shipped via migration 032 + 5 `dlp_legal_*.go` files)*
- [x] **A2.4** `finance` preset — IBAN, BIC, PAN, Israeli-ID (merge from AMLIQ). *(2026-05-20: `dlp_finance.go` ships israeli_id + iban + bic + aba_routing; PAN already covered by base `credit_card` with Luhn; 6/6 behaviour tests pass)*
- [x] **A2.5** `healthcare` preset — MRN, ICD-10, PHI markers. *(2026-05-20: `dlp_healthcare.go` ships phi_marker + npi + dea + icd10; MRN already in base; 6/6 behaviour tests pass)*
- [x] **A2.6** `tenant_dlp_preset` config row + per-tenant preset selection. *(2026-05-20: migration 033 adds `finance_preset` + `healthcare_preset` boolean columns; `dlp_policy_lookup_presets.go` provides PgxPolicyLookup.FinancePreset + .HealthcarePreset; middleware `extraPatterns()` honours all three vertical presets independently)*
- [x] **A2.7** Behaviour tests: positive + negative samples for every preset. *(2026-05-20: legal preset already covered; finance preset 6/6 positive+negative; healthcare preset 6/6 positive+negative; full middleware test suite green)*
- [x] **A2.8** Expose `POST /v1/redact` handler — accepts `{text, presets?, tenant?}`, runs DLP scanner without forwarding to an LLM, returns `{redacted, detections[], blocked, block_reason?}`. **Implemented + mounted + integration-tested:** `services/gateway/internal/app/handlers/redact/` (handler + wire adapter + 8 unit tests + 7 integration tests), `services/gateway/internal/infrastructure/middleware/dlp_scan_api.go` (public `DLP.Scan` + 5 tests), `services/gateway/cmd/server/mount_redact.go` (router mount). **15/15 Go tests pass** including `integration_test.go` which wires the real DLP detector through a real `httptest.NewServer` and asserts: email redaction round-trip, clean-text passthrough, block-policy outcome, content-type, 400/405 surface. **Also written:** `tests/qestro/api/redact.spec.ts` (8 black-box specs for use against a docker-compose'd gateway when one's available).

### Phase A3 — Landing + checkout (Days 8-12)
- [x] **A3.1** Rewrite landing for privacy-gateway framing (lead: "Scrub PII and secrets before any LLM call"). *(2026-05-20: LawHero / LawIncluded / LawWhySelfHost / LawPricing rewritten + tiered pricing data extracted; index.tsx meta updated; `tsc --noEmit` clean. LawPrivilege + LawFAQ still legal-AI-focused — follow-up.)*
- [x] **A3.2** `/pricing` — Free (self-host), Team $39/seat/mo, Business $79/seat/mo, Enterprise contact. *(2026-05-21: `pages/pricing.tsx` 171 lines — hero + LawPricing reuse + buy-guide grid + Trust-Center CTA; `tsc` clean)*
- [x] **A3.3** LemonSqueezy products + checkout for Team + Business + extension add-ons. *(2026-05-21: `lib/checkout.ts` migrated to 4-tier `free | team | business | enterprise` ids; `pages/api/checkout/create.ts` validates new ids; `LawPricing.data.ts` routes Team→`/checkout/team` and Business→`/checkout/business`; `next.config.js` env vars now `LEMONSQUEEZY_(TEAM|BUSINESS)_CHECKOUT_URL` + matching `NEXT_PUBLIC_*_URL`. `wrangler.toml` updated locally (gitignored) and needs mirroring in the Cloudflare Pages env config. **Still pending:** populating `LEMONSQUEEZY_VARIANT_ID_TEAM` + `_BUSINESS` secrets after Wave-4 product creation in LemonSqueezy admin.)*
- [ ] **A3.4** Deploy to Cloudflare Pages (sdlc.cc). *(2026-05-21: `wrangler.toml` + `next.config.js` updated for the new tier model and verified; **actual deploy not run** — needs CF_API_TOKEN + `wrangler pages deploy .vercel/output/static --project-name=sdlc-landing-page` from a session with credentials. DEPLOYMENT_GUIDE.md already documents the flow.)*
- [x] **A3.5** `llms.txt`, `ai-plugin.json`, GPT Actions schema. *(2026-05-21: all four AI-discovery files rewritten for privacy-gateway framing — `public/llms.txt` 32 lines, `public/llms-full.txt` 56 lines, `public/.well-known/ai-plugin.json` 17 lines, `public/.well-known/mcp.json` with new ai_discovery routing, `public/gpt-actions.yaml` 218 lines with new endpoints `/presets`, `/surfaces`, `/trust-bundle` replacing the legal-ethics endpoints)*

### Phase A4 — Public launch (Days 13-16)
- [ ] **A4.1** OSS tag `v0.1.0`.
- [ ] **A4.2** Dev.to article #1 ("Scrub PII out of every ChatGPT prompt with a self-hosted Go gateway").
- [ ] **A4.3** Awesome-LLM / awesome-AI PRs, GitHub topic curation.
- [ ] **A4.4** Show HN + r/programming + r/selfhosted + r/lawyers + r/datascience.
- [ ] **A4.5** Product Hunt.

### Phase A5 — First conversions (Days 17-42)
- [ ] **A5.1** Outbound to privacy/compliance newsletters.
- [ ] **A5.2** 50-firm cold-email sequence (legal vertical) — still works, just one wedge among several.
- [ ] **A5.3** First Team-tier sub OR first commercial license.

### Done when
One paid sub (Team / Business / commercial license) clears the bank.

---

## Track D — Browser extension (2-3 weeks)

Intercepts prompts in the ChatGPT / Claude / Gemini / Copilot **web
UIs** before submit. Runs the gateway's DLP locally (or against the
user's self-hosted gateway).

> Status (2026-05-20): scaffold builds clean (`npm run build` →
> `dist/` populated, `npx vitest run` → 3/3 pass, `npx tsc --noEmit`
> clean). A Qestro/Playwright test harness in
> [`tests/qestro/browser/`](tests/qestro/browser/) covers all four
> surfaces via per-site fixtures — extension loads, content script
> attaches, submit intercept fires, `/v1/redact` POST is captured —
> all without needing the live sites. Real-site selector verification
> remains a manual step (sites need logins we don't ship in OSS).

- [x] **D.1** Scaffold `extensions/browser/` (Manifest V3, TypeScript, Vite).
- [x] **D.2** Content scripts for chat.openai.com, claude.ai, gemini.google.com, copilot.microsoft.com. *(verified 2026-05-20: `tests/qestro/browser/intercept.spec.ts` 4/4 pass against fixtures served at the real chat URLs via Playwright route-fulfill. Submit-key intercept fires, content scripts attach, `/v1/redact` POST captured for every surface. **Authenticated end-to-end on live chat sites still pending** — needs login fixtures.)*
- [x] **D.3** Background worker: call gateway `/v1/redact` endpoint (local or cloud). *(verified 2026-05-20: browser tests confirm background worker receives runtime messages from content scripts and POSTs to the configured `gatewayUrl`. Body shape `{text, presets, ...}` validated. **Still untested:** live-gateway round-trip — local `:8080` was a different service during the test pass; sdlc-platform gateway needs docker-compose boot.)*
- [ ] **D.4** Options page: gateway URL + tenant API key + preset selection. *(code written + compiles; UI not opened in a real browser)*
- [ ] **D.5** Inline redaction UI: show what was scrubbed, "send anyway" override (logged). *(currently `window.confirm`; needs proper diff-view UI)*
- [ ] **D.6** Chrome Web Store submission.
- [ ] **D.7** Edge add-ons store submission.
- [ ] **D.8** Firefox AMO submission.
- [ ] **D.9** Safari Web Extension (Mac App Store).
- [ ] **D.10** Landing-page section + install CTA per browser.

### Done when
Free extension live in Chrome Web Store with ≥100 installs and ≥1 Team conversion.

---

## Track E — IDE addin (2 weeks)

Intercepts prompt + completion traffic from Copilot / Codeium / Cursor.

> Status (2026-05-20): E.1 scaffolded in
> [`extensions/ide/vscode/`](extensions/ide/vscode/). `npx tsc -p .`
> compiles clean → `dist/extension.js` produced. A
> `@vscode/test-electron` harness in
> [`extensions/ide/vscode/test/`](extensions/ide/vscode/test/)
> boots a headless VS Code and runs the four-command suite —
> **verified 2026-05-20: 4/4 passing**. Stubbed `/v1/redact` shows
> command registration, selection-scrub edit-apply, clipboard
> rewrite, and toggle setting all working. v0 ships two manual
> commands — "Scrub selection" + "Scrub clipboard" — not the
> transparent proxy (that's E.2).

- [x] **E.1** Scaffold `extensions/ide/vscode/` (TS, vsce).
- [ ] **E.2** Local proxy strategy: register a local HTTP proxy on extension activate; route VS Code's LLM traffic through it.
- [ ] **E.3** JetBrains plugin (`extensions/ide/jetbrains/`) — same proxy strategy.
- [ ] **E.4** Cursor addin (`extensions/ide/cursor/`) — adapt VS Code build.
- [ ] **E.5** Settings UI: gateway URL, presets, allow/deny domains.
- [ ] **E.6** VS Code Marketplace publish.
- [ ] **E.7** JetBrains Marketplace publish.

### Done when
Published to VS Code Marketplace with ≥50 installs.

---

## Track F — Office addin (2 weeks)

Intercepts before M365 Copilot.

- [ ] **F.1** Scaffold `extensions/office/word/` (Office.js).
- [ ] **F.2** Scaffold `extensions/office/outlook/` (Office.js).
- [ ] **F.3** Compose-time hook: scan draft, surface redaction suggestions before "send to Copilot" or "send email".
- [ ] **F.4** Submission to AppSource.

### Done when
Listed in AppSource (Word + Outlook).

---

## Track T — Trust Bundle (1 week setup, ongoing)

One Trust Center + one MSA spanning **sdlc-platform** (privacy
gateway), **AMLIQ** (AML dashboard), **OpenSyber/Claw** (provider
fallback gateway).

> Status (2026-05-20): static site scaffolded in
> [`trust/`](trust/) — index + security + sub-processors + dpa +
> audit-logs + soc2 pages + `_headers` with strict CSP/HSTS. Ready
> to deploy to Cloudflare Pages with build output `.` (no build
> step). Post-deploy smoke in
> [`tests/qestro/smoke/trust-center.spec.ts`](tests/qestro/smoke/trust-center.spec.ts)
> — **verified 2026-05-20: 7/7 passing locally + 1 skipped
> (production-only header check).** Every page loads, headings
> render, cross-links resolve, no console errors. **Domain not
> registered**, **legal copy is working draft not lawyer-reviewed**,
> and Pricing-page footer link still pending.

- [x] **T.1** Scaffold a static site for `trust.sdlc.cc` (or shared `trust.<brand>.com`).
- [x] **T.2** Sub-processor list — unified across the three products. *(working draft in `trust/sub-processors.html`)*
- [x] **T.3** DPA template structure — single document, product-specific exhibits. *(working draft in `trust/dpa.html`; lawyer-review pending)*
- [x] **T.4** Security overview pages: gateway DLP guarantees, AMLIQ data-handling, Claw provider isolation. *(in `trust/security.html`)*
- [x] **T.5** Audit-log architecture page: cross-product log shape, HMAC chain, replay semantics. *(in `trust/audit-logs.html`)*
- [x] **T.6** SOC 2 readiness disclosure + gap list (target: audit yr 2 after first $30K cleared). *(in `trust/soc2.html`)*
- [ ] **T.7** MSA master + 3 product-specific exhibits drafted (lawyer review out of scope). *(structure documented in `dpa.html`; actual documents not drafted yet)*
- [ ] **T.8** Pricing-page footer + sales decks link to Trust Center.
- [ ] **T.9** Register `trust.sdlc.cc` and wire Cloudflare Pages deployment.

### Done when
Trust Center is live and the MSA template is linkable from sales conversations.

---

## Track C — Consulting (parallel, per-client)
- [ ] **C.1** "Hire me to set this up" page on sdlc.cc. $5K setup + $500-2K/mo retainer.
- [ ] **C.2** Calendly + intake + SOW template.
- [ ] **C.3** First close.

### Done when
First consulting contract signed.

---

## Track 6 — AMLIQ port (parallel, 1-2 weeks) — LOAD-BEARING for the bundle

Now strategically important: AMLIQ adopting the gateway packages is
what makes the bundle a real shared substrate, not marketing.

- [x] **6.1** Inventory aegis package overlap. *(2026-05-22: `docs/aegis-port-inventory.md` — found third repo `portfolio/sdlc-core` (module `github.com/finsavvyai/sdlc-core`) with `dlp/`, `audit/`, `quota/`, `ai/`, `cache/`. aegis already imports it via `internal/security/sdlc_core_exports.go`; gateway does not. Real port direction is gateway → sdlc-core, not gateway → aegis. **License blocker** — sdlc-platform AGPL-3.0 + sdlc-core proprietary + aegis proprietary; AGPL §13 forces sdlc-core to dual-license AGPL+commercial before any Phase A code can land. 6.2-6.7 re-scoped to target sdlc-core. Revised effort: 2-3 days end-to-end, contingent on the license decision.)*
- [ ] **6.2** Port `infrastructure/audit/` → aegis `internal/audit/`.
- [ ] **6.3** Port `domain/rbac` + `infrastructure/rbac` → aegis `internal/auth/rbac/`.
- [ ] **6.4** Port `infrastructure/middleware/dlp_*` → aegis `internal/security/dlp/`. Merge with existing PAN / IBAN / BIC / Israeli-ID patterns.
- [ ] **6.5** Port `domain/spend` + `infrastructure/spend` → aegis `internal/billing/spend/`.
- [ ] **6.6** Renumber + apply migrations into aegis sequence.
- [ ] **6.7** Smoke-test in aegis test suite. Open PR.

### Done when
AMLIQ's AI endpoints route through the four ported packages end-to-end.

---

## Track S — Stretch: SBIR Phase I (months 3-9)
- [ ] **S.1** Scan open SBIR / STTR topics for relevance (privacy + AI angle now wins more topics than legal-only).
- [ ] **S.2** Pick 2-3 best fits, draft proposals.
- [ ] **S.3** Submit. ~10% per proposal.

Phase I = $50-150K, no SOC 2 required.

---

## Execution waves (this week)

| Wave | Mode | Tasks |
|---|---|---|
| 1 | Foreground (now) | Direction docs (PIVOT, ROADMAP, CLAUDE banner, AGENTS) + LICENSE + COMMERCIAL.md |
| 2 | Background | DLP preset content (pii/secrets/legal/finance/healthcare) + behaviour tests |
| 3 | Background | Landing rewrite + Dev.to articles + AI-discovery files |
| 4 | Background | Pricing + LemonSqueezy + Trust Center scaffold |
| 5 | Background | Browser extension scaffold (Chrome MV3 + content scripts for 4 sites) |
| 6 | Foreground (synthesis) | Approval batch + ScheduleWakeup for weekly metrics |

Every external action (publish, submit, deploy, send, store-list) is
queued behind a single human-approval batch.

---

## What's NOT on this roadmap
- ❌ SOC 2 Type II / HIPAA / FINRA bundle work — funded from yr-1 revenue
- ❌ Path 4 (generic MCP server) — killed 2026-05-14
- ❌ Path 5 (cost-ops at $19/mo) — killed 2026-05-14
- ❌ Closing old integration-debt items (Day 24 SAML ACS etc.) — re-open only on paying-customer ask

---

## Tracking + cadence
- `[ ]` → `[x]` in this file as tasks land.
- Weekly metrics loop → `docs/launch-log.md` one-liner.
- Monthly: conversion cohort analysis.

## Definition of done

The launch sprint is done when **one paid sub** (Team / Business /
commercial license) **or one paid consulting contract** has cleared
the bank. From there: keep selling, fund SOC 2, harden Trust Center,
expand bundle.
