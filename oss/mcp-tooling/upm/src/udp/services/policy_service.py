"""
Policy Service for UPM - Comprehensive Policy Management and Evaluation

This module provides enterprise-grade policy management capabilities including:
- Policy CRUD operations with validation
- Advanced policy evaluation engine
- Policy templates for common compliance frameworks
- Custom policy creation and management
- Policy violation tracking and reporting
"""

import operator
import re
from datetime import datetime
from enum import Enum
from typing import Any, Optional, Union
from uuid import UUID, uuid4

from sqlalchemy import desc, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from udp.core.models.policy import (
    Policy,
    PolicyEvaluation,
    PolicyEvaluationStatus,
    PolicyFramework,
    PolicyRuleType,
    PolicyStatus,
)
from udp.services.base import BaseService


class PolicyAction(str, Enum):
    """Policy enforcement actions."""

    ALLOW = "allow"
    WARN = "warn"
    BLOCK = "block"
    REQUIRE_APPROVAL = "require_approval"
    NOTIFY = "notify"
    QUARANTINE = "quarantine"


class PolicyOperator(str, Enum):
    """Policy condition operators."""

    EQUALS = "eq"
    NOT_EQUALS = "ne"
    GREATER_THAN = "gt"
    GREATER_EQUAL = "ge"
    LESS_THAN = "lt"
    LESS_EQUAL = "le"
    CONTAINS = "contains"
    NOT_CONTAINS = "not_contains"
    IN = "in"
    NOT_IN = "not_in"
    REGEX = "regex"
    MATCHES = "matches"
    STARTS_WITH = "starts_with"
    ENDS_WITH = "ends_with"
    IS_NULL = "is_null"
    IS_NOT_NULL = "is_not_null"
    BETWEEN = "between"
    NOT_BETWEEN = "not_between"


class PolicyCondition:
    """Represents a policy condition with operator and value."""

    def __init__(
        self,
        field: str,
        operator: PolicyOperator,
        value: Any = None,
        logical_op: str = "AND",
    ):
        self.field = field
        self.operator = operator
        self.value = value
        self.logical_op = logical_op.upper()

    def evaluate(self, context: dict[str, Any]) -> bool:
        """Evaluate the condition against the given context."""
        # Get the field value from context
        field_value = self._get_field_value(context, self.field)

        # Evaluate based on operator
        try:
            if self.operator == PolicyOperator.EQUALS:
                return field_value == self.value
            elif self.operator == PolicyOperator.NOT_EQUALS:
                return field_value != self.value
            elif self.operator == PolicyOperator.GREATER_THAN:
                return self._compare_numeric(field_value, self.value, operator.gt)
            elif self.operator == PolicyOperator.GREATER_EQUAL:
                return self._compare_numeric(field_value, self.value, operator.ge)
            elif self.operator == PolicyOperator.LESS_THAN:
                return self._compare_numeric(field_value, self.value, operator.lt)
            elif self.operator == PolicyOperator.LESS_EQUAL:
                return self._compare_numeric(field_value, self.value, operator.le)
            elif self.operator == PolicyOperator.CONTAINS:
                return self._check_contains(field_value, self.value)
            elif self.operator == PolicyOperator.NOT_CONTAINS:
                return not self._check_contains(field_value, self.value)
            elif self.operator == PolicyOperator.IN:
                return (
                    field_value in self.value
                    if isinstance(self.value, (list, set, tuple))
                    else False
                )
            elif self.operator == PolicyOperator.NOT_IN:
                return (
                    field_value not in self.value
                    if isinstance(self.value, (list, set, tuple))
                    else True
                )
            elif self.operator == PolicyOperator.REGEX:
                return bool(re.search(str(self.value), str(field_value), re.IGNORECASE))
            elif self.operator == PolicyOperator.MATCHES:
                return str(field_value).lower() == str(self.value).lower()
            elif self.operator == PolicyOperator.STARTS_WITH:
                return str(field_value).lower().startswith(str(self.value).lower())
            elif self.operator == PolicyOperator.ENDS_WITH:
                return str(field_value).lower().endswith(str(self.value).lower())
            elif self.operator == PolicyOperator.IS_NULL:
                return field_value is None
            elif self.operator == PolicyOperator.IS_NOT_NULL:
                return field_value is not None
            elif self.operator == PolicyOperator.BETWEEN:
                if isinstance(self.value, (list, tuple)) and len(self.value) == 2:
                    return self._compare_numeric(
                        field_value, self.value[0], operator.ge
                    ) and self._compare_numeric(field_value, self.value[1], operator.le)
                return False
            elif self.operator == PolicyOperator.NOT_BETWEEN:
                if isinstance(self.value, (list, tuple)) and len(self.value) == 2:
                    return not (
                        self._compare_numeric(field_value, self.value[0], operator.ge)
                        and self._compare_numeric(
                            field_value, self.value[1], operator.le
                        )
                    )
                return True
            else:
                return False
        except (TypeError, ValueError, AttributeError):
            return False

    def _get_field_value(self, context: dict[str, Any], field: str) -> Any:
        """Get field value from context with dot notation support."""
        if "." in field:
            # Support nested field access like "package.license"
            parts = field.split(".")
            value = context
            for part in parts:
                if isinstance(value, dict) and part in value:
                    value = value[part]
                else:
                    return None
            return value
        return context.get(field)

    def _compare_numeric(self, left: Any, right: Any, op) -> bool:
        """Compare two values numerically."""
        try:
            return op(float(left), float(right))
        except (TypeError, ValueError):
            return False

    def _check_contains(self, container: Any, item: Any) -> bool:
        """Check if container contains item."""
        if container is None:
            return False
        if isinstance(container, (list, tuple, set)):
            return item in container
        return str(item).lower() in str(container).lower()

    def to_dict(self) -> dict[str, Any]:
        """Convert condition to dictionary."""
        return {
            "field": self.field,
            "operator": self.operator.value,
            "value": self.value,
            "logical_op": self.logical_op,
        }


class PolicyRule:
    """Represents a policy rule with conditions and actions."""

    def __init__(
        self,
        rule_id: str,
        name: str,
        conditions: list[Union[PolicyCondition, dict[str, Any]]],
        actions: list[dict[str, Any]],
        severity: str = "medium",
        enabled: bool = True,
        description: Optional[str] = None,
    ):
        self.rule_id = rule_id
        self.name = name
        self.conditions = []
        for condition in conditions:
            if isinstance(condition, dict):
                self.conditions.append(PolicyCondition(**condition))
            else:
                self.conditions.append(condition)
        self.actions = actions
        self.severity = severity
        self.enabled = enabled
        self.description = description

    def evaluate(self, context: dict[str, Any]) -> tuple[bool, list[dict[str, Any]]]:
        """Evaluate the rule and return (triggered, actions)."""
        if not self.enabled:
            return False, []

        # Group conditions by logical operator
        and_conditions = []
        or_conditions = []

        for condition in self.conditions:
            if condition.logical_op == "OR":
                or_conditions.append(condition)
            else:
                and_conditions.append(condition)

        # Evaluate AND conditions
        and_result = all(condition.evaluate(context) for condition in and_conditions)

        # Evaluate OR conditions (if any)
        or_result = (
            any(condition.evaluate(context) for condition in or_conditions)
            if or_conditions
            else True
        )

        # Rule is triggered if all AND conditions pass and at least one OR condition passes (if any exist)
        triggered = and_result and or_result

        return triggered, self.actions if triggered else []

    def to_dict(self) -> dict[str, Any]:
        """Convert rule to dictionary."""
        return {
            "rule_id": self.rule_id,
            "name": self.name,
            "conditions": [c.to_dict() for c in self.conditions],
            "actions": self.actions,
            "severity": self.severity,
            "enabled": self.enabled,
            "description": self.description,
        }


class PolicyService(BaseService):
    """Comprehensive policy management service."""

    def __init__(self, db_session: AsyncSession):
        super().__init__(db_session)
        self._compiled_policies = {}

    async def create_policy(
        self,
        name: str,
        description: str,
        rule_type: PolicyRuleType,
        conditions: list[dict[str, Any]],
        actions: list[dict[str, Any]],
        organization_id: Optional[UUID] = None,
        framework_id: Optional[UUID] = None,
        category: Optional[str] = None,
        tags: Optional[list[str]] = None,
        severity: str = "medium",
        priority: str = "medium",
        auto_enforce: bool = False,
        requires_approval: bool = False,
        evaluation_frequency: str = "on_analysis",
        **kwargs,
    ) -> Policy:
        """Create a new policy."""
        # Validate policy data
        self._validate_policy_data(name, rule_type, conditions, actions)

        policy = Policy(
            organization_id=organization_id,
            framework_id=framework_id,
            name=name,
            description=description,
            rule_type=rule_type.value,
            category=category,
            tags=tags or [],
            conditions=conditions,
            actions=actions,
            severity=severity,
            priority=priority,
            status=PolicyStatus.ACTIVE,
            is_active=True,
            auto_enforce=auto_enforce,
            requires_approval=requires_approval,
            evaluation_frequency=evaluation_frequency,
            version="1.0.0",
        )

        self.db_session.add(policy)
        await self.db_session.flush()

        # Clear compiled policies cache
        self._compiled_policies.clear()

        return policy

    async def get_policy(self, policy_id: UUID) -> Optional[Policy]:
        """Get a policy by ID."""
        stmt = select(Policy).where(Policy.id == policy_id, Policy.deleted_at.is_(None))
        result = await self.db_session.execute(stmt)
        return result.scalar_one_or_none()

    async def update_policy(self, policy_id: UUID, **kwargs) -> Optional[Policy]:
        """Update a policy."""
        policy = await self.get_policy(policy_id)
        if not policy:
            return None

        # Validate updates
        if "conditions" in kwargs or "actions" in kwargs:
            self._validate_policy_data(
                kwargs.get("name", policy.name),
                PolicyRuleType(policy.rule_type),
                kwargs.get("conditions", policy.conditions),
                kwargs.get("actions", policy.actions),
            )

        # Update policy fields
        for field, value in kwargs.items():
            if hasattr(policy, field):
                setattr(policy, field, value)

        policy.updated_at = datetime.utcnow()

        # Clear compiled policies cache
        self._compiled_policies.clear()

        return policy

    async def delete_policy(self, policy_id: UUID, hard_delete: bool = False) -> bool:
        """Delete a policy."""
        policy = await self.get_policy(policy_id)
        if not policy:
            return False

        if hard_delete:
            await self.db_session.delete(policy)
        else:
            policy.deleted_at = datetime.utcnow()
            policy.is_active = False

        # Clear compiled policies cache
        self._compiled_policies.clear()

        return True

    async def list_policies(
        self,
        organization_id: Optional[UUID] = None,
        framework_id: Optional[UUID] = None,
        rule_type: Optional[PolicyRuleType] = None,
        status: Optional[PolicyStatus] = None,
        is_active: Optional[bool] = None,
        category: Optional[str] = None,
        tags: Optional[list[str]] = None,
        skip: int = 0,
        limit: int = 100,
        sort_by: str = "created_at",
        sort_desc: bool = True,
    ) -> list[Policy]:
        """List policies with filtering and pagination."""
        query = select(Policy).where(Policy.deleted_at.is_(None))

        # Apply filters
        if organization_id:
            query = query.where(Policy.organization_id == organization_id)
        if framework_id:
            query = query.where(Policy.framework_id == framework_id)
        if rule_type:
            query = query.where(Policy.rule_type == rule_type.value)
        if status:
            query = query.where(Policy.status == status.value)
        if is_active is not None:
            query = query.where(Policy.is_active == is_active)
        if category:
            query = query.where(Policy.category.ilike(f"%{category}%"))
        if tags:
            # Simple tag filtering - policies that contain all specified tags
            for tag in tags:
                query = query.where(Policy.tags.contains([tag]))

        # Apply sorting
        if hasattr(Policy, sort_by):
            order_column = getattr(Policy, sort_by)
            query = query.order_by(desc(order_column) if sort_desc else order_column)

        # Apply pagination
        query = query.offset(skip).limit(limit)

        result = await self.db_session.execute(query)
        return result.scalars().all()

    async def create_framework(
        self,
        name: str,
        slug: str,
        description: str,
        framework_type: PolicyFramework,
        version: str,
        requirements: Optional[list[dict[str, Any]]] = None,
        controls: Optional[list[dict[str, Any]]] = None,
        documentation_url: Optional[str] = None,
        reference_url: Optional[str] = None,
        **kwargs,
    ) -> PolicyFramework:
        """Create a new policy framework."""
        framework = PolicyFramework(
            name=name,
            slug=slug,
            description=description,
            framework_type=framework_type.value,
            version=version,
            requirements=requirements or [],
            controls=controls or [],
            documentation_url=documentation_url,
            reference_url=reference_url,
            is_active=True,
        )

        self.db_session.add(framework)
        await self.db_session.flush()

        return framework

    async def get_framework(self, framework_id: UUID) -> Optional[PolicyFramework]:
        """Get a framework by ID."""
        stmt = select(PolicyFramework).where(
            PolicyFramework.id == framework_id, PolicyFramework.deleted_at.is_(None)
        )
        result = await self.db_session.execute(stmt)
        return result.scalar_one_or_none()

    async def evaluate_policies(
        self,
        project_id: UUID,
        target_type: str,
        target_id: Optional[UUID] = None,
        context: Optional[dict[str, Any]] = None,
        policy_ids: Optional[list[UUID]] = None,
        analysis_id: Optional[UUID] = None,
    ) -> list[PolicyEvaluation]:
        """Evaluate policies against the given context."""
        if not context:
            context = {}

        # Get policies to evaluate
        policies = await self._get_policies_for_evaluation(project_id, policy_ids)

        evaluations = []
        for policy in policies:
            # Compile policy if not already compiled
            if policy.id not in self._compiled_policies:
                self._compiled_policies[policy.id] = self._compile_policy(policy)

            compiled_policy = self._compiled_policies[policy.id]

            # Evaluate each rule in the policy
            start_time = datetime.utcnow()
            triggered_actions = []
            violations = []

            for rule in compiled_policy.rules:
                triggered, actions = rule.evaluate(context)
                if triggered:
                    triggered_actions.extend(actions)
                    violations.append(
                        {
                            "rule_id": rule.rule_id,
                            "rule_name": rule.name,
                            "severity": rule.severity,
                            "description": rule.description,
                            "actions": actions,
                        }
                    )

            # Determine overall evaluation status
            if violations:
                critical_violations = [
                    v for v in violations if v.get("severity") == "critical"
                ]
                high_violations = [v for v in violations if v.get("severity") == "high"]

                if critical_violations:
                    status = PolicyEvaluationStatus.FAIL
                elif high_violations:
                    status = PolicyEvaluationStatus.WARNING
                else:
                    status = PolicyEvaluationStatus.WARNING
            else:
                status = PolicyEvaluationStatus.PASS

            # Create evaluation record
            evaluation = PolicyEvaluation(
                project_id=project_id,
                analysis_id=analysis_id,
                policy_id=policy.id,
                target_type=target_type,
                target_id=target_id,
                context=context,
                status=status.value,
                result_message=f"Policy evaluation completed: {len(violations)} violation(s) detected",
                evaluation_details={
                    "policy_name": policy.name,
                    "policy_type": policy.rule_type,
                    "evaluated_rules": len(compiled_policy.rules),
                    "violations": violations,
                },
                violation_detected=len(violations) > 0,
                violation_severity=max([v.get("severity", "low") for v in violations])
                if violations
                else None,
                violation_details=violations if violations else None,
                triggered_actions=triggered_actions,
                evaluated_at=start_time.isoformat(),
                evaluation_duration_ms=str(
                    (datetime.utcnow() - start_time).total_seconds() * 1000
                ),
            )

            evaluations.append(evaluation)
            self.db_session.add(evaluation)

        await self.db_session.flush()
        return evaluations

    async def get_policy_evaluations(
        self,
        project_id: Optional[UUID] = None,
        policy_id: Optional[UUID] = None,
        status: Optional[PolicyEvaluationStatus] = None,
        has_violation: Optional[bool] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[PolicyEvaluation]:
        """Get policy evaluations with filtering."""
        query = select(PolicyEvaluation).where(PolicyEvaluation.deleted_at.is_(None))

        if project_id:
            query = query.where(PolicyEvaluation.project_id == project_id)
        if policy_id:
            query = query.where(PolicyEvaluation.policy_id == policy_id)
        if status:
            query = query.where(PolicyEvaluation.status == status.value)
        if has_violation is not None:
            query = query.where(PolicyEvaluation.violation_detected == has_violation)

        query = query.order_by(desc(PolicyEvaluation.evaluated_at))
        query = query.offset(skip).limit(limit)

        result = await self.db_session.execute(query)
        return result.scalars().all()

    def _validate_policy_data(
        self,
        name: str,
        rule_type: PolicyRuleType,
        conditions: list[dict[str, Any]],
        actions: list[dict[str, Any]],
    ):
        """Validate policy data."""
        if not name or not name.strip():
            raise ValueError("Policy name is required")

        if not conditions:
            raise ValueError("Policy must have at least one condition")

        if not actions:
            raise ValueError("Policy must have at least one action")

        # Validate conditions
        for condition in conditions:
            if not isinstance(condition, dict):
                raise ValueError("Conditions must be dictionaries")
            if "field" not in condition or "operator" not in condition:
                raise ValueError("Conditions must have 'field' and 'operator'")
            if condition["operator"] not in [op.value for op in PolicyOperator]:
                raise ValueError(f"Invalid operator: {condition['operator']}")

        # Validate actions
        for action in actions:
            if not isinstance(action, dict):
                raise ValueError("Actions must be dictionaries")
            if "type" not in action:
                raise ValueError("Actions must have 'type'")

    def _compile_policy(self, policy: Policy) -> "CompiledPolicy":
        """Compile a policy into an executable format."""
        rules = []

        # Convert policy conditions to rules
        for rule_data in (
            policy.conditions if isinstance(policy.conditions, list) else []
        ):
            if isinstance(rule_data, dict) and "conditions" in rule_data:
                # This is a rule definition
                rule = PolicyRule(
                    rule_id=rule_data.get("id", str(uuid4())),
                    name=rule_data.get("name", "Unnamed Rule"),
                    conditions=rule_data.get("conditions", []),
                    actions=rule_data.get("actions", policy.actions),
                    severity=rule_data.get("severity", policy.severity),
                    enabled=rule_data.get("enabled", True),
                    description=rule_data.get("description"),
                )
                rules.append(rule)
            else:
                # Create a default rule from policy conditions
                rule = PolicyRule(
                    rule_id=str(uuid4()),
                    name=f"Rule for {policy.name}",
                    conditions=[rule_data]
                    if not isinstance(rule_data, list)
                    else rule_data,
                    actions=policy.actions,
                    severity=policy.severity,
                    enabled=True,
                    description=f"Default rule for policy {policy.name}",
                )
                rules.append(rule)

        return CompiledPolicy(policy_id=policy.id, policy_name=policy.name, rules=rules)

    async def _get_policies_for_evaluation(
        self, project_id: UUID, policy_ids: Optional[list[UUID]] = None
    ) -> list[Policy]:
        """Get policies that should be evaluated for a project."""
        query = select(Policy).where(
            Policy.is_active == True,
            Policy.status == PolicyStatus.ACTIVE,
            Policy.deleted_at.is_(None),
        )

        if policy_ids:
            query = query.where(Policy.id.in_(policy_ids))
        else:
            # Get global policies and organization-specific policies
            query = query.where(
                or_(
                    Policy.organization_id.is_(None),
                    # Add organization-specific policies here based on project
                )
            )

        result = await self.db_session.execute(query)
        return result.scalars().all()


class CompiledPolicy:
    """Compiled policy for efficient evaluation."""

    def __init__(self, policy_id: UUID, policy_name: str, rules: list[PolicyRule]):
        self.policy_id = policy_id
        self.policy_name = policy_name
        self.rules = rules


# Policy templates for common compliance frameworks
POLICY_TEMPLATES = {
    "owasp_security": {
        "name": "OWASP Top 10 Security Policy",
        "description": "Policy template based on OWASP Top 10 security risks",
        "rule_type": PolicyRuleType.SECURITY,
        "conditions": [
            {
                "id": "owasp_001",
                "name": "No Known Critical Vulnerabilities",
                "description": "Prevents dependencies with critical CVE vulnerabilities",
                "conditions": [
                    {
                        "field": "vulnerability.max_severity",
                        "operator": PolicyOperator.EQUALS.value,
                        "value": "critical",
                    }
                ],
                "actions": [
                    {
                        "type": PolicyAction.BLOCK.value,
                        "message": "Dependency has critical vulnerabilities",
                    }
                ],
                "severity": "critical",
                "enabled": True,
            },
            {
                "id": "owasp_002",
                "name": "Recent Security Updates",
                "description": "Ensures dependencies have been updated within the last year",
                "conditions": [
                    {
                        "field": "package.last_updated",
                        "operator": PolicyOperator.LESS_THAN.value,
                        "value": "365 days ago",
                    }
                ],
                "actions": [
                    {
                        "type": PolicyAction.WARN.value,
                        "message": "Dependency has not been updated in over a year",
                    }
                ],
                "severity": "medium",
                "enabled": True,
            },
        ],
        "actions": [
            {
                "type": PolicyAction.NOTIFY.value,
                "recipients": ["security-team@example.com"],
            }
        ],
        "severity": "high",
        "category": "Security",
        "tags": ["owasp", "security", "vulnerability"],
    },
    "license_compliance": {
        "name": "Open Source License Compliance",
        "description": "Ensures compliance with open source license requirements",
        "rule_type": PolicyRuleType.LICENSE,
        "conditions": [
            {
                "id": "license_001",
                "name": "No GPL Licenses",
                "description": "Prevents use of GPL-licensed dependencies",
                "conditions": [
                    {
                        "field": "package.license",
                        "operator": PolicyOperator.IN.value,
                        "value": ["GPL-2.0", "GPL-3.0", "AGPL-3.0"],
                    }
                ],
                "actions": [
                    {
                        "type": PolicyAction.REQUIRE_APPROVAL.value,
                        "message": "GPL license requires legal approval",
                    }
                ],
                "severity": "high",
                "enabled": True,
            },
            {
                "id": "license_002",
                "name": "Valid License Required",
                "description": "Ensures all dependencies have a valid license",
                "conditions": [
                    {
                        "field": "package.license",
                        "operator": PolicyOperator.IS_NULL.value,
                    }
                ],
                "actions": [
                    {
                        "type": PolicyAction.WARN.value,
                        "message": "Dependency has no license specified",
                    }
                ],
                "severity": "medium",
                "enabled": True,
            },
        ],
        "actions": [
            {
                "type": PolicyAction.NOTIFY.value,
                "recipients": ["legal-team@example.com"],
            }
        ],
        "severity": "medium",
        "category": "Legal",
        "tags": ["license", "compliance", "legal"],
    },
    "version_stability": {
        "name": "Version Stability Policy",
        "description": "Ensures dependency versions are stable and tested",
        "rule_type": PolicyRuleType.VERSION,
        "conditions": [
            {
                "id": "version_001",
                "name": "No Pre-release Versions",
                "description": "Prevents use of pre-release or beta versions",
                "conditions": [
                    {
                        "field": "package.version",
                        "operator": PolicyOperator.REGEX.value,
                        "value": r"-(alpha|beta|rc|snapshot)",
                    }
                ],
                "actions": [
                    {
                        "type": PolicyAction.WARN.value,
                        "message": "Pre-release version detected",
                    }
                ],
                "severity": "low",
                "enabled": True,
            },
            {
                "id": "version_002",
                "name": "Minimum Version Age",
                "description": "Ensures package versions have been available for at least 30 days",
                "conditions": [
                    {
                        "field": "package.version_published_at",
                        "operator": PolicyOperator.LESS_THAN.value,
                        "value": "30 days ago",
                    }
                ],
                "actions": [
                    {
                        "type": PolicyAction.WARN.value,
                        "message": "Very recent version - consider waiting",
                    }
                ],
                "severity": "low",
                "enabled": True,
            },
        ],
        "actions": [],
        "severity": "low",
        "category": "Quality",
        "tags": ["version", "stability", "quality"],
    },
    "nist_csf": {
        "name": "NIST Cybersecurity Framework",
        "description": "Policy template aligned with NIST CSF requirements",
        "rule_type": PolicyRuleType.COMPLIANCE,
        "conditions": [
            {
                "id": "nist_001",
                "name": "Asset Management",
                "description": "Ensures all dependencies are properly tracked",
                "conditions": [
                    {
                        "field": "dependency.is_tracked",
                        "operator": PolicyOperator.EQUALS.value,
                        "value": False,
                    }
                ],
                "actions": [
                    {
                        "type": PolicyAction.WARN.value,
                        "message": "Untracked dependency detected",
                    }
                ],
                "severity": "medium",
                "enabled": True,
            },
            {
                "id": "nist_002",
                "name": "Risk Assessment",
                "description": "Ensures dependencies have been risk assessed",
                "conditions": [
                    {
                        "field": "dependency.risk_assessed",
                        "operator": PolicyOperator.EQUALS.value,
                        "value": False,
                    }
                ],
                "actions": [
                    {
                        "type": PolicyAction.REQUIRE_APPROVAL.value,
                        "message": "Dependency requires risk assessment",
                    }
                ],
                "severity": "high",
                "enabled": True,
            },
        ],
        "actions": [
            {"type": PolicyAction.NOTIFY.value, "recipients": ["risk-team@example.com"]}
        ],
        "severity": "high",
        "category": "Compliance",
        "tags": ["nist", "cybersecurity", "risk"],
    },
}


async def create_policy_from_template(
    policy_service: PolicyService,
    template_name: str,
    organization_id: Optional[UUID] = None,
    framework_id: Optional[UUID] = None,
    **overrides,
) -> Policy:
    """Create a policy from a predefined template."""
    if template_name not in POLICY_TEMPLATES:
        raise ValueError(f"Unknown policy template: {template_name}")

    template = POLICY_TEMPLATES[template_name]

    # Apply any overrides
    template = {**template, **overrides}

    return await policy_service.create_policy(
        organization_id=organization_id, framework_id=framework_id, **template
    )
