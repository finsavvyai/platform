"""
Code Generation API Endpoints
Natural Language to Infrastructure Code Generation
"""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel, Field
import logging

from app.services.code_generation import (
    CodeGenerationService,
    CodeGenerationRequest,
    GeneratedCode,
    CodeType,
    ComplexityLevel,
    code_generation_service
)
from app.core.auth import get_current_user
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()


# Pydantic models for API
class CodeGenerationRequestModel(BaseModel):
    """API model for code generation request"""
    description: str = Field(..., description="Natural language description of what to build")
    code_type: CodeType = Field(..., description="Type of code to generate")
    complexity: ComplexityLevel = Field(default=ComplexityLevel.SIMPLE, description="Complexity level")
    target_platform: Optional[str] = Field(None, description="Target platform (e.g., 'aws', 'gcp', 'azure')")
    requirements: Optional[List[str]] = Field(None, description="Specific requirements")
    constraints: Optional[List[str]] = Field(None, description="Constraints to consider")
    existing_code: Optional[str] = Field(None, description="Existing code to extend or modify")
    variables: Optional[dict] = Field(None, description="Variables to include in the code")

    class Config:
        json_encoders = {
            CodeType: lambda v: v.value,
            ComplexityLevel: lambda v: v.value
        }


class GeneratedCodeResponse(BaseModel):
    """API response model for generated code"""
    code: str
    language: str
    description: str
    instructions: List[str]
    dependencies: List[str]
    variables: dict
    validation_notes: List[str]
    security_considerations: List[str]
    estimated_cost: Optional[str] = None
    deployment_time: Optional[str] = None


class CodeImprovementRequest(BaseModel):
    """API model for code improvement request"""
    code: str = Field(..., description="Code to improve")
    code_type: CodeType = Field(..., description="Type of code")
    feedback: str = Field(..., description="Feedback for improvement")


class DocumentationRequest(BaseModel):
    """API model for documentation generation request"""
    code: str = Field(..., description="Code to document")
    code_type: CodeType = Field(..., description="Type of code")


class CodeTemplateResponse(BaseModel):
    """API response for code templates"""
    name: str
    description: str
    code_type: CodeType
    complexity: ComplexityLevel
    template: str
    variables: List[str]
    example_usage: str


@router.get("/health")
async def health_check():
    """Health check for code generation service"""
    return {
        "status": "healthy",
        "service": "code_generation",
        "supported_types": [t.value for t in CodeType],
        "complexity_levels": [c.value for c in ComplexityLevel]
    }


@router.get("/templates")
async def get_code_templates():
    """Get available code templates"""
    templates = [
        CodeTemplateResponse(
            name="AWS EC2 Instance",
            description="Create a simple EC2 instance with security group",
            code_type=CodeType.TERRAFORM,
            complexity=ComplexityLevel.SIMPLE,
            template="terraform_ec2_basic",
            variables=["instance_type", "ami_id", "key_name", "subnet_id"],
            example_usage="Create an EC2 instance in us-west-2 with t3.micro instance type"
        ),
        CodeTemplateResponse(
            name="Web Server Setup",
            description="Install and configure a web server",
            code_type=CodeType.ANSIBLE,
            complexity=ComplexityLevel.INTERMEDIATE,
            template="ansible_webserver",
            variables=["server_name", "document_root", "ssl_enabled"],
            example_usage="Set up Apache web server with SSL on Ubuntu servers"
        ),
        CodeTemplateResponse(
            name="Kubernetes Deployment",
            description="Deploy a containerized application",
            code_type=CodeType.KUBERNETES,
            complexity=ComplexityLevel.INTERMEDIATE,
            template="k8s_deployment",
            variables=["app_name", "image", "replicas", "port"],
            example_usage="Deploy a Node.js application with 3 replicas and load balancer"
        ),
        CodeTemplateResponse(
            name="Docker Multi-Stage Build",
            description="Create optimized Docker image with multi-stage build",
            code_type=CodeType.DOCKER,
            complexity=ComplexityLevel.ADVANCED,
            template="docker_multistage",
            variables=["base_image", "app_port", "build_deps"],
            example_usage="Create a production-ready Docker image for a Python application"
        ),
        CodeTemplateResponse(
            name="Automation Script",
            description="Create a robust automation script",
            code_type=CodeType.BASH,
            complexity=ComplexityLevel.SIMPLE,
            template="bash_automation",
            variables=["script_name", "log_file", "error_handling"],
            example_usage="Create a backup script with error handling and logging"
        )
    ]
    return templates


@router.post("/generate", response_model=GeneratedCodeResponse)
async def generate_code(
    request: CodeGenerationRequestModel,
    current_user: User = Depends(get_current_user)
):
    """Generate code from natural language description"""
    try:
        logger.info(f"User {current_user.email} requesting {request.code_type.value} code generation")

        # Convert API model to service model
        service_request = CodeGenerationRequest(
            description=request.description,
            code_type=request.code_type,
            complexity=request.complexity,
            target_platform=request.target_platform,
            requirements=request.requirements,
            constraints=request.constraints,
            existing_code=request.existing_code,
            variables=request.variables
        )

        # Generate code
        result = await code_generation_service.generate_code(service_request)

        return GeneratedCodeResponse(
            code=result.code,
            language=result.language,
            description=result.description,
            instructions=result.instructions,
            dependencies=result.dependencies,
            variables=result.variables,
            validation_notes=result.validation_notes,
            security_considerations=result.security_considerations,
            estimated_cost=result.estimated_cost,
            deployment_time=result.deployment_time
        )

    except Exception as e:
        logger.error(f"Code generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Code generation failed: {str(e)}")


@router.post("/improve", response_model=GeneratedCodeResponse)
async def improve_code(
    request: CodeImprovementRequest,
    current_user: User = Depends(get_current_user)
):
    """Improve existing code based on feedback"""
    try:
        logger.info(f"User {current_user.email} requesting code improvement")

        result = await code_generation_service.review_and_improve_code(
            code=request.code,
            code_type=request.code_type,
            feedback=request.feedback
        )

        return GeneratedCodeResponse(
            code=result.code,
            language=result.language,
            description=result.description,
            instructions=result.instructions,
            dependencies=result.dependencies,
            variables=result.variables,
            validation_notes=result.validation_notes,
            security_considerations=result.security_considerations,
            estimated_cost=result.estimated_cost,
            deployment_time=result.deployment_time
        )

    except Exception as e:
        logger.error(f"Code improvement failed: {e}")
        raise HTTPException(status_code=500, detail=f"Code improvement failed: {str(e)}")


@router.post("/documentation")
async def generate_documentation(
    request: DocumentationRequest,
    current_user: User = Depends(get_current_user)
):
    """Generate documentation for code"""
    try:
        logger.info(f"User {current_user.email} requesting documentation generation")

        documentation = await code_generation_service.generate_documentation(
            code=request.code,
            code_type=request.code_type
        )

        return {
            "documentation": documentation,
            "format": "markdown",
            "generated_at": "2024-01-01T00:00:00Z"
        }

    except Exception as e:
        logger.error(f"Documentation generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Documentation generation failed: {str(e)}")


@router.get("/examples")
async def get_code_examples():
    """Get example prompts and generated code"""
    examples = [
        {
            "prompt": "Create a highly available web application infrastructure on AWS with auto-scaling",
            "code_type": "terraform",
            "complexity": "advanced",
            "description": "This will create a VPC, subnets, load balancer, auto-scaling group, and RDS database"
        },
        {
            "prompt": "Set up a CI/CD pipeline using GitHub Actions that deploys to Kubernetes",
            "code_type": "yaml",
            "complexity": "intermediate",
            "description": "Creates a GitHub Actions workflow with build, test, and deploy stages"
        },
        {
            "prompt": "Create a monitoring and alerting setup for a microservices architecture",
            "code_type": "kubernetes",
            "complexity": "advanced",
            "description": "Deploys Prometheus, Grafana, and AlertManager with service monitoring"
        },
        {
            "prompt": "Build a data pipeline that processes CSV files and loads them into PostgreSQL",
            "code_type": "python",
            "complexity": "intermediate",
            "description": "Creates a Python script with pandas for data processing and SQLAlchemy for database operations"
        },
        {
            "prompt": "Set up a secure file server with user authentication and SSL",
            "code_type": "ansible",
            "complexity": "intermediate",
            "description": "Configures nginx with SSL certificates and basic authentication"
        }
    ]
    return examples


@router.get("/supported-platforms")
async def get_supported_platforms():
    """Get list of supported platforms for each code type"""
    platforms = {
        "terraform": ["aws", "gcp", "azure", "digitalocean", "vmware", "kubernetes"],
        "ansible": ["ubuntu", "centos", "redhat", "debian", "windows", "macos"],
        "kubernetes": ["eks", "gke", "aks", "minikube", "kind", "openshift"],
        "docker": ["linux", "windows", "alpine", "ubuntu", "debian", "scratch"],
        "python": ["django", "flask", "fastapi", "pandas", "tensorflow", "pytorch"],
        "bash": ["ubuntu", "centos", "macos", "alpine", "debian", "busybox"]
    }
    return platforms


@router.post("/validate")
async def validate_code(
    code: str,
    code_type: CodeType,
    current_user: User = Depends(get_current_user)
):
    """Validate generated or existing code"""
    try:
        logger.info(f"User {current_user.email} requesting code validation")

        validation_notes = await code_generation_service._validate_code(code, code_type)
        security_notes = await code_generation_service._analyze_security(code, code_type)

        return {
            "valid": len(validation_notes) == 0 and len(security_notes) == 0,
            "validation_notes": validation_notes,
            "security_considerations": security_notes,
            "suggestions": [
                "Review the code before deployment",
                "Test in a non-production environment first",
                "Follow your organization's security policies"
            ]
        }

    except Exception as e:
        logger.error(f"Code validation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Code validation failed: {str(e)}")


@router.get("/usage-stats")
async def get_usage_stats(current_user: User = Depends(get_current_user)):
    """Get code generation usage statistics for the current user"""
    # In a real implementation, this would query the database
    # For now, return mock data
    return {
        "total_generations": 42,
        "this_month": 15,
        "favorite_type": "terraform",
        "complexity_breakdown": {
            "simple": 20,
            "intermediate": 15,
            "advanced": 5,
            "enterprise": 2
        },
        "success_rate": 0.95,
        "average_generation_time": "3.2 seconds"
    }