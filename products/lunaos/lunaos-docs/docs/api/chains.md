# Chains API

Agent chains let you run multiple agents in sequence, passing output from one to the next.

## List Chain Presets

Get available pre-built chain templates.

```http
GET /chains
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "chains": [
    {
      "id": "code-review-pipeline",
      "name": "Code Review Pipeline",
      "description": "Full code review with testing and documentation",
      "steps": ["code-review", "testing-validation", "documentation"],
      "tier": "free"
    },
    {
      "id": "security-audit",
      "name": "Security Audit",
      "description": "Comprehensive security analysis",
      "steps": ["code-review", "365-security", "deployment"],
      "tier": "pro"
    }
  ]
}
```

---

## Execute Chain

Run a chain of agents sequentially.

```http
POST /chains/execute
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "steps": [
    {"agent": "code-review"},
    {"agent": "testing-validation"},
    {"agent": "documentation"}
  ],
  "context": "function fetchUsers() { ... }",
  "provider": "deepseek"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `steps` | array | ✅ | Array of `{agent}` objects defining the chain |
| `context` | string | ✅ | Initial context passed to the first agent |
| `provider` | string | ❌ | LLM provider (default: `deepseek`) |
| `chain` | string | ❌ | Use a preset chain ID instead of manual `steps` |

**Response (200 SSE stream):**

```
data: {"type":"chain_start","steps":3}

data: {"type":"step_start","step":1,"agent":"code-review"}
data: {"type":"chunk","content":"## Code Review Results..."}
data: {"type":"step_done","step":1,"agent":"code-review","duration":"1.4s"}

data: {"type":"step_start","step":2,"agent":"testing-validation"}
data: {"type":"chunk","content":"## Generated Tests..."}
data: {"type":"step_done","step":2,"agent":"testing-validation","duration":"2.1s"}

data: {"type":"step_start","step":3,"agent":"documentation"}
data: {"type":"chunk","content":"## API Documentation..."}
data: {"type":"step_done","step":3,"agent":"documentation","duration":"1.8s"}

data: {"type":"chain_done","totalDuration":"5.3s","totalTokens":2847}
```

---

## Example: Full Chain Execution

```bash
TOKEN="your-jwt-token"

# Run a 3-step chain
curl -N -X POST https://api.lunaos.ai/chains/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "steps": [
      {"agent": "requirements-analyzer"},
      {"agent": "design-architect"},
      {"agent": "code-review"}
    ],
    "context": "Build a real-time collaborative document editor with conflict resolution"
  }'
```

## Chain Rules

- **Max steps**: 5 agents per chain
- **Output passing**: Each step's output is appended to the context for the next step
- **Pro agents in chains**: If any step uses a Pro agent, the user must be on the Pro plan
- **Execution count**: Each chain counts as **one execution** toward monthly limits
