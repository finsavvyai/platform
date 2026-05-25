---
name: ll-leverage
displayName: Luna Leverage Open Source
description: Scan open-source repos, extract reusable patterns/features, and generate integration plans for your project
version: 1.0.0
category: analysis
agent: luna-task-executor
parameters:
  - name: repos
    type: string
    description: "GitHub repo URLs (comma-separated) or 'user:username' to scan all repos"
    required: true
    prompt: true
  - name: target
    type: string
    description: "Your project to integrate into (e.g., 'lunaos', 'coderailflow', or path)"
    required: false
    default: current
  - name: depth
    type: string
    description: "Analysis depth: quick (README only), medium (+ key files), deep (full codebase)"
    required: false
    default: medium
prerequisites: []
---

# Luna Leverage Open Source

Scan any GitHub repo (or an entire user's repos), extract reusable features, patterns, and architecture decisions, then generate an integration plan for your project.

## What This Command Does

1. **Scan** — Fetches repo README, key source files, package.json, architecture
2. **Extract** — Identifies: features, tech stack, design patterns, APIs, unique innovations
3. **Compare** — Maps against your project's existing capabilities
4. **Gap Analysis** — Finds what the repo has that your project doesn't
5. **Integration Plan** — Generates specific code-level steps to adopt the best parts
6. **Reference Doc** — Creates a markdown reference sheet for team knowledge

## Usage

```bash
# Scan a single repo
/leverage https://github.com/ruvnet/ruflo --target lunaos

# Scan all repos from a user
/leverage user:ruvnet --target lunaos --depth quick

# Scan multiple repos
/leverage https://github.com/ruvnet/ruflo,https://github.com/ruvnet/RuVector --target lunaos

# Deep analysis with full codebase scan
/leverage https://github.com/elie222/inbox-zero --depth deep

# Just generate reference docs (no integration plan)
/leverage https://github.com/karpathy/nanoGPT --depth quick
```

## Output

```
.luna/{project}/leverage/
  {repo-name}/
    reference.md          # What it is, features, stack, unique patterns
    gap-analysis.md       # What it has that you don't
    integration-plan.md   # Step-by-step adoption guide
    key-files.md          # Most important source files + summaries
  summary.md              # Cross-repo comparison matrix
  adoption-roadmap.md     # Prioritized plan across all scanned repos
```

## Reference Doc Format

For each scanned repo, generates:

```markdown
# {Repo Name}
**URL**: {url}
**Stars**: {count} | **Language**: {lang} | **License**: {license}

## What It Does
{2-3 sentence description}

## Key Features
- Feature 1: {description}
- Feature 2: {description}

## Tech Stack
| Layer | Technology |
|-------|-----------|
| ...   | ...       |

## Architecture Patterns Worth Adopting
1. {Pattern}: {why it's good, how to apply}

## Unique Innovations
- {Innovation}: {what makes it special}

## API / Integration Points
- {endpoint/SDK}: {how to call it}

## Relevance to {Your Project}
- Direct competitor: Yes/No
- Features to adopt: {list}
- Estimated integration effort: {hours}
```

## How It Works

### Quick Scan
- Fetches README.md via GitHub API
- Extracts: description, features, stack, stars
- Generates reference doc only

### Medium Scan (default)
- Quick scan + reads key files (package.json, main entry, config)
- Identifies architecture patterns
- Generates gap analysis + integration plan

### Deep Scan
- Medium scan + clones repo to temp dir
- Analyzes full source tree (respects .gitignore)
- Maps every feature to your project's equivalent
- Generates code-level integration steps

## In Pipes

```bash
# Scan competitor, then integrate best features
/pipe leverage https://github.com/competitor/app >> fix

# Scan, plan, execute
/pipe leverage https://github.com/cool/project >> product-map >> go

# Research phase: scan multiple, then plan
/pipe leverage user:ruvnet --depth quick >> context-pack >> plan
```
