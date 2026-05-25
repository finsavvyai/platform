"""
Policy management API endpoints.

REST API for enterprise governance policies,
rule configuration, and compliance management.
"""

from datetime import datetime
from typing import Any
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession
from udp.core.database import get_async_session
from udp.core.policy_engine import PolicyEvaluationContext, policy_engine
from udp.domain.models import EcosystemType, LicenseType, Package

logger = structlog.get_logger()
router = APIRouter()


@router.get("/")
async def list_policies(
    organization_id: UUID,
    policy_type: str = None,
    enabled: bool = None,
    db: AsyncSession = Depends(get_async_session)
) -> dict[str, Any]:
    """
    List all available policies.

    Args:
        organization_id: Organization ID (for future org-specific policies)
        policy_type: Filter by policy type (security, license, version, etc.)
        enabled: Filter by enabled status

    Returns:
        List of policies with metadata
    """
    try:
        policies = []

        for policy_id, policy_def in policy_engine.policies.items():
            # Apply filters
            if policy_type and policy_def.policy_type.value != policy_type:
                continue

            if enabled is not None and policy_def.enabled != enabled:
                continue

            policy_info = {
                "policy_id": policy_def.policy_id,
                "name": policy_def.name,
                "description": policy_def.description,
                "policy_type": policy_def.policy_type.value,
                "version": policy_def.version,
                "enabled": policy_def.enabled,
                "priority": policy_def.priority,
                "applicable_ecosystems": [eco.value for eco in policy_def.applicable_ecosystems],
                "action": policy_def.action.value,
                "rule_count": len(policy_def.rules),
                "compliance_frameworks": policy_def.compliance_frameworks,
                "created_at": policy_def.created_at.isoformat()
            }
            policies.append(policy_info)

        # Sort by priority (higher first)
        policies.sort(key=lambda x: x["priority"], reverse=True)

        return {
            "policies": policies,
            "total": len(policies),
            "filters_applied": {
                "policy_type": policy_type,
                "enabled": enabled
            }
        }

    except Exception as e:
        logger.error("Failed to list policies", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list policies: {str(e)}"
        )


@router.get("/{policy_id}")
async def get_policy(
    policy_id: str,
    db: AsyncSession = Depends(get_async_session)
) -> dict[str, Any]:
    """
    Get detailed policy information by ID.

    Args:
        policy_id: Policy identifier

    Returns:
        Complete policy definition with rules
    """
    try:
        if policy_id not in policy_engine.policies:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Policy {policy_id} not found"
            )

        policy_def = policy_engine.policies[policy_id]

        # Build detailed response
        policy_details = {
            "policy_id": policy_def.policy_id,
            "name": policy_def.name,
            "description": policy_def.description,
            "policy_type": policy_def.policy_type.value,
            "version": policy_def.version,
            "enabled": policy_def.enabled,
            "priority": policy_def.priority,
            "applicable_ecosystems": [eco.value for eco in policy_def.applicable_ecosystems],
            "action": policy_def.action.value,
            "exceptions": policy_def.exceptions,
            "compliance_frameworks": policy_def.compliance_frameworks,
            "created_at": policy_def.created_at.isoformat(),
            "updated_at": policy_def.updated_at.isoformat() if policy_def.updated_at else None,
            "rules": []
        }

        # Add detailed rule information
        for rule in policy_def.rules:
            rule_info = {
                "rule_id": rule.rule_id,
                "description": rule.description,
                "field": rule.field,
                "operator": rule.operator.value,
                "value": rule.value,
                "severity": rule.severity,
                "message": rule.message,
                "exceptions": rule.exceptions
            }
            policy_details["rules"].append(rule_info)

        return policy_details

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get policy", policy_id=policy_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get policy: {str(e)}"
        )


@router.post("/evaluate")
async def evaluate_policies(
    evaluation_request: dict[str, Any],
    db: AsyncSession = Depends(get_async_session)
) -> dict[str, Any]:
    """
    Evaluate policies against a package or set of packages.

    Args:
        evaluation_request: Contains package data and evaluation context

    Returns:
        Policy evaluation results with violations and recommendations
    """
    try:
        organization_id = evaluation_request.get("organization_id")
        if not organization_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="organization_id is required"
            )

        # Parse package data from request
        packages = []
        package_data_list = evaluation_request.get("packages", [])

        for pkg_data in package_data_list:
            try:
                package = Package(
                    name=pkg_data["name"],
                    version=pkg_data["version"],
                    ecosystem=EcosystemType(pkg_data["ecosystem"]),
                    license=LicenseType(pkg_data.get("license", "Unknown")),
                    namespace=pkg_data.get("namespace"),
                    description=pkg_data.get("description"),
                    author=pkg_data.get("author"),
                    homepage=pkg_data.get("homepage")
                )
                packages.append(package)
            except Exception as e:
                logger.warning(f"Could not parse package data: {pkg_data}, error: {e}")
                continue

        if not packages:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No valid packages provided for evaluation"
            )

        # Create evaluation context
        context = PolicyEvaluationContext(
            organization_id=organization_id,
            request_id=evaluation_request.get("request_id", "api_evaluation"),
            evaluation_timestamp=datetime.utcnow(),
            vulnerabilities=evaluation_request.get("vulnerabilities", []),
            metadata=evaluation_request.get("metadata", {})
        )

        # Evaluate policies
        evaluation_results = policy_engine.evaluate_policies(packages, context)

        # Process results for API response
        response_data = {
            "evaluation_summary": {
                "packages_evaluated": len(packages),
                "policies_evaluated": len(policy_engine.policies),
                "evaluation_timestamp": context.evaluation_timestamp.isoformat()
            },
            "package_results": {},
            "overall_assessment": {
                "total_violations": 0,
                "blocking_violations": 0,
                "warning_violations": 0,
                "packages_with_violations": 0,
                "recommended_action": "allow"
            }
        }

        total_violations = 0
        blocking_violations = 0
        warning_violations = 0
        packages_with_violations = 0

        for package_key, policy_results in evaluation_results.items():
            package_violations = []
            package_has_violations = False

            for result in policy_results:
                if result.overall_result.value in ["fail", "warn"]:
                    package_has_violations = True
                    total_violations += 1

                    if result.action.value == "block":
                        blocking_violations += 1
                    elif result.action.value in ["require_approval", "warn"]:
                        warning_violations += 1

                    violation = {
                        "policy_id": result.policy_id,
                        "policy_name": result.policy_name,
                        "result": result.overall_result.value,
                        "action": result.action.value,
                        "execution_time_ms": result.execution_time_ms,
                        "rule_violations": []
                    }

                    # Add rule-level details
                    for rule_result in result.rule_results:
                        if rule_result.result.value in ["fail", "warn"]:
                            rule_violation = {
                                "rule_id": rule_result.rule_id,
                                "message": rule_result.message,
                                "severity": rule_result.details.get("severity", "medium"),
                                "details": rule_result.details
                            }
                            violation["rule_violations"].append(rule_violation)

                    package_violations.append(violation)

            if package_has_violations:
                packages_with_violations += 1

            response_data["package_results"][package_key] = {
                "violations": package_violations,
                "violation_count": len(package_violations),
                "has_blocking_violations": any(v["action"] == "block" for v in package_violations)
            }

        # Determine overall recommendation
        if blocking_violations > 0:
            recommended_action = "block"
        elif warning_violations > 0:
            recommended_action = "require_approval"
        else:
            recommended_action = "allow"

        response_data["overall_assessment"].update({
            "total_violations": total_violations,
            "blocking_violations": blocking_violations,
            "warning_violations": warning_violations,
            "packages_with_violations": packages_with_violations,
            "recommended_action": recommended_action
        })

        logger.info(
            "Policy evaluation completed",
            organization_id=organization_id,
            packages_evaluated=len(packages),
            total_violations=total_violations,
            recommended_action=recommended_action
        )

        return response_data

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Policy evaluation failed", error=str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Policy evaluation failed: {str(e)}"
        )


@router.post("/load")
async def load_policies_from_yaml(
    organization_id: UUID,
    policy_file: UploadFile = File(...),
    db: AsyncSession = Depends(get_async_session)
) -> dict[str, Any]:
    """
    Load policies from YAML file.

    Args:
        organization_id: Organization ID
        policy_file: YAML file containing policy definitions

    Returns:
        Summary of loaded policies
    """
    try:
        if not policy_file.filename.endswith(('.yaml', '.yml')):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File must be a YAML file (.yaml or .yml)"
            )

        # Read YAML content
        content = await policy_file.read()
        yaml_content = content.decode('utf-8')

        # Load policies
        initial_policy_count = len(policy_engine.policies)
        policy_engine.load_policies_from_yaml(yaml_content)
        new_policy_count = len(policy_engine.policies)

        loaded_count = new_policy_count - initial_policy_count

        logger.info(
            "Policies loaded from YAML",
            organization_id=str(organization_id),
            filename=policy_file.filename,
            policies_loaded=loaded_count
        )

        return {
            "status": "success",
            "message": f"Loaded {loaded_count} policies from {policy_file.filename}",
            "policies_loaded": loaded_count,
            "total_policies": new_policy_count
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to load policies from YAML",
            filename=policy_file.filename if policy_file else "unknown",
            error=str(e)
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load policies: {str(e)}"
        )


@router.get("/export/yaml")
async def export_policies_to_yaml(
    organization_id: UUID,
    db: AsyncSession = Depends(get_async_session)
) -> dict[str, Any]:
    """
    Export all policies to YAML format.

    Args:
        organization_id: Organization ID

    Returns:
        YAML content of all policies
    """
    try:
        yaml_content = policy_engine.export_policies_to_yaml()

        logger.info(
            "Policies exported to YAML",
            organization_id=str(organization_id),
            policy_count=len(policy_engine.policies)
        )

        return {
            "yaml_content": yaml_content,
            "policy_count": len(policy_engine.policies),
            "export_timestamp": datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error("Failed to export policies", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export policies: {str(e)}"
        )


@router.get("/compliance/frameworks")
async def list_compliance_frameworks(
    organization_id: UUID,
    db: AsyncSession = Depends(get_async_session)
) -> dict[str, Any]:
    """
    List all compliance frameworks referenced in policies.

    Args:
        organization_id: Organization ID

    Returns:
        List of compliance frameworks with policy mappings
    """
    try:
        frameworks = {}

        for policy_def in policy_engine.policies.values():
            for framework in policy_def.compliance_frameworks:
                if framework not in frameworks:
                    frameworks[framework] = {
                        "framework": framework,
                        "policies": [],
                        "total_policies": 0
                    }

                frameworks[framework]["policies"].append({
                    "policy_id": policy_def.policy_id,
                    "policy_name": policy_def.name,
                    "policy_type": policy_def.policy_type.value,
                    "priority": policy_def.priority,
                    "enabled": policy_def.enabled
                })
                frameworks[framework]["total_policies"] += 1

        return {
            "compliance_frameworks": list(frameworks.values()),
            "total_frameworks": len(frameworks),
            "summary": {
                framework: data["total_policies"]
                for framework, data in frameworks.items()
            }
        }

    except Exception as e:
        logger.error("Failed to list compliance frameworks", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list compliance frameworks: {str(e)}"
        )
