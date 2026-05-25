"""
Intelligent Workflow Routing with LangGraph Integration.

This module provides intelligent workflow routing capabilities using
ML-based predictions and adaptive execution strategies.
"""

import asyncio
import time
from datetime import datetime, timedelta
from typing import Any, Optional
from uuid import uuid4

import structlog
from langgraph.graph import END, StateGraph
from udp.core.database import get_async_session
from udp.core.models.project import Project
from udp.core.workflow_optimizer import (
    RoutingDecision,
    RoutingStrategy,
    WorkflowComplexity,
    WorkflowOptimizer,
)
from udp.services.workflow import WorkflowExecutionService
from udp.workflows.state import DependencyAnalysisState

logger = structlog.get_logger()


class IntelligentRoutingWorkflow:
    """
    Intelligent workflow routing system with LangGraph integration.

    Provides adaptive routing based on:
    - ML-based complexity prediction
    - Real-time resource monitoring
    - Historical performance data
    - Dynamic adaptation during execution
    """

    def __init__(self, organization_id: Optional[str] = None):
        self.organization_id = organization_id
        self.optimizer = WorkflowOptimizer(organization_id)
        self.workflow_service = WorkflowExecutionService()
        self.active_routings = {}
        self.performance_history = {}

    async def create_intelligent_workflow(
        self, project: Project, workflow_config: dict[str, Any]
    ) -> tuple[StateGraph, RoutingDecision]:
        """
        Create an intelligently routed workflow graph.

        Args:
            project: Project entity
            workflow_config: Workflow configuration

        Returns:
            Tuple of (workflow_graph, routing_decision)
        """
        try:
            # Analyze workflow complexity
            complexity, confidence = await self.optimizer.analyze_workflow_complexity(
                project, workflow_config
            )

            # Get current system metrics
            metrics = await self.optimizer._get_current_metrics()

            # Generate routing decision
            routing_decision = await self.optimizer.optimize_workflow_routing(
                workflow_id=workflow_config.get("workflow_id", str(uuid4())),
                complexity=complexity,
                workflow_config=workflow_config,
                current_metrics=metrics,
            )

            # Build adaptive workflow graph
            workflow = self._build_adaptive_workflow_graph(
                complexity, routing_decision, workflow_config
            )

            # Store routing information for monitoring
            self.active_routings[routing_decision.workflow_id] = {
                "decision": routing_decision,
                "complexity": complexity,
                "start_time": datetime.utcnow(),
                "config": workflow_config,
            }

            logger.info(
                "Intelligent workflow created",
                workflow_id=routing_decision.workflow_id,
                complexity=complexity.value,
                strategy=routing_decision.strategy.value,
                confidence=confidence,
            )

            return workflow, routing_decision

        except Exception as e:
            logger.error(
                "Error creating intelligent workflow",
                project_id=project.id,
                error=str(e),
                exc_info=True,
            )
            raise

    def _build_adaptive_workflow_graph(
        self,
        complexity: WorkflowComplexity,
        routing_decision: RoutingDecision,
        config: dict[str, Any],
    ) -> StateGraph:
        """Build workflow graph with adaptive routing."""
        workflow = StateGraph(DependencyAnalysisState)

        # Add standard nodes
        workflow.add_node("validate_input", self._validate_input)
        workflow.add_node("complexity_analysis", self._complexity_analysis)
        workflow.add_node("resource_check", self._resource_check)

        # Add nodes based on complexity and routing strategy
        if routing_decision.strategy == RoutingStrategy.PARALLEL:
            # Add parallel processing nodes
            workflow.add_node(
                "parallel_dependency_analysis", self._parallel_dependency_analysis
            )
            workflow.add_node("parallel_security_scan", self._parallel_security_scan)
            workflow.add_node("merge_results", self._merge_parallel_results)

        elif routing_decision.strategy == RoutingStrategy.ADAPTIVE:
            # Add adaptive nodes with monitoring
            workflow.add_node("adaptive_analysis", self._adaptive_analysis)
            workflow.add_node("performance_monitor", self._performance_monitor)
            workflow.add_node("route_adjustment", self._route_adjustment)

        else:
            # Standard sequential nodes
            workflow.add_node("dependency_extraction", self._dependency_extraction)
            workflow.add_node("security_scanning", self._security_scanning)
            workflow.add_node("policy_evaluation", self._policy_evaluation)

        # Add common completion nodes
        workflow.add_node("recommendation_generation", self._recommendation_generation)
        workflow.add_node("final_output", self._final_output)

        # Configure edges based on strategy
        self._configure_workflow_edges(
            workflow, routing_decision.strategy, complexity, config
        )

        # Set entry point
        workflow.set_entry_point("validate_input")

        return workflow

    def _configure_workflow_edges(
        self,
        workflow: StateGraph,
        strategy: RoutingStrategy,
        complexity: WorkflowComplexity,
        config: dict[str, Any],
    ):
        """Configure workflow edges based on routing strategy."""

        if strategy == RoutingStrategy.PARALLEL:
            # Parallel execution flow
            workflow.add_edge("validate_input", "complexity_analysis")
            workflow.add_edge("complexity_analysis", "resource_check")

            # Route to parallel or sequential based on resources
            workflow.add_conditional_edges(
                "resource_check",
                self._check_parallel_feasibility,
                {
                    "parallel": "parallel_dependency_analysis",
                    "sequential": "dependency_extraction",
                },
            )

            # Parallel paths
            workflow.add_edge("parallel_dependency_analysis", "parallel_security_scan")
            workflow.add_edge("parallel_security_scan", "merge_results")

            # Sequential fallback
            workflow.add_edge("dependency_extraction", "security_scanning")
            workflow.add_edge("security_scanning", "merge_results")

            workflow.add_edge("merge_results", "policy_evaluation")

        elif strategy == RoutingStrategy.ADAPTIVE:
            # Adaptive execution flow
            workflow.add_edge("validate_input", "complexity_analysis")
            workflow.add_edge("complexity_analysis", "resource_check")
            workflow.add_edge("resource_check", "adaptive_analysis")

            # Adaptive routing with monitoring
            workflow.add_conditional_edges(
                "adaptive_analysis",
                self._adaptive_routing_decision,
                {
                    "continue": "performance_monitor",
                    "optimize": "route_adjustment",
                    "complete": "recommendation_generation",
                },
            )

            workflow.add_edge("performance_monitor", "security_scanning")
            workflow.add_edge("route_adjustment", "dependency_extraction")
            workflow.add_edge("dependency_extraction", "security_scanning")

        else:
            # Sequential or priority queue flow
            workflow.add_edge("validate_input", "complexity_analysis")
            workflow.add_edge("complexity_analysis", "resource_check")
            workflow.add_edge("resource_check", "dependency_extraction")
            workflow.add_edge("dependency_extraction", "security_scanning")
            workflow.add_edge("security_scanning", "policy_evaluation")

        # Common completion flow
        workflow.add_edge("policy_evaluation", "recommendation_generation")
        workflow.add_edge("recommendation_generation", "final_output")
        workflow.add_edge("final_output", END)

    async def _validate_input(
        self, state: DependencyAnalysisState
    ) -> DependencyAnalysisState:
        """Validate workflow input parameters."""
        try:
            state["status"] = "validating"
            state["validation_errors"] = []

            # Validate required fields
            if not state.get("project_id"):
                state["validation_errors"].append("Project ID is required")

            if not state.get("ecosystem"):
                state["validation_errors"].append("Ecosystem is required")

            # Validate configuration
            config = state.get("config", {})
            if config.get("security_scan", True) and not config.get("api_key"):
                state["validation_errors"].append(
                    "API key required for security scanning"
                )

            # Update state
            state["validation_passed"] = len(state["validation_errors"]) == 0
            state["validated_at"] = datetime.utcnow()

            if state["validation_passed"]:
                state["status"] = "validated"
                logger.info(
                    "Input validation passed", project_id=state.get("project_id")
                )
            else:
                state["status"] = "validation_failed"
                logger.error(
                    "Input validation failed", errors=state["validation_errors"]
                )

            return state

        except Exception as e:
            logger.error("Error in input validation", error=str(e))
            state["status"] = "validation_error"
            state["error"] = str(e)
            return state

    async def _complexity_analysis(
        self, state: DependencyAnalysisState
    ) -> DependencyAnalysisState:
        """Perform complexity analysis for routing decisions."""
        try:
            state["status"] = "analyzing_complexity"

            # Get project information
            project_id = state.get("project_id")
            if not project_id:
                state["error"] = "Project ID required for complexity analysis"
                return state

            async with get_async_session() as session:
                # Fetch project
                from sqlalchemy import select

                project_query = select(Project).where(Project.id == project_id)
                project = await session.scalar(project_query)

                if not project:
                    state["error"] = f"Project {project_id} not found"
                    return state

                # Analyze complexity
                (
                    complexity,
                    confidence,
                ) = await self.optimizer.analyze_workflow_complexity(
                    project, state.get("config", {})
                )

                # Store complexity analysis
                state["complexity"] = complexity.value
                state["complexity_confidence"] = confidence
                state["analyzed_at"] = datetime.utcnow()

                logger.info(
                    "Complexity analysis completed",
                    project_id=project_id,
                    complexity=complexity.value,
                    confidence=confidence,
                )

            state["status"] = "complexity_analyzed"
            return state

        except Exception as e:
            logger.error("Error in complexity analysis", error=str(e))
            state["status"] = "complexity_analysis_error"
            state["error"] = str(e)
            return state

    async def _resource_check(
        self, state: DependencyAnalysisState
    ) -> DependencyAnalysisState:
        """Check available resources and adjust routing if needed."""
        try:
            state["status"] = "checking_resources"

            # Get current metrics
            metrics = await self.optimizer._get_current_metrics()

            # Store resource information
            state["resource_metrics"] = {
                "cpu_usage": metrics.cpu_usage,
                "memory_usage": metrics.memory_usage,
                "active_workflows": metrics.active_workflows,
                "queue_length": metrics.queue_length,
            }

            # Determine if resources are sufficient for parallel execution
            can_parallel = (
                metrics.cpu_usage < 0.7
                and metrics.memory_usage < 0.7
                and metrics.active_workflows < 5
            )

            state["parallel feasible"] = can_parallel
            state["resource_checked_at"] = datetime.utcnow()

            logger.info(
                "Resource check completed",
                can_parallel=can_parallel,
                cpu_usage=metrics.cpu_usage,
                active_workflows=metrics.active_workflows,
            )

            state["status"] = "resources_checked"
            return state

        except Exception as e:
            logger.error("Error in resource check", error=str(e))
            state["status"] = "resource_check_error"
            state["error"] = str(e)
            return state

    async def _check_parallel_feasibility(self, state: DependencyAnalysisState) -> str:
        """Determine if parallel execution is feasible."""
        if state.get("parallel_feasible", False) and state.get("complexity") in [
            "complex",
            "very_complex",
        ]:
            return "parallel"
        return "sequential"

    async def _parallel_dependency_analysis(
        self, state: DependencyAnalysisState
    ) -> DependencyAnalysisState:
        """Execute dependency analysis in parallel mode."""
        try:
            state["status"] = "parallel_dependency_analysis"
            start_time = time.time()

            # Create parallel tasks for different analysis aspects
            tasks = []

            # Direct dependency extraction
            tasks.append(self._extract_direct_dependencies(state))

            # Transitive dependency resolution
            if state.get("config", {}).get("include_transitive", True):
                tasks.append(self._resolve_transitive_dependencies(state))

            # Dependency conflict detection
            tasks.append(self._detect_dependency_conflicts(state))

            # Execute tasks in parallel
            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Process results
            state["dependencies"] = []
            state["transitive_dependencies"] = []
            state["conflicts"] = []

            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    logger.error(f"Parallel task {i} failed", error=str(result))
                    state["errors"] = state.get("errors", []).append(str(result))
                else:
                    # Merge results based on task index
                    if i == 0:  # Direct dependencies
                        state["dependencies"].extend(result.get("dependencies", []))
                    elif i == 1:  # Transitive dependencies
                        state["transitive_dependencies"].extend(
                            result.get("dependencies", [])
                        )
                    elif i == 2:  # Conflicts
                        state["conflicts"].extend(result.get("conflicts", []))

            # Update metrics
            state["dependency_analysis_time"] = time.time() - start_time
            state["dependency_analysis_completed_at"] = datetime.utcnow()

            logger.info(
                "Parallel dependency analysis completed",
                dependencies_count=len(state["dependencies"]),
                duration=state["dependency_analysis_time"],
            )

            state["status"] = "parallel_dependency_analysis_completed"
            return state

        except Exception as e:
            logger.error("Error in parallel dependency analysis", error=str(e))
            state["status"] = "parallel_dependency_analysis_error"
            state["error"] = str(e)
            return state

    async def _parallel_security_scan(
        self, state: DependencyAnalysisState
    ) -> DependencyAnalysisState:
        """Execute security scanning in parallel mode."""
        try:
            state["status"] = "parallel_security_scan"
            start_time = time.time()

            # Create parallel security scanning tasks
            tasks = []

            # Vulnerability scanning
            if state.get("config", {}).get("security_scan", True):
                tasks.append(self._scan_vulnerabilities(state))

            # License compliance checking
            if state.get("config", {}).get("license_check", True):
                tasks.append(self._check_license_compliance(state))

            # Malware scanning
            if state.get("config", {}).get("malware_scan", False):
                tasks.append(self._scan_malware(state))

            # Execute tasks in parallel
            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Process results
            state["vulnerabilities"] = []
            state["license_issues"] = []
            state["malware_detected"] = []

            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    logger.error(f"Security scan task {i} failed", error=str(result))
                    state["errors"] = state.get("errors", []).append(str(result))
                else:
                    # Merge results based on task index
                    if i == 0:  # Vulnerabilities
                        state["vulnerabilities"].extend(
                            result.get("vulnerabilities", [])
                        )
                    elif i == 1:  # License issues
                        state["license_issues"].extend(result.get("license_issues", []))
                    elif i == 2:  # Malware
                        state["malware_detected"].extend(result.get("malware", []))

            # Update metrics
            state["security_scan_time"] = time.time() - start_time
            state["security_scan_completed_at"] = datetime.utcnow()

            logger.info(
                "Parallel security scan completed",
                vulnerabilities_count=len(state["vulnerabilities"]),
                duration=state["security_scan_time"],
            )

            state["status"] = "parallel_security_scan_completed"
            return state

        except Exception as e:
            logger.error("Error in parallel security scan", error=str(e))
            state["status"] = "parallel_security_scan_error"
            state["error"] = str(e)
            return state

    async def _merge_parallel_results(
        self, state: DependencyAnalysisState
    ) -> DependencyAnalysisState:
        """Merge results from parallel execution paths."""
        try:
            state["status"] = "merging_results"

            # Combine all dependencies
            all_dependencies = []
            all_dependencies.extend(state.get("dependencies", []))
            all_dependencies.extend(state.get("transitive_dependencies", []))

            # Remove duplicates
            unique_deps = []
            seen = set()
            for dep in all_dependencies:
                dep_key = (dep.get("name"), dep.get("version"), dep.get("ecosystem"))
                if dep_key not in seen:
                    unique_deps.append(dep)
                    seen.add(dep_key)

            state["merged_dependencies"] = unique_deps

            # Aggregate security findings
            total_issues = (
                len(state.get("vulnerabilities", []))
                + len(state.get("license_issues", []))
                + len(state.get("malware_detected", []))
            )

            state["total_security_issues"] = total_issues
            state["merged_at"] = datetime.utcnow()

            logger.info(
                "Parallel results merged",
                dependencies_count=len(unique_deps),
                security_issues=total_issues,
            )

            state["status"] = "results_merged"
            return state

        except Exception as e:
            logger.error("Error merging parallel results", error=str(e))
            state["status"] = "merge_error"
            state["error"] = str(e)
            return state

    async def _adaptive_analysis(
        self, state: DependencyAnalysisState
    ) -> DependencyAnalysisState:
        """Perform adaptive analysis with real-time adjustments."""
        try:
            state["status"] = "adaptive_analysis"
            state["adaptation_count"] = 0

            # Initialize performance tracking
            state["performance_metrics"] = {
                "start_time": time.time(),
                "checkpoints": [],
                "adaptations": [],
            }

            # Perform initial analysis
            await self._dependency_extraction(state)

            # Monitor and adapt
            current_time = time.time()
            elapsed = current_time - state["performance_metrics"]["start_time"]

            # Check if adaptation is needed
            if elapsed > 30:  # Taking longer than expected
                adaptation = await self.optimizer.adapt_workflow_execution(
                    state.get("workflow_id"), state, state["performance_metrics"]
                )

                if adaptation:
                    state["adaptations"] = adaptation
                    state["adaptation_count"] += 1

                    # Apply adaptations
                    if adaptation.get("parallelize_remaining"):
                        state["parallel_mode"] = True

                    if adaptation.get("increase_resources"):
                        state["resource_boost"] = True

            state["adaptive_analysis_completed_at"] = datetime.utcnow()
            state["status"] = "adaptive_analysis_completed"

            return state

        except Exception as e:
            logger.error("Error in adaptive analysis", error=str(e))
            state["status"] = "adaptive_analysis_error"
            state["error"] = str(e)
            return state

    async def _adaptive_routing_decision(self, state: DependencyAnalysisState) -> str:
        """Make adaptive routing decision based on current state."""

        # Check if we've exceeded adaptation threshold
        if state.get("adaptation_count", 0) > 3:
            return "complete"  # Too many adaptations, proceed to completion

        # Check if optimization is needed
        if state.get("adaptations"):
            return "optimize"

        # Check performance
        elapsed = time.time() - state.get("performance_metrics", {}).get(
            "start_time", time.time()
        )
        if elapsed > 60:  # Taking too long
            return "optimize"

        return "continue"

    async def _performance_monitor(
        self, state: DependencyAnalysisState
    ) -> DependencyAnalysisState:
        """Monitor performance and collect metrics."""
        try:
            state["status"] = "performance_monitoring"

            # Record checkpoint
            checkpoint = {
                "timestamp": datetime.utcnow(),
                "elapsed": time.time() - state["performance_metrics"]["start_time"],
                "memory_usage": self._get_memory_usage(),
                "cpu_usage": self._get_cpu_usage(),
            }

            state["performance_metrics"]["checkpoints"].append(checkpoint)

            # Analyze performance trends
            if len(state["performance_metrics"]["checkpoints"]) > 1:
                recent_checkpoints = state["performance_metrics"]["checkpoints"][-2:]
                time_diff = (
                    recent_checkpoints[1]["elapsed"] - recent_checkpoints[0]["elapsed"]
                )

                # If processing is slowing down significantly
                if time_diff > 10:  # Taking more than 10 seconds per checkpoint
                    state["performance_degradation"] = True
                    logger.warning(
                        "Performance degradation detected", time_diff=time_diff
                    )

            state["status"] = "performance_monitored"
            return state

        except Exception as e:
            logger.error("Error in performance monitoring", error=str(e))
            state["status"] = "performance_monitor_error"
            state["error"] = str(e)
            return state

    async def _route_adjustment(
        self, state: DependencyAnalysisState
    ) -> DependencyAnalysisState:
        """Adjust routing based on performance analysis."""
        try:
            state["status"] = "adjusting_route"

            adaptations = state.get("adaptations", {})

            # Apply route adjustments
            if adaptations.get("parallelize_remaining"):
                state["execution_mode"] = "parallel"
                logger.info("Switched to parallel execution mode")

            if adaptations.get("increase_resources"):
                state["resource_level"] = "high"
                logger.info("Increased resource allocation")

            if adaptations.get("reroute_tasks"):
                # Reorder remaining tasks for optimization
                state["task_order"] = self._optimize_task_order(state)
                logger.info("Optimized task execution order")

            state["route_adjusted_at"] = datetime.utcnow()
            state["status"] = "route_adjusted"

            return state

        except Exception as e:
            logger.error("Error in route adjustment", error=str(e))
            state["status"] = "route_adjustment_error"
            state["error"] = str(e)
            return state

    async def _dependency_extraction(
        self, state: DependencyAnalysisState
    ) -> DependencyAnalysisState:
        """Extract dependencies from project."""
        # This would integrate with existing dependency extraction logic
        state["dependencies"] = []  # Placeholder
        state["dependency_extraction_completed_at"] = datetime.utcnow()
        return state

    async def _security_scanning(
        self, state: DependencyAnalysisState
    ) -> DependencyAnalysisState:
        """Perform security scanning."""
        # This would integrate with existing security scanning logic
        state["vulnerabilities"] = []  # Placeholder
        state["security_scan_completed_at"] = datetime.utcnow()
        return state

    async def _policy_evaluation(
        self, state: DependencyAnalysisState
    ) -> DependencyAnalysisState:
        """Evaluate policies."""
        # This would integrate with existing policy evaluation logic
        state["policy_violations"] = []  # Placeholder
        state["policy_evaluation_completed_at"] = datetime.utcnow()
        return state

    async def _recommendation_generation(
        self, state: DependencyAnalysisState
    ) -> DependencyAnalysisState:
        """Generate recommendations."""
        # This would integrate with existing recommendation logic
        state["recommendations"] = []  # Placeholder
        state["recommendations_generated_at"] = datetime.utcnow()
        return state

    async def _final_output(
        self, state: DependencyAnalysisState
    ) -> DependencyAnalysisState:
        """Prepare final output."""
        state["status"] = "completed"
        state["completed_at"] = datetime.utcnow()

        # Calculate total execution time
        if "start_time" in state["performance_metrics"]:
            state["total_execution_time"] = (
                time.time() - state["performance_metrics"]["start_time"]
            )

        # Store performance data for learning
        await self._store_performance_data(state)

        return state

    # Helper methods for parallel tasks
    async def _extract_direct_dependencies(
        self, state: dict[str, Any]
    ) -> dict[str, Any]:
        """Extract direct dependencies."""
        # Implementation would go here
        return {"dependencies": []}

    async def _resolve_transitive_dependencies(
        self, state: dict[str, Any]
    ) -> dict[str, Any]:
        """Resolve transitive dependencies."""
        # Implementation would go here
        return {"dependencies": []}

    async def _detect_dependency_conflicts(
        self, state: dict[str, Any]
    ) -> dict[str, Any]:
        """Detect dependency conflicts."""
        # Implementation would go here
        return {"conflicts": []}

    async def _scan_vulnerabilities(self, state: dict[str, Any]) -> dict[str, Any]:
        """Scan for vulnerabilities."""
        # Implementation would go here
        return {"vulnerabilities": []}

    async def _check_license_compliance(self, state: dict[str, Any]) -> dict[str, Any]:
        """Check license compliance."""
        # Implementation would go here
        return {"license_issues": []}

    async def _scan_malware(self, state: dict[str, Any]) -> dict[str, Any]:
        """Scan for malware."""
        # Implementation would go here
        return {"malware": []}

    def _get_memory_usage(self) -> float:
        """Get current memory usage."""
        import psutil

        return psutil.virtual_memory().percent / 100

    def _get_cpu_usage(self) -> float:
        """Get current CPU usage."""
        import psutil

        return psutil.cpu_percent(interval=0.1) / 100

    def _optimize_task_order(self, state: dict[str, Any]) -> list[str]:
        """Optimize task execution order."""
        # Implementation would analyze dependencies and optimize order
        return ["security_scanning", "policy_evaluation", "recommendation_generation"]

    async def _store_performance_data(self, state: dict[str, Any]):
        """Store performance data for ML model improvement."""
        try:
            workflow_id = state.get("workflow_id")
            if not workflow_id:
                return

            # Calculate actual duration
            duration = state.get("total_execution_time", 0)

            # Determine success
            success = state.get("status") == "completed"

            # Extract resource usage
            resources = {
                "cpu_peak": max(
                    [
                        c.get("cpu_usage", 0)
                        for c in state.get("performance_metrics", {}).get(
                            "checkpoints", []
                        )
                    ]
                    or [0]
                ),
                "memory_peak": max(
                    [
                        c.get("memory_usage", 0)
                        for c in state.get("performance_metrics", {}).get(
                            "checkpoints", []
                        )
                    ]
                    or [0]
                ),
            }

            # Update optimizer with execution data
            await self.optimizer.learn_from_execution(
                workflow_id, timedelta(seconds=duration), resources, success
            )

            logger.info(
                "Performance data stored",
                workflow_id=workflow_id,
                duration=duration,
                success=success,
            )

        except Exception as e:
            logger.error("Error storing performance data", error=str(e))
