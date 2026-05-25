import pytest
from src.automationhub.actions import (
    Action,
    ActionType,
    HTTPAction,
    EmailAction,
    DatabaseAction,
    FileAction,
    ActionExecutor,
)


class TestAction:
    @pytest.mark.asyncio
    async def test_create_action(self):
        action = Action("Test", ActionType.HTTP)
        assert action.name == "Test"
        assert action.is_enabled is True

    def test_validate_action(self):
        action = Action("Test", ActionType.HTTP)
        assert action.validate() is True

    @pytest.mark.asyncio
    async def test_execute_action(self):
        action = Action("Test", ActionType.HTTP)
        result = await action.execute({"key": "value"})
        assert result["status"] == "success"


class TestHTTPAction:
    def test_create_http_action(self):
        action = HTTPAction("API Call", "https://api.example.com", "POST")
        assert action.url == "https://api.example.com"
        assert action.method == "POST"

    def test_set_header(self):
        action = HTTPAction("API Call", "https://api.example.com")
        action.set_header("Authorization", "Bearer token")
        assert action.headers["Authorization"] == "Bearer token"


class TestEmailAction:
    def test_create_email_action(self):
        action = EmailAction("SendEmail", "user@example.com", "Hello")
        assert action.to == "user@example.com"
        assert action.subject == "Hello"

    def test_set_body(self):
        action = EmailAction("SendEmail", "user@example.com", "Hello")
        action.set_body("Email body content")
        assert action.body == "Email body content"


class TestDatabaseAction:
    def test_create_database_action(self):
        action = DatabaseAction("Query", "SELECT * FROM users")
        assert action.query == "SELECT * FROM users"
        assert action.action_type == ActionType.DATABASE


class TestFileAction:
    def test_create_file_action(self):
        action = FileAction("WriteFile", "/path/to/file.txt", "write")
        assert action.path == "/path/to/file.txt"
        assert action.operation == "write"


class TestActionExecutor:
    def test_register_action(self):
        executor = ActionExecutor()
        action = Action("Test", ActionType.HTTP)
        executor.register_action(action)
        assert action.id in [a.id for a in executor.list_actions()]

    def test_register_invalid_action_raises(self):
        executor = ActionExecutor()
        action = Action("", ActionType.HTTP)
        with pytest.raises(ValueError):
            executor.register_action(action)

    def test_get_action(self):
        executor = ActionExecutor()
        action = Action("Test", ActionType.HTTP)
        executor.register_action(action)
        found = executor.get_action(action.id)
        assert found == action

    def test_list_actions(self):
        executor = ActionExecutor()
        executor.register_action(Action("Action1", ActionType.HTTP))
        executor.register_action(Action("Action2", ActionType.EMAIL))
        actions = executor.list_actions()
        assert len(actions) == 2

    @pytest.mark.asyncio
    async def test_execute_action(self):
        executor = ActionExecutor()
        action = Action("Test", ActionType.HTTP)
        executor.register_action(action)
        result = await executor.execute_action(action.id, {"data": "test"})
        assert result["status"] == "success"

    @pytest.mark.asyncio
    async def test_execute_disabled_action_raises(self):
        executor = ActionExecutor()
        action = Action("Test", ActionType.HTTP)
        executor.register_action(action)
        action.is_enabled = False
        with pytest.raises(ValueError):
            await executor.execute_action(action.id, {})

    @pytest.mark.asyncio
    async def test_execution_history(self):
        executor = ActionExecutor()
        action = Action("Test", ActionType.HTTP)
        executor.register_action(action)
        await executor.execute_action(action.id, {})
        history = executor.get_execution_history()
        assert len(history) >= 1
