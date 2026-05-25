"""
AI-Powered Code Generation Service
Natural Language to Infrastructure Code Generation
"""

import json
import logging
import re
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from enum import Enum

from jinja2 import Template
from app.services.llm_service import llm_service, LLMRequest, ModelSize, PromptTemplate

logger = logging.getLogger(__name__)


class CodeType(Enum):
    """Supported code generation types"""
    TERRAFORM = "terraform"
    ANSIBLE = "ansible"
    KUBERNETES = "kubernetes"
    DOCKER = "docker"
    PYTHON = "python"
    BASH = "bash"
    YAML = "yaml"
    JSON = "json"


class ComplexityLevel(Enum):
    """Code complexity levels"""
    SIMPLE = "simple"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
    ENTERPRISE = "enterprise"


@dataclass
class CodeGenerationRequest:
    """Code generation request structure"""
    description: str
    code_type: CodeType
    complexity: ComplexityLevel = ComplexityLevel.SIMPLE
    target_platform: Optional[str] = None
    existing_code: Optional[str] = None
    requirements: Optional[List[str]] = field(default_factory=list)
    constraints: Optional[List[str]] = field(default_factory=list)
    variables: Optional[Dict[str, Any]] = field(default_factory=dict)


@dataclass
class GeneratedCode:
    """Generated code result"""
    code: str
    language: str
    description: str
    instructions: List[str]
    dependencies: List[str]
    variables: Dict[str, Any]
    validation_notes: List[str]
    security_considerations: List[str]
    estimated_cost: Optional[str] = None
    deployment_time: Optional[str] = None


class CodeGenerationService:
    """
    AI-powered code generation service that converts natural language
    descriptions into executable infrastructure and automation code
    """

    def __init__(self):
        self.templates = self._load_templates()
        self.code_validators = self._initialize_validators()
        self._initialize_llm_templates()

    def _load_templates(self) -> Dict[str, Template]:
        """Load Jinja2 templates for different code types"""
        templates = {}

        # Terraform template
        templates[CodeType.TERRAFORM.value] = Template("""
# {{ description }}
# Generated on {{ timestamp }}

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

{% for variable in formatted_variables %}
variable "{{ variable.name }}" {
  description = "{{ variable.description }}"
  type        = {{ variable.type }}
  {% if variable.default %}default     = {{ variable.default }}{% endif %}
}
{% endfor %}

{{ code }}

{% for output in outputs %}
output "{{ output.name }}" {
  description = "{{ output.description }}"
  value       = {{ output.value }}
}
{% endfor %}
        """)

        # Ansible template
        templates[CodeType.ANSIBLE.value] = Template("""
---
# {{ description }}
# Generated on {{ timestamp }}

- name: {{ playbook_name }}
  hosts: {{ target_hosts | default('all') }}
  become: {{ become | default('yes') }}
  vars:
    {% for key, value in variables.items() %}
    {{ key }}: {{ value }}
    {% endfor %}

  tasks:
{{ code | indent(4, true) }}
        """)

        # Kubernetes template
        templates[CodeType.KUBERNETES.value] = Template("""
# {{ description }}
# Generated on {{ timestamp }}

apiVersion: v1
kind: Namespace
metadata:
  name: {{ namespace | default('default') }}
---
{{ code }}
        """)

        return templates

    def _initialize_llm_templates(self):
        """Initialize LLM prompt templates for code generation"""
        # Add the comprehensive code generation template
        code_gen_template = """You are an expert DevOps engineer and {{ code_type }} specialist.

Generate high-quality, production-ready {{ code_type }} code for the following requirement:

**Description:** {{ description }}
**Complexity Level:** {{ complexity }}
**Target Platform:** {{ target_platform | default("Generic") }}

{% if context %}
**Additional Context:** {{ context }}
{% endif %}

{% if requirements %}
**Requirements:**
{% for req in requirements %}
- {{ req }}
{% endfor %}
{% endif %}

{% if constraints %}
**Constraints:**
{% for constraint in constraints %}
- {{ constraint }}
{% endfor %}
{% endif %}

{% if existing_code %}
**Existing Code to Extend:**
```
{{ existing_code }}
```
{% endif %}

**Instructions:**
1. Generate clean, production-ready {{ code_type }} code
2. Follow {{ code_type }} best practices and security standards
3. Include proper error handling and logging
4. Add comprehensive comments explaining key sections
5. Consider scalability and maintainability
6. Include security considerations

**Output Format:**
Provide your response as a JSON object with this exact structure:
{
  "code": "The complete generated code",
  "description": "Brief description of what the code does",
  "instructions": ["Step-by-step deployment/usage instructions"],
  "dependencies": ["List of required dependencies or tools"],
  "variables": {"variable_name": "description of what this variable does"},
  "notes": ["Important notes about the implementation"]
}"""

        # Add template to LLM service
        llm_service.add_template(PromptTemplate(
            name="advanced_code_generation",
            template=code_gen_template,
            description="Advanced code generation with context and requirements",
            required_vars=["description", "code_type", "complexity"],
            optional_vars=["context", "requirements", "constraints", "target_platform", "existing_code"],
            category="code_generation",
            model_size=ModelSize.LARGE
        ))

    def _initialize_validators(self) -> Dict[str, callable]:
        """Initialize code validators for different types"""
        return {
            CodeType.TERRAFORM.value: self._validate_terraform,
            CodeType.ANSIBLE.value: self._validate_ansible,
            CodeType.KUBERNETES.value: self._validate_kubernetes,
            CodeType.PYTHON.value: self._validate_python,
            CodeType.BASH.value: self._validate_bash,
        }

    async def generate_code(self, request: CodeGenerationRequest) -> GeneratedCode:
        """
        Generate code from natural language description
        """
        logger.info(f"Generating {request.code_type.value} code for: {request.description}")

        try:
            # Generate the base code using AI
            generated_content = await self._generate_with_ai(request)

            # Parse the AI response
            parsed_result = self._parse_ai_response(generated_content, request.code_type)

            # Apply templates if available
            if request.code_type.value in self.templates:
                formatted_code = self._apply_template(parsed_result, request)
            else:
                formatted_code = parsed_result['code']

            # Validate the generated code
            validation_notes = await self._validate_code(formatted_code, request.code_type)

            # Generate security analysis
            security_notes = await self._analyze_security(formatted_code, request.code_type)

            # Estimate cost and deployment time
            cost_estimate = await self._estimate_cost(formatted_code, request)
            time_estimate = await self._estimate_deployment_time(formatted_code, request)

            return GeneratedCode(
                code=formatted_code,
                language=request.code_type.value,
                description=parsed_result.get('description', request.description),
                instructions=parsed_result.get('instructions', []),
                dependencies=parsed_result.get('dependencies', []),
                variables=parsed_result.get('variables', {}),
                validation_notes=validation_notes,
                security_considerations=security_notes,
                estimated_cost=cost_estimate,
                deployment_time=time_estimate
            )

        except Exception as e:
            logger.error(f"Code generation failed: {e}")
            raise

    async def _generate_with_ai(self, request: CodeGenerationRequest) -> str:
        """Generate code using our centralized LLM service"""
        try:
            # Create LLM request using our advanced template
            llm_request = LLMRequest(
                prompt="",  # Template will provide the prompt
                template_name="advanced_code_generation",
                template_vars={
                    "description": request.description,
                    "code_type": request.code_type.value,
                    "complexity": request.complexity.value,
                    "target_platform": request.target_platform,
                    "context": None,  # Can be added in future enhancement
                    "requirements": request.requirements or [],
                    "constraints": request.constraints or [],
                    "existing_code": request.existing_code
                },
                model_size=ModelSize.LARGE,
                temperature=0.1,  # Low temperature for consistent code generation
                max_tokens=4000,
                use_cache=True
            )

            # Generate using LLM service
            response = await llm_service.generate_completion(llm_request)

            if not response.content:
                return self._generate_mock_response(request)

            return response.content

        except Exception as e:
            logger.error(f"LLM code generation error: {e}")
            # Fallback to mock response for robustness
            return self._generate_mock_response(request)

    def _generate_mock_response(self, request: CodeGenerationRequest) -> str:
        """Generate mock response when OpenAI is not available"""
        if request.code_type == CodeType.KUBERNETES:
            return """apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-service
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: user-service
  template:
    metadata:
      labels:
        app: user-service
    spec:
      containers:
      - name: user-service
        image: user-service:latest
        ports:
        - containerPort: 8080
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: user-service
  namespace: production
spec:
  selector:
    app: user-service
  ports:
  - port: 80
    targetPort: 8080
  type: ClusterIP
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: user-service-hpa
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: user-service
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70"""
        else:
            return (
                f"# Generated {request.code_type.value} code for: {request.description}\n"
                f"# This is a mock response for testing purposes"
            )

    def _build_generation_prompt(self, request: CodeGenerationRequest) -> str:
        """Build a comprehensive prompt for code generation"""

        prompt_parts = [
            f"Generate {request.code_type.value} code for the following requirement:",
            f"Description: {request.description}",
            f"Complexity Level: {request.complexity.value}",
        ]

        if request.target_platform:
            prompt_parts.append(f"Target Platform: {request.target_platform}")

        if request.requirements:
            prompt_parts.append(f"Requirements: {', '.join(request.requirements)}")

        if request.constraints:
            prompt_parts.append(f"Constraints: {', '.join(request.constraints)}")

        if request.existing_code:
            prompt_parts.append(f"Existing Code to Extend:\n```\n{request.existing_code}\n```")

        if request.variables:
            prompt_parts.append(f"Variables to Include: {json.dumps(request.variables, indent=2)}")

        prompt_parts.extend([
            "",
            "Please provide the response in the following JSON format:",
            "{",
            '  "code": "The generated code",',
            '  "description": "Brief description of what the code does",',
            '  "instructions": ["Step 1", "Step 2", ...],',
            '  "dependencies": ["dependency1", "dependency2", ...],',
            '  "variables": {"var1": "description", "var2": "description"},',
            '  "notes": ["Important note 1", "Important note 2", ...]',
            "}"
        ])

        return "\n".join(prompt_parts)

    def _get_system_prompt(self, code_type: CodeType) -> str:
        """Get system prompt based on code type"""

        base_prompt = """You are an expert DevOps engineer and infrastructure architect.
        Generate high-quality, production-ready code that follows best practices."""

        type_specific = {
            CodeType.TERRAFORM: """
            Focus on:
            - Proper resource naming and tagging
            - Security best practices
            - Cost optimization
            - Modularity and reusability
            - State management considerations
            """,
            CodeType.ANSIBLE: """
            Focus on:
            - Idempotent tasks
            - Proper error handling
            - Security hardening
            - Role organization
            - Cross-platform compatibility
            """,
            CodeType.KUBERNETES: """
            Focus on:
            - Resource limits and requests
            - Security contexts and policies
            - Health checks and probes
            - ConfigMaps and Secrets management
            - Service mesh considerations
            """,
            CodeType.PYTHON: """
            Focus on:
            - Clean, readable code
            - Proper error handling
            - Type hints and documentation
            - Security best practices
            - Performance optimization
            """,
            CodeType.BASH: """
            Focus on:
            - Error handling with set -euo pipefail
            - Proper quoting and escaping
            - Cross-platform compatibility
            - Security considerations
            - Logging and debugging
            """
        }

        return base_prompt + type_specific.get(code_type, "")

    def _parse_ai_response(self, response: str, code_type: CodeType) -> Dict[str, Any]:
        """Parse AI response and extract structured data"""
        try:
            # Try to extract JSON from the response
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            else:
                # Fallback: treat entire response as code
                return {
                    "code": response,
                    "description": f"Generated {code_type.value} code",
                    "instructions": ["Deploy the generated code to your target environment"],
                    "dependencies": [],
                    "variables": {},
                    "notes": []
                }
        except json.JSONDecodeError:
            logger.warning("Failed to parse JSON response, using fallback")
            return {
                "code": response,
                "description": f"Generated {code_type.value} code",
                "instructions": ["Review and deploy the generated code"],
                "dependencies": [],
                "variables": {},
                "notes": ["Please review the generated code carefully before deployment"]
            }

    def _apply_template(self, parsed_result: Dict[str, Any], request: CodeGenerationRequest) -> str:
        """Apply Jinja2 template to structure the code"""
        template = self.templates[request.code_type.value]

        original_variables = parsed_result.get('variables', {})

        template_vars = {
            'description': parsed_result.get('description', request.description),
            'timestamp': datetime.now().isoformat(),
            'code': parsed_result['code'],
            'variables': original_variables,  # Keep original dict for Ansible template
            'formatted_variables': self._format_variables(original_variables, request.code_type),
            'outputs': self._generate_outputs(original_variables, request.code_type),
            'namespace': request.variables.get('namespace', 'default') if request.variables else 'default',
            'playbook_name': request.description.replace(' ', '_').lower(),
            'target_hosts': request.variables.get('target_hosts', 'all') if request.variables else 'all',
            'become': request.variables.get('become', 'yes') if request.variables else 'yes'
        }

        return template.render(**template_vars)

    def _format_variables(self, variables: Dict[str, Any], code_type: CodeType) -> List[Dict[str, Any]]:
        """Format variables for template rendering"""
        formatted = []

        # Handle both dict and list inputs
        if isinstance(variables, list):
            # Convert list to dict for processing
            variables = {f"var_{i}": str(var) for i, var in enumerate(variables)}
        elif not isinstance(variables, dict):
            variables = {}

        for name, description in variables.items():
            var_type = "string"
            default_value = None

            # Infer type and default based on name patterns
            if "count" in name.lower() or "size" in name.lower():
                var_type = "number"
                default_value = "1"
            elif "enable" in name.lower() or "disable" in name.lower():
                var_type = "bool"
                default_value = "false"
            elif "list" in name.lower() or "tags" in name.lower():
                var_type = "list(string)"
                default_value = "[]"

            formatted.append({
                "name": name,
                "description": description,
                "type": var_type,
                "default": default_value
            })

        return formatted

    def _generate_outputs(self, variables: Dict[str, Any], code_type: CodeType) -> List[Dict[str, Any]]:
        """Generate appropriate outputs based on variables and code type"""
        outputs = []

        if code_type == CodeType.TERRAFORM:
            # Generate common Terraform outputs
            common_outputs = [
                {"name": "resource_id", "description": "ID of the created resource", "value": "aws_instance.main.id"},
                {"name": "public_ip", "description": "Public IP address", "value": "aws_instance.main.public_ip"},
                {"name": "private_ip", "description": "Private IP address", "value": "aws_instance.main.private_ip"}
            ]
            outputs.extend(common_outputs)

        return outputs

    async def _validate_code(self, code: str, code_type: CodeType) -> List[str]:
        """Validate generated code"""
        validator = self.code_validators.get(code_type.value)
        if validator:
            return await validator(code)
        return ["No specific validation available for this code type"]

    async def _validate_terraform(self, code: str) -> List[str]:
        """Validate Terraform code"""
        notes = []

        # Check for common issues
        if "provider" not in code:
            notes.append("Consider adding explicit provider configuration")

        if "variable" in code and "validation" not in code:
            notes.append("Consider adding variable validation rules")

        if "resource" in code and "tags" not in code:
            notes.append("Consider adding resource tags for better organization")

        if "aws_instance" in code and "vpc_security_group_ids" not in code:
            notes.append("Consider specifying security groups for EC2 instances")

        return notes

    async def _validate_ansible(self, code: str) -> List[str]:
        """Validate Ansible playbook"""
        notes = []

        if "become:" not in code and "sudo" in code:
            notes.append("Use 'become' instead of 'sudo' for privilege escalation")

        if "shell:" in code or "command:" in code:
            notes.append("Consider using specific modules instead of shell/command when possible")

        if "when:" not in code and "register:" in code:
            notes.append("Consider adding conditional execution with 'when' clauses")

        return notes

    async def _validate_kubernetes(self, code: str) -> List[str]:
        """Validate Kubernetes manifests"""
        notes = []

        if "resources:" not in code and "Deployment" in code:
            notes.append("Consider adding resource limits and requests")

        if "readinessProbe:" not in code and "Deployment" in code:
            notes.append("Consider adding readiness and liveness probes")

        if "securityContext:" not in code:
            notes.append("Consider adding security context for better security")

        return notes

    async def _validate_python(self, code: str) -> List[str]:
        """Validate Python code"""
        notes = []

        if "try:" not in code and ("requests." in code or "open(" in code):
            notes.append("Consider adding error handling with try-except blocks")

        if "import" in code and "from typing import" not in code:
            notes.append("Consider adding type hints for better code quality")

        if "print(" in code:
            notes.append("Consider using proper logging instead of print statements")

        return notes

    async def _validate_bash(self, code: str) -> List[str]:
        """Validate Bash script"""
        notes = []

        if not code.startswith("#!/bin/bash"):
            notes.append("Consider adding shebang line: #!/bin/bash")

        if "set -" not in code:
            notes.append("Consider adding 'set -euo pipefail' for better error handling")

        if "$" in code and '"' not in code:
            notes.append("Consider proper quoting of variables")

        return notes

    async def _analyze_security(self, code: str, code_type: CodeType) -> List[str]:
        """Analyze code for security considerations"""
        security_notes = []

        # Common security checks
        if "password" in code.lower() or "secret" in code.lower():
            security_notes.append("Avoid hardcoded secrets - use environment variables or secret management")

        if "0.0.0.0/0" in code:
            security_notes.append("Avoid using 0.0.0.0/0 in security groups - restrict access as needed")

        if code_type == CodeType.TERRAFORM:
            if "aws_s3_bucket" in code and "public_read" in code:
                security_notes.append("Review S3 bucket permissions - avoid public access unless required")

        elif code_type == CodeType.KUBERNETES:
            if "privileged: true" in code:
                security_notes.append("Avoid privileged containers unless absolutely necessary")

        elif code_type == CodeType.BASH:
            if "curl" in code and "https://" not in code:
                security_notes.append("Use HTTPS instead of HTTP for secure communications")

        return security_notes

    async def _estimate_cost(self, code: str, request: CodeGenerationRequest) -> Optional[str]:
        """Estimate deployment cost"""
        try:
            # Simple cost estimation based on resources mentioned
            if request.code_type == CodeType.TERRAFORM:
                cost_factors = []

                if "aws_instance" in code:
                    cost_factors.append("EC2 instance: $20-200/month depending on instance type")
                if "aws_rds" in code:
                    cost_factors.append("RDS database: $25-500/month depending on instance class")
                if "aws_s3_bucket" in code:
                    cost_factors.append("S3 storage: $0.02-0.05/GB/month")
                if "aws_load_balancer" in code:
                    cost_factors.append("Load balancer: $20-25/month")

                if cost_factors:
                    return "Estimated monthly cost: " + "; ".join(cost_factors)

            return "Cost estimation not available - please review resource requirements"

        except Exception as e:
            logger.error(f"Cost estimation error: {e}")
            return "Cost estimation failed - please review manually"

    async def _estimate_deployment_time(self, code: str, request: CodeGenerationRequest) -> Optional[str]:
        """Estimate deployment time"""
        try:
            # Simple time estimation based on complexity
            base_time = 5  # minutes

            if request.complexity == ComplexityLevel.SIMPLE:
                multiplier = 1
            elif request.complexity == ComplexityLevel.INTERMEDIATE:
                multiplier = 2
            elif request.complexity == ComplexityLevel.ADVANCED:
                multiplier = 4
            else:  # ENTERPRISE
                multiplier = 8

            # Add time based on resource count
            resource_count = code.count("resource ") + code.count("- name:") + code.count("apiVersion:")
            estimated_minutes = base_time * multiplier + (resource_count * 2)

            if estimated_minutes < 60:
                return f"Estimated deployment time: {estimated_minutes} minutes"
            else:
                hours = estimated_minutes // 60
                minutes = estimated_minutes % 60
                return f"Estimated deployment time: {hours}h {minutes}m"

        except Exception as e:
            logger.error(f"Time estimation error: {e}")
            return "Time estimation failed"

    async def review_and_improve_code(self, code: str, code_type: CodeType, feedback: str) -> GeneratedCode:
        """Review and improve existing code based on feedback"""
        try:
            # Create improvement request using LLM service
            llm_request = LLMRequest(
                prompt=f"""Review and improve the following {code_type.value} code based on this feedback:

Feedback: {feedback}

Original Code:
```
{code}
```

Please provide improved code that addresses the feedback while maintaining functionality.
Include explanations for the changes made.

Provide response in JSON format:
{{
  "code": "improved code",
  "description": "explanation of changes",
  "instructions": ["deployment steps"],
  "dependencies": ["required dependencies"],
  "variables": {{"var": "description"}},
  "notes": ["improvement notes"]
}}""",
                model_size=ModelSize.LARGE,
                temperature=0.1,
                max_tokens=4000,
                use_cache=True
            )

            response = await llm_service.generate_completion(llm_request)
            parsed_result = self._parse_ai_response(response.content, code_type)

            return GeneratedCode(
                code=parsed_result['code'],
                language=code_type.value,
                description=f"Improved {code_type.value} code based on feedback",
                instructions=parsed_result.get('instructions', []),
                dependencies=parsed_result.get('dependencies', []),
                variables=parsed_result.get('variables', {}),
                validation_notes=["Code improved based on feedback"],
                security_considerations=await self._analyze_security(parsed_result['code'], code_type),
                estimated_cost=await self._estimate_cost(
                    parsed_result['code'],
                    CodeGenerationRequest(description="Improved code", code_type=code_type)
                ),
                deployment_time=await self._estimate_deployment_time(
                    parsed_result['code'],
                    CodeGenerationRequest(description="Improved code", code_type=code_type)
                )
            )

        except Exception as e:
            logger.error(f"Code improvement failed: {e}")
            raise

    async def generate_documentation(self, code: str, code_type: CodeType) -> str:
        """Generate comprehensive documentation for the code"""
        try:
            llm_request = LLMRequest(
                prompt=f"""Generate comprehensive documentation for the following {code_type.value} code:

```
{code}
```

Include:
1. Overview and purpose
2. Prerequisites and dependencies
3. Deployment/usage instructions
4. Configuration options
5. Troubleshooting guide
6. Security considerations
7. Maintenance and updates

Write clear, well-structured documentation in Markdown format.""",
                model_size=ModelSize.LARGE,
                temperature=0.2,
                max_tokens=3000,
                use_cache=True
            )

            response = await llm_service.generate_completion(llm_request)
            return response.content

        except Exception as e:
            logger.error(f"Documentation generation failed: {e}")
            raise

    async def health_check(self) -> Dict[str, Any]:
        """Health check for code generation service"""
        return {
            "service": "healthy",
            "templates_loaded": len(self.templates),
            "timestamp": datetime.now().isoformat()
        }


# Service instance
code_generation_service = CodeGenerationService()
