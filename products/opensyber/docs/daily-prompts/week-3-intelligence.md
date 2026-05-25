# Week 3 — Intelligence (Days 11–15)

**Track A:** Sprint 16 — AI Intelligence (Days 14-17)
**Track B:** Sprint 18 — Multi-Cloud Extension (Days 15-19)
**Track C:** All 11 skills complete (Track C officially done by Day 13)

---

## Day 11 — Sprint 14 Wrap (A) + Multi-Cloud Schema Prep (B)

### Vision
Milestone B is confirmed. The platform now scans cloud + SaaS and maps
attack paths. Today we prepare the AI Intelligence sprint (A) and lay
the schema for multi-cloud extension (B). This week culminates in the most
commercially differentiating feature: AI-driven threat analysis that explains
vulnerabilities in plain English and suggests prioritized fixes.

---

### Track A — Sprint 16 Prep: AI Intel Schema + LLM Provider Registry

```
SYSTEM CONTEXT: Sprint 14 complete. Sprint 16 starts Day 14. Pre-build
the schema and LLM provider registry today to remove blockers.
Read: docs/sprints/sprint-16-ai-intelligence.md

DESIGN PATTERN: Strategy (each LLM provider is a Strategy)
FILE BUDGET: ≤ 200 lines

IMPORTANT: FinSavvyAI has a real multi-provider LLM gateway (Anthropic,
OpenAI, Gemini, Ollama all built). Do NOT build provider routing from scratch.
Use finsavvyai-llm-gateway skill (packaged Day 5 Track C).

TASK A1 — AI Intelligence schema:
Add to packages/db/src/schema/security.ts:
  ai_analyses: id, orgId, entityType (finding/attack_path/org),
    entityId, analysisType (triage/explain/suggest), prompt TEXT,
    response TEXT, modelId, tokens, confidence, createdAt
  ai_recommendations: id, orgId, analysisId, priority (1-10),
    title, description, effort (low/med/high), impact (low/med/high),
    status (open/accepted/dismissed), createdAt

TASK A2 — LLMProviderRegistry (100 lines max):
Create apps/api/src/services/ai/llm-provider-registry.ts
- Pattern: Strategy + Factory
- registerProvider(provider: LLMProvider): void
- getProvider(modelId: string): LLMProvider
- LLMProvider interface: { id, analyze(prompt): Promise<string>, tokens }
- Default: Anthropic claude-sonnet-4-6 (current model)
- FinSavvyAI adapter wires in here (see TASK A3)

TASK A3 — FinSavvyAI LLM adapter (80 lines max):
Create apps/api/src/services/ai/finsavvyai-adapter.ts
- Pattern: Adapter
- Wraps finsavvyai-llm-gateway SkillManifest into LLMProvider interface
- Gives access to Anthropic, OpenAI, Gemini, Ollama through one interface
- No new routing logic — reuse FinSavvyAI's existing routing

TASK A4 — Tests: LLMProviderRegistry with mock providers
```

---

### Track B — Sprint 18 Prep: Multi-Cloud Schema

```
SYSTEM CONTEXT: Sprint 15 complete. Sprint 18 starts Day 15.
Read: docs/sprints/sprint-18-multicloud.md

DESIGN PATTERN: Strategy (AWS/GCP/Azure scanners are interchangeable)

TASK B1 — Multi-cloud provider schema extension:
In packages/db/src/schema/security.ts, add 'provider' column to findings:
  - provider: text (aws/gcp/azure) default 'aws'
  - providerAccountId: text (AWS account ID / GCP project ID / Azure subscription)
Extend cloud_accounts table with:
  - regions TEXT (JSON array, for GCP: projects, for Azure: subscriptions)

TASK B2 — Scanner interface (80 lines max):
Create apps/api/src/skills/cspm/cloud-scanner.ts
- Pattern: Strategy interface
- CloudScanner: { provider, scan(credentials, config): Promise<Finding[]> }
- AwsScanner implements CloudScanner (delegates to ProwlerAdapter)
- GcpScanner stub + AzureScanner stub (to be implemented Day 15)

TASK B3 — Scanner factory (60 lines max):
Create apps/api/src/skills/cspm/scanner-factory.ts
- Pattern: Factory
- getScannerForProvider(provider: 'aws' | 'gcp' | 'azure'): CloudScanner
- Throws ProviderNotSupportedError with helpful message

TASK B4 — Tests: ScannerFactory returns correct scanner per provider
```

---

## Day 12 — Attack Graph Frontend (A) + Sprint 18 GCP (B)

### Track A — Sprint 16 Prep: Attack Graph Visualization Polish

```
CONTEXT: The Day 9 attack graph page was functional but minimal.
Before AI Intelligence begins, improve the visualization so AI-generated
insights have a meaningful surface to attach to.

DESIGN PATTERN: Decorator (AI insights layer over existing graph nodes)
FILE BUDGET: ≤ 200 lines

TASK A1 — AttackPathList Component (150 lines max):
Create apps/web/src/app/(dashboard)/security/graph/AttackPathList.tsx
- Client component: 'use client'
- Display top 10 attack paths ranked by criticalityScore
- Each path: expandable accordion showing the full node chain
- Highlight exploitability (red = high, amber = medium, green = low)
- "Analyze with AI" button per path (wires to Sprint 16)

TASK A2 — NodeDetail Modal (120 lines max):
Create apps/web/src/app/(dashboard)/security/graph/NodeDetail.tsx
- Show: type, label, riskScore, connected findings, CVSS score
- Attack edges: inbound + outbound with confidence values
- "Get AI explanation" button → placeholder (Sprint 16 completes this)

TASK A3 — Tests: component renders with mock graph data
```

---

### Track B — Sprint 18: GCP Prowler Extension

```
CONTEXT: AWS Prowler works. Extend to GCP.
Read: docs/sprints/sprint-18-multicloud.md

IMPORTANT: Prowler natively supports GCP. Use it. Do NOT build a GCP scanner.
Command: prowler gcp --project-ids <id>

TASK B1 — GcpScanner implements CloudScanner (100 lines max):
Create apps/api/src/skills/cspm/gcp-scanner.ts
- Extends ProwlerAdapter pattern for GCP
- Maps GCP ASFF output to Finding[] with provider='gcp'
- Handles GCP-specific resource types (project, bucket, instance, etc.)

TASK B2 — Update cloud-accounts route: accept provider='gcp'
  - Add GCP credentials schema to Zod validator
  - Store encrypted GCP service account JSON in vault

TASK B3 — Update CSPM Dashboard: show GCP accounts separately
TASK B4 — Tests: GcpScanner with mock Prowler GCP output
```

---

## Day 13 — Sprint 16 AI Triage Begins (A) + Azure Extension (B)

### Track A — Sprint 16: AI Threat Triage Service

```
SYSTEM CONTEXT: AI Intelligence sprint officially starts. LLM registry
and schema are ready from Day 11. FinSavvyAI adapter is wired.
Read: docs/sprints/sprint-16-ai-intelligence.md

DESIGN PATTERN: Command (each AI analysis request = Command)
FILE BUDGET: ≤ 200 lines

OPEN SOURCE: Use @anthropic-ai/sdk (already in packages/tokenforge).
Use AI SDK (Vercel) for streaming: pnpm add ai @ai-sdk/anthropic

TASK A1 — ThreatTriageService (170 lines max):
Create apps/api/src/services/ai/threat-triage-service.ts
- Pattern: Command
- triageFinding(finding: Finding): Promise<AiAnalysis>
  - Prompt: "You are a security analyst. Analyze this finding and explain:
    1) What was misconfigured. 2) What an attacker could do. 3) Priority.
    Respond in JSON: { severity_assessment, attack_scenario, priority: 1-10 }"
  - Use LLMProviderRegistry.getProvider('claude-sonnet-4-6')
  - Store result in ai_analyses table
- triageAttackPath(path: AttackPath): Promise<AiAnalysis>
  - Prompt explains the full kill chain in plain English

TASK A2 — AI Analysis Route (80 lines max):
Create apps/api/src/routes/ai/analysis.ts
- POST /api/v1/ai/analyze/finding/:id — trigger triage for a finding
- POST /api/v1/ai/analyze/path/:id — trigger triage for an attack path
- GET /api/v1/ai/analyses — list analyses for org (cursor paginated)
- requirePermission('ai.analysis.write')
- Rate limit: 50 analyses/day on free tier, 500 on pro

TASK A3 — Streaming Analysis API (80 lines max):
Create apps/api/src/routes/ai/stream-analysis.ts
- POST /api/v1/ai/analyze/stream — SSE streaming for long analyses
- Use Hono's streamSSE() helper
- Stream token-by-token using @ai-sdk/anthropic streamText()

TASK A4 — Tests: mock LLM responses, assert analysis structure + storage

SECURITY AUDIT:
[ ] AI prompts never include raw credentials or vault data
[ ] AI responses stored but user data (orgId) stripped before LLM call
[ ] Rate limit enforced in KV before any LLM API call
[ ] No prompt injection: finding data sanitized before embedding in prompt
```

---

### Track B — Sprint 18: Azure Prowler Extension

```
TASK B1 — AzureScanner implements CloudScanner (100 lines max):
Create apps/api/src/skills/cspm/azure-scanner.ts
- Uses: prowler azure --subscription-ids <id>
- Maps Azure ASFF to Finding[] with provider='azure'
- Azure-specific: management groups, subscriptions, resource groups

TASK B2 — Multi-cloud scan worker: extends cspm-scan-worker.ts to handle
  provider-specific scanner selection via ScannerFactory

TASK B3 — Tests: AzureScanner with mock Prowler Azure output
```

---

## Day 14 — AI Recommendations (A) + Multi-Cloud Dashboard (B)

### Track A — Sprint 16: AI Recommendations + Finding Explain

```
DESIGN PATTERN: Factory (generates Recommendation objects from AI output)
FILE BUDGET: ≤ 200 lines

TASK A1 — RecommendationService (150 lines max):
Create apps/api/src/services/ai/recommendation-service.ts
- Pattern: Factory
- fromAnalysis(analysis: AiAnalysis): AiRecommendation[]
  - Parse AI response JSON → structured recommendations
  - Score priority, effort, impact (normalize to 1-10 scale)
  - Insert into ai_recommendations table
- getTopRecommendations(orgId, limit=10): prioritized list

TASK A2 — AI-powered Finding Explain (70 lines max):
Create apps/api/src/routes/ai/explain.ts
- GET /api/v1/ai/explain/finding/:id — plain-English explanation
  - Check ai_analyses cache first (KV 24h TTL)
  - If miss → call ThreatTriageService.triageFinding()
  - Return explanation + recommendations

TASK A3 — AI Panel Component (180 lines max):
Create apps/web/src/app/(dashboard)/security/ai/AiInsightsPanel.tsx
- Client component: 'use client'
- Shows top recommendations with priority + effort + impact badges
- "Explain" button per finding: streams AI response (SSE)
- Accept/Dismiss recommendation with optimistic UI update

TASK A4 — Tests: RecommendationService parsing, AiInsightsPanel rendering
```

---

### Track B — Sprint 18: Multi-Cloud Dashboard + Sprint Closeout

```
TASK B1 — Multi-cloud overview page (180 lines max):
Create apps/web/src/app/(dashboard)/security/multicloud/page.tsx
- Server Component: query all cloud accounts (AWS + GCP + Azure)
- Group by provider: show findings count + risk score per provider
- Regional breakdown: findings per AWS region / GCP project / Azure sub

TASK B2 — Sprint 18 DoD: mark all tasks in sprint-18-multicloud.md done.

TASK B3 — Cross-cloud attack path: ensure GraphBuilderService handles
  GCP nodes and Azure nodes (providerAccountId as node identifier)

MULTI-CLOUD MILESTONE: AWS + GCP + Azure all scanning. Sprint 18 complete.
```

---

## Day 15 — Sprint 16 AI Complete (A)

### Track A — Sprint 16 Final: NL Security Query + Sprint Close

```
CONTEXT: AI triage + recommendations are live. Final piece: natural language
security queries powered by querylens-nl-sql skill (packaged Day 10, Track C).

TASK A1 — NL Security Query route (80 lines max):
Create apps/api/src/routes/ai/query.ts
- POST /api/v1/ai/query — natural language → security insight
  Body: { question: string }
  - Use querylens-nl-sql SkillRunner to convert → SQL → execute → format
  - Examples: "Which accounts have critical findings unresolved > 7 days?"
  - Return: { answer, sql, results }

TASK A2 — Query UI (150 lines max):
Create apps/web/src/app/(dashboard)/security/ai/QueryInterface.tsx
- Client component: search box, send button, streaming response display
- Show generated SQL (collapsible) + formatted results table
- Suggested queries: pre-seeded examples shown as chips

TASK A3 — Sprint 16 DoD: read sprint-16-ai-intelligence.md, mark all done.

AI INTELLIGENCE MILESTONE (Milestone C partial):
"AI triage + NL queries" live. Engineers can ask the platform questions
in plain English and get structured answers backed by real D1 data.

echo "Sprint 16 complete. AI Intelligence operational. Day 15/35."
```

---

### Week 3 End-of-Week Gate

```bash
pnpm typecheck && pnpm test --coverage && pnpm build

# Coverage check for AI services (critical path):
# apps/api/src/services/ai/ → must be ≥ 80% lines + branches
# apps/api/src/skills/cspm/ → must be ≥ 80%

# Security audit — AI-specific checks:
# [ ] No customer data in LLM prompts (only finding metadata, no PII)
# [ ] AI responses stored with orgId scoping
# [ ] Rate limit enforced per plan tier
# [ ] Prompt injection prevention: sanitize finding.description before embed

echo "Week 3 complete. Day 15/35."
echo "Sprints complete: 11, 11b, 12, 13, 14, 15, 16, 18 (Track B)"
echo "Next: Sprint 17 Remediation Engine (Milestone C)"
```
