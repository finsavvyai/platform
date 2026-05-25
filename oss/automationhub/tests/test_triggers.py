import pytest
from src.automationhub.triggers import (
    Trigger,
    TriggerType,
    WebhookTrigger,
    EventTrigger,
    ManualTrigger,
    TriggerManager,
)


class TestTrigger:
    def test_create_trigger(self):
        trigger = Trigger("Test", TriggerType.WEBHOOK)
        assert trigger.name == "Test"
        assert trigger.is_active is True

    def test_fire_trigger(self):
        trigger = Trigger("Test", TriggerType.EVENT)
        result = trigger.fire()
        assert result["trigger_id"] == trigger.id
        assert trigger.last_fired is not None


class TestWebhookTrigger:
    def test_create_webhook_trigger(self):
        trigger = WebhookTrigger(
            "MyWebhook", "https://example.com/webhook", "super-secret"
        )
        assert trigger.endpoint == "https://example.com/webhook"
        assert trigger.trigger_type == TriggerType.WEBHOOK

    def test_validate_webhook(self):
        trigger = WebhookTrigger(
            "MyWebhook", "https://example.com/webhook", "super-secret"
        )
        payload = b'{"event":"user.created"}'
        result = trigger.validate_webhook(
            "sha256=d15e61415aefb51116a005e805045c686076033cdb6121858830723af7be4eb4",
            payload,
        )
        assert result is True

    def test_validate_webhook_invalid_signature(self):
        trigger = WebhookTrigger(
            "MyWebhook", "https://example.com/webhook", "super-secret"
        )
        payload = b'{"event":"user.created"}'
        assert trigger.validate_webhook("sha256=invalid", payload) is False

    def test_validate_webhook_missing_payload(self):
        trigger = WebhookTrigger(
            "MyWebhook", "https://example.com/webhook", "super-secret"
        )
        assert trigger.validate_webhook("sha256=invalid", b"") is False


class TestEventTrigger:
    def test_create_event_trigger(self):
        trigger = EventTrigger("MyEvent", "user.created")
        assert trigger.event_name == "user.created"

    def test_subscribe_to_event(self):
        trigger = EventTrigger("MyEvent", "user.created")
        callback_called = False

        def callback(data):
            nonlocal callback_called
            callback_called = True

        trigger.subscribe(callback)
        trigger.emit({"user_id": "123"})
        assert callback_called is True


class TestManualTrigger:
    def test_create_manual_trigger(self):
        trigger = ManualTrigger("Manual")
        assert trigger.can_be_manually_triggered is True
        assert trigger.trigger_type == TriggerType.MANUAL


class TestTriggerManager:
    def test_create_trigger(self):
        manager = TriggerManager()
        trigger = manager.create_trigger(
            "Test",
            TriggerType.WEBHOOK,
            {"endpoint": "https://example.com/webhook", "secret": "test-secret"},
        )
        assert trigger.id in manager.triggers
        assert isinstance(trigger, WebhookTrigger)

    def test_create_event_trigger(self):
        manager = TriggerManager()
        trigger = manager.create_trigger(
            "Event Trigger", TriggerType.EVENT, {"event_name": "user.created"}
        )
        assert isinstance(trigger, EventTrigger)

    def test_create_manual_trigger(self):
        manager = TriggerManager()
        trigger = manager.create_trigger("Manual Trigger", TriggerType.MANUAL)
        assert isinstance(trigger, ManualTrigger)

    def test_create_trigger_missing_webhook_config_raises(self):
        manager = TriggerManager()
        with pytest.raises(ValueError):
            manager.create_trigger("Bad", TriggerType.WEBHOOK)

    def test_create_trigger_missing_name_raises(self):
        manager = TriggerManager()
        with pytest.raises(ValueError):
            manager.create_trigger("", TriggerType.MANUAL)

    def test_create_trigger_missing_event_name_raises(self):
        manager = TriggerManager()
        with pytest.raises(ValueError):
            manager.create_trigger("Event", TriggerType.EVENT)

    def test_create_schedule_trigger_type_supported(self):
        manager = TriggerManager()
        trigger = manager.create_trigger("Scheduled", TriggerType.SCHEDULE)
        assert isinstance(trigger, Trigger)

    def test_get_trigger(self):
        manager = TriggerManager()
        trigger = manager.create_trigger(
            "Test",
            TriggerType.WEBHOOK,
            {"endpoint": "https://example.com/webhook", "secret": "test-secret"},
        )
        found = manager.get_trigger(trigger.id)
        assert found == trigger

    def test_list_triggers(self):
        manager = TriggerManager()
        manager.create_trigger(
            "T1",
            TriggerType.WEBHOOK,
            {"endpoint": "https://example.com/webhook", "secret": "test-secret"},
        )
        manager.create_trigger("T2", TriggerType.EVENT, {"event_name": "user.created"})
        triggers = manager.list_triggers()
        assert len(triggers) == 2

    def test_activate_trigger(self):
        manager = TriggerManager()
        trigger = manager.create_trigger(
            "Test",
            TriggerType.WEBHOOK,
            {"endpoint": "https://example.com/webhook", "secret": "test-secret"},
        )
        trigger.is_active = False
        result = manager.activate_trigger(trigger.id)
        assert result is True
        assert trigger.is_active is True

    def test_deactivate_trigger(self):
        manager = TriggerManager()
        trigger = manager.create_trigger(
            "Test",
            TriggerType.WEBHOOK,
            {"endpoint": "https://example.com/webhook", "secret": "test-secret"},
        )
        result = manager.deactivate_trigger(trigger.id)
        assert result is True
        assert trigger.is_active is False

    def test_delete_trigger(self):
        manager = TriggerManager()
        trigger = manager.create_trigger(
            "Test",
            TriggerType.WEBHOOK,
            {"endpoint": "https://example.com/webhook", "secret": "test-secret"},
        )
        result = manager.delete_trigger(trigger.id)
        assert result is True
        assert manager.get_trigger(trigger.id) is None

    def test_activate_unknown_trigger(self):
        manager = TriggerManager()
        assert manager.activate_trigger("missing") is False

    def test_deactivate_unknown_trigger(self):
        manager = TriggerManager()
        assert manager.deactivate_trigger("missing") is False

    def test_delete_unknown_trigger(self):
        manager = TriggerManager()
        assert manager.delete_trigger("missing") is False
