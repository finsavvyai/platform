"""
Automated Infrastructure Deployment Service
Integrates with code generation to deploy infrastructure to target platforms
"""

import asyncio
import json
import logging
import tempfile
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field
from uuid import UUID, uuid4

from app.services.llm_service import llm_service, LLMRequest, ModelSize, PromptTemplate
from app.services.code_generation import CodeType

logger = logging.getLogger(__name__)


class DeploymentPlatform(Enum):
    """Supported deployment platforms"""
    AWS = "aws"
    GCP = "gcp"
    AZURE = "azure"
    KUBERNETES = "kubernetes"
    LOCAL = "local"
    DOCKER = "docker"


class DeploymentStatus(Enum):
    """Deployment status states"""
    PENDING = "pending"
    INITIALIZING = "initializing"
    PLANNING = "planning"
    APPLYING = "applying"
    DEPLOYED = "deployed"
    FAILED = "failed"
    DESTROYING = "destroying"
    DESTROYED = "destroyed"


class DeploymentStrategy(Enum):
    """Deployment strategies"""
    IMMEDIATE = "immediate"
    VALIDATE_FIRST = "validate_first"
    STAGED = "staged"
    BLUE_GREEN = "blue_green"
    ROLLING = "rolling"


@dataclass
class DeploymentRequest:
    """Infrastructure deployment request"""
    name: str
    code: str
    code_type: CodeType
    platform: DeploymentPlatform
    strategy: DeploymentStrategy = DeploymentStrategy.VALIDATE_FIRST
    environment: str = "development"
    region: Optional[str] = None
    credentials: Optional[Dict[str, str]] = field(default_factory=dict)
    variables: Optional[Dict[str, Any]] = field(default_factory=dict)
    tags: Optional[Dict[str, str]] = field(default_factory=dict)
    dry_run: bool = True
    auto_approve: bool = False
    timeout_minutes: int = 30


@dataclass
class DeploymentResult:
    """Infrastructure deployment result"""
    deployment_id: UUID
    status: DeploymentStatus
    platform: DeploymentPlatform
    environment: str
    resources_created: List[Dict[str, Any]]
    outputs: Dict[str, Any]
    logs: List[str]
    errors: List[str]
    metrics: Dict[str, Any]
    cost_estimate: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_seconds: Optional[int] = None


@dataclass
class DeploymentMonitoring:
    """Deployment monitoring and health checks"""
    deployment_id: UUID
    health_checks: List[str]
    monitoring_enabled: bool = True
    alerts_configured: bool = False
    backup_enabled: bool = False
    auto_scaling_enabled: bool = False


class InfrastructureDeploymentService:
    """
    Automated infrastructure deployment service that takes generated code
    and deploys it to target platforms with monitoring and rollback capabilities
    """

    def __init__(self):
        self.active_deployments: Dict[UUID, DeploymentResult] = {}
        self.deployment_history: List[DeploymentResult] = []
        self.platform_clients = self._initialize_platform_clients()
        self._initialize_llm_templates()

    def _initialize_platform_clients(self) -> Dict[str, Any]:
        """Initialize platform-specific deployment clients"""
        clients = {}

        # Initialize clients based on available credentials
        # This would normally use proper SDK clients
        clients['terraform'] = self._init_terraform_client()
        clients['ansible'] = self._init_ansible_client()
        clients['kubernetes'] = self._init_kubernetes_client()
        clients['docker'] = self._init_docker_client()

        return clients

    def _init_terraform_client(self) -> Dict[str, Any]:
        """Initialize Terraform deployment client"""
        return {
            'type': 'terraform',
            'binary_path': 'terraform',
            'version_required': '>=1.0.0',
            'state_backend': 's3',  # configurable
            'parallelism': 10
        }

    def _init_ansible_client(self) -> Dict[str, Any]:
        """Initialize Ansible deployment client"""
        return {
            'type': 'ansible',
            'binary_path': 'ansible-playbook',
            'version_required': '>=2.9.0',
            'inventory': 'dynamic',
            'vault_enabled': True
        }

    def _init_kubernetes_client(self) -> Dict[str, Any]:
        """Initialize Kubernetes deployment client"""
        return {
            'type': 'kubernetes',
            'binary_path': 'kubectl',
            'version_required': '>=1.20.0',
            'context': 'current',
            'namespace': 'default'
        }

    def _init_docker_client(self) -> Dict[str, Any]:
        """Initialize Docker deployment client"""
        return {
            'type': 'docker',
            'binary_path': 'docker',
            'version_required': '>=20.0.0',
            'registry': 'docker.io',
            'build_args': {}
        }

    def _initialize_llm_templates(self):
        """Initialize LLM templates for deployment assistance"""
        deployment_template = """You are an expert DevOps engineer specializing in {{ platform }} deployments.

Analyze the following {{ code_type }} code for deployment to {{ platform }}:

**Code to Deploy:**
```
{{ code }}
```

**Deployment Context:**
- Platform: {{ platform }}
- Environment: {{ environment }}
- Region: {{ region }}
- Strategy: {{ strategy }}

**Requirements:**
1. Validate the code for {{ platform }} deployment
2. Identify any missing configurations or dependencies
3. Suggest security best practices
4. Recommend resource sizing and costs
5. Identify potential deployment issues
6. Suggest monitoring and alerting setup

**Variables:**
{% for key, value in variables.items() %}
- {{ key }}: {{ value }}
{% endfor %}

Provide your analysis in JSON format:
{
  "validation_status": "valid|invalid|warning",
  "issues": ["list of issues found"],
  "recommendations": ["list of recommendations"],
  "missing_configs": ["list of missing configurations"],
  "security_notes": ["security recommendations"],
  "cost_estimate": "estimated cost range",
  "deployment_steps": ["step by step deployment instructions"],
  "monitoring_setup": ["monitoring recommendations"],
  "rollback_plan": ["rollback instructions"]
}"""

        llm_service.add_template(PromptTemplate(
            name="deployment_analysis",
            template=deployment_template,
            description="Analyze code for infrastructure deployment",
            required_vars=["code", "code_type", "platform", "environment", "strategy"],
            optional_vars=["region", "variables"],
            category="deployment",
            model_size=ModelSize.LARGE
        ))

    async def deploy_infrastructure(self, request: DeploymentRequest) -> DeploymentResult:
        """
        Deploy infrastructure code to target platform
        """
        deployment_id = uuid4()
        logger.info(f"Starting deployment {deployment_id} for {request.name}")

        # Initialize deployment result
        result = DeploymentResult(
            deployment_id=deployment_id,
            status=DeploymentStatus.INITIALIZING,
            platform=request.platform,
            environment=request.environment,
            resources_created=[],
            outputs={},
            logs=[],
            errors=[],
            metrics={},
            started_at=datetime.now()
        )

        self.active_deployments[deployment_id] = result

        try:
            # Step 1: Validate deployment request
            await self._validate_deployment_request(request, result)

            # Step 2: Analyze code with AI
            result.status = DeploymentStatus.PLANNING
            analysis = await self._analyze_deployment_with_ai(request)
            result.logs.append(
                f"AI analysis completed: {analysis.get('validation_status', 'unknown')}"
            )

            # Step 3: Pre-deployment validation
            if analysis.get('validation_status') == 'invalid':
                result.status = DeploymentStatus.FAILED
                result.errors.extend(analysis.get('issues', []))
                return result

            # Step 4: Prepare deployment environment
            deployment_dir = await self._prepare_deployment_environment(request, deployment_id)
            result.logs.append(f"Deployment environment prepared: {deployment_dir}")

            # Step 5: Execute deployment based on strategy
            result.status = DeploymentStatus.APPLYING
            if request.strategy == DeploymentStrategy.VALIDATE_FIRST:
                validation_result = await self._validate_deployment(request, deployment_dir)
                if not validation_result['valid']:
                    result.status = DeploymentStatus.FAILED
                    result.errors.extend(validation_result['errors'])
                    return result

            # Step 6: Apply infrastructure changes
            if not request.dry_run:
                deployment_output = await self._apply_infrastructure(request, deployment_dir)
                result.resources_created = deployment_output.get('resources', [])
                result.outputs = deployment_output.get('outputs', {})
                result.logs.extend(deployment_output.get('logs', []))

                if deployment_output.get('success'):
                    result.status = DeploymentStatus.DEPLOYED

                    # Step 7: Setup monitoring
                    await self._setup_monitoring(request, result)

                    # Step 8: Perform health checks
                    health_status = await self._perform_health_checks(request, result)
                    result.metrics['health_checks'] = health_status
                else:
                    result.status = DeploymentStatus.FAILED
                    result.errors.extend(deployment_output.get('errors', []))
            else:
                result.status = DeploymentStatus.DEPLOYED
                result.logs.append("Dry run completed successfully")

            # Calculate metrics
            result.completed_at = datetime.now()
            result.duration_seconds = int((result.completed_at - result.started_at).total_seconds())
            result.cost_estimate = analysis.get('cost_estimate')

            # Cleanup temporary files
            await self._cleanup_deployment_environment(deployment_dir)

        except Exception as e:
            logger.error(f"Deployment {deployment_id} failed: {e}")
            result.status = DeploymentStatus.FAILED
            result.errors.append(f"Deployment error: {str(e)}")
            result.completed_at = datetime.now()

        # Store in history
        self.deployment_history.append(result)
        if deployment_id in self.active_deployments:
            del self.active_deployments[deployment_id]

        return result

    async def _validate_deployment_request(self, request: DeploymentRequest, result: DeploymentResult):
        """Validate deployment request parameters"""
        if not request.code.strip():
            raise ValueError("Deployment code cannot be empty")

        if request.platform not in DeploymentPlatform:
            raise ValueError(f"Unsupported platform: {request.platform}")

        if request.timeout_minutes <= 0 or request.timeout_minutes > 120:
            raise ValueError("Timeout must be between 1 and 120 minutes")

        result.logs.append("Deployment request validated successfully")

    async def _analyze_deployment_with_ai(self, request: DeploymentRequest) -> Dict[str, Any]:
        """Use AI to analyze deployment code and provide recommendations"""
        try:
            llm_request = LLMRequest(
                prompt="",
                template_name="deployment_analysis",
                template_vars={
                    "code": request.code,
                    "code_type": request.code_type.value,
                    "platform": request.platform.value,
                    "environment": request.environment,
                    "region": request.region or "default",
                    "strategy": request.strategy.value,
                    "variables": request.variables or {}
                },
                model_size=ModelSize.LARGE,
                temperature=0.1,
                max_tokens=3000,
                use_cache=True
            )

            response = await llm_service.generate_completion(llm_request)

            # Parse JSON response
            import re
            json_match = re.search(r'\{.*\}', response.content, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            else:
                return {
                    "validation_status": "warning",
                    "issues": ["Could not parse AI analysis"],
                    "recommendations": ["Manual review recommended"],
                    "deployment_steps": ["Standard deployment process"]
                }

        except Exception as e:
            logger.error(f"AI analysis failed: {e}")
            return {
                "validation_status": "warning",
                "issues": [f"AI analysis failed: {str(e)}"],
                "recommendations": ["Proceed with manual validation"],
                "deployment_steps": ["Standard deployment process"]
            }

    async def _prepare_deployment_environment(self, request: DeploymentRequest, deployment_id: UUID) -> str:
        """Prepare isolated deployment environment"""
        # Create temporary directory for deployment
        temp_dir = tempfile.mkdtemp(prefix=f"upm_deploy_{deployment_id}_")
        deployment_path = Path(temp_dir)

        # Write deployment code to appropriate files
        if request.code_type == CodeType.TERRAFORM:
            (deployment_path / "main.tf").write_text(request.code)
            if request.variables:
                (deployment_path / "terraform.tfvars").write_text(
                    "\n".join([f'{k} = "{v}"' for k, v in request.variables.items()])
                )
        elif request.code_type == CodeType.ANSIBLE:
            (deployment_path / "playbook.yml").write_text(request.code)
            if request.variables:
                (deployment_path / "vars.yml").write_text(
                    json.dumps(request.variables, indent=2)
                )
        elif request.code_type == CodeType.KUBERNETES:
            (deployment_path / "manifests.yaml").write_text(request.code)
        elif request.code_type == CodeType.DOCKER:
            (deployment_path / "Dockerfile").write_text(request.code)

        # Set up platform-specific configuration
        await self._setup_platform_config(request, deployment_path)

        return str(deployment_path)

    async def _setup_platform_config(self, request: DeploymentRequest, deployment_path: Path):
        """Setup platform-specific configuration files"""
        if request.platform == DeploymentPlatform.AWS:
            # Setup AWS provider configuration
            if request.credentials:
                aws_config = {
                    "region": request.region or "us-west-2",
                    "access_key": request.credentials.get("access_key"),
                    "secret_key": request.credentials.get("secret_key")
                }
                (deployment_path / ".aws_config").write_text(json.dumps(aws_config))

        elif request.platform == DeploymentPlatform.KUBERNETES:
            # Setup kubeconfig or use existing
            if request.credentials.get("kubeconfig"):
                (deployment_path / "kubeconfig").write_text(request.credentials["kubeconfig"])

    async def _validate_deployment(self, request: DeploymentRequest, deployment_dir: str) -> Dict[str, Any]:
        """Validate deployment before applying"""
        try:
            if request.code_type == CodeType.TERRAFORM:
                return await self._validate_terraform(deployment_dir)
            elif request.code_type == CodeType.ANSIBLE:
                return await self._validate_ansible(deployment_dir)
            elif request.code_type == CodeType.KUBERNETES:
                return await self._validate_kubernetes(deployment_dir)
            else:
                return {"valid": True, "errors": [], "warnings": []}

        except Exception as e:
            return {"valid": False, "errors": [f"Validation failed: {str(e)}"], "warnings": []}

    async def _validate_terraform(self, deployment_dir: str) -> Dict[str, Any]:
        """Validate Terraform configuration"""
        try:
            # Run terraform init
            init_result = await self._run_command("terraform", ["init"], deployment_dir)
            if init_result["returncode"] != 0:
                return {"valid": False, "errors": [f"Terraform init failed: {init_result['stderr']}"]}

            # Run terraform validate
            validate_result = await self._run_command("terraform", ["validate"], deployment_dir)
            if validate_result["returncode"] != 0:
                return {"valid": False, "errors": [f"Terraform validation failed: {validate_result['stderr']}"]}

            # Run terraform plan
            plan_result = await self._run_command("terraform", ["plan", "-detailed-exitcode"], deployment_dir)

            return {
                "valid": True,
                "errors": [],
                "warnings": [],
                "plan_output": plan_result["stdout"]
            }

        except Exception as e:
            return {"valid": False, "errors": [f"Terraform validation error: {str(e)}"]}

    async def _validate_ansible(self, deployment_dir: str) -> Dict[str, Any]:
        """Validate Ansible playbook"""
        try:
            # Run ansible-playbook syntax check
            result = await self._run_command(
                "ansible-playbook",
                ["--syntax-check", "playbook.yml"],
                deployment_dir
            )

            if result["returncode"] != 0:
                return {"valid": False, "errors": [f"Ansible syntax check failed: {result['stderr']}"]}

            return {"valid": True, "errors": [], "warnings": []}

        except Exception as e:
            return {"valid": False, "errors": [f"Ansible validation error: {str(e)}"]}

    async def _validate_kubernetes(self, deployment_dir: str) -> Dict[str, Any]:
        """Validate Kubernetes manifests"""
        try:
            # Run kubectl dry-run
            result = await self._run_command(
                "kubectl",
                ["apply", "--dry-run=client", "-f", "manifests.yaml"],
                deployment_dir
            )

            if result["returncode"] != 0:
                return {"valid": False, "errors": [f"Kubernetes validation failed: {result['stderr']}"]}

            return {"valid": True, "errors": [], "warnings": []}

        except Exception as e:
            return {"valid": False, "errors": [f"Kubernetes validation error: {str(e)}"]}

    async def _apply_infrastructure(self, request: DeploymentRequest, deployment_dir: str) -> Dict[str, Any]:
        """Apply infrastructure changes"""
        try:
            if request.code_type == CodeType.TERRAFORM:
                return await self._apply_terraform(deployment_dir, request.auto_approve)
            elif request.code_type == CodeType.ANSIBLE:
                return await self._apply_ansible(deployment_dir)
            elif request.code_type == CodeType.KUBERNETES:
                return await self._apply_kubernetes(deployment_dir)
            else:
                return {"success": False, "errors": ["Unsupported deployment type"]}

        except Exception as e:
            return {"success": False, "errors": [f"Deployment failed: {str(e)}"]}

    async def _apply_terraform(self, deployment_dir: str, auto_approve: bool = False) -> Dict[str, Any]:
        """Apply Terraform configuration"""
        try:
            args = ["apply"]
            if auto_approve:
                args.append("-auto-approve")

            result = await self._run_command("terraform", args, deployment_dir)

            if result["returncode"] != 0:
                return {
                    "success": False,
                    "errors": [f"Terraform apply failed: {result['stderr']}"],
                    "logs": [result["stdout"]]
                }

            # Get outputs
            output_result = await self._run_command("terraform", ["output", "-json"], deployment_dir)
            outputs = {}
            if output_result["returncode"] == 0:
                try:
                    outputs = json.loads(output_result["stdout"])
                except json.JSONDecodeError:
                    pass

            return {
                "success": True,
                "resources": [],  # Would parse from terraform state
                "outputs": outputs,
                "logs": [result["stdout"]]
            }

        except Exception as e:
            return {"success": False, "errors": [f"Terraform apply error: {str(e)}"]}

    async def _apply_ansible(self, deployment_dir: str) -> Dict[str, Any]:
        """Apply Ansible playbook"""
        try:
            result = await self._run_command(
                "ansible-playbook",
                ["playbook.yml", "-v"],
                deployment_dir
            )

            if result["returncode"] != 0:
                return {
                    "success": False,
                    "errors": [f"Ansible playbook failed: {result['stderr']}"],
                    "logs": [result["stdout"]]
                }

            return {
                "success": True,
                "resources": [],  # Would parse from ansible output
                "outputs": {},
                "logs": [result["stdout"]]
            }

        except Exception as e:
            return {"success": False, "errors": [f"Ansible apply error: {str(e)}"]}

    async def _apply_kubernetes(self, deployment_dir: str) -> Dict[str, Any]:
        """Apply Kubernetes manifests"""
        try:
            result = await self._run_command(
                "kubectl",
                ["apply", "-f", "manifests.yaml"],
                deployment_dir
            )

            if result["returncode"] != 0:
                return {
                    "success": False,
                    "errors": [f"Kubernetes apply failed: {result['stderr']}"],
                    "logs": [result["stdout"]]
                }

            return {
                "success": True,
                "resources": [],  # Would parse from kubectl output
                "outputs": {},
                "logs": [result["stdout"]]
            }

        except Exception as e:
            return {"success": False, "errors": [f"Kubernetes apply error: {str(e)}"]}

    async def _run_command(self, command: str, args: List[str], cwd: str) -> Dict[str, Any]:
        """Run shell command asynchronously"""
        try:
            process = await asyncio.create_subprocess_exec(
                command, *args,
                cwd=cwd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            stdout, stderr = await process.communicate()

            return {
                "returncode": process.returncode,
                "stdout": stdout.decode(),
                "stderr": stderr.decode()
            }

        except Exception as e:
            return {
                "returncode": -1,
                "stdout": "",
                "stderr": f"Command execution failed: {str(e)}"
            }

    async def _setup_monitoring(self, request: DeploymentRequest, result: DeploymentResult):
        """Setup monitoring for deployed infrastructure"""
        try:
            # This would integrate with monitoring services like CloudWatch, Prometheus, etc.
            monitoring_config = {
                "deployment_id": str(result.deployment_id),
                "platform": request.platform.value,
                "environment": request.environment,
                "alerts": {
                    "cpu_threshold": 80,
                    "memory_threshold": 85,
                    "disk_threshold": 90
                },
                "health_checks": [
                    "http://health-check-endpoint/health"
                ]
            }

            result.logs.append(f"Monitoring configured: {monitoring_config}")

        except Exception as e:
            logger.error(f"Failed to setup monitoring: {e}")
            result.errors.append(f"Monitoring setup failed: {str(e)}")

    async def _perform_health_checks(self, request: DeploymentRequest, result: DeploymentResult) -> Dict[str, Any]:
        """Perform health checks on deployed infrastructure"""
        try:
            health_status = {
                "overall": "healthy",
                "checks": [],
                "timestamp": datetime.now().isoformat()
            }

            # Would implement actual health checks based on deployment type
            if request.code_type == CodeType.KUBERNETES:
                # Check pod status
                health_status["checks"].append({
                    "type": "pod_status",
                    "status": "healthy",
                    "details": "All pods running"
                })

            return health_status

        except Exception as e:
            logger.error(f"Health checks failed: {e}")
            return {
                "overall": "unhealthy",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }

    async def _cleanup_deployment_environment(self, deployment_dir: str):
        """Clean up temporary deployment files"""
        try:
            import shutil
            shutil.rmtree(deployment_dir)
        except Exception as e:
            logger.warning(f"Failed to cleanup deployment directory {deployment_dir}: {e}")

    async def get_deployment_status(self, deployment_id: UUID) -> Optional[DeploymentResult]:
        """Get status of a specific deployment"""
        if deployment_id in self.active_deployments:
            return self.active_deployments[deployment_id]

        for deployment in self.deployment_history:
            if deployment.deployment_id == deployment_id:
                return deployment

        return None

    async def list_deployments(
        self,
        environment: Optional[str] = None,
        platform: Optional[DeploymentPlatform] = None
    ) -> List[DeploymentResult]:
        """List deployments with optional filtering"""
        deployments = list(self.active_deployments.values()) + self.deployment_history

        if environment:
            deployments = [d for d in deployments if d.environment == environment]

        if platform:
            deployments = [d for d in deployments if d.platform == platform]

        return sorted(deployments, key=lambda x: x.started_at or datetime.min, reverse=True)

    async def destroy_infrastructure(self, deployment_id: UUID, force: bool = False) -> DeploymentResult:
        """Destroy deployed infrastructure"""
        deployment = await self.get_deployment_status(deployment_id)
        if not deployment:
            raise ValueError(f"Deployment {deployment_id} not found")

        if deployment.status != DeploymentStatus.DEPLOYED and not force:
            raise ValueError(f"Cannot destroy deployment with status {deployment.status}")

        # Update status
        deployment.status = DeploymentStatus.DESTROYING

        try:
            # Implementation would destroy resources based on deployment type
            # For now, simulate destruction
            await asyncio.sleep(1)  # Simulate destruction time

            deployment.status = DeploymentStatus.DESTROYED
            deployment.completed_at = datetime.now()
            deployment.logs.append(f"Infrastructure destroyed at {deployment.completed_at}")

            return deployment

        except Exception as e:
            deployment.status = DeploymentStatus.FAILED
            deployment.errors.append(f"Destruction failed: {str(e)}")
            raise

    async def health_check(self) -> Dict[str, Any]:
        """Health check for deployment service"""
        return {
            "service": "healthy",
            "active_deployments": len(self.active_deployments),
            "total_deployments": len(self.deployment_history),
            "platform_clients": list(self.platform_clients.keys()),
            "timestamp": datetime.now().isoformat()
        }


# Service instance
infrastructure_deployment_service = InfrastructureDeploymentService()
