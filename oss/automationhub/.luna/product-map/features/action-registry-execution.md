# Feature: Action Registry and Execution
- Product: AutomationHub Core
- Workflow: Action Execution
- Status: Implemented
- Priority: P1

## Code References
- `src/automationhub/actions.py` (`Action`, typed actions, `ActionExecutor`)
- `tests/test_actions.py` (registration, execution, disabled actions, history)

## Context Package
- Token budget: 2800
- Key types: `ActionType`, `Action`, `ActionExecutor`
- Dependencies: API registration/listing in `api.py`

## Approval Gates
- [ ] Design review
- [ ] Security review
- [ ] Test plan approved

## E2E Test Spec
- Register valid action -> action appears in list.
- Register invalid action (empty name) -> raises error.
- Execute enabled action -> returns success payload.
- Execute disabled action -> raises validation error.
- Read execution history after run -> contains latest execution.
