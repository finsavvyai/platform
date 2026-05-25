"""
Workflow service for Universal Dependency Platform.
"""

from datetime import UTC, datetime
from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from udp.core.models.workflow import (
    Workflow,
    WorkflowApproval,
    WorkflowExecution,
)
from udp.core.schemas.workflow import (
    ExecutionStatus,
    WorkflowCreate,
    WorkflowExecutionCreate,
    WorkflowStatus,
    WorkflowUpdate,
)


class WorkflowService:
    """Workflow service class."""

    def __init__(self, db: AsyncSession):
        """Initialize workflow service."""
        self.db = db

    async def create(self, workflow_data: WorkflowCreate, created_by: str) -> Workflow:
        """Create a new workflow."""
        db_workflow = Workflow(
            name=workflow_data.name,
            description=workflow_data.description,
            workflow_type=workflow_data.workflow_type.value,
            definition=workflow_data.definition,
            is_active=workflow_data.is_active,
            timeout_minutes=str(workflow_data.timeout_minutes),
            tags=workflow_data.tags,
            status=WorkflowStatus.PENDING.value,
            created_by=created_by,
        )

        self.db.add(db_workflow)
        await self.db.commit()
        await self.db.refresh(db_workflow)

        return db_workflow

    async def get(self, workflow_id: str) -> Optional[Workflow]:
        """Get workflow by ID."""
        from uuid import UUID

        try:
            workflow_uuid = UUID(workflow_id)
        except ValueError:
            return None

        result = await self.db.execute(
            select(Workflow).where(Workflow.id == workflow_uuid)
        )
        return result.scalar_one_or_none()

    async def list(
        self,
        skip: int = 0,
        limit: int = 100,
        workflow_type: Optional[str] = None,
        status: Optional[str] = None,
    ) -> list[Workflow]:
        """List workflows with filtering and pagination."""
        query = select(Workflow)

        if workflow_type:
            query = query.where(Workflow.workflow_type == workflow_type)

        if status:
            query = query.where(Workflow.status == status)

        query = query.offset(skip).limit(limit).order_by(Workflow.created_at.desc())

        result = await self.db.execute(query)
        return result.scalars().all()

    async def update(
        self, workflow_id: str, workflow_data: WorkflowUpdate
    ) -> Optional[Workflow]:
        """Update workflow."""
        db_workflow = await self.get(workflow_id)
        if not db_workflow:
            return None

        update_data = workflow_data.dict(exclude_unset=True)

        for field, value in update_data.items():
            if hasattr(value, "value"):  # Handle enum values
                setattr(db_workflow, field, value.value)
            else:
                setattr(db_workflow, field, value)

        await self.db.commit()
        await self.db.refresh(db_workflow)

        return db_workflow

    async def delete(self, workflow_id: str) -> bool:
        """Delete workflow."""
        db_workflow = await self.get(workflow_id)
        if not db_workflow:
            return False

        await self.db.delete(db_workflow)
        await self.db.commit()

        return True

    async def execute(
        self, workflow_id: str, execution_data: WorkflowExecutionCreate, started_by: str
    ) -> WorkflowExecution:
        """Execute a workflow."""
        workflow = await self.get(workflow_id)
        if not workflow:
            raise ValueError("Workflow not found")

        # Create execution record
        db_execution = WorkflowExecution(
            workflow_id=workflow.id,
            input_data=execution_data.input_data,
            context=execution_data.context,
            status=ExecutionStatus.PENDING.value,
            started_by=started_by,
            started_at=datetime.now(UTC),
            priority=str(execution_data.priority),
            execution_logs=[],
        )

        self.db.add(db_execution)
        await self.db.commit()
        await self.db.refresh(db_execution)

        # Start workflow execution (simplified)
        await self._start_execution(db_execution, workflow)

        return db_execution

    async def get_execution(self, execution_id: str) -> Optional[WorkflowExecution]:
        """Get workflow execution by ID."""
        from uuid import UUID

        try:
            execution_uuid = UUID(execution_id)
        except ValueError:
            return None

        result = await self.db.execute(
            select(WorkflowExecution).where(WorkflowExecution.id == execution_uuid)
        )
        return result.scalar_one_or_none()

    async def list_executions(
        self, workflow_id: str, skip: int = 0, limit: int = 100
    ) -> List[WorkflowExecution]:
        """List workflow executions."""
        from uuid import UUID

        try:
            workflow_uuid = UUID(workflow_id)
        except ValueError:
            return []

        result = await self.db.execute(
            select(WorkflowExecution)
            .where(WorkflowExecution.workflow_id == workflow_uuid)
            .offset(skip)
            .limit(limit)
            .order_by(WorkflowExecution.started_at.desc())
        )
        return result.scalars().all()

    async def _start_execution(
        self, execution: WorkflowExecution, workflow: Workflow
    ) -> None:
        """Start workflow execution (simplified implementation)."""
        # This is a mock implementation
        # In a real system, you would use LangGraph to orchestrate the workflow

        execution.status = ExecutionStatus.RUNNING.value
        execution.execution_logs.append(f"Starting workflow execution: {workflow.name}")

        # Simulate workflow steps
        steps = workflow.definition.get("steps", [])
        for i, step in enumerate(steps):
            step_log = (
                f"Executing step {i + 1}/{len(steps)}: {step.get('name', 'Unknown')}"
            )
            execution.execution_logs.append(step_log)

            # Update progress
            execution.progress = (i + 1) / len(steps) * 100 if steps else 100

        # Complete execution
        execution.status = ExecutionStatus.COMPLETED.value
        execution.completed_at = datetime.now(UTC)
        execution.progress = 100.0
        execution.result = {
            "status": "completed",
            "message": "Workflow executed successfully",
        }
        execution.execution_logs.append("Workflow execution completed")

        await self.db.commit()

    async def create_approval(
        self,
        execution_id: str,
        approver_id: str,
        status: str = "pending",
        comment: Optional[str] = None,
    ) -> WorkflowApproval:
        """Create workflow approval."""
        db_approval = WorkflowApproval(
            execution_id=execution_id,
            approver_id=approver_id,
            status=status,
            comment=comment,
        )

        self.db.add(db_approval)
        await self.db.commit()
        await self.db.refresh(db_approval)

        return db_approval

    async def update_approval(
        self, approval_id: str, status: str, comment: Optional[str] = None
    ) -> Optional[WorkflowApproval]:
        """Update workflow approval."""
        from uuid import UUID

        try:
            approval_uuid = UUID(approval_id)
        except ValueError:
            return None

        result = await self.db.execute(
            select(WorkflowApproval).where(WorkflowApproval.id == approval_uuid)
        )
        approval = result.scalar_one_or_none()

        if not approval:
            return None

        approval.status = status
        if comment:
            approval.comment = comment

        if status in ["approved", "rejected"]:
            approval.approved_at = datetime.now(UTC)

        await self.db.commit()
        await self.db.refresh(approval)

        return approval
