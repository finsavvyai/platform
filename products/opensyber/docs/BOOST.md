# Boost Integrations — OpenSyber

Open-source and infrastructure integrations that extend the platform beyond core agent hosting. Each section is self-contained: read the one you need.

---

## Table of Contents

1. [Victory Charts](#1-victory-charts)
2. [Vectorize Semantic Search](#2-vectorize-semantic-search)
3. [Perfetto Tracing](#3-perfetto-tracing)
4. [Flaky Test Detection](#4-flaky-test-detection)
5. [Tailscale Mesh VPN](#5-tailscale-mesh-vpn)
6. [llamafile Offline AI](#6-llamafile-offline-ai)
7. [Multi-Model Consensus](#7-multi-model-consensus)
8. [3D Attack Graph](#8-3d-attack-graph)

---

## 1. Victory Charts

**Location:** `packages/ui/src/charts/`
**Package:** `@opensyber/ui`
**Dependency:** [Victory](https://formidable.com/open-source/victory/) (React charting)

12 chart components across three domains: security dashboards, admin analytics, and gateway metrics. All use a shared dark theme that matches the neutral-900 design system.

### Imports

```typescript
import {
  // Security
  ThreatTrendChart,
  SeverityDonutChart,
  SecurityScoreChart,
  AlertVolumeChart,

  // Admin / Series A data room
  PlanDistributionChart,
  RevenueTrendChart,
  ConversionFunnelChart,
  SkillPopularityChart,

  // Gateway metrics
  AgentUsageChart,
  CostBreakdownChart,
  LatencyChart,
  CreditBalanceChart,

  // Theme utilities
  darkTheme,
  COLORS,
  SEVERITY_COLORS,
  PIE_PALETTE,
  CHART_HEIGHT,
  CHART_PADDING,
} from '@opensyber/ui';
```

### Security Charts

**ThreatTrendChart** — Multi-line risk score over time (combined, agent, CSPM).

```typescript
interface ThreatTrendPoint {
  date: string;
  agentScore: number;
  cspmScore: number;
  combinedScore: number;
}

<ThreatTrendChart data={points} />
```

**SeverityDonutChart** — Finding severity distribution as a donut.

```typescript
interface SeverityData {
  severity: string; // 'critical' | 'high' | 'medium' | 'low' | 'info'
  count: number;
}

<SeverityDonutChart data={[
  { severity: 'critical', count: 3 },
  { severity: 'high', count: 12 },
  { severity: 'medium', count: 45 },
  { severity: 'low', count: 89 },
]} />
```

**SecurityScoreChart** — Area chart with color-coded threshold (green >= 80, amber >= 50, red < 50).

```typescript
interface ScoreHistoryPoint { date: string; score: number }

<SecurityScoreChart data={scoreHistory} />
```

**AlertVolumeChart** — Grouped bar chart of alerts per day by severity.

```typescript
interface AlertVolumePoint {
  date: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

<AlertVolumeChart data={dailyAlerts} />
```

### Admin Charts

**PlanDistributionChart** — Pie chart of users per plan.

```typescript
interface PlanDistributionData { plan: string; count: number }

<PlanDistributionChart data={[
  { plan: 'Free', count: 1200 },
  { plan: 'Pro', count: 340 },
  { plan: 'Team', count: 85 },
  { plan: 'Enterprise', count: 12 },
]} />
```

**RevenueTrendChart** — MRR (area) + ARR (dashed line) dual chart.

```typescript
interface RevenuePoint { date: string; mrr: number; arr: number }

<RevenueTrendChart data={revenueData} />
```

**ConversionFunnelChart** — Horizontal bar chart.

```typescript
interface ConversionStep { stage: string; count: number }

<ConversionFunnelChart data={[
  { stage: 'Visitors', count: 10000 },
  { stage: 'Signups', count: 1400 },
  { stage: 'Active', count: 600 },
  { stage: 'Paid', count: 120 },
]} />
```

**SkillPopularityChart** — Horizontal bar chart of top skills by install count.

```typescript
interface SkillPopularityData { name: string; installs: number }

<SkillPopularityChart data={topSkills} />
```

### Gateway Charts

**AgentUsageChart** — Bar chart of daily prompt counts.

```typescript
<AgentUsageChart data={[{ date: '2026-04-01', count: 342 }, ...]} />
```

**CostBreakdownChart** — Pie chart of cost per LLM provider.

```typescript
<CostBreakdownChart data={[
  { provider: 'Anthropic', cost: 45.20 },
  { provider: 'OpenAI', cost: 12.80 },
]} />
```

**LatencyChart** — Line chart of gateway response time.

```typescript
<LatencyChart data={[{ time: '2026-04-01 10:00', ms: 320 }, ...]} />
```

**CreditBalanceChart** — Area chart of credit balance over time.

```typescript
<CreditBalanceChart data={[{ date: '2026-04-01', balance: 150.00 }, ...]} />
```

### Theme Customization

All charts use the shared `darkTheme` object, based on `VictoryTheme.grayscale` with overrides for the dark UI:

```typescript
import { darkTheme, COLORS, SEVERITY_COLORS } from '@opensyber/ui';

// Use directly with any Victory chart:
<VictoryChart theme={darkTheme} height={220} padding={CHART_PADDING}>
  {/* your Victory components */}
</VictoryChart>
```

**Color constants:**

| Token | Hex | Usage |
|---|---|---|
| `COLORS.blue` | `#3b82f6` | Primary lines, bars |
| `COLORS.cyan` | `#06b6d4` | Gateway, latency |
| `COLORS.green` | `#22c55e` | Positive scores, MRR |
| `COLORS.amber` | `#f59e0b` | Warnings, CSPM |
| `COLORS.rose` | `#f43f5e` | Errors, low scores |
| `COLORS.teal` | `#00E5C3` | Brand accent, ARR |
| `COLORS.purple` | `#a855f7` | Secondary category |

**Severity palette** (used by `SeverityDonutChart`, `AlertVolumeChart`, and the 3D attack graph):

| Severity | Color |
|---|---|
| `critical` | `#EF4444` |
| `high` | `#F97316` |
| `medium` | `#EAB308` |
| `low` | `#22C55E` |
| `info` | `#6B7280` |

---

## 2. Vectorize Semantic Search

**Location:** `apps/api/src/services/vector-search.ts`, `apps/api/src/routes/semantic-search.ts`
**Infrastructure:** Cloudflare Vectorize + Workers AI (`bge-base-en-v1.5` embeddings)

Natural-language search over skills and security findings. Instead of keyword matching, this uses vector embeddings so queries like "find skills for lateral movement detection" return relevant results even without exact keyword overlap.

### API Endpoints

All endpoints require Bearer JWT auth. Base URL: `https://api.opensyber.cloud`

#### Search Skills

```
GET /api/search/skills?q=<query>&limit=<n>
```

| Param | Type | Default | Description |
|---|---|---|---|
| `q` | string | required | Natural language search query |
| `limit` | number | 10 | Max results (capped at 25) |

**Permission:** `marketplace.browse`

**Response:**

```json
{
  "data": [
    {
      "id": "skill-uuid",
      "name": "AI Triage",
      "description": "Batch finding prioritization...",
      "category": "security",
      "relevanceScore": 0.87
    }
  ],
  "query": "lateral movement detection"
}
```

Only skills with `verificationStatus: 'approved'` are returned. Results are sorted by relevance score (cosine similarity).

#### Search Findings

```
GET /api/search/findings?q=<query>&limit=<n>
```

| Param | Type | Default | Description |
|---|---|---|---|
| `q` | string | required | Natural language search query |
| `limit` | number | 10 | Max results (capped at 25) |

**Permission:** `security.read`

**Response:**

```json
{
  "data": [
    {
      "id": "finding-uuid",
      "score": 0.92,
      "namespace": "findings",
      "metadata": {
        "title": "Exposed SSH key in container",
        "severity": "high",
        "description": "SSH private key found in /home/..."
      }
    }
  ],
  "query": "exposed credentials"
}
```

#### Reindex All Skills

```
POST /api/search/reindex
```

**Permission:** `admin.manage` (admin only)

Rebuilds the entire skill vector index from the database. Returns the count of indexed skills.

**Response:**

```json
{ "data": { "indexed": 42, "total": 42 } }
```

### Indexing New Content

When a new skill is published or a finding is ingested, call the service functions directly:

```typescript
import { indexSkill, indexFinding, removeFromIndex } from '../services/vector-search.js';

// Index a skill after marketplace approval
await indexSkill(c.env.AI, c.env.VECTORIZE, {
  id: skill.id,
  name: skill.name,
  description: skill.description,
  category: skill.category,
  tags: skill.tags,
});

// Index a finding after ingestion
await indexFinding(c.env.AI, c.env.VECTORIZE, {
  id: finding.id,
  title: finding.title,
  description: finding.description,
  severity: finding.severity,
});

// Remove from index (skill unpublished, finding resolved)
await removeFromIndex(c.env.VECTORIZE, [itemId]);
```

### Wrangler Bindings

The API worker needs these bindings in `wrangler.toml`:

```toml
[ai]
binding = "AI"

[[vectorize]]
binding = "VECTORIZE"
index_name = "opensyber-search"
```

If `AI` or `VECTORIZE` bindings are missing, the endpoints return `503 Vector search not configured`.

---

## 3. Perfetto Tracing (with OpenTelemetry Export)

**Location:** `apps/api/src/services/trace.ts`, `apps/api/src/services/trace-otel.ts`, `apps/api/src/middleware/trace.ts`, `apps/api/src/routes/traces.ts`
**Storage:** Cloudflare KV (`CACHE` namespace), 1-hour TTL
**Viewers:** [Perfetto UI](https://ui.perfetto.dev), any OTLP-compatible backend (Jaeger, Grafana Tempo, Honeycomb, Datadog, etc.)

Every API request is automatically traced. The trace middleware creates a `TraceCollector`, instruments the request lifecycle, stores the result in KV, and returns an `X-Trace-Id` header. You can then retrieve the trace in either **Chrome Trace Event format** (Perfetto) or **OpenTelemetry OTLP/JSON**.

### How It Works

1. The `traceMiddleware` runs on every request.
2. A `TraceCollector` is created and attached to the Hono context at `c.get('trace')`.
3. The middleware creates a root `request` span covering the full request lifecycle.
4. Route handlers and services can add their own spans.
5. After the response, the trace is serialized to Chrome Trace Event format and stored in KV.
6. The `X-Trace-Id` header is set on the response.

### Adding Custom Spans

Inside any route handler or service that has access to the Hono context:

```typescript
const trace = c.get('trace');

// Time a specific operation
const span = trace.startSpan('llm-proxy', { model: 'claude-haiku', tokens: 500 });
const result = await callLLM(prompt);
span.end();

// Mark a point-in-time event (zero duration)
trace.addInstantEvent('cache-miss', { key: 'skill:abc' });
```

### Retrieving a Trace

**Perfetto (Chrome Trace Event) format:**

```
GET /api/admin/traces/:traceId
```

**OpenTelemetry OTLP/JSON format:**

```
GET /api/admin/traces/:traceId/otel
```

**Permission (both):** `admin.manage`

Perfetto endpoint returns:

```json
{
  "traceEvents": [
    {
      "name": "request",
      "cat": "api",
      "ph": "X",
      "ts": 1234567.89,
      "dur": 45000,
      "pid": 1,
      "tid": 42351,
      "args": { "method": "GET", "path": "/api/agents", "traceId": "..." }
    }
  ]
}
```

OTLP endpoint returns OpenTelemetry-compliant JSON matching `opentelemetry-proto/trace/v1/trace.proto`:

```json
{
  "resourceSpans": [{
    "resource": {
      "attributes": [
        { "key": "service.name", "value": { "stringValue": "opensyber-api" } }
      ]
    },
    "scopeSpans": [{
      "scope": { "name": "@opensyber/api", "version": "1.0.0" },
      "spans": [{
        "traceId": "550e8400e29b41d4a716446655440000",
        "spanId": "a1b2c3d4e5f60718",
        "name": "request",
        "kind": 1,
        "startTimeUnixNano": "1712582400000000000",
        "endTimeUnixNano": "1712582400045000000",
        "attributes": [
          { "key": "category", "value": { "stringValue": "api" } },
          { "key": "method",   "value": { "stringValue": "GET" } },
          { "key": "path",     "value": { "stringValue": "/api/agents" } }
        ],
        "status": { "code": 0 }
      }]
    }]
  }]
}
```

The OTLP payload can be POSTed directly to any OpenTelemetry collector at `/v1/traces` for long-term storage and cross-service correlation.

### Viewing in Perfetto

1. Make the API request and capture the `X-Trace-Id` header:
   ```bash
   curl -i https://api.opensyber.cloud/api/agents \
     -H "Authorization: Bearer $TOKEN"
   # Look for: X-Trace-Id: 550e8400-e29b-...
   ```

2. Fetch the trace JSON:
   ```bash
   curl https://api.opensyber.cloud/api/admin/traces/550e8400-e29b-... \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -o trace.json
   ```

3. Open [https://ui.perfetto.dev](https://ui.perfetto.dev) and drag in `trace.json`.

### Forwarding to an OTel Collector

```bash
# Fetch in OTLP format
curl https://api.opensyber.cloud/api/admin/traces/550e8400-e29b-.../otel \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -o trace-otel.json

# Forward to an OTel collector (Jaeger, Tempo, Honeycomb, etc.)
curl -X POST http://otel-collector:4318/v1/traces \
  -H "Content-Type: application/json" \
  --data @trace-otel.json
```

### Limitations

- Traces expire after **1 hour** (KV TTL).
- Trace IDs must be valid UUIDs (server-side validation).
- Storage is non-blocking (`waitUntil`), so trace writes never slow down responses.
- Only admins can retrieve traces.

---

## 4. Flaky Test Detection

**Location:** `.github/workflows/flaky-detection.yml`
**Trigger:** Nightly at 3 AM UTC, or manual dispatch

Runs each test suite multiple times in a matrix to detect intermittent failures. If a package passes 4 out of 5 runs, it has a flaky test.

### Packages Tested

| Package | Workspace Filter |
|---|---|
| API | `@opensyber/api` |
| Database | `@opensyber/db` |
| Shared Types | `@opensyber/shared` |
| Claw SDK | `@opensyber/claw-sdk` |
| TokenForge SDK | `@opensyber/tokenforge` |

### Manual Trigger

Go to **Actions > Flaky Test Detection > Run workflow** in GitHub. You can set the iteration count (default: 5).

Or via CLI:

```bash
gh workflow run flaky-detection.yml \
  --field iterations=10
```

### Reading Results

Each package in the matrix produces a step summary with:

- **Iterations**: How many times the suite ran
- **Failures**: How many runs failed
- **Status**: `All runs passed` or `FLAKY -- investigate failures`

Failures are annotated with `::warning::` and `::error::` markers in the GitHub Actions log, so you can expand each run group to see which specific test failed.

The workflow uses `fail-fast: false`, meaning all packages run to completion even if one fails early.

### Configuration

| Setting | Value | How to Change |
|---|---|---|
| Default iterations | 5 | `inputs.iterations.default` in the workflow file |
| Schedule | 3 AM UTC daily | `cron` expression in `on.schedule` |
| Timeout | 30 minutes | `timeout-minutes` on the job |
| Node version | 22 | `setup-node` step |

---

## 5. Tailscale Mesh VPN

**Location:** `apps/agent/src/services/tailscale.ts`
**Dependency:** [Tailscale](https://tailscale.com/) CLI installed on the agent host

Provides encrypted agent-to-platform communication over a WireGuard mesh network. Agents join a Tailscale tailnet on startup, removing the need for public internet exposure.

### Setup Requirements

1. **Tailscale installed** on the agent host (the service checks with `tailscale version`).
2. **Auth key** set as `TAILSCALE_AUTHKEY` environment variable. Generate one from the Tailscale admin console under **Settings > Keys > Auth keys**. Use a reusable, ephemeral key for agents.
3. **Tailnet name** configured in agent config.

### How It Works

```typescript
import {
  connectTailscale,
  resolveApiUrl,
  isTailscaleInstalled,
} from './services/tailscale.js';

// Check if Tailscale is available
if (await isTailscaleInstalled()) {
  const status = await connectTailscale({
    authKey: process.env.TAILSCALE_AUTHKEY!,
    tailnet: 'opensyber.tail1234.ts.net',
    instanceId: 'abc123',
    apiBaseUrl: 'https://api.opensyber.cloud',
  });

  // Resolve the best API URL (Tailscale MagicDNS or public fallback)
  const apiUrl = resolveApiUrl(
    'https://api.opensyber.cloud',
    status,
    'api.opensyber.tail1234.ts.net',
  );
}
```

### MagicDNS Hostnames

Each agent registers with a stable hostname: `agent-{instanceId}`. After connecting, the agent is reachable at:

```
agent-abc123.opensyber.tail1234.ts.net
```

This hostname resolves via Tailscale MagicDNS only within the tailnet.

### Graceful Degradation

If Tailscale is not installed or connection fails, the service logs a warning and returns `{ connected: false }`. The `resolveApiUrl` function falls back to the public API URL automatically. No code changes are needed -- the agent works the same way over the public internet, just without the mesh encryption layer.

### ACL Considerations

Configure Tailscale ACLs to restrict agent-to-platform communication:

```json
{
  "acls": [
    {
      "action": "accept",
      "src": ["tag:agent"],
      "dst": ["tag:api:443"]
    }
  ],
  "tagOwners": {
    "tag:agent": ["autogroup:admin"],
    "tag:api": ["autogroup:admin"]
  }
}
```

Tag agents with `tag:agent` in the auth key configuration. This ensures agents can only reach the API server, not each other.

### TailscaleStatus Interface

```typescript
interface TailscaleStatus {
  connected: boolean;    // true if BackendState === 'Running'
  hostname: string;      // e.g. 'agent-abc123'
  tailnetIp: string | null;  // e.g. '100.64.0.12'
  magicDns: string | null;   // e.g. 'agent-abc123.tail1234.ts.net'
}
```

---

## 6. llamafile Offline AI

**Location:** `apps/agent/src/services/llamafile.ts`
**Dependency:** [llamafile](https://github.com/Mozilla-Ocho/llamafile) running locally

Provides offline LLM inference when the Claw Gateway is unreachable (air-gapped environments, network outages). llamafile bundles a model as a single executable that exposes an OpenAI-compatible API at `http://127.0.0.1:8080`.

### Running llamafile

1. Download a llamafile binary (e.g., Mistral 7B):
   ```bash
   curl -LO https://huggingface.co/Mozilla/Mistral-7B-Instruct-v0.2-llamafile/resolve/main/mistral-7b-instruct-v0.2.Q4_0.llamafile
   chmod +x mistral-7b-instruct-v0.2.Q4_0.llamafile
   ```

2. Start the server:
   ```bash
   ./mistral-7b-instruct-v0.2.Q4_0.llamafile --server --port 8080
   ```

3. The agent detects it automatically:
   ```typescript
   import { isLlamafileAvailable, llamafileComplete, localTriage } from './services/llamafile.js';

   if (await isLlamafileAvailable()) {
     const response = await llamafileComplete('Analyze this CVE...');
     console.log(response.text);
   }
   ```

### Endpoint Configuration

```typescript
interface LlamafileConfig {
  endpoint?: string;   // Default: 'http://127.0.0.1:8080'
  timeoutMs?: number;  // Default: 30000 (30 seconds)
}

// Custom endpoint
const response = await llamafileComplete('query', {
  endpoint: 'http://127.0.0.1:9090',
  timeoutMs: 60_000,
});
```

### SSRF Protection

The client validates that the endpoint hostname is one of `127.0.0.1`, `localhost`, or `::1`. Any other hostname throws an error immediately. This prevents the agent from being tricked into making requests to external servers.

```typescript
// This works
await llamafileComplete('test', { endpoint: 'http://127.0.0.1:8080' });

// This throws: "llamafile endpoint must be localhost"
await llamafileComplete('test', { endpoint: 'http://evil.com:8080' });
```

### Offline Triage

The `localTriage` function provides a structured security triage when the gateway is down:

```typescript
import { localTriage } from './services/llamafile.js';

const result = await localTriage({
  title: 'Exposed SSH key in container',
  description: 'Private SSH key found at /home/app/.ssh/id_rsa',
  severity: 'high',
});

// result.assessment — free-text analysis from the local model
// result.suggestedPriority — extracted 'P0' through 'P4' (defaults to 'P2')
```

### Claw SDK Integration

The Claw SDK supports a `local` provider alias that routes to llamafile. Configure it in the `ClawClient`:

```typescript
const claw = new ClawClient({
  projectId: 'opensyber',
  apiKey: process.env.CLAW_API_KEY!,
  endpoint: 'http://127.0.0.1:8080',
});

const response = await claw.prompt('Triage this finding...', {
  provider: 'local',
});
```

### Response Shape

```typescript
interface LlamafileResponse {
  text: string;       // Model output
  model: string;      // Model identifier from the server
  tokensUsed: number; // Total tokens consumed
}
```

---

## 7. Multi-Model Consensus

**Location:** `apps/api/src/services/ai/multi-model-consensus.ts`

Runs a security finding through 3 AI models in parallel and uses weighted majority vote to determine severity and priority. Reduces false positives by approximately 40% compared to single-model assessment (ensemble research baseline).

### How It Works

1. The same triage prompt is sent to 3 models simultaneously (`haiku`, `gpt-4o-mini`, `llama-70b` by default).
2. Each model returns a JSON vote: severity, priority, confidence (0-1), and reasoning.
3. Votes are aggregated using confidence-weighted majority vote.
4. The winning severity is the one with the highest total confidence weight.
5. Priority is determined by simple majority among the winning-severity voters.

### Usage

```typescript
import { consensusTriage } from '../services/ai/multi-model-consensus.js';

const result = await consensusTriage(
  {
    title: 'Exposed SSH key in container',
    description: 'Private SSH key found at /home/app/.ssh/id_rsa',
    severity: 'high',
    category: 'credential-exposure',
  },
  aiCaller,  // { call: (model, prompt) => Promise<string> }
);
```

### ConsensusResult Shape

```typescript
interface ConsensusResult {
  severity: string;     // Winning severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  priority: string;     // Winning priority: 'P0' | 'P1' | 'P2' | 'P3' | 'P4'
  confidence: number;   // Average confidence of agreeing voters (0-1)
  votes: ModelVote[];   // Individual model votes for transparency
  agreement: number;    // Fraction of models that agreed (e.g. 0.67 = 2/3)
}

interface ModelVote {
  model: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  priority: string;
  confidence: number;
  reasoning: string;
}
```

### Confidence Weighting

Votes are not equal. Each model's vote is weighted by its self-reported confidence. If Haiku says `critical` with 0.9 confidence and the other two say `high` with 0.4 confidence each, `critical` wins (0.9 > 0.8).

### Fallback Behavior

- If a model call fails (network error, timeout, malformed response), it is excluded from voting. `Promise.allSettled` ensures one failure does not block the others.
- If a model returns invalid JSON, it is assigned `severity: 'medium'`, `priority: 'P2'`, `confidence: 0.3` (low-confidence default).
- If **all** models fail, the function returns the finding's original severity with `confidence: 0` and `agreement: 0`, letting the caller know no consensus was reached.

### Custom Model Set

```typescript
// Use different models
const result = await consensusTriage(finding, aiCaller, [
  'sonnet',
  'gpt-4o',
  'llama-70b',
]);

// Use only 2 models (faster, less robust)
const result = await consensusTriage(finding, aiCaller, [
  'haiku',
  'gpt-4o-mini',
]);
```

### AiCaller Interface

The `consensusTriage` function takes an `AiCaller` with a single method. This decouples it from the Claw SDK, making it testable with stubs:

```typescript
interface AiCaller {
  call: (model: string, prompt: string) => Promise<string>;
}

// Production: wrap Claw SDK
const aiCaller: AiCaller = {
  call: async (model, prompt) => {
    const res = await claw.prompt(prompt, { model });
    return res.text;
  },
};

// Test: deterministic stub
const stubCaller: AiCaller = {
  call: async () => JSON.stringify({
    severity: 'high',
    priority: 'P1',
    confidence: 0.85,
    reasoning: 'Test stub',
  }),
};
```

---

## 8. 3D Attack Graph

**Location:** `apps/web/src/components/dashboard/attack-graph/AttackGraph3D.tsx`
**Dependencies:** React, Lucide icons (no Three.js)

Renders attack paths as a 3D force-directed graph using Canvas 2D with perspective projection. This is a lightweight alternative to Three.js that works in SSR-friendly Next.js without heavy 3D dependencies.

### Usage

```tsx
import { AttackGraph3D } from '@/components/dashboard/attack-graph/AttackGraph3D';
import type { GraphNode, GraphEdge } from '@/components/dashboard/attack-graph/AttackGraph3D';

const nodes: GraphNode[] = [
  { id: '1', label: 'Public API', type: 'entry' },
  { id: '2', label: 'CVE-2024-3094', type: 'vulnerability', severity: 'critical' },
  { id: '3', label: 'Database', type: 'crown-jewel' },
  { id: '4', label: 'App Server', type: 'asset' },
];

const edges: GraphEdge[] = [
  { source: '1', target: '2', weight: 0.9 },
  { source: '2', target: '4', weight: 0.7 },
  { source: '4', target: '3', weight: 0.5, label: 'SQL injection' },
];

<AttackGraph3D nodes={nodes} edges={edges} width={800} height={500} />
```

### Props

```typescript
interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
  width?: number;   // Canvas width in pixels (default: 600)
  height?: number;  // Canvas height in pixels (default: 400)
}
```

### GraphNode

```typescript
interface GraphNode {
  id: string;
  label: string;
  type: 'asset' | 'vulnerability' | 'entry' | 'crown-jewel';
  severity?: 'critical' | 'high' | 'medium' | 'low';
  x?: number;  // Initial 3D position (random if omitted)
  y?: number;
  z?: number;
}
```

### GraphEdge

```typescript
interface GraphEdge {
  source: string;  // Node ID
  target: string;  // Node ID
  weight: number;  // 0-1, affects edge opacity
  label?: string;  // Not rendered, available for tooltips
}
```

### Node Types and Colors

| Type | Color | Meaning |
|---|---|---|
| `entry` | `#3B82F6` (blue) | Network entry point |
| `vulnerability` | `#F59E0B` (amber) | Known vulnerability |
| `crown-jewel` | `#EF4444` (red) | High-value target asset |
| `asset` | `#6B7280` (gray) | Standard infrastructure asset |

### Severity Glow

Nodes with a `severity` field get a colored glow effect:

| Severity | Glow Color |
|---|---|
| `critical` | `#EF4444` (red) |
| `high` | `#F97316` (orange) |
| `medium` | `#EAB308` (yellow) |
| `low` | `#22C55E` (green) |

### Controls

The component includes built-in controls in the bottom-right corner:

- **Zoom In** — Increases focal length (max 2x)
- **Zoom Out** — Decreases focal length (min 0.3x)
- **Reset Rotation** — Snaps rotation back to 0

The graph auto-rotates continuously at a slow rate (0.003 radians per frame).

### Performance Considerations

- The graph renders on every animation frame via `requestAnimationFrame`. For large graphs (100+ nodes), consider reducing the frame rate or implementing culling for off-screen nodes.
- Edge rendering does O(edges) lookups per frame to find source/target nodes. For graphs with many edges, pre-compute a node-ID-to-position map.
- Labels are only rendered when a node's projected scale exceeds 0.7, which naturally hides labels on nodes that are far away in the Z-axis.
- The canvas uses a dark background (`#0A0A0A`) and matches the platform design system.
- Cleanup is handled by `cancelAnimationFrame` on unmount.

---

## Further Reading

- [AI-GUIDANCE.md](AI-GUIDANCE.md) — Claw SDK, gateway, AI skill development
- [API.md](API.md) — API reference, auth, endpoints
- [ARCHITECTURE.md](ARCHITECTURE.md) — System architecture, infrastructure
