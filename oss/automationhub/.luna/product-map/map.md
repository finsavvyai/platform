# AutomationHub Product Map

Generated: 2026-04-21  
Source scope: `src/automationhub` + `tests`

## Hierarchy

AutomationHub Core
  +-- API Facade
  |     +-- Automation API Orchestration
  +-- Workflow Lifecycle
  |     +-- Workflow Definition and Lifecycle
  |     +-- Workflow Execution and History
  +-- Action Execution
  |     +-- Action Registry and Execution
  +-- Event and Webhook Triggering
  |     +-- Trigger Management and Webhook Security
  +-- Time-based Automation
        +-- Schedule Factory and Runtime Triggering

## Feature Index

| Feature | Workflow | Priority | Status | Card |
|---|---|---|---|---|
| Automation API Orchestration | API Facade | P1 | Implemented | `features/automation-api-orchestration.md` |
| Workflow Definition and Lifecycle | Workflow Lifecycle | P1 | Implemented | `features/workflow-definition-lifecycle.md` |
| Workflow Execution and History | Workflow Lifecycle | P1 | Implemented | `features/workflow-execution-history.md` |
| Action Registry and Execution | Action Execution | P1 | Implemented | `features/action-registry-execution.md` |
| Trigger Management and Webhook Security | Event and Webhook Triggering | P1 | Implemented | `features/trigger-management-webhook-security.md` |
| Schedule Factory and Runtime Triggering | Time-based Automation | P1 | Implemented | `features/schedule-factory-runtime-triggering.md` |

## Mapping Notes

- API-level orchestration is centralized in `src/automationhub/api.py`.
- Domain responsibilities are split cleanly by module: `workflows`, `actions`, `triggers`, and `scheduler`.
- Test modules map one-to-one with domain modules and serve as baseline execution specs.
- Recent hardening work is reflected in trigger webhook signature validation and typed trigger/schedule factories.
