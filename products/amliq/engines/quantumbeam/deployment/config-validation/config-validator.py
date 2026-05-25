#!/usr/bin/env python3
"""
Configuration Validation and Drift Detection System

This comprehensive system provides:
- Kubernetes manifest validation against security policies
- Configuration drift detection between environments
- Policy-as-code implementation with OPA/Gatekeeper integration
- Automated remediation recommendations
- Real-time compliance monitoring
- Integration with GitOps workflows
- Security best practices enforcement
"""

import asyncio
import json
import logging
import os
import time
import hashlib
import yaml
import argparse
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple, Set
from pathlib import Path
from dataclasses import dataclass, field
from enum import Enum
import subprocess
import kubernetes
from kubernetes import client, config
import aiohttp
import jwt
from prometheus_client import Counter, Histogram, Gauge, start_http_server
import boto3
from botocore.exceptions import ClientError
import docker
from docker.errors import APIError

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class PolicySeverity(Enum):
    """Policy violation severity levels"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"

class DriftType(Enum):
    """Configuration drift types"""
    SECURITY = "security"
    RESOURCE = "resource"
    NETWORK = "network"
    STORAGE = "storage"
    PERMISSION = "permission"
    CONFIGURATION = "configuration"

@dataclass
class ValidationResult:
    """Configuration validation result"""
    valid: bool
    severity: PolicySeverity
    policy: str
    description: str
    category: str
    remediation: str
    location: str
    resource_name: str
    resource_type: str
    namespace: Optional[str] = None
    timestamp: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class DriftResult:
    """Configuration drift detection result"""
    drift_detected: bool
    drift_type: DriftType
    source_environment: str
    target_environment: str
    resource_name: str
    resource_type: str
    namespace: Optional[str]
    source_value: Any
    target_value: Any
    description: str
    severity: PolicySeverity
    remediation: str
    timestamp: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class PolicyDefinition:
    """Policy definition for validation"""
    name: str
    category: str
    severity: PolicySeverity
    description: str
    rule: str
    remediation: str
    enabled: bool = True
    auto_remediate: bool = False
    environments: List[str] = field(default_factory=lambda: ["production", "staging", "development"])

# Prometheus metrics
validation_total = Counter('config_validations_total', 'Total configuration validations', ['result', 'severity', 'policy'])
validation_duration = Histogram('config_validation_duration_seconds', 'Configuration validation duration')
drift_detections_total = Counter('drift_detections_total', 'Total drift detections', ['drift_type', 'severity'])
drift_resolution_duration = Histogram('drift_resolution_duration_seconds', 'Drift resolution duration')
compliance_score = Gauge('configuration_compliance_score', 'Configuration compliance score percentage')
policy_violations_active = Gauge('policy_violations_active_total', 'Active policy violations by severity', ['severity'])

class ConfigurationManager:
    """Manages configuration validation and drift detection"""

    def __init__(self, config_file: str = None):
        """Initialize the configuration manager"""
        self.config = self._load_config(config_file)
        self.policies: Dict[str, PolicyDefinition] = {}
        self.last_validation: Dict[str, datetime] = {}
        self.last_drift_check: Dict[str, datetime] = {}
        self.violations: Dict[str, List[ValidationResult]] = {}
        self.drift_cache: Dict[str, List[DriftResult]] = {}

        # Initialize clients
        self.k8s_clients: Dict[str, kubernetes.client.ApiClient] = {}
        self.docker_client = None
        self.s3_client = None

        self._init_clients()
        self._load_policies()

        logger.info("Configuration Manager initialized")

    def _load_config(self, config_file: str) -> Dict[str, Any]:
        """Load configuration from file"""
        default_config = {
            "validation": {
                "interval": 300,  # 5 minutes
                "parallel_checks": 10,
                "timeout": 30,
                "retry_count": 3
            },
            "drift_detection": {
                "interval": 600,  # 10 minutes
                "comparison_environments": ["production", "staging"],
                "ignore_fields": ["metadata.managedFields", "status", "metadata.creationTimestamp"],
                "drift_threshold": 0.1
            },
            "policies": {
                "policy_directory": "policies",
                "opa_server": "http://opa:8181",
                "gatekeeper_enabled": True
            },
            "remediation": {
                "auto_remediate": False,
                "dry_run": True,
                "approval_required": True,
                "remediation_timeout": 300
            },
            "storage": {
                "s3_bucket": "quantumbeam-config-backup",
                "local_path": "/var/lib/config-manager",
                "retention_days": 90
            },
            "environments": {
                "production": {
                    "kubeconfig": "/etc/kubeconfig-prod",
                    "cluster": "prod-cluster",
                    "region": "us-east-1"
                },
                "staging": {
                    "kubeconfig": "/etc/kubeconfig-staging",
                    "cluster": "staging-cluster",
                    "region": "us-east-1"
                },
                "development": {
                    "kubeconfig": "/etc/kubeconfig-dev",
                    "cluster": "dev-cluster",
                    "region": "us-west-2"
                }
            },
            "reporting": {
                "slack_webhook": os.getenv("SLACK_WEBHOOK"),
                "pagerduty_key": os.getenv("PAGERDUTY_KEY"),
                "email_enabled": True
            },
            "logging": {
                "level": "INFO",
                "format": "json",
                "audit_enabled": True
            }
        }

        if config_file and os.path.exists(config_file):
            with open(config_file, 'r') as f:
                user_config = yaml.safe_load(f)
                # Merge with default config
                default_config.update(user_config)

        return default_config

    def _init_clients(self):
        """Initialize API clients"""
        # Initialize Kubernetes clients for all environments
        for env_name, env_config in self.config["environments"].items():
            try:
                kubeconfig_path = env_config.get("kubeconfig")
                if kubeconfig_path and os.path.exists(kubeconfig_path):
                    config.load_kube_config(config_file=kubeconfig_path)
                else:
                    config.load_incluster_config()

                self.k8s_clients[env_name] = kubernetes.client.ApiClient()
                logger.info(f"Initialized Kubernetes client for {env_name}")

            except Exception as e:
                logger.error(f"Failed to initialize K8s client for {env_name}: {e}")

        # Initialize Docker client
        try:
            self.docker_client = docker.from_env()
            logger.info("Docker client initialized")
        except Exception as e:
            logger.warning(f"Failed to initialize Docker client: {e}")

        # Initialize S3 client
        try:
            self.s3_client = boto3.client('s3')
            logger.info("S3 client initialized")
        except Exception as e:
            logger.warning(f"Failed to initialize S3 client: {e}")

    def _load_policies(self):
        """Load validation policies"""
        policies_dir = self.config["policies"]["policy_directory"]

        # Default built-in policies
        default_policies = {
            "security-context": PolicyDefinition(
                name="security-context",
                category="security",
                severity=PolicySeverity.ERROR,
                description="Pods must have security context configured",
                rule="spec.securityContext != null OR spec.containers[*].securityContext != null",
                remediation="Add securityContext to pod spec or container spec with appropriate settings"
            ),
            "readiness-probe": PolicyDefinition(
                name="readiness-probe",
                category="availability",
                severity=PolicySeverity.WARNING,
                description="Containers should have readiness probes",
                rule="spec.containers[*].readinessProbe != null",
                remediation="Add readinessProbe to container configuration"
            ),
            "liveness-probe": PolicyDefinition(
                name="liveness-probe",
                category="availability",
                severity=PolicySeverity.WARNING,
                description="Containers should have liveness probes",
                rule="spec.containers[*].livenessProbe != null",
                remediation="Add livenessProbe to container configuration"
            ),
            "resource-limits": PolicyDefinition(
                name="resource-limits",
                category="resource",
                severity=PolicySeverity.ERROR,
                description="Containers must have resource limits",
                rule="spec.containers[*].resources.limits != null",
                remediation="Add resource limits to container configuration"
            ),
            "resource-requests": PolicyDefinition(
                name="resource-requests",
                category="resource",
                severity=PolicySeverity.WARNING,
                description="Containers should have resource requests",
                rule="spec.containers[*].resources.requests != null",
                remediation="Add resource requests to container configuration"
            ),
            "non-root-user": PolicyDefinition(
                name="non-root-user",
                category="security",
                severity=PolicySeverity.ERROR,
                description="Containers should not run as root",
                rule="spec.securityContext.runAsNonRoot == true OR spec.containers[*].securityContext.runAsNonRoot == true",
                remediation="Set runAsNonRoot: true in securityContext"
            ),
            "drop-capabilities": PolicyDefinition(
                name="drop-capabilities",
                category="security",
                severity=PolicySeverity.WARNING,
                description="Containers should drop all capabilities",
                rule="spec.containers[*].securityContext.capabilities.drop == ['ALL']",
                remediation="Add capabilities.drop: ['ALL'] to securityContext"
            ),
            "read-only-filesystem": PolicyDefinition(
                name="read-only-filesystem",
                category="security",
                severity=PolicySeverity.WARNING,
                description="Containers should use read-only root filesystem",
                rule="spec.containers[*].securityContext.readOnlyRootFilesystem == true",
                remediation="Set readOnlyRootFilesystem: true in securityContext"
            ),
            "latest-tag": PolicyDefinition(
                name="latest-tag",
                category="security",
                severity=PolicySeverity.WARNING,
                description="Container images should not use 'latest' tag",
                rule="spec.containers[*].image !contains ':latest'",
                remediation="Use specific image tag instead of 'latest'"
            ),
            "namespace-quota": PolicyDefinition(
                name="namespace-quota",
                category="resource",
                severity=PolicySeverity.WARNING,
                description="Namespaces should have resource quotas",
                rule="kind == 'ResourceQuota'",
                remediation="Create ResourceQuota for namespace"
            ),
            "network-policy": PolicyDefinition(
                name="network-policy",
                category="network",
                severity=PolicySeverity.WARNING,
                description="Namespaces should have network policies",
                rule="kind == 'NetworkPolicy'",
                remediation="Create NetworkPolicy for namespace"
            ),
            "rbac-enabled": PolicyDefinition(
                name="rbac-enabled",
                category="security",
                severity=PolicySeverity.ERROR,
                description="RBAC should be enabled and configured",
                rule="kind == 'Role' OR kind == 'ClusterRole' OR kind == 'RoleBinding' OR kind == 'ClusterRoleBinding'",
                remediation="Configure proper RBAC rules"
            ),
            "pod-disruption-budget": PolicyDefinition(
                name="pod-disruption-budget",
                category="availability",
                severity=PolicySeverity.INFO,
                description="Deployments should have pod disruption budgets",
                rule="kind == 'PodDisruptionBudget'",
                remediation="Create PodDisruptionBudget for high-availability applications"
            ),
            "horizontal-pod-autoscaler": PolicyDefinition(
                name="horizontal-pod-autoscaler",
                category="scalability",
                severity=PolicySeverity.INFO,
                description="Deployments should have HPA configured",
                rule="kind == 'HorizontalPodAutoscaler'",
                remediation="Create HorizontalPodAutoscaler for automatic scaling"
            ),
            "ssl-tls-only": PolicyDefinition(
                name="ssl-tls-only",
                category="security",
                severity=PolicySeverity.ERROR,
                description="Ingress resources should enforce TLS",
                rule="spec.tls != null",
                remediation="Add TLS configuration to Ingress"
            ),
            "no-secrets-as-env": PolicyDefinition(
                name="no-secrets-as-env",
                category="security",
                severity=PolicySeverity.WARNING,
                description="Avoid using secrets as environment variables",
                rule="spec.containers[*].envFrom[*].secretRef == null AND spec.containers[*].env[*].valueFrom.secretKeyRef == null",
                remediation="Use mounted secrets instead of environment variables"
            ),
            "image-pull-policy": PolicyDefinition(
                name="image-pull-policy",
                category="security",
                severity=PolicySeverity.INFO,
                description="Production containers should use specific image pull policy",
                rule="spec.containers[*].imagePullPolicy == 'IfNotPresent' OR spec.containers[*].imagePullPolicy == 'Always'",
                remediation="Set appropriate imagePullPolicy"
            ),
            "node-selector": PolicyDefinition(
                name="node-selector",
                category="scheduling",
                severity=PolicySeverity.INFO,
                description="Pods should have appropriate node selection",
                rule="spec.nodeSelector != null OR spec.affinity != null",
                remediation="Add nodeSelector or affinity rules"
            ),
            "anti-affinity": PolicyDefinition(
                name="anti-affinity",
                category="availability",
                severity=PolicySeverity.INFO,
                description="Multi-replica deployments should have pod anti-affinity",
                rule="spec.affinity.podAntiAffinity != null",
                remediation="Configure pod anti-affinity rules"
            )
        }

        self.policies.update(default_policies)

        # Load custom policies from directory
        if os.path.exists(policies_dir):
            for policy_file in Path(policies_dir).glob("*.yaml"):
                try:
                    with open(policy_file, 'r') as f:
                        policy_data = yaml.safe_load(f)

                    policy = PolicyDefinition(
                        name=policy_data.get("name", policy_file.stem),
                        category=policy_data.get("category", "custom"),
                        severity=PolicySeverity(policy_data.get("severity", "warning")),
                        description=policy_data.get("description", ""),
                        rule=policy_data.get("rule", ""),
                        remediation=policy_data.get("remediation", ""),
                        enabled=policy_data.get("enabled", True),
                        auto_remediate=policy_data.get("auto_remediate", False),
                        environments=policy_data.get("environments", ["production", "staging", "development"])
                    )

                    self.policies[policy.name] = policy
                    logger.info(f"Loaded custom policy: {policy.name}")

                except Exception as e:
                    logger.error(f"Failed to load policy from {policy_file}: {e}")

        logger.info(f"Loaded {len(self.policies)} policies")

    async def validate_all_environments(self):
        """Validate all configured environments"""
        tasks = []
        for env_name in self.config["environments"]:
            task = self.validate_environment(env_name)
            tasks.append(task)

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def validate_environment(self, environment: str) -> Dict[str, Any]:
        """Validate all resources in an environment"""
        if environment not in self.k8s_clients:
            logger.error(f"No Kubernetes client for environment: {environment}")
            return {"valid": False, "errors": [f"No client for {environment}"]}

        logger.info(f"Starting validation for environment: {environment}")

        results = []
        violations = []

        try:
            # Get all namespaces
            v1 = client.CoreV1Api(self.k8s_clients[environment])
            namespaces = v1.list_namespace()

            for ns in namespaces.items:
                ns_name = ns.metadata.name
                logger.info(f"Validating namespace: {ns_name}")

                # Validate all resource types
                resource_types = [
                    ("pods", v1.list_namespaced_pod),
                    ("deployments", client.AppsV1Api(self.k8s_clients[environment]).list_namespaced_deployment),
                    ("services", v1.list_namespaced_service),
                    ("configmaps", v1.list_namespaced_config_map),
                    ("secrets", v1.list_namespaced_secret),
                    ("ingresses", client.NetworkingV1Api(self.k8s_clients[environment]).list_namespaced_ingress),
                    ("statefulsets", client.AppsV1Api(self.k8s_clients[environment]).list_namespaced_stateful_set),
                    ("daemonsets", client.AppsV1Api(self.k8s_clients[environment]).list_namespaced_daemon_set),
                    ("jobs", client.BatchV1Api(self.k8s_clients[environment]).list_namespaced_job),
                    ("cronjobs", client.BatchV1Api(self.k8s_clients[environment]).list_namespaced_cron_job)
                ]

                for resource_type, list_func in resource_types:
                    try:
                        resources = list_func(namespace=ns_name)

                        for resource in resources.items:
                            validation_result = await self.validate_resource(
                                environment, resource, resource_type, ns_name
                            )

                            if validation_result:
                                results.append(validation_result)

                                if not validation_result.valid:
                                    violations.append(validation_result)

                    except Exception as e:
                        logger.warning(f"Failed to validate {resource_type} in {ns_name}: {e}")

            # Store violations
            self.violations[environment] = violations
            self.last_validation[environment] = datetime.now()

            # Update metrics
            valid_count = sum(1 for r in results if r.valid)
            total_count = len(results)
            compliance_score_value = (valid_count / total_count * 100) if total_count > 0 else 100

            compliance_score.set(compliance_score_value)

            # Update violation metrics
            severity_counts = {}
            for violation in violations:
                severity_counts[violation.severity.value] = severity_counts.get(violation.severity.value, 0) + 1

            for severity, count in severity_counts.items():
                policy_violations_active.labels(severity=severity).set(count)

            # Report results
            await self._report_validation_results(environment, results, violations)

            logger.info(f"Validation completed for {environment}: {valid_count}/{total_count} compliant ({compliance_score_value:.1f}%)")

            return {
                "environment": environment,
                "valid": len(violations) == 0,
                "total_resources": total_count,
                "compliant_resources": valid_count,
                "violations": len(violations),
                "compliance_score": compliance_score_value,
                "timestamp": datetime.now().isoformat()
            }

        except Exception as e:
            logger.error(f"Failed to validate environment {environment}: {e}")
            return {
                "environment": environment,
                "valid": False,
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }

    async def validate_resource(self, environment: str, resource: Any,
                              resource_type: str, namespace: str) -> Optional[ValidationResult]:
        """Validate a single resource against all policies"""
        resource_name = resource.metadata.name

        # Convert resource to dictionary for policy evaluation
        resource_dict = self._resource_to_dict(resource)

        for policy_name, policy in self.policies.items():
            if not policy.enabled or environment not in policy.environments:
                continue

            try:
                # Evaluate policy against resource
                result = await self._evaluate_policy(policy, resource_dict, environment,
                                                   resource_type, resource_name, namespace)

                if result:
                    validation_total.labels(
                        result="pass" if result.valid else "fail",
                        severity=policy.severity.value,
                        policy=policy_name
                    ).inc()

                    return result

            except Exception as e:
                logger.error(f"Failed to evaluate policy {policy_name} on {resource_name}: {e}")

        return None

    def _resource_to_dict(self, resource: Any) -> Dict[str, Any]:
        """Convert Kubernetes resource to dictionary"""
        try:
            # Use the Kubernetes client's to_dict method
            if hasattr(resource, 'to_dict'):
                return resource.to_dict()
            else:
                # Fallback to custom serialization
                return {
                    "apiVersion": resource.api_version,
                    "kind": resource.kind,
                    "metadata": {
                        "name": resource.metadata.name,
                        "namespace": getattr(resource.metadata, 'namespace', None),
                        "labels": getattr(resource.metadata, 'labels', {}),
                        "annotations": getattr(resource.metadata, 'annotations', {})
                    },
                    "spec": getattr(resource, 'spec', {}),
                    "status": getattr(resource, 'status', {})
                }
        except Exception as e:
            logger.error(f"Failed to convert resource to dict: {e}")
            return {}

    async def _evaluate_policy(self, policy: PolicyDefinition, resource: Dict[str, Any],
                             environment: str, resource_type: str, resource_name: str,
                             namespace: str) -> Optional[ValidationResult]:
        """Evaluate a policy against a resource"""
        # For this implementation, we'll use simple rule evaluation
        # In a real implementation, you would use OPA or a more sophisticated policy engine

        rule = policy.rule

        # Simple rule evaluation (this is a simplified version)
        result = self._evaluate_simple_rule(rule, resource, resource_type)

        if result is None:
            return None

        return ValidationResult(
            valid=result,
            severity=policy.severity,
            policy=policy.name,
            description=policy.description,
            category=policy.category,
            remediation=policy.remediation,
            location=f"{environment}/{namespace}/{resource_type}/{resource_name}",
            resource_name=resource_name,
            resource_type=resource_type,
            namespace=namespace
        )

    def _evaluate_simple_rule(self, rule: str, resource: Dict[str, Any], resource_type: str) -> Optional[bool]:
        """Evaluate a simple policy rule (simplified implementation)"""
        # This is a simplified rule evaluator for demonstration
        # In production, you would use OPA or a proper policy engine

        spec = resource.get("spec", {})

        # Common rule evaluations
        if "securityContext != null" in rule:
            return spec.get("securityContext") is not None

        elif "spec.containers[*].securityContext != null" in rule:
            containers = spec.get("containers", [])
            for container in containers:
                if container.get("securityContext") is not None:
                    return True
            return False

        elif "spec.containers[*].readinessProbe != null" in rule:
            containers = spec.get("containers", [])
            for container in containers:
                if container.get("readinessProbe") is not None:
                    return True
            return False

        elif "spec.containers[*].livenessProbe != null" in rule:
            containers = spec.get("containers", [])
            for container in containers:
                if container.get("livenessProbe") is not None:
                    return True
            return False

        elif "spec.containers[*].resources.limits != null" in rule:
            containers = spec.get("containers", [])
            for container in containers:
                if container.get("resources", {}).get("limits") is not None:
                    return True
            return False

        elif "spec.containers[*].resources.requests != null" in rule:
            containers = spec.get("containers", [])
            for container in containers:
                if container.get("resources", {}).get("requests") is not None:
                    return True
            return False

        elif "spec.containers[*].image !contains ':latest'" in rule:
            containers = spec.get("containers", [])
            for container in containers:
                image = container.get("image", "")
                if ":latest" in image:
                    return False
            return True

        elif "spec.tls != null" in rule:
            return spec.get("tls") is not None

        # Default to passing if rule can't be evaluated
        return True

    async def detect_drift_all_environments(self):
        """Detect drift between all environment pairs"""
        environments = self.config["drift_detection"]["comparison_environments"]

        for i in range(len(environments)):
            for j in range(i + 1, len(environments)):
                source_env = environments[i]
                target_env = environments[j]

                await self.detect_environment_drift(source_env, target_env)

    async def detect_environment_drift(self, source_env: str, target_env: str):
        """Detect drift between two environments"""
        if source_env not in self.k8s_clients or target_env not in self.k8s_clients:
            logger.warning(f"Missing Kubernetes clients for drift detection: {source_env} -> {target_env}")
            return

        logger.info(f"Detecting drift from {source_env} to {target_env}")

        drift_results = []

        try:
            # Get resource configurations from both environments
            source_resources = await self._get_environment_resources(source_env)
            target_resources = await self._get_environment_resources(target_env)

            # Compare resources
            for resource_key, source_config in source_resources.items():
                if resource_key in target_resources:
                    target_config = target_resources[resource_key]

                    # Detect drift
                    drift_result = await self._compare_resources(
                        source_env, target_env, source_config, target_config, resource_key
                    )

                    if drift_result:
                        drift_results.append(drift_result)

            # Store drift results
            drift_cache_key = f"{source_env}->{target_env}"
            self.drift_cache[drift_cache_key] = drift_results
            self.last_drift_check[drift_cache_key] = datetime.now()

            # Update metrics
            for drift in drift_results:
                drift_detections_total.labels(
                    drift_type=drift.drift_type.value,
                    severity=drift.severity.value
                ).inc()

            # Report drift
            await self._report_drift_results(source_env, target_env, drift_results)

            logger.info(f"Drift detection completed: {source_env} -> {target_env}, found {len(drift_results)} drifts")

        except Exception as e:
            logger.error(f"Failed to detect drift between {source_env} and {target_env}: {e}")

    async def _get_environment_resources(self, environment: str) -> Dict[str, Dict[str, Any]]:
        """Get all resources from an environment"""
        resources = {}

        try:
            v1 = client.CoreV1Api(self.k8s_clients[environment])
            namespaces = v1.list_namespace()

            for ns in namespaces.items:
                ns_name = ns.metadata.name

                # Get different resource types
                resource_types = [
                    ("deployments", client.AppsV1Api(self.k8s_clients[environment])),
                    ("services", v1),
                    ("configmaps", v1),
                    ("secrets", v1)  # Only check for existence, not content
                ]

                for resource_type, api_client in resource_types:
                    try:
                        if resource_type == "deployments":
                            items = api_client.list_namespaced_deployment(namespace=ns_name).items
                        elif resource_type == "services":
                            items = api_client.list_namespaced_service(namespace=ns_name).items
                        elif resource_type == "configmaps":
                            items = api_client.list_namespaced_config_map(namespace=ns_name).items
                        elif resource_type == "secrets":
                            items = api_client.list_namespaced_secret(namespace=ns_name).items

                        for item in items:
                            resource_key = f"{ns_name}/{resource_type}/{item.metadata.name}"

                            # Convert to dictionary and exclude ignored fields
                            resource_dict = self._resource_to_dict(item)
                            resource_dict = self._filter_resource_config(resource_dict)

                            resources[resource_key] = {
                                "config": resource_dict,
                                "type": resource_type,
                                "namespace": ns_name,
                                "name": item.metadata.name
                            }

                    except Exception as e:
                        logger.warning(f"Failed to get {resource_type} from {ns_name}: {e}")

        except Exception as e:
            logger.error(f"Failed to get resources from {environment}: {e}")

        return resources

    def _filter_resource_config(self, resource_dict: Dict[str, Any]) -> Dict[str, Any]:
        """Filter out ignored fields from resource configuration"""
        ignore_fields = self.config["drift_detection"]["ignore_fields"]

        def remove_ignored_fields(obj: Any, path: str = ""):
            if isinstance(obj, dict):
                filtered = {}
                for key, value in obj.items():
                    current_path = f"{path}.{key}" if path else key
                    if current_path not in ignore_fields:
                        filtered[key] = remove_ignored_fields(value, current_path)
                return filtered
            elif isinstance(obj, list):
                return [remove_ignored_fields(item, path) for item in obj]
            else:
                return obj

        return remove_ignored_fields(resource_dict)

    async def _compare_resources(self, source_env: str, target_env: str,
                               source_config: Dict[str, Any], target_config: Dict[str, Any],
                               resource_key: str) -> Optional[DriftResult]:
        """Compare two resources and detect drift"""
        source_data = source_config["config"]
        target_data = target_config["config"]

        # Calculate configuration hash
        source_hash = self._calculate_config_hash(source_data)
        target_hash = self._calculate_config_hash(target_data)

        if source_hash == target_hash:
            return None

        # Detect specific drift types
        drift_results = []

        # Security drift
        security_drift = self._detect_security_drift(source_data, target_data)
        if security_drift:
            drift_results.append(security_drift)

        # Resource drift
        resource_drift = self._detect_resource_drift(source_data, target_data)
        if resource_drift:
            drift_results.append(resource_drift)

        # Network drift
        network_drift = self._detect_network_drift(source_data, target_data)
        if network_drift:
            drift_results.append(network_drift)

        # Configuration drift
        config_drift = self._detect_config_drift(source_data, target_data)
        if config_drift:
            drift_results.append(config_drift)

        # Return the most severe drift
        if drift_results:
            return max(drift_results, key=lambda d: self._severity_priority(d.severity))

        return None

    def _calculate_config_hash(self, config: Dict[str, Any]) -> str:
        """Calculate hash of configuration"""
        config_str = json.dumps(config, sort_keys=True, default=str)
        return hashlib.md5(config_str.encode()).hexdigest()

    def _detect_security_drift(self, source_data: Dict[str, Any], target_data: Dict[str, Any]) -> Optional[DriftResult]:
        """Detect security-related drift"""
        source_spec = source_data.get("spec", {})
        target_spec = target_data.get("spec", {})

        # Check security context drift
        source_security_context = source_spec.get("securityContext", {})
        target_security_context = target_spec.get("securityContext", {})

        if source_security_context != target_security_context:
            return DriftResult(
                drift_detected=True,
                drift_type=DriftType.SECURITY,
                source_environment="source",
                target_environment="target",
                resource_name=target_data.get("metadata", {}).get("name", ""),
                resource_type=source_data.get("kind", ""),
                namespace=target_data.get("metadata", {}).get("namespace"),
                source_value=source_security_context,
                target_value=target_security_context,
                description="Security context configuration has drifted",
                severity=PolicySeverity.ERROR,
                remediation="Align security context configurations between environments"
            )

        return None

    def _detect_resource_drift(self, source_data: Dict[str, Any], target_data: Dict[str, Any]) -> Optional[DriftResult]:
        """Detect resource-related drift"""
        source_spec = source_data.get("spec", {})
        target_spec = target_data.get("spec", {})

        # Check resource requests/limits drift
        source_containers = source_spec.get("containers", [])
        target_containers = target_spec.get("containers", [])

        if len(source_containers) != len(target_containers):
            return DriftResult(
                drift_detected=True,
                drift_type=DriftType.RESOURCE,
                source_environment="source",
                target_environment="target",
                resource_name=target_data.get("metadata", {}).get("name", ""),
                resource_type=source_data.get("kind", ""),
                namespace=target_data.get("metadata", {}).get("namespace"),
                source_value=len(source_containers),
                target_value=len(target_containers),
                description="Container count has drifted",
                severity=PolicySeverity.WARNING,
                remediation="Align container configurations between environments"
            )

        return None

    def _detect_network_drift(self, source_data: Dict[str, Any], target_data: Dict[str, Any]) -> Optional[DriftResult]:
        """Detect network-related drift"""
        source_spec = source_data.get("spec", {})
        target_spec = target_data.get("spec", {})

        # Check service configuration drift
        if source_data.get("kind") == "Service":
            source_ports = source_spec.get("ports", [])
            target_ports = target_spec.get("ports", [])

            if source_ports != target_ports:
                return DriftResult(
                    drift_detected=True,
                    drift_type=DriftType.NETWORK,
                    source_environment="source",
                    target_environment="target",
                    resource_name=target_data.get("metadata", {}).get("name", ""),
                    resource_type="Service",
                    namespace=target_data.get("metadata", {}).get("namespace"),
                    source_value=source_ports,
                    target_value=target_ports,
                    description="Service port configuration has drifted",
                    severity=PolicySeverity.WARNING,
                    remediation="Align service configurations between environments"
                )

        return None

    def _detect_config_drift(self, source_data: Dict[str, Any], target_data: Dict[str, Any]) -> Optional[DriftResult]:
        """Detect general configuration drift"""
        # This catches any other configuration changes
        return DriftResult(
            drift_detected=True,
            drift_type=DriftType.CONFIGURATION,
            source_environment="source",
            target_environment="target",
            resource_name=target_data.get("metadata", {}).get("name", ""),
            resource_type=source_data.get("kind", ""),
            namespace=target_data.get("metadata", {}).get("namespace"),
            source_value="various",
            target_value="various",
            description="General configuration drift detected",
            severity=PolicySeverity.INFO,
            remediation="Review and align configurations between environments"
        )

    def _severity_priority(self, severity: PolicySeverity) -> int:
        """Get priority for severity levels"""
        priorities = {
            PolicySeverity.CRITICAL: 4,
            PolicySeverity.ERROR: 3,
            PolicySeverity.WARNING: 2,
            PolicySeverity.INFO: 1
        }
        return priorities.get(severity, 0)

    async def _report_validation_results(self, environment: str, results: List[ValidationResult], violations: List[ValidationResult]):
        """Report validation results"""
        if not violations:
            return

        # Group violations by severity
        severity_groups = {}
        for violation in violations:
            severity = violation.severity.value
            if severity not in severity_groups:
                severity_groups[severity] = []
            severity_groups[severity].append(violation)

        # Send notifications
        webhook_url = self.config["reporting"]["slack_webhook"]
        if webhook_url and any(sev in ["critical", "error"] for sev in severity_groups.keys()):
            await self._send_slack_alert(environment, severity_groups, "validation")

    async def _report_drift_results(self, source_env: str, target_env: str, drift_results: List[DriftResult]):
        """Report drift detection results"""
        if not drift_results:
            return

        # Group drift by severity
        severity_groups = {}
        for drift in drift_results:
            severity = drift.severity.value
            if severity not in severity_groups:
                severity_groups[severity] = []
            severity_groups[severity].append(drift)

        # Send notifications
        webhook_url = self.config["reporting"]["slack_webhook"]
        if webhook_url and any(sev in ["critical", "error", "warning"] for sev in severity_groups.keys()):
            await self._send_slack_drift_alert(source_env, target_env, severity_groups)

    async def _send_slack_alert(self, environment: str, severity_groups: Dict[str, List], alert_type: str):
        """Send Slack alert for validation results"""
        webhook_url = self.config["reporting"]["slack_webhook"]
        if not webhook_url:
            return

        color_map = {
            "critical": "#FF0000",
            "error": "#FF6600",
            "warning": "#FFCC00",
            "info": "#0099FF"
        }

        for severity, violations in severity_groups.items():
            if severity not in color_map:
                continue

            color = color_map[severity]

            # Create attachment for Slack
            attachment = {
                "color": color,
                "title": f"Configuration {alert_type.title()} Alert - {environment}",
                "text": f"Found {len(violations)} {severity} violations",
                "fields": [],
                "footer": "Configuration Manager",
                "ts": int(time.time())
            }

            # Add violation details
            for i, violation in enumerate(violations[:5]):  # Limit to 5 violations
                attachment["fields"].append({
                    "title": f"Violation {i+1}",
                    "value": f"• *Policy*: {violation.policy}\n• *Resource*: {violation.resource_name} ({violation.resource_type})\n• *Description*: {violation.description}\n• *Remediation*: {violation.remediation}",
                    "short": False
                })

            if len(violations) > 5:
                attachment["fields"].append({
                    "title": "Additional Violations",
                    "value": f"... and {len(violations) - 5} more violations",
                    "short": False
                })

            payload = {
                "text": f"🚨 Configuration {alert_type.title()} Alert in {environment}",
                "attachments": [attachment]
            }

            try:
                async with aiohttp.ClientSession() as session:
                    async with session.post(webhook_url, json=payload) as response:
                        if response.status == 200:
                            logger.info(f"Slack alert sent for {severity} violations in {environment}")
                        else:
                            logger.error(f"Failed to send Slack alert: {response.status}")

            except Exception as e:
                logger.error(f"Failed to send Slack alert: {e}")

    async def _send_slack_drift_alert(self, source_env: str, target_env: str, severity_groups: Dict[str, List]):
        """Send Slack alert for drift detection"""
        webhook_url = self.config["reporting"]["slack_webhook"]
        if not webhook_url:
            return

        color_map = {
            "critical": "#FF0000",
            "error": "#FF6600",
            "warning": "#FFCC00",
            "info": "#0099FF"
        }

        for severity, drifts in severity_groups.items():
            if severity not in color_map:
                continue

            color = color_map[severity]

            # Create attachment for Slack
            attachment = {
                "color": color,
                "title": f"Configuration Drift Alert - {source_env} → {target_env}",
                "text": f"Detected {len(drifts)} {severity} drifts",
                "fields": [],
                "footer": "Configuration Manager",
                "ts": int(time.time())
            }

            # Add drift details
            for i, drift in enumerate(drifts[:5]):  # Limit to 5 drifts
                attachment["fields"].append({
                    "title": f"Drift {i+1}",
                    "value": f"• *Resource*: {drift.resource_name} ({drift.resource_type})\n• *Type*: {drift.drift_type.value}\n• *Description*: {drift.description}\n• *Remediation*: {drift.remediation}",
                    "short": False
                })

            if len(drifts) > 5:
                attachment["fields"].append({
                    "title": "Additional Drifts",
                    "value": f"... and {len(drifts) - 5} more drifts",
                    "short": False
                })

            payload = {
                "text": f"🔄 Configuration Drift Detected: {source_env} → {target_env}",
                "attachments": [attachment]
            }

            try:
                async with aiohttp.ClientSession() as session:
                    async with session.post(webhook_url, json=payload) as response:
                        if response.status == 200:
                            logger.info(f"Slack drift alert sent for {severity} drifts")
                        else:
                            logger.error(f"Failed to send Slack drift alert: {response.status}")

            except Exception as e:
                logger.error(f"Failed to send Slack drift alert: {e}")

    async def start_continuous_monitoring(self):
        """Start continuous monitoring loop"""
        logger.info("Starting continuous configuration monitoring")

        while True:
            try:
                # Run validation
                await self.validate_all_environments()

                # Run drift detection
                await self.detect_drift_all_environments()

                # Sleep until next run
                validation_interval = self.config["validation"]["interval"]
                drift_interval = self.config["drift_detection"]["interval"]

                # Sleep for the minimum interval
                sleep_time = min(validation_interval, drift_interval)
                logger.info(f"Monitoring cycle completed, sleeping for {sleep_time} seconds")

                await asyncio.sleep(sleep_time)

            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}")
                await asyncio.sleep(60)  # Sleep 1 minute on error

class ConfigurationAPI:
    """REST API for configuration management"""

    def __init__(self, config_manager: ConfigurationManager):
        self.config_manager = config_manager
        self.app = self._create_app()

    def _create_app(self):
        """Create FastAPI application"""
        from fastapi import FastAPI, HTTPException, BackgroundTasks
        from fastapi.responses import JSONResponse
        import uvicorn

        app = FastAPI(
            title="Configuration Manager API",
            description="Configuration Validation and Drift Detection API",
            version="1.0.0"
        )

        @app.get("/")
        async def root():
            return {"service": "Configuration Manager", "version": "1.0.0"}

        @app.get("/health")
        async def health_check():
            return {"status": "healthy", "timestamp": datetime.now().isoformat()}

        @app.get("/environments")
        async def get_environments():
            """Get all configured environments"""
            return {"environments": list(self.config_manager.config["environments"].keys())}

        @app.get("/validation/status")
        async def get_validation_status():
            """Get validation status for all environments"""
            status = {}
            for env_name in self.config_manager.config["environments"]:
                last_validation = self.config_manager.last_validation.get(env_name)
                violations = self.config_manager.violations.get(env_name, [])

                status[env_name] = {
                    "last_validation": last_validation.isoformat() if last_validation else None,
                    "violation_count": len(violations),
                    "severity_breakdown": {
                        "critical": len([v for v in violations if v.severity == PolicySeverity.CRITICAL]),
                        "error": len([v for v in violations if v.severity == PolicySeverity.ERROR]),
                        "warning": len([v for v in violations if v.severity == PolicySeverity.WARNING]),
                        "info": len([v for v in violations if v.severity == PolicySeverity.INFO])
                    }
                }

            return status

        @app.post("/validation/validate/{environment}")
        async def validate_environment(environment: str, background_tasks: BackgroundTasks):
            """Trigger validation for a specific environment"""
            if environment not in self.config_manager.config["environments"]:
                raise HTTPException(status_code=404, detail=f"Environment {environment} not found")

            # Run validation in background
            background_tasks.add_task(self.config_manager.validate_environment, environment)

            return {"message": f"Validation started for {environment}"}

        @app.get("/validation/violations/{environment}")
        async def get_violations(environment: str, severity: Optional[str] = None):
            """Get policy violations for an environment"""
            if environment not in self.config_manager.config["environments"]:
                raise HTTPException(status_code=404, detail=f"Environment {environment} not found")

            violations = self.config_manager.violations.get(environment, [])

            if severity:
                violations = [v for v in violations if v.severity.value == severity]

            return {
                "environment": environment,
                "violations": [
                    {
                        "policy": v.policy,
                        "severity": v.severity.value,
                        "description": v.description,
                        "category": v.category,
                        "remediation": v.remediation,
                        "resource_name": v.resource_name,
                        "resource_type": v.resource_type,
                        "namespace": v.namespace,
                        "timestamp": v.timestamp.isoformat()
                    }
                    for v in violations
                ]
            }

        @app.get("/drift/status")
        async def get_drift_status():
            """Get drift detection status"""
            status = {}

            for cache_key in self.config_manager.drift_cache:
                source_env, target_env = cache_key.split("->")
                drifts = self.config_manager.drift_cache[cache_key]
                last_check = self.config_manager.last_drift_check.get(cache_key)

                status[cache_key] = {
                    "source_environment": source_env,
                    "target_environment": target_env,
                    "last_check": last_check.isoformat() if last_check else None,
                    "drift_count": len(drifts),
                    "severity_breakdown": {
                        "critical": len([d for d in drifts if d.severity == PolicySeverity.CRITICAL]),
                        "error": len([d for d in drifts if d.severity == PolicySeverity.ERROR]),
                        "warning": len([d for d in drifts if d.severity == PolicySeverity.WARNING]),
                        "info": len([d for d in drifts if d.severity == PolicySeverity.INFO])
                    }
                }

            return status

        @app.post("/drift/detect/{source_env}/{target_env}")
        async def detect_drift(source_env: str, target_env: str, background_tasks: BackgroundTasks):
            """Trigger drift detection between environments"""
            if source_env not in self.config_manager.config["environments"]:
                raise HTTPException(status_code=404, detail=f"Source environment {source_env} not found")

            if target_env not in self.config_manager.config["environments"]:
                raise HTTPException(status_code=404, detail=f"Target environment {target_env} not found")

            # Run drift detection in background
            background_tasks.add_task(self.config_manager.detect_environment_drift, source_env, target_env)

            return {"message": f"Drift detection started for {source_env} → {target_env}"}

        @app.get("/drift/results/{source_env}/{target_env}")
        async def get_drift_results(source_env: str, target_env: str, drift_type: Optional[str] = None):
            """Get drift results between environments"""
            cache_key = f"{source_env}->{target_env}"
            drifts = self.config_manager.drift_cache.get(cache_key, [])

            if drift_type:
                drifts = [d for d in drifts if d.drift_type.value == drift_type]

            return {
                "source_environment": source_env,
                "target_environment": target_env,
                "drifts": [
                    {
                        "drift_type": d.drift_type.value,
                        "severity": d.severity.value,
                        "description": d.description,
                        "resource_name": d.resource_name,
                        "resource_type": d.resource_type,
                        "namespace": d.namespace,
                        "remediation": d.remediation,
                        "timestamp": d.timestamp.isoformat()
                    }
                    for d in drifts
                ]
            }

        @app.get("/policies")
        async def get_policies():
            """Get all configured policies"""
            policies = {}

            for policy_name, policy in self.config_manager.policies.items():
                policies[policy_name] = {
                    "name": policy.name,
                    "category": policy.category,
                    "severity": policy.severity.value,
                    "description": policy.description,
                    "rule": policy.rule,
                    "remediation": policy.remediation,
                    "enabled": policy.enabled,
                    "auto_remediate": policy.auto_remediate,
                    "environments": policy.environments
                }

            return policies

        @app.get("/metrics")
        async def get_metrics():
            """Get configuration management metrics"""
            metrics = {}

            # Calculate compliance scores
            for env_name in self.config_manager.config["environments"]:
                violations = self.config_manager.violations.get(env_name, [])
                total_violations = len(violations)

                severity_counts = {}
                for violation in violations:
                    severity = violation.severity.value
                    severity_counts[severity] = severity_counts.get(severity, 0) + 1

                metrics[env_name] = {
                    "total_violations": total_violations,
                    "severity_breakdown": severity_counts,
                    "last_validation": self.config_manager.last_validation.get(env_name).isoformat() if env_name in self.config_manager.last_validation else None
                }

            # Drift metrics
            drift_metrics = {}
            for cache_key in self.config_manager.drift_cache:
                drifts = self.config_manager.drift_cache[cache_key]
                drift_metrics[cache_key] = {
                    "total_drifts": len(drifts),
                    "last_check": self.config_manager.last_drift_check.get(cache_key).isoformat() if cache_key in self.config_manager.last_drift_check else None
                }

            return {
                "environment_metrics": metrics,
                "drift_metrics": drift_metrics,
                "total_policies": len(self.config_manager.policies),
                "enabled_policies": len([p for p in self.config_manager.policies.values() if p.enabled])
            }

        return app

    async def start_server(self, host: str = "0.0.0.0", port: int = 8080):
        """Start the API server"""
        import uvicorn
        config = uvicorn.Config(self.app, host=host, port=port, log_config=None)
        server = uvicorn.Server(config)
        await server.serve()

async def main():
    """Main function"""
    parser = argparse.ArgumentParser(description="Configuration Validation and Drift Detection")
    parser.add_argument("--config", type=str, help="Configuration file path")
    parser.add_argument("--environment", type=str, help="Specific environment to validate")
    parser.add_argument("--validate-only", action="store_true", help="Run validation only")
    parser.add_argument("--drift-only", action="store_true", help="Run drift detection only")
    parser.add_argument("--api-server", action="store_true", help="Start API server")
    parser.add_argument("--monitor", action="store_true", help="Start continuous monitoring")
    parser.add_argument("--port", type=int, default=8080, help="API server port")

    args = parser.parse_args()

    # Initialize configuration manager
    config_manager = ConfigurationManager(args.config)

    if args.api_server:
        # Start metrics server
        start_http_server(8000)

        # Start API server
        api = ConfigurationAPI(config_manager)
        logger.info(f"Starting API server on port {args.port}")
        await api.start_server(port=args.port)

    elif args.monitor:
        # Start continuous monitoring
        start_http_server(8000)
        logger.info("Starting continuous monitoring")
        await config_manager.start_continuous_monitoring()

    else:
        # Run specific operations
        if args.validate_only or not args.drift_only:
            if args.environment:
                await config_manager.validate_environment(args.environment)
            else:
                await config_manager.validate_all_environments()

        if args.drift_only:
            if args.environment:
                logger.error("Drift detection requires two environments, use --source-env and --target-env")
            else:
                await config_manager.detect_drift_all_environments()

if __name__ == "__main__":
    asyncio.run(main())