# @finsavvyai/telemetry

Telemetry primitives for the FinsavvyAI platform.

## Modules

### Tracing / AI logs (root export)

- `InMemoryTracer`, `withSpan`, `withSpanAsync` — span lifecycle.
- `InMemoryAiLogger` — AI execution events (cost, latency, tokens, cache hits).
- `AuditEmitter` / `createAuditEmitter` — structured audit log per swarm
  convention `{ ts, actor_id, event, resource, decision, reason }`. Sink
  errors route to a fallback sink. Never throws.
- `redact` — walks objects, masks keys (`password`, `token`, `api_key`, ...)
  and scrubs token-shaped substrings (OpenAI, Anthropic, Slack, AWS, GitHub,
  JWT) inside string values.

### `analytics` namespace (`import { analytics } from "@finsavvyai/telemetry"`)

Financial analytics + reporting. Deliberately separate from raw OTel traces.

- `analytics.AnalyticsIngestor` / `createAnalyticsIngestor` — typed event
  ingestion with sink + fallback. Every event passes through `redact()`
  before persistence (critical path). Rejects `NaN` / `Infinity` values
  and empty names. Never throws.
- `analytics.aggregate`, `sum`, `count`, `avg`, `min`, `max`, `percentile`
  — pure aggregation. Linear-interpolation percentile (NIST type 7).
- `analytics.report`, `analytics.filterEvents` — deterministic query over
  an in-memory event slice (time range + optional name + attribute filters).
- `analytics.runAuditedReport` — emits an audit record for admin queries
  via an injected `AuditEmitterPort` (no internal cross-import).
- `analytics.applyRetention`, `evictByAge`, `evictBySize` — eviction
  policy by age + size for retained event slices.

#### Conventions

- Monetary values are integer minor units (e.g. cents). No floating-point
  money. Floats only for ratios / dimensionless metrics.
- All aggregator + reporter + retention functions are pure (no I/O).
- The analytics module does not depend on `audit-log`; if a caller wants
  audited reads, they inject an `AuditEmitterPort`.

## Coverage

100 % on root round-1 modules (`tracer`, `ai-logger`, `audit-log`, `redact`)
and on `analytics/aggregator`, `analytics/reporter`, `analytics/retention`,
`analytics/types`. `analytics/events` at 97 % (uncovered = defensive
catch-bodies in the default fallback paths).

## Migration notes

The Go service at `portfolio/fintech-suite/fintech-enterprise-platform/services/analytics`
was mostly mock data (`rand.Intn`). Migration kept only the real primitives:
event schema, aggregation math, percentile, time-range filtering, retention.
Cohort engine + segmentation service are deferred — they belong with the
AMLIQ product domain, not in the platform telemetry package.
