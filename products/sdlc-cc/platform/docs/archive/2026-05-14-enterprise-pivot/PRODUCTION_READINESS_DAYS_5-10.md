# Production Readiness — Days 5–10

**Purpose:** SLOs, E2E stabilization, rollback drill, load test, runbooks, and go/no-go.  
**Plans:** [WORKDAY_PLAN_PRODUCTION.md](../WORKDAY_PLAN_PRODUCTION.md)

---

## Day 5: SLOs and Alerting

| Deliverable | Status | Notes |
|-------------|--------|--------|
| **API latency SLO** | In place | `services/gateway/deploy/monitoring/prometheus-slo-rules.yaml` — p95 &lt; 100 ms. |
| **Error rate SLO** | In place | Same file — error rate &lt; 0.1%. |
| **Queue lag SLO** | To do | If using queues; define target and alert threshold. |
| **Alerts → on-call** | In place | [ALERTING_ONCALL.md](./ALERTING_ONCALL.md) + [pagerduty-receiver.example.yml](../infra/monitoring/alertmanager/pagerduty-receiver.example.yml). |
| **Verify paging** | To do | Follow [ALERTING_ONCALL.md#verify-paging](./ALERTING_ONCALL.md) and document test. |

**Reference:** NFR in [.luna/sdlc-platform/requirements.md](../.luna/sdlc-platform/requirements.md); [deployments/cloudflare/config/monitoring.yaml](../deployments/cloudflare/config/monitoring.yaml).

---

## Day 6: E2E and Smoke Tests

| Deliverable | Status | Notes |
|-------------|--------|--------|
| **Stabilize E2E suite** | To do | Fix flaky tests; run in CI. |
| **Mark flaky tests** | To do | Add owners; skip or quarantine with issue link. |
| **E2E retries** | In place | `live-e2e-sdlc.yml` runs with `--retries=2`. |
| **Smoke tests as deploy blockers** | In place | production-deploy runs smoke + health; see [DEPLOYMENT_PIPELINES_AND_HEALTH_CHECKS.md](./DEPLOYMENT_PIPELINES_AND_HEALTH_CHECKS.md). |

**Reference:** `.github/workflows/live-e2e-sdlc.yml`, [BRANCH_PROTECTION.md](../.github/BRANCH_PROTECTION.md).

---

## Day 7: Rollback Drill

| Deliverable | Status | Notes |
|-------------|--------|--------|
| **Rollback one critical service** | To do | Execute rollback for Gateway or RAG using [rollback-procedures.md](./runbooks/rollback-procedures.md). |
| **Document RTO/RPO** | In place | Record results in [rto-rpo-drill-log.md](./runbooks/rto-rpo-drill-log.md); update [DISASTER_RECOVERY_PLAN.md](../deployments/cloudflare/docs/DISASTER_RECOVERY_PLAN.md) if targets change. |

**Reference:** [production-deploy.yml](../.github/workflows/production-deploy.yml) (Rollback on Failure), [deployments/production/lib/rollback/](../deployments/production/lib/rollback/).

---

## Day 8: Load Test and Autoscaling

| Deliverable | Status | Notes |
|-------------|--------|--------|
| **Load test baseline** | Automated | `.github/workflows/load-test.yml` runs k6 (manual + weekly); use workflow_dispatch for target URL. |
| **Capacity thresholds** | In place | [CAPACITY_AND_AUTOSCALING.md](./CAPACITY_AND_AUTOSCALING.md) — table to fill from k6 runs. |
| **Autoscaling triggers** | In place | [CAPACITY_AND_AUTOSCALING.md](./CAPACITY_AND_AUTOSCALING.md) documents HPA in [infra/k8s/hpa/](../infra/k8s/hpa/). |

**Reference:** [deployments/production/lib/benchmarks/](../deployments/production/lib/benchmarks/), `tests/load/k6-gateway.js`.

---

## Day 9: Runbooks and Onboarding

| Deliverable | Status | Notes |
|-------------|--------|--------|
| **Production runbook** | In place | [docs/runbooks/production-runbook.md](./runbooks/production-runbook.md) — deploy, health check, rollback, scaling, alerts; links to pipelines and DR. |
| **Incident playbook** | In place | [docs/runbooks/incident-response.md](./runbooks/incident-response.md) — severity, comms, escalation, post-mortem. |
| **Operator onboarding** | In place | [docs/runbooks/operator-onboarding.md](./runbooks/operator-onboarding.md) — checklist, access, commands, workflows. |
| **RTO/RPO drill log** | In place | [docs/runbooks/rto-rpo-drill-log.md](./runbooks/rto-rpo-drill-log.md) — record results after each rollback/DR drill. |

---

## Day 10: Go/No-Go and Release

| Deliverable | Status | Notes |
|-------------|--------|--------|
| **Go/no-go checklist (automated)** | In place | `.github/workflows/go-no-go.yml` runs lint, unit tests, Trivy, Gitleaks; use workflow_dispatch. |
| **Sign-off** | To do | Product, Eng, Security. |
| **Release candidate** | To do | Cut tag; monitor first 24h. |

**Definition of Done (from WORKDAY_PLAN_PRODUCTION):** Zero critical vulnerabilities; required checks enforced and passing; rollback tested and documented; on-call alerts verified end-to-end.

---

*Last updated: 2026-03-06. Complete items and update status as each day is done.*
