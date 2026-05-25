# pixel-pets — Externalize Plan

Founder decision (2026-05-25, after May 2026 ranking memo): **EXTERNALIZE, not archive.**

Original code: `/Users/shaharsolomon/dev/projects/portfolio/pixel-pets/` (untouched).

## Why this was wrongly archived

Round 4 archive sweep (2026-05-25) snapshotted pixel-pets as off-thesis. The ranking memo flagged this as wrong because:

- Last commit 2026-05-23 (2 days before the archive sweep — active)
- Phase 0 scaffold + phase 2 work on safety/genome/NFC features
- Full strategic brief: `BRIEF.md`, `ROADMAP.md`, `GRILL.md`
- 5 PROPOSED ADRs awaiting sign-off
- In active sprint loop with its own CLAUDE.md
- Off-thesis (AI creature franchise: figures + cards + device + app) — but real product

Off-thesis ≠ archive. Same logic as looma-sh: kill destroys real value; silent archive contradicts evidence of active development.

## Disposition

EXTERNALIZE — treat like looma-sh:
- Don't fold into FinsavvyAI narrative (off-thesis: consumer/franchise vs AI infra)
- Don't silently delete (active code with strategic brief)
- Don't bring into the monorepo (different velocity, different cap-table story)

## Decision: Path A — Spin-out as separate venture (2026-05-25)

Founder chose Path A. Pixel-pets is now an externalized sibling project, not a FinsavvyAI asset.

### Spin-out checklist

| # | Action | Owner | Status | Notes |
|---|---|---|---|---|
| 1 | Decide entity wrapper (LLC vs sole-prop vs subsidiary) | user | ☐ | Talk to lawyer; consumer/franchise IP differs from FinsavvyAI infra IP |
| 2 | Trademark "pixel-pets" + character names if not done | user | ☐ | Franchise IP is the asset class — protect early |
| 3 | Move repo to own GitHub org (`github.com/pixel-pets/` or similar) | user | ☐ | Clean separation from FinsavvyAI orgs |
| 4 | Stand up own brand identity (domain, design system, website) | user | ☐ | Don't share `finsavvyai.com` design system |
| 5 | Separate Stripe / payment account for any merch/franchise revenue | user | ☐ | Clean books |
| 6 | Hire / partner on consumer GTM (different muscle than B2B infra) | user | ☐ | Optional but spin-out implies investment |
| 7 | Update FinsavvyAI public materials to not mention pixel-pets | n/a | ✓ | Already not mentioned |
| 8 | Continue NFC / genome / safety phase 2 work on own velocity | user | — | Already in progress per recent commits |
| 9 | Final: delete `/portfolio/pixel-pets/` once entity transfer verified | user | ☐ | Last step |

## What this directory holds

- `PRIOR_ARCHIVED.md` — the original (incorrect) archive manifest from round 4
- `EXTERNALIZE_PLAN.md` — this doc (Path A spin-out)

No source copied here. Original at `/portfolio/pixel-pets/` (586M, intact).

## Why Path A over Path B

Path B (maintenance-only) was the lower-commitment option. Founder chose A. Rationale (implicit from the choice):

- Active sprint loop + phase-2 work + 5 PROPOSED ADRs indicate the project has narrative momentum worth backing.
- AI consumer/franchise is a real category (NFT, AI companions, character-IP-as-platform) — different story but a real one.
- Spin-out preserves cap-table optionality the same way looma-sh does for V2V.

Path A is more work than B. If founder later reconsiders, this doc can be revised; the EXTERNALIZED bucket structure supports both.

## What this directory holds

- `PRIOR_ARCHIVED.md` — the original (incorrect) archive manifest from round 4
- `EXTERNALIZE_PLAN.md` — this doc

No source copied here. Original is at `/portfolio/pixel-pets/` (586M, intact).

## Comparison to looma-sh

| Aspect | pixel-pets | looma-sh |
|---|---|---|
| Live production | unclear | yes (relay.looma.sh) |
| Paid customers | no | yes (paid tiers active) |
| Investor materials | strategic brief only | full pitch package |
| IP protection | not stated | active work |
| Off-thesis? | yes (AI franchise) | yes (V2V automotive) |
| Recent commit | 2026-05-23 | 2026-05-13 |
| Recommended path | A or B (founder decides) | A (spin-out clear) |

Looma is closer to spin-out-ready due to live revenue. Pixel-pets is earlier; Path A or B are both reasonable.
