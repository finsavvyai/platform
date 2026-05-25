---
name: ll-ci
displayName: Luna CI Pipeline
description: Generate CI/CD pipeline — GitHub Actions or GitLab CI with lint, test, build, deploy stages
version: 1.0.0
category: devops
agent: luna-deployment
parameters:
  - name: platform
    type: string
    description: CI platform (github-actions, gitlab-ci, bitbucket)
    required: false
    prompt: true
  - name: scope
    type: string
    description: Project or feature scope
    required: true
    prompt: true
workflow:
  - detect_project_stack
  - generate_ci_config
  - add_quality_gates
  - add_deploy_stages
  - add_notifications
  - validate_config
  - generate_ci_report
output:
  - .github/workflows/ or .gitlab-ci.yml
  - .luna/{current-project}/ci-report.md
prerequisites: []
---

# Luna CI Pipeline

Generate production-grade CI/CD pipelines tailored to your stack.

## What This Command Does

1. **Detect** — identifies framework, package manager, test runner, deploy target
2. **Generate** — creates CI config with all stages
3. **Quality Gates** — adds lint, type-check, test, coverage, security scan
4. **Deploy** — staging + production deploy with approval gates
5. **Notifications** — Slack/Discord/email on failure
6. **Validate** — checks config syntax
7. **Report** — documents pipeline stages and triggers

## Pipeline Stages

```
PR Opened:
  ├── Install dependencies (cached)
  ├── Lint + Format check
  ├── Type check (tsc --noEmit)
  ├── Unit tests + coverage (>=90%)
  ├── Security scan (npm audit)
  └── Build validation

Merge to main:
  ├── All PR checks
  ├── Integration tests
  ├── E2E tests (Playwright)
  ├── Deploy to staging
  ├── Smoke tests on staging
  └── Deploy to production (manual approval)

Scheduled (nightly):
  ├── Full E2E suite
  ├── Dependency vulnerability scan
  └── Performance benchmark
```

## Usage

```
/ci                          # Auto-detect platform
/ci github-actions           # Specific platform
/ci gitlab-ci                # GitLab
```
