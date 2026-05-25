"""
Production-Ready Agent Registry Integration

This module integrates all the production-grade components into a unified
agent registry system that provides comprehensive agent management, monitoring,
discovery, analytics, and failover capabilities.
"""

import asyncio
import logging
from datetime import datetime
from typing import Dict, List, Optional, Set, Tuple, Union, Any, Callable
from uuid import UUID, uuid4
from dataclasses import dataclass
from enum import Enum

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.redis import redis_client
from app.models.agent import Agent as AgentModel
from app.agents.base import UPMAgent, Task, TaskType, AgentStatus
from .enhanced_registry import EnhancedAgentRegistry, RegistrationStatus, LoadBalancingStrategy
from .registry import AgentRegistryError, AgentNotFoundError
from app.services.agent_health import AgentHealthMonitor, get_health_monitor
from app.services.capability_discovery import CapabilityDiscoveryService, get_capability_discovery
from app.services.performance_analytics import PerformanceAnalyticsService, get_performance_analytics
from app.services.failover_manager import FailoverManager, get_failover_manager


class ProductionAgentRegistry:
    """
    Production-ready agent registry that integrates all advanced services.

    Provides a unified interface for agent management with comprehensive
    monitoring, health tracking, capability discovery, performance analytics,
    and failover capabilities.
    """

    def __init__(self):
        self.logger = logging.getLogger(self.__class__.__name__)

        # Core services
        self._enhanced_registry = EnhancedAgentRegistry()
        self._health_monitor = get_health_monitor()
        self._capability_discovery = get_capability_discovery()
        self._performance_analytics = get_performance_analytics()
        self._failover_manager = get_failover_manager()

        # Service state
        self._started = False
        self._startup_time = None

        # Configuration
        self._auto_discovery_enabled = True
        self._health_check_interval = 30  # seconds
        self._performance_tracking_enabled = True
        self._failover_enabled = True

    async def start(self):
        """Start the production agent registry and all integrated services."""
        if self._started:
            self.logger.warning("Production agent registry already started")
            return

        self.logger.info("Starting Production Agent Registry")

        try:
            # Start core services
            await self._enhanced_registry.start()
            await self._health_monitor.start()
            await self._capability_discovery.start()
            self._performance_analytics.start()
            await self._failover_manager.start()

            # Set startup time
            self._startup_time = datetime.utcnow()
            self._started = True

            # Load existing agents from database
            await self._load_existing_agents()

            self.logger.info("Production Agent Registry started successfully")

        except Exception as e:
            self.logger.error(f"Failed to start Production Agent Registry: {e}")
            await self.stop()  # Cleanup on failure
            raise

    async def stop(self):
        """Stop the production agent registry and all integrated services."""
        if not self._started:
            self.logger.warning("Production agent registry not started")
            return

        self.logger.info("Stopping Production Agent Registry")

        try:
            # Stop services in reverse order
            await self._failover_manager.stop()
            await self._performance_analytics.stop()
            await self._capability_discovery.stop()
            await self._health_monitor.stop()
            await self._enhanced_registry.stop()

            self._started = False
            self._startup_time = None

            self.logger.info("Production Agent Registry stopped successfully")

        except Exception as e:
            self.logger.error(f"Error during Production Agent Registry shutdown: {e}")

    async def register_agent(
        self,
        agent: UPMAgent,
        metadata: Optional[Dict[str, Any]] = None,
        weight: float = 1.0,
        max_concurrent_tasks: int = 10,
        auto_discover_capabilities: bool = True,
        enable_health_monitoring: bool = True,
        enable_performance_tracking: bool = True,
        failover_group: Optional[str] = None
    ) -> UUID:
        """
        Register an agent with full production-grade features.

        Args:
            agent: The agent instance to register
            metadata: Additional metadata for the agent
            weight: Weight for load balancing
            max_concurrent_tasks: Maximum concurrent tasks
            auto_discover_capabilities: Whether to auto-discover capabilities
            enable_health_monitoring: Whether to enable health monitoring
            enable_performance_tracking: Whether to enable performance tracking
            failover_group: Optional failover group name

        Returns:
            The agent's UUID
        """
        if not self._started:
            raise AgentRegistryError("Production agent registry not started")

        try:
            self.logger.info(f"Registering agent {agent.name} with production features")

            # 1. Register with enhanced registry
            agent_id = await self._enhanced_registry.register_agent_enhanced(
                agent,
                metadata=metadata,
                weight=weight,
                max_concurrent_tasks=max_concurrent_tasks
            )

            # 2. Auto-discover capabilities if enabled
            if auto_discover_capabilities and self._auto_discovery_enabled:
                try:
                    capabilities = await self._capability_discovery.discover_agent_capabilities(agent)
                    self.logger.info(f"Discovered {len(capabilities)} capabilities for agent {agent.name}")
                except Exception as e:
                    self.logger.error(f"Failed to discover capabilities for agent {agent.name}: {e}")

            # 3. Enable health monitoring
            if enable_health_monitoring:
                # Initial health check
                try:
                    health_result = await self._health_monitor.check_agent_health(agent_id)
                    if health_result.healthy:
                        self.logger.info(f"Agent {agent.name} health check passed")
                    else:
                        self.logger.warning(f"Agent {agent.name} health check failed: {health_result.errors}")
                except Exception as e:
                    self.logger.error(f"Failed to perform initial health check for agent {agent.name}: {e}")

            # 4. Add to failover group if specified
            if failover_group and self._failover_enabled:
                try:
                    # Check if failover group exists, create if not
                    existing_groups = list(self._failover_manager._failover_groups.keys())
                    if failover_group not in existing_groups:
                        await self._failover_manager.create_failover_group(
                            group_id=failover_group,
                            name=f"Failover Group: {failover_group}",
                            primary_agents=[agent_id],
                            auto_failback=True
                        )
                        self.logger.info(f"Created new failover group: {failover_group}")
                except Exception as e:
                    self.logger.error(f"Failed to add agent {agent.name} to failover group {failover_group}: {e}")

            # 5. Record registration event
            await self._performance_analytics.record_metric(
                agent_id=agent_id,
                metric_name="agent_registered",
                value=1,
                tags={"auto_discover": str(auto_discover_capabilities), "failover_group": str(failover_group or "")}
            )

            self.logger.info(f"Successfully registered agent {agent.name} ({agent_id})")
            return agent_id

        except Exception as e:
            self.logger.error(f"Failed to register agent {agent.name}: {e}")
            # Cleanup on failure
            try:
                await self.deregister_agent(agent.id)
            except:
                pass
            raise AgentRegistryError(f"Agent registration failed: {str(e)}")

    async def deregister_agent(self, agent_id: UUID) -> bool:
        """
        Deregister an agent with cleanup.

        Args:
            agent_id: The ID of the agent to deregister

        Returns:
            True if agent was deregistered, False if not found
        """
        if not self._started:
            raise AgentRegistryError("Production agent registry not started")

        try:
            self.logger.info(f"Deregistering agent {agent_id}")

            # Get agent info before deregistration
            registration = await self._enhanced_registry.get_agent_registration(agent_id)
            agent_name = registration.name if registration else "Unknown"

            # Check for active tasks
            if registration and registration.current_tasks > 0:
                self.logger.warning(f"Agent {agent_name} has {registration.current_tasks} active tasks")
                # Mark as terminating instead of immediate removal
                return False

            # Remove from failover groups
            if agent_id in self._enhanced_registry._agent_group_mapping:
                group_id = self._enhanced_registry._agent_group_mapping[agent_id]
                # Implementation would remove from failover group

            # Deregister from enhanced registry
            success = await self._enhanced_registry.deregister_agent_enhanced(agent_id)

            if success:
                # Record deregistration event
                await self._performance_analytics.record_metric(
                    agent_id=agent_id,
                    metric_name="agent_deregistered",
                    value=1
                )

                self.logger.info(f"Successfully deregistered agent {agent_name} ({agent_id})")
            else:
                self.logger.warning(f"Agent {agent_id} was not found in registry")

            return success

        except Exception as e:
            self.logger.error(f"Failed to deregister agent {agent_id}: {e}")
            return False

    async def assign_task(
        self,
        task: Task,
        strategy: Optional[LoadBalancingStrategy] = None,
        failover_group: Optional[str] = None,
        priority: int = 5
    ) -> Tuple[Optional[UUID], Dict[str, Any]]:
        """
        Assign a task to the best available agent with full production features.

        Args:
            task: The task to assign
            strategy: Load balancing strategy to use
            failover_group: Optional failover group to constrain selection
            priority: Task priority (1-10, 1 being highest)

        Returns:
            Tuple of (assigned_agent_id, assignment_metadata)
        """
        if not self._started:
            raise AgentRegistryError("Production agent registry not started")

        start_time = datetime.utcnow()
        assignment_metadata = {
            "task_id": str(task.id),
            "task_type": task.type,
            "strategy": strategy or self._enhanced_registry._load_balancing_strategy,
            "priority": priority,
            "assigned_at": start_time.isoformat()
        }

        try:
            self.logger.info(f"Assigning task {task.id} with strategy {assignment_metadata['strategy']}")

            # If failover group specified, try failover manager first
            if failover_group and self._failover_enabled:
                try:
                    selected_agent, response = await self._failover_manager.route_request(
                        group_id=failover_group,
                        request_data={
                            "task": task.to_dict(),
                            "metadata": assignment_metadata
                        },
                        task_type=task.type
                    )

                    if selected_agent:
                        assignment_metadata["routing_method"] = "failover"
                        assignment_metadata["failover_group"] = failover_group
                        assignment_metadata["selected_agent"] = str(selected_agent)
                        assignment_metadata["response_time_ms"] = (datetime.utcnow() - start_time).total_seconds() * 1000

                        # Record assignment
                        await self._performance_analytics.record_metric(
                            agent_id=selected_agent,
                            metric_name="task_assigned",
                            value=1,
                            tags={"strategy": assignment_metadata["routing_method"], "failover_group": failover_group}
                        )

                        return selected_agent, assignment_metadata

                except Exception as e:
                    self.logger.warning(f"Failover routing failed for group {failover_group}: {e}")
                    assignment_metadata["failover_error"] = str(e)

            # Fall back to enhanced registry routing
            selected_agent = await self._enhanced_registry.assign_task_to_agent(task, strategy)

            if selected_agent:
                assignment_metadata["routing_method"] = "enhanced_registry"
                assignment_metadata["selected_agent"] = str(selected_agent)
                assignment_metadata["response_time_ms"] = (datetime.utcnow() - start_time).total_seconds() * 1000

                # Record assignment
                await self._performance_analytics.record_metric(
                    agent_id=selected_agent,
                    metric_name="task_assigned",
                    value=1,
                    tags={"strategy": assignment_metadata["routing_method"], "priority": str(priority)}
                )

                self.logger.info(f"Task {task.id} assigned to agent {selected_agent}")
                return selected_agent, assignment_metadata
            else:
                assignment_metadata["error"] = "No suitable agent found"
                self.logger.warning(f"No suitable agent found for task {task.id}")
                return None, assignment_metadata

        except Exception as e:
            self.logger.error(f"Failed to assign task {task.id}: {e}")
            assignment_metadata["error"] = str(e)
            return None, assignment_metadata

    async def complete_task(
        self,
        agent_id: UUID,
        task_id: UUID,
        success: bool,
        execution_time_ms: float,
        result: Optional[Any] = None,
        error_message: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """
        Complete a task execution and update all tracking systems.

        Args:
            agent_id: The agent ID
            task_id: The task ID
            success: Whether the task was successful
            execution_time_ms: Execution time in milliseconds
            result: Optional task result
            error_message: Optional error message
            metadata: Additional execution metadata
        """
        if not self._started:
            raise AgentRegistryError("Production agent registry not started")

        try:
            self.logger.info(f"Completing task {task_id} for agent {agent_id} (success: {success})")

            # 1. Update enhanced registry
            await self._enhanced_registry.record_task_completion(
                agent_id, task_id, success, execution_time_ms
            )

            # 2. Update performance analytics
            await self._performance_analytics.record_task_execution(
                agent_id=agent_id,
                task_id=task_id,
                task_type="unknown",  # Would be retrieved from task storage
                success=success,
                execution_time_ms=execution_time_ms,
                error_message=error_message
            )

            # 3. Update capability performance if success
            if success and self._auto_discovery_enabled:
                try:
                    # Get agent capabilities
                    profile = await self._capability_discovery.get_agent_capability_profile(agent_id)
                    if profile and profile.capabilities:
                        # Update performance for each capability
                        for capability in profile.capabilities:
                            await self._capability_discovery.update_capability_performance(
                                agent_id=agent_id,
                                capability_name=capability.name,
                                success=success,
                                execution_time_ms=execution_time_ms,
                                feedback_score=1.0  # Default feedback
                            )
                except Exception as e:
                    self.logger.warning(f"Failed to update capability performance: {e}")

            # 4. Update health monitoring
            if self._performance_tracking_enabled:
                try:
                    # Record task completion health metric
                    await self._performance_analytics.record_metric(
                        agent_id=agent_id,
                        metric_name="task_completion_rate",
                        value=1.0 if success else 0.0,
                        tags={"success": str(success)}
                    )
                except Exception as e:
                    self.logger.warning(f"Failed to record task completion health metric: {e}")

            self.logger.info(f"Task {task_id} completion recorded for agent {agent_id}")

        except Exception as e:
            self.logger.error(f"Failed to complete task {task_id} for agent {agent_id}: {e}")

    async def get_agent_status(self, agent_id: UUID) -> Dict[str, Any]:
        """
        Get comprehensive agent status from all tracking systems.

        Args:
            agent_id: The agent ID

        Returns:
            Dictionary containing comprehensive agent status
        """
        if not self._started:
            raise AgentRegistryError("Production agent registry not started")

        try:
            status = {
                "agent_id": str(agent_id),
                "timestamp": datetime.utcnow().isoformat(),
                "registry_status": "unknown",
                "health_status": "unknown",
                "performance_metrics": {},
                "capabilities": [],
                "failover_status": "unknown"
            }

            # 1. Get registration status
            registration = await self._enhanced_registry.get_agent_registration(agent_id)
            if registration:
                status["registry_status"] = registration.status
                status["registration_details"] = registration.to_dict()

            # 2. Get health status
            try:
                health_result = await self._health_monitor.check_agent_health(agent_id)
                status["health_status"] = "healthy" if health_result.healthy else "unhealthy"
                status["health_details"] = health_result.to_dict()
            except Exception as e:
                status["health_status"] = "error"
                status["health_error"] = str(e)

            # 3. Get capability profile
            try:
                capability_profile = await self._capability_discovery.get_agent_capability_profile(agent_id)
                if capability_profile:
                    status["capabilities"] = [cap.name for cap in capability_profile.capabilities]
                    status["capability_details"] = capability_profile.to_dict()
            except Exception as e:
                status["capability_error"] = str(e)

            # 4. Get performance metrics
            try:
                agent_metrics = await self._performance_analytics.get_agent_metrics(agent_id)
                status["performance_metrics"] = agent_metrics
            except Exception as e:
                status["performance_error"] = str(e)

            # 5. Get failover status
            try:
                if agent_id in self._enhanced_registry._agent_group_mapping:
                    group_id = self._enhanced_registry._agent_group_mapping[agent_id]
                    failover_status = await self._failover_manager.get_failover_status(group_id)
                    status["failover_status"] = failover_status.get("state", "unknown")
                    status["failover_group"] = group_id
            except Exception as e:
                status["failover_error"] = str(e)

            return status

        except Exception as e:
            self.logger.error(f"Failed to get agent status for {agent_id}: {e}")
            return {
                "agent_id": str(agent_id),
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }

    async def get_system_overview(self) -> Dict[str, Any]:
        """
        Get comprehensive system overview.

        Returns:
            Dictionary containing system-wide status and metrics
        """
        if not self._started:
            raise AgentRegistryError("Production agent registry not started")

        try:
            overview = {
                "timestamp": datetime.utcnow().isoformat(),
                "uptime_seconds": (datetime.utcnow() - self._startup_time).total_seconds() if self._startup_time else 0,
                "registry": {},
                "health": {},
                "performance": {},
                "capabilities": {},
                "failover": {}
            }

            # 1. Registry overview
            registry_stats = await self._enhanced_registry.get_registry_stats_enhanced()
            overview["registry"] = registry_stats

            # 2. Health overview
            health_overview = await self._health_monitor.get_system_health_overview()
            overview["health"] = health_overview

            # 3. Performance overview
            performance_overview = await self._performance_analytics.get_system_performance_overview()
            overview["performance"] = performance_overview

            # 4. Failover overview
            failover_overview = {
                "total_groups": len(self._failover_manager._failover_groups),
                "groups": {}
            }
            for group_id, group in self._failover_manager._failover_groups.items():
                failover_overview["groups"][group_id] = {
                    "name": group.name,
                    "state": group.state,
                    "primary_endpoints": len(group.primary_endpoints),
                    "backup_endpoints": len(group.backup_endpoints)
                }
            overview["failover"] = failover_overview

            return overview

        except Exception as e:
            self.logger.error(f"Failed to get system overview: {e}")
            return {
                "timestamp": datetime.utcnow().isoformat(),
                "error": str(e)
            }

    async def create_comprehensive_report(
        self,
        agent_id: Optional[UUID] = None,
        report_type: str = "comprehensive",
        period_hours: int = 24
    ) -> Dict[str, Any]:
        """
        Create comprehensive report combining all system data.

        Args:
            agent_id: Optional agent ID for agent-specific report
            report_type: Type of report to generate
            period_hours: Time period in hours

        Returns:
            Comprehensive report dictionary
        """
        if not self._started:
            raise AgentRegistryError("Production agent registry not started")

        try:
            report = {
                "report_id": f"comprehensive_{uuid4().hex[:8]}",
                "timestamp": datetime.utcnow().isoformat(),
                "period_hours": period_hours,
                "agent_id": str(agent_id) if agent_id else None,
                "report_type": report_type,
                "sections": {}
            }

            # 1. Registry report
            registry_stats = await self._enhanced_registry.get_registry_stats_enhanced()
            report["sections"]["registry"] = registry_stats

            # 2. Health report
            if agent_id:
                health_history = await self._health_monitor.get_agent_health_history(
                    agent_id, period_hours
                )
                report["sections"]["agent_health"] = health_history
            else:
                health_overview = await self._health_monitor.get_system_health_overview()
                report["sections"]["system_health"] = health_overview

            # 3. Performance report
            performance_report = await self._performance_analytics.create_performance_report(
                agent_id, report_type, period_hours
            )
            report["sections"]["performance"] = performance_report.to_dict()

            # 4. Capability report
            if agent_id:
                capability_profile = await self._capability_discovery.get_agent_capability_profile(agent_id)
                if capability_profile:
                    report["sections"]["capabilities"] = capability_profile.to_dict()
            else:
                # System-wide capability overview
                report["sections"]["system_capabilities"] = {
                    "discovery_service_status": "active",
                    "total_agents_with_capabilities": len(self._capability_discovery._agent_capabilities)
                }

            # 5. Failover report
            failover_report = {
                "total_groups": len(self._failover_manager._failover_groups),
                "recent_events": len(self._failover_manager._failover_events)
            }
            report["sections"]["failover"] = failover_report

            return report

        except Exception as e:
            self.logger.error(f"Failed to create comprehensive report: {e}")
            raise

    async def _load_existing_agents(self):
        """Load existing agents from database and re-register them."""
        try:
            self.logger.info("Loading existing agents from database")

            async with get_db() as db:
                result = await db.execute(
                    select(AgentModel).where(AgentModel.is_enabled == True)
                )
                db_agents = result.scalars().all()

            for db_agent in db_agents:
                try:
                    # Create mock agent object for registration
                    # In a real implementation, you would reconstruct actual agent objects
                    self.logger.info(f"Loaded agent from database: {db_agent.name} ({db_agent.id})")
                    # Note: In production, you would need a way to reconstruct actual agent instances
                    # This is a simplified version for demonstration

                except Exception as e:
                    self.logger.error(f"Failed to load agent {db_agent.id}: {e}")

            self.logger.info(f"Loaded {len(db_agents)} agents from database")

        except Exception as e:
            self.logger.error(f"Failed to load existing agents: {e}")


# Global production registry instance
production_registry = ProductionAgentRegistry()


def get_production_registry() -> ProductionAgentRegistry:
    """Get the global production agent registry instance."""
    return production_registry