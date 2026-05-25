"""
Automatic Failover and Load Balancing Manager

This module provides comprehensive failover management, load balancing,
circuit breaker patterns, and automatic recovery mechanisms for the UPM.Plus agent system.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Set, Tuple, Union, Any, Callable
from uuid import UUID, uuid4
from dataclasses import dataclass, field
from enum import Enum
import json
import redis.asyncio as redis
import random
from collections import defaultdict, deque
import time

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_

from app.core.database import get_db
from app.core.redis import redis_client
from app.models.agent import Agent
from app.agents.base import UPMAgent, AgentStatus, TaskType
from app.agents.enhanced_registry import LoadBalancingStrategy
from app.services.agent_health import AgentHealthMonitor, get_health_monitor
from app.services.performance_analytics import PerformanceAnalyticsService, get_performance_analytics


class FailoverState(str, Enum):
    """Failover state for agent groups."""
    NORMAL = "normal"
    DEGRADED = "degraded"
    FAILOVER = "failover"
    RECOVERING = "recovering"


class CircuitBreakerState(str, Enum):
    """Circuit breaker states."""
    CLOSED = "closed"      # Normal operation
    OPEN = "open"          # Failing, stop trying
    HALF_OPEN = "half_open"  # Testing if recovery happened


class LoadBalancingMode(str, Enum):
    """Load balancing modes."""
    ROUND_ROBIN = "round_robin"
    LEAST_CONNECTIONS = "least_connections"
    WEIGHTED_ROUND_ROBIN = "weighted_round_robin"
    RESPONSE_TIME = "response_time"
    PERFORMANCE_BASED = "performance_based"
    CONSISTENT_HASH = "consistent_hash"


class FailoverTrigger(str, Enum):
    """Failover trigger conditions."""
    HEALTH_CHECK_FAILURE = "health_check_failure"
    HIGH_ERROR_RATE = "high_error_rate"
    RESPONSE_TIME_DEGRADATION = "response_time_degradation"
    RESOURCE_EXHAUSTION = "resource_exhaustion"
    MANUAL = "manual"
    SCHEDULED_MAINTENANCE = "scheduled_maintenance"


@dataclass
class LoadBalancerConfig:
    """Load balancer configuration."""
    mode: LoadBalancingMode
    weight_factor: float = 1.0
    health_check_weight: float = 0.3
    performance_weight: float = 0.4
    load_weight: float = 0.3
    max_retries: int = 3
    retry_delay_ms: int = 100
    timeout_ms: int = 5000


@dataclass
class CircuitBreakerConfig:
    """Circuit breaker configuration."""
    failure_threshold: int = 5
    recovery_timeout_ms: int = 60000
    half_open_max_calls: int = 3
    success_threshold: int = 2
    monitoring_window_ms: int = 10000


@dataclass
class AgentEndpoint:
    """Agent endpoint configuration."""
    agent_id: UUID
    endpoint_url: str
    weight: float = 1.0
    is_healthy: bool = True
    last_health_check: Optional[datetime] = None
    consecutive_failures: int = 0
    circuit_breaker_state: CircuitBreakerState = CircuitBreakerState.CLOSED
    current_connections: int = 0
    max_connections: int = 100
    response_times: deque = field(default_factory=lambda: deque(maxlen=100))
    error_rates: deque = field(default_factory=lambda: deque(maxlen=100))

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "agent_id": str(self.agent_id),
            "endpoint_url": self.endpoint_url,
            "weight": self.weight,
            "is_healthy": self.is_healthy,
            "last_health_check": self.last_health_check.isoformat() if self.last_health_check else None,
            "consecutive_failures": self.consecutive_failures,
            "circuit_breaker_state": self.circuit_breaker_state,
            "current_connections": self.current_connections,
            "max_connections": self.max_connections,
            "avg_response_time": sum(self.response_times) / len(self.response_times) if self.response_times else 0,
            "avg_error_rate": sum(self.error_rates) / len(self.error_rates) if self.error_rates else 0
        }


@dataclass
class FailoverGroup:
    """Failover group configuration."""
    group_id: str
    name: str
    primary_endpoints: List[AgentEndpoint]
    backup_endpoints: List[AgentEndpoint]
    state: FailoverState = FailoverState.NORMAL
    failover_threshold: float = 0.5
    auto_failback: bool = True
    failback_delay_seconds: int = 300
    health_check_interval_seconds: int = 30
    last_failover: Optional[datetime] = None
    last_failback: Optional[datetime] = None
    load_balancer_config: Optional[LoadBalancerConfig] = None
    circuit_breaker_config: Optional[CircuitBreakerConfig] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "group_id": self.group_id,
            "name": self.name,
            "primary_endpoints": [ep.to_dict() for ep in self.primary_endpoints],
            "backup_endpoints": [ep.to_dict() for ep in self.backup_endpoints],
            "state": self.state,
            "failover_threshold": self.failover_threshold,
            "auto_failback": self.auto_failback,
            "failback_delay_seconds": self.failback_delay_seconds,
            "health_check_interval_seconds": self.health_check_interval_seconds,
            "last_failover": self.last_failover.isoformat() if self.last_failover else None,
            "last_failback": self.last_failback.isoformat() if self.last_failback else None,
            "load_balancer_config": self.load_balancer_config.to_dict() if self.load_balancer_config else None,
            "circuit_breaker_config": self.circuit_breaker_config.__dict__ if self.circuit_breaker_config else None
        }


@dataclass
class FailoverEvent:
    """Failover event record."""
    event_id: str
    group_id: str
    trigger: FailoverTrigger
    affected_agents: List[UUID]
    timestamp: datetime
    description: str
    severity: str
    resolved_at: Optional[datetime] = None
    resolution: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "event_id": self.event_id,
            "group_id": self.group_id,
            "trigger": self.trigger,
            "affected_agents": [str(agent_id) for agent_id in self.affected_agents],
            "timestamp": self.timestamp.isoformat(),
            "description": self.description,
            "severity": self.severity,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
            "resolution": self.resolution
        }


class FailoverManager:
    """
    Comprehensive failover and load balancing manager.

    Provides automatic failover, load balancing, circuit breaker patterns,
    health monitoring, and recovery mechanisms for high availability.
    """

    def __init__(self):
        self.logger = logging.getLogger(self.__class__.__name__)

        # Failover groups
        self._failover_groups: Dict[str, FailoverGroup] = {}
        self._agent_group_mapping: Dict[UUID, str] = {}

        # Load balancer instances
        self._load_balancers: Dict[str, 'LoadBalancer'] = {}

        # Circuit breakers
        self._circuit_breakers: Dict[UUID, 'CircuitBreaker'] = {}

        # Monitoring and analytics
        self._health_monitor = get_health_monitor()
        self._performance_analytics = get_performance_analytics()

        # Failover history
        self._failover_events: List[FailoverEvent] = []
        self._failover_history: Dict[str, List[FailoverEvent]] = defaultdict(list)

        # Configuration
        self._default_load_balancer_config = LoadBalancerConfig(mode=LoadBalancingMode.PERFORMANCE_BASED)
        self._default_circuit_breaker_config = CircuitBreakerConfig()

        # Background tasks
        self._monitoring_task: Optional[asyncio.Task] = None
        self._recovery_task: Optional[asyncio.Task] = None
        self._cleanup_task: Optional[asyncio.Task] = None

    async def start(self):
        """Start the failover manager."""
        self.logger.info("Starting Failover Manager")

        # Start background tasks
        self._monitoring_task = asyncio.create_task(self._health_monitoring_loop())
        self._recovery_task = asyncio.create_task(self._recovery_loop())
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())

        # Load existing failover groups
        await self._load_failover_groups_from_storage()

        self.logger.info("Failover Manager started")

    async def stop(self):
        """Stop the failover manager."""
        self.logger.info("Stopping Failover Manager")

        # Cancel background tasks
        if self._monitoring_task:
            self._monitoring_task.cancel()
        if self._recovery_task:
            self._recovery_task.cancel()
        if self._cleanup_task:
            self._cleanup_task.cancel()

        # Wait for tasks to complete
        await asyncio.gather(
            self._monitoring_task,
            self._recovery_task,
            self._cleanup_task,
            return_exceptions=True
        )

        # Save failover groups to storage
        await self._save_failover_groups_to_storage()

        self.logger.info("Failover Manager stopped")

    async def create_failover_group(
        self,
        group_id: str,
        name: str,
        primary_agents: List[UUID],
        backup_agents: List[UUID] = None,
        failover_threshold: float = 0.5,
        auto_failback: bool = True,
        load_balancer_config: Optional[LoadBalancerConfig] = None,
        circuit_breaker_config: Optional[CircuitBreakerConfig] = None
    ) -> FailoverGroup:
        """
        Create a new failover group.

        Args:
            group_id: Unique group identifier
            name: Human-readable group name
            primary_agents: List of primary agent IDs
            backup_agents: List of backup agent IDs
            failover_threshold: Percentage of primary agents that must fail to trigger failover
            auto_failback: Whether to automatically fail back when primaries recover
            load_balancer_config: Load balancer configuration
            circuit_breaker_config: Circuit breaker configuration

        Returns:
            Created failover group
        """
        try:
            # Create agent endpoints
            primary_endpoints = [
                AgentEndpoint(
                    agent_id=agent_id,
                    endpoint_url=f"agent://{agent_id}",
                    weight=1.0
                ) for agent_id in primary_agents
            ]

            backup_endpoints = []
            if backup_agents:
                backup_endpoints = [
                    AgentEndpoint(
                        agent_id=agent_id,
                        endpoint_url=f"agent://{agent_id}",
                        weight=1.0
                    ) for agent_id in backup_agents
                ]

            # Create failover group
            failover_group = FailoverGroup(
                group_id=group_id,
                name=name,
                primary_endpoints=primary_endpoints,
                backup_endpoints=backup_endpoints,
                failover_threshold=failover_threshold,
                auto_failback=auto_failback,
                load_balancer_config=load_balancer_config or self._default_load_balancer_config,
                circuit_breaker_config=circuit_breaker_config or self._default_circuit_breaker_config
            )

            # Store group
            self._failover_groups[group_id] = failover_group

            # Create load balancer
            load_balancer = LoadBalancer(failover_group, self._health_monitor, self._performance_analytics)
            self._load_balancers[group_id] = load_balancer

            # Create circuit breakers for all agents
            all_agents = primary_agents + (backup_agents or [])
            for agent_id in all_agents:
                if agent_id not in self._circuit_breakers:
                    self._circuit_breakers[agent_id] = CircuitBreaker(
                        agent_id, circuit_breaker_config or self._default_circuit_breaker_config
                    )

            # Update agent group mapping
            for agent_id in all_agents:
                self._agent_group_mapping[agent_id] = group_id

            # Store in Redis
            await self._store_failover_group(failover_group)

            self.logger.info(f"Created failover group {group_id} with {len(primary_agents)} primary agents")
            return failover_group

        except Exception as e:
            self.logger.error(f"Failed to create failover group {group_id}: {e}")
            raise

    async def route_request(
        self,
        group_id: str,
        request_data: Dict[str, Any],
        task_type: Optional[TaskType] = None
    ) -> Tuple[Optional[UUID], Dict[str, Any]]:
        """
        Route a request through the failover group with load balancing.

        Args:
            group_id: The failover group ID
            request_data: Request data to be routed
            task_type: Optional task type for routing decisions

        Returns:
            Tuple of (selected_agent_id, response_data)
        """
        try:
            if group_id not in self._failover_groups:
                raise ValueError(f"Failover group {group_id} not found")

            failover_group = self._failover_groups[group_id]
            load_balancer = self._load_balancers[group_id]

            # Get available endpoints based on failover state
            available_endpoints = self._get_available_endpoints(failover_group)

            if not available_endpoints:
                # No available endpoints
                event = FailoverEvent(
                    event_id=f"no_endpoints_{uuid4().hex[:8]}",
                    group_id=group_id,
                    trigger=FailoverTrigger.RESOURCE_EXHAUSTION,
                    affected_agents=[],
                    timestamp=datetime.utcnow(),
                    description="No available endpoints in failover group",
                    severity="critical"
                )
                await self._record_failover_event(event)

                return None, {"error": "No available endpoints", "group_id": group_id}

            # Route request through load balancer
            selected_agent, response = await load_balancer.route_request(
                available_endpoints, request_data, task_type
            )

            # Update circuit breaker state
            if selected_agent:
                circuit_breaker = self._circuit_breakers.get(selected_agent)
                if circuit_breaker:
                    if response.get("success", False):
                        circuit_breaker.record_success()
                    else:
                        circuit_breaker.record_failure()

            return selected_agent, response

        except Exception as e:
            self.logger.error(f"Failed to route request to group {group_id}: {e}")
            return None, {"error": str(e), "group_id": group_id}

    async def trigger_manual_failover(
        self,
        group_id: str,
        reason: str,
        affected_agents: Optional[List[UUID]] = None
    ):
        """
        Manually trigger failover for a group.

        Args:
            group_id: The failover group ID
            reason: Reason for manual failover
            affected_agents: Specific agents to failover (None for all primaries)
        """
        try:
            if group_id not in self._failover_groups:
                raise ValueError(f"Failover group {group_id} not found")

            failover_group = self._failover_groups[group_id]

            # Determine affected agents
            if affected_agents is None:
                affected_agents = [ep.agent_id for ep in failover_group.primary_endpoints]

            # Trigger failover
            await self._execute_failover(
                failover_group,
                FailoverTrigger.MANUAL,
                affected_agents,
                reason
            )

            self.logger.info(f"Manual failover triggered for group {group_id}: {reason}")

        except Exception as e:
            self.logger.error(f"Failed to trigger manual failover for group {group_id}: {e}")
            raise

    async def schedule_maintenance_window(
        self,
        group_id: str,
        start_time: datetime,
        end_time: datetime,
        affected_agents: List[UUID],
        description: str
    ):
        """
        Schedule a maintenance window for agents.

        Args:
            group_id: The failover group ID
            start_time: Maintenance window start time
            end_time: Maintenance window end time
            affected_agents: Agents that will be under maintenance
            description: Maintenance description
        """
        try:
            # Store maintenance schedule
            maintenance_id = f"maintenance_{uuid4().hex[:8]}"
            maintenance_data = {
                "maintenance_id": maintenance_id,
                "group_id": group_id,
                "start_time": start_time.isoformat(),
                "end_time": end_time.isoformat(),
                "affected_agents": [str(agent_id) for agent_id in affected_agents],
                "description": description,
                "status": "scheduled"
            }

            # Store in Redis with expiration
            key = f"maintenance:{maintenance_id}"
            await redis_client.setex(
                key,
                end_time - datetime.utcnow() + timedelta(hours=1),
                json.dumps(maintenance_data)
            )

            # Mark agents as going into maintenance
            for agent_id in affected_agents:
                if agent_id in self._agent_group_mapping:
                    group_id_local = self._agent_group_mapping[agent_id]
                    if group_id_local in self._failover_groups:
                        group = self._failover_groups[group_id_local]
                        for endpoint in group.primary_endpoints + group.backup_endpoints:
                            if endpoint.agent_id == agent_id:
                                endpoint.is_healthy = False
                                break

            # Trigger failover if needed
            await self._check_maintenance_failover(group_id, affected_agents)

            self.logger.info(f"Scheduled maintenance {maintenance_id} for group {group_id}")

        except Exception as e:
            self.logger.error(f"Failed to schedule maintenance for group {group_id}: {e}")
            raise

    async def get_failover_status(self, group_id: str) -> Dict[str, Any]:
        """
        Get current failover status for a group.

        Args:
            group_id: The failover group ID

        Returns:
            Dictionary containing failover status and metrics
        """
        try:
            if group_id not in self._failover_groups:
                raise ValueError(f"Failover group {group_id} not found")

            failover_group = self._failover_groups[group_id]
            load_balancer = self._load_balancers[group_id]

            # Calculate health status
            primary_healthy = sum(1 for ep in failover_group.primary_endpoints if ep.is_healthy)
            backup_healthy = sum(1 for ep in failover_group.backup_endpoints if ep.is_healthy)

            # Get circuit breaker status
            circuit_breaker_status = {}
            for ep in failover_group.primary_endpoints + failover_group.backup_endpoints:
                cb = self._circuit_breakers.get(ep.agent_id)
                if cb:
                    circuit_breaker_status[str(ep.agent_id)] = {
                        "state": cb.state,
                        "failure_count": cb.failure_count,
                        "last_failure_time": cb.last_failure_time.isoformat() if cb.last_failure_time else None
                    }

            # Get recent failover events
            recent_events = self._failover_history.get(group_id, [])[-10:]  # Last 10 events

            return {
                "group_id": group_id,
                "name": failover_group.name,
                "state": failover_group.state,
                "primary_endpoints": {
                    "total": len(failover_group.primary_endpoints),
                    "healthy": primary_healthy,
                    "unhealthy": len(failover_group.primary_endpoints) - primary_healthy
                },
                "backup_endpoints": {
                    "total": len(failover_group.backup_endpoints),
                    "healthy": backup_healthy,
                    "unhealthy": len(failover_group.backup_endpoints) - backup_healthy
                },
                "health_percentage": (primary_healthy / len(failover_group.primary_endpoints)) * 100 if failover_group.primary_endpoints else 0,
                "load_balancer_stats": await load_balancer.get_statistics(),
                "circuit_breaker_status": circuit_breaker_status,
                "last_failover": failover_group.last_failover.isoformat() if failover_group.last_failover else None,
                "last_failback": failover_group.last_failback.isoformat() if failover_group.last_failback else None,
                "recent_events": [event.to_dict() for event in recent_events],
                "configuration": {
                    "failover_threshold": failover_group.failover_threshold,
                    "auto_failback": failover_group.auto_failback,
                    "failback_delay_seconds": failover_group.failback_delay_seconds
                }
            }

        except Exception as e:
            self.logger.error(f"Failed to get failover status for group {group_id}: {e}")
            return {"error": str(e), "group_id": group_id}

    def _get_available_endpoints(self, failover_group: FailoverGroup) -> List[AgentEndpoint]:
        """Get available endpoints based on failover state."""
        if failover_group.state == FailoverState.NORMAL:
            # Use primary endpoints that are healthy
            return [ep for ep in failover_group.primary_endpoints if ep.is_healthy]
        elif failover_group.state in [FailoverState.FAILOVER, FailoverState.DEGRADED]:
            # Use backup endpoints that are healthy
            return [ep for ep in failover_group.backup_endpoints if ep.is_healthy]
        elif failover_group.state == FailoverState.RECOVERING:
            # Try primaries first, then fallback to backups
            primary_available = [ep for ep in failover_group.primary_endpoints if ep.is_healthy]
            if primary_available:
                return primary_available
            else:
                return [ep for ep in failover_group.backup_endpoints if ep.is_healthy]
        else:
            return []

    async def _execute_failover(
        self,
        failover_group: FailoverGroup,
        trigger: FailoverTrigger,
        affected_agents: List[UUID],
        reason: str
    ):
        """Execute failover for a group."""
        try:
            # Record failover event
            event = FailoverEvent(
                event_id=f"failover_{uuid4().hex[:8]}",
                group_id=failover_group.group_id,
                trigger=trigger,
                affected_agents=affected_agents,
                timestamp=datetime.utcnow(),
                description=reason,
                severity="high"
            )

            # Update failover state
            failover_group.state = FailoverState.FAILOVER
            failover_group.last_failover = datetime.utcnow()

            # Mark affected agents as unhealthy
            for agent_id in affected_agents:
                for endpoint in failover_group.primary_endpoints:
                    if endpoint.agent_id == agent_id:
                        endpoint.is_healthy = False
                        endpoint.consecutive_failures += 1
                        break

            # Store event and update storage
            await self._record_failover_event(event)
            await self._store_failover_group(failover_group)

            self.logger.warning(f"Failover executed for group {failover_group.group_id}: {reason}")

        except Exception as e:
            self.logger.error(f"Failed to execute failover for group {failover_group.group_id}: {e}")

    async def _execute_failback(self, failover_group: FailoverGroup):
        """Execute failback for a group."""
        try:
            # Record failback event
            event = FailoverEvent(
                event_id=f"failback_{uuid4().hex[:8]}",
                group_id=failover_group.group_id,
                trigger=FailoverTrigger.MANUAL,
                affected_agents=[ep.agent_id for ep in failover_group.primary_endpoints],
                timestamp=datetime.utcnow(),
                description="Automatic failback after primary recovery",
                severity="info"
            )

            # Update failover state
            failover_group.state = FailoverState.NORMAL
            failover_group.last_failback = datetime.utcnow()

            # Mark primary endpoints as healthy
            for endpoint in failover_group.primary_endpoints:
                if endpoint.consecutive_failures == 0:
                    endpoint.is_healthy = True

            # Store event and update storage
            await self._record_failover_event(event)
            await self._store_failover_group(failover_group)

            self.logger.info(f"Failback executed for group {failover_group.group_id}")

        except Exception as e:
            self.logger.error(f"Failed to execute failback for group {failover_group.group_id}: {e}")

    async def _record_failover_event(self, event: FailoverEvent):
        """Record a failover event."""
        self._failover_events.append(event)
        self._failover_history[event.group_id].append(event)

        # Keep only recent events in memory
        if len(self._failover_events) > 1000:
            self._failover_events = self._failover_events[-500:]

        # Store in Redis
        key = f"failover:event:{event.event_id}"
        await redis_client.setex(key, timedelta(days=7), json.dumps(event.to_dict()))

        # Store in group history
        history_key = f"failover:history:{event.group_id}"
        await redis_client.lpush(history_key, json.dumps(event.to_dict()))
        await redis_client.ltrim(history_key, 0, 99)  # Keep last 100 events
        await redis_client.expire(history_key, timedelta(days=30))

    async def _health_monitoring_loop(self):
        """Background loop for health monitoring and failover decisions."""
        while True:
            try:
                for group_id, failover_group in self._failover_groups.items():
                    await self._check_group_health(failover_group)

                await asyncio.sleep(30)  # Check every 30 seconds

            except asyncio.CancelledError:
                break
            except Exception as e:
                self.logger.error(f"Health monitoring loop error: {e}")
                await asyncio.sleep(10)

    async def _recovery_loop(self):
        """Background loop for recovery and failback operations."""
        while True:
            try:
                for group_id, failover_group in self._failover_groups.items():
                    if failover_group.state in [FailoverState.FAILOVER, FailoverState.DEGRADED]:
                        await self._check_recovery_conditions(failover_group)

                await asyncio.sleep(60)  # Check every minute

            except asyncio.CancelledError:
                break
            except Exception as e:
                self.logger.error(f"Recovery loop error: {e}")
                await asyncio.sleep(30)

    async def _cleanup_loop(self):
        """Background loop for cleanup operations."""
        while True:
            try:
                # Clean up old failover events
                cutoff_time = datetime.utcnow() - timedelta(days=30)
                self._failover_events = [
                    event for event in self._failover_events
                    if event.timestamp > cutoff_time
                ]

                # Clean up resolved maintenance windows
                await self._cleanup_expired_maintenance()

                await asyncio.sleep(3600)  # Run every hour

            except asyncio.CancelledError:
                break
            except Exception as e:
                self.logger.error(f"Cleanup loop error: {e}")
                await asyncio.sleep(300)

    async def _check_group_health(self, failover_group: FailoverGroup):
        """Check health of a failover group and trigger failover if needed."""
        try:
            # Count healthy primary endpoints
            healthy_primaries = sum(1 for ep in failover_group.primary_endpoints if ep.is_healthy)
            total_primaries = len(failover_group.primary_endpoints)

            if total_primaries == 0:
                return  # No primaries to check

            health_percentage = healthy_primaries / total_primaries

            # Check if failover should be triggered
            if (failover_group.state == FailoverState.NORMAL and
                health_percentage < failover_group.failover_threshold):

                # Find unhealthy agents
                unhealthy_agents = [
                    ep.agent_id for ep in failover_group.primary_endpoints
                    if not ep.is_healthy
                ]

                await self._execute_failover(
                    failover_group,
                    FailoverTrigger.HEALTH_CHECK_FAILURE,
                    unhealthy_agents,
                    f"Health check failure: {healthy_primaries}/{total_primaries} primaries healthy"
                )

        except Exception as e:
            self.logger.error(f"Failed to check health for group {failover_group.group_id}: {e}")

    async def _check_recovery_conditions(self, failover_group: FailoverGroup):
        """Check if conditions are met for recovery/failback."""
        try:
            if not failover_group.auto_failback:
                return

            # Check if enough time has passed since last failover
            if failover_group.last_failover:
                time_since_failover = datetime.utcnow() - failover_group.last_failover
                if time_since_failover.total_seconds() < failover_group.failback_delay_seconds:
                    return

            # Count healthy primary endpoints
            healthy_primaries = sum(1 for ep in failover_group.primary_endpoints if ep.is_healthy)
            total_primaries = len(failover_group.primary_endpoints)

            if total_primaries == 0:
                return

            # Check if enough primaries are healthy
            recovery_threshold = max(0.7, failover_group.failover_threshold + 0.2)
            health_percentage = healthy_primaries / total_primaries

            if health_percentage >= recovery_threshold:
                await self._execute_failback(failover_group)

        except Exception as e:
            self.logger.error(f"Failed to check recovery conditions for group {failover_group.group_id}: {e}")

    async def _check_maintenance_failover(self, group_id: str, affected_agents: List[UUID]):
        """Check if maintenance requires failover."""
        try:
            if group_id not in self._failover_groups:
                return

            failover_group = self._failover_groups[group_id]

            # Count affected primary endpoints
            affected_primaries = sum(
                1 for ep in failover_group.primary_endpoints
                if ep.agent_id in affected_agents
            )

            total_primaries = len(failover_group.primary_endpoints)
            if total_primaries == 0:
                return

            affected_percentage = affected_primaries / total_primaries

            # Trigger failover if too many primaries are affected
            if affected_percentage >= failover_group.failover_threshold:
                await self._execute_failover(
                    failover_group,
                    FailoverTrigger.SCHEDULED_MAINTENANCE,
                    affected_agents,
                    f"Scheduled maintenance affecting {affected_percentage:.1%} of primary agents"
                )

        except Exception as e:
            self.logger.error(f"Failed to check maintenance failover for group {group_id}: {e}")

    async def _cleanup_expired_maintenance(self):
        """Clean up expired maintenance windows."""
        try:
            # Get all maintenance keys
            maintenance_keys = await redis_client.keys("maintenance:*")

            for key in maintenance_keys:
                maintenance_data = await redis_client.get(key)
                if maintenance_data:
                    data = json.loads(maintenance_data)
                    end_time = datetime.fromisoformat(data["end_time"])

                    if datetime.utcnow() > end_time:
                        # Maintenance window expired
                        group_id = data["group_id"]
                        affected_agents = [UUID(agent_id) for agent_id in data["affected_agents"]]

                        # Mark agents as healthy again
                        if group_id in self._failover_groups:
                            failover_group = self._failover_groups[group_id]
                            for agent_id in affected_agents:
                                for endpoint in failover_group.primary_endpoints + failover_group.backup_endpoints:
                                    if endpoint.agent_id == agent_id:
                                        endpoint.is_healthy = True
                                        endpoint.consecutive_failures = 0
                                        break

                        # Remove maintenance record
                        await redis_client.delete(key)

        except Exception as e:
            self.logger.error(f"Failed to cleanup expired maintenance windows: {e}")

    async def _store_failover_group(self, failover_group: FailoverGroup):
        """Store failover group in Redis."""
        try:
            key = f"failover:group:{failover_group.group_id}"
            await redis_client.setex(
                key,
                timedelta(days=7),
                json.dumps(failover_group.to_dict())
            )
        except Exception as e:
            self.logger.error(f"Failed to store failover group: {e}")

    async def _load_failover_groups_from_storage(self):
        """Load failover groups from storage."""
        try:
            # Get all failover group keys
            group_keys = await redis_client.keys("failover:group:*")

            for key in group_keys:
                group_data = await redis_client.get(key)
                if group_data:
                    data = json.loads(group_data)
                    # Reconstruct failover group
                    # This is simplified - full implementation would need to reconstruct objects properly
                    self.logger.info(f"Loaded failover group from storage: {data.get('group_id')}")

        except Exception as e:
            self.logger.error(f"Failed to load failover groups from storage: {e}")

    async def _save_failover_groups_to_storage(self):
        """Save all failover groups to storage."""
        try:
            for failover_group in self._failover_groups.values():
                await self._store_failover_group(failover_group)
        except Exception as e:
            self.logger.error(f"Failed to save failover groups to storage: {e}")


class LoadBalancer:
    """Load balancer for distributing requests across agent endpoints."""

    def __init__(
        self,
        failover_group: FailoverGroup,
        health_monitor: AgentHealthMonitor,
        performance_analytics: PerformanceAnalyticsService
    ):
        self.failover_group = failover_group
        self.health_monitor = health_monitor
        self.performance_analytics = performance_analytics
        self.config = failover_group.load_balancer_config
        self.logger = logging.getLogger(self.__class__.__name__)

        # Load balancing state
        self._round_robin_index = 0
        self._request_counts: Dict[UUID, int] = defaultdict(int)
        self._response_times: Dict[UUID, deque] = defaultdict(lambda: deque(maxlen=100))

    async def route_request(
        self,
        endpoints: List[AgentEndpoint],
        request_data: Dict[str, Any],
        task_type: Optional[TaskType] = None
    ) -> Tuple[Optional[UUID], Dict[str, Any]]:
        """Route a request to the best endpoint."""
        if not endpoints:
            return None, {"error": "No available endpoints"}

        try:
            # Select endpoint based on load balancing mode
            selected_endpoint = await self._select_endpoint(endpoints, task_type)

            if not selected_endpoint:
                return None, {"error": "No suitable endpoint found"}

            # Make the request
            start_time = time.time()
            response = await self._make_request(selected_endpoint, request_data)
            response_time_ms = (time.time() - start_time) * 1000

            # Update metrics
            await self._update_metrics(selected_endpoint.agent_id, response_time_ms, response)

            return selected_endpoint.agent_id, response

        except Exception as e:
            self.logger.error(f"Load balancing request failed: {e}")
            return None, {"error": str(e)}

    async def _select_endpoint(
        self,
        endpoints: List[AgentEndpoint],
        task_type: Optional[TaskType] = None
    ) -> Optional[AgentEndpoint]:
        """Select the best endpoint based on load balancing mode."""
        try:
            if not self.config:
                return endpoints[0] if endpoints else None

            mode = self.config.mode

            if mode == LoadBalancingMode.ROUND_ROBIN:
                return self._select_round_robin(endpoints)
            elif mode == LoadBalancingMode.LEAST_CONNECTIONS:
                return self._select_least_connections(endpoints)
            elif mode == LoadBalancingMode.WEIGHTED_ROUND_ROBIN:
                return self._select_weighted_round_robin(endpoints)
            elif mode == LoadBalancingMode.RESPONSE_TIME:
                return self._select_by_response_time(endpoints)
            elif mode == LoadBalancingMode.PERFORMANCE_BASED:
                return self._select_by_performance(endpoints, task_type)
            else:
                return endpoints[0] if endpoints else None

        except Exception as e:
            self.logger.error(f"Endpoint selection failed: {e}")
            return endpoints[0] if endpoints else None

    def _select_round_robin(self, endpoints: List[AgentEndpoint]) -> AgentEndpoint:
        """Select endpoint using round-robin."""
        endpoint = endpoints[self._round_robin_index % len(endpoints)]
        self._round_robin_index += 1
        return endpoint

    def _select_least_connections(self, endpoints: List[AgentEndpoint]) -> AgentEndpoint:
        """Select endpoint with least connections."""
        return min(endpoints, key=lambda ep: ep.current_connections)

    def _select_weighted_round_robin(self, endpoints: List[AgentEndpoint]) -> AgentEndpoint:
        """Select endpoint using weighted round-robin."""
        total_weight = sum(ep.weight for ep in endpoints)
        if total_weight == 0:
            return endpoints[0]

        r = random.uniform(0, total_weight)
        upto = 0

        for endpoint in endpoints:
            upto += endpoint.weight
            if upto >= r:
                return endpoint

        return endpoints[-1]

    def _select_by_response_time(self, endpoints: List[AgentEndpoint]) -> AgentEndpoint:
        """Select endpoint with best response time."""
        def avg_response_time(ep: AgentEndpoint) -> float:
            times = self._response_times[ep.agent_id]
            return sum(times) / len(times) if times else float('inf')

        return min(endpoints, key=avg_response_time)

    async def _select_by_performance(
        self,
        endpoints: List[AgentEndpoint],
        task_type: Optional[TaskType] = None
    ) -> AgentEndpoint:
        """Select endpoint based on overall performance."""
        best_score = -1
        best_endpoint = None

        for endpoint in endpoints:
            # Calculate performance score
            score = await self._calculate_performance_score(endpoint, task_type)
            if score > best_score:
                best_score = score
                best_endpoint = endpoint

        return best_endpoint or endpoints[0]

    async def _calculate_performance_score(
        self,
        endpoint: AgentEndpoint,
        task_type: Optional[TaskType] = None
    ) -> float:
        """Calculate performance score for an endpoint."""
        try:
            # Health score
            health_score = 1.0 if endpoint.is_healthy else 0.0

            # Response time score (inverse of average response time)
            avg_time = sum(self._response_times[endpoint.agent_id]) / len(self._response_times[endpoint.agent_id]) if self._response_times[endpoint.agent_id] else 1000
            response_score = max(0, 1.0 - (avg_time / 5000))  # Normalize to 5 seconds

            # Load score (inverse of current connections)
            load_score = max(0, 1.0 - (endpoint.current_connections / endpoint.max_connections))

            # Success rate score (from performance analytics)
            success_rate = 0.8  # Default, would get from analytics
            success_score = success_rate

            # Combine scores
            if self.config:
                final_score = (
                    health_score * self.config.health_check_weight +
                    response_score * self.config.performance_weight +
                    load_score * self.config.load_weight +
                    success_score * 0.2
                )
            else:
                final_score = (health_score + response_score + load_score + success_score) / 4

            return final_score

        except Exception as e:
            self.logger.error(f"Failed to calculate performance score: {e}")
            return 0.5

    async def _make_request(
        self,
        endpoint: AgentEndpoint,
        request_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Make request to endpoint (placeholder)."""
        # This would implement the actual request logic
        # For now, return a mock response
        endpoint.current_connections += 1
        try:
            # Simulate request processing
            await asyncio.sleep(0.01)
            return {"success": True, "data": "mock response", "agent_id": str(endpoint.agent_id)}
        finally:
            endpoint.current_connections -= 1

    async def _update_metrics(
        self,
        agent_id: UUID,
        response_time_ms: float,
        response: Dict[str, Any]
    ):
        """Update load balancing metrics."""
        self._request_counts[agent_id] += 1
        self._response_times[agent_id].append(response_time_ms)

        # Record with performance analytics
        await self.performance_analytics.record_metric(
            agent_id=agent_id,
            metric_name="load_balancer_response_time",
            value=response_time_ms,
            unit="milliseconds"
        )

    async def get_statistics(self) -> Dict[str, Any]:
        """Get load balancer statistics."""
        return {
            "total_requests": sum(self._request_counts.values()),
            "requests_per_agent": {
                str(agent_id): count for agent_id, count in self._request_counts.items()
            },
            "average_response_times": {
                str(agent_id): sum(times) / len(times) if times else 0
                for agent_id, times in self._response_times.items()
            }
        }


class CircuitBreaker:
    """Circuit breaker for preventing cascading failures."""

    def __init__(self, agent_id: UUID, config: CircuitBreakerConfig):
        self.agent_id = agent_id
        self.config = config
        self.state = CircuitBreakerState.CLOSED
        self.failure_count = 0
        self.last_failure_time = None
        self.half_open_calls = 0
        self.logger = logging.getLogger(f"{self.__class__.__name__}[{agent_id}]")

    def record_success(self):
        """Record a successful call."""
        if self.state == CircuitBreakerState.HALF_OPEN:
            self.half_open_calls += 1
            if self.half_open_calls >= self.config.success_threshold:
                self._reset()

    def record_failure(self):
        """Record a failed call."""
        self.failure_count += 1
        self.last_failure_time = datetime.utcnow()

        if self.state == CircuitBreakerState.HALF_OPEN:
            self._open()
        elif self.failure_count >= self.config.failure_threshold:
            self._open()

    def allow_request(self) -> bool:
        """Check if a request should be allowed."""
        if self.state == CircuitBreakerState.CLOSED:
            return True
        elif self.state == CircuitBreakerState.OPEN:
            # Check if recovery timeout has passed
            if (datetime.utcnow() - self.last_failure_time).total_seconds() * 1000 >= self.config.recovery_timeout_ms:
                self._half_open()
                return True
            return False
        elif self.state == CircuitBreakerState.HALF_OPEN:
            return self.half_open_calls < self.config.half_open_max_calls
        return False

    def _reset(self):
        """Reset circuit breaker to closed state."""
        self.state = CircuitBreakerState.CLOSED
        self.failure_count = 0
        self.half_open_calls = 0
        self.logger.info(f"Circuit breaker reset for agent {self.agent_id}")

    def _open(self):
        """Open circuit breaker."""
        self.state = CircuitBreakerState.OPEN
        self.logger.warning(f"Circuit breaker opened for agent {self.agent_id}")

    def _half_open(self):
        """Move circuit breaker to half-open state."""
        self.state = CircuitBreakerState.HALF_OPEN
        self.half_open_calls = 0
        self.logger.info(f"Circuit breaker half-open for agent {self.agent_id}")


# Global failover manager instance
failover_manager = FailoverManager()


def get_failover_manager() -> FailoverManager:
    """Get the global failover manager instance."""
    return failover_manager