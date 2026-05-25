> **HISTORICAL:** This sprint doc reflects technology choices at time of writing. Auth migrated from Clerk to Auth.js (March 2026). Compute migrated from Fly.io to Hetzner Cloud. Pricing tiers updated. See `CLAUDE.md` for current stack.

# Sprint 21: OpenSyber Connect — Security Automation Platform (2 weeks)

## Goal
Transform OpenSyber from a security dashboard into a security automation
platform. Customers wire any security event into any downstream action using
pre-built trigger/action pairs — without code, without Zapier, without waiting
for a native integration.

## Dependencies
- Sprint 17 complete (remediation engine provides action primitives)
- Sprint 19 complete (webhooks provide event emission)
- Sprint 16 complete (AI can suggest automation rules)

## Competitive Target
- **Differentiator:** No security platform has native no-code automation
- Adjacent: Tines, Torq, Swimlane (pure SOAR) — OpenSyber embeds this in the product
- Eliminates the "does it integrate with X?" enterprise objection permanently

---

## ⚡ MVP PATH (4 days) — Pre-built trigger/action pairs

### MVP.1 — Automation Schema (Day 1)

```sql
CREATE TABLE automation_rules (
  id TEXT PRIMARY KEY,
  orgId TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  isActive INTEGER DEFAULT 1,
  trigger TEXT NOT NULL,         -- JSON: { event, conditions }
  actions TEXT NOT NULL,         -- JSON array of AutomationAction
  runCount INTEGER DEFAULT 0,
  lastRunAt TEXT,
  createdAt TEXT NOT NULL
);

CREATE TABLE automation_runs (
  id TEXT PRIMARY KEY,
  ruleId TEXT NOT NULL REFERENCES automation_rules(id),
  orgId TEXT NOT NULL,
  triggeredBy TEXT NOT NULL,     -- event name that fired the rule
  triggerPayload TEXT,           -- JSON: the event payload
  status TEXT DEFAULT 'running', -- 'running' | 'success' | 'failed' | 'skipped'
  actionsCompleted INTEGER DEFAULT 0,
  actionsFailed INTEGER DEFAULT 0,
  output TEXT,                   -- JSON execution log per action
  startedAt TEXT NOT NULL,
  completedAt TEXT
);
```

- [ ] Create D1 migration `0021_automation.sql`
- [ ] Update Drizzle schema in `packages/db/src/schema/security.ts`

### MVP.2 — Automation Engine (Day 1–2)

- [ ] Create `apps/api/src/services/automation-engine.ts` (< 200 lines):

  ```typescript
  // Evaluates trigger conditions and dispatches actions
  export async function evaluateRule(rule: AutomationRule, event: SecurityEvent): Promise<boolean>
  export async function executeActions(rule: AutomationRule, ctx: EventContext): Promise<void>
  export async function runAutomationsForEvent(event: SecurityEvent, orgId: string): Promise<void>
  ```

- [ ] Hook into existing event emission points:
  - After `cspm_findings` insert → emit `finding.created` event
  - After risk score recompute → emit `risk_score.changed`
  - After attack path compute → emit `attack_path.detected`
  - After remediation complete → emit `remediation.completed`

- [ ] Built-in action types (first-party, no external API needed):
  - `create_jira_ticket` — Jira Cloud REST API
  - `send_slack_message` — reuse existing Slack notification channel
  - `send_email` — reuse existing email service
  - `create_pagerduty_incident` — reuse existing PagerDuty channel
  - `run_remediation_playbook` — invoke Sprint 17 playbook engine
  - `create_security_incident` — create in OpenSyber incidents table
  - `assign_to_team_member` — assign finding to user
  - `mute_finding` — auto-mute low-noise findings matching pattern

- [ ] Write tests with mock event payloads

### MVP.3 — Automation API Routes (Day 2–3)

- [ ] Create `apps/api/src/routes/automation.ts`:
  - `GET    /api/automation/rules` — list rules
  - `POST   /api/automation/rules` — create rule
  - `PATCH  /api/automation/rules/:id` — update rule
  - `DELETE /api/automation/rules/:id` — delete rule
  - `POST   /api/automation/rules/:id/test` — test with sample event
  - `GET    /api/automation/runs` — execution history
  - `GET    /api/automation/runs/:id` — single run detail + action log

- [ ] `requirePermission('automation.write')` on create/update/delete
- [ ] Write tests

### MVP.4 — Automation Dashboard (Day 3–4)

- [ ] Create `apps/web/src/app/dashboard/automation/page.tsx`:
  - Rules list with active/inactive toggle, run count, last triggered
  - "Create Rule" button
  - Recent runs feed
- [ ] Create `components/dashboard/automation/AutomationRuleBuilder.tsx`:
  - Step 1: Trigger picker (event type + condition filters)
  - Step 2: Action picker (action type + config)
  - Step 3: Name + save
  - Preview: "When X happens IF Y, then do Z"
- [ ] "Rule Templates" panel — pre-built common rules:
  - "Critical finding → PagerDuty incident"
  - "Risk score > 80 → Slack alert to #security"
  - "JIT requested → notify approvers via email"
  - "Compliance score drops → create Jira ticket"
  - "Remediation fails → escalate to owner"
- [ ] Add "Automation" to dashboard sidebar
- [ ] Write component tests

---

## 🔵 FULL PATH (10 days) — Full SOAR capability

Everything in MVP plus:

### FULL.1 — Advanced Trigger Conditions

- [ ] Multi-condition triggers (AND/OR logic builder):
  - "finding.created AND severity = CRITICAL AND provider = aws"
  - "risk_score.changed AND newScore > 80 AND oldScore < 80"
- [ ] Time-based triggers:
  - "Every Monday at 9am: summarize critical findings → Slack"
  - "If finding unresolved after 7 days → escalate"
- [ ] Rate limiting: max 1 trigger per rule per 15min (prevent alert storms)

### FULL.2 — External Action Integrations

- [ ] Jira: create ticket, add comment, transition issue, assign user
- [ ] ServiceNow: create incident, update CMDB record
- [ ] Microsoft Teams: send adaptive card, create channel message
- [ ] GitHub: create issue, add label, request review
- [ ] HTTP webhook: generic POST to any URL (for custom integrations)
- [ ] Zapier / Make webhook trigger: fire external automation

### FULL.3 — AI Rule Suggestions

- [ ] After every new rule run, AI evaluates: "Could this rule be smarter?"
- [ ] Proactive suggestions: "You have 47 critical S3 findings — add an auto-mute rule for `informational` severity?"
- [ ] "Rules used by similar organizations" — anonymized recommendations

### FULL.4 — Rule Marketplace

- [ ] Community-published automation rules (extends Sprint 19 marketplace)
- [ ] "Import rule template" — one-click from marketplace into org's rules
- [ ] Export rule as template — contribute back to community

### FULL.5 — Audit + Compliance

- [ ] Every automation action logged to audit trail (actor = 'automation_engine')
- [ ] SOC2 CC7.2 evidence: automated monitoring actions documented
- [ ] Rule change history: who created/edited/deleted each rule

### FULL.6 — Portfolio Skills for Sprint 21 (**do not build DAG engine from scratch**)

**AutomationHub SOAR Engine** — replaces hand-built automation execution:

- [ ] Follow [`skill-catalog.md`](../skills/skill-catalog.md) → `automationhub-soar` (P1, 2 days)
- [ ] Replace AutomationHub's internal event bus with OpenSyber `finding.created` webhook
- [ ] Map `automation_rules` trigger conditions → AutomationHub DAG entry points
- [ ] Replace AutomationHub's auth with OpenSyber gateway token (`X-Gateway-Token`)
- [ ] Write tests: 18% → 80% coverage (required before release)

**What you get for free** (85% real, 220 files, NetworkX DAG engine, `asyncio.gather()` parallel execution):

- Step dependency resolution (DAG) — already built ✓
- Parallel step execution — already built ✓
- Retry + failure handling — already built ✓
- **Only new work:** event bridge + tests = 2 days (vs 4 days building from scratch)

**Qestro Security Test Generator** — adds "generate regression test on finding" action:

- [ ] Follow [`skill-catalog.md`](../skills/skill-catalog.md) → `qestro-security-testing` (P2, 4 days)
- [ ] Wire `finding.created` event → Qestro test generator → open PR with test in target repo
- [ ] Add `generate_security_test` as action type in `automation_rules.actions`
- [ ] This closes the "detection → regression test" loop automatically

---

## Definition of Done

- [ ] Automation rules can be created and tested
- [ ] Minimum 8 action types working
- [ ] Rule templates available for 5 common use cases
- [ ] Execution history visible with per-action logs
- [ ] All new routes tested (>80% coverage)
- [ ] No regression on notification channels

## Estimated Effort

| Task | MVP Days | Full Days |
|---|---|---|
| Schema + migration | 0.5 | 0.5 |
| Automation engine | 1.5 | 3 |
| API routes | 0.5 | 1.5 |
| Rule builder UI | 1.5 | 3 |
| External integrations + AI suggestions | — | 2 |
| **Total** | **4** | **10** |
