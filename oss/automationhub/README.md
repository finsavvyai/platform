# AutomationHub

`automationhub` is a lightweight Python library that provides core primitives for building workflow automation systems:

- Workflow lifecycle management
- Trigger management (including webhook signature validation)
- Scheduler abstractions (interval, cron-like, one-time)
- Action registration and execution interfaces

This package focuses on clean in-process domain models and orchestration interfaces that you can embed into larger products.

## Installation

```bash
pip install automationhub
```

For local development:

```bash
pip install -e ".[dev]"
```

## Quick Example

```python
import asyncio
from automationhub import AutomationAPI, Action, ActionType


async def main() -> None:
    api = AutomationAPI()
    workflow = api.create_workflow("Welcome Flow", "Simple onboarding flow")
    workflow_id = workflow["id"]

    wf = api.workflow_engine.get_workflow(workflow_id)
    wf.add_step({"name": "Send welcome email"})
    api.activate_workflow(workflow_id)

    action = Action("Log execution", ActionType.WEBHOOK)
    api.register_action(action)

    result = await api.execute_workflow(workflow_id)
    print(result["status"])


asyncio.run(main())
```

## Public API

The package exports:

- `AutomationAPI`
- `Workflow`, `WorkflowEngine`, `WorkflowStatus`
- `Trigger`, `TriggerManager`, `TriggerType`, `WebhookTrigger`, `EventTrigger`, `ManualTrigger`
- `Schedule`, `Scheduler`, `ScheduleType`, `IntervalSchedule`, `CronSchedule`, `OneTimeSchedule`
- `Action`, `ActionExecutor`, `ActionType`, `HTTPAction`, `EmailAction`, `DatabaseAction`, `FileAction`

## Current Scope

This library provides the domain runtime surface and security-sensitive webhook verification.
It intentionally keeps transport/storage concerns out of scope:

- No built-in database persistence
- No built-in background scheduler daemon
- No built-in HTTP server

These can be layered on top in your host application.

## Development

Run tests:

```bash
pytest tests/test_workflows.py tests/test_actions.py tests/test_triggers.py tests/test_scheduler.py tests/test_api.py
```

Build distribution artifacts:

```bash
python -m build
```

## Release (PyPI)

```bash
python -m pip install --upgrade build twine
python -m build
twine check dist/*
twine upload dist/*
```

## License

MIT. See `LICENSE`.
