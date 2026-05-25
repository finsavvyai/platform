"""
Infrastructure Deployment API Endpoints
Automated deployment of generated infrastructure code
"""

from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel, Field
import logging

from app.services.infrastructure_deployment import (
    InfrastructureDeploymentService,
    DeploymentRequest,
    DeploymentResult,
    DeploymentPlatform,
    DeploymentStatus,
    DeploymentStrategy,
    infrastructure_deployment_service
)
from app.services.code_generation import CodeType
from app.core.auth import get_current_user
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()


# Pydantic models for API
class DeploymentRequestModel(BaseModel):
    """API model for deployment request"""
    name: str = Field(..., description="Deployment name")
    code: str = Field(..., description="Infrastructure code to deploy")
    code_type: CodeType = Field(..., description="Type of code (terraform, ansible, etc.)")
    platform: DeploymentPlatform = Field(..., description="Target deployment platform")
    strategy: DeploymentStrategy = Field(default=DeploymentStrategy.VALIDATE_FIRST, description="Deployment strategy")
    environment: str = Field(default="development", description="Target environment")
    region: Optional[str] = Field(None, description="Target region/zone")
    variables: Optional[dict] = Field(None, description="Deployment variables")
    tags: Optional[dict] = Field(None, description="Resource tags")
    dry_run: bool = Field(default=True, description="Perform dry run only")
    auto_approve: bool = Field(default=False, description="Auto-approve deployment")
    timeout_minutes: int = Field(default=30, description="Deployment timeout in minutes")

    class Config:
        json_encoders = {
            CodeType: lambda v: v.value,
            DeploymentPlatform: lambda v: v.value,
            DeploymentStrategy: lambda v: v.value
        }


class DeploymentResponseModel(BaseModel):
    """API response model for deployment result"""
    deployment_id: UUID
    status: DeploymentStatus
    platform: DeploymentPlatform
    environment: str
    resources_created: List[dict]
    outputs: dict
    logs: List[str]
    errors: List[str]
    metrics: dict
    cost_estimate: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    duration_seconds: Optional[int] = None


class DeployFromGeneratedCodeRequest(BaseModel):
    """API model for deploying from generated code"""
    description: str = Field(..., description="What to build and deploy")
    code_type: CodeType = Field(..., description="Type of code to generate and deploy")
    platform: DeploymentPlatform = Field(..., description="Target deployment platform")
    environment: str = Field(default="development", description="Target environment")
    region: Optional[str] = Field(None, description="Target region/zone")
    complexity: str = Field(default="simple", description="Code complexity level")
    requirements: Optional[List[str]] = Field(None, description="Specific requirements")
    constraints: Optional[List[str]] = Field(None, description="Deployment constraints")
    variables: Optional[dict] = Field(None, description="Variables to include")
    strategy: DeploymentStrategy = Field(default=DeploymentStrategy.VALIDATE_FIRST)
    dry_run: bool = Field(default=True, description="Perform dry run only")
    auto_approve: bool = Field(default=False, description="Auto-approve deployment")


@router.get("/health")
async def health_check():
    """Health check for infrastructure deployment service"""
    return await infrastructure_deployment_service.health_check()


@router.get("/platforms")
async def get_supported_platforms():
    """Get list of supported deployment platforms"""
    return {
        "platforms": [
            {
                "name": platform.value,
                "display_name": platform.value.upper(),
                "supported_code_types": ["terraform", "kubernetes", "docker", "ansible"],
                "regions": _get_platform_regions(platform)
            }
            for platform in DeploymentPlatform
        ]
    }


@router.get("/strategies")
async def get_deployment_strategies():
    """Get list of available deployment strategies"""
    return {
        "strategies": [
            {
                "name": strategy.value,
                "display_name": strategy.value.replace("_", " ").title(),
                "description": _get_strategy_description(strategy)
            }
            for strategy in DeploymentStrategy
        ]
    }


@router.post("/deploy", response_model=DeploymentResponseModel)
async def deploy_infrastructure(
    request: DeploymentRequestModel,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """Deploy infrastructure code to target platform"""
    try:
        logger.info(f"User {current_user.email} requesting deployment: {request.name}")

        # Convert API model to service model
        deployment_request = DeploymentRequest(
            name=request.name,
            code=request.code,
            code_type=request.code_type,
            platform=request.platform,
            strategy=request.strategy,
            environment=request.environment,
            region=request.region,
            credentials={},  # Would be handled securely in production
            variables=request.variables or {},
            tags=request.tags or {},
            dry_run=request.dry_run,
            auto_approve=request.auto_approve,
            timeout_minutes=request.timeout_minutes
        )

        # Deploy infrastructure
        result = await infrastructure_deployment_service.deploy_infrastructure(deployment_request)

        return DeploymentResponseModel(
            deployment_id=result.deployment_id,
            status=result.status,
            platform=result.platform,
            environment=result.environment,
            resources_created=result.resources_created,
            outputs=result.outputs,
            logs=result.logs,
            errors=result.errors,
            metrics=result.metrics,
            cost_estimate=result.cost_estimate,
            started_at=result.started_at.isoformat() if result.started_at else None,
            completed_at=result.completed_at.isoformat() if result.completed_at else None,
            duration_seconds=result.duration_seconds
        )

    except Exception as e:
        logger.error(f"Infrastructure deployment failed: {e}")
        raise HTTPException(status_code=500, detail=f"Deployment failed: {str(e)}")


@router.post("/generate-and-deploy", response_model=DeploymentResponseModel)
async def generate_and_deploy(
    request: DeployFromGeneratedCodeRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """Generate infrastructure code and deploy it in one operation"""
    try:
        logger.info(f"User {current_user.email} requesting generate-and-deploy: {request.description}")

        # Import code generation service
        from app.services.code_generation import (
            code_generation_service,
            CodeGenerationRequest,
            ComplexityLevel
        )

        # Step 1: Generate code
        code_gen_request = CodeGenerationRequest(
            description=request.description,
            code_type=request.code_type,
            complexity=ComplexityLevel(request.complexity),
            target_platform=request.platform.value,
            requirements=request.requirements or [],
            constraints=request.constraints or [],
            variables=request.variables or {}
        )

        generated_code_result = await code_generation_service.generate_code(code_gen_request)

        # Step 2: Deploy generated code
        deployment_request = DeploymentRequest(
            name=f"Generated: {request.description}",
            code=generated_code_result.code,
            code_type=request.code_type,
            platform=request.platform,
            strategy=request.strategy,
            environment=request.environment,
            region=request.region,
            credentials={},
            variables=request.variables or {},
            tags={"generated": "true", "source": "upm-plus"},
            dry_run=request.dry_run,
            auto_approve=request.auto_approve,
            timeout_minutes=30
        )

        result = await infrastructure_deployment_service.deploy_infrastructure(deployment_request)

        # Add generation info to logs
        result.logs.insert(0, f"Code generated successfully: {generated_code_result.description}")
        result.logs.insert(1, f"Generated code instructions: {', '.join(generated_code_result.instructions)}")

        return DeploymentResponseModel(
            deployment_id=result.deployment_id,
            status=result.status,
            platform=result.platform,
            environment=result.environment,
            resources_created=result.resources_created,
            outputs=result.outputs,
            logs=result.logs,
            errors=result.errors,
            metrics=result.metrics,
            cost_estimate=result.cost_estimate,
            started_at=result.started_at.isoformat() if result.started_at else None,
            completed_at=result.completed_at.isoformat() if result.completed_at else None,
            duration_seconds=result.duration_seconds
        )

    except Exception as e:
        logger.error(f"Generate-and-deploy failed: {e}")
        raise HTTPException(status_code=500, detail=f"Generate-and-deploy failed: {str(e)}")


@router.get("/deployments/{deployment_id}", response_model=DeploymentResponseModel)
async def get_deployment_status(
    deployment_id: UUID,
    current_user: User = Depends(get_current_user)
):
    """Get status of a specific deployment"""
    try:
        result = await infrastructure_deployment_service.get_deployment_status(deployment_id)

        if not result:
            raise HTTPException(status_code=404, detail="Deployment not found")

        return DeploymentResponseModel(
            deployment_id=result.deployment_id,
            status=result.status,
            platform=result.platform,
            environment=result.environment,
            resources_created=result.resources_created,
            outputs=result.outputs,
            logs=result.logs,
            errors=result.errors,
            metrics=result.metrics,
            cost_estimate=result.cost_estimate,
            started_at=result.started_at.isoformat() if result.started_at else None,
            completed_at=result.completed_at.isoformat() if result.completed_at else None,
            duration_seconds=result.duration_seconds
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get deployment status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get deployment status: {str(e)}")


@router.get("/deployments", response_model=List[DeploymentResponseModel])
async def list_deployments(
    environment: Optional[str] = None,
    platform: Optional[DeploymentPlatform] = None,
    current_user: User = Depends(get_current_user)
):
    """List deployments with optional filtering"""
    try:
        deployments = await infrastructure_deployment_service.list_deployments(
            environment=environment,
            platform=platform
        )

        return [
            DeploymentResponseModel(
                deployment_id=d.deployment_id,
                status=d.status,
                platform=d.platform,
                environment=d.environment,
                resources_created=d.resources_created,
                outputs=d.outputs,
                logs=d.logs,
                errors=d.errors,
                metrics=d.metrics,
                cost_estimate=d.cost_estimate,
                started_at=d.started_at.isoformat() if d.started_at else None,
                completed_at=d.completed_at.isoformat() if d.completed_at else None,
                duration_seconds=d.duration_seconds
            )
            for d in deployments
        ]

    except Exception as e:
        logger.error(f"Failed to list deployments: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list deployments: {str(e)}")


@router.delete("/deployments/{deployment_id}")
async def destroy_infrastructure(
    deployment_id: UUID,
    force: bool = False,
    current_user: User = Depends(get_current_user)
):
    """Destroy deployed infrastructure"""
    try:
        logger.info(f"User {current_user.email} requesting infrastructure destruction: {deployment_id}")

        result = await infrastructure_deployment_service.destroy_infrastructure(
            deployment_id=deployment_id,
            force=force
        )

        return {
            "deployment_id": deployment_id,
            "status": result.status.value,
            "message": "Infrastructure destruction initiated",
            "logs": result.logs[-5:]  # Last 5 log entries
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Infrastructure destruction failed: {e}")
        raise HTTPException(status_code=500, detail=f"Destruction failed: {str(e)}")


@router.get("/examples")
async def get_deployment_examples():
    """Get example deployment configurations"""
    return {
        "examples": [
            {
                "name": "AWS Web Application",
                "description": "Deploy a scalable web application on AWS with load balancer",
                "code_type": "terraform",
                "platform": "aws",
                "complexity": "intermediate",
                "estimated_time": "15-20 minutes",
                "estimated_cost": "$50-100/month"
            },
            {
                "name": "Kubernetes Microservice",
                "description": "Deploy a microservice with auto-scaling on Kubernetes",
                "code_type": "kubernetes",
                "platform": "kubernetes",
                "complexity": "intermediate",
                "estimated_time": "5-10 minutes",
                "estimated_cost": "Varies by cluster"
            },
            {
                "name": "Database Server Setup",
                "description": "Configure and secure a database server with Ansible",
                "code_type": "ansible",
                "platform": "local",
                "complexity": "simple",
                "estimated_time": "10-15 minutes",
                "estimated_cost": "Server costs only"
            },
            {
                "name": "Container Application",
                "description": "Build and deploy a containerized application",
                "code_type": "docker",
                "platform": "docker",
                "complexity": "simple",
                "estimated_time": "5-10 minutes",
                "estimated_cost": "Minimal"
            }
        ]
    }


@router.get("/deployment-guide")
async def get_deployment_guide():
    """Get deployment best practices and guide"""
    return {
        "guide": {
            "getting_started": [
                "Start with dry_run=true to validate your deployment",
                "Use development environment for testing",
                "Review generated code before deploying",
                "Set appropriate timeout values"
            ],
            "best_practices": [
                "Always use version control for infrastructure code",
                "Tag resources consistently for cost tracking",
                "Implement proper backup strategies",
                "Monitor resource usage and costs",
                "Use least privilege access principles"
            ],
            "security": [
                "Never hardcode credentials in code",
                "Use environment-specific configurations",
                "Enable audit logging",
                "Regularly update dependencies",
                "Implement network security controls"
            ],
            "troubleshooting": [
                "Check deployment logs for errors",
                "Verify platform credentials and permissions",
                "Ensure resource quotas and limits",
                "Review network connectivity",
                "Monitor resource health after deployment"
            ]
        }
    }


def _get_platform_regions(platform: DeploymentPlatform) -> List[str]:
    """Get available regions for a platform"""
    region_map = {
        DeploymentPlatform.AWS: ["us-east-1", "us-west-2", "eu-west-1", "ap-southeast-1"],
        DeploymentPlatform.GCP: ["us-central1", "us-west1", "europe-west1", "asia-southeast1"],
        DeploymentPlatform.AZURE: ["eastus", "westus2", "westeurope", "southeastasia"],
        DeploymentPlatform.KUBERNETES: ["default"],
        DeploymentPlatform.LOCAL: ["local"],
        DeploymentPlatform.DOCKER: ["local"]
    }
    return region_map.get(platform, ["default"])


def _get_strategy_description(strategy: DeploymentStrategy) -> str:
    """Get description for deployment strategy"""
    descriptions = {
        DeploymentStrategy.IMMEDIATE: "Deploy immediately without validation",
        DeploymentStrategy.VALIDATE_FIRST: "Validate configuration before deploying",
        DeploymentStrategy.STAGED: "Deploy in stages with checkpoints",
        DeploymentStrategy.BLUE_GREEN: "Blue-green deployment with traffic switching",
        DeploymentStrategy.ROLLING: "Rolling deployment with gradual updates"
    }
    return descriptions.get(strategy, "Standard deployment strategy")