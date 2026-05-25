import uuid
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Callable, Dict, List, Optional


class ScheduleType(str, Enum):
    CRON = "cron"
    INTERVAL = "interval"
    ONE_TIME = "one_time"


class Schedule:
    def __init__(self, name: str, schedule_type: ScheduleType):
        self.id = str(uuid.uuid4())
        self.name = name
        self.schedule_type = schedule_type
        self.is_active = True
        self.created_at = datetime.now()
        self.last_run: Optional[datetime] = None
        self.next_run: Optional[datetime] = None

    def mark_executed(self) -> None:
        self.last_run = datetime.now()


class IntervalSchedule(Schedule):
    def __init__(self, name: str, interval_seconds: int):
        super().__init__(name, ScheduleType.INTERVAL)
        self.interval_seconds = interval_seconds

    def calculate_next_run(self) -> datetime:
        return datetime.now() + timedelta(seconds=self.interval_seconds)


class CronSchedule(Schedule):
    def __init__(self, name: str, cron_expression: str):
        super().__init__(name, ScheduleType.CRON)
        self.cron_expression = cron_expression

    def validate_cron(self) -> bool:
        return len(self.cron_expression.split()) == 5


class OneTimeSchedule(Schedule):
    def __init__(self, name: str, run_at: datetime):
        super().__init__(name, ScheduleType.ONE_TIME)
        self.run_at = run_at
        self.next_run = run_at


class Scheduler:
    def __init__(self):
        self.schedules: Dict[str, Schedule] = {}
        self.callbacks: Dict[str, List[Callable]] = {}

    def create_schedule(
        self, name: str, schedule_type: ScheduleType, config: Optional[Dict[str, Any]] = None
    ) -> Schedule:
        if not name:
            raise ValueError("Schedule name is required")

        config = config or {}
        if schedule_type == ScheduleType.INTERVAL:
            interval_seconds = config.get("interval_seconds")
            if not isinstance(interval_seconds, int) or interval_seconds <= 0:
                raise ValueError("Interval schedule requires positive interval_seconds")
            schedule = IntervalSchedule(name, interval_seconds)
        elif schedule_type == ScheduleType.CRON:
            cron_expression = config.get("cron_expression")
            if not cron_expression:
                raise ValueError("Cron schedule requires cron_expression")
            schedule = CronSchedule(name, cron_expression)
            if not schedule.validate_cron():
                raise ValueError("Invalid cron_expression")
        elif schedule_type == ScheduleType.ONE_TIME:
            run_at = config.get("run_at")
            if not isinstance(run_at, datetime):
                raise ValueError("One-time schedule requires datetime run_at")
            schedule = OneTimeSchedule(name, run_at)
        else:
            schedule = Schedule(name, schedule_type)

        self.schedules[schedule.id] = schedule
        return schedule

    def get_schedule(self, schedule_id: str) -> Optional[Schedule]:
        return self.schedules.get(schedule_id)

    def list_schedules(self) -> List[Schedule]:
        return list(self.schedules.values())

    def register_callback(self, schedule_id: str, callback: Callable) -> None:
        if schedule_id not in self.callbacks:
            self.callbacks[schedule_id] = []
        self.callbacks[schedule_id].append(callback)

    def trigger_schedule(self, schedule_id: str) -> Dict[str, Any]:
        schedule = self.schedules.get(schedule_id)
        if not schedule:
            raise ValueError(f"Schedule {schedule_id} not found")
        if not schedule.is_active:
            raise ValueError(f"Schedule {schedule_id} is not active")

        schedule.mark_executed()

        callbacks = self.callbacks.get(schedule_id, [])
        for callback in callbacks:
            callback()

        return {"schedule_id": schedule_id, "triggered_at": datetime.now().isoformat()}

    def enable_schedule(self, schedule_id: str) -> bool:
        schedule = self.schedules.get(schedule_id)
        if schedule:
            schedule.is_active = True
            return True
        return False

    def disable_schedule(self, schedule_id: str) -> bool:
        schedule = self.schedules.get(schedule_id)
        if schedule:
            schedule.is_active = False
            return True
        return False
