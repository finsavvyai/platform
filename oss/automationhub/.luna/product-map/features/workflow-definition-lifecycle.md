# Feature: Workflow Definition and Lifecycle
- Product: AutomationHub Core
- Workflow: Workflow Lifecycle
- Status: Implemented
- Priority: P1

## Code References
- `src/automationhub/workflows.py` (`Workflow`, `WorkflowStatus`, `WorkflowEngine`)
- `tests/test_workflows.py` (lifecycle validation and transitions)

## Context Package
- Token budget: 2600
- Key types: `Workflow`, `WorkflowStatus`, `WorkflowEngine`
- Dependencies: `api.py` (activation/pause/lookup)

## Approval Gates
- [ ] Design review
- [ ] Security review
- [ ] Test plan approved

## E2E Test Spec
- Create workflow without name -> raises validation error.
- Add step without name -> raises validation error.
- Activate workflow without steps -> raises validation error.
- Activate -> pause -> resume sequence keeps valid state transitions.
- Delete workflow -> subsequent lookup returns `None`.
