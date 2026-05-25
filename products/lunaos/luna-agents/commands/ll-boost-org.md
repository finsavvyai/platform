---
name: ll-boost-org
displayName: Luna Boost Organization
description: Scan a GitHub org/user's repos, find cross-repo synergies, and map open-source tools to boost the entire portfolio
version: 1.0.0
category: analysis
agent: luna-task-executor
parameters:
  - name: org
    type: string
    description: "GitHub org or username (e.g., 'finsavvyai', 'lunaos-ai', 'vercel')"
    required: true
    prompt: true
  - name: depth
    type: string
    description: "quick (README only), full (+ key files), deep (+ code analysis)"
    required: false
    default: full
  - name: boost
    type: string
    description: "What to optimize: synergies, open-source, shared-libs, all"
    required: false
    default: all
prerequisites: []
---

# Luna Boost Organization

Give it any GitHub org or user — it scans every repo, discovers how they relate, finds shared patterns, and maps open-source tools to supercharge the entire portfolio.

## What It Does

### Phase 1: Scan
- Fetches all repos via `gh api users/{org}/repos`
- For each repo: reads README, package.json/go.mod, key source files
- Classifies: stack, domain, maturity, stars, activity

### Phase 2: Correlate
- Detects shared dependencies across repos
- Identifies duplicate code patterns (same auth, billing, logging)
- Finds repos that should share a library but don't
- Maps which repos complement each other (e.g., API + frontend)
- Identifies orphan repos (no relation to anything)

### Phase 3: Map Open Source
For each repo AND for cross-repo opportunities:

**AI / LLM layer:**
- [llamafile](https://github.com/mozilla-ai/llamafile) — any repo doing AI can run offline
- [any-llm](https://github.com/mozilla-ai/any-llm) — Python repos with multiple LLM providers

**Search / Data:**
- [RuVector](https://github.com/ruvnet/RuVector) — any repo with vector search or RAG
- Hybrid search pattern — combine keyword + semantic

**Voice / Media:**
- [Voicebox](https://github.com/jamiepine/voicebox) — any repo generating content
- [LLaMA-Mesh](https://github.com/nv-tlabs/LLaMA-Mesh) — marketing 3D heroes

**Testing / Quality:**
- [flakestress](https://github.com/bradfitz/flakestress) — any repo with tests
- [Perfetto](https://github.com/google/perfetto) — any web app or API

**UI / Charts:**
- [Victory](https://github.com/FormidableLabs/victory) — any repo with a dashboard

**Networking:**
- [Tailscale](https://github.com/tailscale/tailscale) — repos that talk to each other

**Architecture patterns:**
- ruflo patterns — any repo doing AI agent orchestration
- Dossier patterns — any repo needing visual planning
- flow-nexus patterns — any repo that could benefit from gamification

### Phase 4: Shared Library Plan
Identifies what should be extracted into shared packages:
- Common auth patterns → `@{org}/auth`
- Common payment logic → `@{org}/pay`
- Common test config → `@{org}/test-config`
- Common UI components → `@{org}/ui`
- Common LLM client → `@{org}/llm`

### Phase 5: Revenue Bundles
Groups repos into complementary product bundles:
- Security suite (monitoring + scanning + compliance)
- Developer toolkit (CLI + IDE + testing)
- AI platform (agents + orchestration + marketplace)

## Usage

```bash
# Scan your own org
/boost-org finsavvyai

# Scan any GitHub org
/boost-org vercel
/boost-org anthropics

# Scan a user
/boost-org karpathy

# Quick scan (READMEs only)
/boost-org finsavvyai quick

# Focus on open-source mapping only
/boost-org finsavvyai full open-source
```

## Output

```
.luna/boost-org/{org}/
  repos.md              # All repos classified
  correlation-map.md    # How repos relate to each other
  duplicates.md         # Shared patterns that should be libraries
  open-source-map.md    # Which tools apply to which repos
  shared-lib-plan.md    # Proposed shared packages
  bundles.md            # Revenue bundle groupings
  roadmap.md            # Prioritized cross-repo improvements
  orphans.md            # Repos with no clear connection
```

## Example Output (for an org with 10+ repos)

```markdown
# finsavvyai — 39 Repos Analyzed

## Correlation Clusters
Cluster 1: AI Platform (5 repos)
  luna-os ←→ finsavvyai ←→ skill-seekers ←→ a2a-framework
  Shared: LLM calls, agent orchestration, MCP protocol

Cluster 2: Security (3 repos)
  opensyber ←→ pipewarden ←→ coderail-dev
  Shared: security scanning, compliance, monitoring

Cluster 3: Fintech (3 repos)
  fintech-suite ←→ global-remit ←→ hashmal
  Shared: payment processing, KYC, compliance

## Shared Library Candidates
1. LLM Client (used in 12 repos) → @finsavvyai/llm
2. Auth Middleware (used in 9 repos) → @finsavvyai/auth
3. Payment SDK (used in 11 repos) → @finsavvyai/pay

## Open Source Boost Map
llamafile → 8 repos (any with AI)
Victory → 6 repos (any with dashboard)
flakestress → all 39 repos (testing)
Perfetto → 12 repos (web apps)
```

## In Pipes

```bash
# Scan org then boost individual projects
/pipe boost-org finsavvyai >> boost-project /path/to/top-priority

# Full portfolio optimization
/pipe boost-org myorg >> leverage user:competitor
```
