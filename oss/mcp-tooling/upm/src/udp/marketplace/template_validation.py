"""
Template Validation for Workflow Marketplace.

Validates workflow templates for security, functionality, and compliance
before they can be published to the marketplace.
"""

import logging
from typing import Any

from pydantic import BaseModel, Field

from .models import WorkflowTemplate

logger = logging.getLogger(__name__)


class ValidationResult(BaseModel):
    """Result of template validation."""
    is_valid: bool
    errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    details: dict[str, Any] = Field(default_factory=dict)


class SecurityReview(BaseModel):
    """Result of security review."""
    risk_level: str  # "low", "medium", "high", "critical"
    issues: list[dict[str, Any]] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
    details: dict[str, Any] = Field(default_factory=dict)


class PerformanceTest(BaseModel):
    """Result of performance testing."""
    execution_time: float
    memory_usage: float
    cpu_usage: float
    scalability_score: float
    bottlenecks: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)


class TemplateValidator:
    """Validates workflow templates for marketplace publication."""

    def __init__(self):
        self.max_execution_time = 300.0  # 5 minutes
        self.max_memory_usage = 1024.0   # 1GB
        self.max_cpu_usage = 80.0        # 80%
        self.min_scalability_score = 7.0  # Out of 10

    async def validate_template(self, template: WorkflowTemplate) -> ValidationResult:
        """
        Validate a workflow template for publication.

        Args:
            template: The template to validate

        Returns:
            Validation result with errors and warnings
        """
        try:
            logger.info(f"Validating template: {template.name}")

            errors = []
            warnings = []
            details = {}

            # Validate basic structure
            structure_result = await self._validate_structure(template)
            errors.extend(structure_result.errors)
            warnings.extend(structure_result.warnings)
            details["structure"] = structure_result.details

            # Validate workflow definition
            workflow_result = await self._validate_workflow_definition(template)
            errors.extend(workflow_result.errors)
            warnings.extend(workflow_result.warnings)
            details["workflow"] = workflow_result.details

            # Validate customization points
            customization_result = await self._validate_customization_points(template)
            errors.extend(customization_result.errors)
            warnings.extend(customization_result.warnings)
            details["customization"] = customization_result.details

            # Validate pricing
            pricing_result = await self._validate_pricing(template)
            errors.extend(pricing_result.errors)
            warnings.extend(pricing_result.warnings)
            details["pricing"] = pricing_result.details

            # Validate metadata
            metadata_result = await self._validate_metadata(template)
            errors.extend(metadata_result.errors)
            warnings.extend(metadata_result.warnings)
            details["metadata"] = metadata_result.details

            is_valid = len(errors) == 0

            logger.info(f"Template validation completed: {template.name}, valid: {is_valid}")

            return ValidationResult(
                is_valid=is_valid,
                errors=errors,
                warnings=warnings,
                details=details
            )

        except Exception as e:
            logger.error(f"Template validation failed: {e}", exc_info=True)
            return ValidationResult(
                is_valid=False,
                errors=[f"Validation failed: {str(e)}"],
                details={"error": str(e)}
            )

    async def conduct_security_review(self, template: WorkflowTemplate) -> SecurityReview:
        """
        Conduct security review of a workflow template.

        Args:
            template: The template to review

        Returns:
            Security review result
        """
        try:
            logger.info(f"Conducting security review for template: {template.name}")

            issues = []
            recommendations = []
            risk_level = "low"

            # Check for dangerous operations
            dangerous_ops = await self._check_dangerous_operations(template)
            if dangerous_ops:
                issues.extend(dangerous_ops)
                risk_level = "high"

            # Check for external dependencies
            external_deps = await self._check_external_dependencies(template)
            if external_deps:
                issues.extend(external_deps)
                if risk_level == "low":
                    risk_level = "medium"

            # Check for data handling
            data_issues = await self._check_data_handling(template)
            if data_issues:
                issues.extend(data_issues)
                if risk_level in ["low", "medium"]:
                    risk_level = "high"

            # Check for authentication/authorization
            auth_issues = await self._check_authentication(template)
            if auth_issues:
                issues.extend(auth_issues)
                if risk_level == "low":
                    risk_level = "medium"

            # Generate recommendations
            if risk_level == "high":
                recommendations.append("Review and remove dangerous operations")
                recommendations.append("Implement proper input validation")
                recommendations.append("Add authentication and authorization checks")
            elif risk_level == "medium":
                recommendations.append("Review external dependencies for security")
                recommendations.append("Implement proper error handling")
            else:
                recommendations.append("Template appears secure")

            logger.info(f"Security review completed: {template.name}, risk level: {risk_level}")

            return SecurityReview(
                risk_level=risk_level,
                issues=issues,
                recommendations=recommendations,
                details={
                    "dangerous_operations": len([i for i in issues if i.get("type") == "dangerous_operation"]),
                    "external_dependencies": len([i for i in issues if i.get("type") == "external_dependency"]),
                    "data_handling_issues": len([i for i in issues if i.get("type") == "data_handling"]),
                    "auth_issues": len([i for i in issues if i.get("type") == "authentication"])
                }
            )

        except Exception as e:
            logger.error(f"Security review failed: {e}", exc_info=True)
            return SecurityReview(
                risk_level="high",
                issues=[{"type": "review_error", "message": f"Security review failed: {str(e)}"}],
                recommendations=["Fix security review errors before publication"]
            )

    async def conduct_performance_testing(self, template: WorkflowTemplate) -> PerformanceTest:
        """
        Conduct performance testing of a workflow template.

        Args:
            template: The template to test

        Returns:
            Performance test results
        """
        try:
            logger.info(f"Conducting performance testing for template: {template.name}")

            # Mock performance testing
            # In production, this would actually execute the workflow with test data

            execution_time = 45.2  # seconds
            memory_usage = 256.7   # MB
            cpu_usage = 65.3       # percentage
            scalability_score = 8.2  # out of 10

            bottlenecks = []
            recommendations = []

            # Analyze performance metrics
            if execution_time > self.max_execution_time:
                bottlenecks.append("High execution time")
                recommendations.append("Optimize workflow steps for faster execution")

            if memory_usage > self.max_memory_usage:
                bottlenecks.append("High memory usage")
                recommendations.append("Optimize memory usage in workflow steps")

            if cpu_usage > self.max_cpu_usage:
                bottlenecks.append("High CPU usage")
                recommendations.append("Optimize CPU-intensive operations")

            if scalability_score < self.min_scalability_score:
                bottlenecks.append("Poor scalability")
                recommendations.append("Design workflow for better scalability")

            if not bottlenecks:
                recommendations.append("Performance is within acceptable limits")

            logger.info(f"Performance testing completed: {template.name}")

            return PerformanceTest(
                execution_time=execution_time,
                memory_usage=memory_usage,
                cpu_usage=cpu_usage,
                scalability_score=scalability_score,
                bottlenecks=bottlenecks,
                recommendations=recommendations
            )

        except Exception as e:
            logger.error(f"Performance testing failed: {e}", exc_info=True)
            return PerformanceTest(
                execution_time=0.0,
                memory_usage=0.0,
                cpu_usage=0.0,
                scalability_score=0.0,
                bottlenecks=["Performance testing failed"],
                recommendations=["Fix performance testing errors"]
            )

    async def _validate_structure(self, template: WorkflowTemplate) -> ValidationResult:
        """Validate basic template structure."""
        errors = []
        warnings = []
        details = {}

        # Check required fields
        if not template.name or len(template.name.strip()) == 0:
            errors.append("Template name is required")

        if not template.description or len(template.description.strip()) == 0:
            errors.append("Template description is required")

        if len(template.description) < 50:
            warnings.append("Template description should be at least 50 characters")

        if not template.workflow_definition:
            errors.append("Workflow definition is required")

        # Check name length
        if len(template.name) > 100:
            errors.append("Template name must be 100 characters or less")

        # Check description length
        if len(template.description) > 1000:
            warnings.append("Template description is very long, consider shortening")

        details = {
            "name_length": len(template.name) if template.name else 0,
            "description_length": len(template.description) if template.description else 0,
            "has_workflow_definition": bool(template.workflow_definition)
        }

        return ValidationResult(
            is_valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            details=details
        )

    async def _validate_workflow_definition(self, template: WorkflowTemplate) -> ValidationResult:
        """Validate workflow definition structure."""
        errors = []
        warnings = []
        details = {}

        if not template.workflow_definition:
            return ValidationResult(
                is_valid=False,
                errors=["Workflow definition is required"],
                details={}
            )

        workflow = template.workflow_definition

        # Check for required workflow components
        if "nodes" not in workflow:
            errors.append("Workflow must have nodes defined")

        if "edges" not in workflow:
            errors.append("Workflow must have edges defined")

        if "entry_point" not in workflow:
            errors.append("Workflow must have an entry point defined")

        # Check node definitions
        if "nodes" in workflow:
            nodes = workflow["nodes"]
            if not isinstance(nodes, list) or len(nodes) == 0:
                errors.append("Workflow must have at least one node")
            else:
                for i, node in enumerate(nodes):
                    if not isinstance(node, dict):
                        errors.append(f"Node {i} must be a dictionary")
                    elif "name" not in node:
                        errors.append(f"Node {i} must have a name")
                    elif "type" not in node:
                        errors.append(f"Node {i} must have a type")

        # Check edge definitions
        if "edges" in workflow:
            edges = workflow["edges"]
            if not isinstance(edges, list):
                errors.append("Edges must be a list")
            else:
                for i, edge in enumerate(edges):
                    if not isinstance(edge, dict):
                        errors.append(f"Edge {i} must be a dictionary")
                    elif "from" not in edge or "to" not in edge:
                        errors.append(f"Edge {i} must have 'from' and 'to' properties")

        details = {
            "node_count": len(workflow.get("nodes", [])),
            "edge_count": len(workflow.get("edges", [])),
            "has_entry_point": "entry_point" in workflow
        }

        return ValidationResult(
            is_valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            details=details
        )

    async def _validate_customization_points(self, template: WorkflowTemplate) -> ValidationResult:
        """Validate customization points."""
        errors = []
        warnings = []
        details = {}

        if not template.customization_points:
            warnings.append("No customization points defined")
            return ValidationResult(
                is_valid=True,
                errors=errors,
                warnings=warnings,
                details={"customization_point_count": 0}
            )

        for i, point in enumerate(template.customization_points):
            if not point.name or len(point.name.strip()) == 0:
                errors.append(f"Customization point {i} must have a name")

            if not point.description or len(point.description.strip()) == 0:
                errors.append(f"Customization point {i} must have a description")

            if point.type not in ["enum", "string", "boolean", "number", "multi_select"]:
                errors.append(f"Customization point {i} has invalid type: {point.type}")

            if point.type == "enum" and not point.options:
                errors.append(f"Enum customization point {i} must have options defined")

            if point.type == "multi_select" and not point.options:
                errors.append(f"Multi-select customization point {i} must have options defined")

        details = {
            "customization_point_count": len(template.customization_points),
            "point_types": [p.type for p in template.customization_points]
        }

        return ValidationResult(
            is_valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            details=details
        )

    async def _validate_pricing(self, template: WorkflowTemplate) -> ValidationResult:
        """Validate pricing configuration."""
        errors = []
        warnings = []
        details = {}

        # Check pricing model consistency
        if template.pricing_model.value == "one_time_purchase":
            if template.monthly_fee and template.monthly_fee > 0:
                warnings.append("Monthly fee should not be set for one-time purchase")
            if template.per_execution_fee and template.per_execution_fee > 0:
                warnings.append("Per-execution fee should not be set for one-time purchase")

        elif template.pricing_model.value == "subscription_monthly":
            if not template.monthly_fee or template.monthly_fee <= 0:
                errors.append("Monthly fee must be set for subscription pricing")

        elif template.pricing_model.value == "usage_based":
            if not template.per_execution_fee or template.per_execution_fee <= 0:
                errors.append("Per-execution fee must be set for usage-based pricing")

        # Check for reasonable pricing
        if template.base_price and template.base_price < 0:
            errors.append("Base price cannot be negative")

        if template.monthly_fee and template.monthly_fee < 0:
            errors.append("Monthly fee cannot be negative")

        if template.per_execution_fee and template.per_execution_fee < 0:
            errors.append("Per-execution fee cannot be negative")

        if template.setup_fee and template.setup_fee < 0:
            errors.append("Setup fee cannot be negative")

        # Check for very high pricing
        if template.base_price and template.base_price > 10000:
            warnings.append("Base price is very high, consider if this is appropriate")

        if template.monthly_fee and template.monthly_fee > 1000:
            warnings.append("Monthly fee is very high, consider if this is appropriate")

        details = {
            "pricing_model": template.pricing_model.value,
            "base_price": template.base_price,
            "monthly_fee": template.monthly_fee,
            "per_execution_fee": template.per_execution_fee,
            "setup_fee": template.setup_fee
        }

        return ValidationResult(
            is_valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            details=details
        )

    async def _validate_metadata(self, template: WorkflowTemplate) -> ValidationResult:
        """Validate template metadata."""
        errors = []
        warnings = []
        details = {}

        # Check tags
        if not template.tags:
            warnings.append("No tags defined, consider adding relevant tags")
        elif len(template.tags) > 10:
            warnings.append("Too many tags, consider reducing to most relevant ones")

        # Check documentation URL
        if template.documentation_url:
            if not template.documentation_url.startswith(("http://", "https://")):
                errors.append("Documentation URL must start with http:// or https://")

        # Check support contact
        if template.support_contact:
            if "@" not in template.support_contact:
                warnings.append("Support contact should be an email address")

        details = {
            "tag_count": len(template.tags),
            "has_documentation_url": bool(template.documentation_url),
            "has_support_contact": bool(template.support_contact)
        }

        return ValidationResult(
            is_valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            details=details
        )

    async def _check_dangerous_operations(self, template: WorkflowTemplate) -> list[dict[str, Any]]:
        """Check for dangerous operations in the workflow."""
        issues = []

        # Mock dangerous operation detection
        # In production, this would analyze the workflow definition for:
        # - File system operations
        # - Network requests to untrusted sources
        # - Code execution
        # - Database operations
        # - System commands

        workflow = template.workflow_definition
        if workflow:
            # Check for potentially dangerous node types
            dangerous_types = ["file_delete", "system_command", "code_execution", "database_drop"]
            nodes = workflow.get("nodes", [])

            for node in nodes:
                if node.get("type") in dangerous_types:
                    issues.append({
                        "type": "dangerous_operation",
                        "node": node.get("name", "unknown"),
                        "operation": node.get("type"),
                        "severity": "high",
                        "message": f"Dangerous operation detected: {node.get('type')}"
                    })

        return issues

    async def _check_external_dependencies(self, template: WorkflowTemplate) -> list[dict[str, Any]]:
        """Check for external dependencies and their security."""
        issues = []

        # Mock external dependency checking
        # In production, this would:
        # - Identify external API calls
        # - Check for HTTPS usage
        # - Validate authentication mechanisms
        # - Check for data transmission security

        workflow = template.workflow_definition
        if workflow:
            nodes = workflow.get("nodes", [])

            for node in nodes:
                if node.get("type") == "http_request":
                    url = node.get("url", "")
                    if url.startswith("http://"):
                        issues.append({
                            "type": "external_dependency",
                            "node": node.get("name", "unknown"),
                            "severity": "medium",
                            "message": "HTTP request detected, consider using HTTPS"
                        })

        return issues

    async def _check_data_handling(self, template: WorkflowTemplate) -> list[dict[str, Any]]:
        """Check for secure data handling practices."""
        issues = []

        # Mock data handling checks
        # In production, this would check for:
        # - Sensitive data exposure
        # - Proper data encryption
        # - Data retention policies
        # - Data anonymization

        return issues

    async def _check_authentication(self, template: WorkflowTemplate) -> list[dict[str, Any]]:
        """Check for authentication and authorization mechanisms."""
        issues = []

        # Mock authentication checks
        # In production, this would check for:
        # - Authentication requirements
        # - Authorization checks
        # - Token handling
        # - Session management

        return issues


# Singleton instance
template_validator = TemplateValidator()
