"""
Workflow Analytics Core Module for Universal Dependency Platform.

Provides comprehensive workflow performance analytics, trend analysis,
bottleneck identification, and optimization recommendations.
"""

import statistics
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .models.workflow import (
    Workflow,
    WorkflowExecution,
    WorkflowExecutionStep,
)


class WorkflowTrendDirection(str, Enum):
    """Workflow trend direction."""

    IMPROVING = "improving"
    DEGRADING = "degrading"
    STABLE = "stable"
    UNKNOWN = "unknown"


class WorkflowEfficiencyGrade(str, Enum):
    """Workflow efficiency grades."""

    EXCELLENT = "excellent"
    GOOD = "good"
    AVERAGE = "average"
    POOR = "poor"
    CRITICAL = "critical"


@dataclass
class WorkflowPerformanceMetrics:
    """Performance metrics for a workflow execution."""

    execution_id: str
    workflow_id: str
    workflow_type: str

    # Timing metrics
    total_duration_ms: int
    average_step_duration_ms: float
    waiting_time_ms: int = 0
    processing_time_ms: int = 0

    # Step metrics
    total_steps: int = 0
    completed_steps: int = 0
    failed_steps: int = 0
    retried_steps: int = 0

    # Resource metrics
    memory_usage_mb: Optional[float] = None
    cpu_usage_percent: Optional[float] = None

    # Quality metrics
    success_rate: float = 0.0
    error_rate: float = 0.0
    retry_rate: float = 0.0

    # Approval metrics
    approval_count: int = 0
    average_approval_time_ms: float = 0.0

    # Timestamps
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    # Efficiency score (0-100)
    efficiency_score: float = 0.0
    efficiency_grade: WorkflowEfficiencyGrade = WorkflowEfficiencyGrade.AVERAGE


@dataclass
class WorkflowBottleneck:
    """Identified bottleneck in workflow execution."""

    step_name: str
    step_type: str
    workflow_id: str
    workflow_type: str

    # Bottleneck metrics
    average_duration_ms: float
    max_duration_ms: float
    min_duration_ms: float
    occurrence_count: int
    bottleneck_score: float  # 0-100, higher = more severe

    # Impact metrics
    delay_percentage: float  # Percentage of total workflow time
    affected_executions: int
    total_executions: int

    # Recommendations
    recommendations: list[str] = field(default_factory=list)

    # Timestamp
    identified_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class WorkflowTrend:
    """Trend analysis for workflow metrics over time."""

    metric_name: str
    workflow_id: Optional[str]
    workflow_type: Optional[str]

    # Trend data points
    data_points: list[tuple[datetime, float]] = field(default_factory=list)

    # Trend analysis
    direction: WorkflowTrendDirection = WorkflowTrendDirection.UNKNOWN
    trend_strength: float = 0.0  # 0-1, higher = stronger trend

    # Statistical measures
    mean_value: float = 0.0
    median_value: float = 0.0
    standard_deviation: float = 0.0

    # Change metrics
    period_change_percent: float = 0.0
    period_change_value: float = 0.0

    # Period
    start_date: datetime
    end_date: datetime


@dataclass
class WorkflowOptimizationRecommendation:
    """Optimization recommendation for workflow improvement."""

    id: str
    workflow_id: str
    workflow_type: str

    # Recommendation details
    category: str  # "performance", "resource", "reliability", "approval"
    priority: str  # "high", "medium", "low"
    title: str
    description: str

    # Expected impact
    expected_improvement_percent: float
    expected_effort_hours: float
    roi_score: float  # Return on investment score

    # Implementation details
    steps: list[str] = field(default_factory=list)
    risks: list[str] = field(default_factory=list)

    # Metadata
    created_at: datetime = field(default_factory=datetime.utcnow)
    applies_to_executions: int = 0


class WorkflowAnalytics:
    """
    Core workflow analytics engine.

    Provides performance analysis, trend identification, bottleneck detection,
    and optimization recommendations for workflows.
    """

    def __init__(self, db_session: AsyncSession):
        """Initialize workflow analytics engine."""
        self.db = db_session

    async def calculate_performance_metrics(
        self, execution_id: str, include_step_details: bool = False
    ) -> WorkflowPerformanceMetrics:
        """
        Calculate comprehensive performance metrics for a workflow execution.

        Args:
            execution_id: Workflow execution ID
            include_step_details: Whether to include detailed step metrics

        Returns:
            Performance metrics for the execution
        """
        # Get workflow execution with relationships
        execution_query = (
            select(WorkflowExecution)
            .options(
                selectinload(WorkflowExecution.steps),
                selectinload(WorkflowExecution.approvals),
                selectinload(WorkflowExecution.workflow),
            )
            .where(WorkflowExecution.id == execution_id)
        )
        execution_result = await self.db.execute(execution_query)
        execution = execution_result.scalar_one_or_none()

        if not execution:
            raise ValueError(f"Workflow execution {execution_id} not found")

        # Calculate timing metrics
        total_duration = 0
        processing_time = 0
        waiting_time = 0
        step_durations = []

        completed_steps = 0
        failed_steps = 0
        retried_steps = 0

        for step_execution in execution.steps:
            if step_execution.started_at and step_execution.completed_at:
                duration_ms = int(
                    (
                        step_execution.completed_at - step_execution.started_at
                    ).total_seconds()
                    * 1000
                )
                step_durations.append(duration_ms)
                total_duration += duration_ms
                processing_time += duration_ms
                completed_steps += 1
            elif step_execution.status == "failed":
                failed_steps += 1
            elif step_execution.status == "retried":
                retried_steps += 1

        # Calculate average step duration
        avg_step_duration = statistics.mean(step_durations) if step_durations else 0

        # Calculate rates
        total_steps = len(execution.steps)
        success_rate = (completed_steps / total_steps * 100) if total_steps > 0 else 0
        error_rate = (failed_steps / total_steps * 100) if total_steps > 0 else 0
        retry_rate = (retried_steps / total_steps * 100) if total_steps > 0 else 0

        # Calculate approval metrics
        approval_count = len(execution.approvals)
        approval_times = []

        for approval in execution.approvals:
            if approval.approved_at and execution.started_at:
                approval_time_ms = int(
                    (approval.approved_at - execution.started_at).total_seconds() * 1000
                )
                approval_times.append(approval_time_ms)

        avg_approval_time = statistics.mean(approval_times) if approval_times else 0

        # Calculate efficiency score (0-100)
        efficiency_score = self._calculate_efficiency_score(
            success_rate=success_rate,
            error_rate=error_rate,
            retry_rate=retry_rate,
            avg_step_duration=avg_step_duration,
            avg_approval_time=avg_approval_time,
        )

        # Determine efficiency grade
        efficiency_grade = self._determine_efficiency_grade(efficiency_score)

        return WorkflowPerformanceMetrics(
            execution_id=str(execution.id),
            workflow_id=str(execution.workflow_id),
            workflow_type=execution.workflow.workflow_type
            if execution.workflow
            else "unknown",
            total_duration_ms=total_duration,
            average_step_duration_ms=avg_step_duration,
            waiting_time_ms=waiting_time,
            processing_time_ms=processing_time,
            total_steps=total_steps,
            completed_steps=completed_steps,
            failed_steps=failed_steps,
            retried_steps=retried_steps,
            approval_count=approval_count,
            average_approval_time_ms=avg_approval_time,
            started_at=execution.started_at,
            completed_at=execution.completed_at,
            success_rate=success_rate,
            error_rate=error_rate,
            retry_rate=retry_rate,
            efficiency_score=efficiency_score,
            efficiency_grade=efficiency_grade,
        )

    async def identify_bottlenecks(
        self,
        workflow_id: Optional[str] = None,
        workflow_type: Optional[str] = None,
        analysis_period_days: int = 30,
        min_occurrences: int = 5,
    ) -> list[WorkflowBottleneck]:
        """
        Identify workflow bottlenecks based on historical execution data.

        Args:
            workflow_id: Specific workflow ID to analyze (optional)
            workflow_type: Workflow type to filter (optional)
            analysis_period_days: Number of days to analyze
            min_occurrences: Minimum occurrences to consider a bottleneck

        Returns:
            List of identified bottlenecks
        """
        # Define time window
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=analysis_period_days)

        # Query workflow executions in the time period
        executions_query = (
            select(WorkflowExecution)
            .options(
                selectinload(WorkflowExecution.steps).selectinload(
                    WorkflowExecutionStep.step
                ),
                selectinload(WorkflowExecution.workflow),
            )
            .where(
                and_(
                    WorkflowExecution.started_at >= start_date,
                    WorkflowExecution.started_at <= end_date,
                )
            )
        )

        if workflow_id:
            executions_query = executions_query.where(
                WorkflowExecution.workflow_id == UUID(workflow_id)
            )

        if workflow_type:
            executions_query = executions_query.join(Workflow).where(
                Workflow.workflow_type == workflow_type
            )

        executions_result = await self.db.execute(executions_query)
        executions = executions_result.scalars().all()

        # Aggregate step execution data
        step_performance = {}

        for execution in executions:
            execution_total_time = 0

            for step_exec in execution.steps:
                if step_exec.started_at and step_exec.completed_at:
                    duration_ms = int(
                        (step_exec.completed_at - step_exec.started_at).total_seconds()
                        * 1000
                    )

                    step_key = (
                        step_exec.step.name,
                        step_exec.step.step_type,
                        str(execution.workflow_id),
                        execution.workflow.workflow_type
                        if execution.workflow
                        else "unknown",
                    )

                    if step_key not in step_performance:
                        step_performance[step_key] = {
                            "durations": [],
                            "occurrence_count": 0,
                            "total_executions": 0,
                            "workflow_id": str(execution.workflow_id),
                            "workflow_type": execution.workflow.workflow_type
                            if execution.workflow
                            else "unknown",
                        }

                    step_performance[step_key]["durations"].append(duration_ms)
                    step_performance[step_key]["occurrence_count"] += 1
                    execution_total_time += duration_ms

            # Update total executions count
            for step_key in step_performance:
                if execution_total_time > 0:
                    step_performance[step_key]["total_executions"] += 1

        # Identify bottlenecks
        bottlenecks = []

        for (step_name, step_type, w_id, w_type), data in step_performance.items():
            if data["occurrence_count"] < min_occurrences:
                continue

            durations = data["durations"]
            avg_duration = statistics.mean(durations)
            max_duration = max(durations)
            min_duration = min(durations)

            # Calculate bottleneck score based on duration variance and comparison to average
            variance = statistics.variance(durations) if len(durations) > 1 else 0
            bottleneck_score = min(
                100, (avg_duration / 1000) * 10 + (variance / 1000000) * 5
            )

            # Calculate delay percentage (how much this step contributes to total execution time)
            total_workflow_times = []
            for execution in executions:
                if str(execution.workflow_id) == w_id:
                    exec_time = sum(
                        int((se.completed_at - se.started_at).total_seconds() * 1000)
                        for se in execution.steps
                        if se.started_at and se.completed_at
                    )
                    total_workflow_times.append(exec_time)

            avg_total_time = (
                statistics.mean(total_workflow_times) if total_workflow_times else 1
            )
            delay_percentage = (
                (avg_duration / avg_total_time * 100) if avg_total_time > 0 else 0
            )

            # Generate recommendations
            recommendations = self._generate_bottleneck_recommendations(
                step_name=step_name,
                step_type=step_type,
                avg_duration=avg_duration,
                variance=variance,
                delay_percentage=delay_percentage,
            )

            # Only consider it a bottleneck if it meets certain criteria
            if bottleneck_score > 30 or delay_percentage > 20:
                bottlenecks.append(
                    WorkflowBottleneck(
                        step_name=step_name,
                        step_type=step_type,
                        workflow_id=w_id,
                        workflow_type=w_type,
                        average_duration_ms=avg_duration,
                        max_duration_ms=max_duration,
                        min_duration_ms=min_duration,
                        occurrence_count=data["occurrence_count"],
                        bottleneck_score=bottleneck_score,
                        delay_percentage=delay_percentage,
                        affected_executions=data["total_executions"],
                        total_executions=data["total_executions"],
                        recommendations=recommendations,
                    )
                )

        # Sort by bottleneck score (descending)
        bottlenecks.sort(key=lambda x: x.bottleneck_score, reverse=True)

        return bottlenecks

    async def analyze_trends(
        self,
        metric_name: str,
        workflow_id: Optional[str] = None,
        workflow_type: Optional[str] = None,
        period_days: int = 30,
        interval_hours: int = 24,
    ) -> WorkflowTrend:
        """
        Analyze trends for a specific workflow metric over time.

        Args:
            metric_name: Name of the metric to analyze
            workflow_id: Specific workflow ID (optional)
            workflow_type: Workflow type filter (optional)
            period_days: Analysis period in days
            interval_hours: Data aggregation interval in hours

        Returns:
            Trend analysis results
        """
        # Define time window
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=period_days)

        # Get metric data points based on metric type
        data_points = await self._get_metric_data_points(
            metric_name=metric_name,
            workflow_id=workflow_id,
            workflow_type=workflow_type,
            start_date=start_date,
            end_date=end_date,
            interval_hours=interval_hours,
        )

        if not data_points:
            return WorkflowTrend(
                metric_name=metric_name,
                workflow_id=workflow_id,
                workflow_type=workflow_type,
                start_date=start_date,
                end_date=end_date,
                direction=WorkflowTrendDirection.UNKNOWN,
            )

        # Calculate trend direction and strength
        direction, trend_strength = self._calculate_trend_direction(data_points)

        # Calculate statistical measures
        values = [point[1] for point in data_points]
        mean_value = statistics.mean(values)
        median_value = statistics.median(values)
        std_dev = statistics.stdev(values) if len(values) > 1 else 0

        # Calculate period change
        period_change_value = values[-1] - values[0] if len(values) > 1 else 0
        period_change_percent = (
            (period_change_value / values[0] * 100) if values[0] != 0 else 0
        )

        return WorkflowTrend(
            metric_name=metric_name,
            workflow_id=workflow_id,
            workflow_type=workflow_type,
            data_points=data_points,
            direction=direction,
            trend_strength=trend_strength,
            mean_value=mean_value,
            median_value=median_value,
            standard_deviation=std_dev,
            period_change_percent=period_change_percent,
            period_change_value=period_change_value,
            start_date=start_date,
            end_date=end_date,
        )

    async def generate_optimization_recommendations(
        self,
        workflow_id: Optional[str] = None,
        workflow_type: Optional[str] = None,
        analysis_period_days: int = 30,
    ) -> list[WorkflowOptimizationRecommendation]:
        """
        Generate optimization recommendations for workflow improvements.

        Args:
            workflow_id: Specific workflow ID (optional)
            workflow_type: Workflow type filter (optional)
            analysis_period_days: Analysis period in days

        Returns:
            List of optimization recommendations
        """
        recommendations = []

        # Get bottlenecks
        bottlenecks = await self.identify_bottlenecks(
            workflow_id=workflow_id,
            workflow_type=workflow_type,
            analysis_period_days=analysis_period_days,
        )

        # Generate recommendations based on bottlenecks
        for bottleneck in bottlenecks[:5]:  # Top 5 bottlenecks
            if bottleneck.bottleneck_score > 70:
                priority = "high"
                expected_improvement = min(50, bottleneck.bottleneck_score / 2)
            elif bottleneck.bottleneck_score > 40:
                priority = "medium"
                expected_improvement = min(30, bottleneck.bottleneck_score / 3)
            else:
                priority = "low"
                expected_improvement = min(15, bottleneck.bottleneck_score / 4)

            recommendation = WorkflowOptimizationRecommendation(
                id=f"bottleneck-{bottleneck.step_name.lower().replace(' ', '-')}",
                workflow_id=bottleneck.workflow_id,
                workflow_type=bottleneck.workflow_type,
                category="performance",
                priority=priority,
                title=f"Optimize {bottleneck.step_name} Step",
                description=f"The '{bottleneck.step_name}' step is causing significant delays "
                f"({bottleneck.delay_percentage:.1f}% of total execution time). "
                f"Average duration: {bottleneck.average_duration_ms:.0f}ms",
                expected_improvement_percent=expected_improvement,
                expected_effort_hours=8
                if priority == "high"
                else 4
                if priority == "medium"
                else 2,
                roi_score=self._calculate_roi_score(
                    expected_improvement, 8 if priority == "high" else 4
                ),
                steps=bottleneck.recommendations,
                applies_to_executions=bottleneck.affected_executions,
            )
            recommendations.append(recommendation)

        # Analyze failure patterns and generate reliability recommendations
        failure_recommendations = await self._analyze_failure_patterns(
            workflow_id=workflow_id,
            workflow_type=workflow_type,
            analysis_period_days=analysis_period_days,
        )
        recommendations.extend(failure_recommendations)

        # Analyze approval patterns and generate approval optimization recommendations
        approval_recommendations = await self._analyze_approval_patterns(
            workflow_id=workflow_id,
            workflow_type=workflow_type,
            analysis_period_days=analysis_period_days,
        )
        recommendations.extend(approval_recommendations)

        # Sort by ROI score (descending)
        recommendations.sort(key=lambda x: x.roi_score, reverse=True)

        return recommendations

    async def get_workflow_performance_summary(
        self, workflow_id: str, period_days: int = 30
    ) -> dict[str, Any]:
        """
        Get a comprehensive performance summary for a workflow.

        Args:
            workflow_id: Workflow ID
            period_days: Analysis period in days

        Returns:
            Performance summary dictionary
        """
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=period_days)

        # Get workflow executions in the period
        executions_query = (
            select(WorkflowExecution)
            .options(selectinload(WorkflowExecution.steps))
            .where(
                and_(
                    WorkflowExecution.workflow_id == UUID(workflow_id),
                    WorkflowExecution.started_at >= start_date,
                    WorkflowExecution.started_at <= end_date,
                )
            )
        )

        executions_result = await self.db.execute(executions_query)
        executions = executions_result.scalars().all()

        if not executions:
            return {
                "workflow_id": workflow_id,
                "period_days": period_days,
                "total_executions": 0,
                "message": "No executions found in the specified period",
            }

        # Calculate summary metrics
        total_executions = len(executions)
        successful_executions = len([e for e in executions if e.status == "completed"])
        failed_executions = len([e for e in executions if e.status == "failed"])
        success_rate = (
            (successful_executions / total_executions * 100)
            if total_executions > 0
            else 0
        )

        # Calculate duration statistics
        durations = []
        for execution in executions:
            if execution.started_at and execution.completed_at:
                duration_ms = int(
                    (execution.completed_at - execution.started_at).total_seconds()
                    * 1000
                )
                durations.append(duration_ms)

        duration_stats = {}
        if durations:
            duration_stats = {
                "average_ms": statistics.mean(durations),
                "median_ms": statistics.median(durations),
                "min_ms": min(durations),
                "max_ms": max(durations),
                "std_dev_ms": statistics.stdev(durations) if len(durations) > 1 else 0,
            }

        # Get recent bottlenecks
        bottlenecks = await self.identify_bottlenecks(
            workflow_id=workflow_id, analysis_period_days=period_days
        )

        # Get recent trends
        duration_trend = await self.analyze_trends(
            metric_name="duration", workflow_id=workflow_id, period_days=period_days
        )

        # Get optimization recommendations
        recommendations = await self.generate_optimization_recommendations(
            workflow_id=workflow_id, analysis_period_days=period_days
        )

        return {
            "workflow_id": workflow_id,
            "period_days": period_days,
            "execution_summary": {
                "total_executions": total_executions,
                "successful_executions": successful_executions,
                "failed_executions": failed_executions,
                "success_rate": success_rate,
            },
            "duration_statistics": duration_stats,
            "bottlenecks": [
                {
                    "step_name": b.step_name,
                    "average_duration_ms": b.average_duration_ms,
                    "delay_percentage": b.delay_percentage,
                    "bottleneck_score": b.bottleneck_score,
                }
                for b in bottlenecks[:5]
            ],
            "trends": {
                "duration": {
                    "direction": duration_trend.direction,
                    "change_percent": duration_trend.period_change_percent,
                }
            },
            "recommendations_count": len(recommendations),
            "top_recommendations": [
                {
                    "title": r.title,
                    "priority": r.priority,
                    "expected_improvement": r.expected_improvement_percent,
                }
                for r in recommendations[:3]
            ],
        }

    def _calculate_efficiency_score(
        self,
        success_rate: float,
        error_rate: float,
        retry_rate: float,
        avg_step_duration: float,
        avg_approval_time: float,
    ) -> float:
        """Calculate workflow efficiency score (0-100)."""
        # Base score from success rate
        base_score = success_rate

        # Deductions for errors and retries
        error_deduction = error_rate * 0.5
        retry_deduction = retry_rate * 0.3

        # Time-based deductions (for slow executions)
        time_deduction = 0
        if avg_step_duration > 10000:  # > 10 seconds
            time_deduction = min(20, (avg_step_duration - 10000) / 1000)

        if avg_approval_time > 300000:  # > 5 minutes
            time_deduction += min(15, (avg_approval_time - 300000) / 60000)

        # Calculate final score
        efficiency_score = (
            base_score - error_deduction - retry_deduction - time_deduction
        )
        return max(0, min(100, efficiency_score))

    def _determine_efficiency_grade(self, score: float) -> WorkflowEfficiencyGrade:
        """Determine efficiency grade based on score."""
        if score >= 90:
            return WorkflowEfficiencyGrade.EXCELLENT
        elif score >= 75:
            return WorkflowEfficiencyGrade.GOOD
        elif score >= 60:
            return WorkflowEfficiencyGrade.AVERAGE
        elif score >= 40:
            return WorkflowEfficiencyGrade.POOR
        else:
            return WorkflowEfficiencyGrade.CRITICAL

    def _generate_bottleneck_recommendations(
        self,
        step_name: str,
        step_type: str,
        avg_duration: float,
        variance: float,
        delay_percentage: float,
    ) -> list[str]:
        """Generate recommendations for addressing a bottleneck."""
        recommendations = []

        if avg_duration > 30000:  # > 30 seconds
            recommendations.append(
                "Consider optimizing the step implementation for better performance"
            )
            recommendations.append("Implement caching to avoid redundant processing")

        if variance > (avg_duration * 0.5):  # High variance
            recommendations.append("Investigate inconsistent execution times")
            recommendations.append(
                "Add more detailed logging to identify performance variations"
            )

        if delay_percentage > 30:
            recommendations.append(
                "This step significantly impacts workflow performance"
            )
            recommendations.append(
                "Consider breaking down into smaller, parallelizable steps"
            )

        if "approval" in step_type.lower():
            recommendations.append("Streamline approval process with clear guidelines")
            recommendations.append(
                "Implement automatic approvals for low-risk scenarios"
            )

        if "scan" in step_type.lower() or "analysis" in step_type.lower():
            recommendations.append("Optimize scanning parameters for faster execution")
            recommendations.append(
                "Consider incremental analysis to avoid full re-scans"
            )

        if not recommendations:
            recommendations.append(
                "Monitor this step for potential optimization opportunities"
            )

        return recommendations

    async def _get_metric_data_points(
        self,
        metric_name: str,
        workflow_id: Optional[str],
        workflow_type: Optional[str],
        start_date: datetime,
        end_date: datetime,
        interval_hours: int,
    ) -> list[tuple[datetime, float]]:
        """Get metric data points for trend analysis."""
        data_points = []

        # Query executions based on metric
        if metric_name == "duration":
            query = (
                select(WorkflowExecution.started_at, WorkflowExecution.completed_at)
                .join(Workflow)
                .where(
                    and_(
                        WorkflowExecution.started_at >= start_date,
                        WorkflowExecution.started_at <= end_date,
                        WorkflowExecution.started_at.isnot(None),
                        WorkflowExecution.completed_at.isnot(None),
                    )
                )
            )

            if workflow_id:
                query = query.where(WorkflowExecution.workflow_id == UUID(workflow_id))
            if workflow_type:
                query = query.where(Workflow.workflow_type == workflow_type)

            result = await self.db.execute(query.order_by(WorkflowExecution.started_at))

            for started_at, completed_at in result:
                if started_at and completed_at:
                    duration_ms = int(
                        (completed_at - started_at).total_seconds() * 1000
                    )
                    data_points.append((started_at, duration_ms))

        elif metric_name == "success_rate":
            # Calculate success rate by intervals
            current_time = start_date
            while current_time < end_date:
                interval_end = current_time + timedelta(hours=interval_hours)

                total_query = (
                    select(func.count(WorkflowExecution.id))
                    .join(Workflow)
                    .where(
                        and_(
                            WorkflowExecution.started_at >= current_time,
                            WorkflowExecution.started_at < interval_end,
                        )
                    )
                )

                success_query = (
                    select(func.count(WorkflowExecution.id))
                    .join(Workflow)
                    .where(
                        and_(
                            WorkflowExecution.started_at >= current_time,
                            WorkflowExecution.started_at < interval_end,
                            WorkflowExecution.status == "completed",
                        )
                    )
                )

                if workflow_id:
                    total_query = total_query.where(
                        WorkflowExecution.workflow_id == UUID(workflow_id)
                    )
                    success_query = success_query.where(
                        WorkflowExecution.workflow_id == UUID(workflow_id)
                    )
                if workflow_type:
                    total_query = total_query.where(
                        Workflow.workflow_type == workflow_type
                    )
                    success_query = success_query.where(
                        Workflow.workflow_type == workflow_type
                    )

                total_result = await self.db.execute(total_query)
                success_result = await self.db.execute(success_query)

                total_count = total_result.scalar() or 0
                success_count = success_result.scalar() or 0

                if total_count > 0:
                    success_rate = (success_count / total_count) * 100
                    data_points.append((current_time, success_rate))

                current_time = interval_end

        return data_points

    def _calculate_trend_direction(
        self, data_points: list[tuple[datetime, float]]
    ) -> tuple[WorkflowTrendDirection, float]:
        """Calculate trend direction and strength from data points."""
        if len(data_points) < 2:
            return WorkflowTrendDirection.UNKNOWN, 0.0

        # Simple linear regression to determine trend
        n = len(data_points)
        x_values = list(range(n))
        y_values = [point[1] for point in data_points]

        # Calculate slope
        x_mean = statistics.mean(x_values)
        y_mean = statistics.mean(y_values)

        numerator = sum((x - x_mean) * (y - y_mean) for x, y in zip(x_values, y_values, strict=False))
        denominator = sum((x - x_mean) ** 2 for x in x_values)

        if denominator == 0:
            return WorkflowTrendDirection.STABLE, 0.0

        slope = numerator / denominator

        # Calculate R-squared for trend strength
        y_pred = [slope * x + (y_mean - slope * x_mean) for x in x_values]
        ss_res = sum((y - y_pred_x) ** 2 for y, y_pred_x in zip(y_values, y_pred, strict=False))
        ss_tot = sum((y - y_mean) ** 2 for y in y_values)

        r_squared = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0
        trend_strength = abs(r_squared)

        # Determine direction based on slope
        if abs(slope) < 0.01:  # Very small slope
            return WorkflowTrendDirection.STABLE, trend_strength
        elif slope > 0:
            return WorkflowTrendDirection.IMPROVING if "success_rate" in str(
                y_values[0]
            ) else WorkflowTrendDirection.DEGRADING, trend_strength
        else:
            return WorkflowTrendDirection.DEGRADING if "success_rate" in str(
                y_values[0]
            ) else WorkflowTrendDirection.IMPROVING, trend_strength

    def _calculate_roi_score(
        self, expected_improvement: float, effort_hours: float
    ) -> float:
        """Calculate ROI score for a recommendation."""
        if effort_hours == 0:
            return 100.0

        # Simple ROI calculation: improvement / effort
        roi = (expected_improvement / effort_hours) * 10
        return min(100, max(0, roi))

    async def _analyze_failure_patterns(
        self,
        workflow_id: Optional[str],
        workflow_type: Optional[str],
        analysis_period_days: int,
    ) -> list[WorkflowOptimizationRecommendation]:
        """Analyze failure patterns and generate reliability recommendations."""
        recommendations = []

        # Implementation for failure pattern analysis
        # This would analyze common failure modes and suggest improvements

        return recommendations

    async def _analyze_approval_patterns(
        self,
        workflow_id: Optional[str],
        workflow_type: Optional[str],
        analysis_period_days: int,
    ) -> list[WorkflowOptimizationRecommendation]:
        """Analyze approval patterns and generate optimization recommendations."""
        recommendations = []

        # Implementation for approval pattern analysis
        # This would analyze approval delays and suggest optimizations

        return recommendations
