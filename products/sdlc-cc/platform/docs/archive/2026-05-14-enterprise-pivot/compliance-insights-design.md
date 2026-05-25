# Compliance Insights — Technical Design

**Status**: Draft v1
**Owner**: Platform
**Date**: 2026-04-19
**Depends on**: `services/gateway`, `services/llm-gateway`, `services/dlp`, `services/opa`, `services/rag`, `services/admin-ui`, `services/realtime`

## 1. Purpose

Ship an enterprise **Compliance Insights** SKU on top of the existing SDLC Platform. It unifies AI-governance signals (LLM traffic, DLP hits, OPA denials, RAG events, tenant usage), detects patterns, scores impact against compliance frameworks, and drives agentic remediation through external systems (Jira, Notion, Slack, OPA rule PRs, SIEM).

The scoring and execution primitives are extracted into a shared library `packages/insights-core` so `qestro`, `push-ci.dev`, and `aegis` can re-import the same engine with domain-specific adapters.

## 2. Goals / Non-goals

**Goals**
- Near-real-time insight feed (<60 s median event → surfaced insight) per tenant.
- Configurable impact scoring with tenant-override weights.
- Plug-in exec adapters with dry-run mode and audit trail.
- Zero-trust: tenant-scoped RLS, no cross-tenant signal leakage, OPA-gated admin actions.
- ≤200 lines per source file; Apple HIG admin UI.

**Non-goals (v1)**
- Full SIEM replacement.
- Automated regulator filing (templates only).
- Model-level fine-tuning of pattern detectors per tenant.

## 3. Component Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              Sources (existing)                           │
│  llm-gateway logs │ dlp hits │ opa denials │ rag events │ usage meters  │
└──────────┬───────────────┬─────────────┬───────────────┬────────────────┘
           │               │             │               │
           ▼               ▼             ▼               ▼
   ┌──────────────────────────────────────────────────────────────┐
   │  insights-collector (NEW, Go worker, Chi-less)               │
   │  • Subscribes to NATS/Redis streams per source               │
   │  • Normalises → SignalEvent{tenant_id,type,payload,hash}     │
   │  • Writes append-only to signals table (RLS)                 │
   └───────────────┬──────────────────────────────────────────────┘
                   │ pg LISTEN/NOTIFY
                   ▼
   ┌──────────────────────────────────────────────────────────────┐
   │  insights-detector (NEW, Python FastAPI worker, shares venv  │
   │  with services/rag — pgvector + sentence-transformers)       │
   │  • Rule engine (YAML rules, OPA-style match)                 │
   │  • Embedding clusterer (HDBSCAN over 384-dim MiniLM)         │
   │  • Entity graph (tenant, user, model, doc, policy) in pg     │
   │  • Emits Insight{cluster_id, pattern, evidence[], raw_score} │
   └───────────────┬──────────────────────────────────────────────┘
                   ▼
   ┌──────────────────────────────────────────────────────────────┐
   │  packages/insights-core (NEW shared lib; Go + TS impls)       │
   │  • Scorer: weighted(soC2, hipaa, gdpr, cost, blastRadius)     │
   │  • ExecRouter: adapter registry (Jira/Notion/Slack/OPA/SIEM) │
   │  • Redaction helpers, signed audit events                    │
   └───────────────┬──────────────────────────────────────────────┘
                   ▼
   ┌──────────────────────────────────────────────────────────────┐
   │  insights-api (NEW, extends services/gateway — Chi subrouter)│
   │  GET /v1/insights  ·  POST /v1/insights/{id}/act             │
   │  WS /v1/insights/stream (via services/realtime)              │
   └───────────────┬──────────────────────────────────────────────┘
                   ▼
   ┌──────────────────────────────────────────────────────────────┐
   │  admin-ui → /insights                                         │
   │  Feed · Filter · Drill-down · One-click Act (with preview)   │
   └──────────────────────────────────────────────────────────────┘
```

### 3.1 New vs extend (recommendation)

| Capability | Placement | Why |
|---|---|---|
| Signal collection | **New service** `services/insights-collector` (Go) | High-fan-in, async, decouples from gateway latency budget. |
| Pattern detection | **New service** `services/insights-detector` (Python) | Shares ML deps with `services/rag`; CPU-heavy; scale independently. |
| Scoring + exec routing | **New lib** `packages/insights-core` | Portable primitive for qestro/push-ci/aegis. Go + TS bindings. |
| API surface | **Extend** `services/gateway` | Reuses auth, tenancy, rate limits, OpenAPI toolchain. |
| Real-time push | **Extend** `services/realtime` | Existing WebSocket broker. |
| UI | **Extend** `services/admin-ui` | New `/insights` route; reuse design tokens. |
| Exec adapters | **New package** `packages/integrations/insights-adapters` | Slots into existing `packages/integrations/` pattern. |

Rationale: two new services keep blast radius small and preserve the 200-line cap; everything user-facing reuses mature surfaces.

## 4. Data Model

Migration `007_compliance_insights.sql` (additive, non-breaking).

```sql
-- Append-only signal stream (retained 90 d hot, rolled to cold).
CREATE TABLE signals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  source        TEXT NOT NULL CHECK (source IN
                ('llm_gateway','dlp','opa','rag','usage')),
  event_type    TEXT NOT NULL,
  subject_user  UUID NULL,
  model         TEXT NULL,
  payload       JSONB NOT NULL,
  payload_hash  BYTEA NOT NULL,
  embedding     VECTOR(384) NULL,
  occurred_at   TIMESTAMPTZ NOT NULL,
  ingested_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON signals (tenant_id, occurred_at DESC);
CREATE INDEX ON signals USING ivfflat (embedding vector_cosine_ops);
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY signals_tenant_isolation ON signals
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- Detected insights (clusters of signals).
CREATE TABLE insights (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  pattern_id    TEXT NOT NULL,           -- e.g. 'prompt_injection.v1'
  severity      SMALLINT NOT NULL,       -- 1-5
  status        TEXT NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','acting','resolved','dismissed')),
  raw_score     NUMERIC(6,3) NOT NULL,
  impact_score  NUMERIC(6,3) NOT NULL,
  score_breakdown JSONB NOT NULL,        -- {soc2,hipaa,gdpr,cost,blast}
  evidence_ids  UUID[] NOT NULL,         -- FK → signals.id
  first_seen    TIMESTAMPTZ NOT NULL,
  last_seen     TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON insights (tenant_id, impact_score DESC) WHERE status='open';
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY insights_tenant_isolation ON insights
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- Per-tenant scoring weight overrides.
CREATE TABLE insight_scoring_weights (
  tenant_id   UUID PRIMARY KEY REFERENCES tenants(id),
  weights     JSONB NOT NULL,   -- {soc2:0.25,hipaa:0.25,gdpr:0.2,cost:0.15,blast:0.15}
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit trail for every exec action.
CREATE TABLE insight_actions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_id    UUID NOT NULL REFERENCES insights(id),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  adapter       TEXT NOT NULL,           -- jira|notion|slack|opa_pr|siem
  dry_run       BOOLEAN NOT NULL,
  request       JSONB NOT NULL,
  response      JSONB NULL,
  actor_user_id UUID NOT NULL,
  signature     BYTEA NOT NULL,          -- HMAC(tenant_key)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE insight_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY actions_tenant_isolation ON insight_actions
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- Entity graph (lightweight, pg only; no separate graph db).
CREATE TABLE insight_entities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  kind        TEXT NOT NULL,  -- user|model|doc|policy|api_key
  external_id TEXT NOT NULL,
  attrs       JSONB NOT NULL,
  UNIQUE (tenant_id, kind, external_id)
);
CREATE TABLE insight_edges (
  src UUID NOT NULL REFERENCES insight_entities(id),
  dst UUID NOT NULL REFERENCES insight_entities(id),
  rel TEXT NOT NULL,          -- used_by|denied_by|leaked_via|...
  weight NUMERIC(5,3) NOT NULL DEFAULT 1,
  PRIMARY KEY (src, dst, rel)
);
```

RLS policies mirror existing pattern from migration `005`. All writes occur through stored procs that `SET LOCAL app.tenant_id`.

## 5. API Surface (OpenAPI extension stub)

Added to `services/gateway/api/openapi-extensions.yaml`.

```yaml
paths:
  /v1/insights:
    get:
      summary: List insights (paginated, filterable)
      parameters:
        - name: status; in: query; schema: {enum: [open,acting,resolved,dismissed]}
        - name: min_impact; in: query; schema: {type: number}
        - name: pattern_id; in: query; schema: {type: string}
        - name: since; in: query; schema: {type: string, format: date-time}
        - name: cursor; in: query; schema: {type: string}
      responses: {'200': {$ref: '#/components/schemas/InsightPage'}}
  /v1/insights/{id}:
    get:
      responses: {'200': {$ref: '#/components/schemas/InsightDetail'}}
  /v1/insights/{id}/act:
    post:
      summary: Execute one or more adapters; dry-run by default
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [actions]
              properties:
                dry_run: {type: boolean, default: true}
                actions:
                  type: array
                  items:
                    type: object
                    required: [adapter, params]
                    properties:
                      adapter: {enum: [jira,linear,notion,slack,opa_pr,siem,email]}
                      params: {type: object}
      responses: {'202': {$ref: '#/components/schemas/ActionReceipt'}}
  /v1/insights/stream:
    get:
      summary: WebSocket stream of new/updated insights
  /v1/insights/scoring-weights:
    get:  {responses: {'200': {$ref: '#/components/schemas/ScoringWeights'}}}
    put:  {requestBody: {$ref: '#/components/schemas/ScoringWeights'}}
```

SDK bindings regenerate automatically via `services/gateway/scripts/generate-sdk.sh` into `packages/sdk-{go,py,ts}`.

## 6. Pattern Detection

### 6.1 Choice: rules + embedding cluster (hybrid)

| Approach | Strength | Weakness |
|---|---|---|
| Pure rules (regex/jsonschema) | Deterministic, auditable, cheap | Brittle to paraphrased prompt-injection, misses novel patterns |
| Pure ML clustering | Finds novel clusters | Opaque; hard to justify to auditors |
| **Hybrid (chosen)** | Rules fire for known-bad; clustering finds unknowns; clustered items post-labelled by rule scan | Requires two pipelines, more ops complexity |

### 6.2 Rule engine
- YAML rules under `services/insights-detector/rules/` (versioned, tenant-scopable).
- Schema `{id, when: {source, event_type, match}, severity, pattern_id}`.
- Evaluated on every `SignalEvent` via Rego-style matcher (re-use OPA data module).

### 6.3 Embedding clusterer
- Model: `sentence-transformers/all-MiniLM-L6-v2` (384 dim, already available in `services/rag`).
- Index: pgvector IVFFlat, one cosine index per tenant view.
- Clustering: HDBSCAN on rolling 24 h window per `(tenant, source)`; min_cluster_size=5.
- Cluster → Insight when size ≥ threshold or contains any rule-fired signal.
- Re-label step: scan cluster members against rules; if none match, mark `pattern_id = 'novel.<hash>'` for analyst triage.

### 6.4 Canonical patterns shipped v1
- `prompt_injection.v1` — jailbreak phrases + semantic cluster near known injections.
- `pii_leakage.v1` — DLP hit density > threshold per user/hour.
- `cost_outlier.v1` — per-model spend z-score > 3.
- `policy_drift.v1` — OPA deny-rate delta week-over-week.
- `ingestion_anomaly.v1` — RAG ingest size / source entropy spike.

## 7. Impact Scoring

### 7.1 Formula

```
impact = Σ w_i · norm(component_i)

components:
  soc2   = f_controls_violated(insight)                 // 0..1
  hipaa  = g_phi_touched(insight) * tenant.hipaa_enabled // 0..1
  gdpr   = h_eu_subject_touched(insight)                 // 0..1
  cost   = log10(1 + $exposure_usd) / 6                  // 0..1 (1 ≈ $1M)
  blast  = log10(1 + users_affected) / 5                 // 0..1 (1 ≈ 100k users)

defaults (tenant-overridable):
  w = {soc2:.25, hipaa:.25, gdpr:.20, cost:.15, blast:.15}
severity = ceil(impact * 5)  // 1..5 for UI bucket
```

### 7.2 Tenant override shape

```json
{
  "weights": {"soc2": 0.30, "hipaa": 0.30, "gdpr": 0.15, "cost": 0.10, "blast": 0.15},
  "framework_flags": {"hipaa_enabled": true, "pci_enabled": false},
  "thresholds": {"open_min_impact": 0.35, "alert_impact": 0.70}
}
```

Validated by JSON Schema; sum of weights must be 1.0 ± 0.001.

### 7.3 Implementation
- `packages/insights-core/go/scorer/scorer.go` — pure function, no I/O.
- `packages/insights-core/ts/src/scorer.ts` — mirror impl for UI dry-run preview.
- Golden tests assert Go and TS produce identical scores for the same inputs.

## 8. Exec Router — Adapter Contract

```go
// packages/insights-core/go/exec/adapter.go
type Adapter interface {
    Name() string
    Validate(params map[string]any) error
    DryRun(ctx Context, insight Insight, params map[string]any) (Preview, error)
    Execute(ctx Context, insight Insight, params map[string]any) (Receipt, error)
    Capabilities() Capabilities  // idempotent? requires_approval? cost?
}

type Receipt struct {
    AdapterName string
    ExternalID  string        // Jira key, Notion page id, PR url, etc.
    Signature   []byte        // HMAC of canonical request
    RawResponse []byte
    OccurredAt  time.Time
}
```

### 8.1 v1 adapters

| Adapter | Writes | Secrets | Dry-run preview |
|---|---|---|---|
| `jira` | issue in project | OAuth token per tenant | rendered issue JSON |
| `linear` | issue | OAuth token | rendered issue |
| `notion` | audit page in DB | integration token | markdown preview |
| `slack` | channel or DM | bot token | rendered block-kit JSON |
| `email` | SES/SendGrid | per-tenant | rendered MJML → HTML |
| `opa_pr` | PR to policy repo | GitHub App install | diff preview |
| `siem` | webhook JSON | per-tenant endpoint + HMAC | payload preview |

Adapters live in `packages/integrations/insights-adapters/<name>/`. Each ≤200 lines; no shared state.

### 8.2 Execution flow
1. UI or API calls `POST /v1/insights/{id}/act` with `dry_run=true` → receipt returned; nothing external mutates.
2. User confirms → same call with `dry_run=false`.
3. Router persists `insight_actions` row **before** external call (pending).
4. On success, updates row with `response` and `signature`; flips insight `status='acting'`.
5. Idempotency key = `hmac(insight_id, adapter, params_hash)`. Re-sends are no-ops.
6. Failures retry (exp. backoff, max 5) via NATS JetStream; surfaced in UI if exhausted.

## 9. Admin UI

Route: `services/admin-ui/app/insights/`.

### 9.1 Information architecture

```
/insights
  └─ Feed (default)           [left nav]
      • Filter bar: status, severity, pattern, time-range, source
      • Virtualised list: card per insight
         - title (pattern name), impact bar, severity dot
         - "last seen" relative time
         - inline actions: View · Act · Dismiss
  └─ /insights/{id}           [drill-down]
      • Score breakdown (radial chart; soc2/hipaa/gdpr/cost/blast)
      • Evidence table (raw signals with redaction masks)
      • Entity graph mini-map (react-flow, reused from studio)
      • Action panel — tabbed adapters, dry-run preview before confirm
      • Audit trail (insight_actions)
  └─ /insights/settings
      • Scoring weights editor (slider per component, live recompute on 10 sample insights)
      • Rule pack toggle (enable/disable canonical patterns)
      • Adapter credentials (delegates to existing integrations settings)
```

### 9.2 HIG conformance
- System font stack; 17 px body; 22 px H2; 28 px H1.
- 8 pt spacing grid; card radius 12; subtle depth via 1 × rgba(0,0,0,.06).
- Motion: fade + translate 8 px on item-enter; 150 ms cubic-bezier(.2,.8,.2,1).
- Colour: severity uses semantic tokens (blue→yellow→orange→red→purple); contrast ≥ WCAG AA.
- Focus ring always visible; keyboard-first action panel (J/K to move, A to act).

## 10. Phased Rollout

| Phase | Ships | Gate |
|---|---|---|
| **P0 — Foundations** (2 wk) | signals table + collector + basic pull-only detector (rules only); no UI beyond raw list | 1 internal tenant end-to-end |
| **P1 — MVP** (3 wk) | embedding clusterer, scoring engine (defaults), insights-api, admin-ui feed, Jira + Slack adapters, dry-run everywhere | 3 design-partner tenants |
| **P2 — Beta** (3 wk) | Notion, OPA-PR, SIEM, tenant weight overrides, graph drill-down, WS stream | 10 tenants; SLO: p95 event→insight ≤ 60 s |
| **P3 — GA** (3 wk) | cross-product packaging: `packages/insights-core` consumed by qestro; billing metering; audit export (CSV/JSONL); SOC2 evidence hooks | Pricing live; 99.5 % adapter success rate |
| **P4 — Expansion** | Linear, email, PagerDuty; tenant-trainable detectors; regulator report templates | — |

## 11. Cross-product Reuse

`packages/insights-core` ships two language impls (Go + TS) behind identical contracts:

- **qestro**: signal source = test run outcomes; patterns = flaky clusters; exec = Jira bug + Cursor fix-prompt.
- **push-ci.dev**: signal source = pipeline events; patterns = failure hotspots; exec = auto-PR via Channel Bridge.
- **aegis**: signal source = screening hits; patterns = FP clusters / typology drift; exec = SAR draft + case ticket.

Each project supplies its own `Source` collector and domain `Patterns`. Scorer + router stay identical — only weight defaults differ.

## 12. Security

- All writes flow through gateway auth → session carries `tenant_id` → `SET LOCAL app.tenant_id` → RLS enforces isolation.
- Adapter credentials stored in per-tenant vault (existing `packages/shared-config` secret store); never written to signal payloads.
- Signal payloads run through `services/dlp` **before** persistence; PII redacted in-place with reversible envelope encryption (key in tenant KMS, unwrap only on authorised drill-down).
- Insight actions require an `insights:act` scope; approval workflow for adapters with `requires_approval=true`.
- Audit rows signed with tenant-scoped HMAC; admin-ui verifies signatures on render.
- Rate limit: `/act` 30 req/min/tenant; clustering job per-tenant bounded to 1 concurrent run.

## 13. Observability

- Metrics (Prometheus): `insights_signals_total{source,tenant}`, `insights_detected_total{pattern}`, `insights_score_seconds`, `insights_action_total{adapter,outcome}`.
- Logs: structured JSON, `trace_id` propagated from gateway.
- Traces: OTel spans `collect → detect → score → route`.
- SLOs: p95 event→insight ≤ 60 s; adapter success ≥ 99.5 %; false-positive rate < 15 % on shipped canonical patterns (tuned via feedback).

## 14. Testing Strategy

- Unit: ≥90 % line, ≥85 % branch on scorer, router, rule matcher (100 % on scorer).
- Contract: adapter golden tests with recorded fixtures (VCR-style).
- Integration: Dockerised detector + postgres + 1 tenant; feed synthetic signals; assert expected insights.
- Property tests on scorer (Hypothesis/Go fuzz): score ∈ [0,1], monotone in each component.
- End-to-end: Playwright scenario — generate synthetic prompt-injection traffic → see insight in UI → dry-run Jira adapter → assert no external call → confirm → assert fixture API hit.
- Red-team suite: known prompt-injection corpus (OWASP LLM Top 10) must produce ≥ 95 % recall on `prompt_injection.v1`.

## 15. Risks & Open Questions

| Risk | Mitigation |
|---|---|
| HDBSCAN latency on high-volume tenants | Per-tenant sharding; downsample to reservoir when > 50 k signals/h. |
| False-positive fatigue | Tenant-tunable `open_min_impact`; "dismiss + learn" feedback loop persisted as negative examples. |
| Adapter credential blast radius | Scoped OAuth apps; least-privilege scopes documented per adapter; rotation every 90 d. |
| OPA-PR adapter writing bad policy | Hard requirement: `opa eval` passes in PR check before merge; never auto-merges. |
| Cross-product lib drift | Go/TS golden-test suite in CI; contract changes require major bump. |
| Regulator queries "why this score?" | Explainability: score breakdown persisted, rule hit chain stored per insight, one-click evidence export. |

**Open questions**
1. Run detector as single multi-tenant process or one-per-tenant (cost vs isolation)? Lean single-process with tenant sharding; revisit if a Tier-1 tenant demands dedicated.
2. Do we ship a managed OPA-PR GitHub App, or require tenant to bring their own? Lean managed App for v1 to minimise setup friction.
3. Where does billing meter live — insights created, actions executed, or signals ingested? Propose: signals ingested (matches infra cost driver) + flat SKU fee.
4. Retention: default 90 d hot / 1 y cold — confirm with design-partners; HIPAA customers may need 6 y.

## 16. Follow-ups

- `/luna-agents:plan` → break into phases with task IDs against this doc.
- Prototype `packages/insights-core/go/scorer` in parallel with P0.
- Schedule adapter security review before P2.
- Draft pricing page additions (`landing-page/`) once P2 SLOs proven.
