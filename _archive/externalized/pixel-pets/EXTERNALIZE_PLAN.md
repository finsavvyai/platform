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

## Spin-out or deprioritize — founder choice

Two viable paths:

### Path A: Externalize as separate venture
1. Stand up own brand identity (already has it — "pixel-pets" franchise)
2. Move to own GitHub org if not already
3. Keep velocity if AI consumer / franchise is a play you want to pursue
4. Sibling entity under personal cap table

### Path B: Explicit deprioritize (maintenance-only)
1. Acknowledge the project, freeze active dev
2. Keep code intact at `/portfolio/pixel-pets/` for future revisit
3. No GTM investment
4. Revisit in 6 months if franchise narrative becomes relevant

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
