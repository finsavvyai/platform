import uuid
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional


class ActionType(str, Enum):
    HTTP = "http"
    EMAIL = "email"
    DATABASE = "database"
    FILE = "file"
    WEBHOOK = "webhook"


class Action:
    def __init__(self, name: str, action_type: ActionType):
        self.id = str(uuid.uuid4())
        self.name = name
        self.action_type = action_type
        self.config: Dict[str, Any] = {}
        self.created_at = datetime.now()
        self.is_enabled = True

    def validate(self) -> bool:
        if not self.name or not self.action_type:
            return False
        return True

    async def execute(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "action_id": self.id,
            "status": "success",
            "executed_at": datetime.now().isoformat(),
            "payload": payload,
        }


class HTTPAction(Action):
    def __init__(self, name: str, url: str, method: str = "POST"):
        super().__init__(name, ActionType.HTTP)
        self.url = url
        self.method = method
        self.headers: Dict[str, str] = {}

    def set_header(self, key: str, value: str) -> None:
        self.headers[key] = value


class EmailAction(Action):
    def __init__(self, name: str, to: str, subject: str):
        super().__init__(name, ActionType.EMAIL)
        self.to = to
        self.subject = subject
        self.body = ""

    def set_body(self, body: str) -> None:
        self.body = body


class DatabaseAction(Action):
    def __init__(self, name: str, query: str):
        super().__init__(name, ActionType.DATABASE)
        self.query = query


class FileAction(Action):
    def __init__(self, name: str, path: str, operation: str):
        super().__init__(name, ActionType.FILE)
        self.path = path
        self.operation = operation


class ActionExecutor:
    def __init__(self):
        self.actions: Dict[str, Action] = {}
        self.execution_history: List[Dict[str, Any]] = []

    def register_action(self, action: Action) -> None:
        if not action.validate():
            raise ValueError("Invalid action")
        self.actions[action.id] = action

    def get_action(self, action_id: str) -> Optional[Action]:
        return self.actions.get(action_id)

    def list_actions(self) -> List[Action]:
        return list(self.actions.values())

    async def execute_action(
        self, action_id: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        action = self.actions.get(action_id)
        if not action:
            raise ValueError(f"Action {action_id} not found")
        if not action.is_enabled:
            raise ValueError(f"Action {action_id} is disabled")

        result = await action.execute(payload)
        self.execution_history.append(result)
        return result

    def get_execution_history(self, limit: int = 20) -> List[Dict[str, Any]]:
        return self.execution_history[-limit:]
