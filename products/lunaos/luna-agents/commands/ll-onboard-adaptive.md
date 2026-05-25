---
name: ll-onboard-adaptive
displayName: Luna Adaptive Onboarding
description: Build an adaptive, persona-driven onboarding flow — asks platform-usage questions, infers persona, generates dynamic step sequence, scaffolds backend (Hono/D1) and frontend (Next.js dashboard)
version: 1.0.0
category: product
agent: luna-onboard-adaptive
parameters:
  - name: mode
    type: string
    description: "Mode: scaffold (generate backend+frontend), revisit (audit + redesign existing flow), simulate (run Q&A against personas), preview (render flow JSON)"
    required: true
    prompt: true
    default: scaffold
  - name: target
    type: string
    description: "Target product surface: dashboard | studio | mobile | all"
    required: false
    default: dashboard
  - name: persona_count
    type: number
    description: "Number of personas to derive (3-6 recommended)"
    required: false
    default: 4
workflow:
  - load_personas_or_derive
  - design_question_bank
  - design_branching_state_machine
  - scaffold_backend_routes
  - scaffold_backend_schema
  - scaffold_frontend_wizard
  - scaffold_telemetry
  - write_tests
  - emit_report
output:
  - .luna/{current-project}/onboarding/flow.json
  - .luna/{current-project}/onboarding/personas.md
  - .luna/{current-project}/onboarding/questions.md
  - .luna/{current-project}/onboarding/report.md
  - lunaos-engine/src/routes/onboarding.ts
  - lunaos-engine/prisma/migrations/onboarding.sql
  - lunaos-dashboard/src/app/onboarding/page.tsx
  - lunaos-dashboard/src/components/onboarding/*.tsx
prerequisites:
  - source_code
  - .luna/{current-project}/personas/personas.md (optional, will derive if missing)
mcp_servers:
  - sequential-thinking
  - memory
  - git
---

# /ll-onboard-adaptive — Onboarding That Reshapes Itself Per User

Most onboarding is a fixed funnel. This one is a branching state machine. It asks the user 3–6 short questions about how they plan to use the platform, classifies them into a persona, and then surfaces only the screens, tooltips, and seeded data that persona actually needs. No dead clicks, no skipped tutorials.

## What This Skill Builds

```
USER LANDS → Q1: role? (dev / ops / pm / founder)
              │
              ├─ dev → Q2: workflow style? (visual / CLI / API)
              │         ├─ CLI → seed: api key + sample workflow + docs link
              │         └─ visual → seed: studio template + first node tour
              │
              ├─ ops → Q2: primary intent? (monitor / schedule / alert)
              │         └─ seed: dashboards + alert webhook + cron sample
              │
              ├─ pm  → Q2: team size? → seed: invites + RBAC roles
              │
              └─ founder → Q2: stage? → seed: billing tour + usage caps view
```

Each persona path produces:
- a **flow.json** state machine (nodes, edges, side-effects)
- a **backend** that persists answers, computes persona, and serves the next step
- a **frontend wizard** that renders the next step and updates without page reload

## Modes

### scaffold (default)
Generates backend routes + D1 migration + Next.js wizard component + persona classifier.

### revisit
Reads the existing onboarding (any of: `lunaos-dashboard/src/app/onboarding/**`, `*/Onboarding*.tsx`, `*/welcome/**`), produces a diff report, then proposes the adaptive rewrite. Does not overwrite without confirmation.

### simulate
Runs each derived persona through the Q&A in-memory. Reports drop-off risk per node, time-to-aha estimate, and any branch that terminates without a seeded action.

### preview
Emits only `flow.json` + a rendered diagram (mermaid). No code changes.

## Backend Contract

Routes mounted under `/v1/onboarding` in `lunaos-engine`:

| Method | Path                     | Purpose                                  |
|--------|--------------------------|------------------------------------------|
| POST   | `/sessions`              | Start session, returns first question    |
| POST   | `/sessions/:id/answer`   | Submit answer, returns next node or done |
| GET    | `/sessions/:id`          | Resume in-progress flow                  |
| POST   | `/sessions/:id/skip`     | Skip current node (recorded for telemetry) |
| GET    | `/flow`                  | Public flow.json (versioned, cacheable)  |
| POST   | `/admin/flow`            | Replace flow.json (RBAC: org admin only) |

Validation: Zod schemas. Auth: API key middleware. Errors: `{ error, correlationId }`.

### D1 Schema additions

Two tables: `onboarding_sessions` (id, user_id, org_id, persona, current_node, status, started_at, completed_at) and `onboarding_answers` (id, session_id, node_id, answer_json, answered_at). Indexes on `(user_id, status)` and `(session_id, node_id)`. Full SQL emitted to `prisma/migrations/030_onboarding.sql`.

## Frontend Contract

Next.js 14 App Router, Zustand for session state, Tailwind. Components:

- `app/onboarding/page.tsx` — wizard host, reads `?session=`, falls back to POST `/sessions`
- `components/onboarding/QuestionCard.tsx` — renders one node (radio / multi / free-text)
- `components/onboarding/ProgressTrail.tsx` — non-linear progress (current branch length, not %)
- `components/onboarding/PersonaReveal.tsx` — final reveal + seeded-actions checklist
- `lib/onboarding/client.ts` — typed fetch client, exposes `next()`, `skip()`, `resume()`
- `lib/onboarding/store.ts` — Zustand store: `{ sessionId, node, persona?, history[] }`

Accessibility (per portfolio HIG rules): focus-trap inside card, ESC to skip with confirm, `aria-live="polite"` on next-question swap, full keyboard nav.

## Persona Classification

Rules-first, no LLM at runtime. `classify(answers)` is a pure function loaded from `flow.json` — deterministic, cheap, testable. LLM is used **only** at scaffold time to derive personas from the codebase via `luna-requirements-analyzer`.

## Telemetry

Each `POST /sessions/:id/answer` emits an audit event via the existing `audit-webhook-sender`:
- `onboarding.node.entered`
- `onboarding.node.answered`
- `onboarding.node.skipped`
- `onboarding.completed` (with derived persona)
- `onboarding.abandoned` (no answer for 30 min, set by cron)

## Usage

```bash
/ll-onboard-adaptive scaffold                       # full backend + frontend, target=dashboard
/ll-onboard-adaptive scaffold --target all          # dashboard + studio + mobile
/ll-onboard-adaptive revisit                        # audit existing onboarding, propose rewrite
/ll-onboard-adaptive simulate                       # run derived personas through flow
/ll-onboard-adaptive preview                        # emit flow.json + mermaid only
/ll-onboard-adaptive scaffold --persona_count 6     # more granular personas
```

## In Pipes

```bash
/pipe persona generate >> ll-onboard-adaptive scaffold >> e2e-flow >> browser-test
/pipe ll-onboard-adaptive simulate >> persona empathy >> present "onboarding gaps"
/pipe ll-onboard-adaptive revisit >> fix >> pr "adaptive onboarding rewrite"
```

## Output Files

```
.luna/{project}/onboarding/
  flow.json            # state machine (nodes, edges, seed actions)
  personas.md          # derived personas with Q→A→persona mapping
  questions.md         # question bank with rationale
  report.md            # coverage, drop-off risk, branch terminations
  diagram.mmd          # mermaid flow diagram
lunaos-engine/
  src/routes/onboarding.ts
  src/services/onboarding-classifier.ts
  src/services/onboarding-seeder.ts        # seeds per-persona starter data
  prisma/migrations/030_onboarding.sql
  tests/onboarding.integration.test.ts
lunaos-dashboard/
  src/app/onboarding/page.tsx
  src/components/onboarding/QuestionCard.tsx
  src/components/onboarding/ProgressTrail.tsx
  src/components/onboarding/PersonaReveal.tsx
  src/lib/onboarding/client.ts
  src/lib/onboarding/store.ts
  src/components/onboarding/__tests__/*.test.tsx
```

## Quality Gates (per portfolio CLAUDE.md)

- Each emitted file ≤ 200 lines (split when over)
- Zod validation on every route
- Unit + integration tests ≥ 90% line / 85% branch
- Critical path (POST `/sessions`, POST `/sessions/:id/answer`) at 100%
- ARIA + keyboard nav verified
- No PII in audit events (hash user_id before emit)
