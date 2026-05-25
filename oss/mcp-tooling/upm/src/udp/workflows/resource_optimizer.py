"""
Resource Optimization and Load Balancing for Workflows.

This module provides intelligent resource allocation and load balancing
capabilities for workflow execution in the Universal Dependency Platform.
"""

import heapq
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Optional

import numpy as np
import structlog

logger = structlog.get_logger()


class ResourceType(Enum):
    """Types of resources that can be allocated."""

    CPU = "cpu"
    MEMORY = "memory"
    IO = "io"
    NETWORK = "network"
    STORAGE = "storage"


class LoadBalancingStrategy(Enum):
    """Load balancing strategies for workflow distribution."""

    ROUND_ROBIN = "round_robin"
    LEAST_CONNECTIONS = "least_connections"
    RESOURCE_BASED = "resource_based"
    PRIORITY_WEIGHTED = "priority_weighted"
    ADAPTIVE = "adaptive"


@dataclass
class ResourcePool:
    """Pool of available resources."""

    cpu_cores: float = 16.0
    memory_gb: float = 64.0
    io_bandwidth: float = 1000.0  # MB/s
    network_bandwidth: float = 1000.0  # MB/s
    storage_gb: float = 1000.0

    allocated: dict[str, dict[str, float]] = field(default_factory=dict)

    def allocate(self, workflow_id: str, resources: dict[str, float]) -> bool:
        """Allocate resources to a workflow."""
        # Check if resources are available
        if self._can_allocate(resources):
            # Deduct from pool
            self.cpu_cores -= resources.get("cpu", 0)
            self.memory_gb -= resources.get("memory", 0)
            self.io_bandwidth -= resources.get("io", 0)
            self.network_bandwidth -= resources.get("network", 0)
            self.storage_gb -= resources.get("storage", 0)

            # Track allocation
            self.allocated[workflow_id] = resources
            return True
        return False

    def release(self, workflow_id: str):
        """Release resources from a workflow."""
        if workflow_id in self.allocated:
            resources = self.allocated[workflow_id]
            self.cpu_cores += resources.get("cpu", 0)
            self.memory_gb += resources.get("memory", 0)
            self.io_bandwidth += resources.get("io", 0)
            self.network_bandwidth += resources.get("network", 0)
            self.storage_gb += resources.get("storage", 0)

            del self.allocated[workflow_id]

    def _can_allocate(self, resources: dict[str, float]) -> bool:
        """Check if resources can be allocated."""
        return (
            self.cpu_cores >= resources.get("cpu", 0)
            and self.memory_gb >= resources.get("memory", 0)
            and self.io_bandwidth >= resources.get("io", 0)
            and self.network_bandwidth >= resources.get("network", 0)
            and self.storage_gb >= resources.get("storage", 0)
        )

    def get_utilization(self) -> dict[str, float]:
        """Get current resource utilization percentages."""
        total = {
            "cpu": 16.0,
            "memory": 64.0,
            "io": 1000.0,
            "network": 1000.0,
            "storage": 1000.0,
        }

        allocated = {
            "cpu": sum(r.get("cpu", 0) for r in self.allocated.values()),
            "memory": sum(r.get("memory", 0) for r in self.allocated.values()),
            "io": sum(r.get("io", 0) for r in self.allocated.values()),
            "network": sum(r.get("network", 0) for r in self.allocated.values()),
            "storage": sum(r.get("storage", 0) for r in self.allocated.values()),
        }

        return {
            resource: (allocated[resource] / total[resource]) * 100
            for resource in total
        }


@dataclass
class WorkflowRequest:
    """Workflow execution request with resource requirements."""

    workflow_id: str
    priority: int  # 1-10, higher is more priority
    estimated_duration: timedelta
    resource_requirements: dict[str, float]
    submission_time: datetime
    strategy: str = "adaptive"

    def __lt__(self, other):
        """For priority queue ordering."""
        if self.priority != other.priority:
            return self.priority > other.priority  # Higher priority first
        return self.submission_time < other.submission_time  # Earlier submission first


@dataclass
class WorkerNode:
    """Worker node that can execute workflows."""

    node_id: str
    cpu_cores: float
    memory_gb: float
    active_workflows: set[str] = field(default_factory=set)
    current_load: float = 0.0
    performance_score: float = 1.0
    last_health_check: datetime = field(default_factory=datetime.utcnow)

    def can_execute(self, requirements: dict[str, float]) -> bool:
        """Check if node can execute workflow with given requirements."""
        used_cpu = sum(self._get_workflow_cpu(wid) for wid in self.active_workflows)
        used_memory = sum(
            self._get_workflow_memory(wid) for wid in self.active_workflows
        )

        return (self.cpu_cores - used_cpu) >= requirements.get("cpu", 0) and (
            self.memory_gb - used_memory
        ) >= requirements.get("memory", 0)

    def _get_workflow_cpu(self, workflow_id: str) -> float:
        """Get CPU usage for a workflow."""
        # In a real implementation, this would query actual usage
        return 1.0  # Placeholder

    def _get_workflow_memory(self, workflow_id: str) -> float:
        """Get memory usage for a workflow."""
        # In a real implementation, this would query actual usage
        return 2.0  # Placeholder


class LoadBalancer:
    """Intelligent load balancer for workflow execution."""

    def __init__(
        self, strategy: LoadBalancingStrategy = LoadBalancingStrategy.ADAPTIVE
    ):
        self.strategy = strategy
        self.worker_nodes: dict[str, WorkerNode] = {}
        self.workflow_queue: list[WorkflowRequest] = []
        self.execution_history: list[dict[str, Any]] = []
        self.round_robin_index = 0

        # Initialize default worker nodes
        self._initialize_default_nodes()

    def _initialize_default_nodes(self):
        """Initialize default worker nodes based on configuration."""
        # In production, these would be actual worker nodes
        for i in range(4):  # 4 default worker nodes
            node = WorkerNode(node_id=f"worker-{i + 1}", cpu_cores=8.0, memory_gb=32.0)
            self.worker_nodes[node.node_id] = node

    def add_workflow(self, request: WorkflowRequest):
        """Add workflow to execution queue."""
        heapq.heappush(self.workflow_queue, request)
        logger.info(
            "Workflow added to queue",
            workflow_id=request.workflow_id,
            priority=request.priority,
            queue_size=len(self.workflow_queue),
        )

    def get_next_workflow(self) -> Optional[WorkflowRequest]:
        """Get next workflow to execute based on strategy."""
        if not self.workflow_queue:
            return None

        if self.strategy == LoadBalancingStrategy.ROUND_ROBIN:
            return self._round_robin_selection()
        elif self.strategy == LoadBalancingStrategy.LEAST_CONNECTIONS:
            return self._least_connections_selection()
        elif self.strategy == LoadBalancingStrategy.RESOURCE_BASED:
            return self._resource_based_selection()
        elif self.strategy == LoadBalancingStrategy.PRIORITY_WEIGHTED:
            return self._priority_weighted_selection()
        else:  # ADAPTIVE
            return self._adaptive_selection()

    def assign_workflow(self, workflow: WorkflowRequest) -> Optional[str]:
        """Assign workflow to a suitable worker node."""
        suitable_nodes = [
            node
            for node in self.worker_nodes.values()
            if node.can_execute(workflow.resource_requirements)
        ]

        if not suitable_nodes:
            logger.warning(
                "No suitable worker node available",
                workflow_id=workflow.workflow_id,
                required_resources=workflow.resource_requirements,
            )
            return None

        # Select best node based on current load
        best_node = min(suitable_nodes, key=lambda n: n.current_load)

        # Assign workflow
        best_node.active_workflows.add(workflow.workflow_id)
        best_node.current_load = len(best_node.active_workflows) / max(
            best_node.cpu_cores, 1
        )

        logger.info(
            "Workflow assigned to node",
            workflow_id=workflow.workflow_id,
            node_id=best_node.node_id,
            node_load=best_node.current_load,
        )

        return best_node.node_id

    def release_workflow(self, workflow_id: str, node_id: str):
        """Release workflow from worker node."""
        if node_id in self.worker_nodes:
            node = self.worker_nodes[node_id]
            node.active_workflows.discard(workflow_id)
            node.current_load = len(node.active_workflows) / max(node.cpu_cores, 1)

            # Record execution completion
            self._record_execution_completion(workflow_id, node_id)

    def _round_robin_selection(self) -> WorkflowRequest:
        """Select workflow using round-robin strategy."""
        if not self.workflow_queue:
            return None

        # Get workflow at current index
        workflow = self.workflow_queue[self.round_robin_index]

        # Update index
        self.round_robin_index = (self.round_robin_index + 1) % len(self.workflow_queue)

        # Remove and return
        self.workflow_queue.pop(self.round_robin_index - 1)
        return workflow

    def _least_connections_selection(self) -> WorkflowRequest:
        """Select workflow for node with least connections."""
        # Find node with least active workflows
        least_busy_node = min(
            self.worker_nodes.values(), key=lambda n: len(n.active_workflows)
        )

        # Find highest priority workflow that node can execute
        for workflow in self.workflow_queue:
            if least_busy_node.can_execute(workflow.resource_requirements):
                self.workflow_queue.remove(workflow)
                return workflow

        # Fallback to highest priority
        return heapq.heappop(self.workflow_queue)

    def _resource_based_selection(self) -> WorkflowRequest:
        """Select workflow based on resource availability."""
        # Calculate total available resources
        total_available = {
            "cpu": sum(node.cpu_cores for node in self.worker_nodes.values()),
            "memory": sum(node.memory_gb for node in self.worker_nodes.values()),
        }

        # Find workflow that best fits available resources
        best_fit = None
        best_score = -1

        for workflow in self.workflow_queue:
            req = workflow.resource_requirements
            # Calculate fit score (how well resources match)
            cpu_fit = req.get("cpu", 0) / total_available["cpu"]
            memory_fit = req.get("memory", 0) / total_available["memory"]
            fit_score = 1 - abs(cpu_fit - memory_fit)  # Prefer balanced usage

            if fit_score > best_score:
                best_score = fit_score
                best_fit = workflow

        if best_fit:
            self.workflow_queue.remove(best_fit)
            return best_fit

        return heapq.heappop(self.workflow_queue)

    def _priority_weighted_selection(self) -> WorkflowRequest:
        """Select workflow with priority weighting."""
        if not self.workflow_queue:
            return None

        # Calculate weights based on priority and wait time
        current_time = datetime.utcnow()
        weighted_workflows = []

        for workflow in self.workflow_queue:
            wait_time = (current_time - workflow.submission_time).total_seconds()
            # Weight = priority * (1 + log(1 + wait_time/60))
            weight = workflow.priority * (1 + np.log(1 + wait_time / 60))
            weighted_workflows.append((weight, workflow))

        # Select highest weighted workflow
        weighted_workflows.sort(key=lambda x: x[0], reverse=True)
        selected = weighted_workflows[0][1]
        self.workflow_queue.remove(selected)

        return selected

    def _adaptive_selection(self) -> WorkflowRequest:
        """Select workflow using adaptive strategy based on current conditions."""
        # Analyze current system state
        avg_load = np.mean([node.current_load for node in self.worker_nodes.values()])
        queue_pressure = len(self.workflow_queue) / 10  # Normalize to 0-1

        # Adapt strategy based on conditions
        if avg_load > 0.8:
            # High load - prioritize fast workflows
            return self._priority_weighted_selection()
        elif queue_pressure > 0.7:
            # High queue pressure - use resource-based selection
            return self._resource_based_selection()
        elif avg_load < 0.3:
            # Low load - round-robin is fine
            return self._round_robin_selection()
        else:
            # Normal conditions - least connections
            return self._least_connections_selection()

    def _record_execution_completion(self, workflow_id: str, node_id: str):
        """Record workflow execution completion for analytics."""
        self.execution_history.append(
            {
                "workflow_id": workflow_id,
                "node_id": node_id,
                "completion_time": datetime.utcnow(),
                "node_load": self.worker_nodes[node_id].current_load,
            }
        )

        # Keep history manageable
        if len(self.execution_history) > 10000:
            self.execution_history = self.execution_history[-5000:]

    def get_metrics(self) -> dict[str, Any]:
        """Get load balancer metrics."""
        return {
            "strategy": self.strategy.value,
            "queue_size": len(self.workflow_queue),
            "total_nodes": len(self.worker_nodes),
            "active_workflows": sum(
                len(node.active_workflows) for node in self.worker_nodes.values()
            ),
            "average_load": np.mean(
                [node.current_load for node in self.worker_nodes.values()]
            ),
            "node_utilization": {
                node_id: {
                    "active_workflows": len(node.active_workflows),
                    "current_load": node.current_load,
                    "performance_score": node.performance_score,
                }
                for node_id, node in self.worker_nodes.items()
            },
        }


class ResourceOptimizer:
    """Intelligent resource optimizer for workflow execution."""

    def __init__(self, organization_id: Optional[str] = None):
        self.organization_id = organization_id
        self.resource_pool = ResourcePool()
        self.load_balancer = LoadBalancer()
        self.optimization_history = []
        self.prediction_model = None  # Would be initialized with ML model

    async def optimize_resource_allocation(
        self, workflows: list[WorkflowRequest]
    ) -> dict[str, Any]:
        """Optimize resource allocation across multiple workflows."""
        try:
            # Sort workflows by priority and submission time
            sorted_workflows = sorted(
                workflows, key=lambda w: (-w.priority, w.submission_time)
            )

            allocation_plan = {}
            total_allocated = {
                "cpu": 0,
                "memory": 0,
                "io": 0,
                "network": 0,
                "storage": 0,
            }

            # Allocate resources using bin packing algorithm
            for workflow in sorted_workflows:
                # Check if resources are available
                if self.resource_pool._can_allocate(workflow.resource_requirements):
                    # Allocate resources
                    success = self.resource_pool.allocate(
                        workflow.workflow_id, workflow.resource_requirements
                    )

                    if success:
                        # Find optimal worker node
                        node_id = self.load_balancer.assign_workflow(workflow)

                        allocation_plan[workflow.workflow_id] = {
                            "allocated_resources": workflow.resource_requirements.copy(),
                            "worker_node": node_id,
                            "estimated_start": datetime.utcnow(),
                            "estimated_completion": (
                                datetime.utcnow() + workflow.estimated_duration
                            ),
                        }

                        # Track total allocation
                        for resource, amount in workflow.resource_requirements.items():
                            total_allocated[resource] += amount
                    else:
                        # Add to queue for later execution
                        self.load_balancer.add_workflow(workflow)
                        allocation_plan[workflow.workflow_id] = {
                            "status": "queued",
                            "queue_position": len(self.load_balancer.workflow_queue),
                        }
                else:
                    # Not enough resources - add to queue
                    self.load_balancer.add_workflow(workflow)
                    allocation_plan[workflow.workflow_id] = {
                        "status": "queued",
                        "reason": "insufficient_resources",
                        "queue_position": len(self.load_balancer.workflow_queue),
                    }

            # Calculate optimization metrics
            utilization = self.resource_pool.get_utilization()
            efficiency = self._calculate_allocation_efficiency(total_allocated)

            result = {
                "allocation_plan": allocation_plan,
                "total_allocated": total_allocated,
                "resource_utilization": utilization,
                "efficiency_score": efficiency,
                "queue_size": len(self.load_balancer.workflow_queue),
                "active_allocations": len(self.resource_pool.allocated),
            }

            # Record optimization for learning
            await self._record_optimization(result)

            logger.info(
                "Resource optimization completed",
                allocated_workflows=len(
                    [a for a in allocation_plan.values() if a.get("status") != "queued"]
                ),
                queued_workflows=len(
                    [a for a in allocation_plan.values() if a.get("status") == "queued"]
                ),
                efficiency=efficiency,
            )

            return result

        except Exception as e:
            logger.error("Error in resource optimization", error=str(e), exc_info=True)
            return {
                "error": str(e),
                "allocation_plan": {},
                "fallback_strategy": "sequential",
            }

    async def scale_resources(self, scale_factor: float) -> bool:
        """Scale available resources up or down."""
        try:
            # Calculate new resource limits
            new_limits = {
                "cpu_cores": 16.0 * scale_factor,
                "memory_gb": 64.0 * scale_factor,
                "io_bandwidth": 1000.0 * scale_factor,
                "network_bandwidth": 1000.0 * scale_factor,
                "storage_gb": 1000.0 * scale_factor,
            }

            # Check if scaling down is safe
            if scale_factor < 1.0:
                current_usage = {
                    "cpu": 16.0 - self.resource_pool.cpu_cores,
                    "memory": 64.0 - self.resource_pool.memory_gb,
                    "io": 1000.0 - self.resource_pool.io_bandwidth,
                    "network": 1000.0 - self.resource_pool.network_bandwidth,
                    "storage": 1000.0 - self.resource_pool.storage_gb,
                }

                # Ensure we don't scale below current usage
                for resource, usage in current_usage.items():
                    if (
                        usage
                        > new_limits[
                            resource.replace("_cores", "_gb").replace(
                                "memory_gb", "memory_gb"
                            )
                        ]
                    ):
                        logger.warning(
                            "Cannot scale down - resource in use",
                            resource=resource,
                            usage=usage,
                            new_limit=new_limits[
                                resource.replace("_cores", "_gb").replace(
                                    "memory_gb", "memory_gb"
                                )
                            ],
                        )
                        return False

            # Apply scaling
            self.resource_pool.cpu_cores = new_limits["cpu_cores"]
            self.resource_pool.memory_gb = new_limits["memory_gb"]
            self.resource_pool.io_bandwidth = new_limits["io_bandwidth"]
            self.resource_pool.network_bandwidth = new_limits["network_bandwidth"]
            self.resource_pool.storage_gb = new_limits["storage_gb"]

            # Scale worker nodes
            target_nodes = max(1, int(4 * scale_factor))
            current_nodes = len(self.load_balancer.worker_nodes)

            if target_nodes > current_nodes:
                # Add nodes
                for i in range(current_nodes, target_nodes):
                    node = WorkerNode(
                        node_id=f"worker-{i + 1}", cpu_cores=8.0, memory_gb=32.0
                    )
                    self.load_balancer.worker_nodes[node.node_id] = node

            elif target_nodes < current_nodes:
                # Remove nodes (only idle ones)
                idle_nodes = [
                    node_id
                    for node_id, node in self.load_balancer.worker_nodes.items()
                    if len(node.active_workflows) == 0
                ]

                for node_id in idle_nodes[: current_nodes - target_nodes]:
                    del self.load_balancer.worker_nodes[node_id]

            logger.info(
                "Resources scaled",
                scale_factor=scale_factor,
                new_cpu=self.resource_pool.cpu_cores,
                new_memory=self.resource_pool.memory_gb,
                worker_nodes=len(self.load_balancer.worker_nodes),
            )

            return True

        except Exception as e:
            logger.error("Error scaling resources", error=str(e), exc_info=True)
            return False

    async def auto_scale(self) -> dict[str, Any]:
        """Automatically scale resources based on current load."""
        try:
            # Get current metrics
            utilization = self.resource_pool.get_utilization()
            queue_size = len(self.load_balancer.workflow_queue)
            avg_load = np.mean(
                [node.current_load for node in self.load_balancer.worker_nodes.values()]
            )

            # Determine scaling action
            scale_action = None
            scale_factor = 1.0

            # Scale up conditions
            if (
                utilization["cpu"] > 80
                or utilization["memory"] > 80
                or queue_size > 10
                or avg_load > 0.8
            ):
                scale_action = "scale_up"
                scale_factor = 1.5  # Scale up by 50%

            # Scale down conditions
            elif (
                utilization["cpu"] < 20
                and utilization["memory"] < 20
                and queue_size == 0
                and avg_load < 0.2
            ):
                scale_action = "scale_down"
                scale_factor = 0.75  # Scale down by 25%

            # Execute scaling if needed
            if scale_action:
                success = await self.scale_resources(scale_factor)

                result = {
                    "action": scale_action,
                    "scale_factor": scale_factor,
                    "success": success,
                    "utilization_before": utilization,
                    "queue_size_before": queue_size,
                    "avg_load_before": avg_load,
                }

                if success:
                    # Get new metrics
                    new_utilization = self.resource_pool.get_utilization()
                    new_queue_size = len(self.load_balancer.workflow_queue)
                    new_avg_load = np.mean(
                        [
                            node.current_load
                            for node in self.load_balancer.worker_nodes.values()
                        ]
                    )

                    result.update(
                        {
                            "utilization_after": new_utilization,
                            "queue_size_after": new_queue_size,
                            "avg_load_after": new_avg_load,
                        }
                    )

                logger.info(
                    "Auto-scaling completed",
                    action=scale_action,
                    scale_factor=scale_factor,
                    success=success,
                )

                return result

            return {
                "action": "no_scaling",
                "reason": "optimal_conditions",
                "utilization": utilization,
                "queue_size": queue_size,
                "avg_load": avg_load,
            }

        except Exception as e:
            logger.error("Error in auto-scaling", error=str(e), exc_info=True)
            return {"action": "error", "error": str(e)}

    def _calculate_allocation_efficiency(
        self, total_allocated: dict[str, float]
    ) -> float:
        """Calculate efficiency of resource allocation."""
        total_available = {
            "cpu": 16.0,
            "memory": 64.0,
            "io": 1000.0,
            "network": 1000.0,
            "storage": 1000.0,
        }

        # Calculate utilization ratio for each resource
        utilization_ratios = []
        for resource, allocated in total_allocated.items():
            ratio = allocated / total_available.get(resource, 1)
            utilization_ratios.append(ratio)

        # Efficiency is average utilization, penalized by imbalance
        avg_utilization = np.mean(utilization_ratios)
        imbalance = np.std(utilization_ratios)

        # Higher score for balanced, high utilization
        efficiency = avg_utilization * (1 - imbalance)

        return max(0, min(efficiency, 1))

    async def _record_optimization(self, result: dict[str, Any]):
        """Record optimization result for ML model improvement."""
        self.optimization_history.append(
            {"timestamp": datetime.utcnow(), "result": result}
        )

        # Keep history manageable
        if len(self.optimization_history) > 1000:
            self.optimization_history = self.optimization_history[-500:]

        # Update ML model with new data
        if self.prediction_model and len(self.optimization_history) % 10 == 0:
            await self._update_prediction_model()

    async def _update_prediction_model(self):
        """Update ML prediction model with historical data."""
        # This would implement actual model training/updating
        logger.info("Updating resource prediction model")
        pass

    def get_metrics(self) -> dict[str, Any]:
        """Get comprehensive resource optimization metrics."""
        return {
            "resource_pool": {
                "total_resources": {
                    "cpu_cores": self.resource_pool.cpu_cores,
                    "memory_gb": self.resource_pool.memory_gb,
                    "io_bandwidth": self.resource_pool.io_bandwidth,
                    "network_bandwidth": self.resource_pool.network_bandwidth,
                    "storage_gb": self.resource_pool.storage_gb,
                },
                "utilization": self.resource_pool.get_utilization(),
                "active_allocations": len(self.resource_pool.allocated),
            },
            "load_balancer": self.load_balancer.get_metrics(),
            "optimization_history_size": len(self.optimization_history),
            "last_optimization": (
                self.optimization_history[-1]["timestamp"]
                if self.optimization_history
                else None
            ),
        }
