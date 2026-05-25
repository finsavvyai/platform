"""
Workflow State Manager for Universal Dependency Platform.

Provides comprehensive state persistence, Redis caching, and audit trail
management for LangGraph workflows with PostgreSQL and Redis integration.
"""

import json
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Optional
from uuid import UUID

import redis.asyncio as redis
import structlog
from redis.exceptions import RedisError
from sqlalchemy import and_, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..core.models.workflow_state import (
    WorkflowCheckpointModel,
    WorkflowEventModel,
    WorkflowLockModel,
    WorkflowStateModel,
)
from ..core.services import (
    DatabaseError,
    NotFoundError,
)
from .state import WorkflowStepStatus

logger = structlog.get_logger()


@dataclass
class WorkflowLockInfo:
    """Information about a workflow lock."""

    lock_key: str
    owner_id: str
    acquired_at: datetime
    expires_at: datetime
    lock_data: dict[str, Any]


@dataclass
class WorkflowStateInfo:
    """Information about workflow state."""

    workflow_id: str
    status: str
    step: str
    step_status: dict[str, str]
    state_data: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class WorkflowStateManager:
    """
    Comprehensive workflow state management with Redis caching and PostgreSQL persistence.

    Provides state persistence, caching, recovery, and audit trail functionality
    for LangGraph workflows with enterprise-grade reliability.
    """

    def __init__(
        self, db_session: AsyncSession, redis_client: Optional[redis.Redis] = None
    ):
        self.db_session = db_session
        self.redis_client = redis_client
        self.cache_ttl = 3600  # 1 hour default TTL
        self.lock_ttl = 300  # 5 minutes default lock TTL
        self.state_ttl = 86400  # 24 hours default state TTL

        # Configuration
        self.config = {
            "cache_enabled": redis_client is not None,
            "lock_enabled": True,
            "audit_enabled": True,
            "metrics_enabled": True,
            "checkpoint_interval": 30,  # seconds
            "cleanup_interval": 3600,  # seconds
        }

    async def get_service_dependencies(self) -> dict:
        """Define service dependencies."""
        return {
            "workflow_service": "WorkflowExecutionService",
        }

    async def save_workflow_state(
        self,
        workflow_id: str,
        state_data: dict[str, Any],
        step: str,
        step_status: dict[str, WorkflowStepStatus],
        configuration: Optional[dict[str, Any]] = None,
        metadata: Optional[dict[str, Any]] = None,
        ttl: Optional[int] = None,
    ) -> WorkflowStateModel:
        """
        Save workflow state with both Redis caching and PostgreSQL persistence.

        Args:
            workflow_id: Unique workflow identifier
            state_data: Complete workflow state data
            step: Current workflow step
            step_status: Status of all workflow steps
            configuration: Workflow configuration
            metadata: Additional metadata
            ttl: Time to live in seconds

        Returns:
            WorkflowStateModel instance
        """
        try:
            # Prepare state data for storage
            expires_at = datetime.utcnow() + timedelta(seconds=ttl or self.state_ttl)

            # Update existing state or create new one
            existing_state = await self._get_workflow_state_db(workflow_id)

            if existing_state:
                # Update existing state
                existing_state.step = step
                existing_state.step_status = {
                    k: v.value for k, v in step_status.items()
                }
                existing_state.state_data = state_data
                existing_state.updated_at = datetime.utcnow()
                existing_state.expires_at = expires_at
                if configuration:
                    existing_state.configuration.update(configuration)
                if metadata:
                    existing_state.state_metadata.update(metadata)

                await self.db_session.commit()
                await self.db_session.refresh(existing_state)
                state_model = existing_state
            else:
                # Create new state
                state_model = WorkflowStateModel(
                    workflow_id=workflow_id,
                    workflow_type=configuration.get("workflow_type", "unknown")
                    if configuration
                    else "unknown",
                    project_id=UUID(configuration.get("project_id"))
                    if configuration and configuration.get("project_id")
                    else None,
                    execution_id=UUID(configuration.get("execution_id"))
                    if configuration and configuration.get("execution_id")
                    else None,
                    status=state_data.get("status", "pending"),
                    step=step,
                    step_status={k: v.value for k, v in step_status.items()},
                    state_data=state_data,
                    configuration=configuration or {},
                    results=state_data.get("results", {}),
                    errors=state_data.get("errors", []),
                    state_metadata=metadata or {},
                    expires_at=expires_at,
                )

                self.db_session.add(state_model)
                await self.db_session.commit()
                await self.db_session.refresh(state_model)

            # Cache in Redis if available
            if self.config["cache_enabled"] and self.redis_client:
                await self._cache_workflow_state(
                    workflow_id, state_data, ttl or self.cache_ttl
                )

            # Log state save
            await self._log_workflow_event(
                workflow_id,
                "state_save",
                step,
                {
                    "status": state_model.status,
                    "step_status": state_model.step_status,
                },
            )

            logger.debug(
                "Workflow state saved",
                workflow_id=workflow_id,
                step=step,
                status=state_model.status,
                expires_at=expires_at.isoformat(),
            )

            return state_model

        except Exception as e:
            logger.error(
                f"Failed to save workflow state {workflow_id}: {e}", exc_info=True
            )
            raise DatabaseError(f"Failed to save workflow state: {str(e)}")

    async def get_workflow_state(
        self, workflow_id: str, include_expired: bool = False
    ) -> Optional[WorkflowStateInfo]:
        """
        Get workflow state with Redis caching fallback to PostgreSQL.

        Args:
            workflow_id: Unique workflow identifier
            include_expired: Include expired states in search

        Returns:
            WorkflowStateInfo or None if not found
        """
        try:
            # Try Redis cache first
            if self.config["cache_enabled"] and self.redis_client:
                cached_state = await self._get_cached_workflow_state(workflow_id)
                if cached_state:
                    return cached_state

            # Fallback to database
            state_model = await self._get_workflow_state_db(
                workflow_id, include_expired
            )

            if not state_model:
                return None

            # Convert to info object
            state_info = WorkflowStateInfo(
                workflow_id=state_model.workflow_id,
                status=state_model.status,
                step=state_model.step,
                step_status=state_model.step_status,
                state_data=state_model.state_data,
                created_at=state_model.created_at,
                updated_at=state_model.updated_at,
            )

            # Cache the result if not expired
            if self.config["cache_enabled"] and self.redis_client:
                remaining_ttl = self._calculate_remaining_ttl(state_model.expires_at)
                if remaining_ttl > 0:
                    await self._cache_workflow_state(
                        workflow_id, state_model.state_data, remaining_ttl
                    )

            return state_info

        except Exception as e:
            logger.error(f"Failed to get workflow state {workflow_id}: {e}")
            return None

    async def _get_workflow_state_db(
        self, workflow_id: str, include_expired: bool = False
    ) -> Optional[WorkflowStateModel]:
        """Get workflow state from database."""
        try:
            query = select(WorkflowStateModel).where(
                WorkflowStateModel.workflow_id == workflow_id
            )

            if not include_expired:
                query = query.where(WorkflowStateModel.expires_at > datetime.utcnow())

            result = await self.db_session.execute(query)
            return result.scalar_one_or_none()

        except Exception as e:
            logger.error(
                f"Failed to get workflow state from database {workflow_id}: {e}"
            )
            return None

    async def update_workflow_step_status(
        self,
        workflow_id: str,
        step: str,
        status: WorkflowStepStatus,
        step_data: Optional[dict[str, Any]] = None,
    ) -> bool:
        """
        Update the status of a specific workflow step.

        Args:
            workflow_id: Unique workflow identifier
            step: Step name to update
            status: New step status
            step_data: Additional step data

        Returns:
            True if update successful, False otherwise
        """
        try:
            state_model = await self._get_workflow_state_db(workflow_id)
            if not state_model:
                logger.warning(f"Workflow state not found for {workflow_id}")
                return False

            # Update step status
            if state_model.step_status is None:
                state_model.step_status = {}

            old_status = state_model.step_status.get(step)
            state_model.step_status[step] = status.value
            state_model.updated_at = datetime.utcnow()

            # Add step data if provided
            if step_data:
                if "step_data" not in state_model.state_metadata:
                    state_model.state_metadata["step_data"] = {}
                state_model.state_metadata["step_data"][step] = step_data

            await self.db_session.commit()

            # Log step status change
            await self._log_workflow_event(
                workflow_id,
                "step_status_change",
                step,
                {
                    "old_status": old_status,
                    "new_status": status.value,
                    "step_data": step_data,
                },
            )

            logger.info(
                "Workflow step status updated",
                workflow_id=workflow_id,
                step=step,
                old_status=old_status,
                new_status=status.value,
            )

            return True

        except Exception as e:
            logger.error(f"Failed to update step status for {workflow_id}: {e}")
            return False

    async def create_checkpoint(
        self,
        workflow_id: str,
        checkpoint_id: str,
        step: str,
        state_snapshot: dict[str, Any],
        metadata: Optional[dict[str, Any]] = None,
    ) -> WorkflowCheckpointModel:
        """
        Create a workflow checkpoint for state recovery.

        Args:
            workflow_id: Unique workflow identifier
            checkpoint_id: LangGraph checkpoint identifier
            step: Current workflow step
            state_snapshot: Complete state snapshot
            metadata: Additional checkpoint metadata

        Returns:
            WorkflowCheckpointModel instance
        """
        try:
            # Get workflow state
            state_model = await self._get_workflow_state_db(workflow_id)
            if not state_model:
                raise NotFoundError(f"Workflow state not found for {workflow_id}")

            # Create checkpoint
            checkpoint = WorkflowCheckpointModel(
                workflow_state_id=state_model.id,
                checkpoint_id=checkpoint_id,
                step=step,
                state_snapshot=state_snapshot,
                thread_id=metadata.get("thread_id") if metadata else None,
                task_id=metadata.get("task_id") if metadata else None,
                parent_ts=metadata.get("parent_ts") if metadata else None,
                config_values=metadata.get("config_values", {}) if metadata else {},
            )

            self.db_session.add(checkpoint)
            await self.db_session.commit()
            await self.db_session.refresh(checkpoint)

            # Log checkpoint creation
            await self._log_workflow_event(
                workflow_id,
                "checkpoint_created",
                step,
                {
                    "checkpoint_id": checkpoint_id,
                    "snapshot_size": len(json.dumps(state_snapshot)),
                },
            )

            logger.debug(
                "Workflow checkpoint created",
                workflow_id=workflow_id,
                checkpoint_id=checkpoint_id,
                step=step,
            )

            return checkpoint

        except Exception as e:
            logger.error(f"Failed to create checkpoint for {workflow_id}: {e}")
            raise DatabaseError(f"Failed to create checkpoint: {str(e)}")

    async def restore_from_checkpoint(
        self, checkpoint_id: str
    ) -> Optional[dict[str, Any]]:
        """
        Restore workflow state from checkpoint.

        Args:
            checkpoint_id: Checkpoint identifier

        Returns:
            Restored state snapshot or None if not found
        """
        try:
            query = (
                select(WorkflowCheckpointModel)
                .options(selectinload(WorkflowCheckpointModel.workflow_state))
                .where(WorkflowCheckpointModel.checkpoint_id == checkpoint_id)
            )

            result = await self.db_session.execute(query)
            checkpoint = result.scalar_one_or_none()

            if not checkpoint:
                logger.warning(f"Checkpoint not found: {checkpoint_id}")
                return None

            # Verify checkpoint is not too old
            max_age = timedelta(days=7)  # Configurable checkpoint age limit
            if datetime.utcnow() - checkpoint.created_at > max_age:
                logger.warning(
                    f"Checkpoint too old: {checkpoint_id} (created: {checkpoint.created_at})"
                )
                return None

            # Log checkpoint restoration
            workflow_id = checkpoint.workflow_state.workflow_id
            await self._log_workflow_event(
                workflow_id,
                "checkpoint_restored",
                checkpoint.step,
                {
                    "checkpoint_id": checkpoint_id,
                    "created_at": checkpoint.created_at.isoformat(),
                },
            )

            logger.info(
                "Workflow restored from checkpoint",
                workflow_id=workflow_id,
                checkpoint_id=checkpoint_id,
                step=checkpoint.step,
            )

            return checkpoint.state_snapshot

        except Exception as e:
            logger.error(f"Failed to restore from checkpoint {checkpoint_id}: {e}")
            return None

    async def acquire_lock(
        self,
        lock_key: str,
        workflow_id: str,
        owner_id: str,
        lock_type: str = "execution",
        ttl: Optional[int] = None,
        lock_data: Optional[dict[str, Any]] = None,
    ) -> Optional[WorkflowLockInfo]:
        """
        Acquire a workflow lock for preventing concurrent operations.

        Args:
            lock_key: Unique lock identifier
            workflow_id: Workflow identifier
            owner_id: Lock owner (process/thread ID)
            lock_type: Type of lock (execution, state_update, checkpoint)
            ttl: Lock time to live in seconds
            lock_data: Additional lock data

        Returns:
            WorkflowLockInfo if lock acquired, None if already locked
        """
        try:
            # Check if lock already exists and is not expired
            existing_lock = await self._get_active_lock(lock_key)
            if existing_lock:
                logger.debug(f"Lock already exists: {lock_key}")
                return None

            # Create new lock
            expires_at = datetime.utcnow() + timedelta(seconds=ttl or self.lock_ttl)

            lock_model = WorkflowLockModel(
                lock_key=lock_key,
                workflow_id=workflow_id,
                lock_type=lock_type,
                owner_id=owner_id,
                acquired_at=datetime.utcnow(),
                expires_at=expires_at,
                lock_data=lock_data or {},
            )

            self.db_session.add(lock_model)
            await self.db_session.commit()

            lock_info = WorkflowLockInfo(
                lock_key=lock_key,
                owner_id=owner_id,
                acquired_at=lock_model.acquired_at,
                expires_at=lock_model.expires_at,
                lock_data=lock_model.lock_data,
            )

            logger.debug(
                "Workflow lock acquired",
                lock_key=lock_key,
                workflow_id=workflow_id,
                owner_id=owner_id,
                lock_type=lock_type,
                expires_at=expires_at.isoformat(),
            )

            return lock_info

        except Exception as e:
            logger.error(f"Failed to acquire lock {lock_key}: {e}")
            return None

    async def release_lock(self, lock_key: str, owner_id: str) -> bool:
        """
        Release a workflow lock.

        Args:
            lock_key: Lock identifier to release
            owner_id: Lock owner (must match current owner)

        Returns:
            True if lock released, False if not found or not owner
        """
        try:
            query = select(WorkflowLockModel).where(
                and_(
                    WorkflowLockModel.lock_key == lock_key,
                    WorkflowLockModel.owner_id == owner_id,
                    WorkflowLockModel.expires_at > datetime.utcnow(),
                )
            )

            result = await self.db_session.execute(query)
            lock = result.scalar_one_or_none()

            if not lock:
                logger.warning(f"Lock not found or expired: {lock_key}")
                return False

            # Delete the lock
            await self.db_session.delete(lock)
            await self.db_session.commit()

            logger.debug(
                "Workflow lock released",
                lock_key=lock_key,
                owner_id=owner_id,
            )

            return True

        except Exception as e:
            logger.error(f"Failed to release lock {lock_key}: {e}")
            return False

    async def _get_active_lock(self, lock_key: str) -> Optional[WorkflowLockModel]:
        """Get active lock if it exists and is not expired."""
        try:
            query = select(WorkflowLockModel).where(
                and_(
                    WorkflowLockModel.lock_key == lock_key,
                    WorkflowLockModel.expires_at > datetime.utcnow(),
                )
            )

            result = await self.db_session.execute(query)
            return result.scalar_one_or_none()

        except Exception as e:
            logger.error(f"Failed to get active lock {lock_key}: {e}")
            return None

    async def cleanup_expired_states(self, max_age_days: int = 30) -> int:
        """
        Clean up expired workflow states.

        Args:
            max_age_days: Maximum age in days before cleanup

        Returns:
            Number of states cleaned up
        """
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=max_age_days)

            # Count expired states
            count_query = select(func.count(WorkflowStateModel.id)).where(
                WorkflowStateModel.expires_at < cutoff_date
            )
            count_result = await self.db_session.execute(count_query)
            expired_count = count_result.scalar()

            if expired_count == 0:
                return 0

            # Delete expired states
            delete_query = delete(WorkflowStateModel).where(
                WorkflowStateModel.expires_at < cutoff_date
            )
            await self.db_session.execute(delete_query)
            await self.db_session.commit()

            logger.info(
                "Cleaned up expired workflow states",
                count=expired_count,
                cutoff_date=cutoff_date.isoformat(),
            )

            return expired_count

        except Exception as e:
            logger.error(f"Failed to cleanup expired states: {e}")
            return 0

    async def cleanup_expired_locks(self) -> int:
        """
        Clean up expired workflow locks.

        Returns:
            Number of locks cleaned up
        """
        try:
            # Delete expired locks
            delete_query = delete(WorkflowLockModel).where(
                WorkflowLockModel.expires_at < datetime.utcnow()
            )
            result = await self.db_session.execute(delete_query)
            expired_count = result.rowcount
            await self.db_session.commit()

            if expired_count > 0:
                logger.info(
                    "Cleaned up expired workflow locks",
                    count=expired_count,
                )

            return expired_count

        except Exception as e:
            logger.error(f"Failed to cleanup expired locks: {e}")
            return 0

    async def _cache_workflow_state(
        self, workflow_id: str, state_data: dict[str, Any], ttl: int
    ) -> None:
        """Cache workflow state in Redis."""
        if not self.redis_client:
            return

        try:
            cache_key = f"workflow_state:{workflow_id}"

            # Serialize state data
            serialized_data = json.dumps(state_data, default=str)

            # Store in Redis with TTL
            await self.redis_client.setex(
                cache_key,
                ttl,
                serialized_data,
            )

            # Add to workflow state index
            await self.redis_client.sadd("workflow_states", workflow_id)

            logger.debug(
                "Workflow state cached",
                workflow_id=workflow_id,
                ttl=ttl,
                data_size=len(serialized_data),
            )

        except RedisError as e:
            logger.warning(f"Failed to cache workflow state {workflow_id}: {e}")

    async def _get_cached_workflow_state(
        self, workflow_id: str
    ) -> Optional[dict[str, Any]]:
        """Get workflow state from Redis cache."""
        if not self.redis_client:
            return None

        try:
            cache_key = f"workflow_state:{workflow_id}"

            # Get from Redis
            cached_data = await self.redis_client.get(cache_key)
            if not cached_data:
                return None

            # Deserialize and return
            return json.loads(cached_data)

        except RedisError as e:
            logger.warning(f"Failed to get cached workflow state {workflow_id}: {e}")
            return None

    async def _invalidate_workflow_state_cache(self, workflow_id: str) -> None:
        """Invalidate workflow state cache."""
        if not self.redis_client:
            return

        try:
            cache_key = f"workflow_state:{workflow_id}"

            # Delete from Redis
            await self.redis_client.delete(cache_key)

            # Remove from index
            await self.redis_client.srem("workflow_states", workflow_id)

            logger.debug(
                "Workflow state cache invalidated",
                workflow_id=workflow_id,
            )

        except RedisError as e:
            logger.warning(
                f"Failed to invalidate workflow state cache {workflow_id}: {e}"
            )

    def _calculate_remaining_ttl(self, expires_at: datetime) -> int:
        """Calculate remaining TTL for cached state."""
        if expires_at <= datetime.utcnow():
            return 0

        return int((expires_at - datetime.utcnow()).total_seconds())

    async def _log_workflow_event(
        self,
        workflow_id: str,
        event_type: str,
        step: Optional[str] = None,
        event_data: Optional[dict[str, Any]] = None,
        user_id: Optional[str] = None,
    ) -> None:
        """Log workflow event for audit trail."""
        if not self.config["audit_enabled"]:
            return

        try:
            # Create event record
            event = WorkflowEventModel(
                workflow_id=workflow_id,
                workflow_type="unknown",  # Would be populated from state
                project_id=None,  # Would be populated from state
                execution_id=None,  # Would be populated from state
                event_type=event_type,
                step=step,
                event_data=event_data or {},
                user_id=user_id,
                timestamp=datetime.utcnow(),
            )

            self.db_session.add(event)
            await self.db_session.commit()

            logger.debug(
                "Workflow event logged",
                workflow_id=workflow_id,
                event_type=event_type,
                step=step,
            )

        except Exception as e:
            logger.error(f"Failed to log workflow event: {e}")

    def _log_operation(self, operation: str, details: dict[str, Any]) -> None:
        """Log workflow state manager operations."""
        logger.info(f"WorkflowStateManager.{operation}", **details)
