"""
Professional Services Platform.

Provides comprehensive professional services for custom workflow development,
consulting, training, and enterprise support.
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Optional
from uuid import uuid4

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class ServiceType(str, Enum):
    """Types of professional services."""
    WORKFLOW_DEVELOPMENT = "workflow_development"
    CONSULTING = "consulting"
    TRAINING = "training"
    SUPPORT = "support"
    INTEGRATION = "integration"
    MIGRATION = "migration"
    OPTIMIZATION = "optimization"
    SECURITY_AUDIT = "security_audit"
    COMPLIANCE_REVIEW = "compliance_review"
    CUSTOM_DEVELOPMENT = "custom_development"


class ServiceStatus(str, Enum):
    """Service request status."""
    DRAFT = "draft"
    SUBMITTED = "submitted"
    QUOTED = "quoted"
    APPROVED = "approved"
    IN_PROGRESS = "in_progress"
    REVIEW = "review"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    ON_HOLD = "on_hold"


class ServiceTier(str, Enum):
    """Service tier levels."""
    BASIC = "basic"
    STANDARD = "standard"
    PREMIUM = "premium"
    ENTERPRISE = "enterprise"


class ConsultantSpecialty(str, Enum):
    """Consultant specialties."""
    WORKFLOW_ARCHITECTURE = "workflow_architecture"
    SECURITY = "security"
    COMPLIANCE = "compliance"
    INTEGRATION = "integration"
    PERFORMANCE = "performance"
    AI_ML = "ai_ml"
    DEVOPS = "devops"
    DATA_ANALYTICS = "data_analytics"


@dataclass
class Consultant:
    """Consultant information."""
    id: str
    name: str
    email: str
    specialties: list[ConsultantSpecialty]
    experience_years: int
    certifications: list[str]
    hourly_rate: float
    availability: dict[str, Any]
    rating: float
    completed_projects: int


@dataclass
class Project:
    """Project information."""
    id: str
    name: str
    description: str
    service_type: ServiceType
    complexity: str
    estimated_hours: int
    timeline_weeks: int
    budget_range: tuple[float, float]
    requirements: list[str]
    deliverables: list[str]


@dataclass
class ServiceQuote:
    """Service quote information."""
    id: str
    project_id: str
    consultant_id: str
    total_cost: float
    hourly_rate: float
    estimated_hours: int
    timeline_weeks: int
    breakdown: dict[str, Any]
    terms_conditions: str
    valid_until: datetime


@dataclass
class ServiceDelivery:
    """Service delivery tracking."""
    id: str
    project_id: str
    consultant_id: str
    status: ServiceStatus
    progress_percentage: float
    milestones: list[dict[str, Any]]
    deliverables: list[dict[str, Any]]
    hours_logged: float
    last_updated: datetime


class ServiceRequest(BaseModel):
    """Service request model."""
    id: str = Field(default_factory=lambda: str(uuid4()))
    organization_id: str
    requester_id: str
    service_type: ServiceType
    title: str
    description: str
    requirements: list[str] = Field(default_factory=list)
    budget_range: tuple[float, float] = Field(default=(1000.0, 10000.0))
    timeline_weeks: int = Field(default=4)
    priority: str = Field(default="medium")
    status: ServiceStatus = Field(default=ServiceStatus.DRAFT)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    metadata: dict[str, Any] = Field(default_factory=dict)


class ProfessionalServicesManager:
    """Professional services management system."""

    def __init__(self):
        self.service_requests: dict[str, ServiceRequest] = {}
        self.consultants: dict[str, Consultant] = {}
        self.projects: dict[str, Project] = {}
        self.quotes: dict[str, ServiceQuote] = {}
        self.deliveries: dict[str, ServiceDelivery] = {}
        self._initialize_mock_data()

    def _initialize_mock_data(self):
        """Initialize with mock consultant data."""
        mock_consultants = [
            Consultant(
                id="consultant-1",
                name="Sarah Johnson",
                email="sarah.johnson@udp.com",
                specialties=[ConsultantSpecialty.WORKFLOW_ARCHITECTURE, ConsultantSpecialty.INTEGRATION],
                experience_years=8,
                certifications=["AWS Solutions Architect", "Kubernetes Administrator"],
                hourly_rate=150.0,
                availability={"timezone": "EST", "hours_per_week": 40},
                rating=4.9,
                completed_projects=45
            ),
            Consultant(
                id="consultant-2",
                name="Michael Chen",
                email="michael.chen@udp.com",
                specialties=[ConsultantSpecialty.SECURITY, ConsultantSpecialty.COMPLIANCE],
                experience_years=12,
                certifications=["CISSP", "CISM", "SOC2 Auditor"],
                hourly_rate=200.0,
                availability={"timezone": "PST", "hours_per_week": 35},
                rating=4.8,
                completed_projects=67
            ),
            Consultant(
                id="consultant-3",
                name="Emily Rodriguez",
                email="emily.rodriguez@udp.com",
                specialties=[ConsultantSpecialty.AI_ML, ConsultantSpecialty.DATA_ANALYTICS],
                experience_years=6,
                certifications=["Google Cloud ML Engineer", "TensorFlow Developer"],
                hourly_rate=175.0,
                availability={"timezone": "CST", "hours_per_week": 40},
                rating=4.7,
                completed_projects=32
            ),
            Consultant(
                id="consultant-4",
                name="David Kim",
                email="david.kim@udp.com",
                specialties=[ConsultantSpecialty.DEVOPS, ConsultantSpecialty.PERFORMANCE],
                experience_years=10,
                certifications=["AWS DevOps Engineer", "Docker Certified"],
                hourly_rate=160.0,
                availability={"timezone": "EST", "hours_per_week": 40},
                rating=4.9,
                completed_projects=58
            )
        ]

        for consultant in mock_consultants:
            self.consultants[consultant.id] = consultant

    def create_service_request(
        self,
        organization_id: str,
        requester_id: str,
        service_type: ServiceType,
        title: str,
        description: str,
        requirements: list[str] = None,
        budget_range: tuple[float, float] = None,
        timeline_weeks: int = 4,
        priority: str = "medium"
    ) -> ServiceRequest:
        """Create a new service request."""
        try:
            logger.info(f"Creating service request for {service_type.value} by organization {organization_id}")

            service_request = ServiceRequest(
                organization_id=organization_id,
                requester_id=requester_id,
                service_type=service_type,
                title=title,
                description=description,
                requirements=requirements or [],
                budget_range=budget_range or (1000.0, 10000.0),
                timeline_weeks=timeline_weeks,
                priority=priority
            )

            self.service_requests[service_request.id] = service_request

            logger.info(f"Service request created with ID: {service_request.id}")
            return service_request

        except Exception as e:
            logger.error(f"Failed to create service request: {e}", exc_info=True)
            raise

    def get_service_requests(
        self,
        organization_id: str,
        status: Optional[ServiceStatus] = None,
        service_type: Optional[ServiceType] = None
    ) -> list[ServiceRequest]:
        """Get service requests for an organization."""
        try:
            requests = [
                req for req in self.service_requests.values()
                if req.organization_id == organization_id
            ]

            if status:
                requests = [req for req in requests if req.status == status]

            if service_type:
                requests = [req for req in requests if req.service_type == service_type]

            return sorted(requests, key=lambda x: x.created_at, reverse=True)

        except Exception as e:
            logger.error(f"Failed to get service requests: {e}", exc_info=True)
            raise

    def get_consultants(
        self,
        specialties: Optional[list[ConsultantSpecialty]] = None,
        min_rating: float = 0.0,
        max_hourly_rate: Optional[float] = None
    ) -> list[Consultant]:
        """Get available consultants with filters."""
        try:
            consultants = list(self.consultants.values())

            if specialties:
                consultants = [
                    c for c in consultants
                    if any(specialty in c.specialties for specialty in specialties)
                ]

            if min_rating > 0:
                consultants = [c for c in consultants if c.rating >= min_rating]

            if max_hourly_rate:
                consultants = [c for c in consultants if c.hourly_rate <= max_hourly_rate]

            return sorted(consultants, key=lambda x: x.rating, reverse=True)

        except Exception as e:
            logger.error(f"Failed to get consultants: {e}", exc_info=True)
            raise

    def create_project(
        self,
        service_request_id: str,
        consultant_id: str,
        name: str,
        description: str,
        complexity: str = "medium",
        estimated_hours: int = 40,
        timeline_weeks: int = 4,
        budget_range: tuple[float, float] = None,
        requirements: list[str] = None,
        deliverables: list[str] = None
    ) -> Project:
        """Create a project from a service request."""
        try:
            logger.info(f"Creating project for service request {service_request_id}")

            if service_request_id not in self.service_requests:
                raise ValueError(f"Service request {service_request_id} not found")

            if consultant_id not in self.consultants:
                raise ValueError(f"Consultant {consultant_id} not found")

            service_request = self.service_requests[service_request_id]

            project = Project(
                id=str(uuid4()),
                name=name,
                description=description,
                service_type=service_request.service_type,
                complexity=complexity,
                estimated_hours=estimated_hours,
                timeline_weeks=timeline_weeks,
                budget_range=budget_range or service_request.budget_range,
                requirements=requirements or service_request.requirements,
                deliverables=deliveries or []
            )

            self.projects[project.id] = project

            # Update service request status
            service_request.status = ServiceStatus.IN_PROGRESS
            service_request.updated_at = datetime.utcnow()

            logger.info(f"Project created with ID: {project.id}")
            return project

        except Exception as e:
            logger.error(f"Failed to create project: {e}", exc_info=True)
            raise

    def generate_quote(
        self,
        project_id: str,
        consultant_id: str,
        estimated_hours: int,
        timeline_weeks: int,
        terms_conditions: str = None
    ) -> ServiceQuote:
        """Generate a service quote."""
        try:
            logger.info(f"Generating quote for project {project_id}")

            if project_id not in self.projects:
                raise ValueError(f"Project {project_id} not found")

            if consultant_id not in self.consultants:
                raise ValueError(f"Consultant {consultant_id} not found")

            project = self.projects[project_id]
            consultant = self.consultants[consultant_id]

            # Calculate costs
            hourly_rate = consultant.hourly_rate
            total_cost = hourly_rate * estimated_hours

            # Add complexity multiplier
            complexity_multipliers = {
                "low": 1.0,
                "medium": 1.2,
                "high": 1.5,
                "enterprise": 2.0
            }
            multiplier = complexity_multipliers.get(project.complexity, 1.2)
            total_cost *= multiplier

            # Create breakdown
            breakdown = {
                "base_hours": estimated_hours,
                "hourly_rate": hourly_rate,
                "base_cost": hourly_rate * estimated_hours,
                "complexity_multiplier": multiplier,
                "complexity_cost": (hourly_rate * estimated_hours) * (multiplier - 1),
                "total_cost": total_cost,
                "timeline_weeks": timeline_weeks
            }

            quote = ServiceQuote(
                id=str(uuid4()),
                project_id=project_id,
                consultant_id=consultant_id,
                total_cost=total_cost,
                hourly_rate=hourly_rate,
                estimated_hours=estimated_hours,
                timeline_weeks=timeline_weeks,
                breakdown=breakdown,
                terms_conditions=terms_conditions or "Standard terms and conditions apply.",
                valid_until=datetime.utcnow() + timedelta(days=30)
            )

            self.quotes[quote.id] = quote

            logger.info(f"Quote generated with ID: {quote.id}, total cost: ${total_cost:.2f}")
            return quote

        except Exception as e:
            logger.error(f"Failed to generate quote: {e}", exc_info=True)
            raise

    def start_service_delivery(
        self,
        project_id: str,
        consultant_id: str,
        milestones: list[dict[str, Any]] = None
    ) -> ServiceDelivery:
        """Start service delivery for a project."""
        try:
            logger.info(f"Starting service delivery for project {project_id}")

            if project_id not in self.projects:
                raise ValueError(f"Project {project_id} not found")

            if consultant_id not in self.consultants:
                raise ValueError(f"Consultant {consultant_id} not found")

            delivery = ServiceDelivery(
                id=str(uuid4()),
                project_id=project_id,
                consultant_id=consultant_id,
                status=ServiceStatus.IN_PROGRESS,
                progress_percentage=0.0,
                milestones=milestones or [],
                deliverables=[],
                hours_logged=0.0,
                last_updated=datetime.utcnow()
            )

            self.deliveries[delivery.id] = delivery

            logger.info(f"Service delivery started with ID: {delivery.id}")
            return delivery

        except Exception as e:
            logger.error(f"Failed to start service delivery: {e}", exc_info=True)
            raise

    def update_delivery_progress(
        self,
        delivery_id: str,
        progress_percentage: float,
        hours_logged: float,
        milestone_updates: list[dict[str, Any]] = None,
        deliverable_updates: list[dict[str, Any]] = None
    ) -> ServiceDelivery:
        """Update service delivery progress."""
        try:
            if delivery_id not in self.deliveries:
                raise ValueError(f"Service delivery {delivery_id} not found")

            delivery = self.deliveries[delivery_id]

            # Update progress
            delivery.progress_percentage = min(100.0, max(0.0, progress_percentage))
            delivery.hours_logged += hours_logged
            delivery.last_updated = datetime.utcnow()

            # Update milestones
            if milestone_updates:
                delivery.milestones.extend(milestone_updates)

            # Update deliverables
            if deliverable_updates:
                delivery.deliverables.extend(deliverable_updates)

            # Update status based on progress
            if delivery.progress_percentage >= 100.0:
                delivery.status = ServiceStatus.COMPLETED
            elif delivery.progress_percentage > 0:
                delivery.status = ServiceStatus.IN_PROGRESS

            logger.info(f"Updated delivery {delivery_id} progress to {delivery.progress_percentage}%")
            return delivery

        except Exception as e:
            logger.error(f"Failed to update delivery progress: {e}", exc_info=True)
            raise

    def get_service_analytics(
        self,
        organization_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> dict[str, Any]:
        """Get service analytics for an organization."""
        try:
            # Filter requests by organization and date range
            requests = [
                req for req in self.service_requests.values()
                if req.organization_id == organization_id
            ]

            if start_date:
                requests = [req for req in requests if req.created_at >= start_date]

            if end_date:
                requests = [req for req in requests if req.created_at <= end_date]

            # Calculate analytics
            total_requests = len(requests)
            completed_requests = len([req for req in requests if req.status == ServiceStatus.COMPLETED])
            in_progress_requests = len([req for req in requests if req.status == ServiceStatus.IN_PROGRESS])

            # Service type distribution
            service_type_counts = {}
            for req in requests:
                service_type_counts[req.service_type.value] = service_type_counts.get(req.service_type.value, 0) + 1

            # Average timeline
            avg_timeline = sum(req.timeline_weeks for req in requests) / len(requests) if requests else 0

            # Budget analysis
            total_budget_min = sum(req.budget_range[0] for req in requests)
            total_budget_max = sum(req.budget_range[1] for req in requests)

            return {
                "total_requests": total_requests,
                "completed_requests": completed_requests,
                "in_progress_requests": in_progress_requests,
                "completion_rate": (completed_requests / total_requests * 100) if total_requests > 0 else 0,
                "service_type_distribution": service_type_counts,
                "average_timeline_weeks": avg_timeline,
                "total_budget_range": [total_budget_min, total_budget_max],
                "period": {
                    "start_date": start_date.isoformat() if start_date else None,
                    "end_date": end_date.isoformat() if end_date else None
                }
            }

        except Exception as e:
            logger.error(f"Failed to get service analytics: {e}", exc_info=True)
            raise

    def get_consultant_performance(
        self,
        consultant_id: str
    ) -> dict[str, Any]:
        """Get consultant performance metrics."""
        try:
            if consultant_id not in self.consultants:
                raise ValueError(f"Consultant {consultant_id} not found")

            consultant = self.consultants[consultant_id]

            # Get deliveries for this consultant
            consultant_deliveries = [
                delivery for delivery in self.deliveries.values()
                if delivery.consultant_id == consultant_id
            ]

            # Calculate metrics
            total_projects = len(consultant_deliveries)
            completed_projects = len([d for d in consultant_deliveries if d.status == ServiceStatus.COMPLETED])
            total_hours = sum(d.hours_logged for d in consultant_deliveries)
            avg_progress = sum(d.progress_percentage for d in consultant_deliveries) / len(consultant_deliveries) if consultant_deliveries else 0

            return {
                "consultant_id": consultant_id,
                "name": consultant.name,
                "rating": consultant.rating,
                "total_projects": total_projects,
                "completed_projects": completed_projects,
                "completion_rate": (completed_projects / total_projects * 100) if total_projects > 0 else 0,
                "total_hours_logged": total_hours,
                "average_progress": avg_progress,
                "hourly_rate": consultant.hourly_rate,
                "specialties": [s.value for s in consultant.specialties],
                "experience_years": consultant.experience_years
            }

        except Exception as e:
            logger.error(f"Failed to get consultant performance: {e}", exc_info=True)
            raise

    def get_service_statistics(self) -> dict[str, Any]:
        """Get overall service statistics."""
        try:
            total_requests = len(self.service_requests)
            total_projects = len(self.projects)
            total_consultants = len(self.consultants)
            total_quotes = len(self.quotes)
            total_deliveries = len(self.deliveries)

            # Status distribution
            status_counts = {}
            for req in self.service_requests.values():
                status_counts[req.status.value] = status_counts.get(req.status.value, 0) + 1

            # Service type distribution
            service_type_counts = {}
            for req in self.service_requests.values():
                service_type_counts[req.service_type.value] = service_type_counts.get(req.service_type.value, 0) + 1

            return {
                "total_service_requests": total_requests,
                "total_projects": total_projects,
                "total_consultants": total_consultants,
                "total_quotes": total_quotes,
                "total_deliveries": total_deliveries,
                "status_distribution": status_counts,
                "service_type_distribution": service_type_counts,
                "average_consultant_rating": sum(c.rating for c in self.consultants.values()) / len(self.consultants) if self.consultants else 0
            }

        except Exception as e:
            logger.error(f"Failed to get service statistics: {e}", exc_info=True)
            raise
