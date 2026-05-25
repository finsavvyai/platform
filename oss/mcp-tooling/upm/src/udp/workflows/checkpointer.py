"""
PostgreSQL-based checkpointer for LangGraph workflows with Universal Package Manager support.

Provides persistent state management for workflows with enhanced polyglot project
state tracking and cross-ecosystem resolution checkpointing.
"""

from datetime import datetime
from typing import Any, Optional
from uuid import UUID, uuid4

import structlog
from langgraph.checkpoint.base import (
    BaseCheckpointSaver,
    Checkpoint,
    CheckpointMetadata,
)
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from udp.core.database import get_async_session
from udp.infrastructure.models import AuditLogModel, WorkflowModel
from udp.workflows.state import PolyglotProjectState, UniversalPackageIdentifier

logger = structlog.get_logger()


class PostgreSQLCheckpointSaver(BaseCheckpointSaver):
    """
    PostgreSQL-based checkpoint saver for LangGraph workflows.

    Provides persistent state management with enhanced support for Universal
    Package Manager operations and polyglot project state tracking.
    """

    def __init__(self, organization_id: UUID):
        self.organization_id = organization_id
        super().__init__()

    async def aget_tuple(self, config: dict[str, Any]) -> Optional[tuple[Checkpoint, CheckpointMetadata]]:
        """Get checkpoint tuple from database."""

        workflow_id = config.get("configurable", {}).get("thread_id")
        if not workflow_id:
            return None

        async with get_async_session() as session:
            return await self._get_checkpoint_from_db(workflow_id, session)

    async def _get_checkpoint_from_db(
        self,
        workflow_id: str,
        session: AsyncSession
    ) -> Optional[tuple[Checkpoint, CheckpointMetadata]]:
        """Get checkpoint from database implementation."""

        stmt = select(WorkflowModel).where(
            WorkflowModel.workflow_id == workflow_id,
            WorkflowModel.organization_id == self.organization_id
        )
        result = await session.execute(stmt)
        workflow = result.scalar_one_or_none()

        if not workflow:
            return None

        try:
            # Reconstruct checkpoint from workflow data
            checkpoint_data = {
                "workflow_id": workflow.workflow_id,
                "workflow_type": workflow.workflow_type,
                "organization_id": workflow.organization_id,
                "status": workflow.status,
                "current_state": workflow.current_state,
                "input_data": workflow.input_data,
                "output_data": workflow.output_data,
                "started_at": workflow.started_at.isoformat() if workflow.started_at else None,
                "completed_at": workflow.completed_at.isoformat() if workflow.completed_at else None,
                "checkpoints": workflow.checkpoints,
                "polyglot_project_data": workflow.polyglot_project_data,
                "universal_packages": workflow.universal_packages,
                "cross_ecosystem_resolution": workflow.cross_ecosystem_resolution,
                "universal_audit_trail": workflow.universal_audit_trail,
                "project_languages": workflow.project_languages
            }

            checkpoint = Checkpoint(
                v=1,
                ts=workflow.updated_at.isoformat() if workflow.updated_at else datetime.utcnow().isoformat(),
                id=str(workflow.id),
                channel_values=checkpoint_data,
                channel_versions={},
                versions_seen={}
            )

            metadata = CheckpointMetadata(
                source="database",
                step=len(workflow.checkpoints),
                writes={}
            )

            return (checkpoint, metadata)

        except Exception as e:
            logger.error(
                "Failed to reconstruct checkpoint",
                workflow_id=workflow_id,
                error=str(e)
            )
            return None

    async def aput(
        self,
        config: dict[str, Any],
        checkpoint: Checkpoint,
        metadata: CheckpointMetadata
    ) -> None:
        """Save checkpoint to database."""

        workflow_id = config.get("configurable", {}).get("thread_id")
        if not workflow_id:
            raise ValueError("No workflow_id in config")

        async with get_async_session() as session:
            await self._save_checkpoint_to_db(workflow_id, checkpoint, metadata, session)

    async def _save_checkpoint_to_db(
        self,
        workflow_id: str,
        checkpoint: Checkpoint,
        metadata: CheckpointMetadata,
        session: AsyncSession
    ) -> None:
        """Save checkpoint to database implementation."""

        try:
            channel_values = checkpoint.channel_values

            # Check if workflow exists
            stmt = select(WorkflowModel).where(
                WorkflowModel.workflow_id == workflow_id,
                WorkflowModel.organization_id == self.organization_id
            )
            result = await session.execute(stmt)
            workflow = result.scalar_one_or_none()

            checkpoint_entry = {
                "checkpoint_id": checkpoint.id,
                "timestamp": checkpoint.ts,
                "step": metadata.step,
                "channel_values": channel_values,
                "metadata": metadata.writes
            }

            if workflow:
                # Update existing workflow
                checkpoints = workflow.checkpoints or []
                checkpoints.append(checkpoint_entry)

                update_data = {
                    "current_state": channel_values.get("current_state"),
                    "status": channel_values.get("status"),
                    "output_data": channel_values.get("output_data"),
                    "checkpoints": checkpoints,
                    "updated_at": datetime.utcnow()
                }

                # Update Universal Package Manager fields if present
                if "polyglot_project_data" in channel_values:
                    update_data["polyglot_project_data"] = channel_values["polyglot_project_data"]
                if "universal_packages" in channel_values:
                    update_data["universal_packages"] = channel_values["universal_packages"]
                if "cross_ecosystem_resolution" in channel_values:
                    update_data["cross_ecosystem_resolution"] = channel_values["cross_ecosystem_resolution"]
                if "universal_audit_trail" in channel_values:
                    update_data["universal_audit_trail"] = channel_values["universal_audit_trail"]
                if "project_languages" in channel_values:
                    update_data["project_languages"] = channel_values["project_languages"]

                stmt = update(WorkflowModel).where(
                    WorkflowModel.workflow_id == workflow_id,
                    WorkflowModel.organization_id == self.organization_id
                ).values(**update_data)

                await session.execute(stmt)

            else:
                # Create new workflow
                new_workflow = WorkflowModel(
                    workflow_id=workflow_id,
                    name=channel_values.get("workflow_type", "unknown"),
                    workflow_type=channel_values.get("workflow_type", "unknown"),
                    organization_id=self.organization_id,
                    initiator_id=channel_values.get("initiator_id", "system"),
                    status=channel_values.get("status"),
                    input_data=channel_values.get("input_data", {}),
                    output_data=channel_values.get("output_data"),
                    current_state=channel_values.get("current_state"),
                    started_at=datetime.fromisoformat(channel_values["started_at"]) if channel_values.get("started_at") else datetime.utcnow(),
                    completed_at=datetime.fromisoformat(channel_values["completed_at"]) if channel_values.get("completed_at") else None,
                    checkpoints=[checkpoint_entry],
                    polyglot_project_data=channel_values.get("polyglot_project_data"),
                    universal_packages=channel_values.get("universal_packages", []),
                    cross_ecosystem_resolution=channel_values.get("cross_ecosystem_resolution", {}),
                    universal_audit_trail=channel_values.get("universal_audit_trail", []),
                    project_languages=channel_values.get("project_languages", [])
                )

                session.add(new_workflow)

            await session.commit()

            # Log checkpoint audit trail
            await self._log_checkpoint_audit(
                workflow_id, checkpoint.id, metadata.step, session
            )

            logger.debug(
                "Saved workflow checkpoint",
                workflow_id=workflow_id,
                checkpoint_id=checkpoint.id,
                step=metadata.step
            )

        except Exception as e:
            logger.error(
                "Failed to save checkpoint",
                workflow_id=workflow_id,
                error=str(e)
            )
            await session.rollback()
            raise

    async def alist(
        self,
        config: dict[str, Any],
        limit: int = 10,
        before: Optional[str] = None
    ) -> list[tuple[Checkpoint, CheckpointMetadata]]:
        """List checkpoints for a workflow."""

        workflow_id = config.get("configurable", {}).get("thread_id")
        if not workflow_id:
            return []

        async with get_async_session() as session:
            return await self._list_checkpoints_from_db(workflow_id, limit, before, session)

    async def _list_checkpoints_from_db(
        self,
        workflow_id: str,
        limit: int,
        before: Optional[str],
        session: AsyncSession
    ) -> list[tuple[Checkpoint, CheckpointMetadata]]:
        """List checkpoints from database implementation."""

        stmt = select(WorkflowModel).where(
            WorkflowModel.workflow_id == workflow_id,
            WorkflowModel.organization_id == self.organization_id
        )
        result = await session.execute(stmt)
        workflow = result.scalar_one_or_none()

        if not workflow or not workflow.checkpoints:
            return []

        checkpoints = []
        checkpoint_entries = workflow.checkpoints[-limit:]  # Get last N checkpoints

        for entry in checkpoint_entries:
            try:
                checkpoint = Checkpoint(
                    v=1,
                    ts=entry["timestamp"],
                    id=entry["checkpoint_id"],
                    channel_values=entry["channel_values"],
                    channel_versions={},
                    versions_seen={}
                )

                metadata = CheckpointMetadata(
                    source="database",
                    step=entry["step"],
                    writes=entry.get("metadata", {})
                )

                checkpoints.append((checkpoint, metadata))

            except Exception as e:
                logger.warning(
                    "Failed to reconstruct checkpoint entry",
                    workflow_id=workflow_id,
                    checkpoint_id=entry.get("checkpoint_id"),
                    error=str(e)
                )
                continue

        return checkpoints

    async def adelete(self, config: dict[str, Any]) -> None:
        """Delete workflow and its checkpoints."""

        workflow_id = config.get("configurable", {}).get("thread_id")
        if not workflow_id:
            return

        async with get_async_session() as session:
            await self._delete_workflow_from_db(workflow_id, session)

    async def _delete_workflow_from_db(self, workflow_id: str, session: AsyncSession) -> None:
        """Delete workflow from database implementation."""

        try:
            stmt = delete(WorkflowModel).where(
                WorkflowModel.workflow_id == workflow_id,
                WorkflowModel.organization_id == self.organization_id
            )
            await session.execute(stmt)
            await session.commit()

            # Log deletion audit trail
            await self._log_checkpoint_audit(
                workflow_id, "deleted", -1, session, action="delete_workflow"
            )

            logger.info(
                "Deleted workflow and checkpoints",
                workflow_id=workflow_id,
                organization_id=self.organization_id
            )

        except Exception as e:
            logger.error(
                "Failed to delete workflow",
                workflow_id=workflow_id,
                error=str(e)
            )
            await session.rollback()
            raise

    async def _log_checkpoint_audit(
        self,
        workflow_id: str,
        checkpoint_id: str,
        step: int,
        session: AsyncSession,
        action: str = "save_checkpoint"
    ) -> None:
        """Log checkpoint operation to audit trail."""

        audit_log = AuditLogModel(
            organization_id=self.organization_id,
            entity_type="workflow_checkpoint",
            entity_id=None,
            action=action,
            user_id="system",
            success=True,
            request_id=str(uuid4()),
            changes={
                "workflow_id": workflow_id,
                "checkpoint_id": checkpoint_id,
                "step": step
            }
        )

        session.add(audit_log)
        await session.commit()

    async def get_polyglot_project_state(
        self,
        workflow_id: str
    ) -> Optional[PolyglotProjectState]:
        """Get polyglot project state from workflow checkpoint."""

        async with get_async_session() as session:
            stmt = select(WorkflowModel).where(
                WorkflowModel.workflow_id == workflow_id,
                WorkflowModel.organization_id == self.organization_id
            )
            result = await session.execute(stmt)
            workflow = result.scalar_one_or_none()

            if not workflow or not workflow.polyglot_project_data:
                return None

            return workflow.polyglot_project_data

    async def update_universal_packages(
        self,
        workflow_id: str,
        universal_packages: list[UniversalPackageIdentifier]
    ) -> None:
        """Update universal packages in workflow state."""

        async with get_async_session() as session:
            stmt = update(WorkflowModel).where(
                WorkflowModel.workflow_id == workflow_id,
                WorkflowModel.organization_id == self.organization_id
            ).values(
                universal_packages=[pkg for pkg in universal_packages],
                updated_at=datetime.utcnow()
            )

            await session.execute(stmt)
            await session.commit()

            # Log audit trail
            await self._log_checkpoint_audit(
                workflow_id, "universal_packages_update", -1, session,
                action="update_universal_packages"
            )

    async def get_cross_ecosystem_resolution(
        self,
        workflow_id: str
    ) -> Optional[dict[str, Any]]:
        """Get cross-ecosystem resolution data from workflow."""

        async with get_async_session() as session:
            stmt = select(WorkflowModel).where(
                WorkflowModel.workflow_id == workflow_id,
                WorkflowModel.organization_id == self.organization_id
            )
            result = await session.execute(stmt)
            workflow = result.scalar_one_or_none()

            if not workflow:
                return None

            return workflow.cross_ecosystem_resolution

    async def update_cross_ecosystem_resolution(
        self,
        workflow_id: str,
        resolution_data: dict[str, Any]
    ) -> None:
        """Update cross-ecosystem resolution data in workflow state."""

        async with get_async_session() as session:
            stmt = update(WorkflowModel).where(
                WorkflowModel.workflow_id == workflow_id,
                WorkflowModel.organization_id == self.organization_id
            ).values(
                cross_ecosystem_resolution=resolution_data,
                updated_at=datetime.utcnow()
            )

            await session.execute(stmt)
            await session.commit()

            # Log audit trail
            await self._log_checkpoint_audit(
                workflow_id, "cross_ecosystem_resolution_update", -1, session,
                action="update_cross_ecosystem_resolution"
            )


class UniversalPackageCheckpointManager:
    """
    Manager for Universal Package Manager checkpoint operations.

    Provides high-level interface for managing polyglot project state
    and cross-ecosystem resolution checkpointing.
    """

    def __init__(self, organization_id: UUID):
        self.organization_id = organization_id
        self.checkpointer = PostgreSQLCheckpointSaver(organization_id)

    async def save_polyglot_project_checkpoint(
        self,
        workflow_id: str,
        project_state: PolyglotProjectState,
        universal_packages: list[UniversalPackageIdentifier],
        resolution_data: dict[str, Any]
    ) -> None:
        """Save comprehensive polyglot project checkpoint."""

        # Create checkpoint data
        checkpoint_data = {
            "workflow_id": workflow_id,
            "workflow_type": "polyglot_dependency_analysis",
            "organization_id": self.organization_id,
            "current_state": "polyglot_resolution",
            "polyglot_project_data": project_state,
            "universal_packages": universal_packages,
            "cross_ecosystem_resolution": resolution_data,
            "project_languages": project_state["project_languages"],
            "universal_audit_trail": []
        }

        checkpoint = Checkpoint(
            v=1,
            ts=datetime.utcnow().isoformat(),
            id=str(uuid4()),
            channel_values=checkpoint_data,
            channel_versions={},
            versions_seen={}
        )

        metadata = CheckpointMetadata(
            source="universal_package_manager",
            step=1,
            writes={}
        )

        config = {
            "configurable": {
                "thread_id": workflow_id
            }
        }

        await self.checkpointer.aput(config, checkpoint, metadata)

        logger.info(
            "Saved polyglot project checkpoint",
            workflow_id=workflow_id,
            languages=len(project_state["project_languages"]),
            universal_packages=len(universal_packages),
            organization_id=self.organization_id
        )

    async def restore_polyglot_project_state(
        self,
        workflow_id: str
    ) -> Optional[tuple[PolyglotProjectState, list[UniversalPackageIdentifier], dict[str, Any]]]:
        """Restore polyglot project state from checkpoint."""

        config = {
            "configurable": {
                "thread_id": workflow_id
            }
        }

        checkpoint_tuple = await self.checkpointer.aget_tuple(config)
        if not checkpoint_tuple:
            return None

        checkpoint, metadata = checkpoint_tuple
        channel_values = checkpoint.channel_values

        project_state = channel_values.get("polyglot_project_data")
        universal_packages = channel_values.get("universal_packages", [])
        resolution_data = channel_values.get("cross_ecosystem_resolution", {})

        if not project_state:
            return None

        logger.info(
            "Restored polyglot project state",
            workflow_id=workflow_id,
            checkpoint_id=checkpoint.id,
            organization_id=self.organization_id
        )

        return project_state, universal_packages, resolution_data
