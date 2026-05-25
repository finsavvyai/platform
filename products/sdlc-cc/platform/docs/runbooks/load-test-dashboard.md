# Load Test Grafana Dashboard

Dashboard ID: `sdlc-load-test` (to be imported into Grafana 10+).

## Panels

Layout (12 columns, 4 rows):

| Panel | Row | Width | Query |
|-------|-----|-------|-------|
| Request rate | 1 | 6 | `sum(rate(k6_http_reqs_total[1m])) by (scenario)` |
| Error rate | 1 | 6 | `sum(rate(k6_http_req_failed_total[1m])) / sum(rate(k6_http_reqs_total[1m]))` |
| Latency p50/p95/p99 | 2 | 12 | `histogram_quantile(0.95, sum(rate(k6_http_req_duration_ms_bucket[1m])) by (le))` (repeat for 0.50, 0.99) |
| Ingest throughput | 3 | 4 | `sum(rate(ingest_latency_ms_count[1m]))` |
| Query throughput | 3 | 4 | `sum(rate(query_latency_ms_count[1m]))` |
| Audit writes | 3 | 4 | `sum(rate(audit_writes_total[1m]))` |
| Tier quota hits (429) | 4 | 6 | `sum(rate(gateway_rate_limit_exceeded_total[1m])) by (tier)` |
| RLS denials | 4 | 6 | `sum(rate(pg_rls_deny_total[1m])) by (table)` |

## Alerts

| Alert | Condition | Severity |
|-------|-----------|----------|
| Query p95 SLO breach | `query_latency_ms p95 > 800ms for 5m` | warning |
| Query p99 SLO breach | `query_latency_ms p99 > 1500ms for 5m` | high |
| Ingest error rate | `ingest_errors > 2% for 5m` | high |
| Audit error rate | `audit_errors > 0.1% for 5m` | critical |
| Error budget burn | `burn rate > 10x for 1h` | critical |

## Importing

```bash
# After load-test.yml CI run completes, pull JSON summaries:
gh run download --name k6-load-results
# Summaries land at tests/load/results/*.json
# Dashboard JSON generator lives at .ops/grafana/sdlc-load-test.json
# (to be authored — see https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/)
```

## Baselines

As of 2026-04-17 staging:

| Metric | Baseline | SLO |
|--------|----------|-----|
| Query p95 | 412ms | 800ms |
| Query p99 | 890ms | 1500ms |
| Ingest p95 | 1.1s | 2s |
| Audit write p99 | 38ms | 100ms |
| Gateway error rate | 0.18% | 1% |

Rerun baselines monthly and on major dependency upgrades.
