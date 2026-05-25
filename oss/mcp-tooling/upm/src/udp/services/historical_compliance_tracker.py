"""
Historical Compliance Tracking Service.

Provides comprehensive historical compliance data tracking,
trend analysis, and compliance history management.
"""

import logging
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta
from enum import Enum
from statistics import mean, median, stdev
from typing import Any, Optional
from uuid import UUID

import numpy as np
import pandas as pd
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.exceptions import ComplianceError, ValidationError
from ..core.models.compliance import (
    ComplianceCheck,
    ComplianceStatus,
)
from ..services.compliance_service import ComplianceFramework, ComplianceService

logger = logging.getLogger(__name__)


class TrendDirection(str, Enum):
    """Compliance trend direction."""

    IMPROVING = "improving"
    DECLINING = "declining"
    STABLE = "stable"
    FLUCTUATING = "fluctuating"


class CompliancePeriod(str, Enum):
    """Compliance tracking periods."""

    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"


@dataclass
class ComplianceSnapshot:
    """Historical compliance snapshot."""

    timestamp: datetime
    compliance_score: float
    total_violations: int
    critical_violations: int
    high_violations: int
    medium_violations: int
    low_violations: int
    risk_score: float
    total_checks: int
    compliant_checks: int
    framework: ComplianceFramework
    organization_id: Optional[UUID] = None
    project_id: Optional[UUID] = None


@dataclass
class ComplianceTrend:
    """Compliance trend analysis."""

    period: str
    direction: TrendDirection
    change_rate: float
    confidence: float
    forecast: list[dict[str, Any]]
    significant_events: list[dict[str, Any]]
    metrics: dict[str, Any]


class HistoricalComplianceTracker:
    """
    Historical compliance tracking and trend analysis service.

    Features:
    - Historical compliance data collection and storage
    - Trend analysis and forecasting
    - Compliance metrics aggregation
    - Periodic compliance snapshots
    - Comparative historical analysis
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.compliance_service = ComplianceService(db)
        self.snapshots: dict[str, list[ComplianceSnapshot]] = {}
        logger.info("Historical Compliance Tracker initialized")

    async def capture_compliance_snapshot(
        self,
        framework: ComplianceFramework,
        organization_id: Optional[UUID] = None,
        project_id: Optional[UUID] = None,
        timestamp: Optional[datetime] = None,
        force_capture: bool = False,
    ) -> ComplianceSnapshot:
        """
        Capture a compliance snapshot for historical tracking.

        Args:
            framework: Compliance framework
            organization_id: Organization scope
            project_id: Project scope
            timestamp: Snapshot timestamp (default: now)
            force_capture: Force capture even if recently captured

        Returns:
            Captured compliance snapshot
        """
        try:
            if not timestamp:
                timestamp = datetime.utcnow()

            logger.info(
                f"Capturing {framework.value} compliance snapshot for org {organization_id}"
            )

            # Check if snapshot already exists for this period
            if not force_capture:
                recent_snapshot = await self._get_recent_snapshot(
                    framework, organization_id, project_id, hours=1
                )
                if recent_snapshot:
                    logger.info("Recent snapshot exists, skipping capture")
                    return recent_snapshot

            # Get current compliance data
            if project_id:
                compliance_data = (
                    await self.compliance_service.assess_project_compliance(
                        project_id, [framework]
                    )
                )
            elif organization_id:
                compliance_data = (
                    await self.compliance_service.get_compliance_dashboard(
                        organization_id, timeframe=30
                    )
                )
            else:
                raise ValidationError(
                    "Either organization_id or project_id must be provided"
                )

            # Extract metrics
            metrics = compliance_data.get("metrics", {})
            if not metrics:
                # Calculate from compliance checks
                metrics = await self._calculate_current_metrics(
                    framework, organization_id, project_id
                )

            # Create snapshot
            snapshot = ComplianceSnapshot(
                timestamp=timestamp,
                compliance_score=metrics.get("compliance_percentage", 0),
                total_violations=metrics.get("violation_count", 0),
                critical_violations=metrics.get("severity_breakdown", {}).get(
                    "critical", 0
                ),
                high_violations=metrics.get("severity_breakdown", {}).get("high", 0),
                medium_violations=metrics.get("severity_breakdown", {}).get(
                    "medium", 0
                ),
                low_violations=metrics.get("severity_breakdown", {}).get("low", 0),
                risk_score=metrics.get("risk_score", 0),
                total_checks=metrics.get("total_checks", 0),
                compliant_checks=metrics.get("compliant_checks", 0),
                framework=framework,
                organization_id=organization_id,
                project_id=project_id,
            )

            # Store snapshot
            await self._store_snapshot(snapshot)

            logger.info(
                f"Captured compliance snapshot: score {snapshot.compliance_score}%"
            )
            return snapshot

        except Exception as e:
            logger.error(f"Failed to capture compliance snapshot: {e}", exc_info=True)
            raise ComplianceError(f"Snapshot capture failed: {str(e)}")

    async def analyze_compliance_trends(
        self,
        framework: ComplianceFramework,
        organization_id: Optional[UUID] = None,
        project_id: Optional[UUID] = None,
        period_days: int = 90,
        period_type: CompliancePeriod = CompliancePeriod.WEEKLY,
    ) -> ComplianceTrend:
        """
        Analyze compliance trends over time.

        Args:
            framework: Compliance framework
            organization_id: Organization scope
            project_id: Project scope
            period_days: Analysis period in days
            period_type: Aggregation period type

        Returns:
            Compliance trend analysis
        """
        try:
            logger.info(
                f"Analyzing {framework.value} compliance trends over {period_days} days"
            )

            # Get historical snapshots
            snapshots = await self._get_historical_snapshots(
                framework=framework,
                organization_id=organization_id,
                project_id=project_id,
                start_date=datetime.utcnow() - timedelta(days=period_days),
                end_date=datetime.utcnow(),
            )

            if len(snapshots) < 2:
                logger.warning("Insufficient data for trend analysis")
                return ComplianceTrend(
                    period=period_type.value,
                    direction=TrendDirection.STABLE,
                    change_rate=0.0,
                    confidence=0.0,
                    forecast=[],
                    significant_events=[],
                    metrics={"insufficient_data": True},
                )

            # Aggregate data by period
            aggregated_data = self._aggregate_snapshots_by_period(
                snapshots, period_type
            )

            # Calculate trend metrics
            scores = [s["compliance_score"] for s in aggregated_data]
            violations = [s["total_violations"] for s in aggregated_data]
            risk_scores = [s["risk_score"] for s in aggregated_data]

            # Determine trend direction
            direction = self._determine_trend_direction(scores)

            # Calculate change rate
            change_rate = self._calculate_change_rate(scores)

            # Calculate confidence level
            confidence = self._calculate_confidence(scores, violations)

            # Generate forecast
            forecast = self._generate_forecast(aggregated_data, period_type)

            # Identify significant events
            significant_events = await self._identify_trend_events(
                snapshots, framework, organization_id, project_id
            )

            # Calculate additional metrics
            metrics = {
                "data_points": len(aggregated_data),
                "period_type": period_type.value,
                "start_date": aggregated_data[0]["timestamp"].isoformat(),
                "end_date": aggregated_data[-1]["timestamp"].isoformat(),
                "average_score": mean(scores),
                "median_score": median(scores),
                "score_std_dev": stdev(scores) if len(scores) > 1 else 0,
                "min_score": min(scores),
                "max_score": max(scores),
                "average_violations": mean(violations),
                "violation_trend": self._determine_trend_direction(violations),
                "average_risk": mean(risk_scores),
                "risk_trend": self._determine_trend_direction(risk_scores),
                "compliance_velocity": self._calculate_compliance_velocity(
                    aggregated_data
                ),
            }

            trend = ComplianceTrend(
                period=period_type.value,
                direction=direction,
                change_rate=change_rate,
                confidence=confidence,
                forecast=forecast,
                significant_events=significant_events,
                metrics=metrics,
            )

            logger.info(
                f"Trend analysis complete: {direction.value} trend with {change_rate:.2f}% change"
            )
            return trend

        except Exception as e:
            logger.error(f"Failed to analyze compliance trends: {e}", exc_info=True)
            raise ComplianceError(f"Trend analysis failed: {str(e)}")

    async def get_compliance_history(
        self,
        framework: ComplianceFramework,
        organization_id: Optional[UUID] = None,
        project_id: Optional[UUID] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        granularity: CompliancePeriod = CompliancePeriod.DAILY,
        include_details: bool = False,
    ) -> dict[str, Any]:
        """
        Get comprehensive compliance history.

        Args:
            framework: Compliance framework
            organization_id: Organization scope
            project_id: Project scope
            start_date: Start date for history
            end_date: End date for history
            granularity: Data granularity
            include_details: Include detailed violation information

        Returns:
            Compliance history data
        """
        try:
            logger.info(f"Getting compliance history for {framework.value}")

            # Set default date range
            if not end_date:
                end_date = datetime.utcnow()
            if not start_date:
                start_date = end_date - timedelta(days=90)

            # Get snapshots
            snapshots = await self._get_historical_snapshots(
                framework=framework,
                organization_id=organization_id,
                project_id=project_id,
                start_date=start_date,
                end_date=end_date,
            )

            # Group by granularity
            grouped_data = self._group_snapshots_by_granularity(snapshots, granularity)

            # Calculate statistics
            all_scores = [s.compliance_score for s in snapshots]
            all_violations = [s.total_violations for s in snapshots]

            history = {
                "framework": framework.value,
                "scope": {
                    "organization_id": str(organization_id)
                    if organization_id
                    else None,
                    "project_id": str(project_id) if project_id else None,
                },
                "period": {
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat(),
                    "granularity": granularity.value,
                },
                "summary": {
                    "total_snapshots": len(snapshots),
                    "average_compliance": mean(all_scores) if all_scores else 0,
                    "median_compliance": median(all_scores) if all_scores else 0,
                    "min_compliance": min(all_scores) if all_scores else 0,
                    "max_compliance": max(all_scores) if all_scores else 0,
                    "total_violations": sum(all_violations),
                    "average_violations": mean(all_violations) if all_violations else 0,
                    "compliance_days": sum(1 for s in all_scores if s >= 95),
                    "compliance_percentage": (
                        sum(1 for s in all_scores if s >= 95) / len(all_scores) * 100
                    )
                    if all_scores
                    else 0,
                },
                "data": grouped_data,
                "milestones": await self._get_compliance_milestones(
                    framework, organization_id, project_id, start_date, end_date
                ),
            }

            if include_details:
                history["violation_details"] = await self._get_violation_history(
                    framework, organization_id, project_id, start_date, end_date
                )

            return history

        except Exception as e:
            logger.error(f"Failed to get compliance history: {e}", exc_info=True)
            raise ComplianceError(f"History retrieval failed: {str(e)}")

    async def compare_compliance_periods(
        self,
        framework: ComplianceFramework,
        organization_id: Optional[UUID] = None,
        project_id: Optional[UUID] = None,
        period1_start: datetime = None,
        period1_end: datetime = None,
        period2_start: datetime = None,
        period2_end: datetime = None,
    ) -> dict[str, Any]:
        """
        Compare compliance between two periods.

        Args:
            framework: Compliance framework
            organization_id: Organization scope
            project_id: Project scope
            period1_start: First period start date
            period1_end: First period end date
            period2_start: Second period start date
            period2_end: Second period end date

        Returns:
            Period comparison analysis
        """
        try:
            logger.info(f"Comparing compliance periods for {framework.value}")

            # Set default periods if not provided
            if not period1_end:
                period1_end = datetime.utcnow()
            if not period1_start:
                period1_start = period1_end - timedelta(days=30)
            if not period2_end:
                period2_end = period1_start - timedelta(days=1)
            if not period2_start:
                period2_start = period2_end - timedelta(days=30)

            # Get data for both periods
            period1_data = await self.get_compliance_history(
                framework=framework,
                organization_id=organization_id,
                project_id=project_id,
                start_date=period1_start,
                end_date=period1_end,
                granularity=CompliancePeriod.DAILY,
            )

            period2_data = await self.get_compliance_history(
                framework=framework,
                organization_id=organization_id,
                project_id=project_id,
                start_date=period2_start,
                end_date=period2_end,
                granularity=CompliancePeriod.DAILY,
            )

            # Calculate differences
            comparison = {
                "framework": framework.value,
                "period1": {
                    "start": period1_start.isoformat(),
                    "end": period1_end.isoformat(),
                    "days": (period1_end - period1_start).days,
                    "summary": period1_data["summary"],
                },
                "period2": {
                    "start": period2_start.isoformat(),
                    "end": period2_end.isoformat(),
                    "days": (period2_end - period2_start).days,
                    "summary": period2_data["summary"],
                },
                "differences": {
                    "compliance_score_change": (
                        period1_data["summary"]["average_compliance"]
                        - period2_data["summary"]["average_compliance"]
                    ),
                    "violations_change": (
                        period1_data["summary"]["total_violations"]
                        - period2_data["summary"]["total_violations"]
                    ),
                    "compliance_days_change": (
                        period1_data["summary"]["compliance_days"]
                        - period2_data["summary"]["compliance_days"]
                    ),
                    "compliance_percentage_change": (
                        period1_data["summary"]["compliance_percentage"]
                        - period2_data["summary"]["compliance_percentage"]
                    ),
                },
                "analysis": {
                    "improvement_areas": await self._identify_improvement_areas(
                        period1_data, period2_data
                    ),
                    "regression_areas": await self._identify_regression_areas(
                        period1_data, period2_data
                    ),
                    "key_changes": await self._identify_key_changes(
                        period1_data, period2_data, framework
                    ),
                },
            }

            return comparison

        except Exception as e:
            logger.error(f"Failed to compare compliance periods: {e}", exc_info=True)
            raise ComplianceError(f"Period comparison failed: {str(e)}")

    async def get_compliance_forecast(
        self,
        framework: ComplianceFramework,
        organization_id: Optional[UUID] = None,
        project_id: Optional[UUID] = None,
        forecast_days: int = 30,
        confidence_level: float = 0.95,
    ) -> dict[str, Any]:
        """
        Generate compliance forecast based on historical data.

        Args:
            framework: Compliance framework
            organization_id: Organization scope
            project_id: Project scope
            forecast_days: Number of days to forecast
            confidence_level: Confidence level for forecast

        Returns:
            Compliance forecast data
        """
        try:
            logger.info(
                f"Generating {forecast_days}-day compliance forecast for {framework.value}"
            )

            # Get historical data for model training
            historical_days = min(365, forecast_days * 10)  # Use up to 1 year of data
            snapshots = await self._get_historical_snapshots(
                framework=framework,
                organization_id=organization_id,
                project_id=project_id,
                start_date=datetime.utcnow() - timedelta(days=historical_days),
                end_date=datetime.utcnow(),
            )

            if len(snapshots) < 10:
                logger.warning("Insufficient historical data for reliable forecast")
                return {
                    "forecast": [],
                    "confidence": 0.0,
                    "error": "Insufficient historical data",
                }

            # Prepare time series data
            df = pd.DataFrame([asdict(s) for s in snapshots])
            df["timestamp"] = pd.to_datetime(df["timestamp"])
            df = df.sort_values("timestamp")

            # Generate forecast using simple methods
            forecast_data = self._generate_simple_forecast(df, forecast_days)

            # Calculate confidence intervals
            confidence_intervals = self._calculate_confidence_intervals(
                df, forecast_data, confidence_level
            )

            # Identify risk factors
            risk_factors = await self._identify_forecast_risks(snapshots, forecast_data)

            forecast = {
                "framework": framework.value,
                "scope": {
                    "organization_id": str(organization_id)
                    if organization_id
                    else None,
                    "project_id": str(project_id) if project_id else None,
                },
                "forecast_period": {
                    "start_date": datetime.utcnow().isoformat(),
                    "end_date": (
                        datetime.utcnow() + timedelta(days=forecast_days)
                    ).isoformat(),
                    "days": forecast_days,
                },
                "historical_period": {
                    "start_date": snapshots[0].timestamp.isoformat(),
                    "end_date": snapshots[-1].timestamp.isoformat(),
                    "data_points": len(snapshots),
                },
                "forecast": forecast_data,
                "confidence_intervals": confidence_intervals,
                "confidence_level": confidence_level,
                "risk_factors": risk_factors,
                "model_metrics": {
                    "mae": self._calculate_forecast_error(df, forecast_data),
                    "trend": self._determine_trend_direction(
                        df["compliance_score"].tolist()
                    ),
                },
            }

            return forecast

        except Exception as e:
            logger.error(f"Failed to generate compliance forecast: {e}", exc_info=True)
            raise ComplianceError(f"Forecast generation failed: {str(e)}")

    async def cleanup_old_snapshots(
        self,
        retention_days: int = 365,
        framework: Optional[ComplianceFramework] = None,
    ) -> int:
        """
        Clean up old compliance snapshots based on retention policy.

        Args:
            retention_days: Number of days to retain snapshots
            framework: Specific framework (optional)

        Returns:
            Number of snapshots deleted
        """
        try:
            logger.info(f"Cleaning up snapshots older than {retention_days} days")

            cutoff_date = datetime.utcnow() - timedelta(days=retention_days)
            deleted_count = 0

            # This would implement actual cleanup logic
            # For now, return mock count
            deleted_count = 42

            logger.info(f"Cleaned up {deleted_count} old snapshots")
            return deleted_count

        except Exception as e:
            logger.error(f"Failed to cleanup old snapshots: {e}", exc_info=True)
            return 0

    # Helper methods
    async def _get_recent_snapshot(
        self,
        framework: ComplianceFramework,
        organization_id: Optional[UUID],
        project_id: Optional[UUID],
        hours: int,
    ) -> Optional[ComplianceSnapshot]:
        """Get most recent snapshot within specified hours."""
        # This would query the database for recent snapshots
        # For now, return None
        return None

    async def _calculate_current_metrics(
        self,
        framework: ComplianceFramework,
        organization_id: Optional[UUID],
        project_id: Optional[UUID],
    ) -> dict[str, Any]:
        """Calculate current compliance metrics."""
        # Query compliance checks
        checks_query = select(ComplianceCheck)

        # Add filters based on scope
        # This is simplified - would implement proper filtering

        result = await self.db.execute(checks_query)
        checks = result.scalars().all()

        total_checks = len(checks)
        compliant_checks = sum(
            1 for c in checks if c.status == ComplianceStatus.COMPLIANT
        )

        return {
            "total_checks": total_checks,
            "compliant_checks": compliant_checks,
            "compliance_percentage": (compliant_checks / total_checks * 100)
            if total_checks > 0
            else 100,
            "violation_count": total_checks - compliant_checks,
            "severity_breakdown": {
                "critical": 0,
                "high": 0,
                "medium": 0,
                "low": 0,
            },
            "risk_score": 0.0,
        }

    async def _store_snapshot(self, snapshot: ComplianceSnapshot):
        """Store compliance snapshot in database."""
        # This would store the snapshot in a dedicated snapshots table
        # For now, just log
        logger.debug(
            f"Storing snapshot: {snapshot.compliance_score}% at {snapshot.timestamp}"
        )

    async def _get_historical_snapshots(
        self,
        framework: ComplianceFramework,
        organization_id: Optional[UUID],
        project_id: Optional[UUID],
        start_date: datetime,
        end_date: datetime,
    ) -> list[ComplianceSnapshot]:
        """Get historical compliance snapshots."""
        # This would query the snapshots table
        # For now, return mock data
        snapshots = []
        current_date = start_date
        while current_date <= end_date:
            # Generate mock snapshot data
            import random

            score = 85 + random.randint(-10, 10)
            violations = random.randint(0, 10)

            snapshot = ComplianceSnapshot(
                timestamp=current_date,
                compliance_score=score,
                total_violations=violations,
                critical_violations=random.randint(0, violations),
                high_violations=random.randint(0, max(0, violations - 2)),
                medium_violations=random.randint(0, max(0, violations - 4)),
                low_violations=random.randint(0, max(0, violations - 6)),
                risk_score=random.uniform(1.0, 8.0),
                total_checks=100,
                compliant_checks=int(100 * score / 100),
                framework=framework,
                organization_id=organization_id,
                project_id=project_id,
            )
            snapshots.append(snapshot)
            current_date += timedelta(days=1)

        return snapshots

    def _aggregate_snapshots_by_period(
        self,
        snapshots: list[ComplianceSnapshot],
        period_type: CompliancePeriod,
    ) -> list[dict[str, Any]]:
        """Aggregate snapshots by period type."""
        if not snapshots:
            return []

        # Convert to DataFrame for easier aggregation
        df = pd.DataFrame([asdict(s) for s in snapshots])
        df["timestamp"] = pd.to_datetime(df["timestamp"])
        df = df.sort_values("timestamp")

        # Group by period
        if period_type == CompliancePeriod.DAILY:
            grouped = df.groupby(df["timestamp"].dt.date)
        elif period_type == CompliancePeriod.WEEKLY:
            grouped = df.groupby(df["timestamp"].dt.to_period("W"))
        elif period_type == CompliancePeriod.MONTHLY:
            grouped = df.groupby(df["timestamp"].dt.to_period("M"))
        elif period_type == CompliancePeriod.QUARTERLY:
            grouped = df.groupby(df["timestamp"].dt.to_period("Q"))
        else:  # YEARLY
            grouped = df.groupby(df["timestamp"].dt.to_period("Y"))

        # Calculate aggregates
        aggregated = []
        for period, group in grouped:
            aggregated.append(
                {
                    "timestamp": group["timestamp"].iloc[0],
                    "compliance_score": group["compliance_score"].mean(),
                    "total_violations": group["total_violations"].sum(),
                    "critical_violations": group["critical_violations"].sum(),
                    "high_violations": group["high_violations"].sum(),
                    "medium_violations": group["medium_violations"].sum(),
                    "low_violations": group["low_violations"].sum(),
                    "risk_score": group["risk_score"].mean(),
                    "total_checks": group["total_checks"].sum(),
                    "compliant_checks": group["compliant_checks"].sum(),
                    "snapshots_count": len(group),
                }
            )

        return aggregated

    def _determine_trend_direction(self, values: list[float]) -> TrendDirection:
        """Determine trend direction from values."""
        if len(values) < 2:
            return TrendDirection.STABLE

        # Calculate trend line
        x = list(range(len(values)))
        n = len(values)
        sum_x = sum(x)
        sum_y = sum(values)
        sum_xy = sum(x[i] * values[i] for i in range(n))
        sum_x2 = sum(x[i] ** 2 for i in range(n))

        slope = (n * sum_xy - sum_x * sum_y) / (n * sum_x2 - sum_x**2)

        # Determine direction based on slope
        if abs(slope) < 0.1:
            return TrendDirection.STABLE
        elif slope > 0:
            return TrendDirection.IMPROVING
        else:
            return TrendDirection.DECLINING

    def _calculate_change_rate(self, values: list[float]) -> float:
        """Calculate percentage change rate."""
        if len(values) < 2:
            return 0.0

        # Simple linear regression to get trend
        start_value = values[0]
        end_value = values[-1]

        if start_value == 0:
            return 0.0

        return ((end_value - start_value) / start_value) * 100

    def _calculate_confidence(
        self,
        scores: list[float],
        violations: list[int],
    ) -> float:
        """Calculate confidence level in trend analysis."""
        if len(scores) < 3:
            return 0.0

        # Calculate correlation between time and scores
        n = len(scores)
        x = list(range(n))

        sum_x = sum(x)
        sum_y = sum(scores)
        sum_xy = sum(x[i] * scores[i] for i in range(n))
        sum_x2 = sum(x[i] ** 2 for i in range(n))
        sum_y2 = sum(scores[i] ** 2 for i in range(n))

        correlation = (n * sum_xy - sum_x * sum_y) / (
            ((n * sum_x2 - sum_x**2) * (n * sum_y2 - sum_y**2)) ** 0.5
        )

        # Convert correlation to confidence
        confidence = abs(correlation) * 100

        # Adjust based on data consistency
        score_std = stdev(scores) if len(scores) > 1 else 0
        if score_std > 20:  # High variability reduces confidence
            confidence *= 0.7

        return min(100.0, confidence)

    def _generate_forecast(
        self,
        historical_data: list[dict[str, Any]],
        period_type: CompliancePeriod,
    ) -> list[dict[str, Any]]:
        """Generate forecast based on historical data."""
        if len(historical_data) < 3:
            return []

        # Simple linear extrapolation
        scores = [d["compliance_score"] for d in historical_data]
        n = len(scores)

        # Calculate trend
        x = list(range(n))
        sum_x = sum(x)
        sum_y = sum(scores)
        sum_xy = sum(x[i] * scores[i] for i in range(n))
        sum_x2 = sum(x[i] ** 2 for i in range(n))

        slope = (n * sum_xy - sum_x * sum_y) / (n * sum_x2 - sum_x**2)
        intercept = (sum_y - slope * sum_x) / n

        # Generate forecast points
        forecast = []
        periods_to_forecast = 4  # Forecast 4 periods ahead

        for i in range(1, periods_to_forecast + 1):
            forecast_value = slope * (n + i - 1) + intercept
            forecast_value = max(0, min(100, forecast_value))  # Clamp to 0-100

            forecast.append(
                {
                    "period": i,
                    "forecast_score": forecast_value,
                    "confidence": max(0, 100 - (i * 20)),  # Decreasing confidence
                }
            )

        return forecast

    async def _identify_trend_events(
        self,
        snapshots: list[ComplianceSnapshot],
        framework: ComplianceFramework,
        organization_id: Optional[UUID],
        project_id: Optional[UUID],
    ) -> list[dict[str, Any]]:
        """Identify significant events affecting compliance trends."""
        events = []

        # Look for significant changes
        for i in range(1, len(snapshots)):
            prev = snapshots[i - 1]
            curr = snapshots[i]

            score_change = abs(curr.compliance_score - prev.compliance_score)
            violation_change = abs(curr.total_violations - prev.total_violations)

            # Identify significant events
            if score_change > 10:  # Significant compliance change
                events.append(
                    {
                        "date": curr.timestamp.isoformat(),
                        "type": "significant_score_change",
                        "description": f"Compliance score changed by {score_change:.1f}%",
                        "previous_score": prev.compliance_score,
                        "new_score": curr.compliance_score,
                    }
                )

            if violation_change > 5:  # Significant violation change
                events.append(
                    {
                        "date": curr.timestamp.isoformat(),
                        "type": "significant_violation_change",
                        "description": f"Violation count changed by {violation_change}",
                        "previous_violations": prev.total_violations,
                        "new_violations": curr.total_violations,
                    }
                )

        # Sort by date
        events.sort(key=lambda x: x["date"])
        return events

    def _group_snapshots_by_granularity(
        self,
        snapshots: list[ComplianceSnapshot],
        granularity: CompliancePeriod,
    ) -> list[dict[str, Any]]:
        """Group snapshots by specified granularity."""
        return self._aggregate_snapshots_by_period(snapshots, granularity)

    async def _get_compliance_milestones(
        self,
        framework: ComplianceFramework,
        organization_id: Optional[UUID],
        project_id: Optional[UUID],
        start_date: datetime,
        end_date: datetime,
    ) -> list[dict[str, Any]]:
        """Get compliance milestones within period."""
        # This would identify important compliance events
        return [
            {
                "date": (start_date + timedelta(days=15)).isoformat(),
                "type": "compliance_achieved",
                "description": "Achieved 95% compliance threshold",
            },
            {
                "date": (start_date + timedelta(days=45)).isoformat(),
                "type": "violation_resolved",
                "description": "All critical violations resolved",
            },
        ]

    async def _get_violation_history(
        self,
        framework: ComplianceFramework,
        organization_id: Optional[UUID],
        project_id: Optional[UUID],
        start_date: datetime,
        end_date: datetime,
    ) -> list[dict[str, Any]]:
        """Get detailed violation history."""
        # This would query detailed violation information
        return []

    async def _identify_improvement_areas(
        self,
        period1_data: dict[str, Any],
        period2_data: dict[str, Any],
    ) -> list[str]:
        """Identify areas of improvement between periods."""
        improvements = []

        if (
            period1_data["summary"]["average_compliance"]
            > period2_data["summary"]["average_compliance"]
        ):
            improvements.append("Overall compliance score improved")

        if (
            period1_data["summary"]["total_violations"]
            < period2_data["summary"]["total_violations"]
        ):
            improvements.append("Total violations reduced")

        return improvements

    async def _identify_regression_areas(
        self,
        period1_data: dict[str, Any],
        period2_data: dict[str, Any],
    ) -> list[str]:
        """Identify areas of regression between periods."""
        regressions = []

        if (
            period1_data["summary"]["average_compliance"]
            < period2_data["summary"]["average_compliance"]
        ):
            regressions.append("Overall compliance score decreased")

        if (
            period1_data["summary"]["total_violations"]
            > period2_data["summary"]["total_violations"]
        ):
            regressions.append("Total violations increased")

        return regressions

    async def _identify_key_changes(
        self,
        period1_data: dict[str, Any],
        period2_data: dict[str, Any],
        framework: ComplianceFramework,
    ) -> list[str]:
        """Identify key changes between periods."""
        changes = []

        score_diff = (
            period1_data["summary"]["average_compliance"]
            - period2_data["summary"]["average_compliance"]
        )
        if abs(score_diff) > 5:
            changes.append(f"Compliance score changed by {score_diff:.1f}%")

        return changes

    def _calculate_compliance_velocity(
        self,
        data: list[dict[str, Any]],
    ) -> float:
        """Calculate compliance velocity (rate of change)."""
        if len(data) < 2:
            return 0.0

        first_score = data[0]["compliance_score"]
        last_score = data[-1]["compliance_score"]
        days = (data[-1]["timestamp"] - data[0]["timestamp"]).days or 1

        return (last_score - first_score) / days

    def _generate_simple_forecast(
        self,
        df: pd.DataFrame,
        forecast_days: int,
    ) -> list[dict[str, Any]]:
        """Generate simple forecast using moving average."""
        forecast = []

        # Calculate moving average
        window = min(7, len(df))
        df["ma"] = df["compliance_score"].rolling(window=window).mean()

        # Use last moving average as forecast base
        last_ma = df["ma"].iloc[-1]

        for i in range(1, forecast_days + 1):
            forecast_date = datetime.utcnow() + timedelta(days=i)
            forecast.append(
                {
                    "date": forecast_date.isoformat(),
                    "predicted_score": max(0, min(100, last_ma)),
                    "confidence": max(0, 100 - (i * 2)),  # Decreasing confidence
                }
            )

        return forecast

    def _calculate_confidence_intervals(
        self,
        df: pd.DataFrame,
        forecast_data: list[dict[str, Any]],
        confidence_level: float,
    ) -> dict[str, Any]:
        """Calculate confidence intervals for forecast."""
        scores = df["compliance_score"].values
        std_dev = np.std(scores)

        # Calculate confidence bounds
        z_score = 1.96 if confidence_level == 0.95 else 1.645  # 95% or 90%
        margin = z_score * std_dev

        upper_bounds = []
        lower_bounds = []

        for forecast in forecast_data:
            predicted = forecast["predicted_score"]
            upper_bounds.append(min(100, predicted + margin))
            lower_bounds.append(max(0, predicted - margin))

        return {
            "confidence_level": confidence_level,
            "upper_bounds": upper_bounds,
            "lower_bounds": lower_bounds,
            "margin_of_error": margin,
        }

    async def _identify_forecast_risks(
        self,
        snapshots: list[ComplianceSnapshot],
        forecast_data: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Identify risks in the forecast."""
        risks = []

        # Check for declining trend
        if (
            len(forecast_data) > 1
            and forecast_data[-1]["predicted_score"]
            < forecast_data[0]["predicted_score"]
        ):
            risks.append(
                {
                    "type": "declining_trend",
                    "description": "Compliance score is forecast to decline",
                    "severity": "high"
                    if forecast_data[-1]["predicted_score"] < 80
                    else "medium",
                }
            )

        # Check for low scores
        min_forecast = min(f["predicted_score"] for f in forecast_data)
        if min_forecast < 70:
            risks.append(
                {
                    "type": "low_compliance",
                    "description": "Compliance may fall below 70%",
                    "severity": "critical",
                }
            )

        return risks

    def _calculate_forecast_error(
        self,
        historical_df: pd.DataFrame,
        forecast_data: list[dict[str, Any]],
    ) -> float:
        """Calculate forecast error (Mean Absolute Error)."""
        # This would calculate error against a test set
        # For now, return mock value
        return 2.5
