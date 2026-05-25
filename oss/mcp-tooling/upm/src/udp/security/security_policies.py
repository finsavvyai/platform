"""
Security Policy Engine.

Implements enterprise-grade security policies, access controls,
and policy enforcement mechanisms for the Universal Dependency Platform.
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Optional
from uuid import UUID

logger = logging.getLogger(__name__)


class PolicyType(str, Enum):
    """Types of security policies."""
    ACCESS_CONTROL = "access_control"
    DATA_PROTECTION = "data_protection"
    SECURITY_SCANNING = "security_scanning"
    LICENSE_COMPLIANCE = "license_compliance"
    DEPENDENCY_MANAGEMENT = "dependency_management"
    AUDIT_LOGGING = "audit_logging"
    INCIDENT_RESPONSE = "incident_response"
    BUSINESS_CONTINUITY = "business_continuity"


class PolicyAction(str, Enum):
    """Policy enforcement actions."""
    ALLOW = "allow"
    DENY = "deny"
    WARN = "warn"
    REQUIRE_APPROVAL = "require_approval"
    QUARANTINE = "quarantine"
    AUTO_REMEDIATE = "auto_remediate"


class PolicySeverity(str, Enum):
    """Policy violation severity levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class PolicyRule:
    """Individual policy rule definition."""
    id: str
    name: str
    description: str
    policy_type: PolicyType
    conditions: dict[str, Any]
    action: PolicyAction
    severity: PolicySeverity
    enabled: bool = True
    created_at: datetime = None
    updated_at: datetime = None


@dataclass
class PolicyViolation:
    """Policy violation record."""
    id: UUID
    rule_id: str
    policy_type: PolicyType
    violation_type: str
    description: str
    severity: PolicySeverity
    detected_at: datetime
    detected_by: str
    affected_resource: str
    violation_data: dict[str, Any]
    remediation_status: str
    remediation_notes: Optional[str]


@dataclass
class PolicyEvaluationResult:
    """Result of policy evaluation."""
    rule_id: str
    violated: bool
    action: PolicyAction
    severity: PolicySeverity
    message: str
    evidence: dict[str, Any]
    recommendations: list[str]


class SecurityPolicyEngine:
    """Enterprise security policy engine."""

    def __init__(self):
        self.policies: dict[str, PolicyRule] = {}
        self.violations: list[PolicyViolation] = []
        self.evaluation_cache: dict[str, PolicyEvaluationResult] = {}
        self._load_default_policies()

    def create_policy(
        self,
        rule: PolicyRule,
        organization_id: UUID
    ) -> bool:
        """
        Create a new security policy.

        Args:
            rule: Policy rule definition
            organization_id: Organization creating the policy

        Returns:
            True if policy was created successfully
        """
        try:
            logger.info(f"Creating security policy: {rule.name}")

            # Validate policy rule
            if not self._validate_policy_rule(rule):
                logger.error(f"Invalid policy rule: {rule.name}")
                return False

            # Set timestamps
            now = datetime.utcnow()
            rule.created_at = now
            rule.updated_at = now

            # Store policy
            policy_key = f"{organization_id}_{rule.id}"
            self.policies[policy_key] = rule

            logger.info(f"Successfully created policy: {rule.name}")
            return True

        except Exception as e:
            logger.error(f"Failed to create policy: {e}", exc_info=True)
            return False

    def evaluate_policy(
        self,
        policy_type: PolicyType,
        resource_data: dict[str, Any],
        organization_id: UUID,
        user_id: Optional[str] = None
    ) -> list[PolicyEvaluationResult]:
        """
        Evaluate policies against resource data.

        Args:
            policy_type: Type of policy to evaluate
            resource_data: Data about the resource being evaluated
            organization_id: Organization context
            user_id: User performing the action (optional)

        Returns:
            List of policy evaluation results
        """
        try:
            logger.debug(f"Evaluating {policy_type} policies for organization {organization_id}")

            # Get applicable policies
            applicable_policies = self._get_applicable_policies(
                policy_type, organization_id
            )

            results = []
            for policy in applicable_policies:
                # Check cache first
                cache_key = f"{policy.id}_{hash(str(resource_data))}"
                if cache_key in self.evaluation_cache:
                    results.append(self.evaluation_cache[cache_key])
                    continue

                # Evaluate policy
                result = self._evaluate_single_policy(policy, resource_data, user_id)
                results.append(result)

                # Cache result
                self.evaluation_cache[cache_key] = result

                # Record violation if applicable
                if result.violated:
                    self._record_violation(policy, result, resource_data, user_id)

            return results

        except Exception as e:
            logger.error(f"Failed to evaluate policies: {e}", exc_info=True)
            return []

    def get_policy_violations(
        self,
        organization_id: UUID,
        policy_type: Optional[PolicyType] = None,
        severity: Optional[PolicySeverity] = None,
        time_range: Optional[tuple[datetime, datetime]] = None
    ) -> list[PolicyViolation]:
        """Get policy violations for an organization."""
        try:
            # Filter violations by organization (simplified)
            org_violations = [v for v in self.violations if str(organization_id) in str(v.id)]

            if policy_type:
                org_violations = [v for v in org_violations if v.policy_type == policy_type]

            if severity:
                org_violations = [v for v in org_violations if v.severity == severity]

            if time_range:
                start_time, end_time = time_range
                org_violations = [
                    v for v in org_violations
                    if start_time <= v.detected_at <= end_time
                ]

            return org_violations

        except Exception as e:
            logger.error(f"Failed to get policy violations: {e}", exc_info=True)
            return []

    def update_policy(
        self,
        policy_id: str,
        organization_id: UUID,
        updates: dict[str, Any]
    ) -> bool:
        """Update an existing policy."""
        try:
            policy_key = f"{organization_id}_{policy_id}"
            if policy_key not in self.policies:
                logger.warning(f"Policy {policy_id} not found for organization {organization_id}")
                return False

            policy = self.policies[policy_key]

            # Update allowed fields
            allowed_fields = ['name', 'description', 'conditions', 'action', 'severity', 'enabled']
            for field, value in updates.items():
                if field in allowed_fields:
                    setattr(policy, field, value)

            policy.updated_at = datetime.utcnow()

            # Clear cache for this policy
            self._clear_policy_cache(policy_id)

            logger.info(f"Updated policy: {policy.name}")
            return True

        except Exception as e:
            logger.error(f"Failed to update policy: {e}", exc_info=True)
            return False

    def delete_policy(
        self,
        policy_id: str,
        organization_id: UUID
    ) -> bool:
        """Delete a policy."""
        try:
            policy_key = f"{organization_id}_{policy_id}"
            if policy_key not in self.policies:
                logger.warning(f"Policy {policy_id} not found for organization {organization_id}")
                return False

            del self.policies[policy_key]
            self._clear_policy_cache(policy_id)

            logger.info(f"Deleted policy: {policy_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to delete policy: {e}", exc_info=True)
            return False

    def get_policy_statistics(
        self,
        organization_id: UUID
    ) -> dict[str, Any]:
        """Get policy statistics for an organization."""
        try:
            # Count policies by type
            policy_counts = {}
            for policy_key, policy in self.policies.items():
                if str(organization_id) in policy_key:
                    policy_type = policy.policy_type.value
                    policy_counts[policy_type] = policy_counts.get(policy_type, 0) + 1

            # Count violations by severity
            org_violations = [v for v in self.violations if str(organization_id) in str(v.id)]
            violation_counts = {}
            for violation in org_violations:
                severity = violation.severity.value
                violation_counts[severity] = violation_counts.get(severity, 0) + 1

            # Calculate violation trends (last 30 days)
            thirty_days_ago = datetime.utcnow() - timedelta(days=30)
            recent_violations = [
                v for v in org_violations
                if v.detected_at >= thirty_days_ago
            ]

            return {
                "total_policies": sum(policy_counts.values()),
                "policies_by_type": policy_counts,
                "total_violations": len(org_violations),
                "violations_by_severity": violation_counts,
                "recent_violations_30_days": len(recent_violations),
                "compliance_percentage": self._calculate_compliance_percentage(org_violations)
            }

        except Exception as e:
            logger.error(f"Failed to get policy statistics: {e}", exc_info=True)
            return {}

    def _validate_policy_rule(self, rule: PolicyRule) -> bool:
        """Validate a policy rule definition."""
        try:
            # Check required fields
            if not rule.id or not rule.name or not rule.description:
                return False

            # Check policy type
            if rule.policy_type not in PolicyType:
                return False

            # Check action
            if rule.action not in PolicyAction:
                return False

            # Check severity
            if rule.severity not in PolicySeverity:
                return False

            # Check conditions
            if not isinstance(rule.conditions, dict):
                return False

            return True

        except Exception as e:
            logger.error(f"Policy validation failed: {e}")
            return False

    def _get_applicable_policies(
        self,
        policy_type: PolicyType,
        organization_id: UUID
    ) -> list[PolicyRule]:
        """Get policies applicable to the given context."""
        applicable = []

        for policy_key, policy in self.policies.items():
            if (str(organization_id) in policy_key and
                policy.policy_type == policy_type and
                policy.enabled):
                applicable.append(policy)

        return applicable

    def _evaluate_single_policy(
        self,
        policy: PolicyRule,
        resource_data: dict[str, Any],
        user_id: Optional[str]
    ) -> PolicyEvaluationResult:
        """Evaluate a single policy against resource data."""
        try:
            # Evaluate conditions based on policy type
            violated = False
            message = ""
            evidence = {}
            recommendations = []

            if policy.policy_type == PolicyType.ACCESS_CONTROL:
                violated, message, evidence = self._evaluate_access_control_policy(
                    policy, resource_data, user_id
                )
            elif policy.policy_type == PolicyType.SECURITY_SCANNING:
                violated, message, evidence = self._evaluate_security_scanning_policy(
                    policy, resource_data
                )
            elif policy.policy_type == PolicyType.LICENSE_COMPLIANCE:
                violated, message, evidence = self._evaluate_license_compliance_policy(
                    policy, resource_data
                )
            elif policy.policy_type == PolicyType.DEPENDENCY_MANAGEMENT:
                violated, message, evidence = self._evaluate_dependency_management_policy(
                    policy, resource_data
                )
            else:
                # Generic evaluation
                violated, message, evidence = self._evaluate_generic_policy(
                    policy, resource_data
                )

            # Generate recommendations if violated
            if violated:
                recommendations = self._generate_recommendations(policy, evidence)

            return PolicyEvaluationResult(
                rule_id=policy.id,
                violated=violated,
                action=policy.action,
                severity=policy.severity,
                message=message,
                evidence=evidence,
                recommendations=recommendations
            )

        except Exception as e:
            logger.error(f"Failed to evaluate policy {policy.id}: {e}")
            return PolicyEvaluationResult(
                rule_id=policy.id,
                violated=True,
                action=PolicyAction.DENY,
                severity=PolicySeverity.HIGH,
                message=f"Policy evaluation failed: {str(e)}",
                evidence={"error": str(e)},
                recommendations=["Review policy configuration"]
            )

    def _evaluate_access_control_policy(
        self,
        policy: PolicyRule,
        resource_data: dict[str, Any],
        user_id: Optional[str]
    ) -> tuple[bool, str, dict[str, Any]]:
        """Evaluate access control policy."""
        # Check user permissions
        user_role = resource_data.get('user_role', 'user')
        required_role = policy.conditions.get('required_role', 'admin')

        if user_role != required_role:
            return True, f"Access denied: user role '{user_role}' does not meet required role '{required_role}'", {
                "user_role": user_role,
                "required_role": required_role,
                "user_id": user_id
            }

        # Check time-based access
        if 'allowed_hours' in policy.conditions:
            current_hour = datetime.utcnow().hour
            allowed_hours = policy.conditions['allowed_hours']
            if current_hour not in allowed_hours:
                return True, f"Access denied: current time {current_hour}:00 not in allowed hours {allowed_hours}", {
                    "current_hour": current_hour,
                    "allowed_hours": allowed_hours
                }

        return False, "Access allowed", {"evaluation": "passed"}

    def _evaluate_security_scanning_policy(
        self,
        policy: PolicyRule,
        resource_data: dict[str, Any]
    ) -> tuple[bool, str, dict[str, Any]]:
        """Evaluate security scanning policy."""
        vulnerabilities = resource_data.get('vulnerabilities', [])
        max_severity = policy.conditions.get('max_severity', 'medium')

        # Check for high-severity vulnerabilities
        high_severity_vulns = [
            v for v in vulnerabilities
            if v.get('severity', 'low') in ['high', 'critical']
        ]

        if high_severity_vulns and max_severity in ['low', 'medium']:
            return True, f"Security policy violated: {len(high_severity_vulns)} high-severity vulnerabilities found", {
                "vulnerabilities": high_severity_vulns,
                "max_allowed_severity": max_severity
            }

        return False, "Security scan passed", {"vulnerabilities": vulnerabilities}

    def _evaluate_license_compliance_policy(
        self,
        policy: PolicyRule,
        resource_data: dict[str, Any]
    ) -> tuple[bool, str, dict[str, Any]]:
        """Evaluate license compliance policy."""
        license_info = resource_data.get('license', '')
        allowed_licenses = policy.conditions.get('allowed_licenses', [])
        denied_licenses = policy.conditions.get('denied_licenses', [])

        # Check denied licenses
        if license_info in denied_licenses:
            return True, f"License policy violated: '{license_info}' is in denied licenses list", {
                "license": license_info,
                "denied_licenses": denied_licenses
            }

        # Check allowed licenses (if specified)
        if allowed_licenses and license_info not in allowed_licenses:
            return True, f"License policy violated: '{license_info}' not in allowed licenses list", {
                "license": license_info,
                "allowed_licenses": allowed_licenses
            }

        return False, "License compliance passed", {"license": license_info}

    def _evaluate_dependency_management_policy(
        self,
        policy: PolicyRule,
        resource_data: dict[str, Any]
    ) -> tuple[bool, str, dict[str, Any]]:
        """Evaluate dependency management policy."""
        dependencies = resource_data.get('dependencies', [])
        max_dependencies = policy.conditions.get('max_dependencies', 1000)

        if len(dependencies) > max_dependencies:
            return True, f"Dependency policy violated: {len(dependencies)} dependencies exceeds limit of {max_dependencies}", {
                "dependency_count": len(dependencies),
                "max_dependencies": max_dependencies
            }

        return False, "Dependency management policy passed", {"dependency_count": len(dependencies)}

    def _evaluate_generic_policy(
        self,
        policy: PolicyRule,
        resource_data: dict[str, Any]
    ) -> tuple[bool, str, dict[str, Any]]:
        """Evaluate generic policy conditions."""
        # Simple condition evaluation
        conditions = policy.conditions

        for condition_key, expected_value in conditions.items():
            actual_value = resource_data.get(condition_key)
            if actual_value != expected_value:
                return True, f"Policy condition violated: {condition_key} = {actual_value}, expected {expected_value}", {
                    "condition": condition_key,
                    "actual_value": actual_value,
                    "expected_value": expected_value
                }

        return False, "Policy conditions satisfied", {"evaluation": "passed"}

    def _generate_recommendations(
        self,
        policy: PolicyRule,
        evidence: dict[str, Any]
    ) -> list[str]:
        """Generate recommendations based on policy violation."""
        recommendations = []

        if policy.policy_type == PolicyType.ACCESS_CONTROL:
            recommendations.append("Review user permissions and roles")
            recommendations.append("Implement role-based access control")
        elif policy.policy_type == PolicyType.SECURITY_SCANNING:
            recommendations.append("Update vulnerable dependencies")
            recommendations.append("Implement automated security scanning")
        elif policy.policy_type == PolicyType.LICENSE_COMPLIANCE:
            recommendations.append("Review and update license policies")
            recommendations.append("Consider alternative packages with compliant licenses")
        elif policy.policy_type == PolicyType.DEPENDENCY_MANAGEMENT:
            recommendations.append("Audit and remove unused dependencies")
            recommendations.append("Implement dependency monitoring")

        return recommendations

    def _record_violation(
        self,
        policy: PolicyRule,
        result: PolicyEvaluationResult,
        resource_data: dict[str, Any],
        user_id: Optional[str]
    ):
        """Record a policy violation."""
        violation = PolicyViolation(
            id=UUID(),
            rule_id=policy.id,
            policy_type=policy.policy_type,
            violation_type="policy_violation",
            description=result.message,
            severity=result.severity,
            detected_at=datetime.utcnow(),
            detected_by=user_id or "system",
            affected_resource=resource_data.get('resource_id', 'unknown'),
            violation_data=result.evidence,
            remediation_status="detected",
            remediation_notes=None
        )

        self.violations.append(violation)
        logger.warning(f"Policy violation recorded: {policy.name} - {result.message}")

    def _clear_policy_cache(self, policy_id: str):
        """Clear evaluation cache for a specific policy."""
        keys_to_remove = [key for key in self.evaluation_cache.keys() if key.startswith(policy_id)]
        for key in keys_to_remove:
            del self.evaluation_cache[key]

    def _calculate_compliance_percentage(self, violations: list[PolicyViolation]) -> float:
        """Calculate compliance percentage based on violations."""
        if not violations:
            return 100.0

        # Weight violations by severity
        total_weight = 0
        violation_weight = 0

        for violation in violations:
            weight = {
                PolicySeverity.LOW: 1,
                PolicySeverity.MEDIUM: 3,
                PolicySeverity.HIGH: 7,
                PolicySeverity.CRITICAL: 10
            }.get(violation.severity, 1)

            total_weight += weight
            violation_weight += weight

        if total_weight == 0:
            return 100.0

        compliance_percentage = max(0, 100 - (violation_weight / total_weight) * 100)
        return round(compliance_percentage, 2)

    def _load_default_policies(self):
        """Load default security policies."""
        default_policies = [
            PolicyRule(
                id="DEFAULT_ACCESS_CONTROL",
                name="Default Access Control",
                description="Basic access control policy",
                policy_type=PolicyType.ACCESS_CONTROL,
                conditions={"required_role": "user"},
                action=PolicyAction.ALLOW,
                severity=PolicySeverity.MEDIUM
            ),
            PolicyRule(
                id="DEFAULT_SECURITY_SCAN",
                name="Default Security Scan",
                description="Basic security scanning policy",
                policy_type=PolicyType.SECURITY_SCANNING,
                conditions={"max_severity": "medium"},
                action=PolicyAction.WARN,
                severity=PolicySeverity.HIGH
            ),
            PolicyRule(
                id="DEFAULT_LICENSE_CHECK",
                name="Default License Check",
                description="Basic license compliance policy",
                policy_type=PolicyType.LICENSE_COMPLIANCE,
                conditions={"denied_licenses": ["GPL", "AGPL"]},
                action=PolicyAction.REQUIRE_APPROVAL,
                severity=PolicySeverity.MEDIUM
            )
        ]

        for policy in default_policies:
            policy.created_at = datetime.utcnow()
            policy.updated_at = datetime.utcnow()
            self.policies[f"default_{policy.id}"] = policy
