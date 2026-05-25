# Wave 6 — Append-Only Audit Pipeline (Loki + Vector + R2)

**Status**: Implementation ready
**Owner**: Platform / Security
**SOC2 control**: CC7.2 (System monitoring), CC6.1 (Logical access),
CC8.1 (Change management evidence)

## Why

SDLC Platform's enterprise customers need provable, tamper-evident
audit trails to pass their own SOC2 / HIPAA / GDPR audits. The bar
is not just "we log things" — it is:

1. **Append-only**: no operator can alter or delete events.
2. **Retained 7 years**: matches SOC2 Type II audit window.
3. **Queryable**: compliance teams can pull evidence in minutes.
4. **Tenant-isolated**: one customer's logs never visible to another.
5. **Cost-effective**: 7 years of logs at scale is expensive.

## Architecture

```
 ┌────────────────────┐
 │  SDLC Services     │  @finsavvyai/monitor + app/audit/
 │  (rag, gateway,    │  structured JSON, one line per event
 │   llm, dlp, etc.)  │
 └─────────┬──────────┘
           │ stdout + /var/log/sdlc/<svc>/audit.log
           ▼
 ┌────────────────────┐
 │   Vector.dev       │  parse → filter → enrich → fan-out
 │   (0.35.0)         │  no retries lost (disk buffer 512 MiB)
 └─────┬─────────┬────┘
       │         │
       ▼         ▼
 ┌─────────┐  ┌──────────────────┐
 │  Loki   │  │ Cloudflare R2    │
 │  2.9.0  │  │ Object Lock (7y) │
 │  90 d   │  │ gzipped ndjson   │
 └────┬────┘  └────────┬─────────┘
      │                │
      ▼                ▼
  Admin UI        Compliance /
  (LogQL)         Evidence pulls
```

Config lives in `deployments/audit-pipeline/`:
- `docker-compose.yml` — dev stack
- `loki-config.yaml` — filesystem (dev) or R2 (prod)
- `vector-config.toml` — pipeline definition
- `README.md` — operator runbook

## Event schema (v1.0)

Reference: `services/rag/app/audit/events.py`.

| Field           | Type     | Notes                                 |
|-----------------|----------|---------------------------------------|
| `id`            | string   | `evt_<24hex>`                         |
| `event_type`    | enum     | see `AuditEventType`                  |
| `timestamp`     | ISO-8601 | UTC, nanosecond precision in Loki     |
| `tenant_id`     | string   | Loki label (low cardinality)          |
| `user_id`       | string?  | JSON field (high cardinality)         |
| `resource_id`   | string?  | e.g. `doc_xyz`                        |
| `resource_type` | string?  | `document`, `policy`, `api_key`, ...  |
| `action`        | string?  | human verb: `create`, `delete`, ...   |
| `metadata`      | object   | free-form, bounded to 4 KiB           |
| `ip_address`    | string?  | remote IPv4/IPv6                      |
| `user_agent`    | string?  | truncated to 256 chars                |
| `success`       | bool     | Loki label                            |
| `error_message` | string?  | only when `success=false`             |
| `service`       | string   | `rag`, `gateway`, ...                 |
| `schema_version`| string   | `"1.0"`                               |

**Event types**: `AUTH_LOGIN`, `AUTH_LOGOUT`, `AUTH_FAILED`,
`DOCUMENT_UPLOAD`, `DOCUMENT_DELETE`, `DOCUMENT_ACCESS`,
`POLICY_CREATE`, `POLICY_UPDATE`, `POLICY_DELETE`, `LLM_QUERY`,
`DLP_VIOLATION`, `ADMIN_ACTION`, `API_KEY_CREATED`, `API_KEY_REVOKED`.

## Usage — Python services

```python
from app.audit import AuditEventType, audit_context, get_audit_logger

# Direct emission
get_audit_logger().log(
    AuditEventType.DOCUMENT_UPLOAD,
    tenant_id="t_abc",
    user_id="u_42",
    resource_id="doc_7b3",
    resource_type="document",
    metadata={"bytes": 102400, "pages": 12},
)

# Context-managed (auto success/failure)
with audit_context("t_abc", "u_42", "delete_document",
                   AuditEventType.DOCUMENT_DELETE,
                   resource_id="doc_7b3") as ctx:
    delete_document("doc_7b3")
    ctx["metadata"]["bytes_freed"] = 102400
```

## Usage — Admin UI viewer

The Admin UI queries Loki through a BFF proxy that injects the
current user's tenant as `X-Scope-OrgID`. This enforces tenant
isolation server-side — UI cannot bypass it.

```python
from app.audit import LokiAuditQuery
from datetime import datetime, timedelta, timezone

q = LokiAuditQuery(tenant_header="t_abc")
now = datetime.now(timezone.utc)
events = q.query_by_tenant(
    "t_abc",
    start=now - timedelta(days=7),
    end=now,
    event_types=[AuditEventType.DLP_VIOLATION],
)
```

## Example LogQL queries

```logql
# 1. Who uploaded this document?
{event_type="DOCUMENT_UPLOAD"} | json | resource_id="doc_7b3"

# 2. Failed logins (brute force detection)
sum by (user_id) (
  count_over_time({event_type="AUTH_FAILED"}[1h])
) > 5

# 3. Policy changes this quarter
{event_type=~"POLICY_.*"} | json
  | timestamp >= "2026-01-01"

# 4. DLP violations per tenant (compliance dashboard)
sum by (tenant_id) (
  count_over_time({event_type="DLP_VIOLATION"}[30d])
)

# 5. Admin actions against a specific resource
{event_type="ADMIN_ACTION"} | json | resource_id="api_key_9f"
```

## Retention policy

| Tier | Location | Duration | Mutation | Access      |
|------|----------|----------|----------|-------------|
| Hot  | Loki     | 90 d     | Deleted  | Admin UI    |
| Cold | R2       | 7 y      | Locked   | Compliance  |

- **Loki compactor** enforces 90-day retention automatically.
- **R2 Object Lock** (Compliance mode) enforces immutability — not
  even root can delete within the 7-year window.
- **Bucket lifecycle**: transition to `INFREQUENT_ACCESS` after 90d
  to cut storage cost ~60%.
- **CRR**: EU + US replication for disaster recovery.

## Incident response — pulling SOC2 evidence

1. **Scope**: identify tenant(s), users, time window, event types.
2. **Hot query** (Loki, `<90d`):
   ```bash
   logcli query '{tenant_id="t_abc", event_type="DLP_VIOLATION"}' \
     --from="2026-02-01T00:00:00Z" --to="2026-02-28T23:59:59Z" \
     --output=jsonl > evidence-hot.jsonl
   ```
3. **Cold pull** (R2, `>90d`):
   ```bash
   aws s3 sync \
     s3://sdlc-audit-logs/audit/tenant=t_abc/date=2025-11/ \
     ./evidence-cold/ \
     --endpoint-url $R2_ENDPOINT
   zcat evidence-cold/*.log.gz > evidence-cold.jsonl
   ```
4. **Verify integrity**: check R2 Object Lock status proves no
   tampering since ingestion time.
5. **Package**: sign the evidence bundle with the compliance key
   (stored in HSM) and attach to the audit ticket.

## Definition of Done

- [x] `deployments/audit-pipeline/` configs committed
- [x] `services/rag/app/audit/` module with < 200-line files
- [ ] Integration: replace `print`/`logger.info` in RAG routes
- [ ] Admin UI page: `GET /audit-logs` proxy → Loki
- [ ] Terraform: R2 bucket with Object Lock + lifecycle rules
- [ ] CI smoke test: spin compose, emit event, assert Loki returns it
- [ ] Runbook drill: pull 7-day evidence pack in < 5 minutes
