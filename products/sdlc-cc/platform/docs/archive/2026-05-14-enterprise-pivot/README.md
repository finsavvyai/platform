# Archived: Enterprise / Compliance Positioning (through 2026-05-14)

This directory holds documents from the sdlc-platform's earlier
positioning as an **enterprise compliance LLM gateway** (SOC 2 Type II,
HIPAA, FINRA, EU AI Act) sold to CISO buyers at $5K-$15K/month.

That direction was abandoned on **2026-05-14** after a market re-audit
established three things:

1. The "compliance LLM gateway" space is now crowded and commoditizing
   (LiteLLM, Portkey, Cloudflare AI Gateway, Bedrock Guardrails,
   Cisco AI Defense/Lakera, etc.).
2. The Anthropic 2026-05-05 financial-services launch (FIS partnership,
   Blackstone/Goldman JV, prebuilt AML agent, Opus 4.7) made the FSI
   angle a headwind: banks now buy direct from Anthropic+FIS rather
   than through a middleware gateway.
3. The enterprise positioning required ~$30-100K of audit/legal spend
   (SOC 2, ISO 42001, content review) that the project does not have
   budget for.

The current direction (see `../../ROADMAP.md` and
`../../PIVOT-2026-05-14.md`) is a bootstrap play:

- **Path 4 — MCP server / Claude App**: repackage the gateway as an
  MCP server for Claude.ai / Cursor / Cline users.
- **Path 5 — Cost-ops microSaaS**: spend tracking + budget caps as a
  $19/month tool.
- **Path 6 — AMLIQ component port**: port `audit`, `RBAC`, `DLP`, and
  `spend` packages into the aegis monorepo as AMLIQ building blocks.

Nothing in this directory is being actively maintained. It is kept
for git history, for re-orientation if the market shifts, and so the
"what used to live where" question has a clear answer.

## What's here

| File / Dir | What it documented |
|---|---|
| `INTEGRATION-DEBT.md` | Primitive-vs-integrated audit of Phase 1+2 gateway work |
| `NEXT-SESSION-PLAN.md` | Bucket A-F plan for closing integration debt |
| `PIVOT-DECISION.md` | Earlier (2026-05-02) pivot doc — fold into AMLIQ |
| `PORTFOLIO_AI_PLAN.md` | Full AI architecture plan with sdlc.cc as central gateway |
| `PRODUCTION-READINESS.md` + `PRODUCTION_READINESS_DAYS_5-10.md` + `PRODUCTION_SCOPE_AND_CHECKS.md` | Enterprise GA readiness checklists |
| `ENTERPRISE_READINESS.md` | Enterprise-customer readiness scorecard |
| `LEVERAGE_ANTHROPIC_FSI.md` | Strategy doc to leverage the Anthropic FSI announcement |
| `IMPLEMENTATION_PLAN.md` + `SPRINTS_PLAN.md` + `PRODUCT_ENHANCEMENT_PLAN.md` + `PLAN-FULL-COVERAGE.md` | Enterprise-build sprint plans |
| `CLAUDE-TEAM-DROP-IN-GAPS.md` | Spike for productizing as a Claude Team PII gateway |
| `competitive-analysis.md` + `competitive-moves-plan.md` | Competitor mapping for enterprise positioning |
| `compliance-insights-design.md` | Compliance dashboard design |
| `compliance-soc2/` | SOC 2 Type II evidence index + runbook |
| `COVERAGE-GAP.md` | Test-coverage gap analysis tied to enterprise quality bar |
| `DEPLOYMENT_STATUS.md` | Enterprise-deployment status snapshot |
| `SECRET_SCAN_AND_DEPENDENCIES.md` | Enterprise-quality scan checklist |
| `VISION.md` | Old "enterprise zero-trust RAG platform" vision |
| `roadmap/` | 90-day enterprise plan (Phases 0-4: stabilize → release-blockers → enterprise-parity → HIPAA → SOC 2 launch) |
| `SDLP_INTEGRATION.md` | sdlc-platform integration plan |
| `planning-production-readiness/` | Production-readiness planning artifacts |

## If you came here from a stale link

The active surface is back at the repo root:

- `README.md`, `CLAUDE.md`, `STATUS.md`, `SUNSET.md`
- `ROADMAP.md` — current direction (paths 4 + 5 + 6)
- `docs/PIVOT-2026-05-14.md` — the decision record for this archive
