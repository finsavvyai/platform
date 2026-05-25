"""
Cloud configuration management for UDP plugins and services.

Provides environment-aware configuration for cloud deployments,
service discovery, and plugin management.
"""

import os
from dataclasses import dataclass
from typing import Any, Optional

from pydantic import BaseSettings, Field, validator


@dataclass
class ServiceEndpoint:
    """Service endpoint configuration."""
    url: str
    health_path: str = "/health"
    timeout: int = 30
    retries: int = 3
    auth_token: Optional[str] = None


class CloudSettings(BaseSettings):
    """Cloud-specific configuration settings."""

    # Environment detection
    cloud_provider: Optional[str] = Field(
        default=None,
        description="Cloud provider: aws, gcp, azure, local"
    )
    kubernetes_namespace: Optional[str] = Field(
        default=None,
        description="Kubernetes namespace"
    )

    # UDP Service Discovery
    udp_service_url: str = Field(
        default="http://localhost:8000",
        description="UDP service base URL"
    )
    udp_api_token: Optional[str] = Field(
        default=None,
        description="UDP API authentication token"
    )

    # Service mesh configuration
    service_mesh_enabled: bool = Field(
        default=False,
        description="Enable service mesh integration"
    )
    istio_sidecar_enabled: bool = Field(
        default=False,
        description="Enable Istio sidecar injection"
    )

    # Plugin configuration
    plugin_registry_url: str = Field(
        default="ghcr.io/universaldependency/plugins",
        description="Plugin container registry URL"
    )
    plugin_cache_enabled: bool = Field(
        default=True,
        description="Enable plugin result caching"
    )
    plugin_cache_ttl: int = Field(
        default=3600,
        description="Plugin cache TTL in seconds"
    )

    # Multi-region configuration
    region: Optional[str] = Field(
        default=None,
        description="Cloud region"
    )
    availability_zone: Optional[str] = Field(
        default=None,
        description="Availability zone"
    )

    # Load balancing
    load_balancer_enabled: bool = Field(
        default=True,
        description="Enable load balancing"
    )
    sticky_sessions_enabled: bool = Field(
        default=False,
        description="Enable sticky sessions"
    )

    # Security configuration
    tls_enabled: bool = Field(
        default=True,
        description="Enable TLS encryption"
    )
    mutual_tls_enabled: bool = Field(
        default=False,
        description="Enable mutual TLS"
    )
    cert_manager_enabled: bool = Field(
        default=True,
        description="Use cert-manager for TLS certificates"
    )

    # Monitoring and observability
    distributed_tracing_enabled: bool = Field(
        default=True,
        description="Enable distributed tracing"
    )
    jaeger_endpoint: Optional[str] = Field(
        default=None,
        description="Jaeger tracing endpoint"
    )
    prometheus_metrics_enabled: bool = Field(
        default=True,
        description="Enable Prometheus metrics"
    )

    class Config:
        env_prefix = "UDP_CLOUD_"
        case_sensitive = False

    @validator("cloud_provider")
    def detect_cloud_provider(cls, v: Optional[str]) -> Optional[str]:
        """Auto-detect cloud provider if not specified."""
        if v:
            return v.lower()

        # Auto-detection based on environment variables
        if os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION"):
            return "aws"
        elif os.getenv("GOOGLE_CLOUD_PROJECT") or os.getenv("GCP_PROJECT"):
            return "gcp"
        elif os.getenv("AZURE_SUBSCRIPTION_ID"):
            return "azure"
        elif os.getenv("KUBERNETES_SERVICE_HOST"):
            return "kubernetes"
        else:
            return "local"

    @validator("kubernetes_namespace")
    def detect_kubernetes_namespace(cls, v: Optional[str]) -> Optional[str]:
        """Auto-detect Kubernetes namespace."""
        if v:
            return v

        # Try to read from service account
        try:
            with open("/var/run/secrets/kubernetes.io/serviceaccount/namespace") as f:
                return f.read().strip()
        except FileNotFoundError:
            return os.getenv("KUBERNETES_NAMESPACE", "default")


class PluginCloudConfig:
    """Cloud configuration for UDP plugins."""

    def __init__(self, settings: CloudSettings):
        self.settings = settings
        self._service_endpoints: dict[str, ServiceEndpoint] = {}

    def register_service_endpoint(self, name: str, endpoint: ServiceEndpoint) -> None:
        """Register a service endpoint for plugin use."""
        self._service_endpoints[name] = endpoint

    def get_service_endpoint(self, name: str) -> Optional[ServiceEndpoint]:
        """Get a registered service endpoint."""
        return self._service_endpoints.get(name)

    def get_udp_service_url(self) -> str:
        """Get the UDP service URL with proper formatting."""
        url = self.settings.udp_service_url
        if not url.startswith(("http://", "https://")):
            url = f"https://{url}" if self.settings.tls_enabled else f"http://{url}"
        return url.rstrip("/")

    def get_plugin_config_for_ecosystem(self, ecosystem: str) -> dict[str, Any]:
        """Get cloud-specific configuration for an ecosystem plugin."""
        base_config = {
            "udp_service_url": self.get_udp_service_url(),
            "api_token": self.settings.udp_api_token,
            "cache_enabled": self.settings.plugin_cache_enabled,
            "cache_ttl": self.settings.plugin_cache_ttl,
            "timeout": 30,
            "retries": 3,
        }

        # Ecosystem-specific configurations
        ecosystem_configs = {
            "npm": {
                "registry_url": "https://registry.npmjs.org",
                "use_cache": True,
                "parallel_downloads": 10,
            },
            "pip": {
                "index_url": "https://pypi.org/simple",
                "extra_index_urls": [],
                "use_cache": True,
            },
            "maven": {
                "central_url": "https://repo1.maven.org/maven2",
                "use_cache": True,
                "concurrent_downloads": 5,
            },
            "cargo": {
                "registry_url": "https://crates.io",
                "use_sparse_index": True,
            }
        }

        base_config.update(ecosystem_configs.get(ecosystem, {}))

        # Add cloud-specific overrides
        if self.settings.cloud_provider == "aws":
            base_config.update(self._get_aws_specific_config(ecosystem))
        elif self.settings.cloud_provider == "gcp":
            base_config.update(self._get_gcp_specific_config(ecosystem))
        elif self.settings.cloud_provider == "azure":
            base_config.update(self._get_azure_specific_config(ecosystem))

        return base_config

    def _get_aws_specific_config(self, ecosystem: str) -> dict[str, Any]:
        """Get AWS-specific configuration."""
        config = {
            "region": self.settings.region or os.getenv("AWS_REGION", "us-east-1"),
        }

        # AWS CodeArtifact integration
        if ecosystem == "npm" and os.getenv("AWS_CODEARTIFACT_DOMAIN"):
            config["registry_url"] = (
                f"https://{os.getenv('AWS_CODEARTIFACT_DOMAIN')}-"
                f"{os.getenv('AWS_ACCOUNT_ID', '')}.d.codeartifact."
                f"{config['region']}.amazonaws.com/npm/"
                f"{os.getenv('AWS_CODEARTIFACT_REPOSITORY', 'npm')}/"
            )

        return config

    def _get_gcp_specific_config(self, ecosystem: str) -> dict[str, Any]:
        """Get GCP-specific configuration."""
        config = {
            "project": os.getenv("GOOGLE_CLOUD_PROJECT", ""),
            "region": self.settings.region or os.getenv("GOOGLE_CLOUD_REGION", "us-central1"),
        }

        # Google Artifact Registry integration
        if ecosystem == "npm" and os.getenv("GOOGLE_ARTIFACT_REGISTRY_REPO"):
            config["registry_url"] = (
                f"https://{config['region']}-npm.pkg.dev/"
                f"{config['project']}/"
                f"{os.getenv('GOOGLE_ARTIFACT_REGISTRY_REPO')}/"
            )

        return config

    def _get_azure_specific_config(self, ecosystem: str) -> dict[str, Any]:
        """Get Azure-specific configuration."""
        config = {
            "subscription_id": os.getenv("AZURE_SUBSCRIPTION_ID", ""),
            "resource_group": os.getenv("AZURE_RESOURCE_GROUP", ""),
            "region": self.settings.region or os.getenv("AZURE_LOCATION", "eastus"),
        }

        # Azure Artifacts integration
        if ecosystem == "npm" and os.getenv("AZURE_DEVOPS_ORG"):
            config["registry_url"] = (
                f"https://pkgs.dev.azure.com/"
                f"{os.getenv('AZURE_DEVOPS_ORG')}/_packaging/"
                f"{os.getenv('AZURE_ARTIFACTS_FEED', 'npm')}/npm/registry/"
            )

        return config

    def get_health_check_config(self) -> dict[str, Any]:
        """Get health check configuration for plugins."""
        return {
            "enabled": True,
            "interval": 30,
            "timeout": 10,
            "retries": 3,
            "endpoints": [
                f"{self.get_udp_service_url()}/health",
            ]
        }

    def get_metrics_config(self) -> dict[str, Any]:
        """Get metrics configuration for plugins."""
        return {
            "enabled": self.settings.prometheus_metrics_enabled,
            "port": 9090,
            "path": "/metrics",
            "labels": {
                "cloud_provider": self.settings.cloud_provider,
                "region": self.settings.region,
                "namespace": self.settings.kubernetes_namespace,
            }
        }


def get_cloud_settings() -> CloudSettings:
    """Get cloud settings instance."""
    return CloudSettings()


def get_plugin_cloud_config() -> PluginCloudConfig:
    """Get plugin cloud configuration instance."""
    return PluginCloudConfig(get_cloud_settings())
