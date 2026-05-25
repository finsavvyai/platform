"""
Policy API endpoints for UPM

Provides REST API endpoints for:
- Policy CRUD operations
- Policy framework management
- Policy evaluation and reporting
- Policy template management
"""

from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from udp.core.models.policy import (
    Policy,
    PolicyEvaluationStatus,
    PolicyFramework,
    PolicyRuleType,
    PolicyStatus,
)
from udp.core.security import get_current_user, require_permission
from udp.dependencies import get_db_session, get_policy_service
from udp.services.policy_service import (
    POLICY_TEMPLATES,
    PolicyService,
    create_policy_from_template,
)

router = APIRouter(prefix="/policies", tags=["policies"])


# Pydantic models for API
class PolicyConditionModel(BaseModel):
    field: str = Field(..., description="Field to evaluate")
    operator: str = Field(..., description="Operator for comparison")
    value: Any = Field(None, description="Value to compare against")
    logical_op: str = Field("AND", description="Logical operator (AND/OR)")


class PolicyRuleModel(BaseModel):
    rule_id: str = Field(..., description="Unique rule identifier")
    name: str = Field(..., description="Rule name")
    description: Optional[str] = Field(None, description="Rule description")
    conditions: list[PolicyConditionModel] = Field(..., description="Rule conditions")
    actions: list[dict[str, Any]] = Field(..., description="Actions to take")
    severity: str = Field("medium", description="Rule severity")
    enabled: bool = Field(True, description="Whether rule is enabled")


class CreatePolicyRequest(BaseModel):
    name: str = Field(..., description="Policy name")
    description: str = Field(..., description="Policy description")
    rule_type: PolicyRuleType = Field(..., description="Type of policy rule")
    conditions: list[dict[str, Any]] = Field(
        ..., description="Policy conditions or rules"
    )
    actions: list[dict[str, Any]] = Field(..., description="Policy actions")
    organization_id: Optional[UUID] = Field(None, description="Organization ID")
    framework_id: Optional[UUID] = Field(None, description="Framework ID")
    category: Optional[str] = Field(None, description="Policy category")
    tags: Optional[list[str]] = Field(default_factory=list, description="Policy tags")
    severity: str = Field("medium", description="Policy severity")
    priority: str = Field("medium", description="Policy priority")
    auto_enforce: bool = Field(False, description="Auto-enforce policy")
    requires_approval: bool = Field(
        False, description="Requires approval for violations"
    )
    evaluation_frequency: str = Field("on_analysis", description="When to evaluate")


class UpdatePolicyRequest(BaseModel):
    name: Optional[str] = Field(None, description="Policy name")
    description: Optional[str] = Field(None, description="Policy description")
    conditions: Optional[list[dict[str, Any]]] = Field(
        None, description="Policy conditions"
    )
    actions: Optional[list[dict[str, Any]]] = Field(None, description="Policy actions")
    category: Optional[str] = Field(None, description="Policy category")
    tags: Optional[list[str]] = Field(None, description="Policy tags")
    severity: Optional[str] = Field(None, description="Policy severity")
    priority: Optional[str] = Field(None, description="Policy priority")
    status: Optional[PolicyStatus] = Field(None, description="Policy status")
    is_active: Optional[bool] = Field(None, description="Whether policy is active")
    auto_enforce: Optional[bool] = Field(None, description="Auto-enforce policy")
    requires_approval: Optional[bool] = Field(None, description="Requires approval")
    evaluation_frequency: Optional[str] = Field(
        None, description="Evaluation frequency"
    )


class CreateFrameworkRequest(BaseModel):
    name: str = Field(..., description="Framework name")
    slug: str = Field(..., description="URL-friendly slug")
    description: str = Field(..., description="Framework description")
    framework_type: PolicyFramework = Field(..., description="Framework type")
    version: str = Field(..., description="Framework version")
    requirements: Optional[list[dict[str, Any]]] = Field(
        default_factory=list, description="Framework requirements"
    )
    controls: Optional[list[dict[str, Any]]] = Field(
        default_factory=list, description="Framework controls"
    )
    documentation_url: Optional[str] = Field(None, description="Documentation URL")
    reference_url: Optional[str] = Field(None, description="Reference URL")


class PolicyEvaluationRequest(BaseModel):
    project_id: UUID = Field(..., description="Project ID to evaluate")
    target_type: str = Field(
        ..., description="Type of target (project, dependency, package)"
    )
    target_id: Optional[UUID] = Field(None, description="Specific target ID")
    context: Optional[dict[str, Any]] = Field(None, description="Evaluation context")
    policy_ids: Optional[list[UUID]] = Field(
        None, description="Specific policies to evaluate"
    )
    analysis_id: Optional[UUID] = Field(None, description="Analysis session ID")


class PolicyFromTemplateRequest(BaseModel):
    template_name: str = Field(..., description="Template name")
    organization_id: Optional[UUID] = Field(None, description="Organization ID")
    framework_id: Optional[UUID] = Field(None, description="Framework ID")
    overrides: Optional[dict[str, Any]] = Field(None, description="Template overrides")


# Policy endpoints
@router.post("/", response_model=dict[str, Any], status_code=status.HTTP_201_CREATED)
async def create_policy(
    request: CreatePolicyRequest,
    current_user=Depends(get_current_user),
    policy_service: PolicyService = Depends(get_policy_service),
):
    """Create a new policy."""
    # Check permissions
    require_permission(current_user, "policy:create")

    try:
        policy = await policy_service.create_policy(**request.dict(exclude_unset=True))

        return {
            "id": policy.id,
            "name": policy.name,
            "description": policy.description,
            "rule_type": policy.rule_type,
            "status": policy.status,
            "is_active": policy.is_active,
            "created_at": policy.created_at,
            "message": "Policy created successfully",
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/", response_model=dict[str, Any])
async def list_policies(
    organization_id: Optional[UUID] = Query(None, description="Filter by organization"),
    framework_id: Optional[UUID] = Query(None, description="Filter by framework"),
    rule_type: Optional[PolicyRuleType] = Query(
        None, description="Filter by rule type"
    ),
    status: Optional[PolicyStatus] = Query(None, description="Filter by status"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    category: Optional[str] = Query(None, description="Filter by category"),
    tags: Optional[list[str]] = Query(None, description="Filter by tags"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Number of records to return"),
    sort_by: str = Query("created_at", description="Sort field"),
    sort_desc: bool = Query(True, description="Sort descending"),
    current_user=Depends(get_current_user),
    policy_service: PolicyService = Depends(get_policy_service),
):
    """List policies with filtering and pagination."""
    # Check permissions
    require_permission(current_user, "policy:read")

    policies = await policy_service.list_policies(
        organization_id=organization_id,
        framework_id=framework_id,
        rule_type=rule_type,
        status=status,
        is_active=is_active,
        category=category,
        tags=tags,
        skip=skip,
        limit=limit,
        sort_by=sort_by,
        sort_desc=sort_desc,
    )

    total = len(policies)

    return {
        "data": [
            {
                "id": p.id,
                "name": p.name,
                "description": p.description,
                "rule_type": p.rule_type,
                "category": p.category,
                "tags": p.tags,
                "severity": p.severity,
                "priority": p.priority,
                "status": p.status,
                "is_active": p.is_active,
                "auto_enforce": p.auto_enforce,
                "requires_approval": p.requires_approval,
                "evaluation_frequency": p.evaluation_frequency,
                "created_at": p.created_at,
                "updated_at": p.updated_at,
            }
            for p in policies
        ],
        "total": total,
        "skip": skip,
        "limit": limit,
        "has_more": total > skip + limit,
    }


@router.get("/{policy_id}", response_model=dict[str, Any])
async def get_policy(
    policy_id: UUID,
    current_user=Depends(get_current_user),
    policy_service: PolicyService = Depends(get_policy_service),
):
    """Get a policy by ID."""
    # Check permissions
    require_permission(current_user, "policy:read")

    policy = await policy_service.get_policy(policy_id)
    if not policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Policy not found"
        )

    return {
        "id": policy.id,
        "organization_id": policy.organization_id,
        "framework_id": policy.framework_id,
        "name": policy.name,
        "description": policy.description,
        "rule_type": policy.rule_type,
        "category": policy.category,
        "tags": policy.tags,
        "conditions": policy.conditions,
        "actions": policy.actions,
        "severity": policy.severity,
        "priority": policy.priority,
        "status": policy.status,
        "version": policy.version,
        "is_active": policy.is_active,
        "auto_enforce": policy.auto_enforce,
        "requires_approval": policy.requires_approval,
        "evaluation_frequency": policy.evaluation_frequency,
        "created_at": policy.created_at,
        "updated_at": policy.updated_at,
    }


@router.put("/{policy_id}", response_model=dict[str, Any])
async def update_policy(
    policy_id: UUID,
    request: UpdatePolicyRequest,
    current_user=Depends(get_current_user),
    policy_service: PolicyService = Depends(get_policy_service),
):
    """Update a policy."""
    # Check permissions
    require_permission(current_user, "policy:update")

    policy = await policy_service.update_policy(
        policy_id, **request.dict(exclude_unset=True)
    )

    if not policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Policy not found"
        )

    return {
        "id": policy.id,
        "name": policy.name,
        "updated_at": policy.updated_at,
        "message": "Policy updated successfully",
    }


@router.delete("/{policy_id}", response_model=dict[str, Any])
async def delete_policy(
    policy_id: UUID,
    hard_delete: bool = Query(False, description="Permanently delete policy"),
    current_user=Depends(get_current_user),
    policy_service: PolicyService = Depends(get_policy_service),
):
    """Delete a policy."""
    # Check permissions
    require_permission(current_user, "policy:delete")

    success = await policy_service.delete_policy(policy_id, hard_delete=hard_delete)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Policy not found"
        )

    return {"message": "Policy deleted successfully", "hard_delete": hard_delete}


# Framework endpoints
@router.post(
    "/frameworks/", response_model=dict[str, Any], status_code=status.HTTP_201_CREATED
)
async def create_framework(
    request: CreateFrameworkRequest,
    current_user=Depends(get_current_user),
    db_session=Depends(get_db_session),
):
    """Create a new policy framework."""
    # Check permissions
    require_permission(current_user, "framework:create")

    policy_service = PolicyService(db_session)

    try:
        framework = await policy_service.create_framework(**request.dict())

        return {
            "id": framework.id,
            "name": framework.name,
            "slug": framework.slug,
            "framework_type": framework.framework_type,
            "version": framework.version,
            "is_active": framework.is_active,
            "created_at": framework.created_at,
            "message": "Framework created successfully",
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/frameworks/", response_model=dict[str, Any])
async def list_frameworks(
    framework_type: Optional[PolicyFramework] = Query(
        None, description="Filter by type"
    ),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    current_user=Depends(get_current_user),
    db_session=Depends(get_db_session),
):
    """List policy frameworks."""
    # Check permissions
    require_permission(current_user, "framework:read")

    from sqlalchemy import select

    query = select(PolicyFramework).where(PolicyFramework.deleted_at.is_(None))

    if framework_type:
        query = query.where(PolicyFramework.framework_type == framework_type.value)
    if is_active is not None:
        query = query.where(PolicyFramework.is_active == is_active)

    result = await db_session.execute(query)
    frameworks = result.scalars().all()

    return {
        "data": [
            {
                "id": f.id,
                "name": f.name,
                "slug": f.slug,
                "description": f.description,
                "framework_type": f.framework_type,
                "version": f.version,
                "is_active": f.is_active,
                "requirements_count": len(f.requirements) if f.requirements else 0,
                "controls_count": len(f.controls) if f.controls else 0,
                "created_at": f.created_at,
                "updated_at": f.updated_at,
            }
            for f in frameworks
        ]
    }


@router.get("/frameworks/{framework_id}", response_model=dict[str, Any])
async def get_framework(
    framework_id: UUID,
    current_user=Depends(get_current_user),
    db_session=Depends(get_db_session),
):
    """Get a framework by ID."""
    # Check permissions
    require_permission(current_user, "framework:read")

    from sqlalchemy import select

    stmt = select(PolicyFramework).where(
        PolicyFramework.id == framework_id, PolicyFramework.deleted_at.is_(None)
    )
    result = await db_session.execute(stmt)
    framework = result.scalar_one_or_none()

    if not framework:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Framework not found"
        )

    # Get policy count
    from sqlalchemy import func

    policy_count_stmt = select(func.count(Policy.id)).where(
        Policy.framework_id == framework_id,
        Policy.is_active == True,
        Policy.deleted_at.is_(None),
    )
    policy_count_result = await db_session.execute(policy_count_stmt)
    policy_count = policy_count_result.scalar()

    return {
        "id": framework.id,
        "name": framework.name,
        "slug": framework.slug,
        "description": framework.description,
        "framework_type": framework.framework_type,
        "version": framework.version,
        "is_active": framework.is_active,
        "requirements": framework.requirements,
        "controls": framework.controls,
        "documentation_url": framework.documentation_url,
        "reference_url": framework.reference_url,
        "policy_count": policy_count,
        "created_at": framework.created_at,
        "updated_at": framework.updated_at,
    }


# Policy evaluation endpoints
@router.post("/evaluate/", response_model=dict[str, Any])
async def evaluate_policies(
    request: PolicyEvaluationRequest,
    current_user=Depends(get_current_user),
    db_session=Depends(get_db_session),
):
    """Evaluate policies against a project or dependency."""
    # Check permissions
    require_permission(current_user, "policy:evaluate")

    policy_service = PolicyService(db_session)

    evaluations = await policy_service.evaluate_policies(
        project_id=request.project_id,
        target_type=request.target_type,
        target_id=request.target_id,
        context=request.context or {},
        policy_ids=request.policy_ids,
        analysis_id=request.analysis_id,
    )

    # Summarize results
    total_evaluations = len(evaluations)
    violations = [e for e in evaluations if e.violation_detected]
    critical_violations = [e for e in violations if e.violation_severity == "critical"]
    high_violations = [e for e in violations if e.violation_severity == "high"]

    return {
        "evaluation_id": str(uuid4()),  # Generate a unique evaluation ID
        "project_id": request.project_id,
        "target_type": request.target_type,
        "target_id": request.target_id,
        "summary": {
            "total_evaluations": total_evaluations,
            "violations_detected": len(violations),
            "critical_violations": len(critical_violations),
            "high_violations": len(high_violations),
            "overall_status": "FAIL"
            if critical_violations
            else "WARNING"
            if high_violations
            else "PASS",
        },
        "evaluations": [
            {
                "id": e.id,
                "policy_id": e.policy_id,
                "policy_name": e.evaluation_details.get("policy_name")
                if e.evaluation_details
                else None,
                "status": e.status,
                "violation_detected": e.violation_detected,
                "violation_severity": e.violation_severity,
                "result_message": e.result_message,
                "violations": e.violation_details,
                "triggered_actions": e.triggered_actions,
                "evaluated_at": e.evaluated_at,
                "evaluation_duration_ms": e.evaluation_duration_ms,
            }
            for e in evaluations
        ],
    }


@router.get("/evaluations/", response_model=dict[str, Any])
async def list_policy_evaluations(
    project_id: Optional[UUID] = Query(None, description="Filter by project"),
    policy_id: Optional[UUID] = Query(None, description="Filter by policy"),
    status: Optional[PolicyEvaluationStatus] = Query(
        None, description="Filter by status"
    ),
    has_violation: Optional[bool] = Query(
        None, description="Filter by violation presence"
    ),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Number of records to return"),
    current_user=Depends(get_current_user),
    policy_service: PolicyService = Depends(get_policy_service),
):
    """List policy evaluations."""
    # Check permissions
    require_permission(current_user, "policy:read")

    evaluations = await policy_service.get_policy_evaluations(
        project_id=project_id,
        policy_id=policy_id,
        status=status,
        has_violation=has_violation,
        skip=skip,
        limit=limit,
    )

    return {
        "data": [
            {
                "id": e.id,
                "project_id": e.project_id,
                "policy_id": e.policy_id,
                "target_type": e.target_type,
                "target_id": e.target_id,
                "status": e.status,
                "violation_detected": e.violation_detected,
                "violation_severity": e.violation_severity,
                "result_message": e.result_message,
                "triggered_actions": e.triggered_actions,
                "evaluated_at": e.evaluated_at,
                "evaluation_duration_ms": e.evaluation_duration_ms,
            }
            for e in evaluations
        ],
        "skip": skip,
        "limit": limit,
    }


# Policy template endpoints
@router.get("/templates/", response_model=dict[str, Any])
async def list_policy_templates(current_user=Depends(get_current_user)):
    """List available policy templates."""
    # Check permissions
    require_permission(current_user, "policy:read")

    templates = []
    for template_name, template_data in POLICY_TEMPLATES.items():
        templates.append(
            {
                "name": template_name,
                "display_name": template_data["name"],
                "description": template_data["description"],
                "rule_type": template_data["rule_type"],
                "category": template_data.get("category"),
                "tags": template_data.get("tags", []),
                "severity": template_data.get("severity"),
                "rules_count": len(template_data.get("conditions", [])),
            }
        )

    return {"templates": templates}


@router.get("/templates/{template_name}", response_model=dict[str, Any])
async def get_policy_template(
    template_name: str, current_user=Depends(get_current_user)
):
    """Get a policy template by name."""
    # Check permissions
    require_permission(current_user, "policy:read")

    if template_name not in POLICY_TEMPLATES:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Policy template not found"
        )

    return {"template_name": template_name, **POLICY_TEMPLATES[template_name]}


@router.post("/from-template/", response_model=dict[str, Any])
async def create_policy_from_template(
    request: PolicyFromTemplateRequest,
    current_user=Depends(get_current_user),
    db_session=Depends(get_db_session),
):
    """Create a policy from a predefined template."""
    # Check permissions
    require_permission(current_user, "policy:create")

    policy_service = PolicyService(db_session)

    try:
        policy = await create_policy_from_template(
            policy_service=policy_service,
            template_name=request.template_name,
            organization_id=request.organization_id,
            framework_id=request.framework_id,
            **(request.overrides or {}),
        )

        return {
            "id": policy.id,
            "name": policy.name,
            "description": policy.description,
            "rule_type": policy.rule_type,
            "template_name": request.template_name,
            "created_at": policy.created_at,
            "message": "Policy created from template successfully",
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# Policy operators and field information
@router.get("/operators/", response_model=dict[str, Any])
async def list_policy_operators(current_user=Depends(get_current_user)):
    """List available policy operators."""
    # Check permissions
    require_permission(current_user, "policy:read")

    operators = []
    for op in PolicyOperator:
        operators.append(
            {
                "value": op.value,
                "label": op.value.replace("_", " ").title(),
                "description": _get_operator_description(op),
            }
        )

    return {"operators": operators}


@router.get("/fields/", response_model=dict[str, Any])
async def list_policy_fields(
    rule_type: Optional[PolicyRuleType] = Query(
        None, description="Filter by rule type"
    ),
    current_user=Depends(get_current_user),
):
    """List available policy fields for evaluation."""
    # Check permissions
    require_permission(current_user, "policy:read")

    fields = []

    # Common fields
    common_fields = [
        {"name": "package.name", "type": "string", "description": "Package name"},
        {"name": "package.version", "type": "string", "description": "Package version"},
        {"name": "package.license", "type": "string", "description": "Package license"},
        {
            "name": "package.last_updated",
            "type": "datetime",
            "description": "Last update date",
        },
        {
            "name": "package.download_count",
            "type": "number",
            "description": "Download count",
        },
        {
            "name": "dependency.scope",
            "type": "string",
            "description": "Dependency scope",
        },
        {
            "name": "dependency.is_direct",
            "type": "boolean",
            "description": "Direct dependency flag",
        },
        {
            "name": "vulnerability.max_severity",
            "type": "string",
            "description": "Maximum vulnerability severity",
        },
        {
            "name": "vulnerability.count",
            "type": "number",
            "description": "Number of vulnerabilities",
        },
        {
            "name": "vulnerability.cvss_score",
            "type": "number",
            "description": "CVSS score",
        },
    ]

    # Rule type specific fields
    if rule_type == PolicyRuleType.SECURITY:
        fields.extend(
            [
                {
                    "name": "vulnerability.exploit_available",
                    "type": "boolean",
                    "description": "Exploit available",
                },
                {
                    "name": "vulnerability.published_at",
                    "type": "datetime",
                    "description": "Vulnerability publish date",
                },
                {
                    "name": "package.maintained",
                    "type": "boolean",
                    "description": "Package is maintained",
                },
            ]
        )
    elif rule_type == PolicyRuleType.LICENSE:
        fields.extend(
            [
                {
                    "name": "license.commercial_use",
                    "type": "boolean",
                    "description": "Allows commercial use",
                },
                {
                    "name": "license.distribution",
                    "type": "boolean",
                    "description": "Allows distribution",
                },
                {
                    "name": "license.modification",
                    "type": "boolean",
                    "description": "Allows modification",
                },
                {
                    "name": "license.patent_use",
                    "type": "boolean",
                    "description": "Allows patent use",
                },
                {
                    "name": "license.private_use",
                    "type": "boolean",
                    "description": "Allows private use",
                },
            ]
        )
    elif rule_type == PolicyRuleType.VERSION:
        fields.extend(
            [
                {
                    "name": "package.version_published_at",
                    "type": "datetime",
                    "description": "Version publish date",
                },
                {
                    "name": "package.is_prerelease",
                    "type": "boolean",
                    "description": "Is pre-release version",
                },
                {
                    "name": "package.age_days",
                    "type": "number",
                    "description": "Age in days",
                },
            ]
        )

    # Add common fields
    fields = common_fields + fields

    return {"fields": fields, "rule_type": rule_type.value if rule_type else "all"}


def _get_operator_description(operator: PolicyOperator) -> str:
    """Get description for a policy operator."""
    descriptions = {
        PolicyOperator.EQUALS: "Field equals the specified value",
        PolicyOperator.NOT_EQUALS: "Field does not equal the specified value",
        PolicyOperator.GREATER_THAN: "Field is greater than the specified value",
        PolicyOperator.GREATER_EQUAL: "Field is greater than or equal to the specified value",
        PolicyOperator.LESS_THAN: "Field is less than the specified value",
        PolicyOperator.LESS_EQUAL: "Field is less than or equal to the specified value",
        PolicyOperator.CONTAINS: "Field contains the specified value",
        PolicyOperator.NOT_CONTAINS: "Field does not contain the specified value",
        PolicyOperator.IN: "Field is in the specified list",
        PolicyOperator.NOT_IN: "Field is not in the specified list",
        PolicyOperator.REGEX: "Field matches the regular expression",
        PolicyOperator.MATCHES: "Field exactly matches the specified value",
        PolicyOperator.STARTS_WITH: "Field starts with the specified value",
        PolicyOperator.ENDS_WITH: "Field ends with the specified value",
        PolicyOperator.IS_NULL: "Field is null or empty",
        PolicyOperator.IS_NOT_NULL: "Field is not null and not empty",
        PolicyOperator.BETWEEN: "Field is between the specified range (inclusive)",
        PolicyOperator.NOT_BETWEEN: "Field is not between the specified range",
    }
    return descriptions.get(operator, "No description available")
