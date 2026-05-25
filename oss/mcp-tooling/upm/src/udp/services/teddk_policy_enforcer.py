"""
Security Policy Enforcement Service for TEDDK Project.

Applies security and compliance policies to vulnerability scan results,
generating policy violation reports and enforcement recommendations.
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession
from udp.services.policy_service import (
    PolicyService,
)

logger = logging.getLogger(__name__)


class ViolationSeverity(str, Enum):
    """Severity levels for policy violations."""

    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class EnforcementAction(str, Enum):
    """Actions to take on policy violations."""

    BLOCK = "block"  # Prevent usage
    WARN = "warn"  # Warning only
    REQUIRE_APPROVAL = "require_approval"  # Needs manual approval
    QUARANTINE = "quarantine"  # Isolate for review
    MONITOR = "monitor"  # Track but allow


@dataclass
class PolicyViolation:
    """A detected policy violation."""

    id: str = field(default_factory=lambda: str(uuid4()))
    policy_name: str = ""
    policy_type: str = ""
    severity: ViolationSeverity = ViolationSeverity.MEDIUM
    package_name: str = ""
    package_version: str = ""
    ecosystem: str = ""
    vulnerability_id: Optional[str] = None
    description: str = ""
    details: dict[str, Any] = field(default_factory=dict)
    recommended_action: EnforcementAction = EnforcementAction.WARN
    remediation: str = ""
    detected_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())


@dataclass
class PolicyEnforcementReport:
    """Report of policy enforcement for a project."""

    project_id: str = ""
    scan_id: str = ""
    evaluated_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    total_policies_evaluated: int = 0
    total_violations: int = 0
    critical_violations: int = 0
    high_violations: int = 0
    medium_violations: int = 0
    low_violations: int = 0
    violations: list[PolicyViolation] = field(default_factory=list)
    blocked_packages: list[str] = field(default_factory=list)
    requires_approval: list[str] = field(default_factory=list)
    compliance_score: float = 100.0
    recommendations: list[str] = field(default_factory=list)

    @property
    def is_compliant(self) -> bool:
        return self.total_violations == 0


class TEDDKPolicyEnforcer:
    """
    Policy enforcement service for TEDDK project security scans.

    Evaluates security scan results against defined policies and
    generates enforcement actions and compliance reports.
    """

    # ── Default TEDDK Security Policies ────────────────────────────

    DEFAULT_POLICIES = {
        "no_critical_vulnerabilities": {
            "name": "No Critical Vulnerabilities",
            "type": "security",
            "description": "Prevents dependencies with critical severity vulnerabilities",
            "conditions": [
                {
                    "field": "vulnerability.max_severity",
                    "operator": "equals",
                    "value": "critical",
                }
            ],
            "action": "block",
            "severity": "critical",
        },
        "no_high_vulnerabilities": {
            "name": "Limit High Vulnerabilities",
            "type": "security",
            "description": "Limits number of high severity vulnerabilities per package",
            "conditions": [
                {
                    "field": "vulnerability.high_count",
                    "operator": "greater_equal",
                    "value": 3,
                }
            ],
            "action": "require_approval",
            "severity": "high",
        },
        "no_unmaintained_packages": {
            "name": "No Unmaintained Packages",
            "type": "maintenance",
            "description": "Blocks packages without updates in the last 2 years",
            "conditions": [
                {
                    "field": "package.last_updated_days",
                    "operator": "greater_equal",
                    "value": 730,  # 2 years
                }
            ],
            "action": "warn",
            "severity": "medium",
        },
        "no_log4j_v2": {
            "name": "Block Legacy Log4j 2.x Versions",
            "type": "security",
            "description": "Blocks log4j-core versions before 2.17.1 (Log4Shell vulnerability)",
            "conditions": [
                {
                    "field": "package.name",
                    "operator": "equals",
                    "value": "log4j-core",
                },
                {
                    "field": "package.version",
                    "operator": "matches",
                    "value": r"^2\.(0|[1-9]\d*|17\.0)$",  # Up to but not including 2.17.1
                },
            ],
            "action": "block",
            "severity": "critical",
        },
        "no_spring_vulnerabilities": {
            "name": "Spring Framework Security",
            "type": "security",
            "description": "Monitors Spring Framework for CVE-2022-22965 and related issues",
            "conditions": [
                {
                    "field": "vulnerability.id",
                    "operator": "in",
                    "value": ["CVE-2022-22965", "CVE-2022-22968", "CVE-2022-22963"],
                }
            ],
            "action": "require_approval",
            "severity": "high",
        },
        "license_compliance": {
            "name": "License Compliance",
            "type": "legal",
            "description": "Warns on GPL/AGPL licenses that require legal review",
            "conditions": [
                {
                    "field": "package.license",
                    "operator": "in",
                    "value": ["GPL-2.0", "GPL-3.0", "AGPL-3.0"],
                }
            ],
            "action": "require_approval",
            "severity": "medium",
        },
        "jackson_databind_security": {
            "name": "Jackson Databind Security",
            "type": "security",
            "description": "Monitors Jackson for known deserialization vulnerabilities",
            "conditions": [
                {
                    "field": "vulnerability.id",
                    "operator": "contains",
                    "value": "CVE-2019",  # Multiple 2019 CVEs
                }
            ],
            "action": "require_approval",
            "severity": "high",
        },
    }

    def __init__(self, db_session: Optional[AsyncSession] = None):
        self.db_session = db_session
        self.policy_service = PolicyService(db_session) if db_session else None
        self.custom_policies: dict[str, dict] = {}

    def add_custom_policy(self, policy_id: str, policy_config: dict) -> None:
        """Add a custom policy to the enforcer."""
        self.custom_policies[policy_id] = policy_config

    def enforce_policies_on_scan(
        self,
        scan_result: dict[str, Any],
        project_id: str = "",
        policy_ids: Optional[list[str]] = None,
    ) -> PolicyEnforcementReport:
        """
        Enforce policies against a vulnerability scan result.

        Args:
            scan_result: Result from TEDDK vulnerability scanner
            project_id: Project being scanned
            policy_ids: Specific policies to evaluate (default: all default policies)

        Returns:
            PolicyEnforcementReport with all violations and recommendations
        """
        logger.info(f"Enforcing policies on scan for project {project_id}")

        report = PolicyEnforcementReport(
            project_id=project_id,
            scan_id=scan_result.get("scan_id", ""),
        )

        # Get policies to evaluate
        policies_to_evaluate = self.DEFAULT_POLICIES.copy()
        policies_to_evaluate.update(self.custom_policies)

        if policy_ids:
            policies_to_evaluate = {
                pid: policies_to_evaluate[pid]
                for pid in policy_ids
                if pid in policies_to_evaluate
            }

        report.total_policies_evaluated = len(policies_to_evaluate)

        # Evaluate each package against policies
        for pkg in scan_result.get("packages", []):
            pkg_violations = self._evaluate_package(
                pkg, policies_to_evaluate, scan_result
            )
            report.violations.extend(pkg_violations)

        # Aggregate violation counts
        for v in report.violations:
            report.total_violations += 1
            if v.severity == ViolationSeverity.CRITICAL:
                report.critical_violations += 1
            elif v.severity == ViolationSeverity.HIGH:
                report.high_violations += 1
            elif v.severity == ViolationSeverity.MEDIUM:
                report.medium_violations += 1
            elif v.severity == ViolationSeverity.LOW:
                report.low_violations += 1

            # Track blocked and approval-required packages
            pkg_key = f"{v.package_name}:{v.package_version}"
            if v.recommended_action == EnforcementAction.BLOCK:
                if pkg_key not in report.blocked_packages:
                    report.blocked_packages.append(pkg_key)
            elif v.recommended_action == EnforcementAction.REQUIRE_APPROVAL:
                if pkg_key not in report.requires_approval:
                    report.requires_approval.append(pkg_key)

        # Calculate compliance score
        if report.total_violations > 0:
            score_deduction = (
                report.critical_violations * 25
                + report.high_violations * 10
                + report.medium_violations * 5
                + report.low_violations * 1
            )
            report.compliance_score = max(0, 100 - score_deduction)

        # Generate recommendations
        report.recommendations = self._generate_recommendations(report)

        logger.info(
            f"Policy enforcement complete: {report.total_violations} violations, "
            f"compliance score: {report.compliance_score:.1f}%"
        )

        return report

    def _evaluate_package(
        self,
        pkg: dict[str, Any],
        policies: dict[str, dict],
        scan_result: dict[str, Any],
    ) -> list[PolicyViolation]:
        """Evaluate a package against all policies."""
        violations = []

        group_id = pkg.get("group_id", "")
        artifact_id = pkg.get("artifact_id", "")
        version = pkg.get("version", "")
        package_name = f"{group_id}:{artifact_id}"

        # Build context for policy evaluation
        context = self._build_package_context(pkg, scan_result)

        for policy_id, policy_config in policies.items():
            policy_violations = self._evaluate_policy(
                policy_id, policy_config, package_name, version, context
            )
            violations.extend(policy_violations)

        return violations

    def _build_package_context(
        self, pkg: dict[str, Any], scan_result: dict[str, Any]
    ) -> dict[str, Any]:
        """Build evaluation context for a package."""
        vulns = pkg.get("vulnerabilities", [])

        # Find max severity
        severity_order = {"critical": 4, "high": 3, "medium": 2, "low": 1, "unknown": 0}
        max_severity = "unknown"
        max_score = 0
        for v in vulns:
            sev = v.get("severity", "unknown").lower()
            if severity_order.get(sev, 0) > severity_order.get(max_severity, 0):
                max_severity = sev
            if v.get("cvss_score", 0) > max_score:
                max_score = v.get("cvss_score", 0)

        # Count by severity
        severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        for v in vulns:
            sev = v.get("severity", "low").lower()
            if sev in severity_counts:
                severity_counts[sev] += 1

        return {
            "package": {
                "name": f"{pkg.get('group_id', '')}:{pkg.get('artifact_id', '')}",
                "version": pkg.get("version", ""),
                "artifact_id": pkg.get("artifact_id", ""),
                "last_updated_days": 0,  # Would fetch from registry
                "license": "Unknown",  # Would fetch from registry
            },
            "vulnerability": {
                "count": len(vulns),
                "max_severity": max_severity,
                "high_count": severity_counts["high"],
                "critical_count": severity_counts["critical"],
                "ids": [v.get("id", "") for v in vulns],
            },
        }

    def _evaluate_policy(
        self,
        policy_id: str,
        policy: dict[str, Any],
        package_name: str,
        version: str,
        context: dict[str, Any],
    ) -> list[PolicyViolation]:
        """Evaluate a single policy against the context."""
        violations = []

        # Check if conditions are met
        conditions_met = self._check_conditions(policy.get("conditions", []), context)

        if conditions_met:
            severity = ViolationSeverity(policy.get("severity", "medium"))
            action = EnforcementAction(policy.get("action", "warn"))

            violation = PolicyViolation(
                policy_name=policy.get("name", policy_id),
                policy_type=policy.get("type", "security"),
                severity=severity,
                package_name=package_name,
                package_version=version,
                ecosystem="maven",  # TEDDK is a Maven project
                description=policy.get("description", ""),
                details={
                    "policy_id": policy_id,
                    "triggered_conditions": policy.get("conditions", []),
                },
                recommended_action=action,
                remediation=self._get_remediation_for_policy(
                    policy_id, package_name, version
                ),
            )

            violations.append(violation)

        return violations

    def _check_conditions(
        self, conditions: list[dict], context: dict[str, Any]
    ) -> bool:
        """Check if all conditions are satisfied."""
        if not conditions:
            return False

        for condition in conditions:
            field = condition.get("field")
            operator = condition.get("operator", "eq")
            expected = condition.get("value")

            # Navigate nested fields
            value = self._get_nested_value(context, field)
            if not self._evaluate_condition(value, operator, expected):
                return False

        return True

    def _get_nested_value(self, data: dict, field: str) -> Any:
        """Get value from nested dict using dot notation."""
        parts = field.split(".")
        value = data
        for part in parts:
            if isinstance(value, dict):
                value = value.get(part)
            else:
                return None
        return value

    def _evaluate_condition(self, actual: Any, operator: str, expected: Any) -> bool:
        """Evaluate a single condition."""
        try:
            if operator == "equals":
                return str(actual).lower() == str(expected).lower()
            elif operator == "not_equals":
                return str(actual).lower() != str(expected).lower()
            elif operator == "greater_equal":
                return float(actual) >= float(expected)
            elif operator == "greater_than":
                return float(actual) > float(expected)
            elif operator == "less_equal":
                return float(actual) <= float(expected)
            elif operator == "less_than":
                return float(actual) < float(expected)
            elif operator == "contains":
                return str(expected).lower() in str(actual).lower()
            elif operator == "not_contains":
                return str(expected).lower() not in str(actual).lower()
            elif operator == "in":
                return str(actual).lower() in [str(e).lower() for e in expected]
            elif operator == "matches":
                import re

                return bool(re.search(str(expected), str(actual), re.IGNORECASE))
            else:
                return False
        except (ValueError, TypeError):
            return False

    def _get_remediation_for_policy(
        self, policy_id: str, package_name: str, version: str
    ) -> str:
        """Get remediation guidance for a policy violation."""
        remediations = {
            "no_critical_vulnerabilities": (
                f"Upgrade {package_name} to the latest version that fixes "
                f"the critical vulnerability(s). Review vulnerability details "
                f"for specific fixed versions."
            ),
            "no_high_vulnerabilities": (
                f"Upgrade {package_name} to reduce high severity vulnerabilities. "
                f"If upgrade is not possible, document the risk and obtain approval."
            ),
            "no_unmaintained_packages": (
                f"Consider replacing {package_name} with an actively maintained "
                f"alternative. If replacement is not feasible, accept the risk "
                f"after security review."
            ),
            "no_log4j_v2": (
                f"CRITICAL: Upgrade log4j-core to version 2.17.1 or later. "
                f"Version {version} is vulnerable to Log4Shell (CVE-2021-44228)."
            ),
            "no_spring_vulnerabilities": (
                "Upgrade Spring Framework components to patched versions. "
                "Review Spring Security advisories for specific version requirements."
            ),
            "license_compliance": (
                f"Package {package_name} uses a GPL/AGPL license. "
                f"Consult legal team before proceeding with deployment."
            ),
            "jackson_databind_security": (
                "Upgrade Jackson Databind to version 2.12.6.1 or 2.13.0 or later "
                "to fix deserialization vulnerabilities."
            ),
        }
        return remediations.get(
            policy_id,
            f"Review policy '{policy_id}' requirements for {package_name}:{version}",
        )

    def _generate_recommendations(self, report: PolicyEnforcementReport) -> list[str]:
        """Generate actionable recommendations from the report."""
        recommendations = []

        if report.critical_violations > 0:
            recommendations.append(
                f"CRITICAL: {report.critical_violations} critical violation(s) detected. "
                f"Immediate remediation required. Blocked packages: {len(report.blocked_packages)}"
            )

        if report.high_violations > 0:
            recommendations.append(
                f"HIGH: {report.high_violations} high severity violation(s) detected. "
                f"Schedule remediation within 7 days. "
                f"Packages requiring approval: {len(report.requires_approval)}"
            )

        if report.blocked_packages:
            recommendations.append(
                f"Action Required: The following packages are BLOCKED and must be "
                f"replaced or upgraded: {', '.join(report.blocked_packages[:5])}"
                + ("..." if len(report.blocked_packages) > 5 else "")
            )

        if report.requires_approval:
            recommendations.append(
                f"Approval Required: {len(report.requires_approval)} package(s) require "
                f"security team approval before use."
            )

        if report.compliance_score < 70:
            recommendations.append(
                f"Compliance score ({report.compliance_score:.1f}%) is below threshold. "
                f"Conduct comprehensive security review before proceeding."
            )
        elif report.compliance_score < 90:
            recommendations.append(
                f"Compliance score ({report.compliance_score:.1f}%) is acceptable but "
                f"could be improved. Address medium/low violations to improve score."
            )

        if report.is_compliant:
            recommendations.append(
                "Excellent! No policy violations detected. "
                "Dependencies comply with all security policies."
            )

        return recommendations


def enforce_teddk_policies(
    scan_result: dict[str, Any],
    project_id: str = "",
    custom_policies: Optional[dict[str, dict]] = None,
) -> PolicyEnforcementReport:
    """
    Convenience function to enforce TEDDK policies on a scan result.

    Args:
        scan_result: Result from TEDDKVulnerabilityScanner scan
        project_id: Optional project identifier
        custom_policies: Optional custom policies to add/override defaults

    Returns:
        PolicyEnforcementReport with violations and recommendations
    """
    enforcer = TEDDKPolicyEnforcer()

    if custom_policies:
        for policy_id, policy_config in custom_policies.items():
            enforcer.add_custom_policy(policy_id, policy_config)

    return enforcer.enforce_policies_on_scan(scan_result, project_id)


def format_enforcement_report(report: PolicyEnforcementReport) -> str:
    """Format enforcement report as human-readable text."""
    lines = [
        f"{'=' * 60}",
        "Policy Enforcement Report",
        f"{'=' * 60}",
        f"Scan ID:    {report.scan_id}",
        f"Timestamp:  {report.evaluated_at}",
        "",
        "SUMMARY",
        f"{'-' * 60}",
        f"Policies Evaluated: {report.total_policies_evaluated}",
        f"Total Violations:   {report.total_violations}",
        f"  Critical:         {report.critical_violations}",
        f"  High:             {report.high_violations}",
        f"  Medium:           {report.medium_violations}",
        f"  Low:              {report.low_violations}",
        f"Compliance Score:   {report.compliance_score:.1f}%",
        f"Status:             {'COMPLIANT' if report.is_compliant else 'NON-COMPLIANT'}",
        "",
    ]

    if report.violations:
        lines.append(f"VIOLATIONS ({len(report.violations)})")
        lines.append(f"{'-' * 60}")
        for v in report.violations:
            lines.append("")
            lines.append(f"  [{v.severity.upper():8s}] {v.policy_name}")
            lines.append(f"  Package:   {v.package_name}:{v.package_version}")
            lines.append(f"  Action:    {v.recommended_action.value}")
            lines.append(f"  Details:   {v.description}")
            lines.append(f"  Remediation: {v.remediation}")

    if report.recommendations:
        lines.append("")
        lines.append("RECOMMENDATIONS")
        lines.append(f"{'-' * 60}")
        for i, rec in enumerate(report.recommendations, 1):
            lines.append(f"  {i}. {rec}")

    lines.append("")
    lines.append(f"{'=' * 60}")
    return "\n".join(lines)
