import pytest
from src.automationhub.api import AutomationAPI
from src.automationhub.actions import Action, ActionType
from src.automationhub.triggers import TriggerType


class TestAutomationAPI:
    def test_create_workflow(self):
        api = AutomationAPI()
        wf_dict = api.create_workflow("Test", "Test workflow")
        assert wf_dict["name"] == "Test"

    def test_get_workflow(self):
        api = AutomationAPI()
        wf_dict = api.create_workflow("Test", "Test")
        wf_id = wf_dict["id"]
        found = api.get_workflow(wf_id)
        assert found["name"] == "Test"

    def test_list_workflows(self):
        api = AutomationAPI()
        api.create_workflow("WF1", "Test1")
        api.create_workflow("WF2", "Test2")
        workflows = api.list_workflows()
        assert len(workflows) == 2

    def test_activate_workflow(self):
        api = AutomationAPI()
        wf_dict = api.create_workflow("Test", "Test")
        wf_id = wf_dict["id"]
        workflow = api.workflow_engine.get_workflow(wf_id)
        workflow.add_step({"name": "step1"})
        result = api.activate_workflow(wf_id)
        assert result is True

    def test_pause_workflow(self):
        api = AutomationAPI()
        wf_dict = api.create_workflow("Test", "Test")
        wf_id = wf_dict["id"]
        workflow = api.workflow_engine.get_workflow(wf_id)
        workflow.add_step({"name": "step1"})
        workflow.activate()
        result = api.pause_workflow(wf_id)
        assert result is True

    def test_pause_missing_workflow_returns_false(self):
        api = AutomationAPI()
        assert api.pause_workflow("missing") is False

    @pytest.mark.asyncio
    async def test_execute_workflow(self):
        api = AutomationAPI()
        wf_dict = api.create_workflow("Test", "Test")
        wf_id = wf_dict["id"]
        workflow = api.workflow_engine.get_workflow(wf_id)
        workflow.add_step({"name": "step1"})
        workflow.activate()
        result = await api.execute_workflow(wf_id)
        assert result["status"] == "success"

    @pytest.mark.asyncio
    async def test_execute_missing_workflow_raises(self):
        api = AutomationAPI()
        with pytest.raises(ValueError):
            await api.execute_workflow("missing")

    def test_register_trigger(self):
        api = AutomationAPI()
        trigger_dict = api.register_trigger(
            "Test",
            "webhook",
            {"endpoint": "https://example.com/webhook", "secret": "test-secret"},
        )
        assert trigger_dict["name"] == "Test"

    def test_list_triggers(self):
        api = AutomationAPI()
        api.register_trigger(
            "T1",
            "webhook",
            {"endpoint": "https://example.com/webhook", "secret": "test-secret"},
        )
        api.register_trigger("T2", "event")
        triggers = api.list_triggers()
        assert len(triggers) == 2

    def test_activate_workflow_without_steps_returns_false(self):
        api = AutomationAPI()
        wf_dict = api.create_workflow("Test", "Test")
        wf_id = wf_dict["id"]
        assert api.activate_workflow(wf_id) is False

    def test_activate_missing_workflow_returns_false(self):
        api = AutomationAPI()
        assert api.activate_workflow("missing") is False

    def test_register_action(self):
        api = AutomationAPI()
        action = Action("Test", ActionType.HTTP)
        action_dict = api.register_action(action)
        assert action_dict["name"] == "Test"

    def test_list_actions(self):
        api = AutomationAPI()
        action1 = Action("A1", ActionType.HTTP)
        action2 = Action("A2", ActionType.EMAIL)
        api.register_action(action1)
        api.register_action(action2)
        actions = api.list_actions()
        assert len(actions) == 2

    @pytest.mark.asyncio
    async def test_get_workflow_history(self):
        api = AutomationAPI()
        wf_dict = api.create_workflow("Test", "Test")
        wf_id = wf_dict["id"]
        workflow = api.workflow_engine.get_workflow(wf_id)
        workflow.add_step({"name": "step1"})
        workflow.activate()
        await workflow.execute()
        history = api.get_workflow_history(wf_id)
        assert len(history) > 0

    def test_get_workflow_history_missing_returns_empty(self):
        api = AutomationAPI()
        assert api.get_workflow_history("missing") == []
