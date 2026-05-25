# Sprint 33: Remediation Engine — Implementation Plan

## Phase 1: Schema
- [x] 1.1 Remediation playbooks table
- [x] 1.2 Remediation runs table
- [x] 1.3 Migration SQL (0019)

## Phase 2: Services
- [x] 2.1 Playbook executor (DAG step runner, 8 action types)
- [x] 2.2 Agent suspension service (suspend/resume/quarantine)
- [x] 2.3 Service tests (11 tests)

## Phase 3: API Routes
- [x] 3.1 Playbook CRUD routes (GET/POST/DELETE /api/remediation/playbooks)
- [x] 3.2 Remediation run routes (GET/POST /api/remediation/runs)
- [x] 3.3 Agent suspension routes (POST /api/agents/suspend|resume|quarantine/:agentId)
- [x] 3.4 Route tests (10 tests)
- [x] 3.5 Register routes

## Phase 4: Validation
- [x] 4.1 Typecheck clean
- [x] 4.2 All Sprint 33 tests pass
