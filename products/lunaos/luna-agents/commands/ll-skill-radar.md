---
name: ll-skill-radar
displayName: Luna Skill Radar
description: Scan curated awesome-claude-code lists weekly, dedupe against installed luna-agents skills, surface high-value new skills with stars/recency/relevance score.
version: 1.0.0
category: meta
agent: luna-skill-radar
parameters:
  - name: scope
    type: string
    description: "all | desktop | performance | autonomous | security | testing"
    required: false
    default: "all"
  - name: min_stars
    type: number
    description: Minimum stargazers to include
    required: false
    default: 50
  - name: max_age_days
    type: number
    description: Only include items pushed within N days
    required: false
    default: 90
workflow:
  - fetch_awesome_lists
  - parse_repo_entries
  - filter_by_stars_and_recency
  - dedupe_against_installed
  - score_relevance
  - rank_top_N
  - emit_radar_report
  - optionally_open_PRs_to_install
output:
  - .luna/{current-project}/skill-radar.md
prerequisites:
  - gh CLI authenticated
---

# Luna Skill Radar — Weekly New-Skill Scanner

Scans the major curated lists for Claude Code skills/agents/plugins and surfaces what's new and worth installing into the luna-agents plugin.

## Sources Scanned

| Source | Stars | What |
|--------|-------|------|
| `hesreallyhim/awesome-claude-code` | 41k | Master list |
| `VoltAgent/awesome-claude-code-subagents` | 18k | 100+ subagents |
| `rohitg00/awesome-claude-code-toolkit` | 1.4k | 135 agents + 35 skills |
| `ccplugins/awesome-claude-code-plugins` | 720 | Plugin registry |
| `mhattingpete/claude-skills-marketplace` | 560 | Skills marketplace |

Lists pulled via `gh api repos/{owner}/{name}/contents/README.md` and parsed for `[name](url)` entries.

## Scoring

Each candidate scored 0-100:

```
score = 0.4 × log10(stars+1) × 20
      + 0.2 × recency_score   (100 if pushed < 7d, decay to 0 at 365d)
      + 0.2 × relevance_score (cosine similarity vs query category)
      + 0.1 × maintainer_score (active commits, issue response)
      + 0.1 × license_score   (MIT/Apache=10, GPL=5, none=0)
```

Top 20 returned.

## Dedupe

Skips repos that are:
- Already wrapped as a luna-agents skill (match by name or description)
- Forks of skills already evaluated
- Archived

Keeps a memory file `.luna/skill-radar-history.json` of last 90 days of evaluated repos so the same item doesn't re-surface.

## Categories

- `desktop` — Tauri, Electron, native UI scaffolds
- `performance` — caching, batching, token reduction
- `autonomous` — agent frameworks, orchestrators
- `security` — SAST, OWASP, secret scanning
- `testing` — playwright, vitest, chaos engineering
- `all` — combined, top 20 across categories

## Modes

- Default (no flag): scan, score, write report, do NOT install
- `--install N`: open one PR to luna-agents per top-N selected (manual review)
- `--watch`: schedule weekly via /schedule (you confirm)

## Usage

```
/ll-skill-radar                              # all categories, top 20
/ll-skill-radar performance --min-stars 100  # perf only, min 100 stars
/ll-skill-radar desktop --max-age-days 30    # only items active in last month
/ll-skill-radar all --install 3              # auto-PR top 3
```

## Output

`.luna/{project}/skill-radar.md`:

```markdown
# Skill Radar — 2026-04-27

## Top 20 candidates (score desc)

### #1 cline/cline (61028 stars, pushed 2d ago) — score 87
- **Category**: autonomous
- **Description**: Autonomous coding agent right in your IDE
- **Why it's interesting**: Production-grade autonomous loop, mature MCP support
- **Wrap as**: /ll-cline-bridge — invoke cline from luna-agents pipes
- **Status**: NEW (not in luna-agents yet)

### #2 mcp-sophon (4 stars, pushed 14d ago) — score 62
... (etc)
```

## Scheduling

When run with `--watch`, registers a routine via `/schedule`:

```
/schedule create weekly --cron "0 9 * * 1" \
  --command "/ll-skill-radar all --min-stars 50 --max-age-days 14"
```

You get a Slack/email summary every Monday morning. Manual approve before opening PRs.

## Rules

- **Never auto-install** without `--install N` and explicit confirmation
- **Never PR more than 3 skills per run** — review burden
- **Always cite source** — every entry must have GitHub URL + stars + last-push date
- **License must be permissive** (MIT, Apache 2.0, BSD, ISC) — flag GPL/AGPL but don't auto-include
- **No bluffing**: if score is low or stars are low, say so — don't pad the list

## In Pipes

```bash
/pipe ll-skill-radar performance >> rev >> ll-skill-radar all --install 3
/pipe ll-skill-radar all >> publish "weekly digest"
```

## Anti-Bluff Cross-check

After report is written, the agent runs `/ll-no-bluf` against itself to verify every star count and last-push claim is real.
