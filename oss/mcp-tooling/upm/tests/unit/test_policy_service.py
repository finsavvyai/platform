"""
Unit tests for Policy Service and Policy Engine functionality.

Tests cover:
- Policy CRUD operations
- Policy condition evaluation
- Policy rule evaluation
- Policy framework management
- Policy templates
- Policy evaluation engine
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
    PolicyAction,
    PolicyCondition,
    PolicyOperator,
    PolicyRule,
    PolicyService,
    POLICY_TEMPLATES,
    create_policy_from_template,
)


@pytest.fixture
async def policy_service(async_session: AsyncSession):
    """Create policy service fixture."""
    return PolicyService(async_session)


@pytest.fixture
async def test_organization(async_session):
    """Create test organization."""
    from udp.core.models import Organization

    org = Organization(name="Test Org", slug="test-org", domain="testorg.com")
    async_session.add(org)
    await async_session.flush()
    return org


@pytest.fixture
async def test_project(async_session, test_organization):
    """Create test project."""
    from udp.core.models import Project

    project = Project(
        organization_id=test_organization.id,
        name="Test Project",
        slug="test-project",
        primary_language="python",
        ecosystem="pypi",
    )
    async_session.add(project)
    await async_session.flush()
    return project


class TestPolicyCondition:
    """Test policy condition evaluation."""

    def test_string_equals_condition(self):
        """Test string equality condition."""
        condition = PolicyCondition("license", PolicyOperator.EQUALS, "MIT")

        # Test positive case
        context = {"package": {"license": "MIT"}}
        assert condition.evaluate(context) == True

        # Test negative case
        context = {"package": {"license": "Apache-2.0"}}
        assert condition.evaluate(context) == False

    def test_numeric_comparison_conditions(self):
        """Test numeric comparison conditions."""
        # Greater than
        condition = PolicyCondition(
            "vulnerability.cvss_score", PolicyOperator.GREATER_THAN, 7.0
        )
        context = {"vulnerability": {"cvss_score": 8.5}}
        assert condition.evaluate(context) == True

        context = {"vulnerability": {"cvss_score": 6.0}}
        assert condition.evaluate(context) == False

        # Between
        condition = PolicyCondition(
            "package.age_days", PolicyOperator.BETWEEN, [30, 365]
        )
        context = {"package": {"age_days": 100}}
        assert condition.evaluate(context) == True

        context = {"package": {"age_days": 20}}
        assert condition.evaluate(context) == False

    def test_list_operations(self):
        """Test list-based operations."""
        # IN operator
        condition = PolicyCondition(
            "license", PolicyOperator.IN, ["MIT", "Apache-2.0", "BSD"]
        )
        context = {"license": "MIT"}
        assert condition.evaluate(context) == True

        context = {"license": "GPL-3.0"}
        assert condition.evaluate(context) == False

        # Contains operator
        condition = PolicyCondition("tags", PolicyOperator.CONTAINS, "security")
        context = {"tags": ["security", "network", "auth"]}
        assert condition.evaluate(context) == True

        context = {"tags": ["network", "auth"]}
        assert condition.evaluate(context) == False

    def test_regex_condition(self):
        """Test regex condition."""
        condition = PolicyCondition(
            "package.version", PolicyOperator.REGEX, r"^\d+\.\d+\.\d+$"
        )

        # Valid semantic version
        context = {"package": {"version": "1.2.3"}}
        assert condition.evaluate(context) == True

        # Pre-release version
        context = {"package": {"version": "1.2.3-alpha"}}
        assert condition.evaluate(context) == False

        # Invalid version
        context = {"package": {"version": "latest"}}
        assert condition.evaluate(context) == False

    def test_null_conditions(self):
        """Test null check conditions."""
        # IS NULL
        condition = PolicyCondition("license", PolicyOperator.IS_NULL)
        context = {"license": None}
        assert condition.evaluate(context) == True

        context = {"license": "MIT"}
        assert condition.evaluate(context) == False

        # IS NOT NULL
        condition = PolicyCondition("license", PolicyOperator.IS_NOT_NULL)
        context = {"license": "MIT"}
        assert condition.evaluate(context) == True

        context = {"license": None}
        assert condition.evaluate(context) == False

    def test_string_operations(self):
        """Test string operations."""
        # Starts with
        condition = PolicyCondition("package.name", PolicyOperator.STARTS_WITH, "react")
        context = {"package": {"name": "react-router"}}
        assert condition.evaluate(context) == True

        context = {"package": {"name": "vue-router"}}
        assert condition.evaluate(context) == False

        # Ends with
        condition = PolicyCondition("package.name", PolicyOperator.ENDS_WITH, "router")
        context = {"package": {"name": "react-router"}}
        assert condition.evaluate(context) == True

        context = {"package": {"name": "react-dom"}}
        assert condition.evaluate(context) == False

    def test_nested_field_access(self):
        """Test nested field access with dot notation."""
        condition = PolicyCondition(
            "package.metadata.author.name", PolicyOperator.EQUALS, "John Doe"
        )

        context = {
            "package": {
                "metadata": {
                    "author": {"name": "John Doe", "email": "john@example.com"}
                }
            }
        }
        assert condition.evaluate(context) == True

        # Test missing nested field
        context = {"package": {"metadata": {"author": {"email": "john@example.com"}}}}
        assert condition.evaluate(context) == False


class TestPolicyRule:
    """Test policy rule evaluation."""

    def test_single_condition_rule(self):
        """Test rule with single condition."""
        rule = PolicyRule(
            rule_id="rule-1",
            name="High CVSS Score",
            conditions=[
                PolicyCondition(
                    "vulnerability.cvss_score", PolicyOperator.GREATER_THAN, 7.0
                )
            ],
            actions=[
                {
                    "type": PolicyAction.BLOCK.value,
                    "message": "High CVSS score detected",
                }
            ],
            severity="critical",
        )

        # Should trigger
        context = {"vulnerability": {"cvss_score": 8.5}}
        triggered, actions = rule.evaluate(context)
        assert triggered == True
        assert len(actions) == 1
        assert actions[0]["type"] == PolicyAction.BLOCK.value

        # Should not trigger
        context = {"vulnerability": {"cvss_score": 6.0}}
        triggered, actions = rule.evaluate(context)
        assert triggered == False
        assert len(actions) == 0

    def test_multiple_and_conditions(self):
        """Test rule with multiple AND conditions."""
        rule = PolicyRule(
            rule_id="rule-2",
            name="Old Unmaintained Package",
            conditions=[
                PolicyCondition("package.age_days", PolicyOperator.GREATER_THAN, 365),
                PolicyCondition("package.maintained", PolicyOperator.EQUALS, False),
                PolicyCondition("dependency.is_direct", PolicyOperator.EQUALS, True),
            ],
            actions=[
                {
                    "type": PolicyAction.WARN.value,
                    "message": "Old unmaintained direct dependency",
                }
            ],
        )

        # Should trigger (all conditions met)
        context = {
            "package": {"age_days": 400, "maintained": False},
            "dependency": {"is_direct": True},
        }
        triggered, actions = rule.evaluate(context)
        assert triggered == True

        # Should not trigger (one condition fails)
        context = {
            "package": {"age_days": 400, "maintained": True},  # maintained = True
            "dependency": {"is_direct": True},
        }
        triggered, actions = rule.evaluate(context)
        assert triggered == False

    def test_multiple_or_conditions(self):
        """Test rule with multiple OR conditions."""
        rule = PolicyRule(
            rule_id="rule-3",
            name="Risk Indicators",
            conditions=[
                PolicyCondition(
                    "vulnerability.max_severity",
                    PolicyOperator.EQUALS,
                    "critical",
                    "OR",
                ),
                PolicyCondition(
                    "license", PolicyOperator.IN, ["GPL-3.0", "AGPL-3.0"], "OR"
                ),
                PolicyCondition(
                    "package.maintained", PolicyOperator.EQUALS, False, "OR"
                ),
            ],
            actions=[
                {
                    "type": PolicyAction.REQUIRE_APPROVAL.value,
                    "message": "Risk indicators detected",
                }
            ],
        )

        # Should trigger (first condition)
        context = {
            "vulnerability": {"max_severity": "critical"},
            "license": "MIT",
            "package": {"maintained": True},
        }
        triggered, actions = rule.evaluate(context)
        assert triggered == True

        # Should trigger (second condition)
        context = {
            "vulnerability": {"max_severity": "medium"},
            "license": "GPL-3.0",
            "package": {"maintained": True},
        }
        triggered, actions = rule.evaluate(context)
        assert triggered == True

        # Should not trigger (no conditions met)
        context = {
            "vulnerability": {"max_severity": "medium"},
            "license": "MIT",
            "package": {"maintained": True},
        }
        triggered, actions = rule.evaluate(context)
        assert triggered == False

    def test_mixed_and_or_conditions(self):
        """Test rule with mixed AND and OR conditions."""
        rule = PolicyRule(
            rule_id="rule-4",
            name="Complex Rule",
            conditions=[
                PolicyCondition(
                    "dependency.is_direct", PolicyOperator.EQUALS, True, "AND"
                ),
                PolicyCondition(
                    "package.age_days", PolicyOperator.GREATER_THAN, 90, "AND"
                ),
                PolicyCondition(
                    "vulnerability.max_severity", PolicyOperator.EQUALS, "high", "OR"
                ),
                PolicyCondition("license", PolicyOperator.EQUALS, "UNKNOWN", "OR"),
            ],
        )

        # Should trigger (AND conditions met + first OR condition)
        context = {
            "dependency": {"is_direct": True},
            "package": {"age_days": 100},
            "vulnerability": {"max_severity": "high"},
            "license": "MIT",
        }
        triggered, actions = rule.evaluate(context)
        assert triggered == True

        # Should trigger (AND conditions met + second OR condition)
        context = {
            "dependency": {"is_direct": True},
            "package": {"age_days": 100},
            "vulnerability": {"max_severity": "medium"},
            "license": "UNKNOWN",
        }
        triggered, actions = rule.evaluate(context)
        assert triggered == True

        # Should not trigger (OR conditions not met)
        context = {
            "dependency": {"is_direct": True},
            "package": {"age_days": 100},
            "vulnerability": {"max_severity": "medium"},
            "license": "MIT",
        }
        triggered, actions = rule.evaluate(context)
        assert triggered == False

    def test_disabled_rule(self):
        """Test disabled rule does not trigger."""
        rule = PolicyRule(
            rule_id="rule-5",
            name="Disabled Rule",
            conditions=[
                PolicyCondition(
                    "vulnerability.cvss_score", PolicyOperator.GREATER_THAN, 0.0
                )
            ],
            actions=[{"type": PolicyAction.WARN.value}],
            enabled=False,
        )

        context = {"vulnerability": {"cvss_score": 9.0}}
        triggered, actions = rule.evaluate(context)
        assert triggered == False
        assert len(actions) == 0


class TestPolicyService:
    """Test policy service operations."""

    @pytest.mark.asyncio
    async def test_create_policy(self, policy_service, test_organization):
        """Test policy creation."""
        conditions = [
            {
                "field": "vulnerability.cvss_score",
                "operator": PolicyOperator.GREATER_THAN.value,
                "value": 7.0,
            }
        ]

        actions = [
            {"type": PolicyAction.BLOCK.value, "message": "Critical vulnerability"}
        ]

        policy = await policy_service.create_policy(
            name="Security Policy",
            description="Block critical vulnerabilities",
            rule_type=PolicyRuleType.SECURITY,
            conditions=conditions,
            actions=actions,
            organization_id=test_organization.id,
        )

        assert policy is not None
        assert policy.name == "Security Policy"
        assert policy.rule_type == PolicyRuleType.SECURITY.value
        assert policy.organization_id == test_organization.id
        assert policy.is_active == True
        assert policy.status == PolicyStatus.ACTIVE.value

    @pytest.mark.asyncio
    async def test_create_policy_validation(self, policy_service):
        """Test policy creation validation."""
        # Test missing name
        with pytest.raises(ValueError, match="Policy name is required"):
            await policy_service.create_policy(
                name="",
                description="Test",
                rule_type=PolicyRuleType.SECURITY,
                conditions=[{"field": "test", "operator": "eq", "value": "test"}],
                actions=[{"type": "warn"}],
            )

        # Test missing conditions
        with pytest.raises(ValueError, match="Policy must have at least one condition"):
            await policy_service.create_policy(
                name="Test Policy",
                description="Test",
                rule_type=PolicyRuleType.SECURITY,
                conditions=[],
                actions=[{"type": "warn"}],
            )

        # Test missing actions
        with pytest.raises(ValueError, match="Policy must have at least one action"):
            await policy_service.create_policy(
                name="Test Policy",
                description="Test",
                rule_type=PolicyRuleType.SECURITY,
                conditions=[{"field": "test", "operator": "eq", "value": "test"}],
                actions=[],
            )

    @pytest.mark.asyncio
    async def test_get_policy(self, policy_service, test_organization):
        """Test getting a policy by ID."""
        # Create a policy
        policy = await policy_service.create_policy(
            name="Test Policy",
            description="Test description",
            rule_type=PolicyRuleType.SECURITY,
            conditions=[{"field": "test", "operator": "eq", "value": "test"}],
            actions=[{"type": "warn"}],
            organization_id=test_organization.id,
        )

        # Get the policy
        retrieved = await policy_service.get_policy(policy.id)
        assert retrieved is not None
        assert retrieved.id == policy.id
        assert retrieved.name == "Test Policy"

        # Test non-existent policy
        non_existent = await policy_service.get_policy(uuid4())
        assert non_existent is None

    @pytest.mark.asyncio
    async def test_update_policy(self, policy_service, test_organization):
        """Test updating a policy."""
        # Create a policy
        policy = await policy_service.create_policy(
            name="Original Name",
            description="Original description",
            rule_type=PolicyRuleType.SECURITY,
            conditions=[{"field": "test", "operator": "eq", "value": "test"}],
            actions=[{"type": "warn"}],
            organization_id=test_organization.id,
        )

        # Update the policy
        updated = await policy_service.update_policy(
            policy.id,
            name="Updated Name",
            description="Updated description",
            severity="high",
        )

        assert updated is not None
        assert updated.name == "Updated Name"
        assert updated.description == "Updated description"
        assert updated.severity == "high"

    @pytest.mark.asyncio
    async def test_delete_policy(self, policy_service, test_organization):
        """Test deleting a policy."""
        # Create a policy
        policy = await policy_service.create_policy(
            name="To Delete",
            description="Will be deleted",
            rule_type=PolicyRuleType.SECURITY,
            conditions=[{"field": "test", "operator": "eq", "value": "test"}],
            actions=[{"type": "warn"}],
            organization_id=test_organization.id,
        )

        # Soft delete
        success = await policy_service.delete_policy(policy.id, hard_delete=False)
        assert success == True

        # Policy should still exist but be inactive
        deleted = await policy_service.get_policy(policy.id)
        assert deleted is not None
        assert deleted.deleted_at is not None
        assert deleted.is_active == False

        # Hard delete
        success = await policy_service.delete_policy(policy.id, hard_delete=True)
        assert success == True

    @pytest.mark.asyncio
    async def test_list_policies(self, policy_service, test_organization):
        """Test listing policies with filters."""
        # Create multiple policies
        policies = []
        for i in range(5):
            policy = await policy_service.create_policy(
                name=f"Policy {i}",
                description=f"Description {i}",
                rule_type=PolicyRuleType.SECURITY
                if i % 2 == 0
                else PolicyRuleType.LICENSE,
                conditions=[{"field": "test", "operator": "eq", "value": f"test{i}"}],
                actions=[{"type": "warn"}],
                organization_id=test_organization.id,
                tags=[f"tag{i % 3}"],
            )
            policies.append(policy)

        # List all policies
        all_policies = await policy_service.list_policies(
            organization_id=test_organization.id
        )
        assert len(all_policies) >= 5

        # Filter by rule type
        security_policies = await policy_service.list_policies(
            organization_id=test_organization.id, rule_type=PolicyRuleType.SECURITY
        )
        assert len(security_policies) >= 3  # 0, 2, 4

        # Filter by tags
        tagged_policies = await policy_service.list_policies(
            organization_id=test_organization.id, tags=["tag1"]
        )
        assert len(tagged_policies) >= 2  # 1, 4

    @pytest.mark.asyncio
    async def test_create_framework(self, policy_service):
        """Test creating a policy framework."""
        framework = await policy_service.create_framework(
            name="Test Framework",
            slug="test-framework",
            description="A test compliance framework",
            framework_type=PolicyFramework.CUSTOM,
            version="1.0.0",
            requirements=[
                {"id": "REQ-001", "name": "Requirement 1"},
                {"id": "REQ-002", "name": "Requirement 2"},
            ],
            controls=[{"id": "CTRL-001", "name": "Control 1"}],
        )

        assert framework is not None
        assert framework.name == "Test Framework"
        assert framework.slug == "test-framework"
        assert framework.framework_type == PolicyFramework.CUSTOM.value
        assert framework.is_active == True
        assert len(framework.requirements) == 2
        assert len(framework.controls) == 1

    @pytest.mark.asyncio
    async def test_evaluate_policies(self, policy_service, test_project):
        """Test policy evaluation."""
        # Create a test policy
        policy = await policy_service.create_policy(
            name="Test Security Policy",
            description="Block high CVSS scores",
            rule_type=PolicyRuleType.SECURITY,
            conditions=[
                {
                    "id": "rule-1",
                    "name": "High CVSS Score",
                    "conditions": [
                        {
                            "field": "vulnerability.cvss_score",
                            "operator": PolicyOperator.GREATER_THAN.value,
                            "value": 7.0,
                        }
                    ],
                    "actions": [{"type": PolicyAction.BLOCK.value}],
                    "severity": "critical",
                }
            ],
            actions=[{"type": PolicyAction.NOTIFY.value}],
        )

        # Create evaluation context with violation
        context = {
            "vulnerability": {"cvss_score": 8.5},
            "package": {"name": "test-package", "version": "1.0.0"},
        }

        # Evaluate policies
        evaluations = await policy_service.evaluate_policies(
            project_id=test_project.id, target_type="dependency", context=context
        )

        assert len(evaluations) == 1
        evaluation = evaluations[0]
        assert evaluation.policy_id == policy.id
        assert evaluation.status == PolicyEvaluationStatus.FAIL.value
        assert evaluation.violation_detected == True
        assert evaluation.violation_severity == "critical"

        # Create evaluation context without violation
        context = {
            "vulnerability": {"cvss_score": 5.0},
            "package": {"name": "test-package", "version": "1.0.0"},
        }

        # Evaluate policies
        evaluations = await policy_service.evaluate_policies(
            project_id=test_project.id, target_type="dependency", context=context
        )

        assert len(evaluations) == 1
        evaluation = evaluations[0]
        assert evaluation.status == PolicyEvaluationStatus.PASS.value
        assert evaluation.violation_detected == False


class TestPolicyTemplates:
    """Test policy templates."""

    def test_template_structure(self):
        """Test that templates have required structure."""
        for template_name, template in POLICY_TEMPLATES.items():
            assert "name" in template
            assert "description" in template
            assert "rule_type" in template
            assert "conditions" in template
            assert "actions" in template
            assert "severity" in template

            # Validate conditions structure
            for condition in template["conditions"]:
                assert "id" in condition
                assert "name" in condition
                assert "conditions" in condition
                assert "actions" in condition
                assert "severity" in condition

    @pytest.mark.asyncio
    async def test_create_from_template(self, policy_service, test_organization):
        """Test creating policy from template."""
        # Create from OWASP template
        policy = await create_policy_from_template(
            policy_service=policy_service,
            template_name="owasp_security",
            organization_id=test_organization.id,
        )

        assert policy is not None
        assert policy.name == "OWASP Top 10 Security Policy"
        assert policy.rule_type == PolicyRuleType.SECURITY.value
        assert policy.organization_id == test_organization.id
        assert len(policy.conditions) > 0

        # Test with overrides
        policy = await create_policy_from_template(
            policy_service=policy_service,
            template_name="license_compliance",
            organization_id=test_organization.id,
            overrides={
                "name": "Custom License Policy",
                "severity": "high",
                "category": "Legal Compliance",
            },
        )

        assert policy.name == "Custom License Policy"
        assert policy.severity == "high"
        assert policy.category == "Legal Compliance"

    @pytest.mark.asyncio
    async def test_invalid_template(self, policy_service):
        """Test creating policy from invalid template."""
        with pytest.raises(ValueError, match="Unknown policy template"):
            await create_policy_from_template(
                policy_service=policy_service, template_name="invalid_template"
            )


class TestPolicyIntegration:
    """Integration tests for policy service."""

    @pytest.mark.asyncio
    async def test_end_to_end_policy_workflow(
        self, policy_service, test_project, test_organization
    ):
        """Test complete policy workflow from creation to evaluation."""
        # 1. Create a framework
        framework = await policy_service.create_framework(
            name="Security Framework",
            slug="security-framework",
            description="Company security policies",
            framework_type=PolicyFramework.CUSTOM,
            version="1.0.0",
        )

        # 2. Create multiple policies
        security_policy = await policy_service.create_policy(
            name="No Critical Vulnerabilities",
            description="Block dependencies with critical CVEs",
            rule_type=PolicyRuleType.SECURITY,
            organization_id=test_organization.id,
            framework_id=framework.id,
            conditions=[
                {
                    "id": "no-critical",
                    "name": "No Critical Vulnerabilities",
                    "conditions": [
                        {
                            "field": "vulnerability.max_severity",
                            "operator": PolicyOperator.EQUALS.value,
                            "value": "critical",
                        }
                    ],
                    "actions": [{"type": PolicyAction.BLOCK.value}],
                    "severity": "critical",
                }
            ],
            actions=[
                {
                    "type": PolicyAction.NOTIFY.value,
                    "recipients": ["security@example.com"],
                }
            ],
            severity="critical",
            auto_enforce=True,
            requires_approval=False,
        )

        license_policy = await policy_service.create_policy(
            name="License Compliance",
            description="Ensure license compliance",
            rule_type=PolicyRuleType.LICENSE,
            organization_id=test_organization.id,
            conditions=[
                {
                    "id": "no-gpl",
                    "name": "No GPL Licenses",
                    "conditions": [
                        {
                            "field": "package.license",
                            "operator": PolicyOperator.IN.value,
                            "value": ["GPL-2.0", "GPL-3.0", "AGPL-3.0"],
                        }
                    ],
                    "actions": [{"type": PolicyAction.REQUIRE_APPROVAL.value}],
                    "severity": "high",
                }
            ],
            actions=[
                {"type": PolicyAction.NOTIFY.value, "recipients": ["legal@example.com"]}
            ],
            severity="high",
            requires_approval=True,
        )

        # 3. List policies
        policies = await policy_service.list_policies(
            organization_id=test_organization.id, framework_id=framework.id
        )
        assert len(policies) == 2

        # 4. Evaluate with multiple violations
        context = {
            "package": {
                "name": "problematic-package",
                "version": "1.0.0",
                "license": "GPL-3.0",
            },
            "vulnerability": {"max_severity": "critical", "cvss_score": 9.5},
            "dependency": {"is_direct": True, "scope": "runtime"},
        }

        evaluations = await policy_service.evaluate_policies(
            project_id=test_project.id, target_type="dependency", context=context
        )

        assert len(evaluations) == 2

        # Check security policy evaluation
        security_eval = next(
            e for e in evaluations if e.policy_id == security_policy.id
        )
        assert security_eval.violation_detected == True
        assert security_eval.violation_severity == "critical"
        assert security_eval.status == PolicyEvaluationStatus.FAIL.value

        # Check license policy evaluation
        license_eval = next(e for e in evaluations if e.policy_id == license_policy.id)
        assert license_eval.violation_detected == True
        assert license_eval.violation_severity == "high"
        assert license_eval.status == PolicyEvaluationStatus.WARNING.value

        # 5. Get policy evaluations
        eval_history = await policy_service.get_policy_evaluations(
            project_id=test_project.id, has_violation=True
        )
        assert len(eval_history) == 2

        # 6. Update a policy
        updated = await policy_service.update_policy(
            security_policy.id,
            severity="high",  # Downgrade from critical
            auto_enforce=False,
        )
        assert updated.severity == "high"
        assert updated.auto_enforce == False

        # 7. Delete a policy
        success = await policy_service.delete_policy(license_policy.id)
        assert success == True

        # Verify deletion
        remaining_policies = await policy_service.list_policies(
            organization_id=test_organization.id, is_active=True
        )
        assert len(remaining_policies) == 1
        assert remaining_policies[0].id == security_policy.id
