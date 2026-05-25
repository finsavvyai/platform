---
name: ll-boost-project
displayName: Luna Boost Project
description: Analyze any project and generate an integration plan using open-source tools from GitHub
version: 2.0.0
category: analysis
agent: luna-task-executor
parameters:
  - name: path
    type: string
    description: "Project path (e.g., '.' for current)"
    required: false
    default: "."
    prompt: true
  - name: depth
    type: string
    description: "quick, full, deep"
    required: false
    default: full
prerequisites: []
---

# Luna Boost Project — Leverage Open Source to Supercharge Any Project

Scans your codebase, classifies what it does, and maps it against 20+ curated open-source tools to generate a specific integration plan.

## Open-Source Tool Library

### AI / LLM
- [llamafile](https://github.com/mozilla-ai/llamafile) — Run LLMs as single executables, free, offline
- [any-llm](https://github.com/mozilla-ai/any-llm) — Unified Python SDK for multiple LLM providers
- [nanoGPT](https://github.com/karpathy/nanoGPT) — Minimal GPT training (~300 lines)
- [llm.c](https://github.com/karpathy/llm.c) — Train GPT-2/3 in raw C/CUDA

### 3D / Visual
- [LLaMA-Mesh](https://github.com/nv-tlabs/LLaMA-Mesh) — Text-to-3D mesh generation
- [3DGRUT](https://github.com/nv-tlabs/3dgrut) — 3D Gaussian ray tracing renderer
- [PPISP](https://github.com/nv-tlabs/ppisp) — Camera correction for 3D renders

### Voice
- [Voicebox](https://github.com/jamiepine/voicebox) — Free local TTS + voice cloning, 23 languages

### Performance / Testing
- [Perfetto](https://github.com/google/perfetto) — Performance tracing + SQL analysis
- [flakestress](https://github.com/bradfitz/flakestress) — Detect flaky tests under stress

### Networking
- [Tailscale](https://github.com/tailscale/tailscale) — Zero-config WireGuard mesh VPN

### UI
- [Victory](https://github.com/FormidableLabs/victory) — Composable React charts
- [Spacedrive](https://github.com/spacedriveapp/spacedrive) — Rust + Tauri desktop reference

### Agents
- [Agent of Empires](https://github.com/njbrake/agent-of-empires) — Parallel AI agents with git worktrees

### Search / Database
- [RuVector](https://github.com/ruvnet/RuVector) — Self-learning vector DB, hybrid search, graph RAG

### Reference Architectures
- [ruflo](https://github.com/ruvnet/ruflo) — Self-learning agent orchestration patterns
- [flow-nexus](https://github.com/ruvnet/flow-nexus) — Gamified agentic platform patterns
- [Dossier](https://github.com/ruvnet/Dossier) — Visual planning + context control patterns

### Community
- [KarpathyTalk](https://github.com/karpathy/KarpathyTalk) — Dev social platform (Go + SQLite + htmx)
- [Inbox Zero](https://github.com/elie222/inbox-zero) — AI email management
- [GitNexus](https://github.com/abhigyanpatwari/GitNexus) — Repo analytics

## Matching Logic

### By Stack
- **Go** → llamafile, Perfetto, flakestress, Tailscale
- **TypeScript/React** → Victory, Voicebox, any-llm
- **Python** → any-llm, llamafile, nanoGPT, llm.c
- **Rust** → Spacedrive patterns, 3DGRUT

### By Domain
- **SaaS** → Victory, Voicebox, Inbox Zero patterns
- **DevTool** → llamafile, Perfetto, flakestress, Agent of Empires
- **FinTech** → RuVector hybrid search, Tailscale
- **AI/ML** → llamafile, nanoGPT, llm.c, LLaMA-Mesh
- **Testing** → flakestress, Perfetto
- **Marketing** → LLaMA-Mesh, Voicebox, Victory

### By Gap
- No charts → Victory
- No tests → flakestress
- No voice → Voicebox
- No offline AI → llamafile
- No search → RuVector
- No perf monitoring → Perfetto
- No 3D → LLaMA-Mesh

## Usage

```bash
/boost-project
/boost-project /path/to/project
/boost-project . deep
```

## Output

```
.luna/{project}/boost/
  analysis.md           # Project classification
  tool-mapping.md       # Which tools apply and why
  integration-plan.md   # Prioritized steps with links
  quick-wins.md         # < 1 hour improvements
```

## In Pipes

```bash
/pipe boost-project . >> go
/pipe boost-project . >> site-audit https://myapp.com
```
