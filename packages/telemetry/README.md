# @finsavvyai/telemetry

Telemetry primitives. OpenTelemetry traces, replay, AI execution logs.

Exports `InMemoryTracer`, `InMemoryAiLogger`, `InMemoryAuditLog`, `makeAuditEvent`, types: `Span`, `AiExecutionEvent`, `Tracer`, `AiExecutionLogger`, `AuditEvent`, `AuditLog`.

## Audit log

Canonical primitive for the platform's trust requirement (audit logs for auth events, admin actions, and sensitive mutations). Build events with `makeAuditEvent` and write them through an `AuditLog`:

```ts
import { InMemoryAuditLog, makeAuditEvent } from "@finsavvyai/telemetry";

const audit = new InMemoryAuditLog();
await audit.record(
  makeAuditEvent({
    actor: "user:1",
    action: "auth.token.issue",
    resource: "token:abc",
    outcome: "success",
    traceId: span.traceId, // optional correlation to a trace
  }),
);
audit.query({ actor: "user:1", outcome: "success" });
```

`record` is async (durable, tamper-evident storage in production). Other packages should declare their own minimal sink interface and have the application inject an `AuditLog`.

## Notes

- Redact PII before persistence (set `redacted: true`).
- AI exec logs feed cost dashboards + replay tooling.
