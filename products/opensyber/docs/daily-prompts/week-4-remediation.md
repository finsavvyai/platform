# Week 4 — Remediation (Days 16–21)

**Track A:** Sprint 17 — Remediation Engine (Days 18-21)
**Track A (Days 16-17):** Continues from Sprint 16 polish + Sprint 17 schema
**Target:** Milestone C (AI + Remediation) — unlocks Track D

---

## Day 16 — Sprint 16 Polish + Sprint 17 Schema

### Vision
By end of this week, the platform will autonomously remediate misconfigurations.
An engineer will get a Slack alert, click "Approve", and watch OpenSyber
quarantine a misconfigured resource, rotate its credentials, file a Jira ticket,
and generate a regression test — all without touching a terminal.

This is the product's core value proposition differentiated from CyberArk
(manual processes) and Wiz (scan-only, no remediation).

---

### Track A — Day 16: Sprint 16 Final Polish + Sprint 17 Schema Prep

```
SYSTEM CONTEXT: Sprint 16 AI Intelligence is functionally complete.
Today polish the AI layer and pre-build Sprint 17 schema.
Read: docs/sprints/sprint-17-remediation-engine.md

DESIGN PATTERN: Saga (remediation is a multi-step, compensable workflow)
FILE BUDGET: ≤ 200 lines

TASK A1 — AI Intel Polish: LLM response caching (80 lines max):
Create apps/api/src/services/ai/analysis-cache.ts
- Pattern: Decorator
- cacheAnalysis(entityId, analysis): store in KV with 24h TTL
- getCachedAnalysis(entityId): return if fresh, null if stale
- Apply to ThreatTriageService: check cache before calling LLM

TASK A2 — Remediation schema:
Add to packages/db/src/schema/security.ts:
  playbooks: id, orgId, name, description, triggerCondition TEXT (JSON),
    steps TEXT (JSON array of PlaybookStep), enabled, createdBy, createdAt
  remediation_runs: id, orgId, playbookId, findingId, status
    (pending/approved/running/completed/failed/rolled_back),
    approvedBy, approvedAt, completedAt, failureReason, createdAt
  remediation_steps: id, runId, stepIndex, stepType, input TEXT, output TEXT,
    status, startedAt, completedAt, error

Generate migration: cd packages/db && pnpm db:generate

TASK A3 — PlaybookStep types (80 lines max):
Create packages/shared/src/types/playbooks.ts
- PlaybookStep union type:
  | { type: 'quarantine_resource', resourceId, provider }
  | { type: 'rotate_credential', secretId }
  | { type: 'send_alert', channel, message }
  | { type: 'create_jira_ticket', project, summary, description }
  | { type: 'execute_script', scriptId, params }
  | { type: 'human_approval', approverRole, timeoutHours }
  | { type: 'run_security_test', testFile }  ← qestro integration
  All steps: exhaustive union with 'never' fallback

TASK A4 — Tests for schema migrations + PlaybookStep Zod validators
```

---

## Day 17 — Playbook Engine Core (A)

### Track A — Sprint 17: PlaybookRunner + AutomationHub Bridge

```
CONTEXT: Schema ready. Today build the core playbook execution engine.
AutomationHub SOAR DAG is packaged and ready (Track C, Day 9).

DESIGN PATTERN: Saga + Command + Observer/Event
FILE BUDGET: ≤ 200 lines per file

OPEN SOURCE: AutomationHub NetworkX DAG engine (portfolio, Day 9 packaging).
Cloudflare Workflows for durability (CF persistent execution).
Do NOT build a DAG engine from scratch.

TASK A1 — PlaybookRunner (180 lines max):
Create apps/api/src/services/remediation/playbook-runner.ts
- Pattern: Saga + Command
- run(playbookId, findingId, context): creates RemediationRun, executes steps
- executeStep(step, runId): dispatch to correct handler per step.type
  (use exhaustive switch → never pattern)
- onStepComplete(step, result): update remediation_steps, continue/abort
- onFailure(step, error): rollback + log, set run status=failed
- CF Workflow binding: wrap entire run in Cloudflare Workflow for durability

TASK A2 — Step Handlers (split into separate files, ≤ 100 lines each):
Create apps/api/src/services/remediation/steps/quarantine-handler.ts
  - quarantine via cloud provider API (AWS: revoke SG rules, GCP: IAM deny)
Create apps/api/src/services/remediation/steps/rotate-handler.ts
  - delegates to RotationService from Sprint 12
Create apps/api/src/services/remediation/steps/alert-handler.ts
  - delegates to Resend + Slack webhook
Create apps/api/src/services/remediation/steps/jira-handler.ts
  - POST to Jira Cloud REST API: create issue with finding context
Create apps/api/src/services/remediation/steps/approval-handler.ts
  - pause execution, emit human_approval_required event
  - resume when POST /api/v1/remediation/runs/:id/approve is called

TASK A3 — AutomationHub SOAR bridge (80 lines max):
Create apps/api/src/services/remediation/automationhub-bridge.ts
- Pattern: Adapter
- executePlaybook(playbookId, context):
  - Converts OpenSyber playbook to AutomationHub DAG format
  - Runs via automationhub-soar skill SkillRunner
  - Maps AutomationHub result back to OpenSyber run status

TASK A4 — Tests: PlaybookRunner with mock step handlers, rollback scenarios

SECURITY AUDIT:
[ ] Human approval step cannot be bypassed (requires actorId in approve call)
[ ] Quarantine actions logged with resource + actorId + timestamp
[ ] Jira tickets don't include raw credentials or vault data
[ ] Rate limit on remediation triggers (max 20/hour per org)
```

---

## Day 18 — Remediation API + Approval UI (A)

### Track A — Sprint 17: Remediation Routes + Frontend

```
DESIGN PATTERN: Command + Observer (approval triggers run resume)
FILE BUDGET: ≤ 200 lines

TASK A1 — Remediation API (120 lines max):
Create apps/api/src/routes/remediation/runs.ts
- POST /api/v1/remediation/trigger — trigger playbook for a finding
  - requirePermission('remediation.run.write')
  - Validate: findingId exists + belongs to org, playbookId enabled
  - Return: { runId, status: 'pending' or 'awaiting_approval' }
- GET /api/v1/remediation/runs — list runs (cursor paginated)
- GET /api/v1/remediation/runs/:id — run detail with steps
- POST /api/v1/remediation/runs/:id/approve — approve pending run
  - requirePermission('remediation.run.approve')
  - Audit: recordAuditEvent({ action: 'remediation.approved', actorId, runId })

TASK A2 — Playbook Management API (80 lines max):
Create apps/api/src/routes/remediation/playbooks.ts
- GET /api/v1/remediation/playbooks — list org playbooks
- POST /api/v1/remediation/playbooks — create playbook
  - Validate steps array with PlaybookStep Zod schema
- PUT /api/v1/remediation/playbooks/:id — update
- DELETE /api/v1/remediation/playbooks/:id

TASK A3 — Remediation Dashboard Page (180 lines max):
Create apps/web/src/app/(dashboard)/security/remediation/page.tsx
- Server Component: active runs + recent history
- Run status indicator: pending (gray) / running (blue) / success (green) / failed (red)
- "Approve" button on pending runs (calls approve API with optimistic update)
- Timeline view: each step with start/end time + status

TASK A4 — Tests: approval flow end-to-end, permission enforcement
```

---

## Day 19 — Playbook Templates + qestro Loop (A)

### Track A — Sprint 17: Seed Playbooks + QeStro Security Test Loop

```
DESIGN PATTERN: Factory (seed data as typed objects, not raw SQL)
FILE BUDGET: ≤ 200 lines

TASK A1 — Built-in playbook seed (120 lines max):
Create apps/api/src/db/seeds/playbooks.ts
- Seed 5 default playbooks for new orgs:
  1. "Critical Finding Fast Response" — alert + quarantine + create_jira
  2. "Credential Rotation on Expiry" — rotate_credential + send_alert
  3. "SaaS Policy Violation" — alert + create_jira + human_approval
  4. "CI/CD Security Gate Breach" — alert + quarantine_pipeline + notify_team
  5. "Attack Path Detected" — alert + human_approval + quarantine_resource

TASK A2 — QeStro regression test step:
Add to PlaybookRunner: after completed remediation step, if qestro skill installed:
  - Call qestro.generate_security_test(finding)
  - Store generated test in ai_analyses with type='regression_test'
  - Include test in run completion report

This closes the loop: Detect → Triage (AI) → Remediate (playbook) → Verify (qestro).
No human writes a test — it's generated automatically.

TASK A3 — Remediation run report email (80 lines max):
Create apps/api/src/services/remediation/run-reporter.ts
- On run completion: send email via Resend
- Include: finding summary, steps executed, time taken, next recommendations
- Template: clean minimal HTML matching TokenForge email style

TASK A4 — Tests: seed playbook structure, qestro loop mock
```

---

## Day 20 — Sprint 17 Complete + Pre-Milestone C Gate (A)

### Track A — Sprint 17 Final: Integration Tests + DoD

```
CONTEXT: All remediation components are built. Today is integration testing day.
Run the full remediation flow end-to-end with mocks before declaring complete.

TASK A1 — Remediation E2E integration test:
Create apps/api/src/test/integration/remediation-flow.test.ts
- Scenario 1: Critical AWS finding → auto-trigger playbook → quarantine → Jira ticket
- Scenario 2: SaaS finding → human approval required → approve → alert sent
- Scenario 3: Credential expiry → rotate → email notification
- Scenario 4: Playbook step failure → rollback → failure report sent
- Use mock step handlers (no real cloud calls in CI)

TASK A2 — Permission boundary tests:
- viewer cannot trigger remediation (403)
- developer cannot approve (403, requires security+ role)
- admin can create/delete playbooks
- Cross-org remediation is impossible (404 on findingId from other org)

TASK A3 — Sprint 17 DoD: read sprint-17-remediation-engine.md, mark all done.

TASK A4 — File budget sweep:
find apps packages/shared/src packages/db/src -name "*.ts" \
  -not -name "*.test.ts" | xargs wc -l | awk '$1>200{print "OVER:",$0}'
Fix any violations before marking done.
```

---

## Day 21 — Milestone C Achievement Gate

### Milestone C Verification

```
SYSTEM CONTEXT: This is Milestone C — "AI + Remediation" complete.
All of Track D (Marketplace + SOAR) is now unblocked.

Run the complete system health check:

TASK 1 — Full test suite:
pnpm typecheck && pnpm test --coverage && pnpm build

TASK 2 — Coverage gates:
# apps/api/src/services/ai/ → ≥ 80% lines + branches
# apps/api/src/services/remediation/ → ≥ 80% lines + branches
# packages/skills/ → each skill ≥ 80% lines
# packages/tokenforge/ → ≥ 90% lines (stricter requirement)

TASK 3 — Security audit sweep (full):
[ ] All new API routes: auth before DB access
[ ] All AI prompts: no PII, no credentials, no vault data
[ ] All remediation actions: audit logged with actorId
[ ] All Step handlers: input validated with Zod
[ ] No console.log with sensitive data in any new file
[ ] pnpm audit --audit-level=high → 0 unresolved High/Critical

TASK 4 — Milestone C feature verification:
[ ] Can trigger a playbook for a critical finding?
[ ] Does human_approval step pause execution?
[ ] Does approving a run resume and complete it?
[ ] Does a failed step trigger rollback?
[ ] Are qestro regression tests generated after completion?
[ ] Is a run report email sent on completion?

TASK 5 — Unblock Track D:
Create GitHub issue: "Sprint 19 Marketplace — unblocked by Milestone C"
Sprint 19 can now start in parallel with Sprint 20 (Track A continues).

echo "MILESTONE C ACHIEVED. Day 21/35."
echo "AI Intelligence ✓ + Remediation Engine ✓"
echo "Track D UNBLOCKED: Sprint 19 Marketplace + Sprint 21 SOAR can start."
```

---

### Week 4 Retrospective

```
Sprints completed this week: Sprint 17 (Remediation Engine)
Milestones: C achieved (AI + Remediation)

Platform capability unlocked:
- Automated remediation with human-in-the-loop approval
- AI threat triage + natural language security queries
- qestro regression test generation (detect → fix → verify loop)
- Jira integration (built-in, no new sprint needed)
- AutomationHub SOAR as underlying execution engine

Track D now starts:
- Developer 1 continues: Sprint 20 (Enterprise Exit / SOC2)
- Developer 1 (after Day 26): Sprint 22 (Platform Data)
- Track D parallel: Sprint 19 (Marketplace), Sprint 21 (Platform Connect)

Days remaining: 35 - 21 = 14 days to complete the full platform.
```
