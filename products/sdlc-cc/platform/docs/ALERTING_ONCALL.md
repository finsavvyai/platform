# Routing Alerts to On-Call

How to route Prometheus/Alertmanager to PagerDuty (or equivalent) and verify paging. See [PRODUCTION_READINESS_DAYS_5-10.md](./PRODUCTION_READINESS_DAYS_5-10.md) Day 5.

---

## Current setup

- **Alertmanager config:** [infra/monitoring/alertmanager/alertmanager.yml](../infra/monitoring/alertmanager/alertmanager.yml)
- **Critical alerts** → `critical-alerts` receiver (email + Slack). Replace `YOUR_SLACK_WEBHOOK_URL` with a real webhook.
- **SLO rules:** [services/gateway/deploy/monitoring/prometheus-slo-rules.yaml](../services/gateway/deploy/monitoring/prometheus-slo-rules.yaml)

---

## Add PagerDuty (or Opsgenie)

### Option A: PagerDuty

1. In PagerDuty: Create a service → Integrations → Add "Prometheus" integration; copy the **Integration Key**.
2. Add a receiver to Alertmanager. Example snippet in [infra/monitoring/alertmanager/pagerduty-receiver.example.yml](../infra/monitoring/alertmanager/pagerduty-receiver.example.yml).
3. In `alertmanager.yml`, add the `pagerduty-critical` receiver and route `severity: critical` to it (or in addition to `critical-alerts`).
4. Restart Alertmanager and load the new config.

### Option B: Webhook to PagerDuty/Opsgenie

- Use the existing `web.hook` or add a webhook URL from PagerDuty/Opsgenie that accepts Prometheus alert payloads.
- Point the critical route to that receiver.

---

## Verify paging

1. **Trigger a test alert:** In Prometheus, run a query that fires an alert (e.g. temporarily break the SLO), or use Alertmanager's "Silences" UI to test (some setups have "Test" button).
2. **Confirm:** Incident appears in PagerDuty/Opsgenie and on-call is paged.
3. **Resolve:** Clear the alert and confirm the incident auto-resolves or can be acknowledged.
4. Document the test in [rto-rpo-drill-log.md](./runbooks/rto-rpo-drill-log.md) or runbooks README (e.g. "Paging test: 2026-03-XX – passed").

---

## Checklist (Day 5)

- [ ] Replace `YOUR_SLACK_WEBHOOK_URL` in alertmanager.yml (or remove Slack if using PagerDuty only).
- [ ] Add PagerDuty (or equivalent) receiver and route critical alerts to it.
- [ ] Run a test alert and confirm on-call is paged.
- [ ] Ensure primary/secondary on-call rotation is set in PagerDuty; see [incident-response.md](./runbooks/incident-response.md).

---

*Last updated: 2026-03-06.*
