import pytest
from src.automationhub.workflows import Workflow, WorkflowEngine, WorkflowStatus


class TestWorkflow:
    def test_create_workflow(self):
        wf = Workflow("Test", "Test workflow")
        assert wf.name == "Test"
        assert wf.status == WorkflowStatus.DRAFT

    def test_add_step(self):
        wf = Workflow("Test", "Test")
        wf.add_step({"name": "step1", "action": "http"})
        assert len(wf.steps) == 1

    def test_add_step_without_name_raises(self):
        wf = Workflow("Test", "Test")
        with pytest.raises(ValueError):
            wf.add_step({"action": "http"})

    def test_activate_requires_steps(self):
        wf = Workflow("Test", "Test")
        with pytest.raises(ValueError):
            wf.activate()

    def test_activate_workflow(self):
        wf = Workflow("Test", "Test")
        wf.add_step({"name": "step1"})
        wf.activate()
        assert wf.status == WorkflowStatus.ACTIVE

    def test_pause_workflow(self):
        wf = Workflow("Test", "Test")
        wf.add_step({"name": "step1"})
        wf.activate()
        wf.pause()
        assert wf.status == WorkflowStatus.PAUSED

    def test_resume_workflow(self):
        wf = Workflow("Test", "Test")
        wf.add_step({"name": "step1"})
        wf.activate()
        wf.pause()
        wf.resume()
        assert wf.status == WorkflowStatus.ACTIVE

    @pytest.mark.asyncio
    async def test_execute_workflow(self):
        wf = Workflow("Test", "Test")
        wf.add_step({"name": "step1"})
        wf.activate()
        result = await wf.execute()
        assert result["status"] == "success"
        assert result["steps_executed"] == 1

    @pytest.mark.asyncio
    async def test_execution_history(self):
        wf = Workflow("Test", "Test")
        wf.add_step({"name": "step1"})
        wf.activate()
        await wf.execute()
        history = wf.get_execution_history()
        assert len(history) > 0

    def test_to_dict(self):
        wf = Workflow("Test", "Description")
        wf.add_step({"name": "step1"})
        data = wf.to_dict()
        assert data["name"] == "Test"
        assert data["steps"] == 1


class TestWorkflowEngine:
    def test_create_workflow(self):
        engine = WorkflowEngine()
        wf = engine.create_workflow("Test", "Test")
        assert wf.id in engine.workflows

    def test_create_workflow_requires_name(self):
        engine = WorkflowEngine()
        with pytest.raises(ValueError):
            engine.create_workflow("", "Test")

    def test_get_workflow(self):
        engine = WorkflowEngine()
        wf = engine.create_workflow("Test", "Test")
        found = engine.get_workflow(wf.id)
        assert found == wf

    def test_list_workflows(self):
        engine = WorkflowEngine()
        engine.create_workflow("WF1", "Test1")
        engine.create_workflow("WF2", "Test2")
        workflows = engine.list_workflows()
        assert len(workflows) == 2

    def test_delete_workflow(self):
        engine = WorkflowEngine()
        wf = engine.create_workflow("Test", "Test")
        result = engine.delete_workflow(wf.id)
        assert result is True
        assert engine.get_workflow(wf.id) is None

    def test_get_active_workflows(self):
        engine = WorkflowEngine()
        wf1 = engine.create_workflow("WF1", "Test")
        wf1.add_step({"name": "step1"})
        wf1.activate()

        wf2 = engine.create_workflow("WF2", "Test")
        active = engine.get_active_workflows()
        assert len(active) == 1
        assert active[0].name == "WF1"
