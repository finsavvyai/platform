# How TenantIQ Works — for Security Leaders

*One page. No buzzwords. Read in five minutes.*

## What it is

TenantIQ is a **multi-tenant Microsoft 365 control plane** built for MSPs and large security teams managing many Azure AD tenants concurrently. It reads posture from every tenant via the Microsoft Graph API, runs autonomous agents over that posture, and lets a human approve or roll back any action.

It is **not** a Claude-in-Excel productivity tool. It's the layer above — multi-tenant scope, drift attribution, license-tier gating, cross-tenant rollups — that horizontal AI doesn't address.

## The five layers (top to bottom)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. UI / API surfaces                                         │
│    /agents · /leaderboard · /security/* · /msp/backups       │
│    /api/mcp · /api/mcp-public · /settings/mcp-clients        │
├─────────────────────────────────────────────────────────────┤
│ 2. Autonomous agents (cron-driven, scoped, opt-in)           │
│    autonomous-auditor · auto-fix-scanner · public-scan       │
│    narrated-scan · mcp-tool-call · auto-remediator           │
├─────────────────────────────────────────────────────────────┤
│ 3. Decision + safety primitives                              │
│    skill-gate · auto-fix recipes (source-pinned) · daily-cap │
│    severity-floor · dry-run mode · anomaly-watch · rollback  │
├─────────────────────────────────────────────────────────────┤
│ 4. Data model                                                │
│    34 D1 tables · agent_actions · config_snapshots           │
│    config_drifts · audit_logs · cis_scans · compliance_*     │
├─────────────────────────────────────────────────────────────┤
│ 5. Inputs                                                    │
│    Microsoft Graph API · DoH (Cloudflare 1.1.1.1) · webhooks │
│    External MCP servers (Microsoft, GitHub, Moody's, …)      │
└─────────────────────────────────────────────────────────────┘
```

## The agent loop (this is the only diagram that matters)

```
                ┌──────────────────────┐
                │  Microsoft Graph     │
                │  (real tenant data)  │
                └──────────┬───────────┘
                           │ pull every 15m–6h
                           ▼
                ┌──────────────────────┐
                │  config_snapshots    │
                │  config_drifts       │  ◄────────── audit_logs
                │  cis_control_results │
                └──────────┬───────────┘
                           │
              auto-fix-scanner cron (hourly)
                           │
                           ▼
                ┌──────────────────────┐
                │  Recipe match?       │ ── no ──→ stop
                │  Severity ≥ floor?   │
                │  Skill activated?    │
                │  Daily cap < 5?      │
                └──────────┬───────────┘
                           │ yes
                           ▼
                ┌──────────────────────┐
                │  Enqueue auto-fix    │
                │  message (dry-run    │
                │  unless tenant flag  │
                │  is "live")          │
                └──────────┬───────────┘
                           │
                           ▼
                ┌──────────────────────┐
                │  GET baseline        │  ── persist baseline
                │  PATCH apply (or     │
                │   skip in dry-run)   │
                │  Watch alerts 60s    │
                │  Rollback if anomaly │
                └──────────┬───────────┘
                           │
                           ▼
                ┌──────────────────────┐
                │  agent_actions row   │ ── DO publish ──→ /agents (live)
                │  (status: success /  │
                │   pending-approval / │
                │   rolled-back /      │
                │   failed / aborted)  │
                └──────────────────────┘
```

## Safety controls (every one of these is enforced server-side, none are UI-only)

| Control | Enforcement |
|---|---|
| **Dry-run by default** | Per-tenant KV flag `autofix:mode:<id>`; unset = dry-run. Admin must explicitly flip to `live`. |
| **Source-pinned recipes** | `lib/auto-fix-recipes.ts` is code, not DB. Adding a recipe is a PR, not a runtime change. v1 ships only 2 recipes. |
| **Severity floor per recipe** | Each recipe declares the minimum drift severity it acts on. Lower-severity drifts are skipped. |
| **Daily cap per tenant** | KV counter, default 5 auto-fix enqueues per tenant per 24h. |
| **Skill gate** | Auto-remediator only fires for tenants whose org has the `auto-remediator` skill activated. |
| **Anomaly rollback** | After applying, watch the audit log for 60s; if critical/high alerts spike to ≥3× the prior-hour baseline, automatic Graph rollback to captured baseline. |
| **Approval queue** | Dry-run actions log `status: pending-approval` with the full plan + baseline. UI surfaces Approve / Abort buttons; Approve re-enqueues live, Abort closes the loop. |
| **Append-only audit** | Approve and Abort write *new* `agent_actions` rows linked to the parent via `metadata.parentId`. The original row stays as-is. Tamper-evident. |
| **Per-action MFA-equivalent** | All write tools (acknowledge_alert, acknowledge_drift, apply_skill_template, approve, abort) require admin / tenant_admin role server-side. JWT claim only — never client-trusted. |
| **Account-deletion cascade** | GDPR Art. 17 / M365 Cert C7. 33 tables, drift-resistant contract test fails CI on missed table. |

## Trust boundaries

| Boundary | Mechanism |
|---|---|
| Browser ↔ API | HttpOnly cookie (`tenantiq_session`) + JWT (HS256/RS256, iss + aud + jti revocation) |
| API ↔ Microsoft Graph | Per-tenant OAuth refresh token, encrypted at rest in D1 |
| API ↔ external MCP server | Opt-in per org, Bearer token stored encrypted, 25-server cap, every call logged |
| Agents ↔ tenant data | Org-scoped via JWT `orgId` claim, double-checked at SQL layer (`WHERE org_id = ?`) |
| Public no-auth scan | DoH only — never reads any TenantIQ-managed data, never logs PII |

## Compliance & evidence

- **CIS Microsoft 365 Foundations Benchmark v3.1** — 121 controls, L1/L2 tagged, 31+ wired to live Graph evaluation, per-tenant override engine for risk-acceptance
- **SOC 2 Type II controls** — CC6.1 / CC6.2 / CC7.2 / CC8.1 evaluated per tenant
- **HIPAA Security Rule** — 164.312 a–e
- **GDPR** — Art. 5.1 / 17 / 25 / 32 / 33
- **ISO 27001:2022 Annex A** — 25 telemetry-evaluable controls + honest disclosure of 68 organisational controls (we don't pretend to evaluate organisational evidence)
- **M365 Publisher Attestation** — ~85% complete; cascade-contract test pinned at 33 tables

## Where AI is and isn't used

| Used | Not used |
|---|---|
| Per-finding plain-English explainer (Claude w/ tenant context) | Decision to apply or revert (deterministic recipes only) |
| Compliance gap narration | Anomaly threshold (statistical, not ML) |
| Multi-agent debate (Conservative vs Pragmatic personas, opt-in) | Severity classification (deterministic CIS spec) |
| Autonomous email drafting in the auditor cron | Auto-onboarding tenants without human approval |

**No agent ever decides to mutate Graph state.** Mutations are gated by source-pinned recipes + daily cap + dry-run default + skill activation + admin role + anomaly-watch rollback. AI narrates; deterministic code acts.

## Comparison frame

| | Claude / Copilot in M365 | Optimize365 | Native Microsoft Defender | TenantIQ |
|---|---|---|---|---|
| AI inside one customer's M365 | ✓ | — | partial | partial (we use it for explainers) |
| Multi-tenant scope (N customer Azure tenants) | — | partial | — | ✓ |
| Per-tenant CIS overrides w/ audit | — | — | — | ✓ |
| Drift attribution to actor | — | — | partial | ✓ |
| License-tier upsell on remediation block | — | — | — | ✓ |
| Cross-tenant rollups (backup / posture / alerts) | — | — | — | ✓ |
| Autonomous agents w/ rollback | — | — | partial | ✓ |
| MCP server (own + composer of others) | — | — | — | ✓ |
| Source-pinned safety controls | — | — | — | ✓ |
