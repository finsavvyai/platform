---
name: ll-connect-infra
displayName: Luna Connect Infrastructure
description: Connect any project to your shared private infrastructure — Claw Gateway, ReasoningBank, Smart Router, Agent Booster, Credits
version: 1.0.0
category: infrastructure
agent: luna-task-executor
parameters:
  - name: path
    type: string
    description: "Project path"
    required: false
    default: "."
    prompt: true
  - name: action
    type: string
    description: "register (new project), status (check connection), list (all connected projects)"
    required: false
    default: register
prerequisites: []
---

# Luna Connect Infrastructure

Connect any project to your shared private infrastructure. One command gives your project access to AI routing, caching, cost tracking, and intelligence features.

## What Gets Connected

### Claw Gateway (Shared AI Proxy)
- Multi-provider LLM routing (Anthropic, OpenAI, DeepSeek, Workers AI)
- Automatic failover between providers
- Per-project API keys and usage tracking
- Rate limiting per project

### Intelligence Features (via Engine)
- **ReasoningBank** — KV cache for prompt→response pairs (30% savings)
- **Agent Booster** — Skip LLM for simple deterministic transforms (<1ms)
- **Context Packing** — Trim context to relevant parts (40-60% savings)
- **Smart Router** — Self-learning model selection (cheapest viable)
- **Hybrid Search** — Sparse+Dense RRF fusion (20-49% better)
- **Credit System** — Gamification with achievements

## Usage

```bash
# Register current project on shared infrastructure
/connect-infra

# Register specific project
/connect-infra /path/to/project register

# Check connection status
/connect-infra . status

# List all connected projects
/connect-infra . list
```

## What Registration Does

1. Generates a unique API key for the project
2. Registers the project on the Claw Gateway KV store
3. Creates `.env` entries for the project:
   ```
   CLAW_API_KEY=claw_xxxxx
   CLAW_ENDPOINT=https://claw-gateway.xxxxx.workers.dev
   CLAW_PROJECT_ID=my-project
   ```
4. Adds the gateway domain to any allowlists
5. Creates a client wrapper in the project's language:
   - TypeScript: `lib/claw-client.ts`
   - Go: `internal/ai/claw_client.go`
   - Python: `lib/claw_client.py`

## Per-Stack Integration

### TypeScript / Node.js
```typescript
import { ClawClient } from './lib/claw-client';
const claw = new ClawClient(process.env.CLAW_API_KEY);
const response = await claw.prompt('Analyze this code', { maxTokens: 2048 });
```

### Go
```go
client := ai.NewClawClient(os.Getenv("CLAW_API_KEY"), "my-project")
response, err := client.Prompt(ctx, systemPrompt, userPrompt, 2048)
```

### Python
```python
from lib.claw_client import ClawClient
claw = ClawClient(os.environ["CLAW_API_KEY"])
response = claw.prompt("Analyze this code", max_tokens=2048)
```

## Connected Projects

Shows which projects are currently registered:

```
/connect-infra . list

Connected Projects:
  lunaos        — LunaOS Engine              (active, 1.2K requests today)
  coderailflow  — CodeRail Flow              (active, 340 requests today)
  aegis         — AMLIQ AML Platform         (active, 89 requests today)
  opensyber     — OpenSyber Platform         (active, owns gateway)
  pushci        — Push-CI                    (registered, 0 requests)
  pipewarden    — PipeWarden                 (registered, 0 requests)
  queryflux     — QueryFlux                  (registered, 0 requests)
  qestro        — Qestro                     (registered, 0 requests)
```

## In Pipes

```bash
# Connect then boost with open-source tools
/pipe connect-infra . >> boost-project .

# Connect all projects in portfolio
/pipe connect-infra /path/to/project1 >> connect-infra /path/to/project2
```
