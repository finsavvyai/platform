# Operator Onboarding

Checklist and references for on-call and production operators. Align with [PRODUCTION_READINESS_DAYS_5-10.md](../PRODUCTION_READINESS_DAYS_5-10.md) Day 9.

---

## Pre-go-live checklist

- [ ] Access to production Kubernetes cluster (`kubectl` config, correct namespace)
- [ ] Access to Cloudflare (Workers, Pages) if applicable
- [ ] Access to GitHub repo and Actions (view workflows, re-run, dispatch)
- [ ] Invite to PagerDuty/Opsgenie (or equivalent) and Slack #incident-response
- [ ] Read [production-runbook.md](./production-runbook.md), [incident-response.md](./incident-response.md), [rollback-procedures.md](./rollback-procedures.md)
- [ ] Run health check once: `cd deployments/production && GATEWAY_URL=https://api.sdlc.cc node run-health-checks.js`
- [ ] Run go/no-go workflow once: Actions → "Go/No-Go Checklist" → Run workflow

---

## Where to find things

| Need | Location |
|------|----------|
| **Deploy** | [production-runbook.md](./production-runbook.md), [DEPLOYMENT_PIPELINES_AND_HEALTH_CHECKS.md](../DEPLOYMENT_PIPELINES_AND_HEALTH_CHECKS.md) |
| **Rollback** | [rollback-procedures.md](./rollback-procedures.md), [production-deploy.yml](../../.github/workflows/production-deploy.yml) (Rollback on Failure job) |
| **Incident severity and comms** | [incident-response.md](./incident-response.md) |
| **DR and backups** | [disaster-recovery.md](./disaster-recovery.md), [DISASTER_RECOVERY_PLAN.md](../../deployments/cloudflare/docs/DISASTER_RECOVERY_PLAN.md) |
| **Required CI checks** | [PRODUCTION_SCOPE_AND_CHECKS.md](../PRODUCTION_SCOPE_AND_CHECKS.md) |
| **SLOs and alerts** | [prometheus-slo-rules.yaml](../../services/gateway/deploy/monitoring/prometheus-slo-rules.yaml), [prometheus-rules.yaml](../../services/gateway/deploy/monitoring/prometheus-rules.yaml) |

---

## Useful commands (quick ref)

```bash
# Health check
cd deployments/production && node run-health-checks.js

# Pod status
kubectl -n sdlc-platform get pods

# Rollback one service
kubectl -n sdlc-platform rollout undo deployment/sdlc-gateway
kubectl -n sdlc-platform rollout status deployment/sdlc-gateway

# Recent logs
kubectl -n sdlc-platform logs -l component=gateway --since=15m --tail=200
```

---

## Automated workflows (GitHub Actions)

| Workflow | Use |
|----------|-----|
| **Go/No-Go Checklist** | Pre-release: lint, tests, Trivy, Gitleaks |
| **Health Check (Scheduled)** | Manual run against custom URLs (staging/prod) |
| **Load Test (k6)** | Manual load test against target URL |
| **Secret Scan (Full History)** | Weekly + manual full-history secret scan |
| **Production Deployment** | Deploy to production (trigger from main or workflow_dispatch) |

---

*Last updated: 2026-03-06.*
