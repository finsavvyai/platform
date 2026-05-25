"""
Compliance Service for Enterprise Framework Integration.

Provides comprehensive compliance management with support for SOX, HIPAA,
PCI-DSS, GDPR, and custom compliance frameworks. Includes automated
assessments, violation tracking, and remediation workflows.
"""

import logging
from datetime import datetime, timedelta
from typing import Any, Optional
from uuid import UUID, uuid4

from sqlalchemy import and_, desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.exceptions import ComplianceError, ValidationError
from ..core.models.compliance import (
    ComplianceCheck as DBComplianceCheck,
)
from ..core.models.compliance import (
    ComplianceReport as DBComplianceReport,
)
from ..core.models.compliance import (
    ComplianceStatus,
)
from ..core.models.dependencies import Dependency
from ..core.models.organizations import Organization
from ..core.models.projects import Project
from ..security.compliance_framework_registry import (
    ComplianceFramework,
    ComplianceFrameworkRegistry,
    ComplianceRule,
    ComplianceValidationResult,
    ComplianceViolation,
    SecurityLevel,
)
from ..security.compliance_framework_registry import (
    ComplianceStatus as FrameworkComplianceStatus,
)

logger = logging.getLogger(__name__)


class ComplianceService:
    """
    Enterprise compliance management service.

    Integrates with compliance framework registry to provide:
    - Automated compliance assessments
    - Violation detection and tracking
    - Remediation workflow management
    - Compliance reporting and analytics
    - Custom compliance framework support
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.framework_registry = ComplianceFrameworkRegistry()
        self._cache = {}  # Simple in-memory cache for compliance results
        logger.info("Compliance Service initialized")

    async def assess_package_compliance(
        self,
        package_id: UUID,
        frameworks: Optional[list[ComplianceFramework]] = None,
        force_reassessment: bool = False,
    ) -> dict[str, Any]:
        """
        Assess package compliance against specified frameworks.

        Args:
            package_id: Package to assess
            frameworks: Frameworks to assess against (default: all supported)
            force_reassessment: Force new assessment even if cached

        Returns:
            Comprehensive compliance assessment results
        """
        try:
            logger.info(f"Starting compliance assessment for package {package_id}")

            # Get package data
            package_data = await self._get_package_assessment_data(package_id)

            # Determine frameworks to assess
            if not frameworks:
                frameworks = self.framework_registry.get_supported_frameworks()

            # Check cache first
            cache_key = f"package:{package_id}:{':'.join(f.value for f in frameworks)}"
            if not force_reassessment and cache_key in self._cache:
                cached_result = self._cache[cache_key]
                if datetime.utcnow() - cached_result["assessed_at"] < timedelta(
                    hours=1
                ):
                    logger.info(
                        f"Using cached compliance result for package {package_id}"
                    )
                    return cached_result

            # Validate against frameworks
            validation_results = self.framework_registry.validate_package_compliance(
                package_data, frameworks
            )

            # Detect violations
            violations = self.framework_registry.detect_violations(
                package_data, frameworks
            )

            # Store compliance checks in database
            await self._store_compliance_checks(
                package_id, validation_results, violations
            )

            # Calculate overall metrics
            total_violations = sum(len(v) for v in validation_results.values())
            critical_violations = sum(
                1 for v in violations if v.severity == SecurityLevel.CRITICAL
            )

            # Create assessment result
            assessment_result = {
                "package_id": str(package_id),
                "package_name": package_data.get("name", "Unknown"),
                "assessed_at": datetime.utcnow(),
                "frameworks_assessed": [f.value for f in frameworks],
                "total_violations": total_violations,
                "critical_violations": critical_violations,
                "is_compliant": total_violations == 0,
                "framework_results": {},
                "violations": [],
                "recommendations": [],
                "risk_score": 0.0,
            }

            # Process framework results
            for framework, violations in validation_results.items():
                assessment_result["framework_results"][framework.value] = {
                    "violations": len(violations),
                    "is_compliant": len(violations) == 0,
                    "violations_detail": [
                        {
                            "rule_id": v.rule_id,
                            "title": v.title,
                            "severity": v.severity.value,
                            "description": v.description,
                        }
                        for v in violations
                    ],
                }

                # Collect violations
                for violation in violations:
                    assessment_result["violations"].append(
                        {
                            "framework": framework.value,
                            "rule_id": violation.rule_id,
                            "title": violation.title,
                            "severity": violation.severity.value,
                            "description": violation.description,
                            "affected_packages": violation.affected_packages,
                            "detected_at": violation.detected_at.isoformat(),
                        }
                    )

            # Generate recommendations based on violations
            assessment_result["recommendations"] = (
                self._generate_package_recommendations(violations, frameworks)
            )

            # Calculate risk score
            assessment_result["risk_score"] = self._calculate_package_risk_score(
                violations
            )

            # Cache result
            self._cache[cache_key] = assessment_result

            logger.info(
                f"Package compliance assessment completed: {total_violations} violations"
            )
            return assessment_result

        except Exception as e:
            logger.error(f"Failed to assess package compliance: {e}", exc_info=True)
            raise ComplianceError(f"Package compliance assessment failed: {str(e)}")

    async def assess_project_compliance(
        self,
        project_id: UUID,
        frameworks: Optional[list[ComplianceFramework]] = None,
        force_reassessment: bool = False,
    ) -> dict[str, Any]:
        """
        Assess project compliance across all dependencies.

        Args:
            project_id: Project to assess
            frameworks: Frameworks to assess against
            force_reassessment: Force new assessment

        Returns:
            Comprehensive project compliance assessment
        """
        try:
            logger.info(f"Starting project compliance assessment for {project_id}")

            # Get project and organization data
            project = await self.db.get(Project, project_id)
            if not project:
                raise ValidationError(f"Project {project_id} not found")

            org_data = await self._get_organization_assessment_data(
                project.organization_id
            )

            # Determine frameworks to assess
            if not frameworks:
                frameworks = self.framework_registry.get_supported_frameworks()

            # Validate organization compliance
            org_validation_results = (
                self.framework_registry.validate_organization_compliance(
                    org_data, frameworks
                )
            )

            # Get all project dependencies
            dependencies_query = select(Dependency).where(
                Dependency.project_id == project_id
            )
            dependencies_result = await self.db.execute(dependencies_query)
            dependencies = dependencies_result.scalars().all()

            # Assess each dependency
            dependency_assessments = []
            total_violations = 0
            critical_violations = 0

            for dependency in dependencies:
                package_assessment = await self.assess_package_compliance(
                    dependency.package_id, frameworks, force_reassessment
                )
                dependency_assessments.append(
                    {
                        "dependency_id": str(dependency.id),
                        "package_name": dependency.package_id,
                        "version_constraint": dependency.version_constraint,
                        "assessment": package_assessment,
                    }
                )

                total_violations += package_assessment["total_violations"]
                critical_violations += package_assessment["critical_violations"]

            # Generate project compliance report
            project_assessment = {
                "project_id": str(project_id),
                "project_name": project.name,
                "organization_id": str(project.organization_id),
                "assessed_at": datetime.utcnow(),
                "frameworks_assessed": [f.value for f in frameworks],
                "total_dependencies": len(dependencies),
                "total_violations": total_violations,
                "critical_violations": critical_violations,
                "is_compliant": total_violations == 0,
                "dependency_assessments": dependency_assessments,
                "organization_compliance": {},
                "overall_risk_score": 0.0,
                "recommendations": [],
            }

            # Process organization compliance results
            for framework, result in org_validation_results.items():
                project_assessment["organization_compliance"][framework.value] = {
                    "status": result.overall_status.value,
                    "compliance_percentage": result.compliance_percentage,
                    "violations": len(result.violations),
                    "risk_score": result.risk_score,
                }

            # Calculate overall risk score
            project_assessment["overall_risk_score"] = (
                self._calculate_project_risk_score(
                    dependency_assessments, org_validation_results
                )
            )

            # Generate project-specific recommendations
            project_assessment["recommendations"] = (
                self._generate_project_recommendations(
                    dependency_assessments, org_validation_results
                )
            )

            # Store compliance report
            await self._store_compliance_report(project_id, project_assessment)

            logger.info(
                f"Project compliance assessment completed: {total_violations} violations"
            )
            return project_assessment

        except Exception as e:
            logger.error(f"Failed to assess project compliance: {e}", exc_info=True)
            raise ComplianceError(f"Project compliance assessment failed: {str(e)}")

    async def get_compliance_dashboard(
        self,
        organization_id: UUID,
        timeframe: int = 30,  # days
    ) -> dict[str, Any]:
        """
        Generate comprehensive compliance dashboard for organization.

        Args:
            organization_id: Organization to generate dashboard for
            timeframe: Timeframe in days for trend analysis

        Returns:
            Compliance dashboard with metrics and trends
        """
        try:
            logger.info(
                f"Generating compliance dashboard for organization {organization_id}"
            )

            # Get organization projects
            projects_query = select(Project).where(
                Project.organization_id == organization_id
            )
            projects_result = await self.db.execute(projects_query)
            projects = projects_result.scalars().all()

            # Initialize dashboard data
            dashboard = {
                "organization_id": str(organization_id),
                "generated_at": datetime.utcnow(),
                "timeframe_days": timeframe,
                "summary": {
                    "total_projects": len(projects),
                    "compliant_projects": 0,
                    "non_compliant_projects": 0,
                    "total_violations": 0,
                    "critical_violations": 0,
                    "high_violations": 0,
                    "medium_violations": 0,
                    "low_violations": 0,
                    "overall_compliance_percentage": 0.0,
                    "average_risk_score": 0.0,
                },
                "framework_compliance": {},
                "violation_trends": {},
                "top_violations": [],
                "recent_assessments": [],
                "recommendations": [],
            }

            # Process each project
            total_risk_score = 0.0
            framework_scores = {}

            for project in projects:
                # Get latest compliance report
                report_query = (
                    select(DBComplianceReport)
                    .where(
                        and_(
                            DBComplianceReport.project_id == project.id,
                            DBComplianceReport.created_at
                            >= datetime.utcnow() - timedelta(days=timeframe),
                        )
                    )
                    .order_by(desc(DBComplianceReport.created_at))
                    .limit(1)
                )

                report_result = await self.db.execute(report_query)
                report = report_result.scalar_one_or_none()

                if report:
                    # Update summary metrics
                    if report.compliance_score >= 95:
                        dashboard["summary"]["compliant_projects"] += 1
                    else:
                        dashboard["summary"]["non_compliant_projects"] += 1

                    dashboard["summary"]["total_violations"] += (
                        report.non_compliant_checks
                    )
                    total_risk_score += report.compliance_score

                    # Add to recent assessments
                    dashboard["recent_assessments"].append(
                        {
                            "project_id": str(project.id),
                            "project_name": project.name,
                            "assessed_at": report.created_at.isoformat(),
                            "compliance_score": report.compliance_score,
                            "violations": report.non_compliant_checks,
                        }
                    )

            # Calculate percentages and averages
            if dashboard["summary"]["total_projects"] > 0:
                dashboard["summary"]["overall_compliance_percentage"] = (
                    dashboard["summary"]["compliant_projects"]
                    / dashboard["summary"]["total_projects"]
                    * 100
                )
                dashboard["summary"]["average_risk_score"] = (
                    total_risk_score / dashboard["summary"]["total_projects"]
                )

            # Get framework-specific compliance
            frameworks = self.framework_registry.get_supported_frameworks()
            for framework in frameworks:
                # This is simplified - in production, would query from compliance checks table
                framework_assessments = await self._get_framework_compliance(
                    organization_id, framework, timeframe
                )

                if framework_assessments:
                    avg_compliance = sum(
                        a["compliance_percentage"] for a in framework_assessments
                    ) / len(framework_assessments)
                    dashboard["framework_compliance"][framework.value] = {
                        "average_compliance": avg_compliance,
                        "total_assessments": len(framework_assessments),
                        "compliant_assessments": sum(
                            1
                            for a in framework_assessments
                            if a["compliance_percentage"] >= 90
                        ),
                        "status": "compliant"
                        if avg_compliance >= 90
                        else "non_compliant",
                    }

            # Generate recommendations
            dashboard["recommendations"] = self._generate_dashboard_recommendations(
                dashboard
            )

            logger.info("Compliance dashboard generated successfully")
            return dashboard

        except Exception as e:
            logger.error(f"Failed to generate compliance dashboard: {e}", exc_info=True)
            raise ComplianceError(f"Dashboard generation failed: {str(e)}")

    async def create_custom_framework(
        self, organization_id: UUID, framework_name: str, rules: list[dict[str, Any]]
    ) -> dict[str, Any]:
        """
        Create custom compliance framework for organization.

        Args:
            organization_id: Organization creating the framework
            framework_name: Name of the custom framework
            rules: List of compliance rules

        Returns:
            Created framework details
        """
        try:
            logger.info(
                f"Creating custom framework {framework_name} for organization {organization_id}"
            )

            # Validate rules
            for rule in rules:
                if not all(
                    key in rule
                    for key in ["title", "description", "severity", "conditions"]
                ):
                    raise ValidationError(
                        "Rule must include title, description, severity, and conditions"
                    )

            # Create custom framework rules
            custom_rules = []
            for i, rule in enumerate(rules):
                custom_rule = ComplianceRule(
                    rule_id=f"CUSTOM-{framework_name.upper()}-{i + 1:03d}",
                    framework=ComplianceFramework.CUSTOM,
                    rule_type=RuleType.PACKAGE_RESTICTION,  # Default type
                    title=rule["title"],
                    description=rule["description"],
                    severity=SecurityLevel(rule["severity"]),
                    category="Custom",
                    conditions=rule["conditions"],
                    regulatory_reference=f"Custom Framework: {framework_name}",
                    control_objective=rule.get("control_objective", ""),
                    evidence_requirements=rule.get("evidence_requirements", []),
                    testing_procedures=rule.get("testing_procedures", []),
                )
                custom_rules.append(custom_rule)

            # Store custom rules in database
            # In a full implementation, would have a custom_frameworks table
            # For now, store in a metadata field
            framework_data = {
                "organization_id": str(organization_id),
                "framework_name": framework_name,
                "rules": [rule.dict() for rule in custom_rules],
                "created_at": datetime.utcnow().isoformat(),
            }

            # Store in organization settings or separate table
            org = await self.db.get(Organization, organization_id)
            if not org:
                raise ValidationError(f"Organization {organization_id} not found")

            # Update organization metadata with custom framework
            if not org.settings:
                org.settings = {}
            if "custom_frameworks" not in org.settings:
                org.settings["custom_frameworks"] = []

            org.settings["custom_frameworks"].append(framework_data)
            await self.db.commit()

            logger.info(f"Custom framework {framework_name} created successfully")
            return {
                "framework_name": framework_name,
                "organization_id": str(organization_id),
                "total_rules": len(custom_rules),
                "rules": [
                    {
                        "rule_id": rule.rule_id,
                        "title": rule.title,
                        "description": rule.description,
                        "severity": rule.severity.value,
                        "category": rule.category,
                    }
                    for rule in custom_rules
                ],
                "created_at": framework_data["created_at"],
            }

        except Exception as e:
            logger.error(f"Failed to create custom framework: {e}", exc_info=True)
            await self.db.rollback()
            raise ComplianceError(f"Custom framework creation failed: {str(e)}")

    async def track_violation_remediation(
        self,
        violation_id: str,
        remediation_status: str,
        notes: Optional[str] = None,
        assigned_to: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        Track remediation progress for compliance violation.

        Args:
            violation_id: Violation to track
            remediation_status: New remediation status
            notes: Optional remediation notes
            assigned_to: Optional assignee

        Returns:
            Updated violation tracking information
        """
        try:
            logger.info(f"Tracking remediation for violation {violation_id}")

            # Find the violation in database
            check_query = select(DBComplianceCheck).where(
                DBComplianceCheck.check_metadata.contains(
                    {"violation_id": violation_id}
                )
            )
            check_result = await self.db.execute(check_query)
            check = check_result.scalar_one_or_none()

            if not check:
                raise ValidationError(f"Violation {violation_id} not found")

            # Update violation metadata
            if not check.check_metadata:
                check.check_metadata = {}

            violation_metadata = check.check_metadata.get("violation_tracking", {})
            violation_metadata.update(
                {
                    "remediation_status": remediation_status,
                    "notes": notes,
                    "assigned_to": assigned_to,
                    "updated_at": datetime.utcnow().isoformat(),
                }
            )

            check.check_metadata["violation_tracking"] = violation_metadata

            # Update compliance check status if fully remediated
            if remediation_status == "resolved":
                check.status = ComplianceStatus.COMPLIANT
                check.violation_count = 0

            await self.db.commit()

            return {
                "violation_id": violation_id,
                "remediation_status": remediation_status,
                "updated_at": violation_metadata["updated_at"],
                "check_id": str(check.id),
                "is_resolved": remediation_status == "resolved",
            }

        except Exception as e:
            logger.error(f"Failed to track violation remediation: {e}", exc_info=True)
            await self.db.rollback()
            raise ComplianceError(f"Violation tracking failed: {str(e)}")

    async def _get_package_assessment_data(self, package_id: UUID) -> dict[str, Any]:
        """Get package data for compliance assessment."""
        # This is simplified - would query actual package data
        return {
            "package_id": str(package_id),
            "name": "example-package",
            "version": "1.0.0",
            "organization_id": uuid4(),
            "processes_personal_data": False,
            "handles_phi": False,
            "handles_cardholder_data": False,
            "affects_financial_reporting": False,
            "has_approval": True,
            "has_documentation": True,
            "critical_vulnerabilities": 0,
            "high_vulnerabilities": 0,
            "supports_encryption": True,
            "has_security_measures": True,
        }

    async def _get_organization_assessment_data(
        self, organization_id: UUID
    ) -> dict[str, Any]:
        """Get organization data for compliance assessment."""
        # This is simplified - would query actual organization data
        return {
            "organization_id": organization_id,
            "privileged_users_count": 3,
            "mfa_enabled": True,
            "workforce_training_completed": True,
            "encryption_implemented": True,
            "dpo_appointed": True,
            "privacy_notices_updated": True,
            "breach_procedures": True,
        }

    async def _store_compliance_checks(
        self,
        package_id: UUID,
        validation_results: dict[ComplianceFramework, list[ComplianceViolation]],
        violations: list[ComplianceViolation],
    ) -> None:
        """Store compliance check results in database."""
        try:
            for framework, framework_violations in validation_results.items():
                for violation in framework_violations:
                    check = DBComplianceCheck(
                        check_id=f"{package_id}-{framework.value}-{violation.rule_id}",
                        rule_id=violation.rule_id,
                        target_type="package",
                        target_id=package_id,
                        target_name=violation.affected_packages[0]
                        if violation.affected_packages
                        else "unknown",
                        status=ComplianceStatus.NON_COMPLIANT,
                        violation_details=[
                            {
                                "type": violation.violation_type,
                                "details": violation.description,
                                "timestamp": violation.detected_at.isoformat(),
                            }
                        ],
                        violation_count=1,
                        context={"framework": framework.value},
                        check_metadata={
                            "violation_id": str(violation.violation_id),
                            "severity": violation.severity.value,
                            "affected_resources": violation.affected_resources,
                        },
                    )
                    self.db.add(check)

            await self.db.commit()

        except Exception as e:
            logger.error(f"Failed to store compliance checks: {e}")
            await self.db.rollback()

    async def _store_compliance_report(
        self, project_id: UUID, assessment_result: dict[str, Any]
    ) -> None:
        """Store comprehensive compliance report."""
        try:
            report = DBComplianceReport(
                report_id=f"project-{project_id}-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
                report_type="comprehensive",
                project_id=project_id,
                total_checks=assessment_result["total_dependencies"],
                compliant_checks=sum(
                    1
                    for d in assessment_result["dependency_assessments"]
                    if d["assessment"]["is_compliant"]
                ),
                non_compliant_checks=sum(
                    1
                    for d in assessment_result["dependency_assessments"]
                    if not d["assessment"]["is_compliant"]
                ),
                compliance_score=100
                if assessment_result["is_compliant"]
                else max(0, 100 - (assessment_result["total_violations"] * 10)),
                report_data=assessment_result,
                generated_at=datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
            )

            self.db.add(report)
            await self.db.commit()

        except Exception as e:
            logger.error(f"Failed to store compliance report: {e}")
            await self.db.rollback()

    def _generate_package_recommendations(
        self,
        violations: list[ComplianceViolation],
        frameworks: list[ComplianceFramework],
    ) -> list[str]:
        """Generate package-specific compliance recommendations."""
        recommendations = []

        # Framework-specific recommendations
        for framework in frameworks:
            handler = self.framework_registry.get_framework_handler(framework)
            if handler and hasattr(handler, "_generate_recommendations"):
                framework_violations = [
                    v for v in violations if v.framework == framework
                ]
                if framework_violations:
                    framework_recs = handler._generate_recommendations(
                        framework_violations
                    )
                    recommendations.extend(framework_recs)

        # General recommendations
        if any(v.severity == SecurityLevel.CRITICAL for v in violations):
            recommendations.append("Address critical compliance violations immediately")

        if any(v.severity == SecurityLevel.HIGH for v in violations):
            recommendations.append(
                "Develop remediation plan for high-severity violations within 30 days"
            )

        # Remove duplicates
        return list(set(recommendations))

    def _generate_project_recommendations(
        self,
        dependency_assessments: list[dict[str, Any]],
        org_validation_results: dict[ComplianceFramework, ComplianceValidationResult],
    ) -> list[str]:
        """Generate project-specific compliance recommendations."""
        recommendations = []

        # Dependency-specific recommendations
        critical_dependencies = [
            d
            for d in dependency_assessments
            if d["assessment"]["critical_violations"] > 0
        ]

        if critical_dependencies:
            recommendations.append(
                f"Address {len(critical_dependencies)} dependencies with critical violations"
            )
            recommendations.append(
                "Consider replacing non-compliant dependencies with compliant alternatives"
            )

        # Organization-level recommendations
        for framework, result in org_validation_results.items():
            if result.overall_status != FrameworkComplianceStatus.COMPLIANT:
                recommendations.extend(result.recommendations)

        return list(set(recommendations))

    def _generate_dashboard_recommendations(
        self, dashboard: dict[str, Any]
    ) -> list[str]:
        """Generate dashboard-level recommendations."""
        recommendations = []

        summary = dashboard["summary"]

        if summary["critical_violations"] > 0:
            recommendations.append(
                f"Address {summary['critical_violations']} critical violations immediately"
            )

        if summary["overall_compliance_percentage"] < 80:
            recommendations.append(
                "Implement comprehensive compliance improvement program"
            )

        non_compliant_ratio = summary["non_compliant_projects"] / max(
            1, summary["total_projects"]
        )
        if non_compliant_ratio > 0.5:
            recommendations.append(
                "More than 50% of projects are non-compliant - require immediate action"
            )

        # Framework-specific recommendations
        for framework, data in dashboard["framework_compliance"].items():
            if data["status"] == "non_compliant":
                recommendations.append(
                    f"Improve {framework} compliance framework implementation"
                )

        return list(set(recommendations))

    def _calculate_package_risk_score(
        self, violations: list[ComplianceViolation]
    ) -> float:
        """Calculate risk score for package based on violations."""
        if not violations:
            return 0.0

        severity_weights = {
            SecurityLevel.CRITICAL: 10.0,
            SecurityLevel.HIGH: 7.5,
            SecurityLevel.MEDIUM: 5.0,
            SecurityLevel.LOW: 2.5,
        }

        total_score = sum(severity_weights.get(v.severity, 0.0) for v in violations)
        return min(10.0, total_score / len(violations))

    def _calculate_project_risk_score(
        self,
        dependency_assessments: list[dict[str, Any]],
        org_validation_results: dict[ComplianceFramework, ComplianceValidationResult],
    ) -> float:
        """Calculate overall project risk score."""
        if not dependency_assessments:
            return 0.0

        # Weight dependency risk higher than organizational risk
        dependency_scores = [
            d["assessment"]["risk_score"] for d in dependency_assessments
        ]
        avg_dependency_risk = sum(dependency_scores) / len(dependency_scores)

        org_scores = [result.risk_score for result in org_validation_results.values()]
        avg_org_risk = sum(org_scores) / len(org_scores) if org_scores else 0.0

        # Weight: 70% dependencies, 30% organization
        return (avg_dependency_risk * 0.7) + (avg_org_risk * 0.3)

    async def _get_framework_compliance(
        self, organization_id: UUID, framework: ComplianceFramework, timeframe: int
    ) -> list[dict[str, Any]]:
        """Get framework-specific compliance assessments."""
        # This is simplified - would query from compliance checks table
        # For demonstration, return mock data
        return [
            {
                "assessment_id": str(uuid4()),
                "compliance_percentage": 95.0,
                "violations": 2,
                "assessed_at": datetime.utcnow() - timedelta(days=5),
            }
        ]
