"""Bridge generator service for UPM.

This service provides high-level bridge generation capabilities integrated
with UPM's dependency analysis and TEDDK project workflows.
"""

from __future__ import annotations

from typing import Any, Optional

import structlog
from pydantic import BaseModel
from udp.core.bridge_templates import (
    BridgeGenerator,
    BridgeType,
    Language,
    create_config,
    create_interface,
)

logger = structlog.get_logger(__name__)


class BridgeGenerationRequest(BaseModel):
    """Request model for bridge generation."""

    project_id: Optional[str] = None
    bridge_type: BridgeType
    source_language: Language
    target_language: Language
    package_name: str
    output_dir: str = "./generated_bridge"
    interfaces: list[dict[str, Any]] = []

    # Optional TEDDK-specific options
    for_teddk: bool = False
    teddk_project_path: Optional[str] = None


class BridgeGenerationResult(BaseModel):
    """Result model for bridge generation."""

    success: bool
    bridge_type: BridgeType
    generated_files: list[str] = []
    output_dir: str = ""
    error: Optional[str] = None
    build_command: Optional[str] = None
    usage_instructions: Optional[str] = None


class BridgeGeneratorService:
    """Service for generating cross-language bridges in UPM."""

    def __init__(self) -> None:
        self._generators: dict[str, BridgeGenerator] = {}

    async def generate_bridge(
        self,
        request: BridgeGenerationRequest,
    ) -> BridgeGenerationResult:
        """Generate a cross-language bridge.

        Args:
            request: Bridge generation request

        Returns:
            Bridge generation result
        """
        try:
            # Parse interfaces
            interfaces = [
                create_interface(**iface_dict) for iface_dict in request.interfaces
            ]

            # Create config
            config = create_config(
                bridge_type=request.bridge_type,
                source_language=request.source_language,
                target_language=request.target_language,
                package_name=request.package_name,
                output_dir=request.output_dir,
            )
            config.interfaces = interfaces

            # Generate bridge
            generator = BridgeGenerator(config)
            artifacts = generator.generate_all()

            return BridgeGenerationResult(
                success=True,
                bridge_type=request.bridge_type,
                generated_files=list(artifacts.keys()),
                output_dir=request.output_dir,
                build_command=self._get_build_command(request),
                usage_instructions=self._get_usage_instructions(request),
            )

        except Exception as e:
            logger.exception("Bridge generation failed", request=request)
            return BridgeGenerationResult(
                success=False,
                bridge_type=request.bridge_type,
                error=str(e),
            )

    async def generate_teddk_bridge(
        self,
        output_dir: str = "./teddk_bridge",
        bridge_type: BridgeType = BridgeType.PY4J,
    ) -> BridgeGenerationResult:
        """Generate a bridge specifically for TEDDK project integration.

        This creates a pre-configured bridge with common TEDDK analysis interfaces.

        Args:
            output_dir: Output directory for generated code
            bridge_type: Type of bridge to generate

        Returns:
            Bridge generation result
        """
        # Define TEDDK-specific interfaces
        teddk_interfaces = self._get_teddk_interfaces()

        request = BridgeGenerationRequest(
            bridge_type=bridge_type,
            source_language=Language.PYTHON,
            target_language=Language.JAVA,
            package_name="com.teddk.upm.bridge",
            output_dir=output_dir,
            interfaces=teddk_interfaces,
            for_teddk=True,
        )

        return await self.generate_bridge(request)

    async def generate_dependency_analysis_bridge(
        self,
        project_type: str = "maven",
        output_dir: str = "./dependency_bridge",
    ) -> BridgeGenerationResult:
        """Generate a bridge for dependency analysis between Python and Java.

        Args:
            project_type: Type of project (maven, gradle, npm, etc.)
            output_dir: Output directory for generated code

        Returns:
            Bridge generation result
        """
        interfaces = self._get_dependency_analysis_interfaces(project_type)

        target_lang = (
            Language.JAVA
            if project_type in ("maven", "gradle")
            else Language.TYPESCRIPT
        )

        request = BridgeGenerationRequest(
            bridge_type=BridgeType.PY4J
            if target_lang == Language.JAVA
            else BridgeType.REST_API,
            source_language=Language.PYTHON,
            target_language=target_lang,
            package_name=f"com.upm.bridge.{project_type}",
            output_dir=output_dir,
            interfaces=interfaces,
        )

        return await self.generate_bridge(request)

    def _get_teddk_interfaces(self) -> list[dict[str, Any]]:
        """Get predefined interfaces for TEDDK integration."""
        return [
            {
                "name": "DependencyAnalyzer",
                "namespace": "com.teddk.upm.analysis",
                "docstring": "Analyzes TEDDK project dependencies for vulnerabilities",
                "methods": [
                    {
                        "name": "analyze_pom",
                        "return_type": "AnalysisResult",
                        "parameters": [
                            {
                                "name": "pom_path",
                                "type": "str",
                                "docstring": "Path to pom.xml",
                            },
                            {
                                "name": "recursive",
                                "type": "bool",
                                "default_value": "True",
                                "is_optional": True,
                            },
                        ],
                        "docstring": "Analyze a Maven pom.xml file",
                    },
                    {
                        "name": "check_vulnerabilities",
                        "return_type": "List[Vulnerability]",
                        "parameters": [
                            {"name": "dependency", "type": "Dependency"},
                            {
                                "name": "sources",
                                "type": "List[str]",
                                "is_optional": True,
                            },
                        ],
                        "docstring": "Check a dependency for known vulnerabilities",
                    },
                    {
                        "name": "get_remediation",
                        "return_type": "RemediationPlan",
                        "parameters": [
                            {"name": "vulnerability_id", "type": "str"},
                        ],
                        "docstring": "Get remediation plan for a vulnerability",
                    },
                ],
            },
            {
                "name": "PolicyEnforcer",
                "namespace": "com.teddk.upm.policy",
                "docstring": "Enforces security policies on TEDDK dependencies",
                "methods": [
                    {
                        "name": "validate_dependency",
                        "return_type": "PolicyResult",
                        "parameters": [
                            {"name": "dependency", "type": "Dependency"},
                            {
                                "name": "policy_set",
                                "type": "str",
                                "default_value": "teddk_default",
                                "is_optional": True,
                            },
                        ],
                        "docstring": "Validate a dependency against policies",
                    },
                    {
                        "name": "get_compliance_score",
                        "return_type": "int",
                        "parameters": [
                            {"name": "project_path", "type": "str"},
                        ],
                        "docstring": "Calculate overall compliance score",
                    },
                ],
            },
            {
                "name": "SBOMGenerator",
                "namespace": "com.teddk.upm.sbom",
                "docstring": "Generates Software Bill of Materials for TEDDK",
                "methods": [
                    {
                        "name": "generate_cyclonedx",
                        "return_type": "str",
                        "parameters": [
                            {"name": "project_path", "type": "str"},
                            {
                                "name": "output_format",
                                "type": "str",
                                "default_value": "json",
                                "is_optional": True,
                            },
                        ],
                        "docstring": "Generate CycloneDX SBOM",
                    },
                    {
                        "name": "generate_spdx",
                        "return_type": "str",
                        "parameters": [
                            {"name": "project_path", "type": "str"},
                        ],
                        "docstring": "Generate SPDX SBOM",
                    },
                ],
            },
        ]

    def _get_dependency_analysis_interfaces(
        self, project_type: str
    ) -> list[dict[str, Any]]:
        """Get interfaces for generic dependency analysis."""
        return [
            {
                "name": "DependencyScanner",
                "namespace": "com.upm.analysis",
                "docstring": f"Scans {project_type} project dependencies",
                "methods": [
                    {
                        "name": "scan_project",
                        "return_type": "ScanResult",
                        "parameters": [
                            {"name": "project_path", "type": "str"},
                            {"name": "config", "type": "dict", "is_optional": True},
                        ],
                        "docstring": f"Scan a {project_type} project",
                    },
                    {
                        "name": "get_dependency_tree",
                        "return_type": "DependencyTree",
                        "parameters": [
                            {"name": "project_path", "type": "str"},
                        ],
                        "docstring": "Get the full dependency tree",
                    },
                ],
            },
            {
                "name": "VulnerabilityChecker",
                "namespace": "com.upm.security",
                "docstring": "Checks dependencies for vulnerabilities",
                "methods": [
                    {
                        "name": "check_dependencies",
                        "return_type": "List[VulnerabilityReport]",
                        "parameters": [
                            {"name": "dependencies", "type": "List[Dependency]"},
                        ],
                        "docstring": "Check multiple dependencies for vulnerabilities",
                    },
                ],
            },
        ]

    def _get_build_command(self, request: BridgeGenerationRequest) -> str:
        """Get the build command for the generated bridge."""
        if request.bridge_type == BridgeType.PY4J:
            if request.target_language == Language.JAVA:
                return f"cd {request.output_dir} && mvn clean install"
        elif request.bridge_type == BridgeType.REST_API:
            if request.target_language == Language.JAVA:
                return f"cd {request.output_dir} && mvn clean package spring-boot:run"
            elif request.target_language == Language.TYPESCRIPT:
                return f"cd {request.output_dir} && npm install && npm run build"
        return f"# Build the generated code in {request.output_dir}"

    def _get_usage_instructions(self, request: BridgeGenerationRequest) -> str:
        """Get usage instructions for the generated bridge."""
        if request.bridge_type == BridgeType.PY4J:
            return f"""
# Py4J Bridge Usage

## Start the Python bridge server:
```bash
cd {request.output_dir}
python dependencyanalyzer_server.py
```

## Connect from Java:
```java
import py4j.Gateway;

Gateway gateway = new Gateway("localhost", 25333);
DependencyAnalyzerEntryPoint entryPoint =
    new DependencyAnalyzerEntryPoint(gateway);

// Call methods
entryPoint.analyzePom("/path/to/pom.xml", true);
```
"""
        elif request.bridge_type == BridgeType.REST_API:
            return f"""
# REST API Bridge Usage

## Start the API server:
```bash
cd {request.output_dir}
python dependencyanalyzer_server.py
```

## Use the client:
```python
from dependencyanalyzer_client import DependencyAnalyzerClient

async with DependencyAnalyzerClient() as client:
    result = await client.analyze_pom("/path/to/pom.xml")
```
"""
        return f"# Bridge generated in {request.output_dir}"


# Singleton instance
_bridge_generator_service: Optional[BridgeGeneratorService] = None


def get_bridge_generator_service() -> BridgeGeneratorService:
    """Get the singleton bridge generator service."""
    global _bridge_generator_service
    if _bridge_generator_service is None:
        _bridge_generator_service = BridgeGeneratorService()
    return _bridge_generator_service
