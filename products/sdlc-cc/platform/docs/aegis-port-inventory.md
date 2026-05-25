# Track 6.1 — aegis port inventory

Date: 2026-05-22.
Branch: main.

## TL;DR — the roadmap was written without one critical piece of context

There is a **third repo** in the portfolio,
[`portfolio/sdlc-core`](../../../sdlc-core/), at module path
`github.com/finsavvyai/sdlc-core`. **aegis already consumes it**
(see `aegis/internal/security/sdlc_core_exports.go`). sdlc-platform's
gateway does **not** consume it.

That changes Track 6 from "port gateway code into aegis directly" to
"decide where the shared substrate lives, and wire all three repos
to it." The right destination for most ported code is **sdlc-core**,
not aegis directly — aegis already imports sdlc-core, so anything
landing in sdlc-core appears in aegis on the next `go get`.

## Three-repo map

```
sdlc-core/                                  Shared Go library, no main.
├── dlp/        1,448 lines                 PII primitives: PAN, IBAN, BIC,
│                                           IL-ID, SSN, UK-NI, IP, fintech,
│                                           credentials, intl-IDs, mask.
├── audit/        549 lines                 recorder + pg_repository + cost +
│                                           request_log (request-log shape,
│                                           NOT HMAC chain).
├── quota/                                  enforcer only.
├── ai/                                     Anthropic / Bedrock / Gemma /
│                                           Claw / Gemini providers with
│                                           SigV4. The OpenSyber/Claw layer.
└── cache/                                  cache + evict.

aegis/                                      AML product. Module
├── internal/audit/  (none)                 github.com/aegis-aml/aegis.
├── internal/auth/saml/                     ✅ Imports sdlc-core via
├── internal/security/                      `internal/security/sdlc_core_exports.go`
│   └── sdlc_core_exports.go ← re-exports   for the fintech DLP set.
│       MaskPII, MaskPAN, MaskIBAN,
│       MaskBIC, MaskILID, MaskAML, etc.
├── internal/billing/                       Lemonsqueezy + plans + meter +
│                                           enforcer. AML-specific.
├── migrations/  069_audit_immutability     DB-level audit immutability —
│                                           composes with HMAC chain, doesn't
│                                           collide.
└── (no rbac/, no spend/, no dlp_*.go yet)

sdlc-platform/services/gateway/             Privacy gateway.
├── internal/infrastructure/audit/   457L   HMAC-chained tamper-evident
│                                           audit. Different shape from
│                                           sdlc-core/audit (request log).
├── internal/infrastructure/rbac/     65L   Pgx-backed loader.
├── internal/domain/rbac/            573L   Evaluator + cache. Strong types.
├── internal/infrastructure/spend/   326L   tracker + sink + pricing + usage.
├── internal/domain/spend/           117L   limiter.
├── internal/infrastructure/middleware/     DLP middleware + pii_default
│   dlp.go (409L), dlp_legal.go (104L),     extended (phone/address/name),
│   dlp_finance.go (102L), dlp_healthcare   secrets pack, custom patterns,
│   .go (101L), dlp_pii_default.go (80L),   tokenize round-trip. NONE of this
│   plus _test.go and policy lookups.       lives in sdlc-core yet.
└── database/migrations/  032 + 033         Legal preset + finance/healthcare
                                            preset opt-in. Not in aegis.
```

## Overlap matrix — what each port-source maps to

| sdlc-platform source | sdlc-core target | aegis target | Decision |
|---|---|---|---|
| `infrastructure/audit/` (HMAC chain, 457L) | new `sdlc-core/audit/chain/` package | none — consume via core | **Port to sdlc-core/audit/chain/.** Coexist with the existing `recorder.go`. Tamper-evident chain ≠ request log; both have a place. |
| `domain/rbac/` + `infrastructure/rbac/` (638L) | new `sdlc-core/rbac/` | none — consume via core | **Port to sdlc-core/rbac/.** sdlc-core has no rbac. Clean target. aegis picks it up via go.mod update. |
| `infrastructure/middleware/dlp.go` (409L) | merge into `sdlc-core/dlp/` | none — already imports | **Tricky.** Gateway's `dlp.go` is at 409 lines and already violates the 200-line cap. Use the port as the forcing function to split. Built-in pack (ssn / itin / mrn / credit_card / email / account_number) → `sdlc-core/dlp/regex_pack.go`. Tokenize / detokenize / TokenMap → `sdlc-core/dlp/tokenize.go`. ErrBlocked / Action enum → `sdlc-core/dlp/types.go`. |
| `dlp_pii_default.go` (80L, brand-new) | `sdlc-core/dlp/pii_extended.go` | none — auto-import | **Port to sdlc-core.** Phone/address/name patterns are general PII, useful to AMLIQ. |
| `dlp_legal.go` + `dlp_legal_*.go` | `sdlc-core/dlp/legal/` | none | **Port to sdlc-core/dlp/legal/.** AMLIQ doesn't use legal preset today but having it available costs nothing. |
| `dlp_finance.go` (102L) | merge into `sdlc-core/dlp/fintech.go` | none — already there | **Reconcile, don't port.** sdlc-core/dlp already ships PAN, IBAN, BIC, IL-ID. Gateway's `dlp_finance.go` has the **regex** wrapper for middleware ingestion; sdlc-core has the **mask** primitive. Decision: keep regex+pattern definitions in gateway-style format, but the **patterns themselves** live in sdlc-core as canonical regexes and gateway/aegis both reference. |
| `dlp_healthcare.go` (101L) | `sdlc-core/dlp/health.go` | none | **Port to sdlc-core.** NPI / DEA / ICD-10 / PHI patterns. AMLIQ doesn't use today but cheap to share. |
| `dlp_secrets_test.go` patterns (in dlp.go) | `sdlc-core/dlp/secrets.go` | none | **Port to sdlc-core.** API key / JWT / private-key armor patterns are not aegis-relevant *today* but are universally useful. |
| `dlp_middleware.go` (HTTP middleware glue, 349L) | stays in gateway | none | **Do not port.** This is gateway-specific HTTP wiring. Belongs in gateway. |
| `dlp_scan_api.go` + redact handler | stays in gateway | none | **Do not port.** Gateway-specific REST surface. |
| `domain/spend/` + `infrastructure/spend/` (443L) | merge into `sdlc-core/quota/` | none — auto-import | **Port to sdlc-core/quota/.** sdlc-core/quota has only enforcer.go; the gateway tracker + sink + pricing + usage are a meaningful augmentation. |
| `database/migrations/032_dlp_legal_preset.sql` | none — schema lives where features live | new aegis migration 073 | **Re-migrate per repo.** Each repo has its own migration sequence (gateway at 033, aegis at 072). Same SQL can be applied independently in each. Renumbering = aegis 073, 074. |
| `database/migrations/033_dlp_finance_healthcare_presets.sql` | none | aegis migration 074 | Same as above. |

## Naming-collision checklist

| Path / name | Status |
|---|---|
| `aegis/internal/audit/` | Does not exist. Port lands here OR via sdlc-core dependency. |
| `aegis/internal/security/audit_*.go` | Exists — different scope (evidence collector, monitor, IP policy). No name conflict if HMAC chain lands as `sdlc-core/audit/chain/`. |
| `aegis/internal/auth/rbac/` | Does not exist. Clean. |
| `aegis/internal/security/dlp/` | Does not exist. The DLP path runs via sdlc-core import. No port needed if sdlc-core gets the patterns. |
| `aegis/internal/billing/meter.go` | Exists — period rollover helper. Different concept from gateway spend/tracker. No collision. |
| `sdlc-core/audit/recorder.go` vs gateway HMAC chain | Different shape. Land HMAC chain as `sdlc-core/audit/chain/` sibling. |
| `sdlc-core/dlp/` already has PAN/IBAN/BIC/IL-ID | Reconcile with gateway dlp_finance.go pattern definitions. Decision below. |
| sdlc-platform migrations 032/033 vs aegis sequence | Renumber on landing: 032 → aegis 073, 033 → aegis 074. No collision. |
| sdlc-platform module `github.com/sdlc-ai/platform/services/gateway` Go 1.25 | vs aegis Go 1.26 vs sdlc-core Go 1.26 | gateway will need a Go bump to 1.26 if it adds an sdlc-core dependency. |

## Migration sequence (proposed)

Phase A — sdlc-core foundation (1-2 days):

1. Port `gateway/internal/infrastructure/audit/` → new `sdlc-core/audit/chain/` package. Carries signer.go, reader.go, writer.go, helpers.go + tests.
2. Port `gateway/internal/domain/rbac/` + `gateway/internal/infrastructure/rbac/` → new `sdlc-core/rbac/`. Two-tier: pgx loader + in-memory evaluator + cache.
3. Port `gateway/internal/domain/spend/` + `gateway/internal/infrastructure/spend/` → augment `sdlc-core/quota/`. tracker, sink, pricing, usage become siblings to the existing enforcer.
4. Split gateway/internal/infrastructure/middleware/dlp.go (409L, over cap) into sdlc-core packages — that's the forcing function we've needed for months.

Phase B — gateway consumes sdlc-core (half day):

5. Bump gateway Go to 1.26. Add `github.com/finsavvyai/sdlc-core` to gateway/go.mod.
6. Replace gateway's local audit/rbac/spend/dlp-primitive code with sdlc-core imports. Keep middleware-glue + REST handlers + migrations in gateway.
7. Run gateway test suite. Expectation: green without code changes once imports are repointed.

Phase C — aegis picks up new patterns automatically (half day):

8. Bump aegis sdlc-core dependency to whatever tag Phase A lands at.
9. Add aegis migrations 073 (legal preset opt-in) and 074 (finance + healthcare preset opt-in) if aegis wants to opt tenants in.
10. Run aegis test suite. Green.

Phase D — clean-up (half day):

11. Delete gateway's now-dead audit/rbac/spend/dlp source files.
12. Update sdlc-platform CLAUDE.md code-map to reflect the sdlc-core dependency.
13. Update aegis sdlc_core_exports.go re-export list with the new symbols.

Total: 2-3 days. Smaller than the roadmap's 1-2 week estimate because sdlc-core absorbs the destination-design work that "port to aegis" was forcing us to do.

## Risk register

| Risk | Mitigation |
|---|---|
| sdlc-core compile breaks for aegis when we land new packages | Bump tag, aegis pins to a specific version. Aegis upgrades on its own clock. |
| Gateway test suite breaks during the migration | Phase B is one PR per package (audit, rbac, spend, dlp) so blast radius is small. |
| Migration renumbering wrong | gateway migrations stay at 032/033 in gateway. aegis gets new migration files at 073/074 with its own up/down pair. No renumber, just new entries. |
| 200-line file cap violation on dlp.go propagated | Use the port as the forcing function to split dlp.go into ≤ 200-line sdlc-core files. **Strict win.** |
| Go version mismatch (gateway 1.25, sdlc-core/aegis 1.26) | Bump gateway to 1.26 in Phase B step 5. No semantic impact at 1.26 for the code that's moving. |
| sdlc-core/dlp/fintech.go duplicates gateway/dlp_finance.go semantics | Reconcile: sdlc-core owns the mask + regex constants; gateway's middleware-pattern wrapper imports those constants. One source of truth. |

## What this does NOT include

- **AMLIQ functional dependency on gateway primitives.** The roadmap's "load-bearing for the bundle" framing is true *only* once aegis actually uses the new sdlc-core packages. Phase C step 10 is the proof — until aegis code paths route through the new sdlc-core packages, the shared substrate is marketing.
- **OpenSyber / Claw integration.** sdlc-core already ships `ai/` with Anthropic / Bedrock / Gemma / Claw / Gemini provider adapters. That's the OpenSyber substrate. Gateway should consume it on the same migration path as audit/rbac/spend.
- **SOC 2 audit scope.** Once the gateway shares audit + RBAC code with aegis via sdlc-core, both products' compliance posture moves together. That's a feature for the audit cycle. Document it.

## Open questions for human review

1. Is the "land in sdlc-core, not aegis" direction approved? Roadmap says "port to aegis" — this proposal reroutes through the shared substrate.
2. Is bumping gateway Go to 1.26 acceptable? (Required for sdlc-core import.)
3. Who owns sdlc-core release tagging? Single-maintainer means no governance overhead; if there's a team, this matters.
4. **License mismatch — this is the load-bearing question.** Checked LICENSE files in all three repos:
   - sdlc-platform: **AGPL-3.0-or-later** (this repo, just relicensed 2026-05-16).
   - sdlc-core: **Proprietary** ("All rights reserved", FinSavvy AI Ltd 2026).
   - aegis: **AMLIQ Proprietary License** ("All rights reserved", AMLIQ 2026).

   AGPL-3.0 § 13: any work that incorporates AGPL code must itself be released under AGPL. If gateway imports sdlc-core, **either sdlc-core must become AGPL (which then forces aegis to AGPL if aegis imports sdlc-core — almost certainly not what AMLIQ wants for its commercial play), or sdlc-core must dual-license (AGPL + commercial buyout) so gateway gets it under AGPL and aegis gets it under a commercial grant.**

   The dual-license path is the same model gateway is already using. It works, it's not novel, and it's what makes Track 6 actually shippable. Without that decision, every Phase A step in the migration sequence above is blocked.

Closes ROADMAP **6.1** when this doc is reviewed + approved. **6.2-6.7
re-scoped** based on the sdlc-core finding: they become "port to
sdlc-core/<package>" not "port to aegis/<package>."
