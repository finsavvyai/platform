# Production Runbook

Single entry point for production operations.

---

## Deployment readiness (Cloudflare path)

Before running the Cloudflare deploy script, ensure:

1. **Auth:** Run `wrangler auth login`; then `wrangler whoami` succeeds (or set `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in CI).
2. **Proxy Worker:** Required secrets configured in Cloudflare (e.g. `API_KEY_SECRET`, optional `BACKEND_URL`, `OPENAI_API_KEY`) — see `services/proxy-worker/wrangler.toml`.
3. **Landing Page:** From repo root, `cd landing-page && npm ci && npm run pages:build` succeeds.

See [DEPLOYMENT_STATUS.md](../DEPLOYMENT_STATUS.md) for full checklist and health-check commands.

---

## Quick links

| Topic | Document |
|-------|----------|
| **Deploy** | [DEPLOYMENT_PIPELINES_AND_HEALTH_CHECKS.md](../DEPLOYMENT_PIPELINES_AND_HEALTH_CHECKS.md), [deployments/production/README.md](../../deployments/production/README.md) |
| **Rollback** | [rollback-procedures.md](./rollback-procedures.md) |
| **Incidents** | [incident-response.md](./incident-response.md) |
| **Disaster recovery** | [disaster-recovery.md](./disaster-recovery.md), [DISASTER_RECOVERY_PLAN.md](../../deployments/cloudflare/docs/DISASTER_RECOVERY_PLAN.md) |
| **Health checks** | [DEPLOYMENT_PIPELINES_AND_HEALTH_CHECKS.md#post-deploy-health-checks](../DEPLOYMENT_PIPELINES_AND_HEALTH_CHECKS.md) |
| **Operator onboarding** | [operator-onboarding.md](./operator-onboarding.md) |

---

## Deploy (production)

1. **CI/CD:** Merges to `main` trigger [production-deploy.yml](../../.github/workflows/production-deploy.yml) (if configured). Prefer **workflow_dispatch** with `environment: production` for controlled releases.
2. **Cloudflare (proxy + landing):** From repo root:
   ```bash
   ./scripts/deploy-production-cloudflare.sh
   ```
   Deploy only proxy: `PROXY_ONLY=1 ./scripts/deploy-production-cloudflare.sh`. Deploy only landing: `LANDING_ONLY=1 ./scripts/deploy-production-cloudflare.sh`.
   **CI:** Pushes to `main` that touch `services/proxy-worker/`, `landing-page/`, or the deploy script trigger [deploy-cloudflare.yml](../../.github/workflows/deploy-cloudflare.yml); ensure `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are set in repo secrets.
3. **Manual (orchestrator):** From repo root:
   ```bash
   cd deployments/production && npm run deploy:prod
   ```
4. **Post-deploy:** Workflow runs `run-health-checks.js`; or manually:
   ```bash
   cd deployments/production && GATEWAY_URL=https://api.sdlc.cc LANDING_URL=https://sdlc.cc node run-health-checks.js
   ```

---

## Health check (ad hoc)

```bash
cd deployments/production
export GATEWAY_URL=https://api.sdlc.cc
export LANDING_URL=https://sdlc.cc
node run-health-checks.js
```

Scheduled health checks run every 6h via [health-check-scheduled.yml](../../.github/workflows/health-check-scheduled.yml).

---

## Rollback

- **Decision:** See [rollback-procedures.md#decision-framework](./rollback-procedures.md).
- **Kubernetes:** `kubectl -n sdlc-platform rollout undo deployment/<service>` (see [rollback-procedures.md](./rollback-procedures.md)).
- **CI:** [production-deploy.yml](../../.github/workflows/production-deploy.yml) has a "Rollback on Failure" job; for manual rollback use the same kubectl/Wrangler steps as in that job and in [rollback-procedures.md](./rollback-procedures.md).

---

## Scaling

- **Kubernetes:** `kubectl -n sdlc-platform scale deployment/<name> --replicas=N`
- **HPA:** Configured in deploy (see `infra/k8s`). Adjust in cluster or via Terraform/Helm.

---

## Alerts and SLOs

- **Gateway SLO rules:** [services/gateway/deploy/monitoring/prometheus-slo-rules.yaml](../../services/gateway/deploy/monitoring/prometheus-slo-rules.yaml) (p95 &lt; 100ms, error rate &lt; 0.1%).
- **Full alert rules:** [services/gateway/deploy/monitoring/prometheus-rules.yaml](../../services/gateway/deploy/monitoring/prometheus-rules.yaml).
- **On-call:** [ALERTING_ONCALL.md](../ALERTING_ONCALL.md) — route Alertmanager to PagerDuty; [incident-response.md](./incident-response.md) for severity and escalation.

---

*Last updated: 2026-03-06.*
