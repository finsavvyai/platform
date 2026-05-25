"""
Production-Grade Enhanced Agent Registry

This module provides a comprehensive, production-ready agent registry with
dynamic registration, advanced health monitoring, failover capabilities,
and performance optimization.
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Set, Type, Union, Callable, Any
from uuid import UUID, uuid4
from dataclasses import dataclass, asdict
from enum import Enum
import redis.asyncio as redis

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_, or_

from app.core.database import get_db
from app.core.redis import redis_client
from app.models.agent import Agent as AgentModel
from .base import UPMAgent, Task, TaskType, AgentStatus, Capability
from .registry import AgentRegistry, AgentRegistryError, AgentNotFoundError


class RegistrationStatus(str, Enum):
    """Agent registration status."""
    PENDING = "pending"
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    TERMINATING = "terminating"


class LoadBalancingStrategy(str, Enum):
    """Load balancing strategies for agent selection."""
    ROUND_ROBIN = "round_robin"
    LEAST_CONNECTIONS = "least_connections"
    WEIGHTED_ROUND_ROBIN = "weighted_round_robin"
    RESPONSE_TIME = "response_time"
    PERFORMANCE_BASED = "performance_based"


@dataclass
class AgentRegistration:
    """Agent registration information."""
    agent_id: UUID
    agent_type: str
    name: str
    description: Optional[str] = None
    capabilities: List[str] = None
    status: RegistrationStatus = RegistrationStatus.PENDING
    weight: float = 1.0
    max_concurrent_tasks: int = 10
    current_tasks: int = 0
    last_heartbeat: datetime = None
    created_at: datetime = None
    updated_at: datetime = None
    metadata: Dict[str, Any] = None

    def __post_init__(self):
        if self.capabilities is None:
            self.capabilities = []
        if self.last_heartbeat is None:
            self.last_heartbeat = datetime.utcnow()
        if self.created_at is None:
            self.created_at = datetime.utcnow()
        if self.updated_at is None:
            self.updated_at = datetime.utcnow()
        if self.metadata is None:
            self.metadata = {}

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "agent_id": str(self.agent_id),
            "agent_type": self.agent_type,
            "name": self.name,
            "description": self.description,
            "capabilities": self.capabilities,
            "status": self.status,
            "weight": self.weight,
            "max_concurrent_tasks": self.max_concurrent_tasks,
            "current_tasks": self.current_tasks,
            "last_heartbeat": self.last_heartbeat.isoformat(),
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "metadata": self.metadata
        }


@dataclass
class FailoverConfig:
    """Failover configuration for agent groups."""
    agent_group: str
    primary_agents: List[UUID]
    backup_agents: List[UUID]
    failover_threshold: float = 0.5  # Percentage of primary agents that must fail
    health_check_interval: int = 30  # seconds
    auto_failback: bool = True
    failback_delay: int = 300  # seconds


class EnhancedAgentRegistry:
    """
    Production-grade enhanced agent registry with advanced features.

    Provides comprehensive agent management, health monitoring, load balancing,
    failover capabilities, and performance optimization.
    """

    def __init__(self):
        self.logger = logging.getLogger(self.__class__.__name__)

        # Basic registry (inheritance)
        self._base_registry = AgentRegistry()

        # Enhanced features
        self._registrations: Dict[UUID, AgentRegistration] = {}
        self._load_balancing_strategy = LoadBalancingStrategy.PERFORMANCE_BASED
        self._round_robin_index: Dict[str, int] = {}
        self._failover_configs: Dict[str, FailoverConfig] = {}

        # Performance tracking
        self._agent_performance: Dict[UUID, Dict[str, Any]] = {}
        self._task_assignments: Dict[UUID, Set[UUID]] = {}  # agent_id -> set of task_ids

        # Background tasks
        self._heartbeat_task: Optional[asyncio.Task] = None
        self._cleanup_task: Optional[asyncio.Task] = None
        self._failover_task: Optional[asyncio.Task] = None

        # Configuration
        self._heartbeat_timeout = 120  # seconds
        self._cleanup_interval = 300   # seconds
        self._performance_retention_hours = 24

    async def start(self):
        """Start the enhanced registry services."""
        self.logger.info("Starting Enhanced Agent Registry")

        # Start background tasks
        self._heartbeat_task = asyncio.create_task(self._heartbeat_monitoring_loop())
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())
        self._failover_task = asyncio.create_task(self._failover_monitoring_loop())

        # Load existing registrations from database
        await self._load_registrations_from_db()

        self.logger.info("Enhanced Agent Registry started")

    async def stop(self):
        """Stop the enhanced registry services."""
        self.logger.info("Stopping Enhanced Agent Registry")

        # Cancel background tasks
        if self._heartbeat_task:
            self._heartbeat_task.cancel()
        if self._cleanup_task:
            self._cleanup_task.cancel()
        if self._failover_task:
            self._failover_task.cancel()

        # Wait for tasks to complete
        await asyncio.gather(
            self._heartbeat_task,
            self._cleanup_task,
            self._failover_task,
            return_exceptions=True
        )

        self.logger.info("Enhanced Agent Registry stopped")

    async def register_agent_enhanced(
        self,
        agent: UPMAgent,
        metadata: Optional[Dict[str, Any]] = None,
        weight: float = 1.0,
        max_concurrent_tasks: int = 10
    ) -> UUID:
        """
        Register an agent with enhanced features.

        Args:
            agent: The agent instance to register
            metadata: Additional metadata for the agent
            weight: Weight for load balancing (higher = more tasks)
            max_concurrent_tasks: Maximum concurrent tasks for this agent

        Returns:
            The agent's UUID

        Raises:
            AgentRegistryError: If agent registration fails
        """
        try:
            # Register with base registry first
            await self._base_registry.register_agent(agent)

            # Create enhanced registration
            registration = AgentRegistration(
                agent_id=agent.id,
                agent_type=agent.__class__.__name__,
                name=agent.name,
                description=getattr(agent, 'description', None),
                capabilities=[cap.name for cap in agent.capabilities],
                status=RegistrationStatus.ACTIVE,
                weight=weight,
                max_concurrent_tasks=max_concurrent_tasks,
                current_tasks=0,
                last_heartbeat=datetime.utcnow(),
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
                metadata=metadata or {}
            )

            # Store registration
            self._registrations[agent.id] = registration

            # Initialize performance tracking
            self._agent_performance[agent.id] = {
                "total_tasks": 0,
                "successful_tasks": 0,
                "failed_tasks": 0,
                "average_response_time": 0.0,
                "last_assignment": None,
                "uptime_start": datetime.utcnow()
            }

            # Initialize task assignments tracking
            self._task_assignments[agent.id] = set()

            # Store in database
            await self._store_registration_in_db(registration)

            # Store in Redis for fast access
            await self._cache_registration(registration)

            self.logger.info(f"Enhanced registration completed for agent: {agent.name} ({agent.id})")
            return agent.id

        except Exception as e:
            self.logger.error(f"Failed to register agent {agent.id}: {e}")
            raise AgentRegistryError(f"Agent registration failed: {str(e)}")

    async def deregister_agent_enhanced(self, agent_id: UUID) -> bool:
        """
        Deregister an agent with cleanup.

        Args:
            agent_id: The ID of the agent to deregister

        Returns:
            True if agent was deregistered, False if not found
        """
        try:
            # Check if agent has active tasks
            if agent_id in self._task_assignments and self._task_assignments[agent_id]:
                self.logger.warning(f"Agent {agent_id} has active tasks, marking as terminating")
                # Mark as terminating instead of immediate removal
                if agent_id in self._registrations:
                    self._registrations[agent_id].status = RegistrationStatus.TERMINATING
                return False

            # Deregister from base registry
            self._base_registry.deregister_agent(agent_id)

            # Remove from enhanced registry
            if agent_id in self._registrations:
                del self._registrations[agent_id]

            # Clean up performance tracking
            if agent_id in self._agent_performance:
                del self._agent_performance[agent_id]

            # Clean up task assignments
            if agent_id in self._task_assignments:
                del self._task_assignments[agent_id]

            # Remove from database
            await self._remove_registration_from_db(agent_id)

            # Remove from Redis cache
            await self._uncache_registration(agent_id)

            self.logger.info(f"Enhanced deregistration completed for agent: {agent_id}")
            return True

        except Exception as e:
            self.logger.error(f"Failed to deregister agent {agent_id}: {e}")
            return False

    async def update_agent_heartbeat(self, agent_id: UUID) -> bool:
        """
        Update agent heartbeat timestamp.

        Args:
            agent_id: The agent ID

        Returns:
            True if heartbeat was updated, False if agent not found
        """
        if agent_id in self._registrations:
            self._registrations[agent_id].last_heartbeat = datetime.utcnow()
            self._registrations[agent_id].updated_at = datetime.utcnow()

            # Update in Redis cache
            await self._cache_registration(self._registrations[agent_id])

            return True
        return False

    async def assign_task_to_agent(
        self,
        task: Task,
        strategy: Optional[LoadBalancingStrategy] = None
    ) -> Optional[UUID]:
        """
        Assign a task to the best available agent using load balancing.

        Args:
            task: The task to assign
            strategy: Load balancing strategy to use

        Returns:
            The assigned agent ID or None if no suitable agent found
        """
        try:
            strategy = strategy or self._load_balancing_strategy
            suitable_agents = await self._get_suitable_agents(task)

            if not suitable_agents:
                self.logger.warning(f"No suitable agents found for task {task.id}")
                return None

            # Apply load balancing strategy
            selected_agent_id = await self._select_agent_with_strategy(
                suitable_agents, strategy, task
            )

            if selected_agent_id:
                # Update task assignment tracking
                self._task_assignments[selected_agent_id].add(task.id)
                self._registrations[selected_agent_id].current_tasks = len(self._task_assignments[selected_agent_id])

                # Update performance metrics
                perf = self._agent_performance[selected_agent_id]
                perf["total_tasks"] += 1
                perf["last_assignment"] = datetime.utcnow()

                self.logger.info(f"Assigned task {task.id} to agent {selected_agent_id}")
                return selected_agent_id

            return None

        except Exception as e:
            self.logger.error(f"Failed to assign task {task.id}: {e}")
            return None

    async def release_task_from_agent(self, agent_id: UUID, task_id: UUID):
        """
        Release a task from an agent.

        Args:
            agent_id: The agent ID
            task_id: The task ID
        """
        if agent_id in self._task_assignments:
            self._task_assignments[agent_id].discard(task_id)

            if agent_id in self._registrations:
                self._registrations[agent_id].current_tasks = len(self._task_assignments[agent_id])

        self.logger.debug(f"Released task {task_id} from agent {agent_id}")

    async def record_task_completion(
        self,
        agent_id: UUID,
        task_id: UUID,
        success: bool,
        execution_time_ms: Optional[float] = None
    ):
        """
        Record task completion for agent performance tracking.

        Args:
            agent_id: The agent ID
            task_id: The task ID
            success: Whether the task completed successfully
            execution_time_ms: Task execution time in milliseconds
        """
        if agent_id not in self._agent_performance:
            return

        perf = self._agent_performance[agent_id]

        if success:
            perf["successful_tasks"] += 1
        else:
            perf["failed_tasks"] += 1

        # Update average response time
        if execution_time_ms is not None:
            current_avg = perf["average_response_time"]
            completed_tasks = perf["successful_tasks"] + perf["failed_tasks"]

            if completed_tasks == 1:
                perf["average_response_time"] = execution_time_ms
            else:
                # Exponential moving average
                alpha = 0.2  # Smoothing factor
                perf["average_response_time"] = (
                    alpha * execution_time_ms + (1 - alpha) * current_avg
                )

        # Release the task
        await self.release_task_from_agent(agent_id, task_id)

        self.logger.debug(f"Recorded task completion for agent {agent_id}: success={success}")

    async def configure_failover(self, config: FailoverConfig):
        """
        Configure failover for a group of agents.

        Args:
            config: Failover configuration
        """
        self._failover_configs[config.agent_group] = config

        # Store in Redis for persistence
        await self._store_failover_config(config)

        self.logger.info(f"Configured failover for group: {config.agent_group}")

    async def get_agent_registration(self, agent_id: UUID) -> Optional[AgentRegistration]:
        """
        Get enhanced registration information for an agent.

        Args:
            agent_id: The agent ID

        Returns:
            Agent registration or None if not found
        """
        # Try memory cache first
        if agent_id in self._registrations:
            return self._registrations[agent_id]

        # Try Redis cache
        cached = await self._get_cached_registration(agent_id)
        if cached:
            self._registrations[agent_id] = cached
            return cached

        # Try database
        db_registration = await self._get_registration_from_db(agent_id)
        if db_registration:
            self._registrations[agent_id] = db_registration
            return db_registration

        return None

    async def list_agents_enhanced(
        self,
        status_filter: Optional[RegistrationStatus] = None,
        capability_filter: Optional[str] = None,
        agent_type_filter: Optional[str] = None
    ) -> List[AgentRegistration]:
        """
        List agents with enhanced filtering options.

        Args:
            status_filter: Filter by registration status
            capability_filter: Filter by capability
            agent_type_filter: Filter by agent type

        Returns:
            List of matching agent registrations
        """
        registrations = list(self._registrations.values())

        if status_filter:
            registrations = [r for r in registrations if r.status == status_filter]

        if capability_filter:
            registrations = [
                r for r in registrations
                if capability_filter in r.capabilities
            ]

        if agent_type_filter:
            registrations = [r for r in registrations if r.agent_type == agent_type_filter]

        return registrations

    async def get_registry_stats_enhanced(self) -> Dict[str, Any]:
        """
        Get enhanced registry statistics.

        Returns:
            Dictionary containing comprehensive registry statistics
        """
        total_agents = len(self._registrations)
        status_counts = {}
        type_counts = {}
        total_current_tasks = 0
        total_max_tasks = 0

        for reg in self._registrations.values():
            # Count by status
            status_counts[reg.status] = status_counts.get(reg.status, 0) + 1

            # Count by type
            type_counts[reg.agent_type] = type_counts.get(reg.agent_type, 0) + 1

            # Task capacity
            total_current_tasks += reg.current_tasks
            total_max_tasks += reg.max_concurrent_tasks

        # Performance statistics
        performance_stats = {}
        for agent_id, perf in self._agent_performance.items():
            total_tasks = perf["successful_tasks"] + perf["failed_tasks"]
            success_rate = perf["successful_tasks"] / total_tasks if total_tasks > 0 else 0

            performance_stats[str(agent_id)] = {
                "total_tasks": total_tasks,
                "success_rate": success_rate,
                "average_response_time_ms": perf["average_response_time"]
            }

        return {
            "timestamp": datetime.utcnow().isoformat(),
            "total_agents": total_agents,
            "status_distribution": status_counts,
            "type_distribution": type_counts,
            "task_capacity": {
                "current": total_current_tasks,
                "maximum": total_max_tasks,
                "utilization_percent": (total_current_tasks / total_max_tasks * 100) if total_max_tasks > 0 else 0
            },
            "load_balancing_strategy": self._load_balancing_strategy,
            "failover_groups": len(self._failover_configs),
            "performance_stats": performance_stats
        }

    async def _get_suitable_agents(self, task: Task) -> List[UUID]:
        """Get list of agents suitable for the task."""
        # Get basic suitable agents from base registry
        from .base import Task
        base_task = Task(
            id=task.id,
            type=task.type,
            name=task.name,
            description=task.description,
            parameters=task.parameters,
            dependencies=task.dependencies,
            priority=task.priority
        )

        suitable_agent_instances = self._base_registry.find_agents_for_task(base_task)

        # Filter by enhanced criteria
        suitable_ids = []
        for agent in suitable_agent_instances:
            if agent.id not in self._registrations:
                continue

            reg = self._registrations[agent.id]

            # Check status
            if reg.status != RegistrationStatus.ACTIVE:
                continue

            # Check capacity
            if reg.current_tasks >= reg.max_concurrent_tasks:
                continue

            # Check heartbeat
            if (datetime.utcnow() - reg.last_heartbeat).total_seconds() > self._heartbeat_timeout:
                continue

            suitable_ids.append(agent.id)

        return suitable_ids

    async def _select_agent_with_strategy(
        self,
        agent_ids: List[UUID],
        strategy: LoadBalancingStrategy,
        task: Task
    ) -> Optional[UUID]:
        """Select an agent using the specified strategy."""
        if not agent_ids:
            return None

        try:
            if strategy == LoadBalancingStrategy.ROUND_ROBIN:
                return await self._select_round_robin(agent_ids)

            elif strategy == LoadBalancingStrategy.LEAST_CONNECTIONS:
                return await self._select_least_connections(agent_ids)

            elif strategy == LoadBalancingStrategy.WEIGHTED_ROUND_ROBIN:
                return await self._select_weighted_round_robin(agent_ids)

            elif strategy == LoadBalancingStrategy.RESPONSE_TIME:
                return await self._select_by_response_time(agent_ids)

            elif strategy == LoadBalancingStrategy.PERFORMANCE_BASED:
                return await self._select_by_performance(agent_ids)

            else:
                # Default to first agent
                return agent_ids[0]

        except Exception as e:
            self.logger.error(f"Agent selection failed with strategy {strategy}: {e}")
            return agent_ids[0] if agent_ids else None

    async def _select_round_robin(self, agent_ids: List[UUID]) -> UUID:
        """Select agent using round-robin strategy."""
        strategy_key = "round_robin"
        index = self._round_robin_index.get(strategy_key, 0)

        selected_id = agent_ids[index % len(agent_ids)]
        self._round_robin_index[strategy_key] = (index + 1) % len(agent_ids)

        return selected_id

    async def _select_least_connections(self, agent_ids: List[UUID]) -> UUID:
        """Select agent with least current connections."""
        min_tasks = float('inf')
        selected_id = agent_ids[0]

        for agent_id in agent_ids:
            current_tasks = len(self._task_assignments.get(agent_id, set()))
            if current_tasks < min_tasks:
                min_tasks = current_tasks
                selected_id = agent_id

        return selected_id

    async def _select_weighted_round_robin(self, agent_ids: List[UUID]) -> UUID:
        """Select agent using weighted round-robin."""
        weights = []
        for agent_id in agent_ids:
            reg = self._registrations.get(agent_id)
            weight = reg.weight if reg else 1.0
            weights.append(weight)

        # Simple weighted selection
        total_weight = sum(weights)
        if total_weight == 0:
            return agent_ids[0]

        import random
        r = random.uniform(0, total_weight)
        upto = 0

        for i, weight in enumerate(weights):
            if upto + weight >= r:
                return agent_ids[i]
            upto += weight

        return agent_ids[-1]

    async def _select_by_response_time(self, agent_ids: List[UUID]) -> UUID:
        """Select agent with best response time."""
        best_time = float('inf')
        selected_id = agent_ids[0]

        for agent_id in agent_ids:
            perf = self._agent_performance.get(agent_id, {})
            response_time = perf.get("average_response_time", float('inf'))

            if response_time < best_time:
                best_time = response_time
                selected_id = agent_id

        return selected_id

    async def _select_by_performance(self, agent_ids: List[UUID]) -> UUID:
        """Select agent based on overall performance."""
        best_score = -1
        selected_id = agent_ids[0]

        for agent_id in agent_ids:
            perf = self._agent_performance.get(agent_id, {})
            total_tasks = perf.get("successful_tasks", 0) + perf.get("failed_tasks", 0)

            if total_tasks == 0:
                score = 0.5  # Neutral score for new agents
            else:
                success_rate = perf.get("successful_tasks", 0) / total_tasks
                response_time = perf.get("average_response_time", 1000)

                # Calculate performance score (success_rate / response_time)
                score = success_rate / (response_time / 1000) if response_time > 0 else 0

            # Consider current load
            reg = self._registrations.get(agent_id)
            if reg:
                load_factor = 1 - (reg.current_tasks / reg.max_concurrent_tasks)
                score *= load_factor

            if score > best_score:
                best_score = score
                selected_id = agent_id

        return selected_id

    async def _store_registration_in_db(self, registration: AgentRegistration):
        """Store registration in database."""
        try:
            async with get_db() as db:
                # Check if agent exists
                existing = await db.execute(
                    select(AgentModel).where(AgentModel.id == registration.agent_id)
                )
                agent_db = existing.scalar_one_or_none()

                if agent_db:
                    # Update existing
                    await db.execute(
                        update(AgentModel)
                        .where(AgentModel.id == registration.agent_id)
                        .values(
                            status="active" if registration.status == RegistrationStatus.ACTIVE else registration.status,
                            last_active=registration.last_heartbeat,
                            updated_at=registration.updated_at
                        )
                    )
                else:
                    # Create new
                    new_agent = AgentModel(
                        id=registration.agent_id,
                        name=registration.name,
                        description=registration.description,
                        agent_type=registration.agent_type,
                        capabilities=registration.capabilities,
                        status="active",
                        settings=registration.metadata,
                        last_active=registration.last_heartbeat
                    )
                    db.add(new_agent)

                await db.commit()

        except Exception as e:
            self.logger.error(f"Failed to store registration in DB: {e}")

    async def _cache_registration(self, registration: AgentRegistration):
        """Cache registration in Redis."""
        try:
            key = f"agent:registration:{registration.agent_id}"
            await redis_client.setex(
                key,
                timedelta(hours=1),
                json.dumps(registration.to_dict())
            )
        except Exception as e:
            self.logger.error(f"Failed to cache registration: {e}")

    async def _get_cached_registration(self, agent_id: UUID) -> Optional[AgentRegistration]:
        """Get registration from Redis cache."""
        try:
            key = f"agent:registration:{agent_id}"
            cached_data = await redis_client.get(key)

            if cached_data:
                data = json.loads(cached_data)
                return AgentRegistration(
                    agent_id=UUID(data["agent_id"]),
                    agent_type=data["agent_type"],
                    name=data["name"],
                    description=data.get("description"),
                    capabilities=data["capabilities"],
                    status=RegistrationStatus(data["status"]),
                    weight=data.get("weight", 1.0),
                    max_concurrent_tasks=data.get("max_concurrent_tasks", 10),
                    current_tasks=data.get("current_tasks", 0),
                    last_heartbeat=datetime.fromisoformat(data["last_heartbeat"]),
                    created_at=datetime.fromisoformat(data["created_at"]),
                    updated_at=datetime.fromisoformat(data["updated_at"]),
                    metadata=data.get("metadata", {})
                )
        except Exception as e:
            self.logger.error(f"Failed to get cached registration: {e}")

        return None

    async def _heartbeat_monitoring_loop(self):
        """Background loop for heartbeat monitoring."""
        while True:
            try:
                current_time = datetime.utcnow()
                timeout_threshold = timedelta(seconds=self._heartbeat_timeout)

                for agent_id, registration in self._registrations.items():
                    if current_time - registration.last_heartbeat > timeout_threshold:
                        if registration.status == RegistrationStatus.ACTIVE:
                            self.logger.warning(f"Agent {agent_id} heartbeat timeout, marking as inactive")
                            registration.status = RegistrationStatus.INACTIVE
                            await self._cache_registration(registration)

                await asyncio.sleep(30)  # Check every 30 seconds

            except asyncio.CancelledError:
                break
            except Exception as e:
                self.logger.error(f"Heartbeat monitoring loop error: {e}")
                await asyncio.sleep(5)

    async def _cleanup_loop(self):
        """Background loop for cleanup operations."""
        while True:
            try:
                # Clean up terminated agents
                terminated_agents = [
                    agent_id for agent_id, reg in self._registrations.items()
                    if reg.status == RegistrationStatus.TERMINATING and reg.current_tasks == 0
                ]

                for agent_id in terminated_agents:
                    await self.deregister_agent_enhanced(agent_id)

                # Clean up old performance data
                cutoff_time = datetime.utcnow() - timedelta(hours=self._performance_retention_hours)
                # Implementation would depend on your storage strategy

                await asyncio.sleep(self._cleanup_interval)

            except asyncio.CancelledError:
                break
            except Exception as e:
                self.logger.error(f"Cleanup loop error: {e}")
                await asyncio.sleep(60)

    async def _failover_monitoring_loop(self):
        """Background loop for failover monitoring."""
        while True:
            try:
                for group_name, config in self._failover_configs.items():
                    await self._check_failover_group(group_name, config)

                await asyncio.sleep(config.health_check_interval)

            except asyncio.CancelledError:
                break
            except Exception as e:
                self.logger.error(f"Failover monitoring loop error: {e}")
                await asyncio.sleep(30)

    async def _check_failover_group(self, group_name: str, config: FailoverConfig):
        """Check failover status for an agent group."""
        try:
            # Check health of primary agents
            healthy_primaries = 0
            for agent_id in config.primary_agents:
                reg = self._registrations.get(agent_id)
                if reg and reg.status == RegistrationStatus.ACTIVE:
                    healthy_primaries += 1

            # Calculate failure percentage
            failure_rate = 1 - (healthy_primaries / len(config.primary_agents)) if config.primary_agents else 1

            if failure_rate >= config.failover_threshold:
                await self._trigger_failover(group_name, config)
            elif config.auto_failback:
                await self._check_failback(group_name, config)

        except Exception as e:
            self.logger.error(f"Failed to check failover group {group_name}: {e}")

    async def _trigger_failover(self, group_name: str, config: FailoverConfig):
        """Trigger failover to backup agents."""
        self.logger.warning(f"Triggering failover for group: {group_name}")

        # Mark primary agents as inactive
        for agent_id in config.primary_agents:
            if agent_id in self._registrations:
                self._registrations[agent_id].status = RegistrationStatus.INACTIVE
                await self._cache_registration(self._registrations[agent_id])

        # Activate backup agents
        for agent_id in config.backup_agents:
            if agent_id in self._registrations:
                self._registrations[agent_id].status = RegistrationStatus.ACTIVE
                await self._cache_registration(self._registrations[agent_id])

    async def _check_failback(self, group_name: str, config: FailoverConfig):
        """Check if we can fail back to primary agents."""
        # Implementation would check if primary agents are healthy again
        # and trigger failback if conditions are met
        pass

    # Additional helper methods for database operations would go here
    async def _load_registrations_from_db(self):
        """Load existing registrations from database."""
        try:
            async with get_db() as db:
                result = await db.execute(
                    select(AgentModel).where(AgentModel.is_enabled == True)
                )
                agents = result.scalars().all()

                for agent_db in agents:
                    registration = AgentRegistration(
                        agent_id=agent_db.id,
                        agent_type=agent_db.agent_type,
                        name=agent_db.name,
                        description=agent_db.description,
                        capabilities=agent_db.capabilities or [],
                        status=RegistrationStatus.ACTIVE if agent_db.status == "active" else RegistrationStatus.INACTIVE,
                        weight=1.0,
                        max_concurrent_tasks=10,
                        current_tasks=0,
                        last_heartbeat=agent_db.last_active or datetime.utcnow(),
                        created_at=agent_db.created_at,
                        updated_at=agent_db.updated_at or datetime.utcnow(),
                        metadata=agent_db.settings or {}
                    )
                    self._registrations[agent_db.id] = registration

        except Exception as e:
            self.logger.error(f"Failed to load registrations from DB: {e}")

    async def _remove_registration_from_db(self, agent_id: UUID):
        """Remove registration from database."""
        try:
            async with get_db() as db:
                await db.execute(
                    delete(AgentModel).where(AgentModel.id == agent_id)
                )
                await db.commit()
        except Exception as e:
            self.logger.error(f"Failed to remove registration from DB: {e}")

    async def _uncache_registration(self, agent_id: UUID):
        """Remove registration from Redis cache."""
        try:
            key = f"agent:registration:{agent_id}"
            await redis_client.delete(key)
        except Exception as e:
            self.logger.error(f"Failed to uncache registration: {e}")

    async def _get_registration_from_db(self, agent_id: UUID) -> Optional[AgentRegistration]:
        """Get registration from database."""
        try:
            async with get_db() as db:
                result = await db.execute(
                    select(AgentModel).where(AgentModel.id == agent_id)
                )
                agent_db = result.scalar_one_or_none()

                if agent_db:
                    return AgentRegistration(
                        agent_id=agent_db.id,
                        agent_type=agent_db.agent_type,
                        name=agent_db.name,
                        description=agent_db.description,
                        capabilities=agent_db.capabilities or [],
                        status=RegistrationStatus.ACTIVE if agent_db.status == "active" else RegistrationStatus.INACTIVE,
                        weight=1.0,
                        max_concurrent_tasks=10,
                        current_tasks=0,
                        last_heartbeat=agent_db.last_active or datetime.utcnow(),
                        created_at=agent_db.created_at,
                        updated_at=agent_db.updated_at or datetime.utcnow(),
                        metadata=agent_db.settings or {}
                    )
        except Exception as e:
            self.logger.error(f"Failed to get registration from DB: {e}")

        return None

    async def _store_failover_config(self, config: FailoverConfig):
        """Store failover configuration in Redis."""
        try:
            key = f"failover:config:{config.agent_group}"
            config_data = {
                "agent_group": config.agent_group,
                "primary_agents": [str(a) for a in config.primary_agents],
                "backup_agents": [str(a) for a in config.backup_agents],
                "failover_threshold": config.failover_threshold,
                "health_check_interval": config.health_check_interval,
                "auto_failback": config.auto_failback,
                "failback_delay": config.failback_delay
            }
            await redis_client.setex(
                key,
                timedelta(days=7),
                json.dumps(config_data)
            )
        except Exception as e:
            self.logger.error(f"Failed to store failover config: {e}")


# Global enhanced registry instance
enhanced_registry = EnhancedAgentRegistry()


def get_enhanced_registry() -> EnhancedAgentRegistry:
    """Get the global enhanced registry instance."""
    return enhanced_registry