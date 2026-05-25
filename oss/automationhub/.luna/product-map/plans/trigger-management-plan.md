# Product Map Plan: Trigger Management

- Action: `plan`
- Scope: `trigger management`
- Date: 2026-04-21
- Source feature: `feature-trigger-management-security`

## Plan Objective

Advance trigger management from a solid baseline implementation to production-grade capability with explicit contract clarity, stronger security ergonomics, and execution/observability readiness.

## Current Baseline (From Map + Code)

- Typed trigger factory exists in `TriggerManager.create_trigger(...)`.
- Webhook signature verification uses HMAC-SHA256 and constant-time compare.
- Validation and negative paths are covered by tests in `tests/test_triggers.py` and `tests/test_api.py`.
- API integration exists through `AutomationAPI.register_trigger(...)`.

## Ordered Task Graph

### T1 - Define trigger contract and error model
- **Goal:** Standardize return/raise behavior and error messages for create/get/list/activate/deactivate/delete operations.
- **Files:** `src/automationhub/triggers.py`, `src/automationhub/api.py`, `tests/test_triggers.py`, `tests/test_api.py`
- **Dependencies:** none
- **Complexity:** Medium
- **Recommended agent type:** `design-architect` (contract design), then `task-execution-agent`
- **Acceptance criteria:**
  - API behavior is deterministic (documented raise vs return semantics).
  - Error messages are stable and test-asserted.

### T2 - Harden webhook signature API ergonomics
- **Goal:** Add optional helper for parsing signature headers and support explicit algorithm prefix checks (`sha256=` only).
- **Files:** `src/automationhub/triggers.py`, `tests/test_triggers.py`
- **Dependencies:** T1
- **Complexity:** Medium
- **Recommended agent type:** `enterprise-patterns-advisor` (security patterns), then `task-execution-agent`
- **Acceptance criteria:**
  - Invalid/missing algorithm prefixes fail closed.
  - Header parsing edge cases are covered by tests.

### T3 - Add replay-protection hooks (interface-level)
- **Goal:** Introduce a minimal nonce/timestamp validation interface for future anti-replay enforcement without breaking current API.
- **Files:** `src/automationhub/triggers.py`, `tests/test_triggers.py`
- **Dependencies:** T1, T2
- **Complexity:** Medium
- **Recommended agent type:** `enterprise-patterns-advisor`
- **Acceptance criteria:**
  - Interface supports timestamp tolerance and nonce checking callback.
  - Backward compatibility retained for existing validation usage.

### T4 - Improve trigger observability model
- **Goal:** Expand `fire()`/manager operations to emit consistent audit-friendly metadata (operation type, trigger type, timestamps).
- **Files:** `src/automationhub/triggers.py`, `tests/test_triggers.py`
- **Dependencies:** T1
- **Complexity:** Medium
- **Recommended agent type:** `task-execution-agent`
- **Acceptance criteria:**
  - Metadata schema is consistent across operations.
  - Tests verify fields exist and are correctly typed.

### T5 - Add API-level configuration guards
- **Goal:** Ensure `AutomationAPI.register_trigger(...)` enforces required config per trigger type with clear user-facing errors.
- **Files:** `src/automationhub/api.py`, `tests/test_api.py`
- **Dependencies:** T1
- **Complexity:** Low
- **Recommended agent type:** `task-execution-agent`
- **Acceptance criteria:**
  - Missing required config is rejected deterministically.
  - Event trigger defaulting remains explicit and tested.

### T6 - End-to-end trigger workflow test slice
- **Goal:** Add integration-style tests covering create -> activate/deactivate -> validate/fire -> delete lifecycle.
- **Files:** `tests/test_triggers.py`, `tests/test_api.py` (or new `tests/test_trigger_flow.py`)
- **Dependencies:** T2, T4, T5
- **Complexity:** Medium
- **Recommended agent type:** `integration-test-runner`
- **Acceptance criteria:**
  - Lifecycle paths pass in one test suite.
  - Failure paths (bad signature, missing config, unknown IDs) are included.

## Dependency Order

1. T1
2. T2, T4, T5 (parallel after T1)
3. T3 (after T2 + T1)
4. T6 (after T2 + T4 + T5)

## Complexity and Effort Estimate

- Total tasks: 6
- Small: 1
- Medium: 5
- Estimated implementation waves: 2-3
- Risk level: Medium (security-sensitive behavior changes)

## Context Packages

### CP-T1: Contract Foundation
- Token budget: 2600
- Focus files: `src/automationhub/triggers.py`, `src/automationhub/api.py`
- Key symbols: `TriggerManager.create_trigger`, `activate_trigger`, `deactivate_trigger`, `delete_trigger`, `AutomationAPI.register_trigger`
- Deliverable: contract note + tests for deterministic behavior

### CP-T2: Signature Ergonomics
- Token budget: 2200
- Focus files: `src/automationhub/triggers.py`, `tests/test_triggers.py`
- Key symbols: `WebhookTrigger.validate_webhook`
- Deliverable: algorithm-prefix enforcement + parser helper + tests

### CP-T3: Replay Protection Interface
- Token budget: 2000
- Focus files: `src/automationhub/triggers.py`
- Key symbols: webhook validation flow, optional callbacks/interfaces
- Deliverable: extension point for timestamp/nonce verification

### CP-T4: Observability
- Token budget: 1800
- Focus files: `src/automationhub/triggers.py`, `tests/test_triggers.py`
- Key symbols: `Trigger.fire`, manager state-change methods
- Deliverable: consistent metadata schema + assertions

### CP-T5: API Guardrails
- Token budget: 1600
- Focus files: `src/automationhub/api.py`, `tests/test_api.py`
- Key symbols: `AutomationAPI.register_trigger`
- Deliverable: user-facing config validation consistency

### CP-T6: E2E Trigger Flow
- Token budget: 2800
- Focus files: `tests/test_triggers.py`, `tests/test_api.py`
- Key symbols: full trigger lifecycle paths
- Deliverable: integration-style scenario suite

## Approval Workflow

- [ ] Design review (T1 contract + T2/T3 security shape)
- [ ] Security review (webhook parsing + replay interface)
- [ ] Test plan approved (T6 lifecycle scenarios)

## Suggested Execution Pipe

`plan-trigger-mgmt = T1 >> (T2 ~~ T4 ~~ T5) >> T3 >> T6 >> rev >> test >> sec`

