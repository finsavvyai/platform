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
- [ ] Detect repo → generate full CI/CD pipeline
- [ ] Keep pipeline updated when repo changes
- [ ] "Fix my pipeline" button in dashboard
- [ ] Natural language: "deploy to staging on PR"

### Failure Intelligence
- [ ] Root cause detection (not just logs)
- [ ] AI suggest fix + open PR automatically
- [ ] Historical pattern matching across runs

### Self-Healing Pipelines
- [ ] Auto-retry with intelligent fixes
- [ ] Missing dep → auto-install + rerun
- [ ] Flaky test → isolate + rerun
- [ ] Timeout → increase limit + rerun

### Natural Language DevOps
- [ ] "Deploy this branch to staging"
- [ ] "Why did my build fail?"
- [ ] "Optimize my pipeline cost"
- [ ] Chat interface in dashboard

---

## Phase 2: Smart Compute (v0.8)

### Hybrid Execution
- [ ] Smart runner routing (cost/latency/capability)
- [ ] Tests → local, heavy build → cloud burst
- [ ] GPU jobs → route to GPU runner

### Burst Mode
- [ ] No runner available → spot instance fallback
- [ ] Ephemeral runners (auto-destroy after job)
- [ ] Multi-cloud: Hetzner + Fly + AWS spot

### Edge CI
- [ ] Lightweight checks on CF Workers (lint, format)
- [ ] Near-user execution for fast feedback

### Global Cache Layer
- [ ] Share cache across runners (R2-backed)
- [ ] Hash-based dep caching
- [ ] Predictive pre-build of dependencies

---

## Phase 3: Ecosystem (v0.9)

### Pipeline Templates Marketplace
- [ ] Public templates (Node, Python, Java, Docker, K8s)
- [ ] Security scanning pipeline templates
- [ ] Monetized expert templates (20% take rate)
- [ ] Private org-wide templates

### Preview Environments
- [ ] Every PR gets a deployed URL
- [ ] Auto-destroy after merge
- [ ] One-click promote: staging → production
- [ ] Share preview link in PR comment

### GitHub Actions Migration Tool
- [ ] One-click import .github/workflows/*.yml
- [ ] AI-optimized conversion (reduce steps, add cache)
- [ ] Side-by-side diff: before/after
- [ ] "Migrate in 2 minutes" landing page

### Integrations
- [ ] Jira / Linear (link CI to tickets)
- [ ] PagerDuty / OpsGenie (alert on deploy fail)
- [ ] Sentry (link errors to deploys)
- [ ] Docker Hub / ECR / GCR (registry push)
- [ ] Slack / Discord / WhatsApp alerts

---

## Phase 4: Enterprise (v1.0)

### Security & Compliance
- [ ] Policy-as-Code (no deploy without tests)
- [ ] SBOM generation per build
- [ ] Dependency scanning (CVE alerts)
- [ ] Artifact signing + provenance
- [ ] Secret leak detection in logs + auto-rotate
- [ ] SOC2 Type II / ISO 27001 audit trail

### Enterprise Features
- [ ] SAML SSO + SCIM provisioning
- [ ] RBAC (admin, developer, viewer, auditor)
- [ ] Approval gates (require N reviewers)
- [ ] Environment promotion (dev→staging→prod)
- [ ] Air-gapped control plane option
- [ ] 99.9% uptime SLA
- [ ] Dedicated support channel

### DevOps Observability
- [ ] Build time trends + bottleneck detection
- [ ] Cost per pipeline + savings calculator
- [ ] Deploy frequency (DORA metrics)
- [ ] "Your tests slow CI by 63%" insights
- [ ] Team velocity dashboard

---

## Phase 5: AI Agents (v1.1+)

### Autonomous DevOps Agents
- [ ] Build Agent: optimizes build steps over time
- [ ] Test Agent: detects flaky tests, suggests coverage
- [ ] Deploy Agent: handles rollbacks, canary deploys
- [ ] Security Agent: scans, patches, alerts

### Continuous Optimization
- [ ] Pipelines evolve automatically
- [ ] Caching improves with usage patterns
- [ ] Cost optimization suggestions
- [ ] "Your Docker image shrank 40% this month"

### Codebase Intelligence
- [ ] Detect risk areas (untested code paths)
- [ ] Suggest missing tests
- [ ] "Your Docker image is 2GB, here's how to shrink it"
- [ ] Architecture drift detection

---

## Phase 6: Platform (v2.0)

### Developer Superpowers
- [ ] VS Code extension (inline CI status)
- [ ] JetBrains plugin
- [ ] Mobile app (push notifications)
- [ ] Time-travel debugging (replay failed pipelines)

### Infrastructure
- [ ] Distributed CI mesh (share compute between teams)
- [ ] Zero-trust runner sandboxing
- [ ] Multi-region runner pools
- [ ] Terraform/Pulumi integration
- [ ] GitOps workflow engine

### Business
- [ ] White-label SDK (sell to platforms)
- [ ] API marketplace
- [ ] Enterprise on-prem option
- [ ] Partner program (agencies, consultants)

---

## Positioning

**Not** "another CI tool."

**PushCI.dev** = The AI-native operating system for developer
pipelines, powered by your own infrastructure.

**Wedge**: Save 80% CI costs + AI builds your pipelines for you.

**Moat**: Network effects (templates, plugins, cache) +
AI data moat (more runs = smarter diagnosis) +
brand ("just pushci it").
