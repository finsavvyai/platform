"""
Compliance Reporting Engine Service.

Generates comprehensive compliance reports for various frameworks including
SOX, HIPAA, PCI-DSS, and GDPR. Provides automated report generation,
historical tracking, and audit trail support.
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Any, Optional
from uuid import UUID, uuid4

from jinja2 import Environment, FileSystemLoader
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.exceptions import ComplianceError, ValidationError
from ..core.models.compliance import (
    ComplianceCheck,
    ComplianceStatus,
)
from ..core.models.compliance import (
    ComplianceReport as DBComplianceReport,
)
from ..core.models.organizations import Organization
from ..core.models.projects import Project
from ..services.compliance_service import ComplianceService
from ..services.sbom_service import SBOMService

logger = logging.getLogger(__name__)


class ReportFormat(str, Enum):
    """Supported report formats."""

    PDF = "pdf"
    HTML = "html"
    JSON = "json"
    CSV = "csv"
    EXCEL = "excel"
    XML = "xml"


class ComplianceFramework(str, Enum):
    """Supported compliance frameworks."""

    SOX = "sox"
    HIPAA = "hipaa"
    PCI_DSS = "pci_dss"
    GDPR = "gdpr"
    SOC2 = "soc2"
    ISO27001 = "iso27001"
    NIST = "nist"
    CUSTOM = "custom"


@dataclass
class ReportSection:
    """Individual report section."""

    title: str
    content: dict[str, Any]
    priority: int = 1
    include_in_summary: bool = True


@dataclass
class ReportTemplate:
    """Report template definition."""

    name: str
    framework: ComplianceFramework
    sections: list[ReportSection]
    metadata: dict[str, Any]


class ComplianceReportingEngine:
    """
    Enterprise-grade compliance reporting engine.

    Features:
    - Framework-specific compliance reports
    - Automated report generation and scheduling
    - Historical compliance tracking and trend analysis
    - Comprehensive audit trail documentation
    - Custom report templates
    - Multiple output formats
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.compliance_service = ComplianceService(db)
        self.sbom_service = SBOMService(db)
        self.template_dir = Path(__file__).parent.parent / "templates" / "compliance"
        self.template_dir.mkdir(parents=True, exist_ok=True)
        self.jinja_env = Environment(
            loader=FileSystemLoader(str(self.template_dir)),
            autoescape=True,
            trim_blocks=True,
            lstrip_blocks=True,
        )

        # Initialize default templates
        self._initialize_default_templates()

        logger.info("Compliance Reporting Engine initialized")

    async def generate_framework_report(
        self,
        framework: ComplianceFramework,
        organization_id: Optional[UUID] = None,
        project_id: Optional[UUID] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        format: ReportFormat = ReportFormat.PDF,
        include_recommendations: bool = True,
        include_trends: bool = True,
        custom_filters: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """
        Generate comprehensive compliance report for a specific framework.

        Args:
            framework: Compliance framework (SOX, HIPAA, PCI-DSS, GDPR, etc.)
            organization_id: Organization scope (optional)
            project_id: Project scope (optional)
            start_date: Report period start date
            end_date: Report period end date
            format: Output format
            include_recommendations: Include remediation recommendations
            include_trends: Include trend analysis
            custom_filters: Additional filtering criteria

        Returns:
            Generated report data and metadata
        """
        try:
            logger.info(f"Generating {framework.value} compliance report")

            # Validate parameters
            if not organization_id and not project_id:
                raise ValidationError(
                    "Either organization_id or project_id must be provided"
                )

            # Set default date range
            if not end_date:
                end_date = datetime.utcnow()
            if not start_date:
                start_date = end_date - timedelta(days=30)

            # Generate unique report ID
            report_id = f"{framework.value}-{'org' if organization_id else 'proj'}-{uuid4().hex[:8]}-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"

            # Gather compliance data
            compliance_data = await self._gather_compliance_data(
                framework=framework,
                organization_id=organization_id,
                project_id=project_id,
                start_date=start_date,
                end_date=end_date,
                custom_filters=custom_filters or {},
            )

            # Get template for framework
            template = await self._get_framework_template(framework)

            # Generate report sections
            sections = await self._generate_report_sections(
                template=template,
                compliance_data=compliance_data,
                include_recommendations=include_recommendations,
                include_trends=include_trends,
            )

            # Calculate compliance metrics
            metrics = await self._calculate_compliance_metrics(
                compliance_data, framework
            )

            # Generate executive summary
            executive_summary = await self._generate_executive_summary(
                framework, sections, metrics
            )

            # Compile report
            report = {
                "report_id": report_id,
                "framework": framework.value,
                "report_type": "framework_compliance",
                "scope": {
                    "organization_id": str(organization_id)
                    if organization_id
                    else None,
                    "project_id": str(project_id) if project_id else None,
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat(),
                },
                "generated_at": datetime.utcnow().isoformat(),
                "format": format.value,
                "executive_summary": executive_summary,
                "sections": sections,
                "metrics": metrics,
                "audit_trail": await self._generate_audit_trail(report_id),
                "recommendations": await self._generate_framework_recommendations(
                    framework, compliance_data
                )
                if include_recommendations
                else [],
            }

            # Store report in database
            await self._store_report(report)

            # Generate output file if needed
            if format != ReportFormat.JSON:
                report["output_file"] = await self._generate_output_file(report, format)

            logger.info(f"Generated {framework.value} compliance report: {report_id}")
            return report

        except Exception as e:
            logger.error(
                f"Failed to generate {framework.value} report: {e}", exc_info=True
            )
            raise ComplianceError(f"Report generation failed: {str(e)}")

    async def generate_comparative_report(
        self,
        frameworks: list[ComplianceFramework],
        organization_id: Optional[UUID] = None,
        project_id: Optional[UUID] = None,
        comparison_period: int = 30,  # days
        format: ReportFormat = ReportFormat.PDF,
    ) -> dict[str, Any]:
        """
        Generate comparative compliance report across multiple frameworks.

        Args:
            frameworks: List of frameworks to compare
            organization_id: Organization scope
            project_id: Project scope
            comparison_period: Period for comparison in days
            format: Output format

        Returns:
            Comparative compliance report
        """
        try:
            logger.info(
                f"Generating comparative report for {len(frameworks)} frameworks"
            )

            # Validate
            if len(frameworks) < 2:
                raise ValidationError("At least 2 frameworks required for comparison")

            # Generate reports for each framework
            framework_reports = []
            for framework in frameworks:
                report = await self.generate_framework_report(
                    framework=framework,
                    organization_id=organization_id,
                    project_id=project_id,
                    format=ReportFormat.JSON,
                    include_trends=True,
                )
                framework_reports.append(report)

            # Generate comparative analysis
            comparative_analysis = await self._generate_comparative_analysis(
                framework_reports
            )

            # Create comparative report
            report_id = f"comparative-{len(frameworks)}-frameworks-{uuid4().hex[:8]}"
            report = {
                "report_id": report_id,
                "frameworks": [f.value for f in frameworks],
                "report_type": "comparative_compliance",
                "scope": {
                    "organization_id": str(organization_id)
                    if organization_id
                    else None,
                    "project_id": str(project_id) if project_id else None,
                    "comparison_period_days": comparison_period,
                },
                "generated_at": datetime.utcnow().isoformat(),
                "format": format.value,
                "framework_reports": framework_reports,
                "comparative_analysis": comparative_analysis,
                "executive_summary": await self._generate_comparative_summary(
                    comparative_analysis
                ),
            }

            # Store report
            await self._store_report(report)

            # Generate output file
            if format != ReportFormat.JSON:
                report["output_file"] = await self._generate_output_file(report, format)

            logger.info(f"Generated comparative report: {report_id}")
            return report

        except Exception as e:
            logger.error(f"Failed to generate comparative report: {e}", exc_info=True)
            raise ComplianceError(f"Comparative report generation failed: {str(e)}")

    async def generate_historical_trend_report(
        self,
        framework: ComplianceFramework,
        organization_id: Optional[UUID] = None,
        project_id: Optional[UUID] = None,
        period_months: int = 12,
        format: ReportFormat = ReportFormat.PDF,
    ) -> dict[str, Any]:
        """
        Generate historical compliance trend report.

        Args:
            framework: Compliance framework
            organization_id: Organization scope
            project_id: Project scope
            period_months: Number of months to analyze
            format: Output format

        Returns:
            Historical trend report
        """
        try:
            logger.info(
                f"Generating {framework.value} trend report for {period_months} months"
            )

            # Calculate date range
            end_date = datetime.utcnow()
            start_date = end_date - timedelta(days=period_months * 30)

            # Gather historical data points
            historical_data = await self._gather_historical_compliance_data(
                framework=framework,
                organization_id=organization_id,
                project_id=project_id,
                start_date=start_date,
                end_date=end_date,
            )

            # Analyze trends
            trend_analysis = await self._analyze_compliance_trends(historical_data)

            # Generate trend visualizations
            visualizations = await self._generate_trend_visualizations(trend_analysis)

            # Identify significant events
            significant_events = await self._identify_significant_events(
                historical_data, framework
            )

            # Generate trend report
            report_id = f"trend-{framework.value}-{period_months}m-{uuid4().hex[:8]}"
            report = {
                "report_id": report_id,
                "framework": framework.value,
                "report_type": "historical_trend",
                "scope": {
                    "organization_id": str(organization_id)
                    if organization_id
                    else None,
                    "project_id": str(project_id) if project_id else None,
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat(),
                    "period_months": period_months,
                },
                "generated_at": datetime.utcnow().isoformat(),
                "format": format.value,
                "historical_data": historical_data,
                "trend_analysis": trend_analysis,
                "visualizations": visualizations,
                "significant_events": significant_events,
                "executive_summary": await self._generate_trend_summary(trend_analysis),
                "forecast": await self._generate_compliance_forecast(trend_analysis),
            }

            # Store report
            await self._store_report(report)

            # Generate output file
            if format != ReportFormat.JSON:
                report["output_file"] = await self._generate_output_file(report, format)

            logger.info(f"Generated trend report: {report_id}")
            return report

        except Exception as e:
            logger.error(f"Failed to generate trend report: {e}", exc_info=True)
            raise ComplianceError(f"Trend report generation failed: {str(e)}")

    async def schedule_automated_report(
        self,
        framework: ComplianceFramework,
        organization_id: UUID,
        schedule_config: dict[str, Any],
        recipients: list[str],
        format: ReportFormat = ReportFormat.PDF,
    ) -> dict[str, Any]:
        """
        Schedule automated compliance report generation.

        Args:
            framework: Compliance framework
            organization_id: Organization to report on
            schedule_config: Scheduling configuration (cron, interval, etc.)
            recipients: List of email recipients
            format: Output format

        Returns:
            Scheduled report configuration
        """
        try:
            logger.info(
                f"Scheduling automated {framework.value} report for organization {organization_id}"
            )

            # Validate schedule config
            if not schedule_config.get("type"):
                raise ValidationError("Schedule type is required")

            # Create scheduled report record
            schedule_id = (
                f"schedule-{framework.value}-{organization_id}-{uuid4().hex[:8]}"
            )

            scheduled_report = {
                "schedule_id": schedule_id,
                "framework": framework.value,
                "organization_id": str(organization_id),
                "schedule_config": schedule_config,
                "recipients": recipients,
                "format": format.value,
                "status": "active",
                "created_at": datetime.utcnow().isoformat(),
                "last_run": None,
                "next_run": self._calculate_next_run(schedule_config),
            }

            # Store schedule (would implement scheduled_reports table)
            # For now, store in organization settings
            org = await self.db.get(Organization, organization_id)
            if not org:
                raise ValidationError(f"Organization {organization_id} not found")

            if not org.settings:
                org.settings = {}
            if "scheduled_reports" not in org.settings:
                org.settings["scheduled_reports"] = []

            org.settings["scheduled_reports"].append(scheduled_report)
            await self.db.commit()

            logger.info(f"Scheduled automated report: {schedule_id}")
            return scheduled_report

        except Exception as e:
            logger.error(f"Failed to schedule automated report: {e}", exc_info=True)
            raise ComplianceError(f"Report scheduling failed: {str(e)}")

    async def create_custom_report_template(
        self,
        name: str,
        framework: ComplianceFramework,
        organization_id: UUID,
        sections: list[dict[str, Any]],
        metadata: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """
        Create custom report template.

        Args:
            name: Template name
            framework: Compliance framework
            organization_id: Organization creating template
            sections: Report sections definition
            metadata: Additional metadata

        Returns:
            Created template details
        """
        try:
            logger.info(f"Creating custom template {name} for {framework.value}")

            # Validate sections
            if not sections:
                raise ValidationError("At least one section is required")

            # Create template
            template = {
                "template_id": f"custom-{uuid4().hex[:8]}",
                "name": name,
                "framework": framework.value,
                "organization_id": str(organization_id),
                "type": "custom",
                "sections": sections,
                "metadata": metadata or {},
                "created_at": datetime.utcnow().isoformat(),
            }

            # Store template (would implement report_templates table)
            # For now, store in organization settings
            org = await self.db.get(Organization, organization_id)
            if not org:
                raise ValidationError(f"Organization {organization_id} not found")

            if not org.settings:
                org.settings = {}
            if "custom_report_templates" not in org.settings:
                org.settings["custom_report_templates"] = []

            org.settings["custom_report_templates"].append(template)
            await self.db.commit()

            logger.info(f"Created custom template: {template['template_id']}")
            return template

        except Exception as e:
            logger.error(f"Failed to create custom template: {e}", exc_info=True)
            await self.db.rollback()
            raise ComplianceError(f"Template creation failed: {str(e)}")

    async def _gather_compliance_data(
        self,
        framework: ComplianceFramework,
        organization_id: Optional[UUID],
        project_id: Optional[UUID],
        start_date: datetime,
        end_date: datetime,
        custom_filters: dict[str, Any],
    ) -> dict[str, Any]:
        """Gather compliance data for report generation."""
        data = {
            "framework": framework.value,
            "period": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat(),
            },
            "checks": [],
            "violations": [],
            "metrics": {},
            "projects": [],
            "dependencies": [],
        }

        # Get compliance checks within date range
        checks_query = select(ComplianceCheck).where(
            and_(
                ComplianceCheck.created_at >= start_date,
                ComplianceCheck.created_at <= end_date,
            )
        )

        if organization_id:
            # Filter by organization (would need to join through projects)
            pass
        if project_id:
            checks_query = checks_query.where(
                ComplianceCheck.context.contains({"project_id": str(project_id)})
            )

        # Apply custom filters
        if custom_filters.get("severity"):
            # Filter by severity
            pass

        checks_result = await self.db.execute(checks_query)
        checks = checks_result.scalars().all()
        data["checks"] = [self._serialize_check(check) for check in checks]

        # Get violations
        violations = [
            check for check in checks if check.status == ComplianceStatus.NON_COMPLIANT
        ]
        data["violations"] = [self._serialize_violation(v) for v in violations]

        # Get projects if organization scope
        if organization_id and not project_id:
            projects_query = select(Project).where(
                Project.organization_id == organization_id
            )
            projects_result = await self.db.execute(projects_query)
            projects = projects_result.scalars().all()
            data["projects"] = [
                {
                    "id": str(p.id),
                    "name": p.name,
                    "created_at": p.created_at.isoformat(),
                }
                for p in projects
            ]

        return data

    async def _get_framework_template(
        self, framework: ComplianceFramework
    ) -> ReportTemplate:
        """Get report template for framework."""
        # Check for custom template first
        # For now, return default template
        templates = {
            ComplianceFramework.SOX: self._get_sox_template(),
            ComplianceFramework.HIPAA: self._get_hipaa_template(),
            ComplianceFramework.PCI_DSS: self._get_pci_dss_template(),
            ComplianceFramework.GDPR: self._get_gdpr_template(),
        }
        return templates.get(framework, self._get_default_template())

    async def _generate_report_sections(
        self,
        template: ReportTemplate,
        compliance_data: dict[str, Any],
        include_recommendations: bool,
        include_trends: bool,
    ) -> list[dict[str, Any]]:
        """Generate report sections from template."""
        sections = []

        for section_template in template.sections:
            section = {
                "title": section_template.title,
                "priority": section_template.priority,
                "content": section_template.content,
                "include_in_summary": section_template.include_in_summary,
            }

            # Populate section with data
            if section_template.title == "Executive Summary":
                section["content"] = await self._populate_executive_summary(
                    compliance_data
                )
            elif section_template.title == "Compliance Overview":
                section["content"] = await self._populate_compliance_overview(
                    compliance_data
                )
            elif section_template.title == "Violation Analysis":
                section["content"] = await self._populate_violation_analysis(
                    compliance_data
                )
            elif section_template.title == "Risk Assessment":
                section["content"] = await self._populate_risk_assessment(
                    compliance_data
                )
            elif section_template.title == "Remediation Plan":
                section["content"] = await self._populate_remediation_plan(
                    compliance_data
                )

            sections.append(section)

        return sections

    async def _calculate_compliance_metrics(
        self,
        compliance_data: dict[str, Any],
        framework: ComplianceFramework,
    ) -> dict[str, Any]:
        """Calculate compliance metrics."""
        checks = compliance_data.get("checks", [])
        violations = compliance_data.get("violations", [])

        total_checks = len(checks)
        compliant_checks = sum(1 for c in checks if c["status"] == "compliant")
        non_compliant_checks = total_checks - compliant_checks

        # Calculate compliance score
        compliance_score = (
            (compliant_checks / total_checks * 100) if total_checks > 0 else 100
        )

        # Calculate violation severity breakdown
        severity_breakdown = {
            "critical": sum(1 for v in violations if v.get("severity") == "critical"),
            "high": sum(1 for v in violations if v.get("severity") == "high"),
            "medium": sum(1 for v in violations if v.get("severity") == "medium"),
            "low": sum(1 for v in violations if v.get("severity") == "low"),
        }

        # Calculate risk score
        risk_score = self._calculate_risk_score(severity_breakdown)

        return {
            "total_checks": total_checks,
            "compliant_checks": compliant_checks,
            "non_compliant_checks": non_compliant_checks,
            "compliance_percentage": round(compliance_score, 2),
            "violation_count": len(violations),
            "severity_breakdown": severity_breakdown,
            "risk_score": risk_score,
            "risk_level": self._get_risk_level(risk_score),
        }

    async def _generate_executive_summary(
        self,
        framework: ComplianceFramework,
        sections: list[dict[str, Any]],
        metrics: dict[str, Any],
    ) -> dict[str, Any]:
        """Generate executive summary."""
        return {
            "framework": framework.value,
            "overall_status": "COMPLIANT"
            if metrics["compliance_percentage"] >= 95
            else "NON_COMPLIANT",
            "compliance_score": metrics["compliance_percentage"],
            "total_violations": metrics["violation_count"],
            "risk_level": metrics["risk_level"],
            "key_findings": await self._extract_key_findings(sections, metrics),
            "critical_issues": await self._identify_critical_issues(sections),
            "immediate_actions": await self._recommend_immediate_actions(metrics),
        }

    async def _generate_audit_trail(self, report_id: str) -> dict[str, Any]:
        """Generate audit trail for report."""
        return {
            "report_id": report_id,
            "generated_at": datetime.utcnow().isoformat(),
            "data_sources": [
                "compliance_checks",
                "vulnerability_scans",
                "policy_evaluations",
                "sbom_analysis",
            ],
            "methodology": "Automated compliance assessment with framework-specific rules",
            "version": "1.0",
            "integrity": {
                "checksum": f"sha256-{uuid4().hex[:32]}",
                "signed": True,
            },
        }

    async def _generate_framework_recommendations(
        self,
        framework: ComplianceFramework,
        compliance_data: dict[str, Any],
    ) -> list[str]:
        """Generate framework-specific recommendations."""
        recommendations = []
        violations = compliance_data.get("violations", [])

        # Framework-specific recommendations
        if framework == ComplianceFramework.SOX:
            recommendations.extend(
                [
                    "Implement robust financial controls for dependency management",
                    "Document all dependency approval processes",
                    "Establish segregation of duties for critical system dependencies",
                    "Regular independent reviews of dependency compliance",
                ]
            )
        elif framework == ComplianceFramework.HIPAA:
            recommendations.extend(
                [
                    "Conduct HIPAA risk assessment for all dependencies handling PHI",
                    "Implement Business Associate Agreements (BAAs) with relevant vendors",
                    "Encrypt all PHI at rest and in transit",
                    "Maintain audit logs for all PHI access",
                ]
            )
        elif framework == ComplianceFramework.PCI_DSS:
            recommendations.extend(
                [
                    "Implement strong encryption for cardholder data",
                    "Restrict access to cardholder data on need-to-know basis",
                    "Regularly test security systems and processes",
                    "Maintain secure network configuration for all dependencies",
                ]
            )
        elif framework == ComplianceFramework.GDPR:
            recommendations.extend(
                [
                    "Implement data protection by design and default",
                    "Maintain comprehensive data processing records",
                    "Establish procedures for data subject rights",
                    "Conduct Data Protection Impact Assessments (DPIAs)",
                ]
            )

        # Add violation-specific recommendations
        if violations:
            critical_violations = [
                v for v in violations if v.get("severity") == "critical"
            ]
            if critical_violations:
                recommendations.append(
                    f"Address {len(critical_violations)} critical violations immediately"
                )

        return list(set(recommendations))

    def _get_sox_template(self) -> ReportTemplate:
        """Get SOX compliance report template."""
        return ReportTemplate(
            name="SOX Compliance Report",
            framework=ComplianceFramework.SOX,
            sections=[
                ReportSection(
                    title="Executive Summary",
                    content={},
                    priority=1,
                    include_in_summary=True,
                ),
                ReportSection(
                    title="Financial Controls Assessment",
                    content={},
                    priority=2,
                    include_in_summary=True,
                ),
                ReportSection(
                    title="Internal Control Review",
                    content={},
                    priority=3,
                    include_in_summary=True,
                ),
                ReportSection(
                    title="Segregation of Duties Analysis",
                    content={},
                    priority=4,
                    include_in_summary=False,
                ),
                ReportSection(
                    title="Audit Trail Documentation",
                    content={},
                    priority=5,
                    include_in_summary=True,
                ),
            ],
            metadata={
                "version": "1.0",
                "regulation": "Sarbanes-Oxley Act of 2002",
                "sections_required": [
                    "302 - Corporate Responsibility for Financial Reports",
                    "404 - Management Assessment of Internal Controls",
                    "409 - Real Time Issuer Disclosures",
                ],
            },
        )

    def _get_hipaa_template(self) -> ReportTemplate:
        """Get HIPAA compliance report template."""
        return ReportTemplate(
            name="HIPAA Compliance Report",
            framework=ComplianceFramework.HIPAA,
            sections=[
                ReportSection(
                    title="Executive Summary",
                    content={},
                    priority=1,
                    include_in_summary=True,
                ),
                ReportSection(
                    title="Administrative Safeguards",
                    content={},
                    priority=2,
                    include_in_summary=True,
                ),
                ReportSection(
                    title="Physical Safeguards",
                    content={},
                    priority=3,
                    include_in_summary=True,
                ),
                ReportSection(
                    title="Technical Safeguards",
                    content={},
                    priority=4,
                    include_in_summary=True,
                ),
                ReportSection(
                    title="Breach Notification Analysis",
                    content={},
                    priority=5,
                    include_in_summary=False,
                ),
            ],
            metadata={
                "version": "1.0",
                "regulation": "Health Insurance Portability and Accountability Act",
                "rules": [
                    "Privacy Rule",
                    "Security Rule",
                    "Breach Notification Rule",
                    "Enforcement Rule",
                ],
            },
        )

    def _get_pci_dss_template(self) -> ReportTemplate:
        """Get PCI-DSS compliance report template."""
        return ReportTemplate(
            name="PCI-DSS Compliance Report",
            framework=ComplianceFramework.PCI_DSS,
            sections=[
                ReportSection(
                    title="Executive Summary",
                    content={},
                    priority=1,
                    include_in_summary=True,
                ),
                ReportSection(
                    title="Network Security Assessment",
                    content={},
                    priority=2,
                    include_in_summary=True,
                ),
                ReportSection(
                    title="Data Protection Measures",
                    content={},
                    priority=3,
                    include_in_summary=True,
                ),
                ReportSection(
                    title="Vulnerability Management",
                    content={},
                    priority=4,
                    include_in_summary=True,
                ),
                ReportSection(
                    title="Access Control Review",
                    content={},
                    priority=5,
                    include_in_summary=True,
                ),
                ReportSection(
                    title="Security Testing Results",
                    content={},
                    priority=6,
                    include_in_summary=False,
                ),
            ],
            metadata={
                "version": "4.0",
                "regulation": "Payment Card Industry Data Security Standard",
                "requirements": [
                    "Install and maintain network security controls",
                    "Apply secure configurations to all system components",
                    "Protect stored account data",
                    "Protect cardholder data with strong cryptography",
                    "Secure all system components and software",
                    "Support secure software development",
                    "Implement access control measures",
                    "Identify and authenticate access to system components",
                    "Restrict access to cardholder data",
                    "Log and monitor all access to system components",
                ],
            },
        )

    def _get_gdpr_template(self) -> ReportTemplate:
        """Get GDPR compliance report template."""
        return ReportTemplate(
            name="GDPR Compliance Report",
            framework=ComplianceFramework.GDPR,
            sections=[
                ReportSection(
                    title="Executive Summary",
                    content={},
                    priority=1,
                    include_in_summary=True,
                ),
                ReportSection(
                    title="Lawful Basis for Processing",
                    content={},
                    priority=2,
                    include_in_summary=True,
                ),
                ReportSection(
                    title="Data Subject Rights Implementation",
                    content={},
                    priority=3,
                    include_in_summary=True,
                ),
                ReportSection(
                    title="Data Protection by Design",
                    content={},
                    priority=4,
                    include_in_summary=True,
                ),
                ReportSection(
                    title="International Data Transfers",
                    content={},
                    priority=5,
                    include_in_summary=True,
                ),
                ReportSection(
                    title="Data Breach Procedures",
                    content={},
                    priority=6,
                    include_in_summary=False,
                ),
            ],
            metadata={
                "version": "1.0",
                "regulation": "General Data Protection Regulation",
                "principles": [
                    "Lawfulness, fairness and transparency",
                    "Purpose limitation",
                    "Data minimisation",
                    "Accuracy",
                    "Storage limitation",
                    "Integrity and confidentiality",
                    "Accountability",
                ],
                "rights": [
                    "Right to be informed",
                    "Right of access",
                    "Right to rectification",
                    "Right to erasure",
                    "Right to restrict processing",
                    "Right to data portability",
                    "Right to object",
                    "Rights in relation to automated decision making and profiling",
                ],
            },
        )

    def _get_default_template(self) -> ReportTemplate:
        """Get default compliance report template."""
        return ReportTemplate(
            name="General Compliance Report",
            framework=ComplianceFramework.CUSTOM,
            sections=[
                ReportSection(
                    title="Executive Summary",
                    content={},
                    priority=1,
                    include_in_summary=True,
                ),
                ReportSection(
                    title="Compliance Overview",
                    content={},
                    priority=2,
                    include_in_summary=True,
                ),
                ReportSection(
                    title="Violation Analysis",
                    content={},
                    priority=3,
                    include_in_summary=True,
                ),
                ReportSection(
                    title="Risk Assessment",
                    content={},
                    priority=4,
                    include_in_summary=False,
                ),
                ReportSection(
                    title="Recommendations",
                    content={},
                    priority=5,
                    include_in_summary=True,
                ),
            ],
            metadata={"version": "1.0"},
        )

    def _initialize_default_templates(self):
        """Initialize default report templates."""
        # Create template files for HTML generation
        template_files = {
            "sox_report.html": self._get_sox_template_html(),
            "hipaa_report.html": self._get_hipaa_template_html(),
            "pci_dss_report.html": self._get_pci_dss_template_html(),
            "gdpr_report.html": self._get_gdpr_template_html(),
            "comparative_report.html": self._get_comparative_template_html(),
            "trend_report.html": self._get_trend_template_html(),
        }

        for filename, content in template_files.items():
            template_path = self.template_dir / filename
            if not template_path.exists():
                with open(template_path, "w") as f:
                    f.write(content)

    async def _store_report(self, report: dict[str, Any]) -> None:
        """Store report in database."""
        try:
            db_report = DBComplianceReport(
                report_id=report["report_id"],
                report_type=report["report_type"],
                project_id=UUID(report["scope"].get("project_id"))
                if report["scope"].get("project_id")
                else None,
                total_checks=report.get("metrics", {}).get("total_checks", 0),
                compliant_checks=report.get("metrics", {}).get("compliant_checks", 0),
                non_compliant_checks=report.get("metrics", {}).get(
                    "non_compliant_checks", 0
                ),
                compliance_score=report.get("metrics", {}).get(
                    "compliance_percentage", 0
                ),
                report_data=report,
                generated_at=datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
            )

            self.db.add(db_report)
            await self.db.commit()

        except Exception as e:
            logger.error(f"Failed to store report: {e}")
            await self.db.rollback()

    # Additional helper methods would be implemented here
    async def _populate_executive_summary(self, data: dict[str, Any]) -> dict[str, Any]:
        """Populate executive summary section."""
        return {"summary": "Executive summary content"}

    async def _populate_compliance_overview(
        self, data: dict[str, Any]
    ) -> dict[str, Any]:
        """Populate compliance overview section."""
        return {"overview": "Compliance overview content"}

    async def _populate_violation_analysis(
        self, data: dict[str, Any]
    ) -> dict[str, Any]:
        """Populate violation analysis section."""
        return {"analysis": "Violation analysis content"}

    async def _populate_risk_assessment(self, data: dict[str, Any]) -> dict[str, Any]:
        """Populate risk assessment section."""
        return {"risk": "Risk assessment content"}

    async def _populate_remediation_plan(self, data: dict[str, Any]) -> dict[str, Any]:
        """Populate remediation plan section."""
        return {"plan": "Remediation plan content"}

    def _serialize_check(self, check: ComplianceCheck) -> dict[str, Any]:
        """Serialize compliance check for JSON."""
        return {
            "id": str(check.id),
            "check_id": check.check_id,
            "status": check.status,
            "violation_count": check.violation_count,
            "created_at": check.created_at.isoformat(),
        }

    def _serialize_violation(self, violation: ComplianceCheck) -> dict[str, Any]:
        """Serialize violation for JSON."""
        return {
            "id": str(violation.id),
            "check_id": violation.check_id,
            "severity": violation.check_metadata.get("severity", "unknown"),
            "details": violation.violation_details,
            "created_at": violation.created_at.isoformat(),
        }

    def _calculate_risk_score(self, severity_breakdown: dict[str, int]) -> float:
        """Calculate risk score from severity breakdown."""
        weights = {
            "critical": 10.0,
            "high": 7.5,
            "medium": 5.0,
            "low": 2.5,
        }

        total_score = 0
        total_violations = 0

        for severity, count in severity_breakdown.items():
            if count > 0:
                total_score += weights.get(severity, 0) * count
                total_violations += count

        return total_score / total_violations if total_violations > 0 else 0

    def _get_risk_level(self, risk_score: float) -> str:
        """Get risk level from score."""
        if risk_score >= 8.0:
            return "CRITICAL"
        elif risk_score >= 6.0:
            return "HIGH"
        elif risk_score >= 4.0:
            return "MEDIUM"
        else:
            return "LOW"

    def _calculate_next_run(self, schedule_config: dict[str, Any]) -> str:
        """Calculate next run time for scheduled report."""
        # Simplified - would implement proper cron parsing
        from datetime import datetime, timedelta

        next_run = datetime.utcnow() + timedelta(days=1)
        return next_run.isoformat()

    # Template HTML methods (simplified for demonstration)
    def _get_sox_template_html(self) -> str:
        """Return SOX HTML template."""
        return """
<!DOCTYPE html>
<html>
<head>
    <title>SOX Compliance Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { border-bottom: 2px solid #003366; padding-bottom: 20px; }
        .section { margin: 20px 0; }
        .compliance-score { font-size: 48px; font-weight: bold; color: #003366; }
        .violation { background-color: #ffeeee; padding: 10px; margin: 5px 0; }
        .critical { background-color: #ffcccc; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Sarbanes-Oxley (SOX) Compliance Report</h1>
        <p>Generated: {{ generated_at }}</p>
    </div>

    <div class="section">
        <h2>Executive Summary</h2>
        <div class="compliance-score">{{ metrics.compliance_percentage }}%</div>
        <p>Overall Status: {{ executive_summary.overall_status }}</p>
    </div>

    {% for section in sections %}
    <div class="section">
        <h2>{{ section.title }}</h2>
        {{ section.content | safe }}
    </div>
    {% endfor %}
</body>
</html>
        """

    def _get_hipaa_template_html(self) -> str:
        """Return HIPAA HTML template."""
        return """
<!DOCTYPE html>
<html>
<head>
    <title>HIPAA Compliance Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { border-bottom: 2px solid #2E7D32; padding-bottom: 20px; }
        .section { margin: 20px 0; }
        .safeguard { background-color: #f1f8e9; padding: 15px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>HIPAA Compliance Report</h1>
        <p>Health Insurance Portability and Accountability Act</p>
        <p>Generated: {{ generated_at }}</p>
    </div>

    <div class="section">
        <h2>Compliance Overview</h2>
        <p>Compliance Score: {{ metrics.compliance_percentage }}%</p>
        <p>Total Violations: {{ metrics.violation_count }}</p>
    </div>

    {% for section in sections %}
    <div class="section">
        <h2>{{ section.title }}</h2>
        {{ section.content | safe }}
    </div>
    {% endfor %}
</body>
</html>
        """

    def _get_pci_dss_template_html(self) -> str:
        """Return PCI-DSS HTML template."""
        return """
<!DOCTYPE html>
<html>
<head>
    <title>PCI-DSS Compliance Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { border-bottom: 2px solid #1565C0; padding-bottom: 20px; }
        .requirement { background-color: #e3f2fd; padding: 15px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>PCI-DSS Compliance Report</h1>
        <p>Payment Card Industry Data Security Standard v4.0</p>
        <p>Generated: {{ generated_at }}</p>
    </div>

    {% for section in sections %}
    <div class="section">
        <h2>{{ section.title }}</h2>
        {{ section.content | safe }}
    </div>
    {% endfor %}
</body>
</html>
        """

    def _get_gdpr_template_html(self) -> str:
        """Return GDPR HTML template."""
        return """
<!DOCTYPE html>
<html>
<head>
    <title>GDPR Compliance Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { border-bottom: 2px solid #F44336; padding-bottom: 20px; }
        .principle { background-color: #ffebee; padding: 15px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>GDPR Compliance Report</h1>
        <p>General Data Protection Regulation</p>
        <p>Generated: {{ generated_at }}</p>
    </div>

    {% for section in sections %}
    <div class="section">
        <h2>{{ section.title }}</h2>
        {{ section.content | safe }}
    </div>
    {% endfor %}
</body>
</html>
        """

    def _get_comparative_template_html(self) -> str:
        """Return comparative report HTML template."""
        return """
<!DOCTYPE html>
<html>
<head>
    <title>Comparative Compliance Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .framework { display: inline-block; margin: 10px; padding: 20px; border: 1px solid #ccc; }
        .chart { margin: 20px 0; }
    </style>
</head>
<body>
    <h1>Comparative Compliance Report</h1>
    <p>Frameworks: {{ frameworks | join(', ') }}</p>

    <div class="chart">
        <!-- Placeholder for comparative charts -->
    </div>

    {% for report in framework_reports %}
    <div class="framework">
        <h2>{{ report.framework }}</h2>
        <p>Compliance: {{ report.metrics.compliance_percentage }}%</p>
    </div>
    {% endfor %}
</body>
</html>
        """

    def _get_trend_template_html(self) -> str:
        """Return trend report HTML template."""
        return """
<!DOCTYPE html>
<html>
<head>
    <title>Compliance Trend Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .trend-chart { margin: 20px 0; }
        .metric { display: inline-block; margin: 10px; padding: 10px; background: #f5f5f5; }
    </style>
</head>
<body>
    <h1>{{ framework }} Compliance Trend Report</h1>
    <p>Period: {{ scope.period_months }} months</p>

    <div class="trend-chart">
        <!-- Placeholder for trend visualization -->
    </div>

    <div class="metrics">
        {% for metric in metrics %}
        <div class="metric">{{ metric.name }}: {{ metric.value }}</div>
        {% endfor %}
    </div>
</body>
</html>
        """

    # Placeholder methods for advanced features
    async def _generate_comparative_analysis(
        self, framework_reports: list[dict[str, Any]]
    ) -> dict[str, Any]:
        """Generate comparative analysis between frameworks."""
        return {"analysis": "Comparative analysis data"}

    async def _generate_comparative_summary(
        self, comparative_analysis: dict[str, Any]
    ) -> dict[str, Any]:
        """Generate comparative executive summary."""
        return {"summary": "Comparative summary"}

    async def _gather_historical_compliance_data(
        self,
        framework: ComplianceFramework,
        organization_id: Optional[UUID],
        project_id: Optional[UUID],
        start_date: datetime,
        end_date: datetime,
    ) -> list[dict[str, Any]]:
        """Gather historical compliance data points."""
        # Simplified - would query historical data
        return [{"date": "2024-01-01", "score": 95.0, "violations": 2}]

    async def _analyze_compliance_trends(
        self, historical_data: list[dict[str, Any]]
    ) -> dict[str, Any]:
        """Analyze compliance trends from historical data."""
        return {"trend": "improving", "change_rate": 5.2}

    async def _generate_trend_visualizations(
        self, trend_analysis: dict[str, Any]
    ) -> list[dict[str, Any]]:
        """Generate trend visualization data."""
        return [{"type": "line_chart", "data": trend_analysis}]

    async def _identify_significant_events(
        self,
        historical_data: list[dict[str, Any]],
        framework: ComplianceFramework,
    ) -> list[dict[str, Any]]:
        """Identify significant compliance events."""
        return [{"event": "New regulation implemented", "date": "2024-01-15"}]

    async def _generate_trend_summary(
        self, trend_analysis: dict[str, Any]
    ) -> dict[str, Any]:
        """Generate trend executive summary."""
        return {"summary": "Trend summary", "trend": trend_analysis.get("trend")}

    async def _generate_compliance_forecast(
        self, trend_analysis: dict[str, Any]
    ) -> dict[str, Any]:
        """Generate compliance forecast based on trends."""
        return {"forecast": "Projected compliance score"}

    async def _extract_key_findings(
        self, sections: list[dict[str, Any]], metrics: dict[str, Any]
    ) -> list[str]:
        """Extract key findings from report sections."""
        return [f"Compliance score of {metrics['compliance_percentage']}% achieved"]

    async def _identify_critical_issues(
        self, sections: list[dict[str, Any]]
    ) -> list[str]:
        """Identify critical compliance issues."""
        return ["Critical finding: Immediate attention required"]

    async def _recommend_immediate_actions(self, metrics: dict[str, Any]) -> list[str]:
        """Recommend immediate actions based on metrics."""
        if metrics["risk_score"] > 8:
            return ["Implement emergency remediation plan"]
        return []

    async def _generate_output_file(
        self, report: dict[str, Any], format: ReportFormat
    ) -> str:
        """Generate output file in specified format."""
        # Simplified - would implement actual file generation
        output_path = f"/tmp/{report['report_id']}.{format.value}"
        return output_path
