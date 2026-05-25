"""
Production-Grade Agent Health Monitoring Service

This module provides comprehensive health monitoring, metrics collection,
and status tracking for all agents in the UPM.Plus system.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Set, Tuple, Any
from uuid import UUID
import json
import redis.asyncio as redis
from dataclasses import dataclass, asdict
from enum import Enum

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_

from app.core.database import get_db
from app.core.redis import redis_client
from app.models.agent import Agent
from app.agents.base import UPMAgent, AgentStatus, HealthStatus


class HealthCheckLevel(str, Enum):
    """Health check severity levels."""
    BASIC = "basic"
    COMPREHENSIVE = "comprehensive"
    DEEP = "deep"


@dataclass
class HealthCheckResult:
    """Result of an agent health check."""
    agent_id: UUID
    agent_name: str
    healthy: bool
    status: AgentStatus
    timestamp: datetime
    response_time_ms: float
    checks: Dict[str, bool]
    metrics: Dict[str, Any]
    errors: List[str]
    warnings: List[str]

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "agent_id": str(self.agent_id),
            "agent_name": self.agent_name,
            "healthy": self.healthy,
            "status": self.status,
            "timestamp": self.timestamp.isoformat(),
            "response_time_ms": self.response_time_ms,
            "checks": self.checks,
            "metrics": self.metrics,
            "errors": self.errors,
            "warnings": self.warnings
        }


@dataclass
class AgentMetrics:
    """Agent performance metrics."""
    cpu_usage_percent: float
    memory_usage_mb: float
    memory_usage_percent: float
    disk_usage_mb: float
    disk_usage_percent: float
    network_io_bytes: int
    active_connections: int
    task_queue_size: int
    error_rate_percent: float
    success_rate_percent: float
    average_response_time_ms: float
    uptime_seconds: int
    last_heartbeat: datetime

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "cpu_usage_percent": self.cpu_usage_percent,
            "memory_usage_mb": self.memory_usage_mb,
            "memory_usage_percent": self.memory_usage_percent,
            "disk_usage_mb": self.disk_usage_mb,
            "disk_usage_percent": self.disk_usage_percent,
            "network_io_bytes": self.network_io_bytes,
            "active_connections": self.active_connections,
            "task_queue_size": self.task_queue_size,
            "error_rate_percent": self.error_rate_percent,
            "success_rate_percent": self.success_rate_percent,
            "average_response_time_ms": self.average_response_time_ms,
            "uptime_seconds": self.uptime_seconds,
            "last_heartbeat": self.last_heartbeat.isoformat()
        }


class AgentHealthMonitor:
    """
    Production-grade agent health monitoring service.

    Provides comprehensive health monitoring, metrics collection,
    status tracking, and alerting for all agents.
    """

    def __init__(self):
        self.logger = logging.getLogger(self.__class__.__name__)
        self._health_check_interval = 30  # seconds
        self._metrics_retention_hours = 24
        self._alert_thresholds = {
            "cpu_usage_percent": 80.0,
            "memory_usage_percent": 85.0,
            "disk_usage_percent": 90.0,
            "error_rate_percent": 10.0,
            "response_time_ms": 5000.0,
            "heartbeat_delay_seconds": 120
        }

        # Health check cache
        self._health_cache: Dict[UUID, HealthCheckResult] = {}
        self._metrics_cache: Dict[UUID, AgentMetrics] = {}

        # Background tasks
        self._monitoring_task: Optional[asyncio.Task] = None
        self._cleanup_task: Optional[asyncio.Task] = None

    async def start(self):
        """Start the health monitoring service."""
        self.logger.info("Starting Agent Health Monitor")

        # Start background monitoring tasks
        self._monitoring_task = asyncio.create_task(self._monitoring_loop())
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())

        self.logger.info("Agent Health Monitor started")

    async def stop(self):
        """Stop the health monitoring service."""
        self.logger.info("Stopping Agent Health Monitor")

        # Cancel background tasks
        if self._monitoring_task:
            self._monitoring_task.cancel()
        if self._cleanup_task:
            self._cleanup_task.cancel()

        # Wait for tasks to complete
        await asyncio.gather(
            self._monitoring_task,
            self._cleanup_task,
            return_exceptions=True
        )

        self.logger.info("Agent Health Monitor stopped")

    async def check_agent_health(
        self,
        agent_id: UUID,
        level: HealthCheckLevel = HealthCheckLevel.BASIC
    ) -> HealthCheckResult:
        """
        Perform health check on a specific agent.

        Args:
            agent_id: The agent ID to check
            level: Health check level (basic, comprehensive, deep)

        Returns:
            HealthCheckResult with detailed health information
        """
        start_time = datetime.utcnow()

        try:
            # Get agent from database
            async with get_db() as db:
                result = await db.execute(
                    select(Agent).where(Agent.id == agent_id)
                )
                agent_db = result.scalar_one_or_none()

                if not agent_db:
                    return HealthCheckResult(
                        agent_id=agent_id,
                        agent_name="Unknown",
                        healthy=False,
                        status=AgentStatus.OFFLINE,
                        timestamp=start_time,
                        response_time_ms=0.0,
                        checks={},
                        metrics={},
                        errors=[f"Agent {agent_id} not found in database"],
                        warnings=[]
                    )

            # Get agent instance from registry
            from app.agents.registry import get_agent_registry
            registry = get_agent_registry()
            agent_instance = registry.get_agent(agent_id)

            if not agent_instance:
                return HealthCheckResult(
                    agent_id=agent_id,
                    agent_name=agent_db.name,
                    healthy=False,
                    status=AgentStatus.OFFLINE,
                    timestamp=start_time,
                    response_time_ms=0.0,
                    checks={"registry": False},
                    metrics={},
                    errors=[f"Agent {agent_id} not found in registry"],
                    warnings=[]
                )

            # Perform health checks based on level
            checks = {}
            errors = []
            warnings = []
            metrics = {}

            # Basic checks
            basic_checks = await self._perform_basic_checks(agent_instance)
            checks.update(basic_checks["checks"])
            errors.extend(basic_checks["errors"])
            warnings.extend(basic_checks["warnings"])
            metrics.update(basic_checks["metrics"])

            if level in [HealthCheckLevel.COMPREHENSIVE, HealthCheckLevel.DEEP]:
                # Comprehensive checks
                comprehensive_checks = await self._perform_comprehensive_checks(agent_instance)
                checks.update(comprehensive_checks["checks"])
                errors.extend(comprehensive_checks["errors"])
                warnings.extend(comprehensive_checks["warnings"])
                metrics.update(comprehensive_checks["metrics"])

            if level == HealthCheckLevel.DEEP:
                # Deep checks
                deep_checks = await self._perform_deep_checks(agent_instance)
                checks.update(deep_checks["checks"])
                errors.extend(deep_checks["errors"])
                warnings.extend(deep_checks["warnings"])
                metrics.update(deep_checks["metrics"])

            # Calculate overall health
            healthy = all(checks.values()) and len(errors) == 0

            # Calculate response time
            response_time = (datetime.utcnow() - start_time).total_seconds() * 1000

            # Update database if status changed
            current_status = agent_instance.status
            if current_status != agent_db.status:
                async with get_db() as db:
                    await db.execute(
                        update(Agent)
                        .where(Agent.id == agent_id)
                        .values(
                            status=current_status,
                            last_active=start_time,
                            updated_at=start_time
                        )
                    )
                    await db.commit()

            # Create health check result
            health_result = HealthCheckResult(
                agent_id=agent_id,
                agent_name=agent_instance.name,
                healthy=healthy,
                status=current_status,
                timestamp=start_time,
                response_time_ms=response_time,
                checks=checks,
                metrics=metrics,
                errors=errors,
                warnings=warnings
            )

            # Cache the result
            self._health_cache[agent_id] = health_result

            # Store in Redis for persistence
            await self._store_health_result(health_result)

            # Check for alerts
            await self._check_alerts(health_result)

            return health_result

        except Exception as e:
            self.logger.error(f"Health check failed for agent {agent_id}: {e}")
            response_time = (datetime.utcnow() - start_time).total_seconds() * 1000

            return HealthCheckResult(
                agent_id=agent_id,
                agent_name="Unknown",
                healthy=False,
                status=AgentStatus.ERROR,
                timestamp=start_time,
                response_time_ms=response_time,
                checks={},
                metrics={},
                errors=[f"Health check exception: {str(e)}"],
                warnings=[]
            )

    async def _perform_basic_checks(self, agent: UPMAgent) -> Dict[str, Any]:
        """Perform basic health checks on an agent."""
        checks = {}
        errors = []
        warnings = []
        metrics = {}

        # Check agent status
        checks["status"] = agent.status in [AgentStatus.IDLE, AgentStatus.BUSY]
        if not checks["status"]:
            errors.append(f"Agent status is {agent.status}")

        # Check if agent is responsive
        try:
            start_time = datetime.utcnow()
            health_response = await asyncio.wait_for(
                agent.health_check(),
                timeout=5.0
            )
            response_time = (datetime.utcnow() - start_time).total_seconds() * 1000

            checks["responsive"] = health_response.get("healthy", False)
            metrics["response_time_ms"] = response_time
            metrics["agent_health"] = health_response

            if not checks["responsive"]:
                errors.append("Agent health check failed")

        except asyncio.TimeoutError:
            checks["responsive"] = False
            errors.append("Agent health check timeout")
        except Exception as e:
            checks["responsive"] = False
            errors.append(f"Agent health check error: {str(e)}")

        # Check capabilities
        checks["has_capabilities"] = len(agent.capabilities) > 0
        if not checks["has_capabilities"]:
            warnings.append("Agent has no capabilities defined")

        # Check tools
        checks["has_tools"] = len(agent.tools.list_tools()) > 0
        if not checks["has_tools"]:
            warnings.append("Agent has no tools registered")

        return {
            "checks": checks,
            "errors": errors,
            "warnings": warnings,
            "metrics": metrics
        }

    async def _perform_comprehensive_checks(self, agent: UPMAgent) -> Dict[str, Any]:
        """Perform comprehensive health checks on an agent."""
        checks = {}
        errors = []
        warnings = []
        metrics = {}

        # Check performance metrics
        perf_metrics = agent.performance_metrics
        metrics["performance"] = {
            "tasks_completed": perf_metrics.tasks_completed,
            "tasks_failed": perf_metrics.tasks_failed,
            "success_rate": perf_metrics.success_rate,
            "average_execution_time_ms": perf_metrics.average_execution_time_ms,
            "last_activity": perf_metrics.last_activity.isoformat() if perf_metrics.last_activity else None
        }

        # Check success rate
        checks["success_rate_acceptable"] = perf_metrics.success_rate >= 0.8
        if not checks["success_rate_acceptable"]:
            warnings.append(f"Low success rate: {perf_metrics.success_rate:.2%}")

        # Check average execution time
        checks["execution_time_acceptable"] = perf_metrics.average_execution_time_ms < 30000  # 30 seconds
        if not checks["execution_time_acceptable"]:
            warnings.append(f"High average execution time: {perf_metrics.average_execution_time_ms}ms")

        # Check memory usage
        memory_size = len(agent.memory.messages)
        checks["memory_usage_acceptable"] = memory_size < agent.memory.max_messages * 0.9
        metrics["memory_usage"] = {
            "current_messages": memory_size,
            "max_messages": agent.memory.max_messages,
            "usage_percent": (memory_size / agent.memory.max_messages) * 100
        }

        if not checks["memory_usage_acceptable"]:
            warnings.append(f"High memory usage: {memory_size}/{agent.memory.max_messages} messages")

        # Check for recent activity
        if perf_metrics.last_activity:
            time_since_activity = datetime.utcnow() - perf_metrics.last_activity
            checks["recent_activity"] = time_since_activity < timedelta(hours=1)
            if not checks["recent_activity"]:
                warnings.append(f"No recent activity for {time_since_activity}")

        return {
            "checks": checks,
            "errors": errors,
            "warnings": warnings,
            "metrics": metrics
        }

    async def _perform_deep_checks(self, agent: UPMAgent) -> Dict[str, Any]:
        """Perform deep health checks on an agent."""
        checks = {}
        errors = []
        warnings = []
        metrics = {}

        # Check agent can handle a simple task
        try:
            from app.agents.base import Task, TaskType, ExecutionContext

            test_task = Task(
                type=TaskType.CUSTOM,
                name="health_check_task",
                description="Automated health check task",
                parameters={"test": True},
                priority=1
            )

            test_context = ExecutionContext()

            start_time = datetime.utcnow()
            result = await asyncio.wait_for(
                agent.can_handle_task(test_task),
                timeout=3.0
            )
            execution_time = (datetime.utcnow() - start_time).total_seconds() * 1000

            checks["task_handling"] = True
            metrics["task_check_time_ms"] = execution_time

        except asyncio.TimeoutError:
            checks["task_handling"] = False
            errors.append("Task capability check timeout")
        except Exception as e:
            checks["task_handling"] = False
            errors.append(f"Task capability check error: {str(e)}")

        # Check LLM configuration if present
        if agent.llm_config:
            checks["llm_configured"] = bool(agent.llm_config.api_key or agent.llm_config.base_url)
            if not checks["llm_configured"]:
                warnings.append("LLM configuration incomplete")

        return {
            "checks": checks,
            "errors": errors,
            "warnings": warnings,
            "metrics": metrics
        }

    async def _store_health_result(self, result: HealthCheckResult):
        """Store health check result in Redis."""
        try:
            key = f"agent:health:{result.agent_id}"
            await redis_client.setex(
                key,
                timedelta(hours=1),
                json.dumps(result.to_dict())
            )

            # Store in time series for metrics
            metrics_key = f"agent:metrics:history:{result.agent_id}"
            timestamp = int(result.timestamp.timestamp())
            metrics_data = {
                "timestamp": timestamp,
                "healthy": result.healthy,
                "response_time_ms": result.response_time_ms,
                "checks": result.checks
            }

            await redis_client.zadd(
                metrics_key,
                {json.dumps(metrics_data): timestamp}
            )

            # Keep only last 24 hours of data
            cutoff_time = int((datetime.utcnow() - timedelta(hours=24)).timestamp())
            await redis_client.zremrangebyscore(metrics_key, 0, cutoff_time)

        except Exception as e:
            self.logger.error(f"Failed to store health result: {e}")

    async def _check_alerts(self, result: HealthCheckResult):
        """Check for alert conditions and send alerts if needed."""
        alerts = []

        # Health alerts
        if not result.healthy:
            alerts.append({
                "type": "health",
                "severity": "critical",
                "agent_id": str(result.agent_id),
                "message": f"Agent {result.agent_name} is unhealthy",
                "details": result.errors
            })

        # Performance alerts
        if result.metrics.get("response_time_ms", 0) > self._alert_thresholds["response_time_ms"]:
            alerts.append({
                "type": "performance",
                "severity": "warning",
                "agent_id": str(result.agent_id),
                "message": f"Agent {result.agent_name} has high response time",
                "details": f"Response time: {result.response_time_ms}ms"
            })

        # Send alerts if any
        for alert in alerts:
            await self._send_alert(alert)

    async def _send_alert(self, alert: Dict[str, Any]):
        """Send alert notification."""
        try:
            # Store alert in Redis for processing
            alert_key = f"alerts:queue"
            alert_data = {
                "timestamp": datetime.utcnow().isoformat(),
                **alert
            }

            await redis_client.lpush(alert_key, json.dumps(alert_data))

            # Log alert
            self.logger.warning(f"Alert generated: {alert}")

        except Exception as e:
            self.logger.error(f"Failed to send alert: {e}")

    async def get_agent_health_history(
        self,
        agent_id: UUID,
        hours: int = 24
    ) -> List[Dict[str, Any]]:
        """
        Get health history for an agent.

        Args:
            agent_id: The agent ID
            hours: Number of hours of history to retrieve

        Returns:
            List of health check results
        """
        try:
            metrics_key = f"agent:metrics:history:{agent_id}"
            cutoff_time = int((datetime.utcnow() - timedelta(hours=hours)).timestamp())

            # Get data from Redis sorted set
            results = await redis_client.zrangebyscore(
                metrics_key,
                cutoff_time,
                int(datetime.utcnow().timestamp())
            )

            history = []
            for result in results:
                try:
                    history.append(json.loads(result))
                except json.JSONDecodeError:
                    continue

            return history

        except Exception as e:
            self.logger.error(f"Failed to get health history for agent {agent_id}: {e}")
            return []

    async def get_system_health_overview(self) -> Dict[str, Any]:
        """
        Get overall system health overview.

        Returns:
            Dictionary containing system health statistics
        """
        try:
            # Get all agents from database
            async with get_db() as db:
                result = await db.execute(select(Agent))
                agents = result.scalars().all()

            # Get health status for all agents
            total_agents = len(agents)
            healthy_agents = 0
            unhealthy_agents = 0
            status_counts = {}

            for agent in agents:
                # Get cached health or perform quick check
                cached_health = self._health_cache.get(agent.id)
                if cached_health:
                    is_healthy = cached_health.healthy
                    status = cached_health.status
                else:
                    # Quick status check from database
                    is_healthy = agent.status in [AgentStatus.IDLE, AgentStatus.BUSY]
                    status = agent.status

                if is_healthy:
                    healthy_agents += 1
                else:
                    unhealthy_agents += 1

                status_counts[status] = status_counts.get(status, 0) + 1

            # Calculate health percentage
            health_percentage = (healthy_agents / total_agents * 100) if total_agents > 0 else 0

            return {
                "timestamp": datetime.utcnow().isoformat(),
                "total_agents": total_agents,
                "healthy_agents": healthy_agents,
                "unhealthy_agents": unhealthy_agents,
                "health_percentage": round(health_percentage, 2),
                "status_distribution": status_counts,
                "monitoring": {
                    "active": True,
                    "check_interval_seconds": self._health_check_interval,
                    "last_check": max(
                        [h.timestamp.isoformat() for h in self._health_cache.values()],
                        default=None
                    )
                }
            }

        except Exception as e:
            self.logger.error(f"Failed to get system health overview: {e}")
            return {
                "timestamp": datetime.utcnow().isoformat(),
                "error": str(e),
                "monitoring": {"active": False}
            }

    async def _monitoring_loop(self):
        """Background loop for continuous health monitoring."""
        while True:
            try:
                # Get all registered agents
                from app.agents.registry import get_agent_registry
                registry = get_agent_registry()
                agents = registry.list_agents()

                # Perform health checks
                health_tasks = []
                for agent in agents:
                    health_tasks.append(
                        self.check_agent_health(
                            agent.id,
                            HealthCheckLevel.BASIC
                        )
                    )

                if health_tasks:
                    await asyncio.gather(*health_tasks, return_exceptions=True)

                # Wait for next check
                await asyncio.sleep(self._health_check_interval)

            except asyncio.CancelledError:
                break
            except Exception as e:
                self.logger.error(f"Health monitoring loop error: {e}")
                await asyncio.sleep(5)  # Brief pause before retrying

    async def _cleanup_loop(self):
        """Background loop for cleaning up old data."""
        while True:
            try:
                # Clean old health cache entries
                cutoff_time = datetime.utcnow() - timedelta(hours=1)
                expired_agents = [
                    agent_id for agent_id, result in self._health_cache.items()
                    if result.timestamp < cutoff_time
                ]

                for agent_id in expired_agents:
                    del self._health_cache[agent_id]
                    if agent_id in self._metrics_cache:
                        del self._metrics_cache[agent_id]

                # Clean old Redis data (handled by TTL but we can be explicit)
                # This is mainly for metrics history beyond retention period

                # Wait for next cleanup
                await asyncio.sleep(3600)  # Run cleanup every hour

            except asyncio.CancelledError:
                break
            except Exception as e:
                self.logger.error(f"Cleanup loop error: {e}")
                await asyncio.sleep(300)  # Brief pause before retrying


# Global health monitor instance
health_monitor = AgentHealthMonitor()


def get_health_monitor() -> AgentHealthMonitor:
    """Get the global health monitor instance."""
    return health_monitor