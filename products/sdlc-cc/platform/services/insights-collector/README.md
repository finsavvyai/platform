# insights-collector

Normalises signal events from llm-gateway, dlp, opa, rag, usage meters into
`signals` table. Part of Compliance Insights SKU.

See: `docs/compliance-insights-design.md` §3, `docs/adr/005-compliance-insights.md`.

## Run

```
NATS_URL=nats://localhost:4222 DATABASE_URL=postgres://... go run ./cmd/collector
```

## Test

```
go test ./...
```
