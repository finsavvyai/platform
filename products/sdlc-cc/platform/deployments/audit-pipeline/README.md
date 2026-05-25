# Audit Log Pipeline — Loki + Vector + R2

Append-only audit log pipeline for the SDLC Platform. Delivers on
the SOC2 CC7.x requirement for **7-year tamper-evident retention**
with fast operational lookup.

## Architecture

```
┌─────────────┐    stdout/file    ┌────────────┐    Loki push     ┌───────────┐
│  services   │ ────────────────▶ │   Vector   │ ───────────────▶ │   Loki    │  ← 90d hot
│ (@finsavvy  │                   │  (collect, │                  │ (LogQL)   │
│  /monitor)  │ ────────────────▶ │   parse,   │ ─── S3 PUT ────▶ ┌───────────┐
└─────────────┘   docker_logs     │   enrich)  │                  │   R2      │  ← 7y cold
                                  └────────────┘                  │ (gzip nd) │
                                                                  └───────────┘
                                                                        │
                                                                        ▼
                                                                  Admin UI
                                                               (queries Loki
                                                                via LogQL)
```

## Run the dev stack

```bash
cd deployments/audit-pipeline
docker compose up -d
# Loki      → http://localhost:3100
# Grafana   → http://localhost:3000 (anon admin)
# Vector    → tails ./volumes/audit-logs
```

Services write JSON events to `/var/log/sdlc/<service>/audit.log`
(mounted into the `audit-logs` volume). Vector picks them up,
parses, enriches, and ships to Loki + R2.

## Production deployment

Run Loki + Vector as separate Helm releases / Fly machines.

Required environment variables for Vector:

| Var                    | Description                                |
|------------------------|--------------------------------------------|
| `R2_ACCESS_KEY_ID`     | Cloudflare R2 access key                   |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 secret                       |
| `R2_ENDPOINT`          | `https://<acct>.r2.cloudflarestorage.com`  |
| `R2_BUCKET`            | Bucket name (default `sdlc-audit-logs`)    |
| `ENVIRONMENT`          | `production` / `staging`                   |

**Loki scaling** (prod):
- Run in simple-scalable mode (read / write / backend).
- Point `storage_config.aws` at a dedicated R2 bucket
  (`sdlc-loki-chunks`) — see commented block in `loki-config.yaml`.
- Enable `auth_enabled: true` and pass `X-Scope-OrgID: <tenant_id>`
  from the Admin UI's Loki proxy for tenant isolation.
- Retention: 90 days (set in `limits_config.retention_period`).

**R2 bucket lifecycle**:
- Object Lock: Compliance mode, 7 year retention.
- Lifecycle rule: transition to `INFREQUENT_ACCESS` after 90 days.
- Cross-region replication: EU + US for DR.

## LogQL query examples

```logql
# All audit events for a tenant in the last 24h
{tenant_id="t_abc123"} |= "audit"

# Failed logins for a specific user
{service="rag", event_type="AUTH_LOGIN"}
  | json
  | user_id = "u_42"
  | success = "false"

# DLP violations, grouped by tenant (last 7d)
sum by (tenant_id) (
  count_over_time({event_type="DLP_VIOLATION"}[7d])
)

# Admin actions (privileged) for compliance review
{event_type="ADMIN_ACTION"} | json | tenant_id =~ ".+"

# Document deletes for right-to-be-forgotten evidence
{event_type="DOCUMENT_DELETE"} | json | resource_id = "doc_xyz"
```

## Retention rationale (SOC2)

| Tier   | Store  | Duration | Purpose                                  |
|--------|--------|----------|------------------------------------------|
| Hot    | Loki   | 90 days  | Ops queries, incident response, SIEM     |
| Cold   | R2     | 7 years  | SOC2 CC7.2, HIPAA, GDPR evidence pulls   |

- **90d hot** covers >99% of operational queries (per industry norm).
- **7y cold** matches SOC2 Type II audit windows + HIPAA §164.316(b)(2)(i).
- R2 Object Lock (Compliance mode) guarantees **append-only,
  tamper-evident** — auditors can verify no event was modified.

## Incident response — pulling evidence

```bash
# 1. Fast path: query Loki for recent events
curl -G http://loki:3100/loki/api/v1/query_range \
  --data-urlencode 'query={tenant_id="t_abc"} |= "violation"' \
  --data-urlencode 'start=1712534400000000000'

# 2. Cold path: pull from R2 for old incidents (>90d)
aws s3 sync \
  s3://sdlc-audit-logs/audit/tenant=t_abc/date=2025-11-15/ \
  ./evidence/ \
  --endpoint-url $R2_ENDPOINT
```

See also `.luna/sdlc-platform/boost-project/wave-6-audit-setup.md`
for the full SOC2 incident response workflow.
