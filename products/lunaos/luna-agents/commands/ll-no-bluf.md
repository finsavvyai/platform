---
name: ll-no-bluf
displayName: Luna No-Bluff Audit
description: Detect AI bluffing in recent commits and docs, surface fake claims, fix or remove them in a closed-loop cycle until everything verifies real.
version: 1.0.0
category: quality
agent: luna-no-bluf
parameters:
  - name: scope
    type: string
    description: "Scope: latest|N (commit count) or path glob like docs/**/*.md"
    required: false
    default: "latest"
    prompt: false
  - name: mode
    type: string
    description: "interactive | auto-fix | report-only"
    required: false
    default: "interactive"
    prompt: false
  - name: max_loops
    type: number
    description: Max cycles before stopping
    required: false
    default: 5
workflow:
  - collect_recent_changes
  - extract_claims
  - verify_each_claim
  - score_severity
  - present_bluff_report
  - user_pick_actions
  - auto_fix_or_remove
  - rescan_and_loop
output:
  - .luna/{current-project}/no-bluf-report.md
  - .luna/{current-project}/no-bluf-fixes.diff
prerequisites:
  - git repo
---

# Luna No-Bluff — AI Honesty Auditor

Hunts AI-generated bluffing in commits, PR descriptions, and docs. Verifies every claim. Removes or rewrites lies. Loops until truth.

## What It Does

```
/ll-no-bluf
   ↓
1. Collect: last N commits + changed *.md + AI-tagged docs
2. Extract claims: file:line refs, function names, metrics, status words
3. Verify each: does file exist? function exist? metric backed by source?
4. Score: Critical (invented) | High (unverified) | Med (hyperbolic) | Low (vague)
5. Report: list bluffs with evidence
6. User picks per item: keep | remove | rewrite | auto-fix
7. Auto-fix: replace doc paragraph with reality-grounded text
8. Re-scan; loop until clean OR max_loops reached
```

## Bluff Detector Heuristics

| Type | Example | Detection |
|------|---------|-----------|
| **Phantom file ref** | "see `src/auth/oauth.ts:42`" | file/path missing |
| **Phantom function** | "calls `validateTokenStrict()`" | grep returns nothing |
| **Fake metric** | "95% coverage" | no coverage report or value mismatch |
| **Fake speedup** | "10x faster" | no benchmark file or unrelated numbers |
| **Hyperbolic done** | "production-ready", "comprehensive" | no test/CI evidence |
| **Stub claimed done** | "fully implemented" + TODO/FIXME in body | grep stub markers |
| **Invented test** | "added 50 tests" | git diff shows zero new test files |
| **Phantom commit ref** | "see commit abc123" | git cat-file fails |
| **Fake module/lib** | "uses `@luna/auth-pro`" | not in package.json/imports |
| **Unverified scan** | "OWASP audit complete" | no scan log/report file |

## Severity

- **Critical**: invented identifiers, phantom refs, fake commits — must remove
- **High**: unverified numerics, claimed completion w/o tests — must back up or rewrite
- **Medium**: hyperbolic language without source — soften
- **Low**: vague hand-wavy claims — flag, optional

## Modes

- `interactive` (default): show bluff list, prompt per item
- `auto-fix`: rewrite without asking (only Medium and below; Critical/High require confirm)
- `report-only`: scan + report, no edits

## Closed Loop

```
scan → report → fix → re-scan → report
                ↑                  ↓
                └──── until 0 bluffs OR max_loops ────┘
```

Loop ends when:
- 0 Critical/High remain, OR
- `max_loops` hit (default 5), OR
- No new bluffs detected between cycles

## Usage

```
/ll-no-bluf                                # latest 10 commits, interactive
/ll-no-bluf 50                             # last 50 commits
/ll-no-bluf docs/**/*.md --mode auto-fix   # fix all docs without prompts
/ll-no-bluf latest --mode report-only      # scan only, no fixes
```

## Output

**`.luna/{project}/no-bluf-report.md`** — bluff inventory with severity, evidence, fix proposal per item.

**`.luna/{project}/no-bluf-fixes.diff`** — unified diff of all applied fixes for review/revert.

## Rules

- **Never fabricate** new content while fixing — replace with shorter truthful text or `[REMOVED: unverified]` placeholder
- **Cite source** for every kept metric (file:line or commit hash)
- **Preserve commit history** — fixes go in NEW commits, no force-push
- **Test guard** — after each fix loop, run `git status` to confirm clean working tree before next loop
- **No silent edits** — every change goes into the diff log

## In Pipes

```bash
/pipe ghost "release notes" >> ll-no-bluf --mode auto-fix >> pr
/pipe feature "auth" >> rev >> ll-no-bluf >> ship
/pipe heal >> ll-no-bluf latest 20 --mode interactive
```

## Failure Modes

- **Scope too large**: > 200 commits = abort, ask narrower scope
- **No git repo**: hard error
- **Generated content matches existing prod text**: skip (likely human-authored, not AI bluff)
- **All claims verify**: report "0 bluffs found, clean" and exit success
