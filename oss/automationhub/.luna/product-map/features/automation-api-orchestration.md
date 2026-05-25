# Feature: Automation API Orchestration
- Product: AutomationHub Core
- Workflow: API Facade
- Status: Implemented
- Priority: P1

## Code References
- `src/automationhub/api.py` (public orchestration surface for workflows, triggers, actions)
- `tests/test_api.py` (API behavior and failure-path coverage)

## Context Package
- Token budget: 2800
- Key types: `AutomationAPI`, `TriggerType`, `WorkflowEngine`
- Dependencies: `workflows.py`, `triggers.py`, `actions.py`

## Approval Gates
- [ ] Design review
- [ ] Security review
- [ ] Test plan approved

## E2E Test Spec
- Create workflow -> API returns id/name/description.
- Activate workflow with no steps -> returns `False`.
- Activate workflow with step -> returns `True`.
- Pause missing workflow -> returns `False`.
- Register webhook trigger with endpoint + secret -> trigger returned and listed.
