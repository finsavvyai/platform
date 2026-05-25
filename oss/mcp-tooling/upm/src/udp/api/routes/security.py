"""
API routes for enterprise security and compliance features.

Provides endpoints for compliance management, security policies,
audit logging, and enterprise security controls.
"""

import logging
from datetime import datetime, timedelta
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from udp.api.routes.dependencies import get_current_organization, get_current_user
from udp.domain.models import Organization, User
from udp.security.audit_logger import (
    AuditEventSeverity,
    AuditEventStatus,
    AuditEventType,
    AuditLogger,
    AuditQuery,
)
from udp.security.compliance_manager import (
    ComplianceFramework,
    ComplianceManager,
)
from udp.security.security_policies import (
    PolicyAction,
    PolicyEvaluationResult,
    PolicyRule,
    PolicySeverity,
    PolicyType,
    SecurityPolicyEngine,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# Request/Response Models
class ComplianceAssessmentRequest(BaseModel):
    """Request model for compliance assessment."""
    framework: ComplianceFramework = Field(..., description="Compliance framework to assess against")
    assessor_id: str = Field(..., description="ID of the person performing the assessment")


class ComplianceAssessmentResponse(BaseModel):
    """Response model for compliance assessment."""
    organization_id: str
    framework: str
    assessment_date: str
    overall_status: str
    compliance_percentage: float
    requirements_summary: dict[str, int]
    violations_summary: dict[str, int]
    recommendations: list[str]


class PolicyRuleRequest(BaseModel):
    """Request model for creating/updating policy rules."""
    id: str = Field(..., description="Policy rule ID")
    name: str = Field(..., description="Policy rule name")
    description: str = Field(..., description="Policy rule description")
    policy_type: PolicyType = Field(..., description="Type of policy")
    conditions: dict[str, Any] = Field(..., description="Policy conditions")
    action: PolicyAction = Field(..., description="Policy action")
    severity: PolicySeverity = Field(..., description="Policy severity")
    enabled: bool = Field(True, description="Whether policy is enabled")


class PolicyEvaluationRequest(BaseModel):
    """Request model for policy evaluation."""
    policy_type: PolicyType = Field(..., description="Type of policy to evaluate")
    resource_data: dict[str, Any] = Field(..., description="Resource data to evaluate")
    user_id: Optional[str] = Field(None, description="User performing the action")


class PolicyEvaluationResponse(BaseModel):
    """Response model for policy evaluation."""
    violated: bool
    results: list[PolicyEvaluationResult]
    overall_action: PolicyAction
    risk_score: float


class AuditQueryRequest(BaseModel):
    """Request model for audit log queries."""
    start_time: Optional[datetime] = Field(None, description="Start time for query")
    end_time: Optional[datetime] = Field(None, description="End time for query")
    event_types: Optional[list[AuditEventType]] = Field(None, description="Event types to filter")
    severity_levels: Optional[list[AuditEventSeverity]] = Field(None, description="Severity levels to filter")
    user_ids: Optional[list[str]] = Field(None, description="User IDs to filter")
    resource_types: Optional[list[str]] = Field(None, description="Resource types to filter")
    resource_ids: Optional[list[str]] = Field(None, description="Resource IDs to filter")
    status: Optional[list[AuditEventStatus]] = Field(None, description="Event status to filter")
    tags: Optional[list[str]] = Field(None, description="Tags to filter")
    correlation_id: Optional[str] = Field(None, description="Correlation ID to filter")
    limit: int = Field(1000, description="Maximum number of results")
    offset: int = Field(0, description="Offset for pagination")


class AuditReportRequest(BaseModel):
    """Request model for audit reports."""
    start_time: datetime = Field(..., description="Report start time")
    end_time: datetime = Field(..., description="Report end time")
    report_type: str = Field("compliance", description="Type of report (compliance, security, summary)")
    format: str = Field("json", description="Report format (json, csv, xml)")


# API Endpoints
@router.get("/compliance/frameworks", response_model=list[str])
async def get_supported_compliance_frameworks(
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """Get list of supported compliance frameworks."""
    try:
        compliance_manager = ComplianceManager()
        frameworks = compliance_manager.get_supported_frameworks()
        return [framework.value for framework in frameworks]
    except Exception as e:
        logger.error(f"Failed to get compliance frameworks: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get compliance frameworks: {str(e)}"
        )


@router.get("/compliance/frameworks/{framework}/requirements", response_model=list[dict[str, Any]])
async def get_framework_requirements(
    framework: ComplianceFramework,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """Get requirements for a specific compliance framework."""
    try:
        compliance_manager = ComplianceManager()
        requirements = compliance_manager.get_framework_requirements(framework)

        return [
            {
                "id": req.id,
                "title": req.title,
                "description": req.description,
                "category": req.category,
                "severity": req.severity.value,
                "controls": req.controls,
                "evidence_required": req.evidence_required,
                "assessment_frequency": req.assessment_frequency
            }
            for req in requirements
        ]
    except Exception as e:
        logger.error(f"Failed to get framework requirements: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get framework requirements: {str(e)}"
        )


@router.post("/compliance/assess", response_model=ComplianceAssessmentResponse)
async def assess_compliance(
    request: ComplianceAssessmentRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """Perform compliance assessment for the organization."""
    try:
        logger.info(f"Starting compliance assessment for organization {current_org.id}")

        compliance_manager = ComplianceManager()

        # Perform assessment
        report = compliance_manager.assess_compliance(
            organization_id=current_org.id,
            framework=request.framework,
            assessor_id=request.assessor_id
        )

        # Log audit event
        background_tasks.add_task(
            _log_compliance_assessment_event,
            current_user.id, current_org.id, request.framework, report
        )

        return ComplianceAssessmentResponse(
            organization_id=str(current_org.id),
            framework=request.framework.value,
            assessment_date=report["assessment_date"],
            overall_status=report["overall_status"],
            compliance_percentage=report["compliance_percentage"],
            requirements_summary=report["requirements_summary"],
            violations_summary=report["violations_summary"],
            recommendations=report["recommendations"]
        )

    except Exception as e:
        logger.error(f"Failed to assess compliance: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to assess compliance: {str(e)}"
        )


@router.get("/compliance/status", response_model=dict[str, Any])
async def get_compliance_status(
    framework: Optional[ComplianceFramework] = Query(None, description="Specific framework to check"),
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """Get current compliance status for the organization."""
    try:
        compliance_manager = ComplianceManager()
        status = compliance_manager.get_compliance_status(
            organization_id=current_org.id,
            framework=framework
        )
        return status
    except Exception as e:
        logger.error(f"Failed to get compliance status: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get compliance status: {str(e)}"
        )


@router.get("/compliance/violations", response_model=list[dict[str, Any]])
async def get_compliance_violations(
    framework: Optional[ComplianceFramework] = Query(None, description="Framework to filter by"),
    severity: Optional[str] = Query(None, description="Severity level to filter by"),
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """Get compliance violations for the organization."""
    try:
        compliance_manager = ComplianceManager()
        violations = compliance_manager.get_violations(
            organization_id=current_org.id,
            framework=framework,
            severity=severity
        )

        return [
            {
                "id": str(violation.id),
                "requirement_id": violation.requirement_id,
                "framework": violation.framework.value,
                "violation_type": violation.violation_type,
                "description": violation.description,
                "severity": violation.severity.value,
                "detected_at": violation.detected_at.isoformat(),
                "detected_by": violation.detected_by,
                "affected_resources": violation.affected_resources,
                "remediation_status": violation.remediation_status,
                "remediation_deadline": violation.remediation_deadline.isoformat() if violation.remediation_deadline else None,
                "remediation_notes": violation.remediation_notes
            }
            for violation in violations
        ]
    except Exception as e:
        logger.error(f"Failed to get compliance violations: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get compliance violations: {str(e)}"
        )


@router.post("/policies", response_model=dict[str, str])
async def create_security_policy(
    request: PolicyRuleRequest,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """Create a new security policy."""
    try:
        logger.info(f"Creating security policy: {request.name}")

        policy_engine = SecurityPolicyEngine()

        # Create policy rule
        policy_rule = PolicyRule(
            id=request.id,
            name=request.name,
            description=request.description,
            policy_type=request.policy_type,
            conditions=request.conditions,
            action=request.action,
            severity=request.severity,
            enabled=request.enabled
        )

        success = policy_engine.create_policy(policy_rule, current_org.id)

        if success:
            return {"message": "Security policy created successfully", "policy_id": request.id}
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create security policy"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create security policy: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create security policy: {str(e)}"
        )


@router.post("/policies/evaluate", response_model=PolicyEvaluationResponse)
async def evaluate_policies(
    request: PolicyEvaluationRequest,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """Evaluate policies against resource data."""
    try:
        policy_engine = SecurityPolicyEngine()

        # Evaluate policies
        results = policy_engine.evaluate_policy(
            policy_type=request.policy_type,
            resource_data=request.resource_data,
            organization_id=current_org.id,
            user_id=request.user_id
        )

        # Determine overall result
        violated = any(result.violated for result in results)
        overall_action = PolicyAction.DENY if violated else PolicyAction.ALLOW
        risk_score = max((result.severity.value for result in results), default=0.0)

        return PolicyEvaluationResponse(
            violated=violated,
            results=results,
            overall_action=overall_action,
            risk_score=risk_score
        )

    except Exception as e:
        logger.error(f"Failed to evaluate policies: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to evaluate policies: {str(e)}"
        )


@router.get("/policies/violations", response_model=list[dict[str, Any]])
async def get_policy_violations(
    policy_type: Optional[PolicyType] = Query(None, description="Policy type to filter by"),
    severity: Optional[PolicySeverity] = Query(None, description="Severity level to filter by"),
    days: int = Query(30, description="Number of days to look back"),
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """Get policy violations for the organization."""
    try:
        policy_engine = SecurityPolicyEngine()

        # Calculate time range
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(days=days)

        violations = policy_engine.get_policy_violations(
            organization_id=current_org.id,
            policy_type=policy_type,
            severity=severity,
            time_range=(start_time, end_time)
        )

        return [
            {
                "id": str(violation.id),
                "rule_id": violation.rule_id,
                "policy_type": violation.policy_type.value,
                "violation_type": violation.violation_type,
                "description": violation.description,
                "severity": violation.severity.value,
                "detected_at": violation.detected_at.isoformat(),
                "detected_by": violation.detected_by,
                "affected_resource": violation.affected_resource,
                "violation_data": violation.violation_data,
                "remediation_status": violation.remediation_status,
                "remediation_notes": violation.remediation_notes
            }
            for violation in violations
        ]
    except Exception as e:
        logger.error(f"Failed to get policy violations: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get policy violations: {str(e)}"
        )


@router.get("/policies/statistics", response_model=dict[str, Any])
async def get_policy_statistics(
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """Get policy statistics for the organization."""
    try:
        policy_engine = SecurityPolicyEngine()
        stats = policy_engine.get_policy_statistics(current_org.id)
        return stats
    except Exception as e:
        logger.error(f"Failed to get policy statistics: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get policy statistics: {str(e)}"
        )


@router.post("/audit/query", response_model=list[dict[str, Any]])
async def query_audit_logs(
    request: AuditQueryRequest,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """Query audit logs based on criteria."""
    try:
        audit_logger = AuditLogger()

        # Create audit query
        query = AuditQuery(
            start_time=request.start_time,
            end_time=request.end_time,
            event_types=request.event_types,
            severity_levels=request.severity_levels,
            user_ids=request.user_ids,
            organization_ids=[current_org.id],
            resource_types=request.resource_types,
            resource_ids=request.resource_ids,
            status=request.status,
            tags=request.tags,
            correlation_id=request.correlation_id,
            limit=request.limit,
            offset=request.offset
        )

        events = audit_logger.query_events(query)

        return [
            {
                "id": str(event.id),
                "event_type": event.event_type.value,
                "severity": event.severity.value,
                "status": event.status.value,
                "timestamp": event.timestamp.isoformat(),
                "user_id": event.user_id,
                "organization_id": str(event.organization_id) if event.organization_id else None,
                "action": event.action,
                "description": event.description,
                "resource_type": event.resource_type,
                "resource_id": event.resource_id,
                "outcome": event.outcome,
                "risk_score": event.risk_score,
                "tags": event.tags,
                "correlation_id": event.correlation_id
            }
            for event in events
        ]
    except Exception as e:
        logger.error(f"Failed to query audit logs: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to query audit logs: {str(e)}"
        )


@router.post("/audit/report", response_model=dict[str, Any])
async def generate_audit_report(
    request: AuditReportRequest,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """Generate an audit report."""
    try:
        audit_logger = AuditLogger()

        report = audit_logger.generate_audit_report(
            organization_id=current_org.id,
            start_time=request.start_time,
            end_time=request.end_time,
            report_type=request.report_type
        )

        return report
    except Exception as e:
        logger.error(f"Failed to generate audit report: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate audit report: {str(e)}"
        )


@router.post("/audit/export")
async def export_audit_logs(
    request: AuditQueryRequest,
    format: str = Query("json", description="Export format (json, csv, xml)"),
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """Export audit logs in specified format."""
    try:
        audit_logger = AuditLogger()

        # Create audit query
        query = AuditQuery(
            start_time=request.start_time,
            end_time=request.end_time,
            event_types=request.event_types,
            severity_levels=request.severity_levels,
            user_ids=request.user_ids,
            organization_ids=[current_org.id],
            resource_types=request.resource_types,
            resource_ids=request.resource_ids,
            status=request.status,
            tags=request.tags,
            correlation_id=request.correlation_id,
            limit=request.limit,
            offset=request.offset
        )

        exported_data = audit_logger.export_audit_logs(query, format)

        # Set appropriate content type
        content_type = {
            "json": "application/json",
            "csv": "text/csv",
            "xml": "application/xml"
        }.get(format, "application/octet-stream")

        return {
            "data": exported_data,
            "format": format,
            "content_type": content_type,
            "exported_at": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Failed to export audit logs: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export audit logs: {str(e)}"
        )


@router.get("/audit/event/{event_id}", response_model=dict[str, Any])
async def get_audit_event(
    event_id: UUID,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """Get a specific audit event by ID."""
    try:
        audit_logger = AuditLogger()
        event = audit_logger.get_event_by_id(event_id)

        if not event:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Audit event not found"
            )

        # Check if user has access to this event
        if event.organization_id != current_org.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this audit event"
            )

        return {
            "id": str(event.id),
            "event_type": event.event_type.value,
            "severity": event.severity.value,
            "status": event.status.value,
            "timestamp": event.timestamp.isoformat(),
            "user_id": event.user_id,
            "organization_id": str(event.organization_id) if event.organization_id else None,
            "session_id": event.session_id,
            "source_ip": event.source_ip,
            "user_agent": event.user_agent,
            "resource_type": event.resource_type,
            "resource_id": event.resource_id,
            "action": event.action,
            "description": event.description,
            "details": event.details,
            "outcome": event.outcome,
            "risk_score": event.risk_score,
            "tags": event.tags,
            "correlation_id": event.correlation_id,
            "parent_event_id": str(event.parent_event_id) if event.parent_event_id else None
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get audit event: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get audit event: {str(e)}"
        )


@router.get("/audit/event/{event_id}/related", response_model=list[dict[str, Any]])
async def get_related_audit_events(
    event_id: UUID,
    max_depth: int = Query(3, description="Maximum depth for related events"),
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """Get events related to a specific audit event."""
    try:
        audit_logger = AuditLogger()
        related_events = audit_logger.get_related_events(event_id, max_depth)

        return [
            {
                "id": str(event.id),
                "event_type": event.event_type.value,
                "severity": event.severity.value,
                "status": event.status.value,
                "timestamp": event.timestamp.isoformat(),
                "action": event.action,
                "description": event.description,
                "risk_score": event.risk_score,
                "correlation_id": event.correlation_id
            }
            for event in related_events
        ]
    except Exception as e:
        logger.error(f"Failed to get related audit events: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get related audit events: {str(e)}"
        )


# Helper Functions
async def _log_compliance_assessment_event(
    user_id: str,
    organization_id: UUID,
    framework: ComplianceFramework,
    report: dict[str, Any]
):
    """Log compliance assessment event to audit logger."""
    try:
        audit_logger = AuditLogger()
        audit_logger.log_event(
            event_type=AuditEventType.COMPLIANCE_EVENT,
            action="compliance_assessment",
            description=f"Compliance assessment performed for {framework.value}",
            user_id=user_id,
            organization_id=organization_id,
            details={
                "framework": framework.value,
                "compliance_percentage": report.get("compliance_percentage", 0),
                "overall_status": report.get("overall_status", "unknown"),
                "violations_count": sum(report.get("violations_summary", {}).values())
            },
            severity=AuditEventSeverity.MEDIUM,
            status=AuditEventStatus.SUCCESS,
            tags=["compliance", "assessment", framework.value.lower()]
        )
    except Exception as e:
        logger.error(f"Failed to log compliance assessment event: {e}")
