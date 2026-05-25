# Deployment Pipelines and Post-Deploy Health Checks

**Purpose:** Validate deployment pipelines (staging/production) and automated post-deploy health checks.  
**Plans:** [WORKDAY_PLAN_PRODUCTION.md](../WORKDAY_PLAN_PRODUCTION.md) (Day 4)

---

## 1. Deployment Pipelines

| Pipeline | Path / Trigger | Environment | Use |
|----------|----------------|-------------|-----|
| **Production (GitHub Actions)** | `.github/workflows/production-deploy.yml` | production | Push to `main` or workflow_dispatch; builds, security scan, infra, deploy, post-deploy tests. |
| **Production (orchestrator)** | `deployments/production/deploy.sh`, `deploy-orchestrator.js` | staging / production | Terraform + orchestrator; includes health-check phase. |
| **Cloudflare** | `deployments/cloudflare/scripts/deploy-*.sh`, Wrangler | Workers, Pages | Landing, LAM, gateway-worker. |
| **Landing Page** | `.github/workflows/deploy-landing-page.yml` | Cloudflare Pages | Deploy landing to sdlc.cc. |
| **Gateway** | `.github/workflows/deploy-gateway.yml` | K8s / target | Gateway service deploy. |

**Staging validation:** Run production-deploy with `environment: staging` (workflow_dispatch) or use `deployments/production` with `--environment staging` before promoting to production.

---

## 2. Post-Deploy Health Checks

### In GitHub Actions (production-deploy.yml)

- **Job:** `Post-deployment Tests` (runs after `Deploy Application`).
- **Steps:**
  - Smoke tests: `tests/e2e` against `https://api.sdlc.cc`.
  - Integration tests: `tests/integration` (production env).
  - Performance/load tests: `tests/performance`.
  - Security checks: `curl -f https://api.sdlc.cc/health`, security headers on `https://sdlc.cc`, optional OWASP ZAP.

If any step fails, the workflow does not create a release; rollback can be triggered on failure.

### In deployments/production (orchestrator)

- **Phase:** `health-check` in `deploy-orchestrator.js`.
- **Behavior:** After deploy, `HealthCheckOrchestrator` runs service, database, and vector index checks. On failure, rollback is triggered.
- **Standalone script:** `deployments/production/run-health-checks.js` (see below) for manual or CI runs against a given environment.

### Standalone health check script

From repo root, after deploying (or against an existing environment):

```bash
cd deployments/production
export GATEWAY_URL=https://api.sdlc.cc   # or staging URL
export RAG_URL=https://rag.sdlc.cc      # if applicable
npm install --no-save
node run-health-checks.js
```

Exit code is non-zero if any required health endpoint fails. Used for staging validation or ad-hoc verification.

### Scheduled health checks (CI)

- **Workflow:** `.github/workflows/health-check-scheduled.yml` runs every 6 hours and on `workflow_dispatch` with configurable Gateway and Landing URLs. Use it to validate production/staging endpoints continuously.

---

## 3. Acceptance Criteria (Day 4)

- [x] Deployment pipelines documented (production, staging, Cloudflare).
- [x] Post-deploy health checks documented (Actions + orchestrator).
- [x] Standalone health-check script for staging/manual runs.
- [ ] Staging run of full pipeline validated (manual; run workflow with staging or run deploy.sh with staging).
- [ ] Branch protection and required checks enforced in GitHub (see [PRODUCTION_SCOPE_AND_CHECKS.md](./PRODUCTION_SCOPE_AND_CHECKS.md)).

---

*Last updated: 2026-03-06. Align with [WORKDAY_PLAN_PRODUCTION.md](../WORKDAY_PLAN_PRODUCTION.md) and [deployments/production/README.md](../deployments/production/README.md).*
