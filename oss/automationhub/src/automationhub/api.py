from typing import Any, Dict, List, Optional

from .workflows import WorkflowEngine
from .actions import Action, ActionExecutor
from .triggers import TriggerManager, TriggerType


class AutomationAPI:
    def __init__(self):
        self.workflow_engine = WorkflowEngine()
        self.action_executor = ActionExecutor()
        self.trigger_manager = TriggerManager()

    def create_workflow(self, name: str, description: str) -> Dict[str, Any]:
        workflow = self.workflow_engine.create_workflow(name, description)
        return workflow.to_dict()

    def get_workflow(self, workflow_id: str) -> Optional[Dict[str, Any]]:
        workflow = self.workflow_engine.get_workflow(workflow_id)
        return workflow.to_dict() if workflow else None

    def list_workflows(self) -> List[Dict[str, Any]]:
        return [w.to_dict() for w in self.workflow_engine.list_workflows()]

    def activate_workflow(self, workflow_id: str) -> bool:
        workflow = self.workflow_engine.get_workflow(workflow_id)
        if workflow:
            try:
                workflow.activate()
                return True
            except ValueError:
                return False
        return False

    def pause_workflow(self, workflow_id: str) -> bool:
        workflow = self.workflow_engine.get_workflow(workflow_id)
        if workflow:
            workflow.pause()
            return True
        return False

    async def execute_workflow(self, workflow_id: str) -> Dict[str, Any]:
        workflow = self.workflow_engine.get_workflow(workflow_id)
        if not workflow:
            raise ValueError(f"Workflow {workflow_id} not found")
        return await workflow.execute()

    def register_trigger(
        self, name: str, trigger_type: str, config: Optional[Dict[str, Any]] = None
    ) -> Dict[str, str]:
        parsed_type = TriggerType(trigger_type)
        resolved_config = config or {}
        if parsed_type == TriggerType.EVENT and "event_name" not in resolved_config:
            resolved_config["event_name"] = name
        trigger = self.trigger_manager.create_trigger(name, parsed_type, resolved_config)
        return {"trigger_id": trigger.id, "name": trigger.name}

    def list_triggers(self) -> List[Dict[str, str]]:
        return [
            {"id": t.id, "name": t.name, "type": t.trigger_type.value}
            for t in self.trigger_manager.list_triggers()
        ]

    def register_action(self, action: Action) -> Dict[str, str]:
        self.action_executor.register_action(action)
        return {"action_id": action.id, "name": action.name}

    def list_actions(self) -> List[Dict[str, str]]:
        return [
            {"id": a.id, "name": a.name, "type": a.action_type.value}
            for a in self.action_executor.list_actions()
        ]

    def get_workflow_history(self, workflow_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        workflow = self.workflow_engine.get_workflow(workflow_id)
        if workflow:
            return workflow.get_execution_history(limit)
        return []
