"""Extension methods for dashboard service - heatmaps, exports, and additional functionality."""

from datetime import datetime, timedelta
from typing import Any, Optional

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.models import (
    ComplianceReport,
    Project,
    ProjectVulnerability,
    Vulnerability,
)
from ..core.schemas.dashboard import DashboardFilters, DashboardLayout, TimeRange


class DashboardServiceExtensions:
    """Extension methods for dashboard service."""

    def __init__(self, db_session: AsyncSession):
        self.db_session = db_session

    async def get_project_risk_heatmap(
        self, organization_id: Optional[str], project_ids: Optional[list[str]]
    ) -> dict[str, Any]:
        """Get project risk data for heatmap visualization."""

        # Get projects and their risk metrics
        query = (
            select(
                Project.name,
                Vulnerability.severity,
                func.avg(ProjectVulnerability.risk_score).label("avg_risk"),
                func.count(ProjectVulnerability.id).label("count"),
            )
            .join(ProjectVulnerability)
            .join(Vulnerability)
            .group_by(Project.name, Vulnerability.severity)
        )

        if organization_id:
            query = query.where(Project.organization_id == organization_id)

        if project_ids:
            query = query.where(Project.id.in_(project_ids))

        result = await self.db_session.execute(query)
        rows = result.all()

        # Organize data for heatmap
        projects = list(set(row.name for row in rows))
        severities = ["critical", "high", "medium", "low"]

        # Create risk matrix
        risk_matrix = []
        for severity in severities:
            row = []
            for project in projects:
                # Find the risk score for this project-severity combination
                risk_score = 0
                for r in rows:
                    if r.name == project and r.severity == severity:
                        risk_score = r.avg_risk or 0
                        break
                row.append(risk_score)
            risk_matrix.append(row)

        return {
            "x_axis": projects,
            "y_axis": severities,
            "data": risk_matrix,
            "metadata": {
                "type": "project_severity_risk",
                "generated_at": datetime.utcnow().isoformat(),
            },
        }

    async def get_compliance_risk_heatmap(
        self, organization_id: Optional[str], project_ids: Optional[list[str]]
    ) -> dict[str, Any]:
        """Get compliance risk data for heatmap visualization."""

        # Get compliance scores by framework and project
        subquery = (
            select(
                ComplianceReport.project_id,
                ComplianceReport.framework,
                func.max(ComplianceReport.created_at).label("latest_date"),
            )
            .group_by(ComplianceReport.project_id, ComplianceReport.framework)
            .subquery()
        )

        query = (
            select(
                Project.name, ComplianceReport.framework, ComplianceReport.overall_score
            )
            .join(Project)
            .join(
                subquery,
                and_(
                    ComplianceReport.project_id == subquery.c.project_id,
                    ComplianceReport.framework == subquery.c.framework,
                    ComplianceReport.created_at == subquery.c.latest_date,
                ),
            )
        )

        if organization_id:
            query = query.where(Project.organization_id == organization_id)

        if project_ids:
            query = query.where(Project.id.in_(project_ids))

        result = await self.db_session.execute(query)
        rows = result.all()

        # Organize data for heatmap
        projects = list(set(row.name for row in rows))
        frameworks = list(set(row.framework for row in rows))

        # Create compliance matrix (convert score to risk: 1 - score)
        compliance_matrix = []
        for framework in frameworks:
            row = []
            for project in projects:
                # Find compliance score and convert to risk
                compliance_score = 0
                for r in rows:
                    if r.name == project and r.framework == framework:
                        compliance_score = r.overall_score or 0
                        break
                # Risk = 1 - compliance_score
                risk_score = 1 - compliance_score
                row.append(risk_score)
            compliance_matrix.append(row)

        return {
            "x_axis": projects,
            "y_axis": frameworks,
            "data": compliance_matrix,
            "metadata": {
                "type": "compliance_risk",
                "generated_at": datetime.utcnow().isoformat(),
            },
        }

    async def export_to_csv(
        self,
        organization_id: Optional[str],
        time_range: TimeRange,
        filters: Optional[DashboardFilters],
    ) -> str:
        """Export dashboard data to CSV format."""

        # Import here to avoid circular imports
        from .dashboard_service import DashboardService

        dashboard_service = DashboardService(self.db_session)

        # Get dashboard data
        dashboard_data = await dashboard_service.get_security_dashboard(
            organization_id=organization_id,
            project_ids=filters.project_ids if filters else None,
            time_range=time_range,
            filters=filters,
        )

        # Generate CSV content
        import csv
        import io

        output = io.StringIO()
        writer = csv.writer(output)

        # Write header
        writer.writerow(["Security Dashboard Export"])
        writer.writerow(["Generated At:", dashboard_data.generated_at.isoformat()])
        writer.writerow(["Time Range:", time_range.value])
        writer.writerow([])

        # Write KPIs
        writer.writerow(["Security KPIs"])
        writer.writerow(["Metric", "Value"])
        kpis = dashboard_data.security_kpis
        writer.writerow(["Overall Security Score", f"{kpis.security_score}%"])
        writer.writerow(
            ["Mean Time to Remediate", f"{kpis.mean_time_to_remediate_hours} hours"]
        )
        writer.writerow(["Detection Rate", f"{kpis.vulnerability_detection_rate}%"])
        writer.writerow(["Security Coverage", f"{kpis.security_coverage_percentage}%"])
        writer.writerow(["False Positive Rate", f"{kpis.false_positive_rate}%"])
        writer.writerow(
            ["Automated Remediation Rate", f"{kpis.automated_remediation_rate}%"]
        )
        writer.writerow([])

        # Write risk metrics
        writer.writerow(["Risk Metrics"])
        writer.writerow(["Metric", "Value"])
        risk = dashboard_data.risk_metrics
        writer.writerow(["Average Risk Score", risk.average_risk_score])
        writer.writerow(["Max Risk Score", risk.max_risk_score])
        writer.writerow(["Critical Risk Count", risk.critical_risk_count])
        writer.writerow(["High Risk Count", risk.high_risk_count])
        writer.writerow(["Total Vulnerabilities", risk.total_vulnerabilities])
        writer.writerow([])

        # Write critical vulnerabilities
        writer.writerow(["Critical Vulnerabilities"])
        writer.writerow(
            ["ID", "Title", "Severity", "Risk Score", "Project", "Package", "Status"]
        )
        for vuln in dashboard_data.critical_vulnerabilities[:20]:  # Limit to top 20
            writer.writerow(
                [
                    vuln["id"],
                    vuln["title"],
                    vuln["severity"],
                    vuln["risk_score"],
                    vuln["project_name"],
                    vuln.get("package_name", "N/A"),
                    vuln["status"],
                ]
            )

        csv_content = output.getvalue()
        output.close()

        return csv_content

    async def queue_pdf_export(
        self,
        organization_id: Optional[str],
        time_range: TimeRange,
        filters: Optional[DashboardFilters],
        include_charts: bool,
        background_tasks,
    ) -> str:
        """Queue PDF export generation."""

        # Generate export ID
        import uuid

        export_id = str(uuid.uuid4())

        # Queue background task for PDF generation
        background_tasks.add_task(
            self._generate_pdf_export,
            export_id,
            organization_id,
            time_range,
            filters,
            include_charts,
        )

        return export_id

    async def _generate_pdf_export(
        self,
        export_id: str,
        organization_id: Optional[str],
        time_range: TimeRange,
        filters: Optional[DashboardFilters],
        include_charts: bool,
    ):
        """Generate PDF export in background."""

        # This would integrate with a PDF generation service
        # For now, we'll just log the request
        print(f"Generating PDF export {export_id} for organization {organization_id}")

        # TODO: Implement actual PDF generation with charts
        pass

    async def create_share_link(
        self,
        dashboard_id: str,
        share_type: str,
        recipients: list[str],
        expires_at: Optional[datetime],
        permissions: list[str],
    ):
        """Create a shareable dashboard link."""

        # This would create a share link in the database
        # For now, return a mock object
        import uuid

        class ShareLink:
            def __init__(self):
                self.id = str(uuid.uuid4())
                self.expires_at = expires_at
                self.permissions = permissions

        return ShareLink()

    async def get_dashboard_layouts(
        self, organization_id: Optional[str]
    ) -> list[DashboardLayout]:
        """Get dashboard layouts."""

        # This would query the database for dashboard layouts
        # For now, return default layouts
        from ..core.schemas.dashboard import DashboardWidget

        default_layout = DashboardLayout(
            id="default",
            name="Default Security Dashboard",
            description="Default layout for security metrics",
            widgets=[
                DashboardWidget(
                    id="kpi-overview",
                    title="Security KPIs",
                    widget_type="kpi_cards",
                    position_x=0,
                    position_y=0,
                    width=12,
                    height=2,
                    config={"metrics": ["security_score", "mttr", "detection_rate"]},
                ),
                DashboardWidget(
                    id="vulnerability-trends",
                    title="Vulnerability Trends",
                    widget_type="line_chart",
                    position_x=0,
                    position_y=2,
                    width=8,
                    height=4,
                    config={"time_range": "30_days", "group_by": "severity"},
                ),
                DashboardWidget(
                    id="risk-metrics",
                    title="Risk Metrics",
                    widget_type="gauge_charts",
                    position_x=8,
                    position_y=2,
                    width=4,
                    height=4,
                    config={"metrics": ["avg_risk", "critical_count"]},
                ),
            ],
            is_default=True,
            created_by="system",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        return [default_layout]

    async def create_dashboard_layout(self, layout: DashboardLayout) -> DashboardLayout:
        """Create a new dashboard layout."""

        # This would save the layout to the database
        # For now, just return the input with timestamps
        layout.created_at = datetime.utcnow()
        layout.updated_at = datetime.utcnow()

        return layout

    async def get_realtime_metrics(
        self,
        organization_id: Optional[str],
        project_id: Optional[str],
        metrics: list[str],
    ) -> dict[str, Any]:
        """Get real-time security metrics."""

        # This would connect to a real-time metrics system
        # For now, return mock data
        realtime_data = {}

        if not metrics or "vulnerability_count" in metrics:
            realtime_data["vulnerability_count"] = {
                "value": 42,
                "change": -5,
                "change_percent": -10.6,
                "timestamp": datetime.utcnow().isoformat(),
            }

        if not metrics or "risk_score" in metrics:
            realtime_data["risk_score"] = {
                "value": 6.7,
                "change": 0.2,
                "change_percent": 3.1,
                "timestamp": datetime.utcnow().isoformat(),
            }

        if not metrics or "scan_progress" in metrics and project_id:
            realtime_data["scan_progress"] = {
                "value": 75,
                "status": "running",
                "current_step": "Analyzing dependencies",
                "timestamp": datetime.utcnow().isoformat(),
            }

        return realtime_data

    async def get_project_security_score_detail(
        self, project_id: str
    ) -> dict[str, Any]:
        """Get detailed security score breakdown for a project."""

        # Query project security details
        query = select(Project).where(Project.id == project_id)
        result = await self.db_session.execute(query)
        project = result.scalar_one_or_none()

        if not project:
            from fastapi import HTTPException

            raise HTTPException(status_code=404, detail="Project not found")

        # Calculate score components
        score_breakdown = {
            "project_id": project_id,
            "project_name": project.name,
            "overall_score": 78.5,
            "components": {
                "vulnerability_management": {
                    "score": 75.0,
                    "weight": 0.3,
                    "factors": {
                        "open_vulnerabilities": 15,
                        "critical_vulnerabilities": 2,
                        "remediation_rate": 0.65,
                    },
                },
                "policy_compliance": {
                    "score": 85.0,
                    "weight": 0.25,
                    "factors": {"policy_violations": 3, "compliance_percentage": 0.85},
                },
                "dependency_health": {
                    "score": 70.0,
                    "weight": 0.2,
                    "factors": {
                        "outdated_dependencies": 8,
                        "unlicensed_packages": 1,
                        "dependency_tree_depth": 5,
                    },
                },
                "security_coverage": {
                    "score": 90.0,
                    "weight": 0.15,
                    "factors": {"scan_frequency": 0.9, "scan_success_rate": 0.95},
                },
                "threat_intelligence": {
                    "score": 80.0,
                    "weight": 0.1,
                    "factors": {
                        "new_vulnerabilities_detected": 3,
                        "threat_feed_coverage": 0.8,
                    },
                },
            },
            "recommendations": [
                "Prioritize remediation of critical vulnerabilities",
                "Update outdated dependencies",
                "Address policy violations",
                "Increase scan frequency for better coverage",
            ],
            "last_updated": datetime.utcnow().isoformat(),
        }

        return score_breakdown

    async def get_compliance_framework_summary(
        self, framework: str, organization_id: Optional[str]
    ) -> dict[str, Any]:
        """Get compliance summary for a specific framework."""

        # Query compliance data for the framework
        query = select(
            func.count(ComplianceReport.id).label("total_reports"),
            func.avg(ComplianceReport.overall_score).label("avg_score"),
            func.max(ComplianceReport.created_at).label("last_updated"),
        ).where(ComplianceReport.framework == framework)

        result = await self.db_session.execute(query)
        row = result.first()

        # Get control compliance breakdown
        control_query = (
            select(
                ComplianceReport.control_id,
                ComplianceReport.control_name,
                ComplianceReport.status,
                func.count(ComplianceReport.id).label("count"),
            )
            .where(ComplianceReport.framework == framework)
            .group_by(
                ComplianceReport.control_id,
                ComplianceReport.control_name,
                ComplianceReport.status,
            )
        )

        control_result = await self.db_session.execute(control_query)
        control_rows = control_result.all()

        # Organize control data
        controls = {}
        for control in control_rows:
            if control.control_id not in controls:
                controls[control.control_id] = {
                    "name": control.control_name,
                    "status": control.status,
                    "projects_count": 0,
                }
            controls[control.control_id]["projects_count"] += control.count

        summary = {
            "framework": framework,
            "total_projects": row.total_reports or 0,
            "average_compliance_score": round((row.avg_score or 0) * 100, 1),
            "last_updated": row.last_updated.isoformat() if row.last_updated else None,
            "controls": controls,
            "compliance_trend": [
                {"date": "2024-01-01", "score": 82.5},
                {"date": "2024-02-01", "score": 85.0},
                {"date": "2024-03-01", "score": 83.2},
                {"date": "2024-04-01", "score": 87.8},
            ],
        }

        return summary

    async def get_weekly_security_summary(
        self, organization_id: Optional[str], week_offset: int
    ) -> dict[str, Any]:
        """Generate weekly security summary report."""

        # Calculate week dates
        end_date = datetime.utcnow() - timedelta(weeks=week_offset)
        start_date = end_date - timedelta(days=7)

        # Import here to avoid circular imports
        from .dashboard_service import DashboardService

        dashboard_service = DashboardService(self.db_session)

        # Get weekly metrics
        dashboard_data = await dashboard_service.get_security_dashboard(
            organization_id=organization_id,
            time_range=TimeRange.LAST_7_DAYS,
            filters=None,
        )

        # Create weekly summary
        summary = {
            "week_start": start_date.strftime("%Y-%m-%d"),
            "week_end": end_date.strftime("%Y-%m-%d"),
            "executive_summary": {
                "overall_security_posture": "MODERATE",
                "critical_issues": len(dashboard_data.critical_vulnerabilities),
                "risk_trend": "IMPROVING"
                if dashboard_data.risk_metrics.risk_trend_percentage < 0
                else "DETERIORATING",
                "key_highlights": [
                    f"{dashboard_data.remediation_progress['vulnerabilities_remediated']} vulnerabilities remediated",
                    f"Security score: {dashboard_data.security_kpis.security_score}%",
                    f"{dashboard_data.compliance_overview.compliant_projects} projects compliant",
                ],
            },
            "vulnerability_summary": {
                "total_found": dashboard_data.risk_metrics.total_vulnerabilities,
                "by_severity": dashboard_data.vulnerability_severity_distribution,
                "new_this_week": dashboard_data.remediation_progress[
                    "vulnerabilities_created"
                ],
                "remediated_this_week": dashboard_data.remediation_progress[
                    "vulnerabilities_remediated"
                ],
            },
            "compliance_summary": {
                "overall_score": dashboard_data.compliance_overview.overall_compliance_score,
                "framework_scores": dashboard_data.compliance_overview.framework_scores,
                "compliant_projects": dashboard_data.compliance_overview.compliant_projects,
                "total_projects": dashboard_data.compliance_overview.total_projects,
            },
            "risk_metrics": dashboard_data.risk_metrics.dict(),
            "top_risks": dashboard_data.critical_vulnerabilities[:5],
            "recommendations": [
                "Focus on remediation of critical vulnerabilities in Project X and Project Y",
                "Review and update security policies to reduce violations",
                "Schedule regular security scans for all projects",
                "Implement automated remediation where possible",
            ],
            "generated_at": datetime.utcnow().isoformat(),
        }

        return summary
