"""
Policy management models for SDLC.ai SDK

Provides models for policy creation, testing, deployment, and management.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any, Literal, Union
from pydantic import Field, validator

from .base import BaseModel, TimestampModel, ListResponseModel


class PolicyRule(BaseModel):
    """Policy rule model."""

    id: Optional[str] = Field(None, description="Rule ID")
    name: str = Field(..., description="Rule name")
    description: Optional[str] = Field(None, description="Rule description")

    # Rule definition
    condition: str = Field(..., description="Rule condition expression")
    action: str = Field(..., description="Action to take")
    priority: int = Field(1, description="Rule priority (lower = higher priority)")

    # Rule configuration
    enabled: bool = Field(True, description="Rule enabled flag")
    effect: Literal["allow", "deny", "log", "transform"] = Field(
        "allow", description="Rule effect"
    )

    # Targets
    resource_types: List[str] = Field(
        default_factory=list, description="Resource types"
    )
    actions: List[str] = Field(default_factory=list, description="Actions")
    roles: List[str] = Field(default_factory=list, description="Target roles")

    # Metadata
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Additional metadata"
    )
    tags: List[str] = Field(default_factory=list, description="Rule tags")

    @validator("condition")
    def validate_condition(cls, v):
        """Validate rule condition syntax."""
        # Basic validation - in production, use proper expression parser
        if not v or not v.strip():
            raise ValueError("Condition cannot be empty")
        return v


class Policy(BaseModel, TimestampModel):
    """Policy model."""

    id: str = Field(..., description="Policy ID")
    tenant_id: str = Field(..., description="Tenant ID")
    name: str = Field(..., description="Policy name")
    description: Optional[str] = Field(None, description="Policy description")

    # Policy content
    rules: List[PolicyRule] = Field(..., description="Policy rules")
    variables: Dict[str, Any] = Field(
        default_factory=dict, description="Policy variables"
    )

    # Versioning
    version: str = Field("1.0.0", description="Policy version")
    parent_policy_id: Optional[str] = Field(None, description="Parent policy ID")

    # Status
    status: Literal["draft", "testing", "active", "inactive", "archived"] = Field(
        "draft", description="Policy status"
    )

    # Deployment
    deployed_at: Optional[datetime] = Field(None, description="Deployment timestamp")
    deployment_config: Dict[str, Any] = Field(
        default_factory=dict, description="Deployment config"
    )

    # Owner
    owner_id: str = Field(..., description="Policy owner ID")

    # Metadata
    category: Optional[str] = Field(None, description="Policy category")
    severity: Literal["low", "medium", "high", "critical"] = Field(
        "medium", description="Policy severity"
    )
    tags: List[str] = Field(default_factory=list, description="Policy tags")

    @property
    def is_active(self) -> bool:
        """Check if policy is active."""
        return self.status == "active"

    @property
    def rule_count(self) -> int:
        """Get number of rules."""
        return len(self.rules)


class PolicyCreate(BaseModel):
    """Policy creation model."""

    name: str = Field(..., description="Policy name")
    description: Optional[str] = Field(None, description="Policy description")
    tenant_id: str = Field(..., description="Tenant ID")

    # Policy content
    rules: List[PolicyRule] = Field(..., description="Policy rules")
    variables: Dict[str, Any] = Field(
        default_factory=dict, description="Policy variables"
    )

    # Metadata
    category: Optional[str] = Field(None, description="Policy category")
    severity: Literal["low", "medium", "high", "critical"] = Field(
        "medium", description="Policy severity"
    )
    tags: List[str] = Field(default_factory=list, description="Policy tags")

    # Initial status
    status: Literal["draft", "testing"] = Field("draft", description="Initial status")


class PolicyUpdate(BaseModel):
    """Policy update model."""

    name: Optional[str] = Field(None, description="Policy name")
    description: Optional[str] = Field(None, description="Policy description")

    # Policy content
    rules: Optional[List[PolicyRule]] = Field(None, description="Policy rules")
    variables: Optional[Dict[str, Any]] = Field(None, description="Policy variables")

    # Status changes
    status: Optional[Literal["draft", "testing", "active", "inactive", "archived"]] = (
        Field(None, description="Policy status")
    )

    # Metadata
    category: Optional[str] = Field(None, description="Policy category")
    severity: Optional[Literal["low", "medium", "high", "critical"]] = Field(
        None, description="Policy severity"
    )
    tags: Optional[List[str]] = Field(None, description="Policy tags")

    class Config:
        """Model configuration."""

        extra = "allow"


class PolicyTest(BaseModel):
    """Policy test request model."""

    policy_id: str = Field(..., description="Policy ID to test")
    test_data: Dict[str, Any] = Field(..., description="Test data/context")
    test_name: Optional[str] = Field(None, description="Test name")
    description: Optional[str] = Field(None, description="Test description")

    # Test configuration
    mock_time: Optional[datetime] = Field(
        None, description="Mock timestamp for testing"
    )
    dry_run: bool = Field(True, description="Dry run mode")
    verbose: bool = Field(False, description="Verbose output")

    # Expected results
    expected_result: Optional[Dict[str, Any]] = Field(
        None, description="Expected test result"
    )

    @validator("test_data")
    def validate_test_data(cls, v):
        """Validate test data."""
        if not v:
            raise ValueError("Test data cannot be empty")
        return v


class PolicyTestResult(BaseModel):
    """Policy test result model."""

    test_id: str = Field(..., description="Test ID")
    policy_id: str = Field(..., description="Policy ID")
    policy_version: str = Field(..., description="Policy version tested")

    # Test outcome
    passed: bool = Field(..., description="Test passed flag")
    result: Dict[str, Any] = Field(..., description="Test result")
    execution_time_ms: float = Field(..., description="Execution time")

    # Rule evaluation
    rule_results: List[Dict[str, Any]] = Field(
        default_factory=list, description="Rule evaluation results"
    )
    matched_rules: List[str] = Field(
        default_factory=list, description="Matched rule IDs"
    )

    # Comparison
    expected_result: Optional[Dict[str, Any]] = Field(
        None, description="Expected result"
    )
    matches_expected: Optional[bool] = Field(
        None, description="Matches expected result"
    )

    # Details
    error_message: Optional[str] = Field(None, description="Error message if failed")
    warnings: List[str] = Field(default_factory=list, description="Test warnings")
    debug_info: Dict[str, Any] = Field(
        default_factory=dict, description="Debug information"
    )

    # Metadata
    tested_by: str = Field(..., description="User who ran test")
    tested_at: datetime = Field(..., description="Test timestamp")


class PolicyDeployment(BaseModel):
    """Policy deployment model."""

    id: str = Field(..., description="Deployment ID")
    policy_id: str = Field(..., description="Policy ID")
    policy_version: str = Field(..., description="Deployed policy version")
    tenant_id: str = Field(..., description="Tenant ID")

    # Deployment configuration
    strategy: Literal["immediate", "blue_green", "canary"] = Field(
        "immediate", description="Deployment strategy"
    )
    target_environments: List[str] = Field(
        default_factory=lambda: ["production"], description="Target environments"
    )
    rollout_percentage: float = Field(
        100.0, description="Rollout percentage for canary"
    )

    # Status
    status: Literal["pending", "deploying", "deployed", "failed", "rolled_back"] = (
        Field("pending", description="Deployment status")
    )

    # Timing
    started_at: datetime = Field(..., description="Deployment start time")
    completed_at: Optional[datetime] = Field(
        None, description="Deployment completion time"
    )
    duration_seconds: Optional[int] = Field(None, description="Deployment duration")

    # Deployment info
    deployed_by: str = Field(..., description="User who deployed")
    previous_version: Optional[str] = Field(
        None, description="Previous deployed version"
    )

    # Results
    deployment_log: List[str] = Field(
        default_factory=list, description="Deployment log"
    )
    metrics: Dict[str, Any] = Field(
        default_factory=dict, description="Deployment metrics"
    )

    # Rollback info
    rollback_available: bool = Field(True, description="Rollback available")
    rollback_reason: Optional[str] = Field(None, description="Rollback reason")
    rolled_back_at: Optional[datetime] = Field(None, description="Rollback timestamp")

    @property
    def is_deployed(self) -> bool:
        """Check if deployment is complete."""
        return self.status == "deployed"

    @property
    def is_failed(self) -> bool:
        """Check if deployment failed."""
        return self.status in ["failed", "rolled_back"]


class PolicyViolation(BaseModel):
    """Policy violation model."""

    id: str = Field(..., description="Violation ID")
    policy_id: str = Field(..., description="Policy ID that was violated")
    rule_id: str = Field(..., description="Rule ID that was violated")

    # Violation details
    resource_type: str = Field(..., description="Type of resource")
    resource_id: str = Field(..., description="Resource ID")
    action: str = Field(..., description="Action that triggered violation")

    # Context
    context: Dict[str, Any] = Field(..., description="Violation context")
    user_id: Optional[str] = Field(None, description="User who triggered violation")
    tenant_id: str = Field(..., description="Tenant ID")

    # Severity and impact
    severity: Literal["low", "medium", "high", "critical"] = Field(
        ..., description="Violation severity"
    )
    impact: Optional[str] = Field(None, description="Violation impact description")

    # Resolution
    status: Literal["open", "investigating", "resolved", "false_positive"] = Field(
        "open", description="Violation status"
    )
    resolved_at: Optional[datetime] = Field(None, description="Resolution timestamp")
    resolved_by: Optional[str] = Field(None, description="User who resolved")
    resolution_notes: Optional[str] = Field(None, description="Resolution notes")

    # Timestamps
    detected_at: datetime = Field(..., description="Violation detection time")
    last_seen_at: datetime = Field(..., description="Last occurrence time")
    occurrence_count: int = Field(1, description="Number of occurrences")


class PolicyAnalytics(BaseModel):
    """Policy analytics model."""

    tenant_id: str = Field(..., description="Tenant ID")
    period: str = Field(..., description="Analytics period")

    # Policy metrics
    total_policies: int = Field(0, description="Total policies")
    active_policies: int = Field(0, description="Active policies")
    policy_changes: int = Field(0, description="Policy changes")

    # Violation metrics
    total_violations: int = Field(0, description="Total violations")
    violations_by_severity: Dict[str, int] = Field(
        default_factory=dict, description="Violations by severity"
    )
    violations_by_policy: List[Dict[str, Any]] = Field(
        default_factory=list, description="Violations by policy"
    )

    # Performance metrics
    average_evaluation_time_ms: float = Field(
        0.0, description="Average evaluation time"
    )
    evaluations_per_second: float = Field(0.0, description="Evaluations per second")

    # Top violations
    most_violated_rules: List[Dict[str, Any]] = Field(
        default_factory=list, description="Most violated rules"
    )
    top_violating_users: List[Dict[str, Any]] = Field(
        default_factory=list, description="Top violating users"
    )

    timestamp: datetime = Field(..., description="Analytics timestamp")


class PolicyTemplate(BaseModel):
    """Policy template model."""

    id: str = Field(..., description="Template ID")
    name: str = Field(..., description="Template name")
    description: str = Field(..., description="Template description")
    category: str = Field(..., description="Template category")

    # Template content
    template_rules: List[Dict[str, Any]] = Field(..., description="Template rules")
    variables: Dict[str, Any] = Field(
        default_factory=dict, description="Template variables"
    )

    # Template metadata
    author: str = Field(..., description="Template author")
    version: str = Field(..., description="Template version")
    tags: List[str] = Field(default_factory=list, description="Template tags")

    # Usage
    usage_count: int = Field(0, description="Template usage count")
    rating: Optional[float] = Field(None, description="Template rating")

    # Timestamps
    created_at: datetime = Field(..., description="Creation time")
    updated_at: datetime = Field(..., description="Last update time")
