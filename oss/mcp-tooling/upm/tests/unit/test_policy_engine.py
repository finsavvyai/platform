"""
Unit tests for Policy Engine functionality

Tests cover:
- Policy condition evaluation
- Policy rule evaluation
- Policy service operations
- Policy template creation
- Policy evaluation scenarios
"""

import pytest
from datetime import datetime, timedelta
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from udp.core.models.policy import (
    Policy,
    PolicyEvaluationStatus,
    PolicyFramework,
    PolicyRuleType,
    PolicyStatus,
)
from udp.services.policy_service import (
    POLICY_TEMPLATES,
    PolicyAction,
    PolicyCondition,
    PolicyOperator,
    PolicyRule,
    PolicyService,
    create_policy_from_template,
)


class TestPolicyCondition:
    """Test policy condition evaluation."""

    def test_equals_operator(self):
        """Test equals operator."""
        condition = PolicyCondition("package.name", PolicyOperator.EQUALS, "requests")

        # Test positive case
        context = {"package": {"name": "requests"}}
        assert condition.evaluate(context) == True

        # Test negative case
        context = {"package": {"name": "flask"}}
        assert condition.evaluate(context) == False

    def test_not_equals_operator(self):
        """Test not equals operator."""
        condition = PolicyCondition(
            "package.version", PolicyOperator.NOT_EQUALS, "1.0.0"
        )

        context = {"package": {"version": "2.0.0"}}
        assert condition.evaluate(context) == True

        context = {"package": {"version": "1.0.0"}}
        assert condition.evaluate(context) == False

    def test_greater_than_operator(self):
        """Test greater than operator."""
        condition = PolicyCondition(
            "vulnerability.cvss_score", PolicyOperator.GREATER_THAN, 7.0
        )

        context = {"vulnerability": {"cvss_score": 8.5}}
        assert condition.evaluate(context) == True

        context = {"vulnerability": {"cvss_score": 6.5}}
        assert condition.evaluate(context) == False

    def test_contains_operator(self):
        """Test contains operator."""
        condition = PolicyCondition("package.license", PolicyOperator.CONTAINS, "MIT")

        context = {"package": {"license": "MIT License"}}
        assert condition.evaluate(context) == True

        context = {"package": {"license": "Apache-2.0"}}
        assert condition.evaluate(context) == False

    def test_in_operator(self):
        """Test in operator."""
        condition = PolicyCondition(
            "package.license", PolicyOperator.IN, ["MIT", "Apache-2.0", "BSD"]
        )

        context = {"package": {"license": "MIT"}}
        assert condition.evaluate(context) == True

        context = {"package": {"license": "GPL-3.0"}}
        assert condition.evaluate(context) == False

    def test_regex_operator(self):
        """Test regex operator."""
        condition = PolicyCondition(
            "package.version", PolicyOperator.REGEX, r"^\d+\.\d+\.\d+$"
        )

        context = {"package": {"version": "1.2.3"}}
        assert condition.evaluate(context) == True

        context = {"package": {"version": "1.2.3-alpha"}}
        assert condition.evaluate(context) == False

    def test_starts_with_operator(self):
        """Test starts with operator."""
        condition = PolicyCondition("package.name", PolicyOperator.STARTS_WITH, "react")

        context = {"package": {"name": "react-dom"}}
        assert condition.evaluate(context) == True

        context = {"package": {"name": "vue"}}
        assert condition.evaluate(context) == False

    def test_between_operator(self):
        """Test between operator."""
        condition = PolicyCondition(
            "package.age_days", PolicyOperator.BETWEEN, [30, 365]
        )

        context = {"package": {"age_days": 100}}
        assert condition.evaluate(context) == True

        context = {"package": {"age_days": 20}}
        assert condition.evaluate(context) == False

        context = {"package": {"age_days": 400}}
        assert condition.evaluate(context) == False

    def test_is_null_operator(self):
        """Test is null operator."""
        condition = PolicyCondition("package.license", PolicyOperator.IS_NULL)

        context = {"package": {}}
        assert condition.evaluate(context) == True

        context = {"package": {"license": None}}
        assert condition.evaluate(context) == True

        context = {"package": {"license": "MIT"}}
        assert condition.evaluate(context) == False

    def test_nested_field_access(self):
        """Test nested field access with dot notation."""
        condition = PolicyCondition(
            "dependency.vulnerability.severity", PolicyOperator.EQUALS, "critical"
        )

        context = {"dependency": {"vulnerability": {"severity": "critical"}}}
        assert condition.evaluate(context) == True

        context = {"dependency": {"vulnerability": {"severity": "medium"}}}
        assert condition.evaluate(context) == False


class TestPolicyRule:
    """Test policy rule evaluation."""

    def test_single_condition_rule(self):
        """Test rule with single condition."""
        rule = PolicyRule(
            rule_id="rule1",
            name="Block critical vulnerabilities",
            conditions=[
                PolicyCondition(
                    "vulnerability.severity", PolicyOperator.EQUALS, "critical"
                )
            ],
            actions=[{"type": "block", "message": "Critical vulnerability detected"}],
            severity="critical",
        )

        context = {"vulnerability": {"severity": "critical"}}
        triggered, actions = rule.evaluate(context)
        assert triggered == True
        assert len(actions) == 1

        context = {"vulnerability": {"severity": "medium"}}
        triggered, actions = rule.evaluate(context)
        assert triggered == False
        assert len(actions) == 0

    def test_multiple_and_conditions(self):
        """Test rule with multiple AND conditions."""
        rule = PolicyRule(
            rule_id="rule2",
            name="Block old critical vulnerabilities",
            conditions=[
                PolicyCondition(
                    "vulnerability.severity", PolicyOperator.EQUALS, "critical"
                ),
                PolicyCondition(
                    "vulnerability.published_days_ago", PolicyOperator.GREATER_THAN, 90
                ),
            ],
            actions=[{"type": "block", "message": "Old critical vulnerability"}],
        )

        # Both conditions true
        context = {"vulnerability": {"severity": "critical", "published_days_ago": 100}}
        triggered, actions = rule.evaluate(context)
        assert triggered == True

        # One condition false
        context = {"vulnerability": {"severity": "critical", "published_days_ago": 30}}
        triggered, actions = rule.evaluate(context)
        assert triggered == False

    def test_multiple_or_conditions(self):
        """Test rule with multiple OR conditions."""
        rule = PolicyRule(
            rule_id="rule3",
            name="Block GPL or AGPL licenses",
            conditions=[
                PolicyCondition(
                    "package.license", PolicyOperator.EQUALS, "GPL-3.0", "OR"
                ),
                PolicyCondition(
                    "package.license", PolicyOperator.EQUALS, "AGPL-3.0", "OR"
                ),
            ],
            actions=[{"type": "require_approval", "message": "Copyleft license"}],
        )

        # First OR condition true
        context = {"package": {"license": "GPL-3.0"}}
        triggered, actions = rule.evaluate(context)
        assert triggered == True

        # Second OR condition true
        context = {"package": {"license": "AGPL-3.0"}}
        triggered, actions = rule.evaluate(context)
        assert triggered == True

        # Neither condition true
        context = {"package": {"license": "MIT"}}
        triggered, actions = rule.evaluate(context)
        assert triggered == False

    def test_mixed_and_or_conditions(self):
        """Test rule with mixed AND and OR conditions."""
        rule = PolicyRule(
            rule_id="rule4",
            name="Complex rule",
            conditions=[
                PolicyCondition(
                    "package.name", PolicyOperator.STARTS_WITH, "react", "AND"
                ),
                PolicyCondition(
                    "package.version", PolicyOperator.GREATER_THAN, "16.0.0", "AND"
                ),
                PolicyCondition(
                    "package.license", PolicyOperator.IN, ["MIT", "Apache-2.0"], "OR"
                ),
                PolicyCondition("package.license", PolicyOperator.IN, ["BSD"], "OR"),
            ],
            actions=[{"type": "warn", "message": "Check React version"}],
        )

        # All conditions satisfied
        context = {
            "package": {"name": "react-dom", "version": "17.0.0", "license": "MIT"}
        }
        triggered, actions = rule.evaluate(context)
        assert triggered == True

        # OR condition satisfied
        context = {
            "package": {"name": "react-dom", "version": "17.0.0", "license": "BSD"}
        }
        triggered, actions = rule.evaluate(context)
        assert triggered == True

        # One AND condition fails
        context = {
            "package": {"name": "react-dom", "version": "15.0.0", "license": "MIT"}
        }
        triggered, actions = rule.evaluate(context)
        assert triggered == False

    def test_disabled_rule(self):
        """Test disabled rule is not evaluated."""
        rule = PolicyRule(
            rule_id="rule5",
            name="Disabled rule",
            conditions=[
                PolicyCondition(
                    "vulnerability.severity", PolicyOperator.EQUALS, "critical"
                )
            ],
            actions=[{"type": "block"}],
            enabled=False,
        )

        context = {"vulnerability": {"severity": "critical"}}
        triggered, actions = rule.evaluate(context)
        assert triggered == False
        assert len(actions) == 0


class TestPolicyService:
    """Test policy service operations."""

    @pytest.fixture
    async def policy_service(self, db_session: AsyncSession):
        """Create policy service fixture."""
        return PolicyService(db_session)

    @pytest.fixture
    async def sample_organization(self, db_session: AsyncSession):
        """Create sample organization."""
        from udp.core.models.organization import Organization

        org = Organization(name="Test Organization", slug="test-org", domain="test.com")
        db_session.add(org)
        await db_session.flush()
        return org

    @pytest.fixture
    async def sample_project(self, db_session: AsyncSession, sample_organization):
        """Create sample project."""
        from udp.core.models.project import Project

        project = Project(
            organization_id=sample_organization.id,
            name="Test Project",
            slug="test-project",
            primary_language="python",
            ecosystem="pypi",
        )
        db_session.add(project)
        await db_session.flush()
        return project

    async def test_create_policy(
        self, policy_service: PolicyService, sample_organization
    ):
        """Test creating a policy."""
        policy = await policy_service.create_policy(
            name="Test Security Policy",
            description="Test policy for unit tests",
            rule_type=PolicyRuleType.SECURITY,
            conditions=[
                {
                    "field": "vulnerability.severity",
                    "operator": "equals",
                    "value": "critical",
                }
            ],
            actions=[{"type": "block", "message": "Critical vulnerability detected"}],
            organization_id=sample_organization.id,
        )

        assert policy is not None
        assert policy.name == "Test Security Policy"
        assert policy.rule_type == PolicyRuleType.SECURITY.value
        assert policy.organization_id == sample_organization.id
        assert policy.is_active == True

    async def test_get_policy(self, policy_service: PolicyService, sample_organization):
        """Test getting a policy by ID."""
        # Create policy
        created = await policy_service.create_policy(
            name="Get Test Policy",
            description="Policy for get test",
            rule_type=PolicyRuleType.LICENSE,
            conditions=[],
            actions=[],
            organization_id=sample_organization.id,
        )

        # Get policy
        retrieved = await policy_service.get_policy(created.id)
        assert retrieved is not None
        assert retrieved.id == created.id
        assert retrieved.name == "Get Test Policy"

    async def test_update_policy(
        self, policy_service: PolicyService, sample_organization
    ):
        """Test updating a policy."""
        # Create policy
        policy = await policy_service.create_policy(
            name="Original Policy",
            description="Original description",
            rule_type=PolicyRuleType.SECURITY,
            conditions=[],
            actions=[],
            organization_id=sample_organization.id,
        )

        # Update policy
        updated = await policy_service.update_policy(
            policy.id,
            name="Updated Policy",
            description="Updated description",
            severity="high",
        )

        assert updated is not None
        assert updated.name == "Updated Policy"
        assert updated.description == "Updated description"
        assert updated.severity == "high"

    async def test_delete_policy(
        self, policy_service: PolicyService, sample_organization
    ):
        """Test deleting a policy."""
        # Create policy
        policy = await policy_service.create_policy(
            name="Delete Test Policy",
            description="Policy to delete",
            rule_type=PolicyRuleType.VERSION,
            conditions=[],
            actions=[],
            organization_id=sample_organization.id,
        )

        # Delete policy
        success = await policy_service.delete_policy(policy.id)
        assert success == True

        # Check policy is soft deleted
        deleted = await policy_service.get_policy(policy.id)
        assert deleted is None

    async def test_list_policies(
        self, policy_service: PolicyService, sample_organization
    ):
        """Test listing policies with filters."""
        # Create multiple policies
        await policy_service.create_policy(
            name="Security Policy 1",
            description="First security policy",
            rule_type=PolicyRuleType.SECURITY,
            conditions=[],
            actions=[],
            organization_id=sample_organization.id,
        )

        await policy_service.create_policy(
            name="License Policy 1",
            description="First license policy",
            rule_type=PolicyRuleType.LICENSE,
            conditions=[],
            actions=[],
            organization_id=sample_organization.id,
        )

        # List all policies
        all_policies = await policy_service.list_policies()
        assert len(all_policies) >= 2

        # Filter by rule type
        security_policies = await policy_service.list_policies(
            rule_type=PolicyRuleType.SECURITY
        )
        assert all(
            p.rule_type == PolicyRuleType.SECURITY.value for p in security_policies
        )

        # Filter by organization
        org_policies = await policy_service.list_policies(
            organization_id=sample_organization.id
        )
        assert all(p.organization_id == sample_organization.id for p in org_policies)

    async def test_create_framework(self, policy_service: PolicyService):
        """Test creating a policy framework."""
        framework = await policy_service.create_framework(
            name="Test Framework",
            slug="test-framework",
            description="Framework for testing",
            framework_type=PolicyFramework.CUSTOM,
            version="1.0.0",
            requirements=[
                {"id": "req1", "name": "Requirement 1"},
                {"id": "req2", "name": "Requirement 2"},
            ],
        )

        assert framework is not None
        assert framework.name == "Test Framework"
        assert framework.slug == "test-framework"
        assert framework.framework_type == PolicyFramework.CUSTOM.value
        assert len(framework.requirements) == 2

    async def test_evaluate_policies(
        self,
        policy_service: PolicyService,
        sample_project: "Project",
        sample_organization,
    ):
        """Test policy evaluation."""
        # Create test policy
        policy = await policy_service.create_policy(
            name="Test Evaluation Policy",
            description="Policy for evaluation testing",
            rule_type=PolicyRuleType.SECURITY,
            conditions=[
                {
                    "id": "rule1",
                    "name": "Block Critical Vulnerabilities",
                    "conditions": [
                        {
                            "field": "vulnerability.max_severity",
                            "operator": "equals",
                            "value": "critical",
                        }
                    ],
                    "actions": [{"type": "block"}],
                    "severity": "critical",
                }
            ],
            actions=[{"type": "notify"}],
            organization_id=sample_organization.id,
        )

        # Evaluate with violation
        context_with_violation = {
            "vulnerability": {"max_severity": "critical", "count": 1}
        }

        evaluations = await policy_service.evaluate_policies(
            project_id=sample_project.id,
            target_type="dependency",
            context=context_with_violation,
        )

        assert len(evaluations) == 1
        assert evaluations[0].policy_id == policy.id
        assert evaluations[0].violation_detected == True
        assert evaluations[0].status == PolicyEvaluationStatus.FAIL.value

        # Evaluate without violation
        context_without_violation = {
            "vulnerability": {"max_severity": "medium", "count": 2}
        }

        evaluations = await policy_service.evaluate_policies(
            project_id=sample_project.id,
            target_type="dependency",
            context=context_without_violation,
        )

        assert len(evaluations) == 1
        assert evaluations[0].violation_detected == False
        assert evaluations[0].status == PolicyEvaluationStatus.PASS.value


class TestPolicyTemplates:
    """Test policy template functionality."""

    @pytest.fixture
    async def policy_service(self, db_session: AsyncSession):
        """Create policy service fixture."""
        return PolicyService(db_session)

    async def test_owasp_template(self, policy_service: PolicyService):
        """Test OWASP policy template creation."""
        policy = await create_policy_from_template(
            policy_service=policy_service,
            template_name="owasp_security",
            name="Custom OWASP Policy",
        )

        assert policy is not None
        assert policy.name == "Custom OWASP Policy"
        assert policy.rule_type == PolicyRuleType.SECURITY.value
        assert policy.category == "Security"
        assert "owasp" in policy.tags
        assert "security" in policy.tags

    async def test_license_template(self, policy_service: PolicyService):
        """Test license compliance template."""
        policy = await create_policy_from_template(
            policy_service=policy_service, template_name="license_compliance"
        )

        assert policy is not None
        assert policy.rule_type == PolicyRuleType.LICENSE.value
        assert policy.category == "Legal"
        assert "license" in policy.tags
        assert "compliance" in policy.tags

    async def test_version_stability_template(self, policy_service: PolicyService):
        """Test version stability template."""
        policy = await create_policy_from_template(
            policy_service=policy_service, template_name="version_stability"
        )

        assert policy is not None
        assert policy.rule_type == PolicyRuleType.VERSION.value
        assert policy.category == "Quality"
        assert "version" in policy.tags
        assert "stability" in policy.tags

    async def test_nist_csf_template(self, policy_service: PolicyService):
        """Test NIST Cybersecurity Framework template."""
        policy = await create_policy_from_template(
            policy_service=policy_service, template_name="nist_csf"
        )

        assert policy is not None
        assert policy.rule_type == PolicyRuleType.COMPLIANCE.value
        assert policy.category == "Compliance"
        assert "nist" in policy.tags
        assert "cybersecurity" in policy.tags

    async def test_template_with_overrides(self, policy_service: PolicyService):
        """Test template creation with overrides."""
        overrides = {
            "name": "Overridden OWASP Policy",
            "severity": "critical",
            "auto_enforce": True,
            "tags": ["custom", "security", "high-priority"],
        }

        policy = await create_policy_from_template(
            policy_service=policy_service, template_name="owasp_security", **overrides
        )

        assert policy.name == "Overridden OWASP Policy"
        assert policy.severity == "critical"
        assert policy.auto_enforce == True
        assert "custom" in policy.tags
        assert "high-priority" in policy.tags

    async def test_invalid_template(self, policy_service: PolicyService):
        """Test creation with invalid template name."""
        with pytest.raises(ValueError, match="Unknown policy template"):
            await create_policy_from_template(
                policy_service=policy_service, template_name="invalid_template"
            )


class TestPolicyEvaluationScenarios:
    """Test complex policy evaluation scenarios."""

    @pytest.fixture
    async def policy_service(self, db_session: AsyncSession):
        """Create policy service fixture."""
        return PolicyService(db_session)

    @pytest.fixture
    async def test_project(self, db_session: AsyncSession):
        """Create test project."""
        from udp.core.models.organization import Organization
        from udp.core.models.project import Project

        org = Organization(name="Test Org", slug="test-org")
        db_session.add(org)
        await db_session.flush()

        project = Project(
            organization_id=org.id,
            name="Test Project",
            slug="test-project",
            primary_language="python",
            ecosystem="pypi",
        )
        db_session.add(project)
        await db_session.flush()
        return project

    async def test_security_vulnerability_scenario(
        self, policy_service: PolicyService, test_project: "Project"
    ):
        """Test security vulnerability evaluation scenario."""
        # Create security policy
        policy = await policy_service.create_policy(
            name="Security Vulnerability Policy",
            description="Block dependencies with critical or high vulnerabilities",
            rule_type=PolicyRuleType.SECURITY,
            conditions=[
                {
                    "id": "critical_vuln",
                    "name": "Block Critical Vulnerabilities",
                    "conditions": [
                        {
                            "field": "vulnerability.max_severity",
                            "operator": "equals",
                            "value": "critical",
                        }
                    ],
                    "actions": [
                        {"type": "block", "message": "Critical vulnerability detected"}
                    ],
                    "severity": "critical",
                },
                {
                    "id": "high_vuln",
                    "name": "Warn on High Vulnerabilities",
                    "conditions": [
                        {
                            "field": "vulnerability.max_severity",
                            "operator": "equals",
                            "value": "high",
                        }
                    ],
                    "actions": [
                        {"type": "warn", "message": "High vulnerability detected"}
                    ],
                    "severity": "high",
                },
            ],
            actions=[{"type": "notify", "recipients": ["security@example.com"]}],
        )

        # Test critical vulnerability scenario
        critical_context = {
            "package": {"name": "vulnerable-package", "version": "1.0.0"},
            "vulnerability": {
                "max_severity": "critical",
                "count": 1,
                "cvss_score": 9.8,
            },
        }

        evaluations = await policy_service.evaluate_policies(
            project_id=test_project.id,
            target_type="dependency",
            context=critical_context,
        )

        assert len(evaluations) == 1
        assert evaluations[0].violation_detected == True
        assert evaluations[0].status == PolicyEvaluationStatus.FAIL.value
        violations = evaluations[0].violation_details or []
        assert len(violations) == 1
        assert violations[0]["rule_id"] == "critical_vuln"
        assert violations[0]["severity"] == "critical"

    async def test_license_compliance_scenario(
        self, policy_service: PolicyService, test_project: "Project"
    ):
        """Test license compliance evaluation scenario."""
        # Create license policy
        policy = await policy_service.create_policy(
            name="License Compliance Policy",
            description="Ensure license compliance requirements",
            rule_type=PolicyRuleType.LICENSE,
            conditions=[
                {
                    "id": "no_gpl",
                    "name": "Block GPL Licenses",
                    "conditions": [
                        {
                            "field": "package.license",
                            "operator": "in",
                            "value": ["GPL-2.0", "GPL-3.0", "AGPL-3.0"],
                        }
                    ],
                    "actions": [
                        {
                            "type": "require_approval",
                            "message": "GPL license requires approval",
                        }
                    ],
                    "severity": "high",
                },
                {
                    "id": "valid_license",
                    "name": "Require Valid License",
                    "conditions": [{"field": "package.license", "operator": "is_null"}],
                    "actions": [{"type": "warn", "message": "No license specified"}],
                    "severity": "medium",
                },
            ],
        )

        # Test GPL license scenario
        gpl_context = {
            "package": {"name": "gpl-package", "version": "2.0.0", "license": "GPL-3.0"}
        }

        evaluations = await policy_service.evaluate_policies(
            project_id=test_project.id, target_type="dependency", context=gpl_context
        )

        assert len(evaluations) == 1
        assert evaluations[0].violation_detected == True
        violations = evaluations[0].violation_details or []
        assert len(violations) == 1
        assert violations[0]["rule_id"] == "no_gpl"

    async def test_complex_combined_scenario(
        self, policy_service: PolicyService, test_project: "Project"
    ):
        """Test complex scenario with multiple policy types."""
        # Create security policy
        security_policy = await policy_service.create_policy(
            name="Security Policy",
            description="Security vulnerability checks",
            rule_type=PolicyRuleType.SECURITY,
            conditions=[
                {
                    "id": "vuln_check",
                    "name": "Check Vulnerabilities",
                    "conditions": [
                        {
                            "field": "vulnerability.count",
                            "operator": "greater_than",
                            "value": 0,
                        }
                    ],
                    "actions": [{"type": "warn"}],
                    "severity": "medium",
                }
            ],
        )

        # Create license policy
        license_policy = await policy_service.create_policy(
            name="License Policy",
            description="License compliance checks",
            rule_type=PolicyRuleType.LICENSE,
            conditions=[
                {
                    "id": "license_check",
                    "name": "Check License",
                    "conditions": [
                        {
                            "field": "package.license",
                            "operator": "equals",
                            "value": "MIT",
                        }
                    ],
                    "actions": [{"type": "allow"}],
                    "severity": "low",
                }
            ],
        )

        # Complex context with vulnerabilities and MIT license
        complex_context = {
            "package": {
                "name": "complex-package",
                "version": "1.5.0",
                "license": "MIT",
            },
            "vulnerability": {"count": 2, "max_severity": "medium", "cvss_score": 5.5},
        }

        evaluations = await policy_service.evaluate_policies(
            project_id=test_project.id,
            target_type="dependency",
            context=complex_context,
        )

        assert len(evaluations) == 2

        # Security policy should have violation
        security_eval = next(
            e for e in evaluations if e.policy_id == security_policy.id
        )
        assert security_eval.violation_detected == True
        assert security_eval.status == PolicyEvaluationStatus.WARNING.value

        # License policy should pass
        license_eval = next(e for e in evaluations if e.policy_id == license_policy.id)
        assert license_eval.violation_detected == False
        assert license_eval.status == PolicyEvaluationStatus.PASS.value
