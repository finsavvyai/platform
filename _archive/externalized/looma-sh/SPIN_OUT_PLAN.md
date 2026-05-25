# looma-sh — Spin-Out Plan

Founder decision (2026-05-25): **externalize, do not archive.**

Original code: `/Users/shaharsolomon/dev/projects/portfolio/looma-sh/` (untouched).
Original production: `looma.sh` (marketing), `relay.looma.sh` (API).

**Execution status (2026-05-26): ON HOLD from archive sweep.** Source remains intact while the spin-out actions below are worked. Do not delete, compress, or continue archival cleanup for Looma from the FinsavvyAI repo.

## Why not archive

- Live production endpoints with auth + persistence (Phase 1 shipped 2026-05-08).
- Paid pricing model (free tier + paid tiers, already monetizable).
- Full investor pitch package: `INVESTOR_BRIEF.md`, `TRACTION.md`, `RISKS.md`, `ROADMAP.md`, `TEAM.md`, `TECH_DEEP_DIVE.md`, `OPENCLAW_COMPARISON.md`.
- Active IP-protection work (`IP_PROTECTION_STRATEGY.md`, `IP_PROTECTION_CHECKLIST.md`).
- Multi-tenant architecture, Sentry instrumentation, Playwright tests, Docker prod compose.

## Why not in FinsavvyAI

Different vertical (V2V automotive vs AI software infrastructure), different buyer, different regulators (DOT/NHTSA vs SOC 2/EU AI Act), different sales motion. Folding dilutes both narratives.

## Spin-out actions

| # | Action | Owner | Status | Notes |
|---|---|---|---|---|
| 1 | Stand up separate entity (LLC or branded sole-prop) for Looma | user | ☐ | Talk to lawyer; entity choice depends on tax + cap-table goals |
| 2 | Transfer `looma.sh` + `relay.looma.sh` domains to entity | user | ☐ | DNS + registrar transfer |
| 3 | Transfer Cloudflare account / move zone to new entity's CF account | user | ☐ | Or keep on personal CF, just rebill |
| 4 | Transfer GitHub repo to new entity org (or keep personal, just rename description) | user | ☐ | `github.com/looma-sh/looma` or similar |
| 5 | Stand up separate Stripe / LemonSqueezy account for Looma billing | user | ☐ | Critical for clean books |
| 6 | Move IP-protection materials into entity's IP docket | user | ☐ | Provisional patents, trademarks — counsel-led |
| 7 | Decide on velocity: solo maintenance vs. seek co-founder / contractor | user | ☐ | Investor brief implies fundraising track is alive |
| 8 | Update Looma's own README to drop any FinsavvyAI cross-references | user | ☐ | Clean separation |
| 9 | Update FinsavvyAI website / pitch to not mention Looma | n/a | ✓ | Already not mentioned |
| 10 | Final: remove `/portfolio/looma-sh/` from FinsavvyAI dev workspace after entity stand-up | user | ☐ | Last step |

## Maintenance until spin-out completes

- Production stays live (don't take down `relay.looma.sh`).
- Cloudflare bill keeps running (acceptable per memo if < $50/mo).
- No active development inside the FinsavvyAI monorepo (this repo holds only this plan).

## Alternatives considered (rejected per memo)

1. Park as maintenance-only — defers the decision; doesn't capture optionality.
2. Sell / transfer — viable but requires more conversation; do spin-out first, sell-from-entity later if desired.
3. Archive — destroys live deployment + investor materials. Rejected.

## Prior archive manifest

`PRIOR_ARCHIVED.md` in this directory — the snapshot manifest that was incorrectly classified as archive in round 4. Preserved for history; superseded by this plan.
