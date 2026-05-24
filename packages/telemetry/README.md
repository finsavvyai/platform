# @finsavvyai/telemetry

Telemetry primitives. OpenTelemetry traces, replay, AI execution logs.

Exports `InMemoryTracer`, `InMemoryAiLogger`, types: `Span`, `AiExecutionEvent`, `Tracer`, `AiExecutionLogger`.

## Notes

- Redact PII before persistence (set `redacted: true`).
- AI exec logs feed cost dashboards + replay tooling.
