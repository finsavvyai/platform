# TenantIQ × PushCI × Claw-Code — Platform Integration Sprint Plan

> **Source**: Architecture deep-dive of all 3 projects (April 2026)
> **Sprints**: 13–18 (continuing from Sprint 12)
> **Timeline**: April – June 2026
> **Sprint Duration**: 2 weeks each
> **Goal**: Unify claw-code runtime, PushCI CI/CD, and TenantIQ into an integrated MSP platform

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│                   Claude (LLM)                        │
└──────────────┬───────────────────────┬───────────────┘
               │ MCP                   │ MCP
   ┌───────────▼──────────┐  ┌────────▼──────────────┐
   │   claw-code runtime   │  │    PushCI MCP Server   │
   │  (Rust: MCP client,   │  │  (Go: init, run,       │
   │   sessions, hooks,    │  │   status, doctor,      │
   │   tool execution)     │  │   secret_set)          │
   └───────────┬──────────┘  └────────┬──────────────┘
               │                      │
   ┌───────────▼──────────────────────▼──────────────┐
   │           Shared Agent Platform (Rust)            │
   │  Sessions │ Tools │ Events │ Multi-tenant         │
   └───────────┬──────────────────────┬──────────────┘
               │                      │
   ┌───────────▼──────────┐  ┌────────▼──────────────┐
   │   TenantIQ API        │  │  PushCI Pipeline       │
   │  (Hono/CF Workers)    │  │  (Go: detect, build,   │
   │  103 CIS controls     │  │   test, deploy, heal)  │
   │  3 PSA integrations   │  │  21 deploy targets     │
   │  25 workflow templates │  │  19 language detection  │
   └──────────────────────┘  └───────────────────────┘
```

---

## Sprint Overview

| Sprint | Dates | Theme | Key Deliverable |
|--------|-------|-------|-----------------|
| Sprint 13 | Apr 7–18 | PushCI → TenantIQ deployment pipeline | Auto-generated CI/CD for TenantIQ |
| Sprint 14 | Apr 21–May 2 | Claw-code MCP bridge for TenantIQ | Agent sessions with M365 tool access |
| Sprint 15 | May 5–16 | Post-deploy automation | CIS scan + health check after every deploy |
| Sprint 16 | May 19–30 | Unified agent platform | Shared Rust runtime across all 3 projects |
| Sprint 17 | Jun 2–13 | Self-healing CI for TenantIQ | PushCI healer + TenantIQ-specific strategies |
| Sprint 18 | Jun 16–27 | NLP orchestration + dashboard | Natural language commands across all systems |

---

## Sprint 13 — PushCI → TenantIQ Deployment Pipeline

**Dates**: April 7–18, 2026
**Theme**: Auto-generate CI/CD pipeline for TenantIQ using PushCI's detection + deploy

### Why
TenantIQ currently uses GitHub Actions CI (`.github/workflows/ci.yml` + `deploy.yml`). PushCI can replace this with AI-native pipelines that auto-detect the monorepo structure (SvelteKit + Cloudflare Workers + 9 packages), auto-heal failures, and provide natural language interaction.

### Tasks

#### Week 1 — PushCI Config Generation + Detection

| # | Task | File(s) | Est |
|---|------|---------|-----|
| 13.1 | Add TenantIQ-specific detection rules to PushCI: recognize Hono on CF Workers, SvelteKit on CF Pages, Drizzle ORM, Turbo monorepo | `push-ci.dev/internal/detect/node.go` | 4h |
| 13.2 | Create `pushci.yml` for TenantIQ monorepo: parallel checks (lint, typecheck, test per package), deploy (API→Workers, Web→Pages) | `tenantiq/pushci.yml` | 3h |
| 13.3 | Add Cloudflare Workers deploy with wrangler bindings (D1, KV, R2, DO, queues) — extend `cfWorkers()` to pass binding flags | `push-ci.dev/internal/deploy/cloudflare.go` | 6h |
| 13.4 | Add Turbo monorepo support to PushCI runner: detect turbo.json, run checks via `turbo run test --filter=...` | `push-ci.dev/internal/runner/turbo.go` | 5h |
| 13.5 | Create PushCI plugin for TenantIQ-specific checks: D1 migration validation, Zod schema check, 200-line file limit | `push-ci.dev/internal/plugin/tenantiq.go` | 4h |

#### Week 2 — Webhook Integration + Testing

| # | Task | File(s) | Est |
|---|------|---------|-----|
| 13.6 | Configure GitHub webhook from TenantIQ repo to PushCI agent server | `tenantiq/.github/webhooks/pushci.json` | 2h |
| 13.7 | Add TenantIQ deploy pipeline: staging (preview branch) → production (main merge), with Cloudflare Pages preview URLs | `push-ci.dev/internal/deploy/stages.go` | 6h |
| 13.8 | Create PushCI status badge component for TenantIQ README and settings page | `tenantiq/apps/web/src/lib/components/settings/CIStatus.svelte` | 3h |
| 13.9 | Add rollback support: if deploy fails, auto-revert to previous wrangler version | `push-ci.dev/internal/deploy/rollback.go` | 5h |
| 13.10 | Integration test: push to TenantIQ → PushCI detects → runs pipeline → deploys → posts status | `push-ci.dev/tests/integration/tenantiq_test.go` | 6h |
| 13.11 | Write unit tests for new detection rules and Turbo support | `push-ci.dev/internal/detect/node_test.go` | 4h |

### Acceptance Criteria
- [ ] `pushci init` in TenantIQ root generates correct `pushci.yml` (9 packages detected)
- [ ] `pushci run` executes lint + typecheck + test for all packages in parallel via Turbo
- [ ] `pushci run --deploy` deploys API to Workers and Web to Pages
- [ ] GitHub webhook triggers pipeline on push/PR
- [ ] Pipeline posts status checks back to GitHub PR
- [ ] Rollback works on deploy failure
- [ ] TenantIQ-specific checks (200-line limit, D1 migrations) pass

---

## Sprint 14 — Claw-Code MCP Bridge for TenantIQ

**Dates**: April 21–May 2, 2026
**Theme**: Connect claw-code's runtime to TenantIQ's API via MCP tool definitions

### Why
Claw-code has a production-grade MCP client (`runtime/mcp.rs`, `mcp_client.rs`, `mcp_stdio.rs`), session management, and tool execution framework. TenantIQ has 82+ API endpoints. Bridging them lets an AI agent manage M365 tenants through natural conversation — "scan Contoso for CIS compliance and create tickets in ConnectWise for failures."

### Tasks

#### Week 1 — MCP Tool Definitions for TenantIQ

| # | Task | File(s) | Est |
|---|------|---------|-----|
| 14.1 | Define TenantIQ MCP tool schema: 15 tools covering tenants, CIS, alerts, workflows, integrations, backup | `claw-code-main/rust/crates/plugins/src/tenantiq_tools.rs` | 8h |
| 14.2 | Create MCP server for TenantIQ API: stdio JSON-RPC server that proxies tool calls to TenantIQ API endpoints | `tenantiq/packages/mcp-server/src/index.ts` | 8h |
| 14.3 | Implement tool handlers: map each MCP tool to TenantIQ API call with auth token forwarding | `tenantiq/packages/mcp-server/src/handlers/` | 6h |
| 14.4 | Add TenantIQ MCP server to claw-code config: register as external MCP server in claw-code's runtime | `claw-code-main/rust/crates/runtime/src/config.rs` | 3h |
| 14.5 | Create auth bridge: claw-code session token → TenantIQ JWT exchange | `tenantiq/packages/mcp-server/src/auth.ts` | 4h |

#### Week 2 — Session Management + Testing

| # | Task | File(s) | Est |
|---|------|---------|-----|
| 14.6 | Implement claw-code hooks for TenantIQ events: on_alert, on_cis_scan_complete, on_drift_detected | `claw-code-main/rust/crates/plugins/src/hooks.rs` | 5h |
| 14.7 | Create conversation templates: pre-built prompts for common MSP workflows (onboard tenant, investigate alert, compliance report) | `tenantiq/packages/mcp-server/src/templates/` | 4h |
| 14.8 | Add streaming support: TenantIQ MCP server streams CIS scan progress and AI analysis results | `tenantiq/packages/mcp-server/src/streaming.ts` | 5h |
| 14.9 | Integration test: claw-code CLI → MCP → TenantIQ API → Graph API mock → results displayed | `tenantiq/packages/mcp-server/tests/` | 6h |
| 14.10 | Write tool definition tests: verify all 15 tools have valid schemas, descriptions, required params | `tenantiq/packages/mcp-server/src/tools.test.ts` | 4h |
| 14.11 | Documentation: MCP tool catalog with examples for each tool | `tenantiq/docs/mcp-tools.md` | 2h |

### MCP Tools Catalog (15 tools)

| Tool | Description | TenantIQ API |
|------|-------------|-------------|
| `tenantiq.list_tenants` | List all connected tenants | `GET /api/tenants` |
| `tenantiq.get_dashboard` | Dashboard metrics for a tenant | `GET /api/tenants/:id/dashboard` |
| `tenantiq.run_cis_scan` | Trigger CIS benchmark scan | `POST /api/cis-benchmark/scan` |
| `tenantiq.get_cis_results` | Get CIS scan results | `GET /api/cis-benchmark/results` |
| `tenantiq.list_alerts` | List security alerts | `GET /api/alerts` |
| `tenantiq.acknowledge_alert` | Acknowledge an alert | `PATCH /api/alerts/:id` |
| `tenantiq.create_workflow` | Install workflow template | `POST /api/workflow-templates/:id/install` |
| `tenantiq.run_workflow` | Execute a workflow | `POST /api/workflows/:id/run` |
| `tenantiq.get_backup_status` | Check backup job status | `GET /api/backups/jobs` |
| `tenantiq.start_backup` | Start data backup | `POST /api/backups/start` |
| `tenantiq.sync_psa` | Trigger PSA sync | `POST /api/integrations/:provider/sync` |
| `tenantiq.get_health_score` | Tenant health score | `GET /api/health-score` |
| `tenantiq.export_config` | Export M365 config as JSON | `POST /api/config/export` |
| `tenantiq.get_storage` | Storage analytics | `GET /api/storage-analytics` |
| `tenantiq.executive_report` | Generate executive summary | `POST /api/executive-report` |

### Acceptance Criteria
- [ ] TenantIQ MCP server runs as stdio process with 15 registered tools
- [ ] claw-code CLI can invoke TenantIQ tools via MCP protocol
- [ ] Auth token exchange works (claw-code session → TenantIQ JWT)
- [ ] Streaming CIS scan progress displays in claw-code CLI
- [ ] Hook events fire on TenantIQ alerts and scan completions
- [ ] All 15 tools have integration tests against mock API

---

## Sprint 15 — Post-Deploy Automation

**Dates**: May 5–16, 2026
**Theme**: Automated security verification after every TenantIQ deployment

### Why
Every deploy should verify that TenantIQ's own security posture is intact. PushCI's agent system + TenantIQ's CIS scanner + claw-code's orchestration create an automated post-deploy pipeline: deploy → CIS scan → health check → PSA ticket if issues → Slack notification.

### Tasks

#### Week 1 — Post-Deploy Pipeline

| # | Task | File(s) | Est |
|---|------|---------|-----|
| 15.1 | Create PushCI post-deploy hook: after successful deploy, invoke TenantIQ health check endpoint | `push-ci.dev/internal/deploy/hooks.go` | 5h |
| 15.2 | Build post-deploy verification agent: calls TenantIQ API to run CIS scan, check health score, verify API endpoints respond | `push-ci.dev/internal/agents/verify.go` | 8h |
| 15.3 | Create TenantIQ self-test endpoint: `GET /api/self-test` runs smoke tests against own API (auth, DB, KV, Graph token) | `tenantiq/apps/api/src/routes/self-test.ts` | 6h |
| 15.4 | Add regression detection: compare CIS scan results before/after deploy, alert on score decrease | `tenantiq/apps/api/src/lib/cis/regression-detector.ts` | 5h |
| 15.5 | Wire PushCI deploy result → TenantIQ notification: post deploy status to configured Slack/Teams channels | `push-ci.dev/internal/deploy/notify.go` | 3h |

#### Week 2 — Automated Response + Testing

| # | Task | File(s) | Est |
|---|------|---------|-----|
| 15.6 | Auto-create PSA ticket on deploy failure: PushCI → TenantIQ integration API → ConnectWise/Datto ticket | `push-ci.dev/internal/agents/ticket.go` | 6h |
| 15.7 | Build deploy dashboard widget: show last deploy status, CIS score delta, health check in TenantIQ settings | `tenantiq/apps/web/src/lib/components/settings/DeployStatus.svelte` | 4h |
| 15.8 | Create claw-code automation recipe: "after deploy, scan all tenants and summarize changes" | `claw-code-main/recipes/post-deploy-scan.yaml` | 3h |
| 15.9 | Add canary deploy support: deploy to 10% of traffic first, verify health, then promote to 100% | `push-ci.dev/internal/deploy/canary.go` | 6h |
| 15.10 | Integration tests: full deploy → verify → notify → ticket creation flow | `push-ci.dev/tests/integration/post_deploy_test.go` | 6h |
| 15.11 | Unit tests for verification agent and regression detector | Tests in respective packages | 4h |

### Acceptance Criteria
- [ ] Every TenantIQ deploy triggers automated health check
- [ ] CIS score regression detected and alerted (score decrease > 5%)
- [ ] Deploy failure auto-creates PSA ticket in connected ConnectWise/Datto
- [ ] Self-test endpoint verifies DB, KV, auth, and Graph API connectivity
- [ ] Canary deploy with automatic promotion/rollback
- [ ] Deploy status visible in TenantIQ settings page

---

## Sprint 16 — Unified Agent Platform

**Dates**: May 19–30, 2026
**Theme**: Shared Rust runtime for persistent AI agent sessions across all 3 projects

### Why
Both claw-code and PushCI have agent-platform scaffolding (`agent-platform/crates/`). Unifying them into a single multi-tenant runtime enables: persistent sessions, shared tool registry, cross-project orchestration ("deploy TenantIQ, then scan all tenants, then create PSA tickets for failures").

### Tasks

#### Week 1 — Unified Tool Registry

| # | Task | File(s) | Est |
|---|------|---------|-----|
| 16.1 | Merge claw-code and PushCI tool definitions into unified registry: TenantIQ (15) + PushCI (6) + claw-code built-ins | `agent-platform/crates/tools/src/registry.rs` | 6h |
| 16.2 | Implement tool namespacing: `tenantiq.*`, `pushci.*`, `claw.*` prefixes for conflict-free resolution | `agent-platform/crates/tools/src/namespace.rs` | 4h |
| 16.3 | Create tool permission model: read-only, workspace-write, dangerous per tool, per session | `agent-platform/crates/tools/src/permissions.rs` | 5h |
| 16.4 | Build tool execution router: dispatch `tenantiq.*` to TenantIQ MCP, `pushci.*` to PushCI MCP | `agent-platform/crates/runtime/src/router.rs` | 6h |
| 16.5 | Implement session persistence: store sessions in D1/Postgres with message history | `agent-platform/crates/runtime/src/persistence.rs` | 6h |

#### Week 2 — Cross-Project Orchestration

| # | Task | File(s) | Est |
|---|------|---------|-----|
| 16.6 | Build orchestration engine: execute multi-tool workflows (deploy → scan → ticket) as atomic transactions | `agent-platform/crates/runtime/src/orchestration.rs` | 8h |
| 16.7 | Create SSE event stream: real-time agent events (tool calls, results, text) to frontend | `agent-platform/crates/server/src/sse.rs` | 5h |
| 16.8 | Build agent chat UI in TenantIQ: connect to agent-platform SSE, display conversation with tool call results | `tenantiq/apps/web/src/routes/ai/agent/+page.svelte` | 6h |
| 16.9 | Create pre-built agent recipes: "MSP morning check", "new tenant onboarding", "incident response" | `agent-platform/recipes/` | 4h |
| 16.10 | Integration test: unified agent session using tools from all 3 projects | `agent-platform/tests/integration/` | 5h |
| 16.11 | Documentation: agent platform architecture, tool catalog, recipe format | `agent-platform/docs/` | 3h |

### Acceptance Criteria
- [ ] Unified tool registry with 36+ tools (15 TenantIQ + 6 PushCI + 15 claw-code)
- [ ] Tool namespacing prevents conflicts
- [ ] Session persistence across reconnects
- [ ] Cross-project orchestration: single command executes tools from multiple projects
- [ ] SSE event streaming to TenantIQ frontend
- [ ] Agent chat UI operational with conversation history
- [ ] 3+ pre-built recipes for common MSP workflows

---

## Sprint 17 — Self-Healing CI for TenantIQ

**Dates**: June 2–13, 2026
**Theme**: PushCI's healer with TenantIQ-specific fix strategies

### Why
PushCI has 7 built-in healing strategies + AI fallback. TenantIQ has domain-specific failure patterns (D1 migration failures, Graph API token expiry, Wrangler binding mismatch). Custom strategies can auto-fix 80% of TenantIQ CI failures without human intervention.

### Tasks

#### Week 1 — TenantIQ-Specific Heal Strategies

| # | Task | File(s) | Est |
|---|------|---------|-----|
| 17.1 | Create D1 migration healer: detect "table already exists" or "column missing" → auto-generate migration fix | `push-ci.dev/internal/heal/strategies_d1.go` | 6h |
| 17.2 | Create Wrangler binding healer: detect missing bindings in wrangler.toml → suggest additions from code imports | `push-ci.dev/internal/heal/strategies_wrangler.go` | 5h |
| 17.3 | Create Graph API token healer: detect 401 in tests → refresh token from KV or suggest re-auth | `push-ci.dev/internal/heal/strategies_graph.go` | 4h |
| 17.4 | Create file-size healer: detect files >200 lines → suggest split points using AST analysis | `push-ci.dev/internal/heal/strategies_filesize.go` | 6h |
| 17.5 | Create TypeScript error healer: parse `tsc --noEmit` output → apply targeted fixes (missing types, wrong imports) | `push-ci.dev/internal/heal/strategies_typescript.go` | 6h |

#### Week 2 — Auto-Fix PRs + Testing

| # | Task | File(s) | Est |
|---|------|---------|-----|
| 17.6 | Implement auto-fix PR creation: when healer fixes issues, create PR with fix + explanation | `push-ci.dev/internal/autofix/pr.go` | 6h |
| 17.7 | Add heal history tracking: log each heal attempt, success rate, time saved | `push-ci.dev/internal/heal/history.go` | 4h |
| 17.8 | Create heal dashboard in TenantIQ: show recent auto-fixes, success rate, time saved chart | `tenantiq/apps/web/src/routes/settings/ci-health/+page.svelte` | 5h |
| 17.9 | Wire claw-code for heal investigation: when AI heal fails, escalate to claw-code agent for deeper diagnosis | `push-ci.dev/internal/heal/escalate.go` | 5h |
| 17.10 | Unit tests for all 5 TenantIQ-specific strategies | `push-ci.dev/internal/heal/strategies_*_test.go` | 6h |
| 17.11 | Integration test: introduce known failures → healer detects → fixes → reruns successfully | `push-ci.dev/tests/integration/heal_test.go` | 5h |

### Acceptance Criteria
- [ ] 5 TenantIQ-specific heal strategies operational
- [ ] D1 migration failures auto-fixed in 90%+ cases
- [ ] File-size violations auto-detected with suggested split points
- [ ] TypeScript errors auto-fixed for common patterns (missing imports, type mismatches)
- [ ] Auto-fix PRs created with clear description of what was fixed
- [ ] Heal escalation to claw-code agent when built-in fixes fail
- [ ] Heal dashboard shows success rate and time saved

---

## Sprint 18 — NLP Orchestration + Unified Dashboard

**Dates**: June 16–27, 2026
**Theme**: Natural language commands across all 3 systems + unified operations dashboard

### Why
PushCI has NLP interpretation (pattern matching + Claude AI fallback). Claw-code has conversational sessions. TenantIQ has an AI chat. Unifying these into a single NLP layer lets MSP admins say: "Deploy TenantIQ, scan all tenants for compliance, and send a report to the team" — and have it execute across all 3 systems.

### Tasks

#### Week 1 — Unified NLP Layer

| # | Task | File(s) | Est |
|---|------|---------|-----|
| 18.1 | Extend PushCI NLP patterns for TenantIQ: "scan tenants", "check compliance", "sync PSA", "backup exchange" | `push-ci.dev/internal/nlp/patterns_tenantiq.go` | 5h |
| 18.2 | Create unified action router: NLP interprets intent → routes to correct system (PushCI, TenantIQ, or claw-code) | `push-ci.dev/internal/nlp/router.go` | 6h |
| 18.3 | Build compound command support: "deploy and scan" → sequential execution of deploy + CIS scan | `push-ci.dev/internal/nlp/compound.go` | 5h |
| 18.4 | Add context awareness: NLP knows current tenant, last deploy status, recent alerts → informs responses | `push-ci.dev/internal/nlp/context.go` | 5h |
| 18.5 | Create MCP tool for NLP: `pushci.ask` accepts natural language, returns structured result | `push-ci.dev/internal/mcp/tools_nlp.go` | 3h |

#### Week 2 — Unified Dashboard

| # | Task | File(s) | Est |
|---|------|---------|-----|
| 18.6 | Build operations dashboard: combined view of TenantIQ health, PushCI pipeline status, agent sessions | `tenantiq/apps/web/src/routes/platform/operations/+page.svelte` | 8h |
| 18.7 | Add real-time updates: SSE from agent platform → live dashboard updates | `tenantiq/apps/web/src/lib/stores/operations.ts` | 4h |
| 18.8 | Create unified search: search across tenants, alerts, CIS controls, deploy history, agent conversations | `tenantiq/apps/api/src/routes/unified-search.ts` | 6h |
| 18.9 | Build NLP command bar: type natural language commands from any TenantIQ page (Cmd+K) | `tenantiq/apps/web/src/lib/components/ui/CommandBar.svelte` | 6h |
| 18.10 | Integration tests: NLP commands across all 3 systems | Tests in respective packages | 5h |
| 18.11 | Final regression test: full pipeline from NLP → deploy → scan → ticket → notify | Full stack test | 5h |

### Acceptance Criteria
- [ ] NLP understands commands for all 3 systems
- [ ] Compound commands execute sequentially across systems
- [ ] Context-aware responses (knows current tenant, deploy status)
- [ ] Operations dashboard shows health across all 3 platforms
- [ ] Cmd+K command bar on every TenantIQ page
- [ ] Unified search across all data sources
- [ ] Full end-to-end pipeline tested: NLP → deploy → scan → ticket → notify

---

## Resource Estimates Summary

| Sprint | Theme | Dev Hours | New Files (est.) | New Tests (est.) |
|--------|-------|-----------|------------------|------------------|
| Sprint 13 | PushCI → TenantIQ Deploy | ~48h | ~12 | ~25 |
| Sprint 14 | Claw-Code MCP Bridge | ~47h | ~18 | ~30 |
| Sprint 15 | Post-Deploy Automation | ~47h | ~14 | ~25 |
| Sprint 16 | Unified Agent Platform | ~48h | ~15 | ~20 |
| Sprint 17 | Self-Healing CI | ~47h | ~14 | ~30 |
| Sprint 18 | NLP Orchestration | ~48h | ~12 | ~25 |
| **Total** | | **~285h** | **~85 files** | **~155 tests** |

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| MCP protocol version mismatch between claw-code and PushCI | Integration blocked | Medium | Pin protocol version 2024-11-05, test compatibility early |
| Rust agent-platform build time slows iteration | Sprint velocity | Medium | Use cargo workspace incremental builds, test with release-opt |
| Cross-project auth token exchange security | Data breach | Low | Use short-lived JWTs with scoped permissions per tool |
| NLP misinterpretation executes wrong action | Data loss | Medium | Require confirmation for destructive actions (deploy, archive) |
| Agent session persistence data growth | Storage costs | Low | TTL on sessions (7 days), compress message history |
| TenantIQ API rate limits under automated scanning | Scan failures | Medium | Implement backoff in MCP server, queue scan requests |

---

## Definition of Done (All Sprints)

- [ ] All tasks completed and merged
- [ ] Unit test coverage ≥ 90% on new code
- [ ] No file exceeds 200 lines (source files)
- [ ] Cross-project integration tests passing
- [ ] MCP protocol compliance verified
- [ ] Security review: auth token exchange, tool permissions, data isolation
- [ ] Documentation updated for each integration point

---

## Post-Sprint 18: What's Next

- **Multi-cloud agent**: Extend agent platform to manage AWS/GCP alongside M365
- **Marketplace for agent recipes**: Community-contributed automation recipes
- **Voice interface**: Claw-code voice support for hands-free MSP operations
- **SOC integration**: Agent escalates to Sentinel/Splunk/PagerDuty
- **White-label agent**: MSPs rebrand the agent chat for their customers
