"""Bridge code generator orchestrator.

This module provides the main entry point for generating cross-language
bridge code from interface definitions.
"""

from __future__ import annotations

import json
from dataclasses import asdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import structlog

from .base import (
    BridgeConfig,
    BridgeTemplate,
    BridgeType,
    InterfaceDefinition,
    Language,
    MethodSignature,
    Parameter,
)
from .py4j_template import Py4JTemplate
from .rest_template import RestApiTemplate

logger = structlog.get_logger(__name__)


class BridgeGenerator:
    """Main bridge code generator.

    This class orchestrates the generation of cross-language bridge code
    using template-based generation.
    """

    # Template registry
    TEMPLATES: Dict[BridgeType, type[BridgeTemplate]] = {
        BridgeType.PY4J: Py4JTemplate,
        BridgeType.REST_API: RestApiTemplate,
    }

    def __init__(self, config: BridgeConfig) -> None:
        """Initialize the bridge generator.

        Args:
            config: Bridge configuration
        """
        self.config = config
        self.template = self._create_template()

    def _create_template(self) -> BridgeTemplate:
        """Create the appropriate template based on bridge type."""
        template_class = self.TEMPLATES.get(self.config.bridge_type)

        if template_class is None:
            raise ValueError(
                f"Unsupported bridge type: {self.config.bridge_type}. "
                f"Supported types: {list(self.TEMPLATES.keys())}"
            )

        return template_class(self.config)

    def generate_all(self, output_dir: Optional[str] = None) -> Dict[str, str]:
        """Generate all bridge code artifacts.

        Args:
            output_dir: Override output directory from config

        Returns:
            Dictionary mapping file paths to generated content
        """
        output = output_dir or self.config.output_dir
        base_path = Path(output)

        artifacts: Dict[str, str] = {}

        # Generate code for each interface
        for interface in self.config.interfaces:
            interface_artifacts = self.generate_interface(interface, base_path)
            artifacts.update(interface_artifacts)

        # Generate build configuration
        build_config = self.template.generate_build_config()
        build_path = base_path / self._get_build_config_name()
        artifacts[str(build_path)] = build_config

        # Generate OpenAPI spec for REST API
        if self.config.bridge_type == BridgeType.REST_API:
            if hasattr(self.template, "generate_openapi_spec"):
                for interface in self.config.interfaces:
                    openapi_spec = self.template.generate_openapi_spec(interface)
                    spec_path = base_path / f"openapi_{interface.name.lower()}.json"
                    artifacts[str(spec_path)] = openapi_spec

        # Write files to disk
        self._write_artifacts(artifacts)

        logger.info(
            "Generated bridge code",
            bridge_type=self.config.bridge_type,
            num_files=len(artifacts),
            output_dir=str(base_path),
        )

        return artifacts

    def generate_interface(
        self,
        interface: InterfaceDefinition,
        base_path: Path,
    ) -> Dict[str, str]:
        """Generate code for a single interface.

        Args:
            interface: Interface definition
            base_path: Base output directory

        Returns:
            Dictionary mapping file paths to content
        """
        artifacts: Dict[str, str] = {}

        # Generate server code
        server_code = self.template.generate_server_code(interface)
        server_path = base_path / self._get_server_filename(interface)
        artifacts[str(server_path)] = server_code

        # Generate client code
        client_code = self.template.generate_client_code(interface)
        client_path = base_path / self._get_client_filename(interface)
        artifacts[str(client_path)] = client_code

        # Generate test files if requested
        if self.config.generate_tests:
            test_code = self._generate_test(interface)
            test_path = base_path / "tests" / f"test_{interface.name.lower()}.py"
            artifacts[str(test_path)] = test_code

        # Generate example usage if requested
        if self.config.include_example:
            example_code = self._generate_example(interface)
            example_path = (
                base_path / "examples" / f"{interface.name.lower()}_example.py"
            )
            artifacts[str(example_path)] = example_code

        return artifacts

    def _get_server_filename(self, interface: InterfaceDefinition) -> Path:
        """Get the server code filename."""
        if self.config.target_language == Language.PYTHON:
            return Path(f"{interface.name.lower()}_server.py")
        elif self.config.target_language in (Language.JAVA, Language.KOTLIN):
            return Path(
                f"src/main/java/{self.config.namespace.replace('.', '/')}/{interface.name}/{interface.name}Server.java"
            )
        elif self.config.target_language == Language.TYPESCRIPT:
            return Path(f"src/server/{interface.name.lower()}.ts")
        return Path(f"{interface.name.lower()}_server")

    def _get_client_filename(self, interface: InterfaceDefinition) -> Path:
        """Get the client code filename."""
        if self.config.source_language == Language.PYTHON:
            return Path(f"{interface.name.lower()}_client.py")
        elif self.config.source_language in (Language.JAVA, Language.KOTLIN):
            return Path(
                f"src/main/java/{self.config.namespace.replace('.', '/')}/{interface.name}/{interface.name}Client.java"
            )
        elif self.config.source_language == Language.TYPESCRIPT:
            return Path(f"src/client/{interface.name.lower()}.ts")
        return Path(f"{interface.name.lower()}_client")

    def _get_build_config_name(self) -> str:
        """Get the build configuration filename."""
        if self.config.target_language == Language.JAVA:
            return "pom.xml"
        elif self.config.target_language == Language.TYPESCRIPT:
            return "package.json"
        elif self.config.target_language == Language.GO:
            return "go.mod"
        return "BUILD.md"

    def _generate_test(self, interface: InterfaceDefinition) -> str:
        """Generate test code for the interface."""
        if self.config.target_language == Language.PYTHON:
            return self._generate_python_test(interface)
        return "# TODO: Generate tests for target language"

    def _generate_python_test(self, interface: InterfaceDefinition) -> str:
        """Generate Python test code using pytest."""
        method_tests = []

        for method in interface.methods:
            method_tests.append(f'''
def test_{method.name}():
    """Test {method.name} method."""
    # TODO: Implement test
    assert True
''')

        return f'''"""Tests for {interface.name} bridge."""

import pytest

{"".join(method_tests)}
'''

    def _generate_example(self, interface: InterfaceDefinition) -> str:
        """Generate example usage code."""
        if self.config.bridge_type == BridgeType.PY4J:
            return self._generate_py4j_example(interface)
        elif self.config.bridge_type == BridgeType.REST_API:
            return self._generate_rest_example(interface)
        return "# TODO: Generate example for this bridge type"

    def _generate_py4j_example(self, interface: InterfaceDefinition) -> str:
        """Generate Py4J example usage."""
        return f'''"""Example usage of {interface.name} Py4J bridge."""

from {interface.name.lower()}_server import start_{interface.name.lower()}_bridge

# Start the Python bridge server
server = start_{interface.name.lower()}_bridge()
print(f"Bridge server running on port {{server.listening_port}}")

# In Java, connect with:
# Gateway gateway = new Gateway("localhost", {{server.listening_port}});
# {interface.name}EntryPoint entryPoint = new {interface.name}EntryPoint(gateway);

try:
    server.server.serve_forever()
except KeyboardInterrupt:
    print("\\nShutting down bridge server...")
    server.shutdown()
'''

    def _generate_rest_example(self, interface: InterfaceDefinition) -> str:
        """Generate REST API example usage."""
        return f'''"""Example usage of {interface.name} REST API client."""

import asyncio
from {interface.name.lower()}_client import {interface.name}Client


async def main():
    """Run example client usage."""
    async with {interface.name}Client() as client:
        # Health check
        health = await client.health_check()
        print(f"API Health: {{health}}")

        # TODO: Add method calls
        # result = await client.{interface.name.lower()}_method()


if __name__ == "__main__":
    asyncio.run(main())
'''

    def _write_artifacts(self, artifacts: Dict[str, str]) -> None:
        """Write generated artifacts to disk."""
        for file_path, content in artifacts.items():
            path = Path(file_path)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8")

            logger.debug("Wrote generated file", path=file_path, size=len(content))


def create_config(
    bridge_type: Union[BridgeType, str],
    source_language: Union[Language, str],
    target_language: Union[Language, str],
    package_name: str,
    output_dir: str = "./generated_bridge",
    **kwargs: Any,
) -> BridgeConfig:
    """Create a bridge configuration with sensible defaults.

    Args:
        bridge_type: Type of bridge to generate
        source_language: Source programming language
        target_language: Target programming language
        package_name: Package name for generated code
        output_dir: Output directory
        **kwargs: Additional configuration options

    Returns:
        BridgeConfig instance
    """
    # Convert string enums to actual enums
    if isinstance(bridge_type, str):
        bridge_type = BridgeType(bridge_type)
    if isinstance(source_language, str):
        source_language = Language(source_language)
    if isinstance(target_language, str):
        target_language = Language(target_language)

    return BridgeConfig(
        bridge_type=bridge_type,
        source_language=source_language,
        target_language=target_language,
        package_name=package_name,
        output_dir=output_dir,
        **kwargs,
    )


def create_interface(
    name: str,
    namespace: str,
    methods: List[Dict[str, Any]],
    **kwargs: Any,
) -> InterfaceDefinition:
    """Create an interface definition from a simplified dict format.

    Args:
        name: Interface name
        namespace: Interface namespace/package
        methods: List of method definitions
        **kwargs: Additional interface properties

    Returns:
        InterfaceDefinition instance

    Example:
        >>> interface = create_interface(
        ...     name="DependencyAnalyzer",
        ...     namespace="com.upm.analysis",
        ...     methods=[
        ...         {
        ...             "name": "analyze",
        ...             "return_type": "AnalysisResult",
        ...             "parameters": [
        ...             {"name": "project_path", "type": "str"},
        ...         ]
        ...     }
        ... ]
    """
    method_objects = []

    for method_dict in methods:
        params = [
            Parameter(**p) if isinstance(p, dict) else p
            for p in method_dict.get("parameters", [])
        ]
        method_dict["parameters"] = params
        method_objects.append(MethodSignature(**method_dict))

    return InterfaceDefinition(
        name=name,
        namespace=namespace,
        methods=method_objects,
        **kwargs,
    )


def generate_bridge_from_config(
    config_dict: Dict[str, Any],
) -> Dict[str, str]:
    """Generate bridge code from a configuration dictionary.

    This is a convenience function for generating bridges from JSON/YAML configs.

    Args:
        config_dict: Configuration dictionary

    Returns:
        Dictionary mapping file paths to generated content
    """
    # Parse interfaces from config
    interfaces = []
    for iface_dict in config_dict.get("interfaces", []):
        interfaces.append(create_interface(**iface_dict))

    # Create config
    config = create_config(
        **{k: v for k, v in config_dict.items() if k != "interfaces"},
        interfaces=interfaces,
    )

    # Generate
    generator = BridgeGenerator(config)
    return generator.generate_all()
