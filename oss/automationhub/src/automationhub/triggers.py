import uuid
import hmac
import hashlib
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Dict, List, Optional


class TriggerType(str, Enum):
    WEBHOOK = "webhook"
    SCHEDULE = "schedule"
    EVENT = "event"
    MANUAL = "manual"


class Trigger:
    def __init__(self, name: str, trigger_type: TriggerType):
        self.id = str(uuid.uuid4())
        self.name = name
        self.trigger_type = trigger_type
        self.created_at = datetime.now()
        self.is_active = True
        self.last_fired: Optional[datetime] = None

    def fire(self) -> Dict[str, Any]:
        self.last_fired = datetime.now()
        return {
            "trigger_id": self.id,
            "fired_at": self.last_fired.isoformat(),
            "type": self.trigger_type.value,
        }


class WebhookTrigger(Trigger):
    def __init__(self, name: str, endpoint: str, secret: str):
        super().__init__(name, TriggerType.WEBHOOK)
        self.endpoint = endpoint
        self.secret = secret

    def validate_webhook(self, signature: str, payload: bytes) -> bool:
        if not signature or not payload or not self.secret:
            return False
        computed = hmac.new(
            self.secret.encode("utf-8"), payload, hashlib.sha256
        ).hexdigest()
        expected = f"sha256={computed}"
        return hmac.compare_digest(signature, expected)


class EventTrigger(Trigger):
    def __init__(self, name: str, event_name: str):
        super().__init__(name, TriggerType.EVENT)
        self.event_name = event_name
        self.listeners: List[Callable] = []

    def subscribe(self, listener: Callable) -> None:
        self.listeners.append(listener)

    def emit(self, data: Dict[str, Any]) -> None:
        for listener in self.listeners:
            listener(data)


class ManualTrigger(Trigger):
    def __init__(self, name: str):
        super().__init__(name, TriggerType.MANUAL)
        self.can_be_manually_triggered = True


class TriggerManager:
    def __init__(self):
        self.triggers: Dict[str, Trigger] = {}

    def create_trigger(
        self, name: str, trigger_type: TriggerType, config: Optional[Dict[str, Any]] = None
    ) -> Trigger:
        if not name:
            raise ValueError("Trigger name is required")

        config = config or {}
        if trigger_type == TriggerType.WEBHOOK:
            endpoint = config.get("endpoint")
            secret = config.get("secret")
            if not endpoint or not secret:
                raise ValueError("Webhook trigger requires endpoint and secret")
            trigger = WebhookTrigger(name, endpoint, secret)
        elif trigger_type == TriggerType.EVENT:
            event_name = config.get("event_name")
            if not event_name:
                raise ValueError("Event trigger requires event_name")
            trigger = EventTrigger(name, event_name)
        elif trigger_type == TriggerType.MANUAL:
            trigger = ManualTrigger(name)
        else:
            trigger = Trigger(name, trigger_type)

        self.triggers[trigger.id] = trigger
        return trigger

    def get_trigger(self, trigger_id: str) -> Optional[Trigger]:
        return self.triggers.get(trigger_id)

    def list_triggers(self) -> List[Trigger]:
        return list(self.triggers.values())

    def activate_trigger(self, trigger_id: str) -> bool:
        trigger = self.triggers.get(trigger_id)
        if trigger:
            trigger.is_active = True
            return True
        return False

    def deactivate_trigger(self, trigger_id: str) -> bool:
        trigger = self.triggers.get(trigger_id)
        if trigger:
            trigger.is_active = False
            return True
        return False

    def delete_trigger(self, trigger_id: str) -> bool:
        if trigger_id in self.triggers:
            del self.triggers[trigger_id]
            return True
        return False
