"""
Agent Lifecycle Management for UPM.Plus agents.

This module provides comprehensive lifecycle management for agents including
creation, initialization, execution, monitoring, and cleanup operations.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, List, Optional, Any
from uuid import UUID

from .base import UPMAgent, Task, TaskResult, TaskStatus, AgentStatus, ExecutionContext
from .registry import AgentRegistry, get_agent_registry


class LifecycleEvent(str, Enum):
    """Agent lifecycle events."""
    CREATED = "created"
    INITIALIZED = "initialized"
    STARTED = "started"
    TASK_ASSIGNED = "task_assigned"
    TASK_COMPLETED = "task_completed"
    TASK_FAILED = "task_failed"
    ERROR = "error"
    STOPPED = "stopped"
    DESTROYED = "destroyed"


class LifecycleEventData:
    """Data associated with a lifecycle event."""
    
    def __init__(
        self,
        event: LifecycleEvent,
        agent_id: UUID,
        timestamp: datetime,
        data: Optional[Dict[str, Any]] = None
    ):
        self.event = event
        self.agent_id = agent_id
        self.timestamp = timestamp
        self.data = data or {}


class AgentLifecycleManager:
    """
    Manages the complete lifecycle of UPM.Plus agents.
    
    Handles agent creation, initialization, task execution monitoring,
    health checks, and cleanup operations.
    """
    
    def __init__(self, registry: Optional[AgentRegistry] = None):
        self.registry = registry or get_agent_registry()
        self.logger = logging.getLogger(self.__class__.__name__)
        
        # Lifecycle tracking
        self._lifecycle_events: Dict[UUID, List[LifecycleEventData]] = {}
        self._active_tasks: Dict[UUID, Task] = {}  # task_id -> task
        self._agent_tasks: Dict[UUID, List[UUID]] = {}  # agent_id -> [task_ids]
        
        # Monitoring
        self._monitoring_enabled = True
        self._monitoring_interval = 30  # seconds
        self._monitoring_task: Optional[asyncio.Task] = None
        
        # Cleanup settings
        self._cleanup_enabled = True
        self._cleanup_interval = 300  # 5 minutes
        self._cleanup_task: Optional[asyncio.Task] = None
        self._max_event_history = 1000
    
    async def start(self):
        """Start the lifecycle manager."""
        self.logger.info("Starting Agent Lifecycle Manager")
        
        if self._monitoring_enabled:
            self._monitoring_task = asyncio.create_task(self._monitoring_loop())
        
        if self._cleanup_enabled:
            self._cleanup_task = asyncio.create_task(self._cleanup_loop())
    
    async def stop(self):
        """Stop the lifecycle manager."""
        self.logger.info("Stopping Agent Lifecycle Manager")
        
        if self._monitoring_task:
            self._monitoring_task.cancel()
            try:
                await self._monitoring_task
            except asyncio.CancelledError:
                pass
        
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
    
    async def create_agent(
        self,
        agent_type: str,
        name: Optional[str] = None,
        **kwargs
    ) -> UPMAgent:
        """
        Create a new agent with full lifecycle management.
        
        Args:
            agent_type: Type of agent to create
            name: Optional name for the agent
            **kwargs: Additional agent configuration
            
        Returns:
            The created agent
        """
        try:
            # Create agent through registry
            agent = await self.registry.create_agent(agent_type, name, **kwargs)
            
            # Initialize lifecycle tracking
            self._lifecycle_events[agent.id] = []
            self._agent_tasks[agent.id] = []
            
            # Record creation event
            await self._record_event(agent.id, LifecycleEvent.CREATED, {
                "agent_type": agent_type,
                "agent_name": agent.name
            })
            
            # Initialize agent
            await self._initialize_agent(agent)
            
            self.logger.info(f"Created agent {agent.name} ({agent.id}) with lifecycle management")
            return agent
            
        except Exception as e:
            self.logger.error(f"Failed to create agent: {e}")
            raise
    
    async def destroy_agent(self, agent_id: UUID) -> bool:
        """
        Destroy an agent and clean up its resources.
        
        Args:
            agent_id: ID of the agent to destroy
            
        Returns:
            True if agent was destroyed, False if not found
        """
        agent = self.registry.get_agent(agent_id)
        if not agent:
            return False
        
        try:
            # Cancel any active tasks
            await self._cancel_agent_tasks(agent_id)
            
            # Cleanup agent resources
            await self._cleanup_agent(agent)
            
            # Deregister from registry
            self.registry.deregister_agent(agent_id)
            
            # Record destruction event
            await self._record_event(agent_id, LifecycleEvent.DESTROYED)
            
            # Clean up lifecycle tracking
            self._lifecycle_events.pop(agent_id, None)
            self._agent_tasks.pop(agent_id, None)
            
            self.logger.info(f"Destroyed agent {agent.name} ({agent_id})")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to destroy agent {agent_id}: {e}")
            await self._record_event(agent_id, LifecycleEvent.ERROR, {"error": str(e)})
            return False
    
    async def execute_task(
        self,
        task: Task,
        context: ExecutionContext,
        agent_id: Optional[UUID] = None
    ) -> TaskResult:
        """
        Execute a task with full lifecycle management.
        
        Args:
            task: The task to execute
            context: Execution context
            agent_id: Optional specific agent ID to use
            
        Returns:
            Task execution result
        """
        # Find suitable agent if not specified
        if agent_id:
            agent = self.registry.get_agent(agent_id)
            if not agent:
                raise ValueError(f"Agent {agent_id} not found")
        else:
            agent = self.registry.get_best_agent_for_task(task)
            if not agent:
                raise ValueError(f"No suitable agent found for task type {task.type}")
        
        # Track task assignment
        self._active_tasks[task.id] = task
        if agent.id not in self._agent_tasks:
            self._agent_tasks[agent.id] = []
        self._agent_tasks[agent.id].append(task.id)
        
        # Record task assignment
        await self._record_event(agent.id, LifecycleEvent.TASK_ASSIGNED, {
            "task_id": str(task.id),
            "task_type": task.type,
            "task_name": task.name
        })
        
        try:
            # Update agent status
            agent.status = AgentStatus.BUSY
            
            # Execute task
            self.logger.info(f"Executing task {task.name} ({task.id}) on agent {agent.name}")
            result = await agent.execute_task(task, context)
            
            # Update agent performance metrics
            agent.update_performance_metrics(result)
            
            # Record completion
            if result.status == TaskStatus.COMPLETED:
                await self._record_event(agent.id, LifecycleEvent.TASK_COMPLETED, {
                    "task_id": str(task.id),
                    "duration_ms": result.duration_ms
                })
            else:
                await self._record_event(agent.id, LifecycleEvent.TASK_FAILED, {
                    "task_id": str(task.id),
                    "error": result.error
                })
            
            return result
            
        except Exception as e:
            self.logger.error(f"Task execution failed: {e}")
            
            # Create error result
            result = TaskResult(
                task_id=task.id,
                status=TaskStatus.FAILED,
                error=str(e),
                started_at=datetime.utcnow(),
                completed_at=datetime.utcnow()
            )
            
            # Record failure
            await self._record_event(agent.id, LifecycleEvent.TASK_FAILED, {
                "task_id": str(task.id),
                "error": str(e)
            })
            
            return result
            
        finally:
            # Cleanup task tracking
            self._active_tasks.pop(task.id, None)
            if agent.id in self._agent_tasks:
                try:
                    self._agent_tasks[agent.id].remove(task.id)
                except ValueError:
                    pass
            
            # Update agent status
            if agent.id in self._agent_tasks and self._agent_tasks[agent.id]:
                agent.status = AgentStatus.BUSY  # Still has tasks
            else:
                agent.status = AgentStatus.IDLE
    
    def get_agent_lifecycle_events(
        self,
        agent_id: UUID,
        event_type: Optional[LifecycleEvent] = None,
        limit: Optional[int] = None
    ) -> List[LifecycleEventData]:
        """
        Get lifecycle events for an agent.
        
        Args:
            agent_id: The agent ID
            event_type: Optional filter by event type
            limit: Optional limit on number of events
            
        Returns:
            List of lifecycle events
        """
        events = self._lifecycle_events.get(agent_id, [])
        
        if event_type:
            events = [e for e in events if e.event == event_type]
        
        # Sort by timestamp (most recent first)
        events.sort(key=lambda e: e.timestamp, reverse=True)
        
        if limit:
            events = events[:limit]
        
        return events
    
    def get_active_tasks(self, agent_id: Optional[UUID] = None) -> Dict[UUID, Task]:
        """
        Get active tasks, optionally filtered by agent.
        
        Args:
            agent_id: Optional agent ID to filter by
            
        Returns:
            Dictionary of active tasks
        """
        if agent_id:
            task_ids = self._agent_tasks.get(agent_id, [])
            return {tid: self._active_tasks[tid] for tid in task_ids if tid in self._active_tasks}
        
        return self._active_tasks.copy()
    
    async def _initialize_agent(self, agent: UPMAgent):
        """Initialize an agent after creation."""
        try:
            # Agent-specific initialization would go here
            # For now, just record the event
            await self._record_event(agent.id, LifecycleEvent.INITIALIZED)
            agent.status = AgentStatus.IDLE
            
        except Exception as e:
            self.logger.error(f"Failed to initialize agent {agent.id}: {e}")
            agent.status = AgentStatus.ERROR
            await self._record_event(agent.id, LifecycleEvent.ERROR, {"error": str(e)})
            raise
    
    async def _cleanup_agent(self, agent: UPMAgent):
        """Clean up agent resources before destruction."""
        try:
            # Agent-specific cleanup would go here
            # For now, just update status
            agent.status = AgentStatus.OFFLINE
            
        except Exception as e:
            self.logger.error(f"Failed to cleanup agent {agent.id}: {e}")
            await self._record_event(agent.id, LifecycleEvent.ERROR, {"error": str(e)})
    
    async def _cancel_agent_tasks(self, agent_id: UUID):
        """Cancel all active tasks for an agent."""
        task_ids = self._agent_tasks.get(agent_id, [])
        for task_id in task_ids[:]:  # Copy list to avoid modification during iteration
            if task_id in self._active_tasks:
                # In a real implementation, we would cancel the task execution
                self.logger.info(f"Cancelling task {task_id} for agent {agent_id}")
                self._active_tasks.pop(task_id, None)
                self._agent_tasks[agent_id].remove(task_id)
    
    async def _record_event(
        self,
        agent_id: UUID,
        event: LifecycleEvent,
        data: Optional[Dict[str, Any]] = None
    ):
        """Record a lifecycle event."""
        event_data = LifecycleEventData(
            event=event,
            agent_id=agent_id,
            timestamp=datetime.utcnow(),
            data=data
        )
        
        if agent_id not in self._lifecycle_events:
            self._lifecycle_events[agent_id] = []
        
        self._lifecycle_events[agent_id].append(event_data)
        
        # Trim event history if too long
        if len(self._lifecycle_events[agent_id]) > self._max_event_history:
            self._lifecycle_events[agent_id] = self._lifecycle_events[agent_id][-self._max_event_history:]
        
        self.logger.debug(f"Recorded event {event} for agent {agent_id}")
    
    async def _monitoring_loop(self):
        """Background monitoring loop for agent health and performance."""
        self.logger.info("Starting agent monitoring loop")
        
        try:
            while True:
                await asyncio.sleep(self._monitoring_interval)
                
                try:
                    # Perform health checks
                    health_results = await self.registry.health_check_all()
                    
                    # Log unhealthy agents
                    if health_results["unhealthy_agents"] > 0:
                        self.logger.warning(
                            f"Found {health_results['unhealthy_agents']} unhealthy agents"
                        )
                    
                    # Check for stuck tasks (tasks running too long)
                    await self._check_stuck_tasks()
                    
                except Exception as e:
                    self.logger.error(f"Error in monitoring loop: {e}")
                    
        except asyncio.CancelledError:
            self.logger.info("Agent monitoring loop cancelled")
            raise
    
    async def _cleanup_loop(self):
        """Background cleanup loop for old events and resources."""
        self.logger.info("Starting cleanup loop")
        
        try:
            while True:
                await asyncio.sleep(self._cleanup_interval)
                
                try:
                    # Clean up old lifecycle events
                    cutoff_time = datetime.utcnow() - timedelta(hours=24)
                    
                    for agent_id, events in self._lifecycle_events.items():
                        old_count = len(events)
                        self._lifecycle_events[agent_id] = [
                            e for e in events if e.timestamp > cutoff_time
                        ]
                        new_count = len(self._lifecycle_events[agent_id])
                        
                        if old_count > new_count:
                            self.logger.debug(
                                f"Cleaned up {old_count - new_count} old events for agent {agent_id}"
                            )
                    
                except Exception as e:
                    self.logger.error(f"Error in cleanup loop: {e}")
                    
        except asyncio.CancelledError:
            self.logger.info("Cleanup loop cancelled")
            raise
    
    async def _check_stuck_tasks(self):
        """Check for tasks that have been running too long."""
        current_time = datetime.utcnow()
        stuck_threshold = timedelta(minutes=30)  # Tasks running longer than 30 minutes
        
        for task_id, task in self._active_tasks.items():
            task_age = current_time - task.created_at
            
            if task_age > stuck_threshold:
                self.logger.warning(f"Task {task_id} has been running for {task_age}")
                
                # Find the agent running this task
                for agent_id, task_ids in self._agent_tasks.items():
                    if task_id in task_ids:
                        await self._record_event(agent_id, LifecycleEvent.ERROR, {
                            "task_id": str(task_id),
                            "error": f"Task stuck for {task_age}"
                        })
                        break


# Global lifecycle manager instance
_lifecycle_manager: Optional[AgentLifecycleManager] = None


def get_lifecycle_manager() -> AgentLifecycleManager:
    """Get the global lifecycle manager instance."""
    global _lifecycle_manager
    if _lifecycle_manager is None:
        _lifecycle_manager = AgentLifecycleManager()
    return _lifecycle_manager