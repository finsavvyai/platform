#!/usr/bin/env python3
"""
Configuration validation system for GitOps
Validates Kubernetes manifests, Helm charts, and configurations
"""

import asyncio
import json
import logging
import os
import sys
import yaml
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any

import aiohttp
import kubernetes
from kubernetes import client, config
from pydantic import BaseModel, ValidationError, validator
from prometheus_client import Counter, Histogram, Gauge, start_http_server

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Prometheus metrics
VALIDATION_REQUESTS = Counter('config_validator_requests_total', 'Total validation requests', ['result'])
VALIDATION_DURATION = Histogram('config_validator_duration_seconds', 'Validation duration')
ACTIVE_VALIDATIONS = Gauge('config_validator_active_validations', 'Active validations')


class ValidationResult(BaseModel):
    """Model for validation results"""
    resource_type: str
    resource_name: str
    namespace: Optional[str]
    valid: bool
    errors: List[str] = []
    warnings: List[str] = []
    duration_ms: float
    timestamp: datetime = datetime.utcnow()


class ValidationReport(BaseModel):
    """Model for complete validation report"""
    repository_url: str
    commit_hash: str
    branch: str
    total_resources: int
    valid_resources: int
    invalid_resources: int
    warnings_total: int
    errors_total: int
    duration_ms: float
    results: List[ValidationResult] = []
    timestamp: datetime = datetime.utcnow()

    @validator('invalid_resources', always=True)
    def calculate_invalid_resources(cls, v, values):
        return values.get('total_resources', 0) - values.get('valid_resources', 0)


class ConfigurationValidator:
    """Main configuration validator class"""

    def __init__(self):
        self.k8s_client = None
        self.dynamic_client = None
        self.api_client = None
        self.session = None
        self.validation_rules = self._load_validation_rules()

        # Initialize Kubernetes client
        self._init_kubernetes_client()

    def _init_kubernetes_client(self):
        """Initialize Kubernetes client"""
        try:
            try:
                config.load_incluster_config()
            except config.ConfigException:
                config.load_kube_config()

            self.k8s_client = client.ApiClient()
            self.dynamic_client = client.ApiClient()
            self.api_client = client.CoreV1Api()

            logger.info("Kubernetes client initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize Kubernetes client: {e}")
            raise

    def _load_validation_rules(self) -> Dict:
        """Load validation rules from configuration"""
        rules = {
            'required_labels': ['app', 'version', 'managed-by'],
            'required_annotations': ['argocd.argoproj.io/sync-options'],
            'namespace_patterns': {
                'production': r'^prod-|production$',
                'staging': r'^staging-|staging$',
                'development': r'^dev-|development$'
            },
            'resource_limits': {
                'deployment': {
                    'max_replicas': 10,
                    'min_replicas': 1,
                    'required_resources': ['cpu', 'memory']
                },
                'statefulset': {
                    'max_replicas': 5,
                    'min_replicas': 1,
                    'required_resources': ['cpu', 'memory']
                }
            },
            'security_policies': {
                'require_security_context': True,
                'forbid_privileged': True,
                'require_readonly_root_filesystem': False,
                'require_non_root_user': True,
                'forbid_host_network': True,
                'forbid_host_pid': True,
                'forbid_host_ipc': True
            },
            'image_policies': {
                'require_image_pull_policy': True,
                'forbid_latest_tag': True,
                'allowed_registries': ['quantumbeam.io', 'docker.io', 'ghcr.io'],
                'require_image_tag': True
            },
            'network_policies': {
                'require_default_deny': True,
                'require_egress_rules': True,
                'require_ingress_rules': False
            }
        }

        # Load custom rules from environment variables or config file
        if os.getenv('VALIDATION_CONFIG_PATH'):
            try:
                with open(os.getenv('VALIDATION_CONFIG_PATH'), 'r') as f:
                    custom_rules = yaml.safe_load(f)
                    rules.update(custom_rules.get('validation_rules', {}))
            except Exception as e:
                logger.warning(f"Failed to load custom validation rules: {e}")

        return rules

    async def validate_repository(
        self,
        repository_url: str,
        commit_hash: str = None,
        branch: str = "main"
    ) -> ValidationReport:
        """
        Validate an entire repository configuration

        Args:
            repository_url: Git repository URL
            commit_hash: Specific commit hash to validate
            branch: Git branch to validate

        Returns:
            ValidationReport with comprehensive validation results
        """
        start_time = datetime.now()
        logger.info(f"Starting validation for repository: {repository_url}")

        try:
            # Clone or fetch repository
            repo_path = await self._clone_repository(repository_url, commit_hash, branch)

            # Find all Kubernetes manifests
            manifest_files = self._find_manifest_files(repo_path)

            total_resources = 0
            valid_resources = 0
            all_results = []
            total_warnings = 0
            total_errors = 0

            # Validate each manifest file
            for manifest_file in manifest_files:
                try:
                    results = await self._validate_manifest_file(manifest_file)
                    all_results.extend(results)

                    for result in results:
                        total_resources += 1
                        if result.valid:
                            valid_resources += 1
                        total_warnings += len(result.warnings)
                        total_errors += len(result.errors)

                except Exception as e:
                    logger.error(f"Failed to validate manifest file {manifest_file}: {e}")
                    total_errors += 1

            # Create validation report
            duration = (datetime.now() - start_time).total_seconds() * 1000
            report = ValidationReport(
                repository_url=repository_url,
                commit_hash=commit_hash or "latest",
                branch=branch,
                total_resources=total_resources,
                valid_resources=valid_resources,
                invalid_resources=total_resources - valid_resources,
                warnings_total=total_warnings,
                errors_total=total_errors,
                duration_ms=duration,
                results=all_results
            )

            logger.info(f"Validation completed: {valid_resources}/{total_resources} resources valid, "
                       f"{total_warnings} warnings, {total_errors} errors")

            return report

        except Exception as e:
            logger.error(f"Repository validation failed: {e}")
            raise

    async def _clone_repository(
        self,
        repository_url: str,
        commit_hash: str = None,
        branch: str = "main"
    ) -> Path:
        """Clone or fetch git repository"""
        import tempfile
        import subprocess

        # Create temporary directory
        temp_dir = Path(tempfile.mkdtemp(prefix="config-validator-"))

        try:
            # Clone repository
            cmd = ["git", "clone", "--depth", "1", repository_url, str(temp_dir)]
            if branch and branch != "main":
                cmd.extend(["--branch", branch])

            result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)

            if result.returncode != 0:
                raise Exception(f"Failed to clone repository: {result.stderr}")

            # Checkout specific commit if provided
            if commit_hash:
                checkout_cmd = ["git", "checkout", commit_hash]
                subprocess.run(checkout_cmd, cwd=temp_dir, capture_output=True, text=True, timeout=60)

            logger.info(f"Repository cloned to {temp_dir}")
            return temp_dir

        except Exception as e:
            # Clean up on failure
            import shutil
            shutil.rmtree(temp_dir, ignore_errors=True)
            raise

    def _find_manifest_files(self, repo_path: Path) -> List[Path]:
        """Find all Kubernetes manifest files in repository"""
        manifest_files = []

        # Common manifest file patterns
        patterns = [
            "**/*.yaml",
            "**/*.yml",
            "**/k8s/**/*.yaml",
            "**/k8s/**/*.yml",
            "**/manifests/**/*.yaml",
            "**/manifests/**/*.yml",
            "**/deploy/**/*.yaml",
            "**/deploy/**/*.yml"
        ]

        for pattern in patterns:
            manifest_files.extend(repo_path.glob(pattern))

        # Filter out non-Kubernetes files
        k8s_files = []
        for file_path in manifest_files:
            if self._is_kubernetes_manifest(file_path):
                k8s_files.append(file_path)

        logger.info(f"Found {len(k8s_files)} Kubernetes manifest files")
        return k8s_files

    def _is_kubernetes_manifest(self, file_path: Path) -> bool:
        """Check if file contains Kubernetes manifests"""
        try:
            with open(file_path, 'r') as f:
                content = f.read()

            # Check for Kubernetes API version
            if 'apiVersion:' in content and 'kind:' in content:
                return True

        except Exception:
            pass

        return False

    async def _validate_manifest_file(self, manifest_file: Path) -> List[ValidationResult]:
        """Validate a single manifest file"""
        results = []

        try:
            with open(manifest_file, 'r') as f:
                content = f.read()

            # Parse YAML documents
            documents = yaml.safe_load_all(content)

            for doc in documents:
                if doc is None:
                    continue

                # Validate individual resource
                result = await self._validate_resource(doc, manifest_file)
                results.append(result)

        except Exception as e:
            # Create error result for file parsing issues
            result = ValidationResult(
                resource_type="file",
                resource_name=str(manifest_file),
                namespace=None,
                valid=False,
                errors=[f"Failed to parse manifest file: {e}"],
                duration_ms=0
            )
            results.append(result)

        return results

    async def _validate_resource(
        self,
        resource: Dict,
        file_path: Path
    ) -> ValidationResult:
        """Validate a single Kubernetes resource"""
        start_time = datetime.now()

        result = ValidationResult(
            resource_type=resource.get('kind', 'Unknown'),
            resource_name=resource.get('metadata', {}).get('name', 'Unknown'),
            namespace=resource.get('metadata', {}).get('namespace'),
            valid=True,
            errors=[],
            warnings=[]
        )

        try:
            # Basic validation
            await self._validate_basic_resource(resource, result)

            # Label validation
            await self._validate_labels(resource, result)

            # Annotation validation
            await self._validate_annotations(resource, result)

            # Namespace validation
            await self._validate_namespace(resource, result)

            # Resource-specific validation
            await self._validate_resource_specific(resource, result)

            # Security validation
            await self._validate_security(resource, result)

            # Image validation
            await self._validate_images(resource, result)

            # Network policy validation
            await self._validate_network_policies(resource, result)

            # Resource limits validation
            await self._validate_resource_limits(resource, result)

            # Kubernetes API validation
            await self._validate_kubernetes_api(resource, result)

        except Exception as e:
            result.valid = False
            result.errors.append(f"Validation error: {e}")

        # Calculate duration
        duration = (datetime.now() - start_time).total_seconds() * 1000
        result.duration_ms = duration

        # Update metrics
        VALIDATION_REQUESTS.labels(result='success' if result.valid else 'failure').inc()

        return result

    async def _validate_basic_resource(self, resource: Dict, result: ValidationResult):
        """Validate basic resource structure"""
        if 'apiVersion' not in resource:
            result.valid = False
            result.errors.append("Missing required field: apiVersion")

        if 'kind' not in resource:
            result.valid = False
            result.errors.append("Missing required field: kind")

        if 'metadata' not in resource:
            result.valid = False
            result.errors.append("Missing required field: metadata")

        if 'name' not in resource.get('metadata', {}):
            result.valid = False
            result.errors.append("Missing required field: metadata.name")

        # Validate resource name
        name = resource.get('metadata', {}).get('name', '')
        if not self._is_valid_resource_name(name):
            result.valid = False
            result.errors.append(f"Invalid resource name: {name}")

    def _is_valid_resource_name(self, name: str) -> bool:
        """Validate Kubernetes resource name format"""
        import re
        pattern = r'^[a-z0-9]([-a-z0-9]*[a-z0-9])?$'
        return bool(re.match(pattern, name)) and len(name) <= 63

    async def _validate_labels(self, resource: Dict, result: ValidationResult):
        """Validate required labels"""
        labels = resource.get('metadata', {}).get('labels', {})

        for required_label in self.validation_rules['required_labels']:
            if required_label not in labels:
                result.warnings.append(f"Missing recommended label: {required_label}")

        # Validate label format
        for label_key, label_value in labels.items():
            if not self._is_valid_label_key(label_key):
                result.warnings.append(f"Invalid label key format: {label_key}")

            if not self._is_valid_label_value(label_value):
                result.warnings.append(f"Invalid label value format: {label_value}")

    def _is_valid_label_key(self, key: str) -> bool:
        """Validate Kubernetes label key format"""
        import re
        pattern = r'^([a-z0-9A-Z]([a-z0-9A-Z\-_.]*[a-z0-9A-Z])?/)?([a-z0-9A-Z]([a-z0-9A-Z\-_.]*[a-z0-9A-Z])?)$'
        return bool(re.match(pattern, key)) and len(key) <= 253

    def _is_valid_label_value(self, value: str) -> bool:
        """Validate Kubernetes label value format"""
        import re
        pattern = r'^([a-z0-9A-Z]([a-z0-9A-Z\-_.]*[a-z0-9A-Z])?)?$'
        return bool(re.match(pattern, value)) and len(value) <= 63

    async def _validate_annotations(self, resource: Dict, result: ValidationResult):
        """Validate required annotations"""
        annotations = resource.get('metadata', {}).get('annotations', {})

        for required_annotation in self.validation_rules['required_annotations']:
            if required_annotation not in annotations:
                result.warnings.append(f"Missing recommended annotation: {required_annotation}")

    async def _validate_namespace(self, resource: Dict, result: ValidationResult):
        """Validate namespace configuration"""
        namespace = resource.get('metadata', {}).get('namespace', 'default')

        # Check namespace patterns
        for env_name, pattern in self.validation_rules['namespace_patterns'].items():
            import re
            if re.match(pattern, namespace):
                result.warnings.append(f"Namespace '{namespace}' matches {env_name} pattern")

        # Validate namespace name format
        if not self._is_valid_resource_name(namespace):
            result.valid = False
            result.errors.append(f"Invalid namespace name: {namespace}")

    async def _validate_resource_specific(self, resource: Dict, result: ValidationResult):
        """Validate resource-specific configuration"""
        kind = resource.get('kind', '').lower()

        if kind == 'deployment':
            await self._validate_deployment(resource, result)
        elif kind == 'service':
            await self._validate_service(resource, result)
        elif kind == 'configmap':
            await self._validate_configmap(resource, result)
        elif kind == 'secret':
            await self._validate_secret(resource, result)
        elif kind == 'ingress':
            await self._validate_ingress(resource, result)
        elif kind == 'statefulset':
            await self._validate_statefulset(resource, result)
        elif kind == 'daemonset':
            await self._validate_daemonset(resource, result)

    async def _validate_deployment(self, resource: Dict, result: ValidationResult):
        """Validate Deployment configuration"""
        spec = resource.get('spec', {})

        # Validate replicas
        replicas = spec.get('replicas', 1)
        limits = self.validation_rules['resource_limits']['deployment']

        if replicas < limits['min_replicas']:
            result.warnings.append(f"Deployment replicas ({replicas}) below minimum ({limits['min_replicas']})")

        if replicas > limits['max_replicas']:
            result.warnings.append(f"Deployment replicas ({replicas}) above maximum ({limits['max_replicas']})")

        # Validate selector
        selector = spec.get('selector', {})
        if not selector.get('matchLabels'):
            result.valid = False
            result.errors.append("Deployment must have selector.matchLabels")

        # Validate template
        template = spec.get('template', {})
        if not template.get('metadata', {}).get('labels'):
            result.valid = False
            result.errors.append("Deployment template must have labels")

        # Check selector match
        template_labels = template.get('metadata', {}).get('labels', {})
        selector_labels = selector.get('matchLabels', {})

        for key, value in selector_labels.items():
            if template_labels.get(key) != value:
                result.valid = False
                result.errors.append(f"Template label '{key}' does not match selector")

    async def _validate_service(self, resource: Dict, result: ValidationResult):
        """Validate Service configuration"""
        spec = resource.get('spec', {})

        # Validate service type
        service_type = spec.get('type', 'ClusterIP')
        if service_type not in ['ClusterIP', 'NodePort', 'LoadBalancer', 'ExternalName']:
            result.warnings.append(f"Unknown service type: {service_type}")

        # Validate ports
        ports = spec.get('ports', [])
        if not ports:
            result.valid = False
            result.errors.append("Service must have at least one port")

        for port in ports:
            if 'port' not in port:
                result.valid = False
                result.errors.append("Service port must specify 'port' field")

    async def _validate_configmap(self, resource: Dict, result: ValidationResult):
        """Validate ConfigMap configuration"""
        data = resource.get('data', {})
        binary_data = resource.get('binaryData', {})

        if not data and not binary_data:
            result.warnings.append("ConfigMap has no data or binaryData")

    async def _validate_secret(self, resource: Dict, result: ValidationResult):
        """Validate Secret configuration"""
        secret_type = resource.get('type', 'Opaque')
        data = resource.get('data', {})

        if secret_type == 'Opaque' and not data:
            result.warnings.append("Secret has no data")

        # Check for common secret types
        if secret_type in ['kubernetes.io/tls'] and 'tls.crt' not in data:
            result.valid = False
            result.errors.append("TLS secret must contain 'tls.crt'")

    async def _validate_ingress(self, resource: Dict, result: ValidationResult):
        """Validate Ingress configuration"""
        spec = resource.get('spec', {})

        if not spec.get('rules'):
            result.warnings.append("Ingress has no rules")

        # Validate TLS configuration
        tls = spec.get('tls', [])
        for tls_config in tls:
            if 'hosts' not in tls_config:
                result.warnings.append("TLS configuration should specify hosts")

    async def _validate_statefulset(self, resource: Dict, result: ValidationResult):
        """Validate StatefulSet configuration"""
        spec = resource.get('spec', {})

        # Validate service name
        service_name = spec.get('serviceName')
        if not service_name:
            result.valid = False
            result.errors.append("StatefulSet must specify serviceName")

        # Validate volume claim templates
        templates = spec.get('volumeClaimTemplates', [])
        for template in templates:
            if not template.get('spec'):
                result.valid = False
                result.errors.append("VolumeClaimTemplate must have spec")

    async def _validate_daemonset(self, resource: Dict, result: ValidationResult):
        """Validate DaemonSet configuration"""
        spec = resource.get('spec', {})

        # Validate selector
        selector = spec.get('selector', {})
        if not selector.get('matchLabels'):
            result.valid = False
            result.errors.append("DaemonSet must have selector.matchLabels")

    async def _validate_security(self, resource: Dict, result: ValidationResult):
        """Validate security configuration"""
        security_policies = self.validation_rules['security_policies']

        # Check for security contexts
        if security_policies['require_security_context']:
            pod_spec = self._get_pod_spec(resource)
            if pod_spec and 'securityContext' not in pod_spec:
                result.warnings.append("Pod should have securityContext")

        # Validate container security contexts
        containers = self._get_containers(resource)
        for container in containers:
            security_context = container.get('securityContext', {})

            if security_policies['forbid_privileged'] and security_context.get('privileged', False):
                result.valid = False
                result.errors.append("Container should not be privileged")

            if security_policies['require_non_root_user']:
                run_as_user = security_context.get('runAsUser')
                if run_as_user is None or run_as_user == 0:
                    result.warnings.append("Container should run as non-root user")

            if security_policies['forbid_host_network'] and security_context.get('hostNetwork', False):
                result.valid = False
                result.errors.append("Container should not use host network")

    def _get_pod_spec(self, resource: Dict) -> Optional[Dict]:
        """Extract pod spec from resource"""
        spec = resource.get('spec', {})

        if resource.get('kind') in ['Deployment', 'DaemonSet', 'StatefulSet', 'Job', 'CronJob']:
            return spec.get('template', {}).get('spec')
        elif resource.get('kind') == 'Pod':
            return spec

        return None

    def _get_containers(self, resource: Dict) -> List[Dict]:
        """Get containers from resource"""
        pod_spec = self._get_pod_spec(resource)
        if pod_spec:
            return pod_spec.get('containers', [])
        return []

    async def _validate_images(self, resource: Dict, result: ValidationResult):
        """Validate container images"""
        image_policies = self.validation_rules['image_policies']
        containers = self._get_containers(resource)

        for container in containers:
            image = container.get('image', '')

            if not image:
                result.valid = False
                result.errors.append("Container must specify image")
                continue

            # Check for latest tag
            if image_policies['forbid_latest_tag'] and image.endswith(':latest'):
                result.warnings.append(f"Container should not use 'latest' tag: {image}")

            # Check image tag requirement
            if image_policies['require_image_tag'] and ':' not in image:
                result.valid = False
                result.errors.append(f"Container image must specify tag: {image}")

            # Check allowed registries
            if image_policies['allowed_registries']:
                registry_ok = False
                for registry in image_policies['allowed_registries']:
                    if image.startswith(registry) or f'/{registry}' in image:
                        registry_ok = True
                        break

                if not registry_ok:
                    result.warnings.append(f"Container image from unapproved registry: {image}")

            # Check image pull policy
            if image_policies['require_image_pull_policy']:
                pull_policy = container.get('imagePullPolicy', 'IfNotPresent')
                if pull_policy == 'Always' and image.endswith(':latest'):
                    result.warnings.append(f"Using 'Always' pull policy with 'latest' tag may cause issues: {image}")

    async def _validate_network_policies(self, resource: Dict, result: ValidationResult):
        """Validate network policy configuration"""
        if resource.get('kind') != 'NetworkPolicy':
            return

        spec = resource.get('spec', {})
        policy_types = spec.get('policyTypes', [])

        # Check for default deny policy
        if self.validation_rules['network_policies']['require_default_deny']:
            if 'Ingress' not in policy_types and 'Egress' not in policy_types:
                result.warnings.append("NetworkPolicy should specify policyTypes")

    async def _validate_resource_limits(self, resource: Dict, result: ValidationResult):
        """Validate resource limits and requests"""
        containers = self._get_containers(resource)

        for container in containers:
            resources = container.get('resources', {})
            requests = resources.get('requests', {})
            limits = resources.get('limits', {})

            # Check for resource requirements
            kind = resource.get('kind', '').lower()
            if kind in self.validation_rules['resource_limits']:
                required_resources = self.validation_rules['resource_limits'][kind]['required_resources']

                for required_resource in required_resources:
                    if required_resource not in requests:
                        result.warnings.append(f"Container should specify resource request for {required_resource}")

                    if required_resource not in limits:
                        result.warnings.append(f"Container should specify resource limit for {required_resource}")

            # Check for limit >= request
            for resource_name in requests:
                if resource_name in limits:
                    request_value = self._parse_resource_value(requests[resource_name])
                    limit_value = self._parse_resource_value(limits[resource_name])

                    if request_value > limit_value:
                        result.valid = False
                        result.errors.append(f"Resource request ({requests[resource_name]}) exceeds limit ({limits[resource_name]})")

    def _parse_resource_value(self, value: str) -> float:
        """Parse Kubernetes resource value to numeric"""
        if value.endswith('m'):
            return float(value[:-1]) / 1000
        elif value.endswith('Ki'):
            return float(value[:-2]) * 1024
        elif value.endswith('Mi'):
            return float(value[:-2]) * 1024 * 1024
        elif value.endswith('Gi'):
            return float(value[:-2]) * 1024 * 1024 * 1024
        else:
            return float(value)

    async def _validate_kubernetes_api(self, resource: Dict, result: ValidationResult):
        """Validate resource against Kubernetes API"""
        try:
            # Try to create the resource using dry-run
            api_version = resource.get('apiVersion')
            kind = resource.get('kind')
            name = resource.get('metadata', {}).get('name')
            namespace = resource.get('metadata', {}).get('namespace', 'default')

            if api_version and kind and name:
                # Validate API version
                if not self._is_valid_api_version(api_version, kind):
                    result.warnings.append(f"Potentially invalid API version: {apiVersion} for {kind}")

        except Exception as e:
            result.warnings.append(f"Kubernetes API validation failed: {e}")

    def _is_valid_api_version(self, api_version: str, kind: str) -> bool:
        """Check if API version is valid for the kind"""
        # This is a simplified check - in a real implementation,
        # you would query the Kubernetes API for available resources
        known_versions = {
            'v1': ['Pod', 'Service', 'Namespace', 'ConfigMap', 'Secret', 'PersistentVolume', 'PersistentVolumeClaim'],
            'apps/v1': ['Deployment', 'StatefulSet', 'DaemonSet', 'ReplicaSet'],
            'networking.k8s.io/v1': ['Ingress', 'NetworkPolicy'],
            'batch/v1': ['Job', 'CronJob'],
            'rbac.authorization.k8s.io/v1': ['Role', 'ClusterRole', 'RoleBinding', 'ClusterRoleBinding'],
        }

        group, version = api_version.split('/', 1) if '/' in api_version else ('', api_version)

        for api_group, kinds in known_versions.items():
            if api_group == api_version and kind in kinds:
                return True

        # If not in known versions, assume it might be valid (could be CRD)
        return True


# FastAPI application for HTTP endpoints
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

app = FastAPI(
    title="Configuration Validator API",
    description="API for validating Kubernetes configurations in GitOps workflows",
    version="1.0.0"
)

validator = None

class ValidationRequest(BaseModel):
    repository_url: str = Field(..., description="Git repository URL")
    commit_hash: Optional[str] = Field(None, description="Specific commit hash to validate")
    branch: str = Field("main", description="Git branch to validate")

class ValidationResponse(BaseModel):
    success: bool
    report: Optional[Dict] = None
    message: str
    timestamp: str

@app.on_event("startup")
async def startup_event():
    global validator
    validator = ConfigurationValidator()

    # Start Prometheus metrics server
    start_http_server(8081)
    logger.info("Configuration validator started")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

@app.get("/ready")
async def ready_check():
    """Ready check endpoint"""
    try:
        if validator and validator.k8s_client:
            return {"status": "ready", "timestamp": datetime.utcnow().isoformat()}
        else:
            return {"status": "not_ready", "timestamp": datetime.utcnow().isoformat()}
    except Exception:
        return {"status": "not_ready", "timestamp": datetime.utcnow().isoformat()}

@app.post("/validate", response_model=ValidationResponse)
async def validate_configuration(
    request: ValidationRequest,
    background_tasks: BackgroundTasks
):
    """Validate repository configuration"""
    if not validator:
        raise HTTPException(status_code=503, detail="Validator not initialized")

    try:
        with VALIDATION_DURATION.time():
            with ACTIVE_VALIDATIONS.track_inprogress():
                report = await validator.validate_repository(
                    repository_url=request.repository_url,
                    commit_hash=request.commit_hash,
                    branch=request.branch
                )

                # Convert to dict for JSON response
                report_dict = report.dict()

                # Convert datetime objects to strings
                report_dict['timestamp'] = report.timestamp.isoformat()
                for result in report_dict['results']:
                    result['timestamp'] = result['timestamp'].isoformat()

                success = report.errors_total == 0
                message = "Validation completed successfully" if success else "Validation completed with errors"

                # Send notification if validation failed
                if not success:
                    background_tasks.add_task(
                        send_validation_notification,
                        request.repository_url,
                        report.errors_total,
                        report.warnings_total
                    )

                return ValidationResponse(
                    success=success,
                    report=report_dict,
                    message=message,
                    timestamp=datetime.utcnow().isoformat()
                )

    except Exception as e:
        logger.error(f"Validation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/rules")
async def get_validation_rules():
    """Get current validation rules"""
    if not validator:
        raise HTTPException(status_code=503, detail="Validator not initialized")

    return validator.validation_rules

@app.post("/rules")
async def update_validation_rules(rules: Dict):
    """Update validation rules"""
    if not validator:
        raise HTTPException(status_code=503, detail="Validator not initialized")

    try:
        validator.validation_rules.update(rules)
        return {"message": "Validation rules updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/metrics")
async def get_metrics():
    """Get validation metrics"""
    return {
        "validation_requests_total": VALIDATION_REQUESTS._value.get(),
        "active_validations": ACTIVE_VALIDATIONS._value.get()
    }


async def send_validation_notification(
    repository_url: str,
    errors: int,
    warnings: int
):
    """Send validation failure notification"""
    try:
        # This would integrate with your notification system
        # For example, send to Slack, PagerDuty, etc.
        logger.warning(f"Validation failed for {repository_url}: {errors} errors, {warnings} warnings")

        # Placeholder for notification implementation
        # await send_slack_notification(f"Configuration validation failed for {repository_url}")

    except Exception as e:
        logger.error(f"Failed to send notification: {e}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "config_validator:app",
        host="0.0.0.0",
        port=8080,
        reload=False,
        access_log=True
    )