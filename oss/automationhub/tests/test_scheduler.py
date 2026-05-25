import pytest
from datetime import datetime, timedelta
from src.automationhub.scheduler import (
    Schedule,
    ScheduleType,
    IntervalSchedule,
    CronSchedule,
    OneTimeSchedule,
    Scheduler,
)


class TestSchedule:
    def test_create_schedule(self):
        schedule = Schedule("Test", ScheduleType.INTERVAL)
        assert schedule.name == "Test"
        assert schedule.is_active is True

    def test_mark_executed(self):
        schedule = Schedule("Test", ScheduleType.INTERVAL)
        schedule.mark_executed()
        assert schedule.last_run is not None


class TestIntervalSchedule:
    def test_create_interval_schedule(self):
        schedule = IntervalSchedule("Every hour", 3600)
        assert schedule.interval_seconds == 3600

    def test_calculate_next_run(self):
        schedule = IntervalSchedule("Every hour", 3600)
        next_run = schedule.calculate_next_run()
        assert next_run > datetime.now()


class TestCronSchedule:
    def test_create_cron_schedule(self):
        schedule = CronSchedule("Daily", "0 9 * * *")
        assert schedule.cron_expression == "0 9 * * *"

    def test_validate_cron(self):
        schedule = CronSchedule("Daily", "0 9 * * *")
        assert schedule.validate_cron() is True

    def test_validate_invalid_cron(self):
        schedule = CronSchedule("Bad", "0 9 *")
        assert schedule.validate_cron() is False


class TestOneTimeSchedule:
    def test_create_one_time_schedule(self):
        future = datetime.now() + timedelta(hours=1)
        schedule = OneTimeSchedule("Once", future)
        assert schedule.run_at == future


class TestScheduler:
    def test_create_schedule(self):
        scheduler = Scheduler()
        schedule = scheduler.create_schedule(
            "Test", ScheduleType.INTERVAL, {"interval_seconds": 60}
        )
        assert schedule.id in scheduler.schedules
        assert isinstance(schedule, IntervalSchedule)

    def test_create_cron_schedule_from_factory(self):
        scheduler = Scheduler()
        schedule = scheduler.create_schedule(
            "Daily", ScheduleType.CRON, {"cron_expression": "0 9 * * *"}
        )
        assert isinstance(schedule, CronSchedule)

    def test_create_one_time_schedule_from_factory(self):
        scheduler = Scheduler()
        run_at = datetime.now() + timedelta(hours=1)
        schedule = scheduler.create_schedule(
            "Once", ScheduleType.ONE_TIME, {"run_at": run_at}
        )
        assert isinstance(schedule, OneTimeSchedule)

    def test_create_schedule_invalid_interval_raises(self):
        scheduler = Scheduler()
        with pytest.raises(ValueError):
            scheduler.create_schedule(
                "BadInterval", ScheduleType.INTERVAL, {"interval_seconds": 0}
            )

    def test_create_schedule_missing_name_raises(self):
        scheduler = Scheduler()
        with pytest.raises(ValueError):
            scheduler.create_schedule("", ScheduleType.INTERVAL, {"interval_seconds": 60})

    def test_create_schedule_missing_cron_expression_raises(self):
        scheduler = Scheduler()
        with pytest.raises(ValueError):
            scheduler.create_schedule("BadCron", ScheduleType.CRON)

    def test_create_schedule_invalid_cron_expression_raises(self):
        scheduler = Scheduler()
        with pytest.raises(ValueError):
            scheduler.create_schedule(
                "BadCron", ScheduleType.CRON, {"cron_expression": "0 9 *"}
            )

    def test_create_schedule_invalid_one_time_raises(self):
        scheduler = Scheduler()
        with pytest.raises(ValueError):
            scheduler.create_schedule("BadOneTime", ScheduleType.ONE_TIME, {"run_at": "soon"})

    def test_get_schedule(self):
        scheduler = Scheduler()
        schedule = scheduler.create_schedule(
            "Test", ScheduleType.INTERVAL, {"interval_seconds": 60}
        )
        found = scheduler.get_schedule(schedule.id)
        assert found == schedule

    def test_list_schedules(self):
        scheduler = Scheduler()
        scheduler.create_schedule("S1", ScheduleType.INTERVAL, {"interval_seconds": 60})
        scheduler.create_schedule(
            "S2", ScheduleType.CRON, {"cron_expression": "0 9 * * *"}
        )
        schedules = scheduler.list_schedules()
        assert len(schedules) == 2

    def test_register_callback(self):
        scheduler = Scheduler()
        schedule = scheduler.create_schedule(
            "Test", ScheduleType.INTERVAL, {"interval_seconds": 60}
        )
        called = False

        def callback():
            nonlocal called
            called = True

        scheduler.register_callback(schedule.id, callback)
        result = scheduler.trigger_schedule(schedule.id)
        assert called is True

    def test_trigger_schedule(self):
        scheduler = Scheduler()
        schedule = scheduler.create_schedule(
            "Test", ScheduleType.INTERVAL, {"interval_seconds": 60}
        )
        result = scheduler.trigger_schedule(schedule.id)
        assert result["schedule_id"] == schedule.id

    def test_trigger_inactive_schedule_raises(self):
        scheduler = Scheduler()
        schedule = scheduler.create_schedule(
            "Test", ScheduleType.INTERVAL, {"interval_seconds": 60}
        )
        schedule.is_active = False
        with pytest.raises(ValueError):
            scheduler.trigger_schedule(schedule.id)

    def test_trigger_unknown_schedule_raises(self):
        scheduler = Scheduler()
        with pytest.raises(ValueError):
            scheduler.trigger_schedule("missing")

    def test_enable_schedule(self):
        scheduler = Scheduler()
        schedule = scheduler.create_schedule(
            "Test", ScheduleType.INTERVAL, {"interval_seconds": 60}
        )
        schedule.is_active = False
        result = scheduler.enable_schedule(schedule.id)
        assert result is True
        assert schedule.is_active is True

    def test_disable_schedule(self):
        scheduler = Scheduler()
        schedule = scheduler.create_schedule(
            "Test", ScheduleType.INTERVAL, {"interval_seconds": 60}
        )
        result = scheduler.disable_schedule(schedule.id)
        assert result is True
        assert schedule.is_active is False

    def test_enable_unknown_schedule(self):
        scheduler = Scheduler()
        assert scheduler.enable_schedule("missing") is False

    def test_disable_unknown_schedule(self):
        scheduler = Scheduler()
        assert scheduler.disable_schedule("missing") is False
