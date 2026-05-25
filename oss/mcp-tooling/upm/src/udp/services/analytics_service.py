"""
Workflow Analytics & Reporting Service for Universal Dependency Platform.

Provides comprehensive analytics for workflow performance, security metrics,
dependency health, and dashboard-ready reporting data.
"""

import logging
import statistics
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class TimeRange(str, Enum):
    """Predefined time ranges for analytics queries."""

    LAST_HOUR = "1h"
    LAST_DAY = "24h"
    LAST_WEEK = "7d"
    LAST_MONTH = "30d"
    LAST_QUARTER = "90d"


@dataclass
class MetricDataPoint:
    """A single data point in a time series."""

    timestamp: datetime
    value: float
    labels: dict[str, str] = field(default_factory=dict)


@dataclass
class TrendAnalysis:
    """Trend analysis result."""

    direction: str  # "increasing", "decreasing", "stable"
    slope: float
    change_percent: float
    data_points: int
    start_value: float
    end_value: float
    min_value: float
    max_value: float
    avg_value: float


@dataclass
class WorkflowPerformanceReport:
    """Workflow performance analytics report."""

    time_range: str
    total_executions: int = 0
    completed: int = 0
    failed: int = 0
    success_rate: float = 0.0
    avg_duration_ms: float = 0.0
    p50_duration_ms: float = 0.0
    p95_duration_ms: float = 0.0
    p99_duration_ms: float = 0.0
    throughput_per_hour: float = 0.0
    bottleneck_steps: list[dict[str, Any]] = field(default_factory=list)
    duration_trend: TrendAnalysis | None = None
    by_workflow_type: dict[str, dict[str, Any]] = field(default_factory=dict)


@dataclass
class SecurityMetricsReport:
    """Security analytics report."""

    time_range: str
    total_vulnerabilities: int = 0
    new_vulnerabilities: int = 0
    resolved_vulnerabilities: int = 0
    by_severity: dict[str, int] = field(default_factory=dict)
    by_ecosystem: dict[str, int] = field(default_factory=dict)
    mean_time_to_remediation_hours: float = 0.0
    vulnerability_trend: TrendAnalysis | None = None
    top_affected_packages: list[dict[str, Any]] = field(default_factory=list)
    policy_violations: int = 0
    compliance_score: float = 0.0


@dataclass
class DependencyHealthReport:
    """Dependency health analytics report."""

    time_range: str
    total_dependencies: int = 0
    direct_dependencies: int = 0
    transitive_dependencies: int = 0
    outdated_dependencies: int = 0
    vulnerable_dependencies: int = 0
    deprecated_dependencies: int = 0
    health_score: float = 100.0  # 0-100
    by_ecosystem: dict[str, dict[str, Any]] = field(default_factory=dict)
    update_urgency: dict[str, int] = field(default_factory=dict)
    license_distribution: dict[str, int] = field(default_factory=dict)


@dataclass
class DashboardData:
    """Aggregated dashboard data for UI rendering."""

    generated_at: str
    workflow_summary: dict[str, Any] = field(default_factory=dict)
    security_summary: dict[str, Any] = field(default_factory=dict)
    dependency_summary: dict[str, Any] = field(default_factory=dict)
    recent_activity: list[dict[str, Any]] = field(default_factory=list)
    alerts: list[dict[str, Any]] = field(default_factory=list)
    trends: dict[str, Any] = field(default_factory=dict)


class AnalyticsService:
    """
    Analytics service for workflow performance, security metrics,
    and dependency health reporting.

    Can operate with or without a database session - when no session
    is provided, uses in-memory metrics only.
    """

    def __init__(self, db_session: AsyncSession | None = None):
        self.db_session = db_session
        # In-memory metrics storage for lightweight analytics
        self._workflow_events: list[dict[str, Any]] = []
        self._security_events: list[dict[str, Any]] = []
        self._dependency_snapshots: list[dict[str, Any]] = []
        self._max_events = 10000

    # ── Event Recording ──────────────────────────────────────────

    def record_workflow_event(
        self,
        workflow_id: str,
        workflow_type: str,
        event_type: str,
        duration_ms: float | None = None,
        step_name: str | None = None,
        status: str = "completed",
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """Record a workflow event for analytics."""
        event = {
            "workflow_id": workflow_id,
            "workflow_type": workflow_type,
            "event_type": event_type,
            "duration_ms": duration_ms,
            "step_name": step_name,
            "status": status,
            "timestamp": datetime.utcnow(),
            "metadata": metadata or {},
        }
        self._workflow_events.append(event)
        self._trim_events(self._workflow_events)

    def record_security_event(
        self,
        event_type: str,
        severity: str,
        package_name: str | None = None,
        ecosystem: str | None = None,
        vulnerability_id: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """Record a security event for analytics."""
        event = {
            "event_type": event_type,
            "severity": severity,
            "package_name": package_name,
            "ecosystem": ecosystem,
            "vulnerability_id": vulnerability_id,
            "timestamp": datetime.utcnow(),
            "metadata": metadata or {},
        }
        self._security_events.append(event)
        self._trim_events(self._security_events)

    def record_dependency_snapshot(
        self,
        project_id: str,
        total: int,
        direct: int,
        transitive: int,
        outdated: int,
        vulnerable: int,
        ecosystem_breakdown: dict[str, int] | None = None,
    ) -> None:
        """Record a dependency health snapshot."""
        snapshot = {
            "project_id": project_id,
            "total": total,
            "direct": direct,
            "transitive": transitive,
            "outdated": outdated,
            "vulnerable": vulnerable,
            "ecosystem_breakdown": ecosystem_breakdown or {},
            "timestamp": datetime.utcnow(),
        }
        self._dependency_snapshots.append(snapshot)
        self._trim_events(self._dependency_snapshots)

    # ── Workflow Analytics ────────────────────────────────────────

    def get_workflow_performance(
        self, time_range: TimeRange = TimeRange.LAST_DAY
    ) -> WorkflowPerformanceReport:
        """Get workflow performance analytics."""
        cutoff = self._get_cutoff(time_range)
        events = [e for e in self._workflow_events if e["timestamp"] >= cutoff]

        report = WorkflowPerformanceReport(time_range=time_range.value)

        if not events:
            return report

        # Filter to workflow-level events (not step-level)
        wf_events = [
            e
            for e in events
            if e["event_type"] == "workflow_completed"
            or e["event_type"] == "workflow_failed"
        ]
        step_events = [e for e in events if e["event_type"] == "step_completed"]

        report.total_executions = len(wf_events)
        report.completed = sum(1 for e in wf_events if e["status"] == "completed")
        report.failed = sum(1 for e in wf_events if e["status"] == "failed")

        if report.total_executions > 0:
            report.success_rate = report.completed / report.total_executions * 100

        # Duration statistics
        durations = [
            e["duration_ms"] for e in wf_events if e.get("duration_ms") is not None
        ]
        if durations:
            report.avg_duration_ms = statistics.mean(durations)
            report.p50_duration_ms = statistics.median(durations)
            sorted_d = sorted(durations)
            report.p95_duration_ms = self._percentile(sorted_d, 95)
            report.p99_duration_ms = self._percentile(sorted_d, 99)

        # Throughput
        hours = max(1, (datetime.utcnow() - cutoff).total_seconds() / 3600)
        report.throughput_per_hour = report.total_executions / hours

        # Bottleneck identification (slowest steps)
        step_durations: dict[str, list[float]] = defaultdict(list)
        for e in step_events:
            if e.get("step_name") and e.get("duration_ms") is not None:
                step_durations[e["step_name"]].append(e["duration_ms"])

        bottlenecks = []
        for step_name, durs in step_durations.items():
            bottlenecks.append(
                {
                    "step_name": step_name,
                    "avg_duration_ms": statistics.mean(durs),
                    "max_duration_ms": max(durs),
                    "execution_count": len(durs),
                }
            )
        bottlenecks.sort(key=lambda x: x["avg_duration_ms"], reverse=True)
        report.bottleneck_steps = bottlenecks[:10]

        # Duration trend
        if len(durations) >= 3:
            report.duration_trend = self._analyze_trend(durations)

        # By workflow type
        by_type: dict[str, list[dict]] = defaultdict(list)
        for e in wf_events:
            by_type[e["workflow_type"]].append(e)

        for wf_type, type_events in by_type.items():
            type_durations = [
                e["duration_ms"]
                for e in type_events
                if e.get("duration_ms") is not None
            ]
            report.by_workflow_type[wf_type] = {
                "total": len(type_events),
                "completed": sum(1 for e in type_events if e["status"] == "completed"),
                "failed": sum(1 for e in type_events if e["status"] == "failed"),
                "avg_duration_ms": statistics.mean(type_durations)
                if type_durations
                else 0,
            }

        return report

    # ── Security Analytics ────────────────────────────────────────

    def get_security_metrics(
        self, time_range: TimeRange = TimeRange.LAST_DAY
    ) -> SecurityMetricsReport:
        """Get security metrics analytics."""
        cutoff = self._get_cutoff(time_range)
        events = [e for e in self._security_events if e["timestamp"] >= cutoff]

        report = SecurityMetricsReport(time_range=time_range.value)

        if not events:
            return report

        # Count by type
        new_vulns = [e for e in events if e["event_type"] == "vulnerability_discovered"]
        resolved_vulns = [
            e for e in events if e["event_type"] == "vulnerability_resolved"
        ]
        policy_violations = [e for e in events if e["event_type"] == "policy_violation"]

        report.new_vulnerabilities = len(new_vulns)
        report.resolved_vulnerabilities = len(resolved_vulns)
        report.total_vulnerabilities = report.new_vulnerabilities
        report.policy_violations = len(policy_violations)

        # By severity
        severity_counts: dict[str, int] = defaultdict(int)
        for e in new_vulns:
            severity_counts[e.get("severity", "unknown")] += 1
        report.by_severity = dict(severity_counts)

        # By ecosystem
        ecosystem_counts: dict[str, int] = defaultdict(int)
        for e in new_vulns:
            eco = e.get("ecosystem", "unknown")
            ecosystem_counts[eco] += 1
        report.by_ecosystem = dict(ecosystem_counts)

        # MTTR (mean time to remediation)
        if resolved_vulns:
            remediation_times = []
            for rv in resolved_vulns:
                rt = rv.get("metadata", {}).get("remediation_time_hours")
                if rt is not None:
                    remediation_times.append(rt)
            if remediation_times:
                report.mean_time_to_remediation_hours = statistics.mean(
                    remediation_times
                )

        # Top affected packages
        package_vuln_counts: dict[str, int] = defaultdict(int)
        for e in new_vulns:
            if e.get("package_name"):
                package_vuln_counts[e["package_name"]] += 1
        top_packages = sorted(
            package_vuln_counts.items(), key=lambda x: x[1], reverse=True
        )[:10]
        report.top_affected_packages = [
            {"package": pkg, "vulnerability_count": count}
            for pkg, count in top_packages
        ]

        # Vulnerability trend
        daily_counts = self._group_by_day([e["timestamp"] for e in new_vulns])
        if len(daily_counts) >= 3:
            report.vulnerability_trend = self._analyze_trend(daily_counts)

        return report

    # ── Dependency Health Analytics ──────────────────────────────

    def get_dependency_health(
        self, project_id: str | None = None
    ) -> DependencyHealthReport:
        """Get dependency health analytics from the latest snapshot."""
        report = DependencyHealthReport(time_range="latest")

        if not self._dependency_snapshots:
            return report

        # Get latest snapshot (optionally filtered by project)
        snapshots = self._dependency_snapshots
        if project_id:
            snapshots = [s for s in snapshots if s["project_id"] == project_id]

        if not snapshots:
            return report

        latest = snapshots[-1]
        report.total_dependencies = latest["total"]
        report.direct_dependencies = latest["direct"]
        report.transitive_dependencies = latest["transitive"]
        report.outdated_dependencies = latest["outdated"]
        report.vulnerable_dependencies = latest["vulnerable"]

        # Health score: 100 - penalty for outdated and vulnerable deps
        if report.total_dependencies > 0:
            outdated_ratio = report.outdated_dependencies / report.total_dependencies
            vulnerable_ratio = (
                report.vulnerable_dependencies / report.total_dependencies
            )
            report.health_score = max(
                0, 100 - (outdated_ratio * 30) - (vulnerable_ratio * 70)
            )
            report.health_score = round(report.health_score, 1)

        # Ecosystem breakdown
        for eco, count in latest.get("ecosystem_breakdown", {}).items():
            report.by_ecosystem[eco] = {"total": count}

        # Update urgency
        report.update_urgency = {
            "critical": report.vulnerable_dependencies,
            "recommended": report.outdated_dependencies,
            "optional": max(
                0,
                report.total_dependencies
                - report.outdated_dependencies
                - report.vulnerable_dependencies,
            ),
        }

        return report

    # ── Dashboard Data ────────────────────────────────────────────

    def get_dashboard_data(self) -> DashboardData:
        """Get aggregated dashboard data for UI rendering."""
        wf_report = self.get_workflow_performance(TimeRange.LAST_DAY)
        sec_report = self.get_security_metrics(TimeRange.LAST_DAY)
        dep_report = self.get_dependency_health()

        dashboard = DashboardData(
            generated_at=datetime.utcnow().isoformat(),
            workflow_summary={
                "total_executions": wf_report.total_executions,
                "success_rate": round(wf_report.success_rate, 1),
                "avg_duration_ms": round(wf_report.avg_duration_ms, 0),
                "throughput_per_hour": round(wf_report.throughput_per_hour, 1),
                "failed": wf_report.failed,
            },
            security_summary={
                "total_vulnerabilities": sec_report.total_vulnerabilities,
                "new_vulnerabilities": sec_report.new_vulnerabilities,
                "resolved": sec_report.resolved_vulnerabilities,
                "by_severity": sec_report.by_severity,
                "policy_violations": sec_report.policy_violations,
                "mttr_hours": round(sec_report.mean_time_to_remediation_hours, 1),
            },
            dependency_summary={
                "total": dep_report.total_dependencies,
                "outdated": dep_report.outdated_dependencies,
                "vulnerable": dep_report.vulnerable_dependencies,
                "health_score": dep_report.health_score,
            },
        )

        # Recent activity (last 20 events across all types)
        all_events = []
        for e in self._workflow_events[-10:]:
            all_events.append(
                {
                    "type": "workflow",
                    "event": e["event_type"],
                    "timestamp": e["timestamp"].isoformat(),
                    "details": f"{e['workflow_type']} - {e['status']}",
                }
            )
        for e in self._security_events[-10:]:
            all_events.append(
                {
                    "type": "security",
                    "event": e["event_type"],
                    "timestamp": e["timestamp"].isoformat(),
                    "details": f"{e.get('severity', 'unknown')} - {e.get('package_name', 'unknown')}",
                }
            )
        all_events.sort(key=lambda x: x["timestamp"], reverse=True)
        dashboard.recent_activity = all_events[:20]

        # Trends
        dashboard.trends = {
            "workflow_duration": self._describe_trend(wf_report.duration_trend),
            "vulnerabilities": self._describe_trend(sec_report.vulnerability_trend),
        }

        return dashboard

    # ── Helpers ────────────────────────────────────────────────────

    def _get_cutoff(self, time_range: TimeRange) -> datetime:
        """Convert time range to cutoff datetime."""
        mapping = {
            TimeRange.LAST_HOUR: timedelta(hours=1),
            TimeRange.LAST_DAY: timedelta(days=1),
            TimeRange.LAST_WEEK: timedelta(weeks=1),
            TimeRange.LAST_MONTH: timedelta(days=30),
            TimeRange.LAST_QUARTER: timedelta(days=90),
        }
        return datetime.utcnow() - mapping[time_range]

    def _trim_events(self, events: list) -> None:
        """Trim events list to max size."""
        if len(events) > self._max_events:
            del events[: len(events) - self._max_events]

    @staticmethod
    def _percentile(sorted_values: list[float], pct: int) -> float:
        """Calculate percentile from sorted values."""
        if not sorted_values:
            return 0.0
        idx = int((pct / 100.0) * len(sorted_values))
        return sorted_values[min(idx, len(sorted_values) - 1)]

    @staticmethod
    def _analyze_trend(values: list[float]) -> TrendAnalysis:
        """Analyze trend from a list of values."""
        n = len(values)
        if n < 2:
            return TrendAnalysis(
                direction="stable",
                slope=0,
                change_percent=0,
                data_points=n,
                start_value=values[0] if values else 0,
                end_value=values[-1] if values else 0,
                min_value=min(values) if values else 0,
                max_value=max(values) if values else 0,
                avg_value=statistics.mean(values) if values else 0,
            )

        # Simple linear regression slope
        x = list(range(n))
        sum_x = sum(x)
        sum_y = sum(values)
        sum_xy = sum(x[i] * values[i] for i in range(n))
        sum_x2 = sum(xi**2 for xi in x)

        denominator = n * sum_x2 - sum_x**2
        slope = (n * sum_xy - sum_x * sum_y) / denominator if denominator != 0 else 0

        start_val = values[0]
        end_val = values[-1]
        change_pct = ((end_val - start_val) / start_val * 100) if start_val != 0 else 0

        if (
            abs(slope) < 0.01 * statistics.mean(values)
            if statistics.mean(values) != 0
            else abs(slope) < 0.01
        ):
            direction = "stable"
        elif slope > 0:
            direction = "increasing"
        else:
            direction = "decreasing"

        return TrendAnalysis(
            direction=direction,
            slope=round(slope, 4),
            change_percent=round(change_pct, 2),
            data_points=n,
            start_value=start_val,
            end_value=end_val,
            min_value=min(values),
            max_value=max(values),
            avg_value=round(statistics.mean(values), 2),
        )

    @staticmethod
    def _group_by_day(timestamps: list[datetime]) -> list[float]:
        """Group timestamps by day and return daily counts."""
        if not timestamps:
            return []
        daily: dict[str, int] = defaultdict(int)
        for ts in timestamps:
            day_key = ts.strftime("%Y-%m-%d")
            daily[day_key] += 1
        return [float(count) for count in sorted(daily.values())]

    @staticmethod
    def _describe_trend(trend: TrendAnalysis | None) -> dict[str, Any]:
        """Convert TrendAnalysis to dict for dashboard."""
        if not trend:
            return {"direction": "unknown", "change_percent": 0}
        return {
            "direction": trend.direction,
            "change_percent": trend.change_percent,
            "slope": trend.slope,
            "data_points": trend.data_points,
        }
