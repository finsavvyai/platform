"""
Universal Dependency Platform - Analytics Engine

Enterprise-grade analytics engine for dependency insights,
security metrics, compliance reporting, and predictive analytics.
"""

import asyncio
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Optional
from uuid import UUID

import structlog
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from udp.domain.models import EcosystemType, SecurityLevel, WorkflowStatus
from udp.infrastructure.models import (
    DependencyGraphModel,
    LicenseModel,
    PackageModel,
    PackageVulnerabilityModel,
    VulnerabilityModel,
    WorkflowModel,
)

logger = structlog.get_logger()


class MetricType(Enum):
    """Analytics metric types."""
    COUNT = "count"
    PERCENTAGE = "percentage"
    RATIO = "ratio"
    TREND = "trend"
    DISTRIBUTION = "distribution"
    SCORE = "score"


class TimeInterval(Enum):
    """Time interval for analytics."""
    HOUR = "1h"
    DAY = "1d"
    WEEK = "1w"
    MONTH = "1M"
    QUARTER = "3M"
    YEAR = "1Y"


@dataclass
class AnalyticsMetric:
    """Analytics metric data structure."""
    name: str
    value: float
    metric_type: MetricType
    timestamp: datetime
    metadata: dict[str, Any]
    trend_direction: Optional[str] = None  # up, down, stable
    trend_percentage: Optional[float] = None


@dataclass
class DashboardWidget:
    """Dashboard widget configuration."""
    widget_id: str
    title: str
    widget_type: str  # chart, metric, table, gauge
    data_source: str
    config: dict[str, Any]
    refresh_interval: int = 300  # seconds
    position: dict[str, int] = None  # x, y, width, height


class AnalyticsEngine:
    """
    Enterprise analytics engine for comprehensive dependency insights.

    Provides real-time metrics, historical analysis, predictive insights,
    and compliance reporting capabilities.
    """

    def __init__(self):
        self.metric_cache = {}
        self.cache_ttl = 300  # 5 minutes

    async def get_security_metrics(
        self,
        db: AsyncSession,
        organization_id: Optional[UUID] = None,
        time_range: TimeInterval = TimeInterval.MONTH
    ) -> dict[str, AnalyticsMetric]:
        """
        Get comprehensive security metrics.

        Args:
            db: Database session
            organization_id: Optional organization filter
            time_range: Time range for analysis

        Returns:
            Dictionary of security metrics
        """
        try:
            cache_key = f"security_metrics_{organization_id}_{time_range.value}"
            cached_result = self._get_cached_metric(cache_key)
            if cached_result:
                return cached_result

            # Calculate time boundaries
            end_time = datetime.utcnow()
            start_time = self._calculate_start_time(end_time, time_range)

            metrics = {}

            # Total vulnerabilities by severity
            vuln_query = select(
                VulnerabilityModel.severity,
                func.count(VulnerabilityModel.id).label('count')
            ).where(
                VulnerabilityModel.published_at >= start_time
            ).group_by(VulnerabilityModel.severity)

            if organization_id:
                # Filter by organization's packages
                vuln_query = vuln_query.join(PackageVulnerabilityModel).join(
                    DependencyGraphModel,
                    PackageVulnerabilityModel.package_id == DependencyGraphModel.root_package_id
                ).where(DependencyGraphModel.organization_id == organization_id)

            vuln_result = await db.execute(vuln_query)
            vulnerability_counts = {row.severity: row.count for row in vuln_result}

            # Critical vulnerabilities metric
            critical_count = vulnerability_counts.get(SecurityLevel.CRITICAL, 0)
            metrics["critical_vulnerabilities"] = AnalyticsMetric(
                name="Critical Vulnerabilities",
                value=float(critical_count),
                metric_type=MetricType.COUNT,
                timestamp=end_time,
                metadata={
                    "time_range": time_range.value,
                    "severity_distribution": {
                        level.value: vulnerability_counts.get(level, 0)
                        for level in SecurityLevel
                    }
                }
            )

            # High severity vulnerabilities
            high_count = vulnerability_counts.get(SecurityLevel.HIGH, 0)
            metrics["high_vulnerabilities"] = AnalyticsMetric(
                name="High Severity Vulnerabilities",
                value=float(high_count),
                metric_type=MetricType.COUNT,
                timestamp=end_time,
                metadata={"time_range": time_range.value}
            )

            # Average CVSS score
            cvss_query = select(func.avg(VulnerabilityModel.cvss_score)).where(
                and_(
                    VulnerabilityModel.cvss_score.isnot(None),
                    VulnerabilityModel.published_at >= start_time
                )
            )

            if organization_id:
                cvss_query = cvss_query.join(PackageVulnerabilityModel).join(
                    DependencyGraphModel,
                    PackageVulnerabilityModel.package_id == DependencyGraphModel.root_package_id
                ).where(DependencyGraphModel.organization_id == organization_id)

            avg_cvss_result = await db.execute(cvss_query)
            avg_cvss = avg_cvss_result.scalar() or 0.0

            metrics["average_cvss_score"] = AnalyticsMetric(
                name="Average CVSS Score",
                value=round(avg_cvss, 2),
                metric_type=MetricType.SCORE,
                timestamp=end_time,
                metadata={
                    "time_range": time_range.value,
                    "max_score": 10.0
                }
            )

            # Packages with exploitable vulnerabilities
            exploit_query = select(
                func.count(func.distinct(PackageVulnerabilityModel.package_id))
            ).join(VulnerabilityModel).where(
                and_(
                    VulnerabilityModel.exploit_available == True,
                    VulnerabilityModel.published_at >= start_time
                )
            )

            if organization_id:
                exploit_query = exploit_query.join(
                    DependencyGraphModel,
                    PackageVulnerabilityModel.package_id == DependencyGraphModel.root_package_id
                ).where(DependencyGraphModel.organization_id == organization_id)

            exploit_result = await db.execute(exploit_query)
            exploitable_packages = exploit_result.scalar() or 0

            metrics["exploitable_packages"] = AnalyticsMetric(
                name="Packages with Exploitable Vulnerabilities",
                value=float(exploitable_packages),
                metric_type=MetricType.COUNT,
                timestamp=end_time,
                metadata={"time_range": time_range.value}
            )

            # Cache results
            self._cache_metric(cache_key, metrics)
            return metrics

        except Exception as e:
            logger.error("Failed to calculate security metrics", error=str(e))
            raise

    async def get_license_compliance_metrics(
        self,
        db: AsyncSession,
        organization_id: Optional[UUID] = None,
        time_range: TimeInterval = TimeInterval.MONTH
    ) -> dict[str, AnalyticsMetric]:
        """
        Get license compliance and distribution metrics.

        Args:
            db: Database session
            organization_id: Optional organization filter
            time_range: Time range for analysis

        Returns:
            Dictionary of license compliance metrics
        """
        try:
            cache_key = f"license_metrics_{organization_id}_{time_range.value}"
            cached_result = self._get_cached_metric(cache_key)
            if cached_result:
                return cached_result

            end_time = datetime.utcnow()
            start_time = self._calculate_start_time(end_time, time_range)

            metrics = {}

            # License distribution query
            license_query = select(
                PackageModel.license,
                func.count(PackageModel.id).label('count')
            ).where(
                PackageModel.created_at >= start_time
            ).group_by(PackageModel.license)

            if organization_id:
                license_query = license_query.join(
                    DependencyGraphModel,
                    PackageModel.id == DependencyGraphModel.root_package_id
                ).where(DependencyGraphModel.organization_id == organization_id)

            license_result = await db.execute(license_query)
            license_distribution = {row.license: row.count for row in license_result}

            total_packages = sum(license_distribution.values())

            # License distribution metric
            metrics["license_distribution"] = AnalyticsMetric(
                name="License Distribution",
                value=float(total_packages),
                metric_type=MetricType.DISTRIBUTION,
                timestamp=end_time,
                metadata={
                    "distribution": {
                        license.value: count for license, count in license_distribution.items()
                    },
                    "percentages": {
                        license.value: round((count / total_packages) * 100, 2)
                        if total_packages > 0 else 0
                        for license, count in license_distribution.items()
                    }
                }
            )

            # Copyleft license percentage
            copyleft_query = select(
                func.count(PackageModel.id)
            ).join(LicenseModel, PackageModel.license == LicenseModel.license_type).where(
                and_(
                    LicenseModel.is_copyleft == True,
                    PackageModel.created_at >= start_time
                )
            )

            if organization_id:
                copyleft_query = copyleft_query.join(
                    DependencyGraphModel,
                    PackageModel.id == DependencyGraphModel.root_package_id
                ).where(DependencyGraphModel.organization_id == organization_id)

            copyleft_result = await db.execute(copyleft_query)
            copyleft_count = copyleft_result.scalar() or 0

            copyleft_percentage = (copyleft_count / total_packages) * 100 if total_packages > 0 else 0

            metrics["copyleft_percentage"] = AnalyticsMetric(
                name="Copyleft License Percentage",
                value=round(copyleft_percentage, 2),
                metric_type=MetricType.PERCENTAGE,
                timestamp=end_time,
                metadata={
                    "copyleft_count": copyleft_count,
                    "total_count": total_packages
                }
            )

            # Enterprise-friendly licenses
            enterprise_query = select(
                func.count(PackageModel.id)
            ).join(LicenseModel, PackageModel.license == LicenseModel.license_type).where(
                and_(
                    LicenseModel.allows_commercial_use == True,
                    LicenseModel.requires_source_disclosure == False,
                    LicenseModel.is_copyleft == False,
                    PackageModel.created_at >= start_time
                )
            )

            if organization_id:
                enterprise_query = enterprise_query.join(
                    DependencyGraphModel,
                    PackageModel.id == DependencyGraphModel.root_package_id
                ).where(DependencyGraphModel.organization_id == organization_id)

            enterprise_result = await db.execute(enterprise_query)
            enterprise_count = enterprise_result.scalar() or 0

            enterprise_percentage = (enterprise_count / total_packages) * 100 if total_packages > 0 else 0

            metrics["enterprise_friendly_percentage"] = AnalyticsMetric(
                name="Enterprise-Friendly License Percentage",
                value=round(enterprise_percentage, 2),
                metric_type=MetricType.PERCENTAGE,
                timestamp=end_time,
                metadata={
                    "enterprise_count": enterprise_count,
                    "total_count": total_packages
                }
            )

            self._cache_metric(cache_key, metrics)
            return metrics

        except Exception as e:
            logger.error("Failed to calculate license compliance metrics", error=str(e))
            raise

    async def get_workflow_performance_metrics(
        self,
        db: AsyncSession,
        organization_id: Optional[UUID] = None,
        time_range: TimeInterval = TimeInterval.MONTH
    ) -> dict[str, AnalyticsMetric]:
        """
        Get workflow performance and efficiency metrics.

        Args:
            db: Database session
            organization_id: Optional organization filter
            time_range: Time range for analysis

        Returns:
            Dictionary of workflow performance metrics
        """
        try:
            cache_key = f"workflow_metrics_{organization_id}_{time_range.value}"
            cached_result = self._get_cached_metric(cache_key)
            if cached_result:
                return cached_result

            end_time = datetime.utcnow()
            start_time = self._calculate_start_time(end_time, time_range)

            metrics = {}

            # Base workflow query
            base_query = select(WorkflowModel).where(
                WorkflowModel.created_at >= start_time
            )

            if organization_id:
                base_query = base_query.where(WorkflowModel.organization_id == organization_id)

            # Workflow completion rate
            total_query = select(func.count(WorkflowModel.id)).where(
                WorkflowModel.created_at >= start_time
            )
            completed_query = select(func.count(WorkflowModel.id)).where(
                and_(
                    WorkflowModel.created_at >= start_time,
                    WorkflowModel.status == WorkflowStatus.COMPLETED
                )
            )

            if organization_id:
                total_query = total_query.where(WorkflowModel.organization_id == organization_id)
                completed_query = completed_query.where(WorkflowModel.organization_id == organization_id)

            total_workflows = (await db.execute(total_query)).scalar() or 0
            completed_workflows = (await db.execute(completed_query)).scalar() or 0

            completion_rate = (completed_workflows / total_workflows) * 100 if total_workflows > 0 else 0

            metrics["workflow_completion_rate"] = AnalyticsMetric(
                name="Workflow Completion Rate",
                value=round(completion_rate, 2),
                metric_type=MetricType.PERCENTAGE,
                timestamp=end_time,
                metadata={
                    "total_workflows": total_workflows,
                    "completed_workflows": completed_workflows
                }
            )

            # Average processing time
            duration_query = select(
                func.avg(
                    func.extract('epoch', WorkflowModel.completed_at - WorkflowModel.started_at)
                ).label('avg_duration')
            ).where(
                and_(
                    WorkflowModel.created_at >= start_time,
                    WorkflowModel.status == WorkflowStatus.COMPLETED,
                    WorkflowModel.started_at.isnot(None),
                    WorkflowModel.completed_at.isnot(None)
                )
            )

            if organization_id:
                duration_query = duration_query.where(WorkflowModel.organization_id == organization_id)

            avg_duration_result = await db.execute(duration_query)
            avg_duration_seconds = avg_duration_result.scalar() or 0.0
            avg_duration_minutes = avg_duration_seconds / 60

            metrics["average_processing_time"] = AnalyticsMetric(
                name="Average Processing Time (minutes)",
                value=round(avg_duration_minutes, 2),
                metric_type=MetricType.RATIO,
                timestamp=end_time,
                metadata={
                    "seconds": avg_duration_seconds,
                    "time_range": time_range.value
                }
            )

            # Workflows requiring approval
            approval_query = select(func.count(WorkflowModel.id)).where(
                and_(
                    WorkflowModel.created_at >= start_time,
                    WorkflowModel.status == WorkflowStatus.WAITING_FOR_APPROVAL
                )
            )

            if organization_id:
                approval_query = approval_query.where(WorkflowModel.organization_id == organization_id)

            pending_approvals = (await db.execute(approval_query)).scalar() or 0

            metrics["pending_approvals"] = AnalyticsMetric(
                name="Workflows Pending Approval",
                value=float(pending_approvals),
                metric_type=MetricType.COUNT,
                timestamp=end_time,
                metadata={"time_range": time_range.value}
            )

            self._cache_metric(cache_key, metrics)
            return metrics

        except Exception as e:
            logger.error("Failed to calculate workflow performance metrics", error=str(e))
            raise

    async def get_ecosystem_insights(
        self,
        db: AsyncSession,
        organization_id: Optional[UUID] = None,
        time_range: TimeInterval = TimeInterval.MONTH
    ) -> dict[str, AnalyticsMetric]:
        """
        Get ecosystem distribution and adoption insights.

        Args:
            db: Database session
            organization_id: Optional organization filter
            time_range: Time range for analysis

        Returns:
            Dictionary of ecosystem insights
        """
        try:
            cache_key = f"ecosystem_metrics_{organization_id}_{time_range.value}"
            cached_result = self._get_cached_metric(cache_key)
            if cached_result:
                return cached_result

            end_time = datetime.utcnow()
            start_time = self._calculate_start_time(end_time, time_range)

            metrics = {}

            # Ecosystem distribution
            ecosystem_query = select(
                PackageModel.ecosystem,
                func.count(PackageModel.id).label('count')
            ).where(
                PackageModel.created_at >= start_time
            ).group_by(PackageModel.ecosystem)

            if organization_id:
                ecosystem_query = ecosystem_query.join(
                    DependencyGraphModel,
                    PackageModel.id == DependencyGraphModel.root_package_id
                ).where(DependencyGraphModel.organization_id == organization_id)

            ecosystem_result = await db.execute(ecosystem_query)
            ecosystem_distribution = {row.ecosystem: row.count for row in ecosystem_result}

            total_packages = sum(ecosystem_distribution.values())

            metrics["ecosystem_distribution"] = AnalyticsMetric(
                name="Ecosystem Distribution",
                value=float(total_packages),
                metric_type=MetricType.DISTRIBUTION,
                timestamp=end_time,
                metadata={
                    "distribution": {
                        eco.value: ecosystem_distribution.get(eco, 0)
                        for eco in EcosystemType
                    },
                    "percentages": {
                        eco.value: round(
                            (ecosystem_distribution.get(eco, 0) / total_packages) * 100, 2
                        ) if total_packages > 0 else 0
                        for eco in EcosystemType
                    }
                }
            )

            # Most popular ecosystem
            if ecosystem_distribution:
                most_popular_eco = max(ecosystem_distribution, key=ecosystem_distribution.get)
                most_popular_count = ecosystem_distribution[most_popular_eco]
                most_popular_percentage = (most_popular_count / total_packages) * 100

                metrics["dominant_ecosystem"] = AnalyticsMetric(
                    name="Dominant Ecosystem",
                    value=round(most_popular_percentage, 2),
                    metric_type=MetricType.PERCENTAGE,
                    timestamp=end_time,
                    metadata={
                        "ecosystem": most_popular_eco.value,
                        "package_count": most_popular_count
                    }
                )

            self._cache_metric(cache_key, metrics)
            return metrics

        except Exception as e:
            logger.error("Failed to calculate ecosystem insights", error=str(e))
            raise

    async def generate_executive_dashboard(
        self,
        db: AsyncSession,
        organization_id: UUID,
        time_range: TimeInterval = TimeInterval.MONTH
    ) -> dict[str, Any]:
        """
        Generate comprehensive executive dashboard with key metrics.

        Args:
            db: Database session
            organization_id: Organization ID
            time_range: Time range for analysis

        Returns:
            Executive dashboard data
        """
        try:
            # Gather all metrics concurrently
            security_task = self.get_security_metrics(db, organization_id, time_range)
            license_task = self.get_license_compliance_metrics(db, organization_id, time_range)
            workflow_task = self.get_workflow_performance_metrics(db, organization_id, time_range)
            ecosystem_task = self.get_ecosystem_insights(db, organization_id, time_range)

            security_metrics, license_metrics, workflow_metrics, ecosystem_metrics = await asyncio.gather(
                security_task, license_task, workflow_task, ecosystem_task
            )

            # Calculate overall risk score
            risk_score = await self._calculate_risk_score(db, organization_id)

            # Generate recommendations
            recommendations = await self._generate_recommendations(
                security_metrics, license_metrics, workflow_metrics
            )

            dashboard = {
                "organization_id": str(organization_id),
                "generated_at": datetime.utcnow().isoformat(),
                "time_range": time_range.value,
                "overall_risk_score": risk_score,
                "security_summary": {
                    "critical_vulnerabilities": security_metrics["critical_vulnerabilities"].value,
                    "average_cvss_score": security_metrics["average_cvss_score"].value,
                    "exploitable_packages": security_metrics["exploitable_packages"].value
                },
                "compliance_summary": {
                    "copyleft_percentage": license_metrics["copyleft_percentage"].value,
                    "enterprise_friendly_percentage": license_metrics["enterprise_friendly_percentage"].value
                },
                "operational_summary": {
                    "workflow_completion_rate": workflow_metrics["workflow_completion_rate"].value,
                    "average_processing_time": workflow_metrics["average_processing_time"].value,
                    "pending_approvals": workflow_metrics["pending_approvals"].value
                },
                "ecosystem_summary": ecosystem_metrics["ecosystem_distribution"].metadata,
                "recommendations": recommendations,
                "widgets": self._generate_dashboard_widgets()
            }

            logger.info(
                "Executive dashboard generated",
                organization_id=str(organization_id),
                risk_score=risk_score,
                recommendations_count=len(recommendations)
            )

            return dashboard

        except Exception as e:
            logger.error("Failed to generate executive dashboard", error=str(e))
            raise

    def _calculate_start_time(self, end_time: datetime, interval: TimeInterval) -> datetime:
        """Calculate start time based on interval."""
        if interval == TimeInterval.HOUR:
            return end_time - timedelta(hours=1)
        elif interval == TimeInterval.DAY:
            return end_time - timedelta(days=1)
        elif interval == TimeInterval.WEEK:
            return end_time - timedelta(weeks=1)
        elif interval == TimeInterval.MONTH:
            return end_time - timedelta(days=30)
        elif interval == TimeInterval.QUARTER:
            return end_time - timedelta(days=90)
        elif interval == TimeInterval.YEAR:
            return end_time - timedelta(days=365)
        else:
            return end_time - timedelta(days=30)

    def _get_cached_metric(self, cache_key: str) -> Optional[dict[str, AnalyticsMetric]]:
        """Get metric from cache if valid."""
        if cache_key in self.metric_cache:
            cached_data, timestamp = self.metric_cache[cache_key]
            if datetime.utcnow() - timestamp < timedelta(seconds=self.cache_ttl):
                return cached_data
        return None

    def _cache_metric(self, cache_key: str, metrics: dict[str, AnalyticsMetric]):
        """Cache metric data."""
        self.metric_cache[cache_key] = (metrics, datetime.utcnow())

    async def _calculate_risk_score(self, db: AsyncSession, organization_id: UUID) -> float:
        """Calculate overall organizational risk score."""
        # This is a simplified risk calculation
        # In production, this would use a more sophisticated algorithm

        # Get recent dependency graphs
        graphs_query = select(DependencyGraphModel.risk_score).where(
            and_(
                DependencyGraphModel.organization_id == organization_id,
                DependencyGraphModel.created_at >= datetime.utcnow() - timedelta(days=30)
            )
        )

        graphs_result = await db.execute(graphs_query)
        risk_scores = [row[0] for row in graphs_result if row[0] is not None]

        if not risk_scores:
            return 0.0

        # Calculate weighted average (more recent graphs have higher weight)
        return round(sum(risk_scores) / len(risk_scores), 2)

    async def _generate_recommendations(
        self,
        security_metrics: dict[str, AnalyticsMetric],
        license_metrics: dict[str, AnalyticsMetric],
        workflow_metrics: dict[str, AnalyticsMetric]
    ) -> list[dict[str, Any]]:
        """Generate actionable recommendations based on metrics."""
        recommendations = []

        # Security recommendations
        critical_vulns = security_metrics["critical_vulnerabilities"].value
        if critical_vulns > 0:
            recommendations.append({
                "type": "security",
                "priority": "high",
                "title": "Address Critical Vulnerabilities",
                "description": f"You have {int(critical_vulns)} critical vulnerabilities that need immediate attention.",
                "action": "Review and patch critical vulnerabilities in your dependency graph."
            })

        # License compliance recommendations
        copyleft_percentage = license_metrics["copyleft_percentage"].value
        if copyleft_percentage > 20:
            recommendations.append({
                "type": "compliance",
                "priority": "medium",
                "title": "Review Copyleft License Usage",
                "description": f"{copyleft_percentage}% of your packages use copyleft licenses.",
                "action": "Review copyleft license implications for your commercial products."
            })

        # Workflow efficiency recommendations
        completion_rate = workflow_metrics["workflow_completion_rate"].value
        if completion_rate < 80:
            recommendations.append({
                "type": "operational",
                "priority": "medium",
                "title": "Improve Workflow Completion Rate",
                "description": f"Current completion rate is {completion_rate}%, below the recommended 80%.",
                "action": "Analyze failed workflows and optimize approval processes."
            })

        return recommendations

    def _generate_dashboard_widgets(self) -> list[DashboardWidget]:
        """Generate standard dashboard widget configurations."""
        return [
            DashboardWidget(
                widget_id="security_overview",
                title="Security Overview",
                widget_type="chart",
                data_source="security_metrics",
                config={"chart_type": "donut", "field": "severity_distribution"},
                position={"x": 0, "y": 0, "width": 6, "height": 4}
            ),
            DashboardWidget(
                widget_id="risk_score",
                title="Overall Risk Score",
                widget_type="gauge",
                data_source="risk_calculation",
                config={"min": 0, "max": 10, "thresholds": [3, 7]},
                position={"x": 6, "y": 0, "width": 6, "height": 4}
            ),
            DashboardWidget(
                widget_id="license_compliance",
                title="License Compliance",
                widget_type="chart",
                data_source="license_metrics",
                config={"chart_type": "bar", "field": "license_distribution"},
                position={"x": 0, "y": 4, "width": 8, "height": 4}
            ),
            DashboardWidget(
                widget_id="workflow_performance",
                title="Workflow Performance",
                widget_type="metric",
                data_source="workflow_metrics",
                config={"primary_metric": "completion_rate"},
                position={"x": 8, "y": 4, "width": 4, "height": 4}
            )
        ]


# Global analytics engine instance
analytics_engine = AnalyticsEngine()
