---
name: ll-config-rules
displayName: Luna Persistent Rules
description: Define persistent project rules that auto-apply to every Luna session, pipe, and agent
version: 1.0.0
category: configuration
agent: luna-task-executor
parameters:
  - name: action
    type: string
    description: Action (set, get, list, remove, init, export)
    required: true
    prompt: true
workflow:
  - load_rules_config
  - execute_action
  - save_rules_config
output:
  - .luna/rules.yaml
prerequisites: []
---

# Luna Persistent Rules

Define project-wide rules that **auto-apply to every session, pipe, and agent**.

Stored in `.luna/rules.yaml` — committed to git, shared with your team.

---

## Quick Start

```
/config-rules init                    # Create .luna/rules.yaml with defaults
/config-rules set max-lines 100       # Set max file size
/config-rules set coverage 90         # Set coverage threshold
/config-rules list                    # Show all active rules
```

---

## Rules File: `.luna/rules.yaml`

```yaml
# .luna/rules.yaml — Persistent Luna rules
# These apply to EVERY Luna session, pipe, and agent automatically

version: 1

# ── Code Quality ──────────────────────────────────────────
code:
  max_lines_per_file: 100           # Max lines in any source file
  max_function_lines: 30            # Max lines per function
  max_params: 4                     # Max function parameters
  no_any_types: true                # Disallow TypeScript `any`
  strict_mode: true                 # TypeScript strict mode
  naming: camelCase                 # Naming convention (camelCase, snake_case, PascalCase)

# ── Testing ───────────────────────────────────────────────
testing:
  unit_coverage: 90                 # Minimum unit test coverage %
  branch_coverage: 85               # Minimum branch coverage %
  critical_path_coverage: 100       # Coverage for auth, payments, security
  require_playwright_e2e: true      # Require Playwright test for every feature
  require_failing_test_first: true  # Bug fixes must start with a failing test
  test_naming: describe_it          # Test naming style (describe_it, test_should)

# ── Security ──────────────────────────────────────────────
security:
  block_on_critical: true           # Block pipeline on critical vulnerabilities
  block_on_high: true               # Block pipeline on high vulnerabilities
  require_input_validation: true    # Require Zod/joi validation on all inputs
  require_auth_on_routes: true      # All API routes must check auth
  no_secrets_in_code: true          # Scan for hardcoded secrets
  require_audit_logging: true       # Auth events, admin actions must be logged

# ── Accessibility ─────────────────────────────────────────
accessibility:
  wcag_level: AA                    # WCAG compliance level (A, AA, AAA)
  require_aria_labels: true         # All interactive elements need ARIA labels
  min_contrast_ratio: 4.5           # Minimum color contrast ratio
  require_keyboard_nav: true        # All features must be keyboard accessible

# ── Design ────────────────────────────────────────────────
design:
  style_guide: apple-hig            # Design system (apple-hig, material, custom)
  require_dark_mode: true           # All UI must support dark mode
  require_responsive: true          # All pages must be responsive
  max_z_index: 50                   # Prevent z-index wars

# ── Git & Workflow ────────────────────────────────────────
workflow:
  commit_style: conventional        # Commit style (conventional, gitmoji, plain)
  require_pr_review: true           # PRs require code review
  require_tests_pass: true          # Tests must pass before commit
  auto_changelog: true              # Auto-generate changelog on release
  branch_prefix: feature/           # Branch naming prefix

# ── Pipe Defaults ─────────────────────────────────────────
pipe:
  default_before: rules             # Always @before:rules on every pipe
  default_after: test               # Always @after:test on every pipe
  fail_fast: true                   # Stop pipeline on first failure
  max_loop_iterations: 10           # Safety cap for *? loops
  require_approval_for_ship: true   # Always approve before /ship

# ── AI ────────────────────────────────────────────────────
ai:
  default_model: opus               # Default AI model for agents
  max_autonomous_iterations: 5      # Max iterations for /lam and /feature
  require_review_on_ai_output: true # Auto-review AI-generated code

# ── File Patterns ─────────────────────────────────────────
patterns:
  source_files: "src/**/*.{ts,tsx,js,jsx}"
  test_files: "src/**/*.test.{ts,tsx}"
  e2e_files: "e2e/**/*.e2e.test.ts"
  ignore: ["node_modules", "dist", ".next", "coverage"]
```

---

## Commands

### Initialize rules
```
/config-rules init
```
Creates `.luna/rules.yaml` with sensible defaults based on your codebase.

### Set a rule
```
/config-rules set max-lines 100
/config-rules set coverage 95
/config-rules set wcag-level AAA
/config-rules set commit-style conventional
/config-rules set require-playwright true
/config-rules set block-on-critical true
/config-rules set default-before rules
/config-rules set default-after test
/config-rules set require-approval-for-ship true
```

### Get a rule
```
/config-rules get max-lines              # 100
/config-rules get coverage               # 90
/config-rules get wcag-level             # AA
```

### List all rules
```
/config-rules list
```
Shows all active rules with current values.

### Remove a rule
```
/config-rules remove max-function-lines
```

### Export rules
```
/config-rules export                     # Print rules.yaml to console
/config-rules export clipboard           # Copy to clipboard
```

---

## How Rules Auto-Apply

### Every Luna Session
When you start any Luna command, rules are loaded from `.luna/rules.yaml`:
- `/go` respects `max_lines_per_file`, `no_any_types`, `strict_mode`
- `/rev` checks against all code quality and security rules
- `/test` enforces coverage thresholds
- `/ship` requires approval if `require_approval_for_ship: true`

### Every Pipe
Pipe defaults from `rules.yaml` are injected automatically:
```yaml
pipe:
  default_before: rules
  default_after: test
```
This means:
```
/pipe go *5 >> rev >> ship
```
Automatically becomes:
```
/pipe @before:rules @after:test go *5 >> rev >> approve "Ship?" >> ship
```

### Every Assert
Assertions read thresholds from rules:
```
/pipe assert coverage    # Uses testing.unit_coverage from rules.yaml
/pipe assert file-size   # Uses code.max_lines_per_file from rules.yaml
/pipe assert security    # Uses security.block_on_critical from rules.yaml
```

### AI Agents
AI agents respect:
```yaml
ai:
  default_model: opus
  max_autonomous_iterations: 5
  require_review_on_ai_output: true
```

---

## Rule Inheritance

Rules cascade:
```
Portfolio CLAUDE.md (200-line cap, 90% coverage)
  └── Project .luna/rules.yaml (100-line cap, 95% coverage)  ← stricter, overrides
       └── Session /rules (runtime overrides)                 ← strictest
```

**Rules can only get stricter, never weaker.**

- Portfolio says 200 lines → project can set 100, not 300
- Portfolio says 90% coverage → project can set 95%, not 80%

---

## Team Sharing

`.luna/rules.yaml` is a regular file — commit it to git:

```bash
git add .luna/rules.yaml
git commit -m "chore: set project rules — 100-line cap, 95% coverage"
```

Everyone on the team gets the same rules automatically.

---

## Presets

```
/config-rules init strict              # Strictest settings
/config-rules init standard            # Balanced defaults
/config-rules init startup             # Fast-moving, fewer gates
```

| Preset | Max Lines | Coverage | Security | Approval |
|--------|-----------|----------|----------|----------|
| `strict` | 80 | 95% | Block all | Required |
| `standard` | 100 | 90% | Block critical | Required |
| `startup` | 150 | 80% | Warn only | Optional |
