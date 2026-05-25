"""
SBOM (Software Bill of Materials) generator for Universal Dependency Platform.

Supports CycloneDX and SPDX formats for compliance and security reporting.
"""

import json
import logging
from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

from udp.domain.models import DependencyGraph, EcosystemType, Package

logger = logging.getLogger(__name__)


class SBOMGenerator:
    """SBOM generator supporting multiple formats."""

    def __init__(self, organization_id: UUID):
        self.organization_id = organization_id
        self.supported_formats = ["cyclonedx", "spdx"]

    def generate_sbom(
        self,
        dependency_graph: DependencyGraph,
        format_type: str = "cyclonedx",
        include_metadata: bool = True
    ) -> dict[str, Any]:
        """
        Generate SBOM for a dependency graph.

        Args:
            dependency_graph: Dependency graph to generate SBOM for
            format_type: SBOM format ("cyclonedx" or "spdx")
            include_metadata: Whether to include additional metadata

        Returns:
            SBOM document in specified format
        """
        logger.info(f"Generating {format_type} SBOM for {len(dependency_graph.dependencies)} packages")

        if format_type == "cyclonedx":
            return self._generate_cyclonedx_sbom(dependency_graph, include_metadata)
        elif format_type == "spdx":
            return self._generate_spdx_sbom(dependency_graph, include_metadata)
        else:
            raise ValueError(f"Unsupported SBOM format: {format_type}")

    def _generate_cyclonedx_sbom(
        self,
        dependency_graph: DependencyGraph,
        include_metadata: bool
    ) -> dict[str, Any]:
        """Generate CycloneDX format SBOM."""

        # Generate unique BOM reference
        bom_ref = str(uuid4())

        # Build components list
        components = []
        for package in dependency_graph.dependencies:
            component = {
                "type": "library",
                "name": package.name,
                "version": package.version,
                "purl": self._generate_purl(package),
                "bom-ref": f"pkg:{package.ecosystem.value}/{package.name}@{package.version}",
                "description": package.description or f"{package.name} package",
                "licenses": [{"id": package.license}] if package.license else [],
                "externalReferences": []
            }

            # Add external references
            if package.homepage:
                component["externalReferences"].append({
                    "type": "website",
                    "url": package.homepage
                })

            if package.repository_url:
                component["externalReferences"].append({
                    "type": "vcs",
                    "url": package.repository_url
                })

            # Add metadata if requested
            if include_metadata and package.metadata:
                component["properties"] = [
                    {"name": key, "value": str(value)}
                    for key, value in package.metadata.items()
                ]

            components.append(component)

        # Build CycloneDX SBOM
        sbom = {
            "bomFormat": "CycloneDX",
            "specVersion": "1.4",
            "serialNumber": f"urn:uuid:{bom_ref}",
            "version": 1,
            "metadata": {
                "timestamp": datetime.utcnow().isoformat(),
                "tools": [
                    {
                        "vendor": "Universal Dependency Platform",
                        "name": "UDP SBOM Generator",
                        "version": "1.0.0"
                    }
                ],
                "component": {
                    "type": "application",
                    "name": dependency_graph.project_id,
                    "version": "1.0.0",
                    "bom-ref": f"app:{dependency_graph.project_id}"
                }
            },
            "components": components,
            "dependencies": self._build_cyclonedx_dependencies(dependency_graph)
        }

        # Add organization metadata if requested
        if include_metadata:
            sbom["metadata"]["properties"] = [
                {"name": "organization_id", "value": str(self.organization_id)},
                {"name": "ecosystem", "value": dependency_graph.ecosystem.value},
                {"name": "total_packages", "value": str(len(dependency_graph.dependencies))}
            ]

        return sbom

    def _generate_spdx_sbom(
        self,
        dependency_graph: DependencyGraph,
        include_metadata: bool
    ) -> dict[str, Any]:
        """Generate SPDX format SBOM."""

        # Generate unique document namespace
        document_namespace = f"https://udp.dev/spdx/{uuid4()}"

        # Build packages list
        packages = []
        for package in dependency_graph.dependencies:
            spdx_package = {
                "SPDXID": f"SPDXRef-{package.name.replace('-', '_').replace('.', '_')}",
                "name": package.name,
                "versionInfo": package.version,
                "downloadLocation": "NOASSERTION",
                "filesAnalyzed": False,
                "licenseConcluded": package.license or "NOASSERTION",
                "licenseDeclared": package.license or "NOASSERTION",
                "copyrightText": "NOASSERTION",
                "description": package.description or f"{package.name} package",
                "externalRefs": []
            }

            # Add external references
            if package.homepage:
                spdx_package["externalRefs"].append({
                    "referenceCategory": "OTHER",
                    "referenceType": "website",
                    "referenceLocator": package.homepage
                })

            if package.repository_url:
                spdx_package["externalRefs"].append({
                    "referenceCategory": "OTHER",
                    "referenceType": "vcs",
                    "referenceLocator": package.repository_url
                })

            # Add package URL
            spdx_package["externalRefs"].append({
                "referenceCategory": "PACKAGE-MANAGER",
                "referenceType": "purl",
                "referenceLocator": self._generate_purl(package)
            })

            packages.append(spdx_package)

        # Build SPDX SBOM
        sbom = {
            "spdxVersion": "SPDX-2.3",
            "dataLicense": "CC0-1.0",
            "SPDXID": "SPDXRef-DOCUMENT",
            "name": f"SPDX Document for {dependency_graph.project_id}",
            "documentNamespace": document_namespace,
            "creationInfo": {
                "created": datetime.utcnow().isoformat(),
                "creators": [
                    "Tool: Universal Dependency Platform SBOM Generator-1.0.0",
                    f"Organization: {self.organization_id}"
                ],
                "licenseListVersion": "3.19"
            },
            "packages": packages,
            "relationships": self._build_spdx_relationships(dependency_graph)
        }

        return sbom

    def _generate_purl(self, package: Package) -> str:
        """Generate Package URL (purl) for a package."""
        ecosystem_mapping = {
            EcosystemType.NPM: "npm",
            EcosystemType.PYPI: "pypi",
            EcosystemType.MAVEN: "maven",
            EcosystemType.CARGO: "cargo",
            EcosystemType.NUGET: "nuget",
            EcosystemType.COMPOSER: "composer",
            EcosystemType.RUBYGEMS: "gem",
            EcosystemType.GO: "golang"
        }

        ecosystem = ecosystem_mapping.get(package.ecosystem, package.ecosystem.value)
        return f"pkg:{ecosystem}/{package.name}@{package.version}"

    def _build_cyclonedx_dependencies(self, dependency_graph: DependencyGraph) -> list[dict[str, Any]]:
        """Build CycloneDX dependencies structure."""
        dependencies = []

        # Add root dependency
        dependencies.append({
            "ref": f"app:{dependency_graph.project_id}",
            "dependsOn": [
                f"pkg:{package.ecosystem.value}/{package.name}@{package.version}"
                for package in dependency_graph.dependencies
            ]
        })

        return dependencies

    def _build_spdx_relationships(self, dependency_graph: DependencyGraph) -> list[dict[str, str]]:
        """Build SPDX relationships structure."""
        relationships = []

        # Add document describes relationship
        relationships.append({
            "spdxElementId": "SPDXRef-DOCUMENT",
            "relationshipType": "DESCRIBES",
            "relatedSpdxElement": f"SPDXRef-{dependency_graph.project_id.replace('-', '_')}"
        })

        # Add package relationships
        for package in dependency_graph.dependencies:
            relationships.append({
                "spdxElementId": f"SPDXRef-{dependency_graph.project_id.replace('-', '_')}",
                "relationshipType": "DEPENDS_ON",
                "relatedSpdxElement": f"SPDXRef-{package.name.replace('-', '_').replace('.', '_')}"
            })

        return relationships

    def export_sbom(self, sbom_data: dict[str, Any], format_type: str, output_path: str) -> None:
        """
        Export SBOM to file.

        Args:
            sbom_data: SBOM data to export
            format_type: Format type for file extension
            output_path: Output file path
        """
        logger.info(f"Exporting {format_type} SBOM to {output_path}")

        # Determine file extension
        if format_type == "cyclonedx":
            if not output_path.endswith('.json'):
                output_path += '.json'
        elif format_type == "spdx":
            if not output_path.endswith('.spdx.json'):
                output_path += '.spdx.json'

        # Write SBOM to file
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(sbom_data, f, indent=2, ensure_ascii=False)

        logger.info(f"SBOM exported successfully to {output_path}")

    def validate_sbom(self, sbom_data: dict[str, Any], format_type: str) -> dict[str, Any]:
        """
        Validate SBOM format and content.

        Args:
            sbom_data: SBOM data to validate
            format_type: Expected format type

        Returns:
            Validation results
        """
        validation_results = {
            "valid": True,
            "errors": [],
            "warnings": [],
            "format": format_type
        }

        try:
            if format_type == "cyclonedx":
                self._validate_cyclonedx_sbom(sbom_data, validation_results)
            elif format_type == "spdx":
                self._validate_spdx_sbom(sbom_data, validation_results)
            else:
                validation_results["valid"] = False
                validation_results["errors"].append(f"Unknown format: {format_type}")

        except Exception as e:
            validation_results["valid"] = False
            validation_results["errors"].append(f"Validation error: {str(e)}")

        return validation_results

    def _validate_cyclonedx_sbom(self, sbom_data: dict[str, Any], results: dict[str, Any]) -> None:
        """Validate CycloneDX SBOM format."""
        required_fields = ["bomFormat", "specVersion", "serialNumber", "version", "metadata", "components"]

        for field in required_fields:
            if field not in sbom_data:
                results["errors"].append(f"Missing required field: {field}")
                results["valid"] = False

        # Validate components
        if "components" in sbom_data:
            for i, component in enumerate(sbom_data["components"]):
                if "name" not in component:
                    results["errors"].append(f"Component {i} missing name")
                    results["valid"] = False

                if "version" not in component:
                    results["warnings"].append(f"Component {i} missing version")

    def _validate_spdx_sbom(self, sbom_data: dict[str, Any], results: dict[str, Any]) -> None:
        """Validate SPDX SBOM format."""
        required_fields = ["spdxVersion", "dataLicense", "SPDXID", "name", "documentNamespace", "creationInfo"]

        for field in required_fields:
            if field not in sbom_data:
                results["errors"].append(f"Missing required field: {field}")
                results["valid"] = False

        # Validate packages
        if "packages" in sbom_data:
            for i, package in enumerate(sbom_data["packages"]):
                if "SPDXID" not in package:
                    results["errors"].append(f"Package {i} missing SPDXID")
                    results["valid"] = False

                if "name" not in package:
                    results["errors"].append(f"Package {i} missing name")
                    results["valid"] = False
