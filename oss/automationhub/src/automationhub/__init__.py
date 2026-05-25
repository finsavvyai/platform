"""AutomationHub public library API."""

from .actions import (
    Action,
    ActionExecutor,
    ActionType,
    DatabaseAction,
    EmailAction,
    FileAction,
    HTTPAction,
)
from .api import AutomationAPI
from .scheduler import (
    CronSchedule,
    IntervalSchedule,
    OneTimeSchedule,
    Schedule,
    ScheduleType,
    Scheduler,
)
from .triggers import (
    EventTrigger,
    ManualTrigger,
    Trigger,
    TriggerManager,
    TriggerType,
    WebhookTrigger,
)
from .workflows import Workflow, WorkflowEngine, WorkflowStatus

__version__ = "1.0.1"

__all__ = [
    "Action",
    "ActionExecutor",
    "ActionType",
    "AutomationAPI",
    "CronSchedule",
    "DatabaseAction",
    "EmailAction",
    "EventTrigger",
    "FileAction",
    "HTTPAction",
    "IntervalSchedule",
    "ManualTrigger",
    "OneTimeSchedule",
    "Schedule",
    "ScheduleType",
    "Scheduler",
    "Trigger",
    "TriggerManager",
    "TriggerType",
    "WebhookTrigger",
    "Workflow",
    "WorkflowEngine",
    "WorkflowStatus",
]
