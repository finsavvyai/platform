# @finsavvyai/ai-gateway — migrations

## Status: intentionally empty for the gateway primitive

The AI gateway is **stateless by design**. Provider routing, retries, the
semantic cache, and token accounting all run in-process; there is no schema
this package needs to own.

When the edge layer is deployed on Cloudflare Workers and a KV namespace is
attached, the rate-limiter and response cache use KV — which is schemaless.
If a future feature requires durable state (e.g. usage ledgers, tenant
quotas), add a forward-only `0001_*.sql` here and document the read/write
boundary in the package README.

## Source-snapshot

The promoted source (`portfolio/fintech-suite/api-gateway/`) shipped 3 D1
migrations totalling 552 lines, but they describe the **PipeWarden** product
domain (`pipelines`, `pipeline_runs`, `security_scans`, `vulnerabilities`,
`alerts`, `audit_logs`, etc.). None of those tables belong in a generic AI
gateway primitive. They were intentionally **not** migrated.

If you need them for the PipeWarden product itself, copy them from:

```
portfolio/fintech-suite/api-gateway/migrations/
  ├── 0001_initial_schema.sql      (289 lines — users + pipelines + scans)
  ├── 0002_indexes.sql              (113 lines — query indexes)
  └── 0003_indexes_and_constraints.sql (150 lines)
```

into the appropriate product package (`products/pushci/` or `oss/pipewarden/`),
not here.
