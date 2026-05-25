# FinSavvyAI SLOs and SLAs

## Service Level Objectives (SLOs)

### Availability

| Metric | Target | Measurement Window |
|--------|--------|--------------------|
| Uptime | 99.9% | Rolling 30 days |
| Monthly allowed downtime | 43 min 49 sec | Calendar month |
| Weekly allowed downtime | 10 min 5 sec | Calendar week |

Uptime is measured by successful responses from `/health` on the API Gateway (port 8080),
polled every 30 seconds from an external prober.

### Latency (`/v1/chat/completions`)

| Percentile | Target | Measurement Window |
|------------|--------|--------------------|
| P50 | < 500 ms | Rolling 5 min |
| P95 | < 2 s | Rolling 5 min |
| P99 | < 5 s | Rolling 5 min |

Latency is measured from request received to first byte of response (TTFB) at the gateway.
Streaming requests measure time-to-first-token.

### Error Rate

| Metric | Target | Measurement Window |
|--------|--------|--------------------|
| 5xx error rate | < 1% | Rolling 5 min |
| 4xx client errors | Informational only | Rolling 5 min |

Error rate = `sum(rate(http_responses_total{status=~"5.."}[5m])) / sum(rate(http_responses_total[5m]))`.

### Throughput

| Metric | Baseline |
|--------|----------|
| Sustained RPS (gateway) | 100 req/s per replica |
| Burst capacity | 200 req/s for 60 s |

---

## Service Level Agreement (SLA)

### Credit Matrix

| Monthly Uptime | Service Credit |
|----------------|----------------|
| >= 99.9% | 0% (SLO met) |
| 99.5% - 99.9% | 10% of monthly fee |
| 99.0% - 99.5% | 15% of monthly fee |
| < 99.0% | 25% of monthly fee |

Credits are applied to the next billing cycle upon validated claim.
Scheduled maintenance windows (announced 48 h in advance) are excluded from uptime calculations.

### Exclusions

- Client-side errors (4xx) do not count against availability.
- Force majeure events (cloud provider outages confirmed by status page).
- Degradation caused by customer-initiated misconfiguration.

---

## Incident Response Time Targets

| Priority | Description | Acknowledge | Mitigate | Resolve |
|----------|-------------|-------------|----------|---------|
| P1 - Critical | Service down, data loss risk | 15 min | 1 h | 4 h |
| P2 - High | Degraded performance, partial outage | 1 h | 4 h | 24 h |
| P3 - Medium | Non-critical bug, single-user impact | 4 h | 24 h | 72 h |
| P4 - Low | Cosmetic, docs, minor UX issue | 24 h | Best effort | Next sprint |

Escalation path: On-call engineer -> Engineering lead -> CTO.

---

## Error Budget Tracking

### Calculating Error Budget

```
Monthly error budget (minutes) = 30 days * 24 h * 60 min * (1 - 0.999)
                                = 43.2 minutes / month
```

### Burn Rate

| Burn Rate | Meaning | Action |
|-----------|---------|--------|
| 1x | Budget consumed evenly over 30 days | Normal |
| 2x | Budget exhausted in 15 days | Review and prioritize reliability |
| 5x | Budget exhausted in 6 days | Freeze feature work, fix reliability |
| 10x | Budget exhausted in 3 days | All-hands incident response |

### Error Budget Policy

1. **Budget remaining > 50%**: Ship features normally.
2. **Budget remaining 25-50%**: Require reliability review for new deployments.
3. **Budget remaining < 25%**: Freeze non-critical deployments until budget recovers.
4. **Budget exhausted**: Full feature freeze; all engineering effort on reliability.

### Monitoring

- Error budget is tracked on the **SLO Dashboard** in Grafana (`observability/grafana/slo-dashboard.json`).
- Alerts fire when burn rate exceeds 2x for 1 hour (see `observability/alertmanager/alert-rules.yaml`).
- Weekly error budget report is sent to the engineering channel every Monday at 09:00 UTC.

---

## Related Resources

- AlertManager rules: `observability/alertmanager/alert-rules.yaml`
- SLO Grafana dashboard: `observability/grafana/slo-dashboard.json`
- Deployment runbook: `docs/DEPLOYMENT_RUNBOOK.md`
- Incident response: `docs/INCIDENT_RESPONSE.md`
