# CLAUDE.md - LunaOS Infra

This file extends the workspace root policy at:

- `/Users/shaharsolomon/dev/projects/claude.md`

## Product Mission And Target User

- Mission: Provide infrastructure-as-code, CI/CD pipelines, deployment scripts, monitoring configuration, and security tooling for the entire LunaOS platform across all 10 product repos.
- Target user: Platform engineers and DevOps operators responsible for deploying, monitoring, and securing the LunaOS stack.
- Primary jobs to be done:
  - Automate deployment of all services to Cloudflare (Workers, Pages, D1, KV)
  - Run CI/CD pipelines (lint, test, build, deploy) via GitHub Actions
  - Execute load tests with k6 against staging and production
  - Run Lighthouse audits and smoke tests post-deploy
  - Validate CLAUDE.md governance across all repos
  - Manage Docker containers for local development

## Product-Specific Architecture Constraints

- Runtime(s): Bash scripts, GitHub Actions YAML, Docker, k6 (Go-based load testing)
- Core services:
  - `scripts/` -- deployment scripts (deploy-all.sh, deploy-dashboard.sh, smoke-test.sh, lighthouse-audit.sh)
  - `ci/` -- GitHub Actions workflow files
  - `docker/` -- Dockerfiles and docker-compose for local dev
  - `k8s/` -- Kubernetes manifests (optional scaling path)
  - `monitoring/` -- alerting and dashboard configs
  - `security/` -- SAST configs, secret scanning, license compliance
  - `tests/` -- infrastructure validation tests
- Data boundaries: No application data; reads deployment configs and environment variables
- Integration boundaries: Cloudflare API (wrangler), GitHub Actions, Docker Hub, k6 Cloud (optional)

### CI/CD and Deployment Constraints

- All deployment scripts must be idempotent
- Scripts must exit with non-zero status on any failure
- All bash scripts must use `set -euo pipefail`
- GitHub Actions workflows must pin action versions to SHA
- Secrets must be referenced via GitHub Secrets or Cloudflare env, never hardcoded
- Load test scenarios must define explicit pass/fail thresholds
- All scripts must include usage documentation in comments or `--help`

## Product-Specific Test Matrix

- Unit tests: ShellCheck for bash script linting; YAML lint for GitHub Actions
- Integration tests: Dry-run deployments (`wrangler deploy --dry-run`); Docker build verification
- E2E/smoke tests: `scripts/smoke-test.sh` against deployed endpoints; Lighthouse audits via `scripts/lighthouse-audit.sh`
- Load tests: k6 scenarios in `load-tests/scenarios/`; health, auth, agent execution, chain, RAG, mixed workload
- Critical path tests (must remain 100% covered):
  - Deploy scripts exit non-zero on failure
  - Smoke test validates all service health endpoints
  - CLAUDE.md validation script checks all 8 repos
- Coverage thresholds: N/A for infrastructure scripts; 100% of deploy scripts must have smoke test coverage

## Product-Specific Security Controls

- AuthN/AuthZ model: GitHub Actions uses OIDC or deploy tokens for Cloudflare; no long-lived credentials
- Secret management: All secrets in GitHub Secrets or Cloudflare dashboard; `security/` directory contains SAST and secret scan configs
- Input/output validation: Script arguments validated; deployment targets whitelist-checked
- Audit logging requirements: All deployments logged in GitHub Actions run history; deploy scripts output version/timestamp
- Data retention/privacy constraints: No user data handled; logs retained per GitHub Actions retention policy

## Product-Specific Release Checklist

- [ ] CI is green (all workflow YAML validates)
- [ ] ShellCheck passes on all bash scripts
- [ ] All deploy scripts tested with `--dry-run`
- [ ] Smoke tests pass against staging
- [ ] Load test thresholds met (p95 latency, error rate)
- [ ] Security scans have no open Critical/High issues
- [ ] Docker images build successfully
- [ ] Rollback procedure documented and tested
- [ ] CLAUDE.md validation script passes for all repos

## Commands

```bash
bash scripts/deploy-all.sh      # Deploy all services
bash scripts/smoke-test.sh      # Run smoke tests
bash scripts/lighthouse-audit.sh # Lighthouse audit
bash scripts/validate-claude-md.sh # Validate CLAUDE.md files
```

## Local Notes

- This file adds ShellCheck requirement for bash scripts (stricter than root).
- This file adds load test threshold gates.
- This file does not weaken any root policy requirement.
- Infra repo has no npm package; scripts are bash/YAML only.
