"""
Workflow service for UPM workflow management.

Handles workflow execution, state management, and
workflow-related operations.
"""

import logging
from typing import Optional
from uuid import UUID

from ..core.models import Workflow
from ..core.services import BaseService, ValidationError


class WorkflowService(BaseService):
    """
    Service for managing workflow operations.

    Handles workflow execution, state management,
    and workflow-related business logic.
    """

    model_class = Workflow

    async def get_service_dependencies(self) -> dict[str, type]:
        """Define service dependencies."""
        return {
            "project_service": "ProjectService",
            "policy_service": "PolicyService",
        }

    async def create_workflow(
        self,
        name: str,
        project_id: UUID,
        workflow_type: str,
        configuration: dict = None,
        **kwargs,
    ) -> Workflow:
        """Create a new workflow."""
        data = {
            "name": name,
            "project_id": str(project_id),
            "workflow_type": workflow_type,
            "configuration": configuration or {},
            **kwargs,
        }

        return await self.create(data)

    async def start_workflow(self, workflow_id: UUID) -> Workflow:
        """Start workflow execution."""
        workflow = await self.get_by_id(workflow_id)

        # Update workflow status
        workflow.status = "running"
        workflow.started_at = logging.datetime.utcnow().isoformat()

        return await self.update(
            workflow_id, {"status": workflow.status, "started_at": workflow.started_at}
        )

    async def complete_workflow(
        self, workflow_id: UUID, results: dict = None
    ) -> Workflow:
        """Complete workflow execution."""
        workflow = await self.get_by_id(workflow_id)

        # Update workflow status
        workflow.status = "completed"
        workflow.completed_at = logging.datetime.utcnow().isoformat()
        workflow.results = results or {}

        return await self.update(
            workflow_id,
            {
                "status": workflow.status,
                "completed_at": workflow.completed_at,
                "results": workflow.results,
            },
        )

    async def fail_workflow(
        self, workflow_id: UUID, error_message: str, error_details: dict = None
    ) -> Workflow:
        """Fail workflow execution."""
        workflow = await self.get_by_id(workflow_id)

        # Update workflow status
        workflow.status = "failed"
        workflow.failed_at = logging.datetime.utcnow().isoformat()
        workflow.error_message = error_message
        workflow.error_details = error_details or {}

        return await self.update(
            workflow_id,
            {
                "status": workflow.status,
                "failed_at": workflow.failed_at,
                "error_message": error_message,
                "error_details": workflow.error_details,
            },
        )

    async def get_workflows_by_project(
        self, project_id: UUID, status_filter: Optional[str] = None
    ) -> list[Workflow]:
        """Get all workflows for a project."""
        filters = {"project_id": str(project_id)}
        if status_filter:
            filters["status"] = status_filter

        workflows = await self.list_all(filters=filters)
        return workflows

    async def get_workflow_executions(self, workflow_id: UUID) -> list[dict]:
        """Get execution history for a workflow."""
        # This would query execution history
        # For now, return empty list
        return []

    async def create_dependency_analysis_workflow(self, project_id: UUID) -> Workflow:
        """Create a dependency analysis workflow."""
        workflow_data = {
            "name": "Dependency Analysis",
            "project_id": str(project_id),
            "workflow_type": "dependency_analysis",
            "configuration": {
                "scan_all_dependencies": True,
                "check_vulnerabilities": True,
                "generate_report": True,
            },
        }

        return await self.create_workflow(**workflow_data)

    async def create_security_scan_workflow(self, project_id: UUID) -> Workflow:
        """Create a security scan workflow."""
        workflow_data = {
            "name": "Security Scan",
            "project_id": str(project_id),
            "workflow_type": "security_scan",
            "configuration": {
                "vulnerability_scan": True,
                "compliance_check": True,
                "generate_security_report": True,
            },
        }

        return await self.create_workflow(**workflow_data)

    async def create_compliance_check_workflow(
        self, project_id: UUID, policy_ids: list[UUID] = None
    ) -> Workflow:
        """Create a compliance check workflow."""
        workflow_data = {
            "name": "Compliance Check",
            "project_id": str(project_id),
            "workflow_type": "compliance_check",
            "configuration": {
                "policy_ids": [str(pid) for pid in policy_ids] if policy_ids else [],
                "generate_report": True,
            },
        }

        return await self.create_workflow(**workflow_data)

    async def monitor_workflow_progress(self, workflow_id: UUID) -> dict[str, any]:
        """Monitor workflow progress."""
        workflow = await self.get_by_id(workflow_id)

        # This would integrate with actual workflow monitoring
        # For now, return basic status information
        return {
            "workflow_id": str(workflow_id),
            "status": workflow.status,
            "progress": 100 if workflow.status == "completed" else 0,
            "started_at": getattr(workflow, "started_at", None),
            "completed_at": getattr(workflow, "completed_at", None),
            "failed_at": getattr(workflow, "failed_at", None),
            "error_message": getattr(workflow, "error_message", None),
        }

    async def cancel_workflow(self, workflow_id: UUID) -> Workflow:
        """Cancel a running workflow."""
        workflow = await self.get_by_id(workflow_id)

        if workflow.status not in ["pending", "running"]:
            raise ValidationError(f"Cannot cancel workflow in {workflow.status} status")

        # Update workflow status
        workflow.status = "cancelled"
        workflow.cancelled_at = logging.datetime.utcnow().isoformat()

        return await self.update(
            workflow_id,
            {"status": workflow.status, "cancelled_at": workflow.cancelled_at},
        )

    async def retry_workflow(self, workflow_id: UUID) -> Workflow:
        """Retry a failed workflow."""
        workflow = await self.get_by_id(workflow_id)

        if workflow.status != "failed":
            raise ValidationError(f"Cannot retry workflow in {workflow.status} status")

        # Reset workflow status for retry
        workflow.status = "pending"
        workflow.retry_count = getattr(workflow, "retry_count", 0) + 1
        workflow.error_message = None
        workflow.error_details = {}

        return await self.update(
            workflow_id,
            {
                "status": workflow.status,
                "retry_count": workflow.retry_count,
                "error_message": workflow.error_message,
                "error_details": workflow.error_details,
                "started_at": None,
                "completed_at": None,
                "failed_at": None,
                "cancelled_at": None,
            },
        )

    async def get_workflow_statistics(self, project_id: UUID) -> dict[str, any]:
        """Get workflow statistics for a project."""
        workflows = await self.get_workflows_by_project(project_id)

        status_counts = {}
        for workflow in workflows:
            status = workflow.status
            status_counts[status] = status_counts.get(status, 0) + 1

        total_workflows = len(workflows)
        completed_workflows = status_counts.get("completed", 0)
        failed_workflows = status_counts.get("failed", 0)
        success_rate = (
            (completed_workflows / total_workflows * 100) if total_workflows > 0 else 0
        )

        return {
            "project_id": str(project_id),
            "total_workflows": total_workflows,
            "status_breakdown": status_counts,
            "success_rate": success_rate,
            "failure_rate": (failed_workflows / total_workflows * 100)
            if total_workflows > 0
            else 0,
        }
