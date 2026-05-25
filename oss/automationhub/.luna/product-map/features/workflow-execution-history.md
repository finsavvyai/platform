# Feature: Workflow Execution and History
- Product: AutomationHub Core
- Workflow: Workflow Lifecycle
- Status: Implemented
- Priority: P1

## Code References
- `src/automationhub/workflows.py` (`Workflow.execute`, `get_execution_history`)
- `src/automationhub/api.py` (`execute_workflow`, `get_workflow_history`)
- `tests/test_workflows.py`
- `tests/test_api.py`

## Context Package
- Token budget: 3000
- Key types: execution payload dict (`execution_id`, `status`, `steps_executed`)
- Dependencies: active workflow state from `WorkflowStatus`

## Approval Gates
- [ ] Design review
- [ ] Security review
- [ ] Test plan approved

## E2E Test Spec
- Execute inactive workflow -> raises error.
- Execute active workflow with one step -> success and `steps_executed=1`.
- Query execution history after run -> returns at least one record.
- Execute missing workflow via API -> raises `ValueError`.
- Query history for missing workflow -> returns empty list.
