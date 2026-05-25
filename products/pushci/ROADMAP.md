# PushCI.dev — Product Roadmap

> "The AI-native operating system for developer pipelines,
> powered by your own infrastructure."

## v0.3–0.6 — DONE

- [x] CLI: init, run, agent, doctor, secret, mcp
- [x] 19 languages, 40+ frameworks, 16 deploy targets
- [x] GitHub + GitLab + Bitbucket webhooks + status
- [x] Cloudflare Workers API (D1 + KV)
- [x] Dashboard (runs, projects, settings, analytics)
- [x] Landing page + SEO comparison pages
- [x] OAuth login, encrypted secrets, git hooks
- [x] Claude AI: pipeline gen, error diagnosis, GH Actions converter
- [x] MCP server (AI agent integration)
- [x] Intelligence: change detection, caching, parallel
- [x] Cloud runners: Hetzner/Fly pool, queue, scheduler
- [x] Visual: pipeline graph, build trends, runner fleet
- [x] Notifications: Slack, Discord, email
- [x] Badge generator, npm package, GoReleaser

---

## Phase 1: AI-Native CI/CD (v0.7) — THE KILLER

### Auto-Pipeline Generation
- [x] Detect repo → generate full CI/CD pipeline
- [x] Keep pipeline updated when repo changes
- [x] "Fix my pipeline" button in dashboard
- [x] Natural language: "deploy to staging on PR"

### Failure Intelligence
- [x] Root cause detection (not just logs)
- [x] AI suggest fix + open PR automatically
- [x] Historical pattern matching across runs

### Self-Healing Pipelines
- [x] Auto-retry with intelligent fixes
- [x] Missing dep → auto-install + rerun
- [x] Flaky test → isolate + rerun
- [x] Timeout → increase limit + rerun

### Natural Language DevOps
- [x] "Deploy this branch to staging"
- [x] "Why did my build fail?"
- [x] "Optimize my pipeline cost"
- [x] Chat interface in dashboard

---

## Phase 2: Smart Compute (v0.8)

### Hybrid Execution
- [x] Smart runner routing (cost/latency/capability)
- [x] Tests → local, heavy build → cloud burst
- [x] GPU jobs → route to GPU runner

### Burst Mode
- [x] No runner available → spot instance fallback
- [x] Ephemeral runners (auto-destroy after job)
- [x] Multi-cloud: Hetzner + Fly + AWS spot

### Edge CI
- [x] Lightweight checks on CF Workers (lint, format)
- [x] Near-user execution for fast feedback

### Global Cache Layer
- [x] Share cache across runners (R2-backed)
- [x] Hash-based dep caching
- [x] Predictive pre-build of dependencies

---

## Phase 3: Ecosystem (v0.9)

### Pipeline Templates Marketplace
- [x] Public templates (Node, Python, Java, Docker, K8s)
- [x] Security scanning pipeline templates
- [x] Monetized expert templates (20% take rate)
- [x] Private org-wide templates

### Preview Environments
- [x] Every PR gets a deployed URL
- [x] Auto-destroy after merge
- [x] One-click promote: staging → production
- [x] Share preview link in PR comment

### GitHub Actions Migration Tool
- [x] One-click import .github/workflows/*.yml
- [x] AI-optimized conversion (reduce steps, add cache)
- [x] Side-by-side diff: before/after
- [x] "Migrate in 2 minutes" landing page

### Integrations
- [x] Jira / Linear (link CI to tickets)
- [x] PagerDuty / OpsGenie (alert on deploy fail)
- [x] Sentry (link errors to deploys)
- [x] Docker Hub / ECR / GCR (registry push)
- [x] Slack / Discord / WhatsApp / Telegram / Webhook channels (full bidirectional CI/CD via chat)

---

## Phase 4: Enterprise (v1.0)

### Security & Compliance
- [x] Policy-as-Code (no deploy without tests)
- [x] SBOM generation per build
- [x] Dependency scanning (CVE alerts)
- [x] Artifact signing + provenance
- [x] Secret leak detection in logs + auto-rotate
- [x] SOC2 Type II / ISO 27001 audit trail

### Enterprise Features
- [x] SAML SSO + SCIM provisioning
- [x] RBAC (admin, developer, viewer, auditor)
- [x] Approval gates (require N reviewers)
- [x] Environment promotion (dev→staging→prod)
- [x] Air-gapped control plane option
- [x] 99.9% uptime SLA
- [x] Dedicated support channel

### DevOps Observability
- [x] Build time trends + bottleneck detection
- [x] Cost per pipeline + savings calculator
- [x] Deploy frequency (DORA metrics)
- [x] "Your tests slow CI by 63%" insights
- [x] Team velocity dashboard

---

## Phase 5: AI Agents (v1.1+)

### Autonomous DevOps Agents
- [x] Build Agent: optimizes build steps over time
- [x] Test Agent: detects flaky tests, suggests coverage
- [x] Deploy Agent: handles rollbacks, canary deploys
- [x] Security Agent: scans, patches, alerts

### Continuous Optimization
- [x] Pipelines evolve automatically
- [x] Caching improves with usage patterns
- [x] Cost optimization suggestions
- [x] "Your Docker image shrank 40% this month"

### Codebase Intelligence
- [x] Detect risk areas (untested code paths)
- [x] Suggest missing tests
- [x] "Your Docker image is 2GB, here's how to shrink it"
- [x] Architecture drift detection

---

## Phase 6: Platform (v2.0)

### Developer Superpowers
- [x] VS Code extension (inline CI status)
- [x] JetBrains plugin
- [x] Mobile app (push notifications)
- [x] Time-travel debugging (replay failed pipelines)

### Infrastructure
- [x] Distributed CI mesh (share compute between teams)
- [x] Zero-trust runner sandboxing
- [x] Multi-region runner pools
- [x] Terraform/Pulumi integration
- [x] GitOps workflow engine

### Business
- [x] White-label SDK (sell to platforms)
- [x] API marketplace
- [x] Enterprise on-prem option
- [x] Partner program (agencies, consultants)

---

## Positioning

**Not** "another CI tool."

**PushCI.dev** = The AI-native operating system for developer
pipelines, powered by your own infrastructure.

**Wedge**: Save 80% CI costs + AI builds your pipelines for you.

**Moat**: Network effects (templates, plugins, cache) +
AI data moat (more runs = smarter diagnosis) +
brand ("just pushci it").
