# Service Level Objectives (SLO/SLA)

> SDLC.ai Platform — Availability, Latency & Error-Budget Contracts

---

## 1. Availability SLOs

| Service | Target | Measurement Window | Max Downtime/Month |
|---------|--------|-------------------|-------------------|
| Gateway API | 99.95% | 30-day rolling | 21 min 54 s |
| RAG Pipeline | 99.9% | 30-day rolling | 43 min 48 s |
| Document Ingestion | 99.9% | 30-day rolling | 43 min 48 s |
| LLM Orchestrator | 99.5% | 30-day rolling | 3 h 39 min |
| Vector Search | 99.9% | 30-day rolling | 43 min 48 s |
| Authentication | 99.99% | 30-day rolling | 4 min 23 s |

### Measurement

```promql
# Availability = successful requests / total requests
1 - (
  sum(rate(http_requests_total{code=~"5.."}[30d]))
  /
  sum(rate(http_requests_total[30d]))
)
```

---

## 2. Latency SLOs

| Endpoint Category | p50 | p95 | p99 | Timeout |
|-------------------|-----|-----|-----|---------|
| Auth (login/refresh) | ≤ 100 ms | ≤ 250 ms | ≤ 500 ms | 5 s |
| Document CRUD | ≤ 50 ms | ≤ 200 ms | ≤ 500 ms | 10 s |
| Document Upload | ≤ 500 ms | ≤ 2 s | ≤ 5 s | 60 s |
| RAG Query | ≤ 1 s | ≤ 3 s | ≤ 8 s | 30 s |
| Vector Search | ≤ 50 ms | ≤ 150 ms | ≤ 300 ms | 5 s |
| DLP Scan | ≤ 200 ms | ≤ 500 ms | ≤ 1 s | 10 s |
| Policy Evaluation | ≤ 10 ms | ≤ 50 ms | ≤ 100 ms | 2 s |

### Measurement

```promql
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, handler))
```

---

## 3. Error-Rate SLOs

| Service | Error Budget (30d) | Alert Burn Rate |
|---------|-------------------|-----------------|
| Gateway API | 0.05% (≈ 21 min) | 14.4× → page, 6× → ticket |
| RAG Pipeline | 0.1% (≈ 43 min) | 14.4× → page, 6× → ticket |
| Authentication | 0.01% (≈ 4 min) | 14.4× → page, 3× → ticket |

### Error-Budget Burn-Rate Alerts

```yaml
# Fast burn — 2% of budget consumed in 1 hour
- alert: SLOBurnRateFast
  expr: |
    (
      sum(rate(http_requests_total{code=~"5.."}[1h]))
      / sum(rate(http_requests_total[1h]))
    ) > (14.4 * 0.0005)
  for: 2m
  labels:
    severity: critical
  annotations:
    summary: "SLO burn rate critical — paging on-call"

# Slow burn — 5% of budget consumed in 6 hours
- alert: SLOBurnRateSlow
  expr: |
    (
      sum(rate(http_requests_total{code=~"5.."}[6h]))
      / sum(rate(http_requests_total[6h]))
    ) > (6 * 0.0005)
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "SLO burn rate elevated — filing ticket"
```

---

## 4. Throughput SLOs

| Tier | Requests/min | Requests/hour | Concurrent |
|------|-------------|---------------|------------|
| Free | 60 | 1,000 | 5 |
| Starter | 300 | 10,000 | 20 |
| Professional | 1,000 | 50,000 | 50 |
| Enterprise | 5,000 | 200,000 | 200 |

---

## 5. Data Durability & Recovery

| Component | RPO | RTO | Backup Frequency |
|-----------|-----|-----|-----------------|
| PostgreSQL | ≤ 1 hour | ≤ 30 min | Hourly incremental, daily full |
| Redis | ≤ 5 min | ≤ 10 min | 5-min RDB snapshots |
| Vector Store | ≤ 1 hour | ≤ 1 hour | Daily full |
| Object Storage (S3/R2) | 0 (replicated) | ≤ 5 min | Cross-region replication |
| Kubernetes Config | ≤ 1 hour | ≤ 15 min | Hourly |

---

## 6. Incident Response SLAs

| Severity | Response Time | Resolution Target | Escalation |
|----------|--------------|-------------------|------------|
| SEV-1 (outage) | ≤ 15 min | ≤ 4 hours | Immediate page → VP Eng |
| SEV-2 (degraded) | ≤ 30 min | ≤ 8 hours | Page → team lead |
| SEV-3 (minor) | ≤ 2 hours | ≤ 3 business days | Ticket |
| SEV-4 (cosmetic) | ≤ 1 business day | ≤ 2 weeks | Backlog |

---

## 7. SLO Dashboard & Reporting

### Prometheus Recording Rules

```yaml
groups:
  - name: slo_recording_rules
    interval: 30s
    rules:
      # Gateway availability (30-day)
      - record: slo:gateway_availability:ratio_rate30d
        expr: |
          1 - (
            sum(increase(http_requests_total{service="gateway",code=~"5.."}[30d]))
            /
            sum(increase(http_requests_total{service="gateway"}[30d]))
          )

      # Gateway error budget remaining
      - record: slo:gateway_error_budget:remaining
        expr: |
          1 - (
            (1 - slo:gateway_availability:ratio_rate30d)
            / (1 - 0.9995)
          )

      # Latency SLO — % of requests under target
      - record: slo:gateway_latency_p95:ratio
        expr: |
          histogram_quantile(0.95,
            sum(rate(http_request_duration_seconds_bucket{service="gateway"}[5m])) by (le)
          )

      # RAG query latency
      - record: slo:rag_query_latency_p95:ratio
        expr: |
          histogram_quantile(0.95,
            sum(rate(http_request_duration_seconds_bucket{handler="rag_query"}[5m])) by (le)
          )
```

### Weekly SLO Review Checklist

1. Review error-budget burn across all services
2. Identify top error contributors (endpoint, status code)
3. Check latency percentile trends for regression
4. Review capacity headroom against throughput SLOs
5. Update risk register if budget < 25%
6. Schedule reliability improvements if budget < 10%

---

## 8. SLA Tiers (Customer-Facing)

| Feature | Free | Starter | Professional | Enterprise |
|---------|------|---------|-------------|------------|
| Uptime SLA | — | 99.5% | 99.9% | 99.95% |
| Support Response | Community | 24h email | 4h email | 1h phone + Slack |
| Credits for Breach | — | — | 10% per 0.1% | 25% per 0.1% |
| Status Page | Public | Public | Private | Private + webhook |
| Incident Reports | — | — | Quarterly | Per-incident |

---

## 9. Change Management

- **SLO changes** require ADR and team sign-off
- **Error-budget exhaustion** triggers deployment freeze until budget recovers
- **Quarterly SLO review** adjusts targets based on historical data
- **New services** must define SLOs before production launch
