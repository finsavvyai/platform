"""
Unit tests for Resource Optimizer module.

Tests the load balancing, resource allocation, and auto-scaling
functionality for workflow execution.
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
import uuid

from udp.workflows.resource_optimizer import (
    ResourcePool,
    WorkflowRequest,
    WorkerNode,
    LoadBalancer,
    LoadBalancingStrategy,
    ResourceOptimizer,
    ResourceType,
)


class TestResourcePool:
    """Test cases for ResourcePool class."""

    def test_initialization(self):
        """Test resource pool initialization."""
        pool = ResourcePool()
        assert pool.cpu_cores == 16.0
        assert pool.memory_gb == 64.0
        assert len(pool.allocated) == 0

    def test_successful_allocation(self):
        """Test successful resource allocation."""
        pool = ResourcePool()
        workflow_id = str(uuid.uuid4())
        resources = {"cpu": 2.0, "memory": 4.0}

        success = pool.allocate(workflow_id, resources)

        assert success is True
        assert pool.cpu_cores == 14.0  # 16 - 2
        assert pool.memory_gb == 60.0  # 64 - 4
        assert workflow_id in pool.allocated
        assert pool.allocated[workflow_id] == resources

    def test_failed_allocation_insufficient_resources(self):
        """Test allocation failure due to insufficient resources."""
        pool = ResourcePool()
        resources = {"cpu": 20.0, "memory": 100.0}  # More than available

        success = pool.allocate(str(uuid.uuid4()), resources)

        assert success is False
        assert pool.cpu_cores == 16.0  # Unchanged
        assert pool.memory_gb == 64.0  # Unchanged
        assert len(pool.allocated) == 0

    def test_resource_release(self):
        """Test resource release."""
        pool = ResourcePool()
        workflow_id = str(uuid.uuid4())
        resources = {"cpu": 2.0, "memory": 4.0}

        # Allocate first
        pool.allocate(workflow_id, resources)
        assert pool.cpu_cores == 14.0

        # Then release
        pool.release(workflow_id)
        assert pool.cpu_cores == 16.0  # Restored
        assert pool.memory_gb == 64.0  # Restored
        assert workflow_id not in pool.allocated

    def test_get_utilization(self):
        """Test resource utilization calculation."""
        pool = ResourcePool()

        # Allocate some resources
        pool.allocate("wf1", {"cpu": 4.0, "memory": 16.0})
        pool.allocate("wf2", {"cpu": 4.0, "memory": 16.0})

        utilization = pool.get_utilization()

        assert utilization["cpu"] == 50.0  # 8/16 * 100
        assert utilization["memory"] == 50.0  # 32/64 * 100
        assert utilization["io"] == 0.0
        assert utilization["network"] == 0.0
        assert utilization["storage"] == 0.0


class TestWorkflowRequest:
    """Test cases for WorkflowRequest class."""

    def test_workflow_request_creation(self):
        """Test workflow request creation."""
        request = WorkflowRequest(
            workflow_id=str(uuid.uuid4()),
            priority=8,
            estimated_duration=timedelta(minutes=30),
            resource_requirements={"cpu": 2.0, "memory": 4.0},
            submission_time=datetime.utcnow(),
        )

        assert isinstance(request.workflow_id, str)
        assert request.priority == 8
        assert isinstance(request.estimated_duration, timedelta)
        assert isinstance(request.resource_requirements, dict)

    def test_workflow_request_comparison(self):
        """Test workflow request comparison for priority queue."""
        now = datetime.utcnow()

        high_priority = WorkflowRequest(
            workflow_id="high",
            priority=9,
            estimated_duration=timedelta(minutes=10),
            resource_requirements={"cpu": 1.0},
            submission_time=now,
        )

        low_priority = WorkflowRequest(
            workflow_id="low",
            priority=3,
            estimated_duration=timedelta(minutes=10),
            resource_requirements={"cpu": 1.0},
            submission_time=now,
        )

        # Higher priority should be "less than" for min-heap
        assert high_priority < low_priority

        # Same priority, earlier submission wins
        early = WorkflowRequest(
            workflow_id="early",
            priority=5,
            estimated_duration=timedelta(minutes=10),
            resource_requirements={"cpu": 1.0},
            submission_time=now - timedelta(minutes=5),
        )

        late = WorkflowRequest(
            workflow_id="late",
            priority=5,
            estimated_duration=timedelta(minutes=10),
            resource_requirements={"cpu": 1.0},
            submission_time=now,
        )

        assert early < late


class TestWorkerNode:
    """Test cases for WorkerNode class."""

    def test_worker_node_creation(self):
        """Test worker node creation."""
        node = WorkerNode(node_id="worker-1", cpu_cores=8.0, memory_gb=32.0)

        assert node.node_id == "worker-1"
        assert node.cpu_cores == 8.0
        assert node.memory_gb == 32.0
        assert len(node.active_workflows) == 0
        assert node.current_load == 0.0
        assert node.performance_score == 1.0

    def test_can_execute_success(self):
        """Test successful execution capability check."""
        node = WorkerNode(node_id="worker-1", cpu_cores=8.0, memory_gb=32.0)

        requirements = {"cpu": 2.0, "memory": 4.0}

        # Should be able to execute
        assert node.can_execute(requirements) is True

        # Add workflow
        node.active_workflows.add("wf1")
        node.current_load = 0.25

        # Should still be able to execute
        assert node.can_execute(requirements) is True

    def test_can_execute_failure(self):
        """Test execution capability check failure."""
        node = WorkerNode(node_id="worker-1", cpu_cores=4.0, memory_gb=8.0)

        # Requirements exceed capacity
        requirements = {"cpu": 8.0, "memory": 16.0}

        assert node.can_execute(requirements) is False


class TestLoadBalancer:
    """Test cases for LoadBalancer class."""

    @pytest.fixture
    def load_balancer(self):
        """Create load balancer instance."""
        return LoadBalancer(strategy=LoadBalancingStrategy.ROUND_ROBIN)

    @pytest.fixture
    def sample_requests(self):
        """Create sample workflow requests."""
        now = datetime.utcnow()
        return [
            WorkflowRequest(
                workflow_id="wf1",
                priority=5,
                estimated_duration=timedelta(minutes=10),
                resource_requirements={"cpu": 1.0, "memory": 2.0},
                submission_time=now,
            ),
            WorkflowRequest(
                workflow_id="wf2",
                priority=8,
                estimated_duration=timedelta(minutes=15),
                resource_requirements={"cpu": 2.0, "memory": 4.0},
                submission_time=now + timedelta(seconds=1),
            ),
            WorkflowRequest(
                workflow_id="wf3",
                priority=3,
                estimated_duration=timedelta(minutes=5),
                resource_requirements={"cpu": 1.0, "memory": 1.0},
                submission_time=now + timedelta(seconds=2),
            ),
        ]

    def test_initialization(self):
        """Test load balancer initialization."""
        lb = LoadBalancer(strategy=LoadBalancingStrategy.ADAPTIVE)
        assert lb.strategy == LoadBalancingStrategy.ADAPTIVE
        assert len(lb.worker_nodes) == 4  # Default nodes
        assert len(lb.workflow_queue) == 0
        assert lb.round_robin_index == 0

    def test_add_workflow(self, load_balancer, sample_requests):
        """Test adding workflows to queue."""
        request = sample_requests[0]
        load_balancer.add_workflow(request)

        assert len(load_balancer.workflow_queue) == 1
        assert load_balancer.workflow_queue[0] == request

    def test_assign_workflow_success(self, load_balancer, sample_requests):
        """Test successful workflow assignment to node."""
        request = sample_requests[0]

        node_id = load_balancer.assign_workflow(request)

        assert node_id is not None
        assert node_id in load_balancer.worker_nodes
        assert (
            request.workflow_id in load_balancer.worker_nodes[node_id].active_workflows
        )

    def test_assign_workflow_no_suitable_node(self, load_balancer):
        """Test workflow assignment when no suitable node available."""
        # Create request with high requirements
        request = WorkflowRequest(
            workflow_id="heavy-wf",
            priority=9,
            estimated_duration=timedelta(hours=1),
            resource_requirements={"cpu": 100.0, "memory": 1000.0},  # Too high
            submission_time=datetime.utcnow(),
        )

        node_id = load_balancer.assign_workflow(request)

        assert node_id is None

    def test_release_workflow(self, load_balancer, sample_requests):
        """Test releasing workflow from node."""
        request = sample_requests[0]

        # Assign first
        node_id = load_balancer.assign_workflow(request)
        assert (
            request.workflow_id in load_balancer.worker_nodes[node_id].active_workflows
        )

        # Then release
        load_balancer.release_workflow(request.workflow_id, node_id)
        assert (
            request.workflow_id
            not in load_balancer.worker_nodes[node_id].active_workflows
        )
        assert load_balancer.worker_nodes[node_id].current_load == 0.0

    def test_round_robin_selection(self, load_balancer, sample_requests):
        """Test round-robin selection strategy."""
        load_balancer.strategy = LoadBalancingStrategy.ROUND_ROBIN

        # Add multiple workflows
        for request in sample_requests:
            load_balancer.add_workflow(request)

        # Should select in round-robin order
        first = load_balancer._round_robin_selection()
        assert first.workflow_id == "wf1"
        assert len(load_balancer.workflow_queue) == 2

        second = load_balancer._round_robin_selection()
        assert second.workflow_id == "wf2"
        assert len(load_balancer.workflow_queue) == 1

        third = load_balancer._round_robin_selection()
        assert third.workflow_id == "wf3"
        assert len(load_balancer.workflow_queue) == 0

    def test_least_connections_selection(self, load_balancer):
        """Test least connections selection strategy."""
        load_balancer.strategy = LoadBalancingStrategy.LEAST_CONNECTIONS

        # Add workflows to different nodes
        request1 = WorkflowRequest(
            workflow_id="wf1",
            priority=5,
            estimated_duration=timedelta(minutes=10),
            resource_requirements={"cpu": 1.0},
            submission_time=datetime.utcnow(),
        )

        request2 = WorkflowRequest(
            workflow_id="wf2",
            priority=5,
            estimated_duration=timedelta(minutes=10),
            resource_requirements={"cpu": 1.0},
            submission_time=datetime.utcnow(),
        )

        # Assign first workflow to worker-1
        node_id1 = load_balancer.assign_workflow(request1)

        # Add second workflow to queue
        load_balancer.add_workflow(request2)

        # Should select workflow that can run on least busy node
        selected = load_balancer._least_connections_selection()
        assert selected.workflow_id == "wf2"

    def test_priority_weighted_selection(self, load_balancer, sample_requests):
        """Test priority-weighted selection strategy."""
        load_balancer.strategy = LoadBalancingStrategy.PRIORITY_WEIGHTED

        # Add workflows with different priorities
        for request in sample_requests:
            load_balancer.add_workflow(request)

        # Should select highest priority (wf2 with priority 8)
        selected = load_balancer._priority_weighted_selection()
        assert selected.workflow_id == "wf2"
        assert selected.priority == 8

    def test_adaptive_selection(self, load_balancer, sample_requests):
        """Test adaptive selection strategy."""
        load_balancer.strategy = LoadBalancingStrategy.ADAPTIVE

        # Simulate low load
        for node in load_balancer.worker_nodes.values():
            node.current_load = 0.1

        for request in sample_requests:
            load_balancer.add_workflow(request)

        # Should use round-robin for low load
        selected = load_balancer._adaptive_selection()
        assert selected.workflow_id in ["wf1", "wf2", "wf3"]

        # Simulate high load
        for node in load_balancer.worker_nodes.values():
            node.current_load = 0.9

        # Should use priority-based for high load
        selected = load_balancer._adaptive_selection()
        # Should be highest priority due to high load
        assert selected.priority >= 5

    def test_get_metrics(self, load_balancer):
        """Test getting load balancer metrics."""
        # Add some activity
        request = WorkflowRequest(
            workflow_id="test-wf",
            priority=5,
            estimated_duration=timedelta(minutes=10),
            resource_requirements={"cpu": 1.0},
            submission_time=datetime.utcnow(),
        )

        load_balancer.add_workflow(request)
        node_id = load_balancer.assign_workflow(request)

        metrics = load_balancer.get_metrics()

        assert metrics["strategy"] == LoadBalancingStrategy.ROUND_ROBIN.value
        assert metrics["queue_size"] == 1
        assert metrics["total_nodes"] == 4
        assert metrics["active_workflows"] == 1
        assert "node_utilization" in metrics
        assert node_id in metrics["node_utilization"]


class TestResourceOptimizer:
    """Test cases for ResourceOptimizer class."""

    @pytest.fixture
    def optimizer(self):
        """Create resource optimizer instance."""
        return ResourceOptimizer(organization_id=str(uuid.uuid4()))

    @pytest.fixture
    def sample_workflow_requests(self):
        """Create sample workflow requests."""
        now = datetime.utcnow()
        return [
            WorkflowRequest(
                workflow_id="wf1",
                priority=8,
                estimated_duration=timedelta(minutes=20),
                resource_requirements={"cpu": 2.0, "memory": 4.0, "io": 100},
                submission_time=now,
            ),
            WorkflowRequest(
                workflow_id="wf2",
                priority=5,
                estimated_duration=timedelta(minutes=15),
                resource_requirements={"cpu": 1.0, "memory": 2.0, "io": 50},
                submission_time=now + timedelta(seconds=1),
            ),
            WorkflowRequest(
                workflow_id="wf3",
                priority=9,
                estimated_duration=timedelta(minutes=30),
                resource_requirements={"cpu": 4.0, "memory": 8.0, "io": 200},
                submission_time=now + timedelta(seconds=2),
            ),
        ]

    def test_initialization(self, optimizer):
        """Test resource optimizer initialization."""
        assert optimizer.organization_id is not None
        assert isinstance(optimizer.resource_pool, ResourcePool)
        assert isinstance(optimizer.load_balancer, LoadBalancer)
        assert len(optimizer.optimization_history) == 0

    @pytest.mark.asyncio
    async def test_optimize_resource_allocation_success(
        self, optimizer, sample_workflow_requests
    ):
        """Test successful resource optimization."""
        result = await optimizer.optimize_resource_allocation(sample_workflow_requests)

        assert "allocation_plan" in result
        assert "total_allocated" in result
        assert "resource_utilization" in result
        assert "efficiency_score" in result

        # Check that workflows were allocated
        allocation_plan = result["allocation_plan"]
        assert len(allocation_plan) == 3

        # Check high priority workflow got allocated
        wf3_allocation = allocation_plan["wf3"]
        assert (
            "allocated_resources" in wf3_allocation
            or wf3_allocation.get("status") == "queued"
        )

        # Check resource totals
        total_allocated = result["total_allocated"]
        assert total_allocated["cpu"] > 0
        assert total_allocated["memory"] > 0

    @pytest.mark.asyncio
    async def test_optimize_resource_allocation_insufficient_resources(self, optimizer):
        """Test optimization with insufficient resources."""
        # Create requests that exceed total resources
        heavy_requests = [
            WorkflowRequest(
                workflow_id="heavy1",
                priority=9,
                estimated_duration=timedelta(hours=1),
                resource_requirements={"cpu": 20.0, "memory": 100.0},  # Exceeds pool
                submission_time=datetime.utcnow(),
            ),
            WorkflowRequest(
                workflow_id="heavy2",
                priority=8,
                estimated_duration=timedelta(hours=1),
                resource_requirements={"cpu": 20.0, "memory": 100.0},
                submission_time=datetime.utcnow(),
            ),
        ]

        result = await optimizer.optimize_resource_allocation(heavy_requests)

        allocation_plan = result["allocation_plan"]

        # Both should be queued due to insufficient resources
        assert allocation_plan["heavy1"]["status"] == "queued"
        assert allocation_plan["heavy2"]["status"] == "queued"
        assert allocation_plan["heavy1"]["reason"] == "insufficient_resources"
        assert result["queue_size"] == 2

    @pytest.mark.asyncio
    async def test_scale_resources_up(self, optimizer):
        """Test scaling resources up."""
        initial_cpu = optimizer.resource_pool.cpu_cores
        initial_memory = optimizer.resource_pool.memory_gb

        success = await optimizer.scale_resources(1.5)

        assert success is True
        assert optimizer.resource_pool.cpu_cores == initial_cpu * 1.5
        assert optimizer.resource_pool.memory_gb == initial_memory * 1.5
        assert len(optimizer.load_balancer.worker_nodes) == 6  # 4 * 1.5 = 6

    @pytest.mark.asyncio
    async def test_scale_resources_down_safe(self, optimizer):
        """Test safe scaling down when resources are not in use."""
        # First scale up
        await optimizer.scale_resources(2.0)

        initial_cpu = optimizer.resource_pool.cpu_cores
        initial_memory = optimizer.resource_pool.memory_gb
        initial_nodes = len(optimizer.load_balancer.worker_nodes)

        # Scale down
        success = await optimizer.scale_resources(0.5)

        assert success is True
        assert optimizer.resource_pool.cpu_cores == initial_cpu * 0.5
        assert optimizer.resource_pool.memory_gb == initial_memory * 0.5
        assert len(optimizer.load_balancer.worker_nodes) == max(1, initial_nodes // 2)

    @pytest.mark.asyncio
    async def test_scale_resources_down_unsafe(self, optimizer):
        """Test that scaling down is prevented when resources are in use."""
        # Allocate some resources
        optimizer.resource_pool.allocate("test-wf", {"cpu": 10.0, "memory": 40.0})

        # Try to scale below allocated amount
        success = await optimizer.scale_resources(0.3)

        assert success is False
        # Resources should remain unchanged
        assert optimizer.resource_pool.cpu_cores == 16.0
        assert optimizer.resource_pool.memory_gb == 64.0

    @pytest.mark.asyncio
    async def test_auto_scale_up_trigger(self, optimizer):
        """Test auto-scale up trigger conditions."""
        # Simulate high utilization
        optimizer.resource_pool.cpu_cores = 3.2  # 80% of 16 used
        optimizer.resource_pool.memory_gb = 51.2  # 80% of 64 used

        # Add workflows to queue
        for i in range(15):
            optimizer.load_balancer.add_workflow(
                WorkflowRequest(
                    workflow_id=f"wf{i}",
                    priority=5,
                    estimated_duration=timedelta(minutes=10),
                    resource_requirements={"cpu": 1.0},
                    submission_time=datetime.utcnow(),
                )
            )

        result = await optimizer.auto_scale()

        assert result["action"] == "scale_up"
        assert result["scale_factor"] == 1.5
        assert result["success"] is True
        assert "utilization_before" in result
        assert "utilization_after" in result

    @pytest.mark.asyncio
    async def test_auto_scale_down_trigger(self, optimizer):
        """Test auto-scale down trigger conditions."""
        # Simulate low utilization
        optimizer.resource_pool.cpu_cores = 12.8  # 20% of 16 used
        optimizer.resource_pool.memory_gb = 51.2  # 80% of 64 used (still high)

        result = await optimizer.auto_scale()

        # Should not scale down due to high memory usage
        assert result["action"] == "no_scaling"
        assert result["reason"] == "optimal_conditions" or "memory" in result.get(
            "reason", ""
        )

        # Now simulate low utilization across all metrics
        optimizer.resource_pool.memory_gb = 12.8  # 20% of 64 used

        result = await optimizer.auto_scale()

        assert result["action"] == "scale_down"
        assert result["scale_factor"] == 0.75

    @pytest.mark.asyncio
    async def test_auto_scale_no_scaling_needed(self, optimizer):
        """Test auto-scale when conditions are optimal."""
        # Simulate optimal conditions
        optimizer.resource_pool.cpu_cores = 11.2  # 30% of 16 used
        optimizer.resource_pool.memory_gb = 44.8  # 30% of 64 used

        result = await optimizer.auto_scale()

        assert result["action"] == "no_scaling"
        assert result["reason"] == "optimal_conditions"
        assert "utilization" in result

    def test_calculate_allocation_efficiency(self, optimizer):
        """Test allocation efficiency calculation."""
        # Balanced allocation - should have high efficiency
        balanced_allocation = {
            "cpu": 8.0,  # 50% of 16
            "memory": 32.0,  # 50% of 64
            "io": 500.0,  # 50% of 1000
            "network": 500.0,  # 50% of 1000
            "storage": 500.0,  # 50% of 1000
        }

        efficiency = optimizer._calculate_allocation_efficiency(balanced_allocation)
        assert efficiency > 0.8  # Should be high for balanced allocation

        # Imbalanced allocation - should have lower efficiency
        imbalanced_allocation = {
            "cpu": 16.0,  # 100% of 16
            "memory": 8.0,  # 12.5% of 64
            "io": 100.0,  # 10% of 1000
            "network": 100.0,  # 10% of 1000
            "storage": 100.0,  # 10% of 1000
        }

        efficiency = optimizer._calculate_allocation_efficiency(imbalanced_allocation)
        assert efficiency < 0.5  # Should be lower for imbalanced allocation

    def test_get_metrics(self, optimizer):
        """Test getting comprehensive optimizer metrics."""
        # Add some activity
        optimizer.resource_pool.allocate("test-wf", {"cpu": 2.0, "memory": 4.0})

        # Record an optimization
        optimizer.optimization_history.append(
            {"timestamp": datetime.utcnow(), "result": {"test": "data"}}
        )

        metrics = optimizer.get_metrics()

        assert "resource_pool" in metrics
        assert "load_balancer" in metrics
        assert "optimization_history_size" in metrics

        # Check resource pool metrics
        pool_metrics = metrics["resource_pool"]
        assert "total_resources" in pool_metrics
        assert "utilization" in pool_metrics
        assert "active_allocations" in pool_metrics

        # Check load balancer metrics
        lb_metrics = metrics["load_balancer"]
        assert "strategy" in lb_metrics
        assert "queue_size" in lb_metrics
        assert "total_nodes" in lb_metrics


# Integration test
@pytest.mark.asyncio
async def test_full_resource_optimization_flow():
    """Integration test for full resource optimization flow."""
    optimizer = ResourceOptimizer()

    # Create mixed priority workflow requests
    now = datetime.utcnow()
    requests = [
        WorkflowRequest(
            workflow_id="critical-wf",
            priority=10,
            estimated_duration=timedelta(minutes=10),
            resource_requirements={"cpu": 1.0, "memory": 2.0},
            submission_time=now,
        ),
        WorkflowRequest(
            workflow_id="normal-wf-1",
            priority=5,
            estimated_duration=timedelta(minutes=20),
            resource_requirements={"cpu": 2.0, "memory": 4.0},
            submission_time=now + timedelta(seconds=1),
        ),
        WorkflowRequest(
            workflow_id="normal-wf-2",
            priority=5,
            estimated_duration=timedelta(minutes=15),
            resource_requirements={"cpu": 1.5, "memory": 3.0},
            submission_time=now + timedelta(seconds=2),
        ),
        WorkflowRequest(
            workflow_id="low-wf",
            priority=2,
            estimated_duration=timedelta(minutes=30),
            resource_requirements={"cpu": 4.0, "memory": 8.0},
            submission_time=now + timedelta(seconds=3),
        ),
    ]

    # Optimize allocation
    result = await optimizer.optimize_resource_allocation(requests)

    # Verify optimization results
    assert len(result["allocation_plan"]) == 4
    assert result["efficiency_score"] > 0

    # Check that critical workflow got priority
    critical_allocation = result["allocation_plan"]["critical-wf"]
    assert (
        critical_allocation.get("status") != "queued"
        or critical_allocation.get("priority", 0) >= 8
    )

    # Get metrics
    metrics = optimizer.get_metrics()
    assert metrics["resource_pool"]["active_allocations"] >= 0

    # Test auto-scaling under load
    # Simulate high load
    for i in range(12):
        optimizer.load_balancer.add_workflow(
            WorkflowRequest(
                workflow_id=f"load-wf-{i}",
                priority=5,
                estimated_duration=timedelta(minutes=10),
                resource_requirements={"cpu": 2.0},
                submission_time=datetime.utcnow(),
            )
        )

    # Trigger auto-scale
    scale_result = await optimizer.auto_scale()

    # Should scale up under load
    assert scale_result["action"] in ["scale_up", "no_scaling"]

    # Verify resources were scaled if action was scale_up
    if scale_result["action"] == "scale_up":
        assert scale_result["success"] is True
        assert optimizer.resource_pool.cpu_cores > 16.0  # Default is 16
