# Feature: Schedule Factory and Runtime Triggering
- Product: AutomationHub Core
- Workflow: Time-based Automation
- Status: Implemented
- Priority: P1

## Code References
- `src/automationhub/scheduler.py` (`Scheduler`, `ScheduleType`, typed schedules)
- `tests/test_scheduler.py` (factory validation, trigger behavior, state toggles)

## Context Package
- Token budget: 3200
- Key types: `ScheduleType`, `Schedule`, `IntervalSchedule`, `CronSchedule`, `OneTimeSchedule`
- Dependencies: callback registration and schedule activation state

## Approval Gates
- [ ] Design review
- [ ] Security review
- [ ] Test plan approved

## E2E Test Spec
- Create interval schedule with valid `interval_seconds` -> returns `IntervalSchedule`.
- Create cron schedule with invalid expression -> raises validation error.
- Create one-time schedule without datetime `run_at` -> raises validation error.
- Trigger active schedule with callback -> callback executes and trigger response returned.
- Trigger missing or inactive schedule -> raises validation error.
