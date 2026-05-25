# Portfolio Snapshots Index

**Generated:** 2026-05-25 by agent ARCHIVE-WEBSITE (round 4 swarm)
**Source root:** `/Users/shaharsolomon/dev/projects/portfolio/`
**Snapshot root:** `_archive/portfolio-snapshots/`
**Authority:** `finsavvyai_consolidation_plan_addendum.md` §3 (Archive table)

## Reading guide

- **Snapshot type = "manifest"** — only an `ARCHIVED.md` stub. Source
  not copied (size >100MB or worktree variant covered by canonical).
- **Snapshot type = "source"** — source rsync'd to `<repo>/` here
  (standard build-artifact excludes). Manifest beside it.
- **SHA `n/a`** — source is not a git repo (or empty dir).

## Parked-domain bucket

Off-thesis products whose public domain is no longer active.

| Repo | Type | SHA (short) | Last commit | Size | Files | Reason |
|---|---|---|---|---|---|---|
| autoboot (FastPM) | manifest | 4bff57dd | 2026-01-07 | 6.7G | 117615 | fastpm.dev parked; dual-role w/ INFRA harness |
| subsforge | manifest | 027f228b | 2025-10-31 | 2.6G | 85284 | subsforge.dev parked |
| viralsplit | manifest | 202cec27 | 2026-01-13 | 2.1G | 152662 | viralsplit.io parked |
| smartreply-ai | manifest | n/a | n/a | 232M | 25025 | smartrepli.ai parked |

## Off-thesis bucket

Working products / projects that do not fit the AI-native software
infrastructure thesis.

| Repo | Type | SHA (short) | Last commit | Size | Files | Reason |
|---|---|---|---|---|---|---|
| devwrapped | manifest | e967cc5d | 2025-10-30 | 885M | 76185 | Developer self-stats app |
| flujo | manifest | 577fb85b | 2025-03-14 | 1.5G | 81401 | Stale MCP/workflow preview; not fold-worthy |
| global-remit | manifest | n/a | n/a | 3.0G | 291849 | Remittance fintech (outside AMLIQ scope) |
| hashmal | manifest | n/a | n/a | 486M | 43800 | Unclear scope, no README |
| immortal-fc | manifest | db1e9ba7 | 2025-05-24 | 421M | 25908 | Empty README, no signal |
| looma-sh | manifest | n/a | n/a | 2.3G | 123410 | V2V messaging API, off-thesis |
| moneh-hacham | manifest | n/a | n/a | 162M | 8331 | Smart meter project |
| notebooklm-py | manifest | ac58d7f2 | 2026-03-03 | 292M | 3738 | Fork of public PyPI project |
| pixel-pets | manifest | 7af5b1fd | 2026-05-23 | 586M | 34899 | AI creature franchise (separate venture) |
| vibepulse | manifest | f202024a | 2025-09-05 | 456M | 45125 | Chrome extension games |
| scangenie | manifest | 5d7d7ae4 | 2025-11-19 | 2.7G | 136222 | Consumer AI object scanner |
| windsu-credit-manager | manifest | 4278309f | 2025-11-19 | 721M | 65993 | AI Code Quality Predictor (PushCI-checked) |
| yallabye | manifest | n/a | n/a | 661M | 35220 | Israeli travel app |
| codebridge | manifest | n/a | n/a | 506M | 34629 | Unclear scope (FastPM-marketing artifacts) |
| queryflux | source | n/a | n/a | 0B | 0 | Empty placeholder duplicate |
| queryflux-git | manifest | 5110dcf5 | 2026-05-23 | 578M | 37126 | On-thesis vocabulary; founder fold/archive call |
| querylens | manifest | n/a | n/a | 56M | 1970 | Predecessor of queryflux-git |

## Pre-rewrite bucket

Explicit pre-rewrite snapshot named at source.

| Repo | Type | SHA (short) | Last commit | Size | Files | Reason |
|---|---|---|---|---|---|---|
| pipewarden-real-archive-20260412 | source | 703b7c6a | 2026-03-06 | 604K | 59 | Pre-rewrite reference for `oss/pipewarden/` |

## Worktree-variant bucket

Parallel-agent run residue from past sprint loops. Canonical originals
already migrating under other round-4 agents.

| Repo | Type | SHA | Last | Size | Files | Canonical |
|---|---|---|---|---|---|---|
| aegis.agent1 | manifest | n/a | n/a | 41M | 2173 | aegis → products/amliq/api/ |
| aegis.agent2 | manifest | n/a | n/a | 41M | 2173 | aegis → products/amliq/api/ |
| clawpipe.agent1 | manifest | n/a | n/a | 12M | 746 | clawpipe → oss/clawpipe/ |
| clawpipe.agent2 | manifest | n/a | n/a | 12M | 756 | clawpipe → oss/clawpipe/ |
| luna-os.agent1 | manifest | n/a | n/a | 4.0K | 1 | (empty shell) luna-os → products/lunaos/ |
| luna-os.agent2 | manifest | n/a | n/a | 4.0K | 1 | (empty shell) luna-os → products/lunaos/ |
| opensyber.agent1 | manifest | n/a | n/a | 47M | 3223 | opensyber → products/opensyber/ |
| pipewarden.agent1 | manifest | n/a | n/a | 4.5M | 707 | pipewarden → oss/pipewarden/ |
| pipewarden.agent2 | manifest | n/a | n/a | 4.5M | 707 | pipewarden → oss/pipewarden/ |
| push-ci.dev.agent2 | manifest | n/a | n/a | 5.7M | 33 | push-ci.dev → products/pushci/website/ |
| tenantiq.agent1 | manifest | n/a | n/a | 55M | 2509 | tenantiq → products/tenantiq/ |
| tenantiq.agent2 | manifest | n/a | n/a | 55M | 2509 | tenantiq → products/tenantiq/ |

## Totals

| Bucket | Count | Source size | Snapshot size here |
|---|---|---|---|
| parked-domain | 4 | ~11.6G | ~0 (manifests only) |
| off-thesis | 17 | ~14.5G | ~360K (queryflux empty + manifests) |
| pre-rewrite | 1 | 604K | 360K (full copy) |
| worktree-variant | 12 | ~290M | ~0 (manifests only) |
| **TOTAL** | **34** | **~26.5G** | **<1MB** |

Two source-snapshot copies on disk: `pipewarden-real-archive-20260412/`
(360K) and `queryflux/` (0B). Everything else is manifest-only.

## Disposition summary (per ARCHIVED.md recommendations)

| Action | Count | Repos |
|---|---|---|
| Delete immediately | 3 | luna-os.agent1, luna-os.agent2, queryflux |
| Delete after 30 days | 7 | aegis.agent1/2, clawpipe.agent1/2, immortal-fc, opensyber.agent1, querylens (after queryflux-git decision) |
| Delete after 60 days | 11 | subsforge, viralsplit, smartreply-ai, flujo, hashmal, looma-sh, moneh-hacham, vibepulse, scangenie, yallabye, codebridge |
| Delete after 90 days | 4 | autoboot (partial), devwrapped, global-remit, windsu-credit-manager |
| Preserve indefinitely | 2 | pipewarden-real-archive-20260412, pixel-pets (separate venture) |
| Escalate before delete | 2 | queryflux-git (founder fold call), looma-sh (confirm prod shutdown) |
| Delete with siblings | 5 | pipewarden.agent1/2, push-ci.dev.agent2, tenantiq.agent1/2 (after canonical verify) |

## Important reminder

**Originals remain in `/Users/shaharsolomon/dev/projects/portfolio/`.
Deletion of any source repo is a manual user decision, executed
outside this monorepo.** This snapshot tree preserves provenance and
disposition recommendations; it does not authorize deletion.
