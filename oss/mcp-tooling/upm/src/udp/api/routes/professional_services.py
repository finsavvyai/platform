"""
API routes for professional services.

Provides endpoints for professional services platform including
service requests, consultant management, and project delivery.
"""

import logging
from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, Field
from udp.api.routes.dependencies import get_current_organization, get_current_user
from udp.domain.models import Organization, User
from udp.services.professional_services import (
    ConsultantSpecialty,
    ProfessionalServicesManager,
    Project,
    ServiceRequest,
    ServiceStatus,
    ServiceType,
)

logger = logging.getLogger(__name__)
router = APIRouter()

# Initialize services manager
services_manager = ProfessionalServicesManager()


# Request/Response Models
class ServiceRequestCreate(BaseModel):
    """Request model for creating service request."""
    service_type: ServiceType
    title: str
    description: str
    requirements: list[str] = Field(default_factory=list)
    budget_range: list[float] = Field(default=[1000.0, 10000.0])
    timeline_weeks: int = Field(default=4)
    priority: str = Field(default="medium")


class ServiceRequestResponse(BaseModel):
    """Response model for service request."""
    id: str
    organization_id: str
    requester_id: str
    service_type: str
    title: str
    description: str
    requirements: list[str]
    budget_range: list[float]
    timeline_weeks: int
    priority: str
    status: str
    created_at: str
    updated_at: str
    metadata: dict[str, Any]


class ConsultantResponse(BaseModel):
    """Response model for consultant."""
    id: str
    name: str
    email: str
    specialties: list[str]
    experience_years: int
    certifications: list[str]
    hourly_rate: float
    availability: dict[str, Any]
    rating: float
    completed_projects: int


class ProjectCreate(BaseModel):
    """Request model for creating project."""
    service_request_id: str
    consultant_id: str
    name: str
    description: str
    complexity: str = Field(default="medium")
    estimated_hours: int = Field(default=40)
    timeline_weeks: int = Field(default=4)
    budget_range: list[float] = Field(default=[1000.0, 10000.0])
    requirements: list[str] = Field(default_factory=list)
    deliverables: list[str] = Field(default_factory=list)


class ProjectResponse(BaseModel):
    """Response model for project."""
    id: str
    name: str
    description: str
    service_type: str
    complexity: str
    estimated_hours: int
    timeline_weeks: int
    budget_range: list[float]
    requirements: list[str]
    deliverables: list[str]


class ServiceQuoteResponse(BaseModel):
    """Response model for service quote."""
    id: str
    project_id: str
    consultant_id: str
    total_cost: float
    hourly_rate: float
    estimated_hours: int
    timeline_weeks: int
    breakdown: dict[str, Any]
    terms_conditions: str
    valid_until: str


class ServiceDeliveryResponse(BaseModel):
    """Response model for service delivery."""
    id: str
    project_id: str
    consultant_id: str
    status: str
    progress_percentage: float
    milestones: list[dict[str, Any]]
    deliverables: list[dict[str, Any]]
    hours_logged: float
    last_updated: str


class DeliveryProgressUpdate(BaseModel):
    """Request model for updating delivery progress."""
    progress_percentage: float
    hours_logged: float
    milestone_updates: list[dict[str, Any]] = Field(default_factory=list)
    deliverable_updates: list[dict[str, Any]] = Field(default_factory=list)


# API Endpoints
@router.post("/requests", response_model=ServiceRequestResponse)
async def create_service_request(
    request: ServiceRequestCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """Create a new service request."""
    try:
        logger.info(f"Creating service request for {request.service_type.value} by user {current_user.id}")

        service_request = services_manager.create_service_request(
            organization_id=current_org.id,
            requester_id=current_user.id,
            service_type=request.service_type,
            title=request.title,
            description=request.description,
            requirements=request.requirements,
            budget_range=tuple(request.budget_range),
            timeline_weeks=request.timeline_weeks,
            priority=request.priority
        )

        # Log audit event
        background_tasks.add_task(
            _log_service_request_event,
            current_user.id, current_org.id, service_request
        )

        return ServiceRequestResponse(
            id=service_request.id,
            organization_id=service_request.organization_id,
            requester_id=service_request.requester_id,
            service_type=service_request.service_type.value,
            title=service_request.title,
            description=service_request.description,
            requirements=service_request.requirements,
            budget_range=list(service_request.budget_range),
            timeline_weeks=service_request.timeline_weeks,
            priority=service_request.priority,
            status=service_request.status.value,
            created_at=service_request.created_at.isoformat(),
            updated_at=service_request.updated_at.isoformat(),
            metadata=service_request.metadata
        )

    except Exception as e:
        logger.error(f"Failed to create service request: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create service request: {str(e)}"
        )


@router.get("/requests", response_model=list[ServiceRequestResponse])
async def get_service_requests(
    status: Optional[ServiceStatus] = None,
    service_type: Optional[ServiceType] = None,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """Get service requests for the organization."""
    try:
        logger.info(f"Getting service requests for organization {current_org.id}")

        requests = services_manager.get_service_requests(
            organization_id=current_org.id,
            status=status,
            service_type=service_type
        )

        return [
            ServiceRequestResponse(
                id=req.id,
                organization_id=req.organization_id,
                requester_id=req.requester_id,
                service_type=req.service_type.value,
                title=req.title,
                description=req.description,
                requirements=req.requirements,
                budget_range=list(req.budget_range),
                timeline_weeks=req.timeline_weeks,
                priority=req.priority,
                status=req.status.value,
                created_at=req.created_at.isoformat(),
                updated_at=req.updated_at.isoformat(),
                metadata=req.metadata
            )
            for req in requests
        ]

    except Exception as e:
        logger.error(f"Failed to get service requests: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get service requests: {str(e)}"
        )


@router.get("/consultants", response_model=list[ConsultantResponse])
async def get_consultants(
    specialties: Optional[list[ConsultantSpecialty]] = None,
    min_rating: float = 0.0,
    max_hourly_rate: Optional[float] = None,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """Get available consultants with filters."""
    try:
        logger.info(f"Getting consultants with filters: specialties={specialties}, min_rating={min_rating}")

        consultants = services_manager.get_consultants(
            specialties=specialties,
            min_rating=min_rating,
            max_hourly_rate=max_hourly_rate
        )

        return [
            ConsultantResponse(
                id=consultant.id,
                name=consultant.name,
                email=consultant.email,
                specialties=[s.value for s in consultant.specialties],
                experience_years=consultant.experience_years,
                certifications=consultant.certifications,
                hourly_rate=consultant.hourly_rate,
                availability=consultant.availability,
                rating=consultant.rating,
                completed_projects=consultant.completed_projects
            )
            for consultant in consultants
        ]

    except Exception as e:
        logger.error(f"Failed to get consultants: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get consultants: {str(e)}"
        )


@router.post("/projects", response_model=ProjectResponse)
async def create_project(
    request: ProjectCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """Create a project from a service request."""
    try:
        logger.info(f"Creating project for service request {request.service_request_id}")

        project = services_manager.create_project(
            service_request_id=request.service_request_id,
            consultant_id=request.consultant_id,
            name=request.name,
            description=request.description,
            complexity=request.complexity,
            estimated_hours=request.estimated_hours,
            timeline_weeks=request.timeline_weeks,
            budget_range=tuple(request.budget_range),
            requirements=request.requirements,
            deliverables=request.deliverables
        )

        # Log audit event
        background_tasks.add_task(
            _log_project_creation_event,
            current_user.id, current_org.id, project
        )

        return ProjectResponse(
            id=project.id,
            name=project.name,
            description=project.description,
            service_type=project.service_type.value,
            complexity=project.complexity,
            estimated_hours=project.estimated_hours,
            timeline_weeks=project.timeline_weeks,
            budget_range=list(project.budget_range),
            requirements=project.requirements,
            deliverables=project.deliverables
        )

    except Exception as e:
        logger.error(f"Failed to create project: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create project: {str(e)}"
        )


@router.post("/quotes", response_model=ServiceQuoteResponse)
async def generate_quote(
    project_id: str,
    consultant_id: str,
    estimated_hours: int,
    timeline_weeks: int,
    terms_conditions: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """Generate a service quote."""
    try:
        logger.info(f"Generating quote for project {project_id}")

        quote = services_manager.generate_quote(
            project_id=project_id,
            consultant_id=consultant_id,
            estimated_hours=estimated_hours,
            timeline_weeks=timeline_weeks,
            terms_conditions=terms_conditions
        )

        return ServiceQuoteResponse(
            id=quote.id,
            project_id=quote.project_id,
            consultant_id=quote.consultant_id,
            total_cost=quote.total_cost,
            hourly_rate=quote.hourly_rate,
            estimated_hours=quote.estimated_hours,
            timeline_weeks=quote.timeline_weeks,
            breakdown=quote.breakdown,
            terms_conditions=quote.terms_conditions,
            valid_until=quote.valid_until.isoformat()
        )

    except Exception as e:
        logger.error(f"Failed to generate quote: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate quote: {str(e)}"
        )


@router.post("/deliveries", response_model=ServiceDeliveryResponse)
async def start_service_delivery(
    project_id: str,
    consultant_id: str,
    milestones: Optional[list[dict[str, Any]]] = None,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """Start service delivery for a project."""
    try:
        logger.info(f"Starting service delivery for project {project_id}")

        delivery = services_manager.start_service_delivery(
            project_id=project_id,
            consultant_id=consultant_id,
            milestones=milestones
        )

        return ServiceDeliveryResponse(
            id=delivery.id,
            project_id=delivery.project_id,
            consultant_id=delivery.consultant_id,
            status=delivery.status.value,
            progress_percentage=delivery.progress_percentage,
            milestones=delivery.milestones,
            deliverables=delivery.deliverables,
            hours_logged=delivery.hours_logged,
            last_updated=delivery.last_updated.isoformat()
        )

    except Exception as e:
        logger.error(f"Failed to start service delivery: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start service delivery: {str(e)}"
        )


@router.put("/deliveries/{delivery_id}/progress", response_model=ServiceDeliveryResponse)
async def update_delivery_progress(
    delivery_id: str,
    request: DeliveryProgressUpdate,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """Update service delivery progress."""
    try:
        logger.info(f"Updating delivery progress for {delivery_id}")

        delivery = services_manager.update_delivery_progress(
            delivery_id=delivery_id,
            progress_percentage=request.progress_percentage,
            hours_logged=request.hours_logged,
            milestone_updates=request.milestone_updates,
            deliverable_updates=request.deliverable_updates
        )

        return ServiceDeliveryResponse(
            id=delivery.id,
            project_id=delivery.project_id,
            consultant_id=delivery.consultant_id,
            status=delivery.status.value,
            progress_percentage=delivery.progress_percentage,
            milestones=delivery.milestones,
            deliverables=delivery.deliverables,
            hours_logged=delivery.hours_logged,
            last_updated=delivery.last_updated.isoformat()
        )

    except Exception as e:
        logger.error(f"Failed to update delivery progress: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update delivery progress: {str(e)}"
        )


@router.get("/analytics", response_model=dict[str, Any])
async def get_service_analytics(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """Get service analytics for the organization."""
    try:
        logger.info(f"Getting service analytics for organization {current_org.id}")

        analytics = services_manager.get_service_analytics(
            organization_id=current_org.id,
            start_date=start_date,
            end_date=end_date
        )

        return analytics

    except Exception as e:
        logger.error(f"Failed to get service analytics: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get service analytics: {str(e)}"
        )


@router.get("/consultants/{consultant_id}/performance", response_model=dict[str, Any])
async def get_consultant_performance(
    consultant_id: str,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """Get consultant performance metrics."""
    try:
        logger.info(f"Getting performance metrics for consultant {consultant_id}")

        performance = services_manager.get_consultant_performance(consultant_id)
        return performance

    except Exception as e:
        logger.error(f"Failed to get consultant performance: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get consultant performance: {str(e)}"
        )


@router.get("/statistics", response_model=dict[str, Any])
async def get_service_statistics(
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """Get overall service statistics."""
    try:
        logger.info("Getting service statistics")

        statistics = services_manager.get_service_statistics()
        return statistics

    except Exception as e:
        logger.error(f"Failed to get service statistics: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get service statistics: {str(e)}"
        )


@router.get("/service-types", response_model=list[dict[str, str]])
async def get_service_types(
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """Get available service types."""
    try:
        service_types = [
            {
                "id": ServiceType.WORKFLOW_DEVELOPMENT.value,
                "name": "Workflow Development",
                "description": "Custom workflow development and automation"
            },
            {
                "id": ServiceType.CONSULTING.value,
                "name": "Consulting",
                "description": "Strategic consulting and advisory services"
            },
            {
                "id": ServiceType.TRAINING.value,
                "name": "Training",
                "description": "Training and education services"
            },
            {
                "id": ServiceType.SUPPORT.value,
                "name": "Support",
                "description": "Technical support and maintenance"
            },
            {
                "id": ServiceType.INTEGRATION.value,
                "name": "Integration",
                "description": "System integration and API development"
            },
            {
                "id": ServiceType.MIGRATION.value,
                "name": "Migration",
                "description": "Data and system migration services"
            },
            {
                "id": ServiceType.OPTIMIZATION.value,
                "name": "Optimization",
                "description": "Performance optimization and tuning"
            },
            {
                "id": ServiceType.SECURITY_AUDIT.value,
                "name": "Security Audit",
                "description": "Security assessment and audit services"
            },
            {
                "id": ServiceType.COMPLIANCE_REVIEW.value,
                "name": "Compliance Review",
                "description": "Compliance assessment and review"
            },
            {
                "id": ServiceType.CUSTOM_DEVELOPMENT.value,
                "name": "Custom Development",
                "description": "Custom software development"
            }
        ]
        return service_types
    except Exception as e:
        logger.error(f"Failed to get service types: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get service types: {str(e)}"
        )


@router.get("/consultant-specialties", response_model=list[dict[str, str]])
async def get_consultant_specialties(
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """Get available consultant specialties."""
    try:
        specialties = [
            {
                "id": ConsultantSpecialty.WORKFLOW_ARCHITECTURE.value,
                "name": "Workflow Architecture",
                "description": "Workflow design and architecture expertise"
            },
            {
                "id": ConsultantSpecialty.SECURITY.value,
                "name": "Security",
                "description": "Cybersecurity and information security"
            },
            {
                "id": ConsultantSpecialty.COMPLIANCE.value,
                "name": "Compliance",
                "description": "Regulatory compliance and governance"
            },
            {
                "id": ConsultantSpecialty.INTEGRATION.value,
                "name": "Integration",
                "description": "System integration and API development"
            },
            {
                "id": ConsultantSpecialty.PERFORMANCE.value,
                "name": "Performance",
                "description": "Performance optimization and tuning"
            },
            {
                "id": ConsultantSpecialty.AI_ML.value,
                "name": "AI/ML",
                "description": "Artificial intelligence and machine learning"
            },
            {
                "id": ConsultantSpecialty.DEVOPS.value,
                "name": "DevOps",
                "description": "DevOps and infrastructure automation"
            },
            {
                "id": ConsultantSpecialty.DATA_ANALYTICS.value,
                "name": "Data Analytics",
                "description": "Data analysis and business intelligence"
            }
        ]
        return specialties
    except Exception as e:
        logger.error(f"Failed to get consultant specialties: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get consultant specialties: {str(e)}"
        )


# Helper Functions
async def _log_service_request_event(
    user_id: str,
    organization_id: UUID,
    service_request: ServiceRequest
):
    """Log service request event to audit logger."""
    try:
        from udp.security.audit_logger import (
            AuditEventSeverity,
            AuditEventStatus,
            AuditEventType,
            AuditLogger,
        )

        audit_logger = AuditLogger()
        audit_logger.log_event(
            event_type=AuditEventType.SERVICE_REQUEST,
            action="create_service_request",
            description=f"Created service request for {service_request.service_type.value}",
            user_id=user_id,
            organization_id=organization_id,
            details={
                "service_request_id": service_request.id,
                "service_type": service_request.service_type.value,
                "title": service_request.title,
                "budget_range": list(service_request.budget_range),
                "timeline_weeks": service_request.timeline_weeks,
                "priority": service_request.priority
            },
            severity=AuditEventSeverity.MEDIUM,
            status=AuditEventStatus.SUCCESS,
            tags=["professional_services", "service_request", service_request.service_type.value]
        )
    except Exception as e:
        logger.error(f"Failed to log service request event: {e}")


async def _log_project_creation_event(
    user_id: str,
    organization_id: UUID,
    project: Project
):
    """Log project creation event to audit logger."""
    try:
        from udp.security.audit_logger import (
            AuditEventSeverity,
            AuditEventStatus,
            AuditEventType,
            AuditLogger,
        )

        audit_logger = AuditLogger()
        audit_logger.log_event(
            event_type=AuditEventType.PROJECT_CREATION,
            action="create_project",
            description=f"Created project: {project.name}",
            user_id=user_id,
            organization_id=organization_id,
            details={
                "project_id": project.id,
                "project_name": project.name,
                "service_type": project.service_type.value,
                "complexity": project.complexity,
                "estimated_hours": project.estimated_hours,
                "timeline_weeks": project.timeline_weeks
            },
            severity=AuditEventSeverity.MEDIUM,
            status=AuditEventStatus.SUCCESS,
            tags=["professional_services", "project", project.service_type.value]
        )
    except Exception as e:
        logger.error(f"Failed to log project creation event: {e}")
