import uuid
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional


class WorkflowStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"


class Workflow:
    def __init__(self, name: str, description: str):
        self.id = str(uuid.uuid4())
        self.name = name
        self.description = description
        self.status = WorkflowStatus.DRAFT
        self.steps: List[Dict[str, Any]] = []
        self.created_at = datetime.now()
        self.updated_at = datetime.now()
        self.execution_history: List[Dict[str, Any]] = []

    def add_step(self, step: Dict[str, Any]) -> None:
        if not step.get("name"):
            raise ValueError("Step must have a name")
        self.steps.append(step)
        self.updated_at = datetime.now()

    def activate(self) -> None:
        if not self.steps:
            raise ValueError("Workflow must have at least one step")
        self.status = WorkflowStatus.ACTIVE

    def pause(self) -> None:
        self.status = WorkflowStatus.PAUSED

    def resume(self) -> None:
        if self.status == WorkflowStatus.PAUSED:
            self.status = WorkflowStatus.ACTIVE

    async def execute(self) -> Dict[str, Any]:
        if self.status != WorkflowStatus.ACTIVE:
            raise ValueError("Workflow must be active to execute")

        execution = {
            "execution_id": str(uuid.uuid4()),
            "workflow_id": self.id,
            "started_at": datetime.now(),
            "steps_executed": 0,
            "status": "running",
        }

        for i, step in enumerate(self.steps):
            execution["steps_executed"] = i + 1

        execution["completed_at"] = datetime.now()
        execution["status"] = "success"
        self.execution_history.append(execution)
        return execution

    def get_execution_history(self, limit: int = 10) -> List[Dict[str, Any]]:
        return self.execution_history[-limit:]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "status": self.status.value,
            "steps": len(self.steps),
            "created_at": self.created_at.isoformat(),
        }


class WorkflowEngine:
    def __init__(self):
        self.workflows: Dict[str, Workflow] = {}

    def create_workflow(self, name: str, description: str) -> Workflow:
        if not name:
            raise ValueError("Workflow name is required")
        workflow = Workflow(name, description)
        self.workflows[workflow.id] = workflow
        return workflow

    def get_workflow(self, workflow_id: str) -> Optional[Workflow]:
        return self.workflows.get(workflow_id)

    def list_workflows(self) -> List[Workflow]:
        return list(self.workflows.values())

    def delete_workflow(self, workflow_id: str) -> bool:
        if workflow_id in self.workflows:
            del self.workflows[workflow_id]
            return True
        return False

    def get_active_workflows(self) -> List[Workflow]:
        return [w for w in self.workflows.values() if w.status == WorkflowStatus.ACTIVE]
