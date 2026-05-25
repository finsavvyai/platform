# Observability — FinsavvyAI Platform

Owner: OBSERVABILITY agent (`infrastructure/observability/`).
Package: `@finsavvyai/observability-adapters` (workspace).
Status: production-shipped sinks + exporters; coverage 100/98.76/93.93.

## Scope

This package provides concrete sinks and exporters that plug into the
abstract interfaces exposed by `@finsavvyai/telemetry`:

| Telemetry interface                  | Adapter here                                  |
| ------------------------------------ | --------------------------------------------- |
| `AuditSink` (audit-log.ts)           | `createStdoutSink`, `createR2Sink`, `createDatadogSink` |
| `EventSink` (analytics/events.ts)    | same sinks — they accept any JSON-serialisable record |
| `AuditEmitter` (port)                | consumed by `startTokenCounterFlush`          |
| Health endpoint contract (round-3 §1) | `createHealthRunner`                          |

No telemetry source is modified. All wiring is via constructor injection.

## What gets logged

| Channel        | Shape                                                                                            | Producer                                 |
| -------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| Audit log      | `{ ts, actor_id, event, resource, decision, reason, meta? }` (round-1 swarm convention)          | `@finsavvyai/telemetry` `AuditEmitter`   |
| Analytics      | `{ id, ts, name, value, attributes }`                                                            | `@finsavvyai/telemetry` `AnalyticsIngestor` |
| Token usage    | Audit-shaped record: `event="token_usage"`, `decision="metered"`, `resource=<tenantId>`, snapshot in `meta` | `startTokenCounterFlush` (this package)  |
| Health checks  | `{ status, version, uptime_s, checks: [{name, status}] }` (round-3 §1)                          | `createHealthRunner` (this package)      |

## Configuration

Single source of truth for sink selection is the env contract from round-3 §2:

| Env var                       | Values                            | Default  | Notes                                                          |
| ----------------------------- | --------------------------------- | -------- | -------------------------------------------------------------- |
| `FINSAVVY_AUDIT_SINK`         | `stdout` \| `r2` \| `datadog`     | `stdout` | Case-insensitive.                                              |
| `FINSAVVY_AUDIT_R2_BUCKET`    | string                            | —        | Required when sink=r2. Documents the R2 binding name.          |
| `FINSAVVY_AUDIT_DD_API_KEY`   | string                            | —        | Required when sink=datadog.                                    |
| `FINSAVVY_AUDIT_DD_SITE`      | `us` \| `us3` \| `us5` \| `eu` \| `ap1` | `us`     | Datadog regional intake host.                                  |

R2 binding object is injected at call-site (Cloudflare Worker binding); the
factory takes it via `options.r2Bucket`.

### Programmatic example

```ts
import { createSinkFromEnv } from "@finsavvyai/observability-adapters";
import { createAuditEmitter } from "@finsavvyai/telemetry";

// In a Cloudflare Worker:
const { sink, flush } = createSinkFromEnv({
  env: env as Record<string, string | undefined>,
  r2Bucket: env.AUDIT_BUCKET, // R2 binding
});

const emitter = createAuditEmitter({ sink });
emitter.emit({ actorId: "user_1", event: "login", resource: "auth/session", decision: "allow" });

// On `scheduled` event or before `waitUntil` resolves:
await flush?.();
```

### Token-counter periodic flush

```ts
import { startTokenCounterFlush } from "@finsavvyai/observability-adapters";
import { TokenCounter } from "@finsavvyai/ai-gateway";

const counter = new TokenCounter();
const handle = startTokenCounterFlush({
  counter,
  emitter,                  // any AuditEmitter-shaped object
  tenantId: "tenant_acme",
  intervalMs: 60_000,
  resetOnFlush: false,
});

// On shutdown:
handle.stop();              // emits one final snapshot, then cancels timer.
```

### Health-check helper

```ts
import { createHealthRunner } from "@finsavvyai/observability-adapters";

const run = createHealthRunner({ version: "1.4.2", timeoutMs: 2_000 });

export default {
  async fetch(req: Request): Promise<Response> {
    if (new URL(req.url).pathname === "/health") {
      const report = await run([
        { name: "kv", check: async () => (await env.KV.get("ping")) ? "ok" : "degraded" },
        { name: "stripe", check: async () => "ok" },
      ]);
      const code = report.status === "ok" ? 200 : report.status === "degraded" ? 200 : 503;
      return new Response(JSON.stringify(report), {
        status: code,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("not found", { status: 404 });
  },
};
```

Status aggregation rules (binding):

- any check `down` → overall `down`
- else any check `degraded` → overall `degraded`
- else → `ok`
- per-check timeout → counted as `down`
- per-check exception → counted as `down`

## Where data lands

| Sink     | Destination                                                                                 |
| -------- | ------------------------------------------------------------------------------------------- |
| stdout   | `process.stdout` (Node) or `console.log` (Workers). One JSON-line per record.               |
| r2       | R2 bucket pointed at by `FINSAVVY_AUDIT_R2_BUCKET`. Key pattern `audit/YYYY/MM/DD/HH/<uuid>.jsonl.gz` |
| datadog  | `https://http-intake.logs.<site>.datadoghq.{com,eu}/api/v2/logs`. `service=finsavvyai`, `ddsource=finsavvyai-audit`. |

Set the actual R2 bucket name in `wrangler.toml` (owned by WRANGLER) and
expose it as a binding the Worker reads.

## PII / redaction guarantees

- Redaction is **upstream** of these sinks. `@finsavvyai/telemetry`'s
  `AuditEmitter` and `AnalyticsIngestor` run `redact()` over every record
  using `DEFAULT_REDACT_KEYS` before the sink ever sees the data.
- Sinks here treat records as opaque JSON. They do not log, store, or
  transmit anything that is not already redacted.
- Adapter never logs the bytes of API keys, R2 binding internals, or
  fallback failures' inner exceptions beyond a generic message.
- All sinks honour the round-1 contract: **they never throw**. On any
  failure they degrade to the fallback sink (stdout by default).

## Query examples

### Datadog

Search all audit events for a deny decision in the last 15 min:

```
service:finsavvyai source:finsavvyai-audit @decision:deny
```

Top 10 actors by audit volume:

```
service:finsavvyai source:finsavvyai-audit | top @actor_id 10
```

### R2 + DuckDB (local) or Athena (AWS)

Files are gzip-compressed JSONL, partitioned by hour. Example DuckDB:

```sql
INSTALL httpfs;
LOAD httpfs;
SET s3_endpoint = '<account>.r2.cloudflarestorage.com';
SET s3_access_key_id = '...';
SET s3_secret_access_key = '...';

SELECT decision, count(*) AS n
FROM read_json_auto('s3://finsavvy-audit/audit/2026/05/25/*/*.jsonl.gz')
GROUP BY 1
ORDER BY n DESC;
```

Replace `finsavvy-audit` with the bucket name configured via
`FINSAVVY_AUDIT_R2_BUCKET`.

### Token usage breakdown (any sink)

```
event:token_usage | stats sum(meta.inputTokens), sum(meta.outputTokens) by resource
```

## Retention policy (placeholder — confirm with compliance)

| Stream              | Default retention | Where enforced                                |
| ------------------- | ----------------- | --------------------------------------------- |
| Audit logs (R2)     | 90 days           | R2 lifecycle rule on bucket (WRANGLER owns)   |
| Audit logs (Datadog)| 30 days (hot), then archive | Datadog index settings (ops sets)            |
| Analytics events    | 30 days           | Same — analytics writes to same sinks         |
| Token-usage records | Same as audit     | Treated as audit records.                     |

Authoritative retention will be revisited during the SOC2 / compliance
work. Configure R2 bucket lifecycle in the WRANGLER subtree.

## Operational notes

- **Flush on shutdown.** R2 and Datadog sinks buffer in memory. Call
  `flush()` from your `waitUntil()` (Workers) or shutdown hook (Node).
- **Failure mode.** Any sink failure falls through to stdout. If stdout
  also fails (extremely unlikely), the record is silently dropped — the
  audit-log contract says we must never throw, never break the request.
- **Cardinality.** Datadog tags `event` and `decision`. Keep the set of
  distinct `event` values bounded (the codebase uses stable codes).
- **Health endpoint.** Returns `200` for `ok`/`degraded`, `503` for
  `down`. ALERTING agent fires on `down`; SYNTHETICS pings the endpoint.

## Cross-agent contracts honoured

- §1 Health shape: `{ status, version, uptime_s, checks: [{name, status}] }`.
- §2 Audit env vars: `FINSAVVY_AUDIT_SINK` / `FINSAVVY_AUDIT_R2_BUCKET` /
  `FINSAVVY_AUDIT_DD_API_KEY` (+ `FINSAVVY_AUDIT_DD_SITE`).
- Audit record shape: `{ ts, actor_id, event, resource, decision, reason }`.
- Sinks NEVER throw (round-1 audit-log convention).
