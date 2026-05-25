> **HISTORICAL:** This sprint doc reflects technology choices at time of writing. Auth migrated from Clerk to Auth.js (March 2026). Compute migrated from Fly.io to Hetzner Cloud. Pricing tiers updated. See `CLAUDE.md` for current stack.

# Sprint 16: AI Threat Intelligence + LLM Compliance Assistant (2 weeks)

## Goal
Elevate every security finding from raw data into actionable intelligence using
LLMs. Users can ask the compliance assistant "Are we SOC2 ready?" and receive
a precise, context-aware answer. This differentiates OpenSyber from all three
competitors — none have a native AI intelligence layer.

## Dependencies
- Sprint 13 complete (risk scores provide AI context)
- Sprint 14 complete (attack paths provide AI narrative context)
- Sprint 15 complete (SaaS findings feed AI analysis)
- OpenAI API key in Worker secrets

## Competitive Target
- **Differentiator:** None of CyberArk / Wiz / Suridata have native LLM intelligence
- Closest: Wiz has "Wiz AI" (beta); OpenSyber can ship this before they GA

---

## ⚡ MVP PATH (4 days) — Ship AI explain + compliance chat

### MVP.1 — AI Insights Schema (Day 1)
```sql
CREATE TABLE ai_insights (
  id TEXT PRIMARY KEY,
  orgId TEXT NOT NULL,
  entityType TEXT NOT NULL,   -- 'finding' | 'attack_path' | 'compliance' | 'chat'
  entityId TEXT,              -- findingId, attackPathId, etc.
  prompt TEXT NOT NULL,
  response TEXT NOT NULL,
  model TEXT NOT NULL,        -- 'gpt-4o' | 'claude-sonnet-4-6'
  inputTokens INTEGER,
  outputTokens INTEGER,
  createdAt TEXT NOT NULL
);

CREATE TABLE ai_recommendations (
  id TEXT PRIMARY KEY,
  orgId TEXT NOT NULL,
  entityType TEXT NOT NULL,
  entityId TEXT NOT NULL,
  category TEXT NOT NULL,     -- 'remediation' | 'risk_reduction' | 'compliance'
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  estimatedImpact TEXT,       -- 'Reduces risk score by ~15 points'
  effort TEXT,                -- 'low' | 'medium' | 'high'
  priority INTEGER DEFAULT 50,
  isActioned INTEGER DEFAULT 0,
  generatedAt TEXT NOT NULL
);
```
- [ ] Create D1 migration `0016_ai_intelligence.sql`
- [ ] Update Drizzle schema in `packages/db/src/schema/security.ts`

### MVP.2 — AI Service (Day 1–2)
- [ ] Create `apps/api/src/services/ai-intelligence.ts` (< 200 lines):
  ```typescript
  // Calls Claude API (primary) with OpenAI fallback
  export async function explainFinding(finding: CspmFinding): Promise<string>
  export async function narrateAttackPath(path: AttackPath): Promise<string>
  export async function assessCompliance(framework: string, orgId: string): Promise<string>
  export async function chatWithData(message: string, context: OrgContext): Promise<string>
  ```
  - System prompt includes: org risk score, recent findings, active incidents
  - Cache responses in `ai_insights` table (re-use for 24h for same entity)
  - Never send actual secret values, only key names and metadata
- [ ] Create `apps/api/src/routes/ai.ts`:
  - `POST /api/ai/explain` — explain a specific finding
  - `POST /api/ai/narrate-path` — narrate an attack path
  - `POST /api/ai/compliance-chat` — compliance assistant (streaming)
  - `GET  /api/ai/recommendations` — list AI recommendations for org
- [ ] Rate limits: Free=5/day, Personal=20/day, Pro+=unlimited
- [ ] Write tests with mocked AI responses

### MVP.3 — AI UI Components (Day 2–3)
- [ ] Create `components/dashboard/security/AiExplainPanel.tsx`:
  - "Explain this" button → loading → streaming text response
  - Shows in expandable accordion below each finding row
  - Copy button for remediation instructions
- [ ] Create `components/dashboard/security/ComplianceAssistant.tsx`:
  - Chat interface: user types question, AI responds
  - Context selector: "SOC2", "GDPR", "HIPAA", "Custom"
  - Example questions: "What's blocking our SOC2 certification?"
  - Conversation history (in-session only, not persisted)
- [ ] Write component tests

### MVP.4 — AI Recommendations Page (Day 3–4)
- [ ] Create `app/dashboard/security/recommendations/page.tsx`:
  - Prioritized list of AI-generated action items
  - Each item: title, description, impact estimate, effort level
  - "Generate recommendations" button (triggers new AI pass)
  - Mark as actioned (archived, not deleted)
- [ ] Add "AI Recommendations" to security sidebar
- [ ] Daily cron: regenerate recommendations for all active orgs
- [ ] Write page tests

---

## 🔵 FULL PATH (10 days) — Full AI intelligence platform

Everything in MVP plus:

### FULL.1 — Context-Rich AI Engine
- [ ] Expand system prompt context:
  - Full asset graph summary
  - Recent audit log (last 50 events)
  - Compliance framework gaps
  - Threat intel feed (CVEs affecting installed skills)
- [ ] Multi-turn conversation with history stored in `ai_insights`
- [ ] "Memory" — AI remembers previous context within a session
- [ ] Fine-tuning dataset: collect user feedback (thumbs up/down) per response

### FULL.2 — Proactive Threat Hunting
- [ ] Scheduled AI analysis: "What new risks emerged this week?"
- [ ] Weekly AI security digest email:
  - Top 3 new risks
  - Progress since last week
  - Top recommended action
- [ ] Anomaly detection: "This instance accessed a new external IP at 3am"

### FULL.3 — Natural Language Security Queries

**Do not build from scratch.** Two portfolio products cover this entirely:

- **QueryFlux MCP Server** (`queryflux-mcp` skill, P0, 0.5d to package) — already
  an MCP server exposing `execute_query`, `get_schema`, `natural_language_query`
  tools. Install as a companion skill alongside OpenSyber's MCP Server.
- **QueryLens API** (`querylens-nl-sql` skill, P1, 2d to package) — Java/Spring Boot
  NLP→SQL engine using GPT-4. Wrap as agent container skill.

See [skill-catalog.md](../skills/skill-catalog.md) for full packaging details.

Together they enable:

- [ ] Natural language → SQL translation for asset queries:
  - "Show me all public-facing instances with critical findings"
  - "Which secrets haven't been rotated in 90 days?"
  - "List all JIT access requests approved by john@company.com last week"
- [ ] Combined MCP endpoint: security tools (OpenSyber) + data tools (QueryFlux)
- [ ] Query builder UI with AI assist
- [ ] Save queries as saved reports

### FULL.4 — AI-Powered Compliance Audit
- [ ] Auto-fill compliance questionnaires (SOC2 Type II, ISO27001 checklist)
- [ ] Gap analysis: "You need 3 more controls before SOC2 audit"
- [ ] Evidence collection: AI maps existing audit logs → SOC2 controls
- [ ] Generate draft vendor security questionnaire responses

### FULL.5 — Multi-Model Strategy (via FinSavvyAI LLM Gateway — **do not build from scratch**)

**Do not hand-build the multi-provider routing.** Package FinSavvyAI's LLM gateway instead:

- [ ] Follow [`skill-catalog.md`](../skills/skill-catalog.md) → `finsavvyai-llm-gateway` (P0, 1 day)
- [ ] Extract `LLMGateway` class from `~/dev/projects/02_AI_AGENTS/llm/gateway.py`
- [ ] Wire provider registry → vault credential lookup (`ctx.vault.read()`)
- [ ] Wire provider responses → `ctx.emit.aiInsight()` for anomalous LLM behavior
- [ ] Wire provider responses → `ctx.emit.riskDelta()` for prompt injection detections

**Provider registry (already built — 95% real, 165 files, 868 functions):**

- `anthropic` → Claude claude-sonnet-4-6 primary (best for security analysis)
- `openai` → GPT-4o fallback
- `gemini` → Gemini 1.5 Pro alternative
- `ollama` → local model support (air-gapped enterprise customers)

**What you get for free vs building from scratch:**

| Built from scratch | FinSavvyAI gateway |
| --- | --- |
| Multi-provider routing logic | Already built ✓ |
| Token count logging | Already built ✓ |
| Fallback + retry logic | Already built ✓ |
| Prompt injection detection | Already built ✓ |
| AI cost tracking | Already built ✓ |
| **~2 days of work** | **1 day packaging** |

---

## ⚡ MCP Server (2 days — add to either path)

**OpenSyber as an MCP server** lets any LLM-based tool (Claude Code, Cursor,
Cline, Devin, custom agents) query live security data in natural conversation.
Critically: the AI agents **OpenSyber hosts** can call back into their own
platform's security posture — a feedback loop no competitor can replicate.

### MCP.1 — MCP Server Implementation (Day 1)

```typescript
// apps/api/src/mcp/server.ts
// Implements the Model Context Protocol over HTTP/SSE
// Endpoint: GET /api/mcp  (SSE stream) + POST /api/mcp  (tool calls)

export const mcpTools = [
  {
    name: 'get_org_risk_score',
    description: 'Get the current security risk score for the organization',
    inputSchema: z.object({ orgId: z.string().optional() }),
  },
  {
    name: 'list_critical_findings',
    description: 'List open CSPM or SaaS findings with critical severity',
    inputSchema: z.object({
      provider: z.enum(['aws', 'gcp', 'azure', 'github', 'slack', 'm365']).optional(),
      limit: z.number().default(10),
    }),
  },
  {
    name: 'get_attack_paths',
    description: 'Get active attack paths to high-value assets',
    inputSchema: z.object({ maxPaths: z.number().default(5) }),
  },
  {
    name: 'check_compliance_status',
    description: 'Check compliance posture for a specific framework',
    inputSchema: z.object({
      framework: z.enum(['soc2', 'iso27001', 'hipaa', 'gdpr', 'pci']),
    }),
  },
  {
    name: 'get_secret_rotation_status',
    description: 'Check which secrets are overdue for rotation',
    inputSchema: z.object({ instanceId: z.string().optional() }),
  },
  {
    name: 'run_security_scan',
    description: 'Trigger an on-demand security scan for a cloud account',
    inputSchema: z.object({ cloudAccountId: z.string() }),
  },
  {
    name: 'explain_finding',
    description: 'Get AI explanation and remediation for a specific finding',
    inputSchema: z.object({ findingId: z.string() }),
  },
]
```

- [ ] Create `apps/api/src/mcp/server.ts` (< 200 lines):
  - SSE endpoint for MCP client connection
  - Tool dispatcher: routes tool calls to existing service layer
  - Auth: MCP API key (separate from user JWT, scoped read-only by default)
- [ ] Create `apps/api/src/mcp/tools/` — one file per tool (< 50 lines each)
- [ ] Create `apps/api/src/routes/mcp.ts`:
  - `GET  /api/mcp` — SSE stream (MCP client connects here)
  - `POST /api/mcp` — tool invocation endpoint
- [ ] MCP API key management (create/revoke in dashboard settings)
- [ ] Write tests with mock MCP client

### MCP.2 — Agent Self-Awareness (Day 2)

The unique OpenSyber feature: hosted agents can inspect their own security posture.

- [ ] Pre-inject MCP endpoint URL + read-only token into every agent container env:

  ```bash
  OPENSYBER_MCP_URL=https://api.opensyber.cloud/api/mcp
  OPENSYBER_MCP_TOKEN=mcp_xxx
  ```

- [ ] Update agent container Dockerfile to include `@modelcontextprotocol/sdk`
- [ ] Agent README: "Your agent can query its own security findings via MCP"
- [ ] Example: Cline / Cursor agents automatically aware of:
  - "You have 3 critical findings in this cloud account"
  - "Credential X is 45 days overdue for rotation"
  - "Your SOC2 compliance is 87% — missing 3 controls"
- [ ] Dashboard: "MCP Connections" tab in settings — shows connected MCP clients
- [ ] Write integration tests

### MCP.3 — Claude Code Integration Guide

- [ ] Publish `.claude/mcp.json` config snippet users copy into their project:

  ```json
  {
    "mcpServers": {
      "opensyber": {
        "url": "https://api.opensyber.cloud/api/mcp",
        "apiKey": "${OPENSYBER_MCP_TOKEN}"
      }
    }
  }
  ```

- [ ] Dashboard: "Copy MCP config" button in settings

---

## Definition of Done
- [ ] "Explain this" button on all CSPM + SaaS findings
- [ ] Compliance assistant chat available
- [ ] AI recommendations visible with priority ordering
- [ ] Responses cached 24h (no redundant API calls)
- [ ] Rate limits enforced per plan
- [ ] All new routes tested with mocked AI (>80% coverage)

## Estimated Effort
| Task | MVP Days | Full Days |
|---|---|---|
| Schema + migration | 0.5 | 0.5 |
| AI service + routes | 1.5 | 3 |
| UI components (explain + chat) | 1.5 | 3 |
| Recommendations page | 0.5 | 1 |
| Proactive hunting + NL queries | — | 2.5 |
| **Total** | **4** | **10** |
