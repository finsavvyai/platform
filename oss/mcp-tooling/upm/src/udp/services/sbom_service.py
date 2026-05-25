"""
SBOM (Software Bill of Materials) Service.

Enterprise-grade SBOM generation, management, and analysis service
supporting multiple formats (CycloneDX, SPDX, SWID) with advanced
comparison and diff capabilities.
"""

import json
import logging
from datetime import datetime
from typing import Any, Optional
from uuid import UUID, uuid4

from sqlalchemy import desc, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from udp.core.models import SBOM, Analysis, Dependency, Project
from udp.domain.models import DependencyGraph, EcosystemType
from udp.domain.models import Package as DomainPackage
from udp.services.base import BaseAsyncService
from udp.tools.sbom_generator import SBOMGenerator

logger = logging.getLogger(__name__)


class SBOMFormat:
    """Supported SBOM formats."""

    CYCLEDX = "cyclonedx"
    SPDX = "spdx"
    SWID = "swid"


class SBOMDiffResult:
    """Result of SBOM comparison."""

    def __init__(self):
        self.added_components: list[dict] = []
        self.removed_components: list[dict] = []
        self.modified_components: list[dict] = []
        self.license_changes: list[dict] = []
        self.version_changes: list[dict] = []
        self.vulnerability_changes: list[dict] = []
        self.compliance_impact: dict[str, Any] = {}
        self.risk_assessment: dict[str, Any] = {}

    @property
    def has_changes(self) -> bool:
        """Check if there are any changes."""
        return any(
            [
                self.added_components,
                self.removed_components,
                self.modified_components,
                self.license_changes,
                self.version_changes,
                self.vulnerability_changes,
            ]
        )

    @property
    def total_changes(self) -> int:
        """Get total number of changes."""
        return sum(
            [
                len(self.added_components),
                len(self.removed_components),
                len(self.modified_components),
                len(self.license_changes),
                len(self.version_changes),
                len(self.vulnerability_changes),
            ]
        )


class SBOMService(BaseAsyncService):
    """
    Enterprise SBOM management service.

    Provides comprehensive SBOM generation, tracking, comparison,
    and analysis capabilities with support for multiple formats
    and enterprise compliance requirements.
    """

    def __init__(self, db: AsyncSession, organization_id: Optional[UUID] = None):
        super().__init__(db)
        self.organization_id = organization_id
        self.sbom_generator = (
            SBOMGenerator(organization_id) if organization_id else None
        )

    async def generate_sbom(
        self,
        project_id: UUID,
        format_type: str = SBOMFormat.CYCLEDX,
        include_transitive: bool = True,
        include_vulnerabilities: bool = True,
        include_licenses: bool = True,
        custom_metadata: Optional[dict[str, Any]] = None,
    ) -> SBOM:
        """
        Generate SBOM for a project.

        Args:
            project_id: Project ID to generate SBOM for
            format_type: SBOM format (cyclonedx, spdx, swid)
            include_transitive: Include transitive dependencies
            include_vulnerabilities: Include vulnerability information
            include_licenses: Include license information
            custom_metadata: Additional metadata to include

        Returns:
            Generated SBOM record
        """
        logger.info(f"Generating {format_type} SBOM for project {project_id}")

        # Get project with dependencies
        project = await self.db.get(
            Project, project_id, options=[selectinload(Project.dependencies)]
        )
        if not project:
            raise ValueError(f"Project {project_id} not found")

        # Build dependency graph
        dependency_graph = await self._build_dependency_graph(
            project_id, include_transitive=include_transitive
        )

        # Generate SBOM data
        if format_type == SBOMFormat.SWID:
            sbom_data = await self._generate_swid_sbom(
                project, dependency_graph, custom_metadata
            )
        else:
            if not self.sbom_generator:
                raise ValueError("SBOM generator not initialized")

            sbom_data = self.sbom_generator.generate_sbom(
                dependency_graph=dependency_graph,
                format_type=format_type,
                include_metadata=True,
            )

            # Add additional enterprise metadata
            if custom_metadata:
                sbom_data["metadata"]["properties"].extend(
                    [
                        {"name": key, "value": str(value)}
                        for key, value in custom_metadata.items()
                    ]
                )

        # Add vulnerability and license information if requested
        if include_vulnerabilities:
            sbom_data = await self._enrich_with_vulnerabilities(
                sbom_data, dependency_graph
            )

        if include_licenses:
            sbom_data = await self._enrich_with_licenses(sbom_data, dependency_graph)

        # Create SBOM record
        sbom = SBOM(
            sbom_id=f"sbom-{uuid4()}",
            format=format_type,
            version=self._get_format_version(format_type),
            target_type="project",
            target_id=project_id,
            target_name=project.name,
            sbom_data=sbom_data,
            raw_content=json.dumps(sbom_data, indent=2),
            total_components=len(dependency_graph.dependencies),
            direct_dependencies=0,  # TODO: Calculate from dependency graph
            transitive_dependencies=0,  # TODO: Calculate from dependency graph
            generated_at=datetime.utcnow().isoformat(),
            generator="Universal Dependency Platform v1.0.0",
        )

        self.db.add(sbom)
        await self.db.commit()
        await self.db.refresh(sbom)

        # Create analysis record
        analysis = Analysis(
            analysis_id=f"analysis-sbom-{uuid4()}",
            name=f"SBOM Generation - {format_type.upper()}",
            analysis_type=AnalysisType.SBOM,
            target_type="project",
            target_id=project_id,
            status=AnalysisStatus.COMPLETED,
            started_at=datetime.utcnow().isoformat(),
            completed_at=datetime.utcnow().isoformat(),
            scanner_version="1.0.0",
        )

        self.db.add(analysis)
        await self.db.commit()

        logger.info(f"SBOM generated successfully: {sbom.id}")
        return sbom

    async def get_sbom(
        self, sbom_id: UUID, include_raw: bool = False
    ) -> Optional[SBOM]:
        """
        Get SBOM by ID.

        Args:
            sbom_id: SBOM ID
            include_raw: Whether to include raw content

        Returns:
            SBOM record or None if not found
        """
        query = self.db.query(SBOM).filter(SBOM.id == sbom_id)

        if not include_raw:
            query = query.with_entities(
                SBOM.id,
                SBOM.sbom_id,
                SBOM.format,
                SBOM.version,
                SBOM.target_type,
                SBOM.target_id,
                SBOM.target_name,
                SBOM.total_components,
                SBOM.direct_dependencies,
                SBOM.transitive_dependencies,
                SBOM.generated_at,
                SBOM.generator,
                SBOM.created_at,
                SBOM.updated_at,
            )

        return await query.first()

    async def list_sboms(
        self,
        target_id: Optional[UUID] = None,
        target_type: Optional[str] = None,
        format_type: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
        order_by: str = "generated_at",
    ) -> tuple[list[SBOM], int]:
        """
        List SBOMs with filtering and pagination.

        Args:
            target_id: Filter by target ID
            target_type: Filter by target type
            format_type: Filter by format type
            limit: Maximum number of results
            offset: Number of results to skip
            order_by: Field to order by

        Returns:
            Tuple of (SBOM list, total count)
        """
        query = self.db.query(SBOM)
        count_query = self.db.query(func.count(SBOM.id))

        # Apply filters
        if target_id:
            query = query.filter(SBOM.target_id == target_id)
            count_query = count_query.filter(SBOM.target_id == target_id)

        if target_type:
            query = query.filter(SBOM.target_type == target_type)
            count_query = count_query.filter(SBOM.target_type == target_type)

        if format_type:
            query = query.filter(SBOM.format == format_type)
            count_query = count_query.filter(SBOM.format == format_type)

        # Get total count
        total = await count_query.scalar()

        # Apply ordering
        if order_by == "generated_at":
            query = query.order_by(desc(SBOM.generated_at))
        elif order_by == "created_at":
            query = query.order_by(desc(SBOM.created_at))
        elif order_by == "total_components":
            query = query.order_by(desc(SBOM.total_components))

        # Apply pagination
        sboms = await query.offset(offset).limit(limit).all()

        return sboms, total

    async def compare_sboms(
        self, sbom_id1: UUID, sbom_id2: UUID, deep_analysis: bool = True
    ) -> SBOMDiffResult:
        """
        Compare two SBOMs and identify differences.

        Args:
            sbom_id1: First SBOM ID
            sbom_id2: Second SBOM ID
            deep_analysis: Perform deep analysis including vulnerabilities

        Returns:
            SBOM comparison result
        """
        logger.info(f"Comparing SBOMs {sbom_id1} and {sbom_id2}")

        # Get SBOMs
        sbom1 = await self.get_sbom(sbom_id1, include_raw=True)
        sbom2 = await self.get_sbom(sbom_id2, include_raw=True)

        if not sbom1 or not sbom2:
            raise ValueError("One or both SBOMs not found")

        diff = SBOMDiffResult()

        # Compare components
        components1 = {
            c.get("name", ""): c for c in sbom1.sbom_data.get("components", [])
        }
        components2 = {
            c.get("name", ""): c for c in sbom2.sbom_data.get("components", [])
        }

        # Find added components
        for name, component in components2.items():
            if name not in components1:
                diff.added_components.append(component)

        # Find removed components
        for name, component in components1.items():
            if name not in components2:
                diff.removed_components.append(component)

        # Find modified components
        for name in components1.keys() & components2.keys():
            comp1 = components1[name]
            comp2 = components2[name]

            if comp1.get("version") != comp2.get("version"):
                diff.version_changes.append(
                    {
                        "name": name,
                        "old_version": comp1.get("version"),
                        "new_version": comp2.get("version"),
                        "component": comp2,
                    }
                )

            if comp1.get("licenses") != comp2.get("licenses"):
                diff.license_changes.append(
                    {
                        "name": name,
                        "old_licenses": comp1.get("licenses", []),
                        "new_licenses": comp2.get("licenses", []),
                        "component": comp2,
                    }
                )

            # Check if component has other significant changes
            if self._has_significant_changes(comp1, comp2):
                diff.modified_components.append(
                    {
                        "name": name,
                        "changes": self._get_component_changes(comp1, comp2),
                        "component": comp2,
                    }
                )

        # Deep analysis if requested
        if deep_analysis:
            await self._perform_vulnerability_analysis(diff, sbom1, sbom2)
            await self._assess_compliance_impact(diff, sbom1, sbom2)
            await self._calculate_risk_assessment(diff, sbom1, sbom2)

        logger.info(f"SBOM comparison complete: {diff.total_changes} changes found")
        return diff

    async def delete_sbom(self, sbom_id: UUID) -> bool:
        """
        Delete an SBOM.

        Args:
            sbom_id: SBOM ID to delete

        Returns:
            True if deleted, False if not found
        """
        sbom = await self.db.get(SBOM, sbom_id)
        if not sbom:
            return False

        await self.db.delete(sbom)
        await self.db.commit()

        logger.info(f"SBOM {sbom_id} deleted")
        return True

    async def export_sbom(
        self,
        sbom_id: UUID,
        format_type: Optional[str] = None,
        output_format: str = "json",
    ) -> dict[str, Any]:
        """
        Export SBOM in specified format.

        Args:
            sbom_id: SBOM ID
            format_type: Target format (if different from original)
            output_format: Output format (json, xml, yaml)

        Returns:
            Exported SBOM data
        """
        sbom = await self.get_sbom(sbom_id, include_raw=True)
        if not sbom:
            raise ValueError(f"SBOM {sbom_id} not found")

        # Convert format if needed
        if format_type and format_type != sbom.format:
            sbom_data = await self._convert_sbom_format(
                sbom.sbom_data, sbom.format, format_type
            )
        else:
            sbom_data = sbom.sbom_data

        # Convert output format if needed
        if output_format == "json":
            return sbom_data
        elif output_format == "yaml":
            import yaml

            return yaml.dump(sbom_data, default_flow_style=False)
        elif output_format == "xml" and sbom.format == SBOMFormat.CYCLEDX:
            return await self._convert_cyclonedx_to_xml(sbom_data)
        else:
            return sbom_data

    async def validate_sbom(
        self, sbom_data: dict[str, Any], format_type: str
    ) -> dict[str, Any]:
        """
        Validate SBOM format and content.

        Args:
            sbom_data: SBOM data to validate
            format_type: Expected format type

        Returns:
            Validation results
        """
        if not self.sbom_generator:
            raise ValueError("SBOM generator not initialized")

        return self.sbom_generator.validate_sbom(sbom_data, format_type)

    async def _build_dependency_graph(
        self, project_id: UUID, include_transitive: bool = True
    ) -> DependencyGraph:
        """Build dependency graph for a project."""
        # Get project dependencies
        dependencies = await self.db.execute(
            select(Dependency)
            .where(Dependency.project_id == project_id)
            .options(selectinload(Dependency.package))
        )
        dependencies = dependencies.scalars().all()

        # Convert to domain packages
        packages = []
        for dep in dependencies:
            if dep.package:
                package = DomainPackage(
                    id=dep.package.id,
                    name=dep.package.name,
                    version=dep.version,
                    ecosystem=EcosystemType(dep.package.ecosystem),
                    description=dep.package.description,
                    homepage=dep.package.homepage,
                    repository_url=dep.package.repository_url,
                    license=dep.package.license,
                    metadata=dep.package.metadata or {},
                )
                packages.append(package)

        return DependencyGraph(
            project_id=str(project_id),
            ecosystem=EcosystemType.NPM,  # TODO: Get from project
            dependencies=packages,
        )

    async def _generate_swid_sbom(
        self,
        project: Project,
        dependency_graph: DependencyGraph,
        custom_metadata: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """Generate SWID format SBOM."""
        swid = {
            "software_identity": {
                "tag_id": f"swid-{uuid4()}",
                "software_name": project.name,
                "software_version": "1.0.0",  # TODO: Get from project
                "tag_version": 0,
                "software_creator": "Universal Dependency Platform",
                "entity": [
                    {
                        "name": dep.name,
                        "regid": f"upm.dev/{dep.ecosystem.value}",
                        "role": "softwareCreator",
                        "version": dep.version,
                    }
                    for dep in dependency_graph.dependencies
                ],
                "link": [
                    {
                        "rel": "component",
                        "href": f"pkg:{dep.ecosystem.value}/{dep.name}@{dep.version}",
                    }
                    for dep in dependency_graph.dependencies
                ],
            }
        }

        return swid

    async def _enrich_with_vulnerabilities(
        self, sbom_data: dict[str, Any], dependency_graph: DependencyGraph
    ) -> dict[str, Any]:
        """Enrich SBOM with vulnerability information."""
        # TODO: Integrate with security service
        # For now, add empty vulnerability data
        for component in sbom_data.get("components", []):
            component["vulnerabilities"] = []

        return sbom_data

    async def _enrich_with_licenses(
        self, sbom_data: dict[str, Any], dependency_graph: DependencyGraph
    ) -> dict[str, Any]:
        """Enrich SBOM with license information."""
        # Licenses are already included from the generator
        return sbom_data

    def _get_format_version(self, format_type: str) -> str:
        """Get version for format type."""
        versions = {
            SBOMFormat.CYCLEDX: "1.4",
            SBOMFormat.SPDX: "2.3",
            SBOMFormat.SWID: "1.0",
        }
        return versions.get(format_type, "1.0")

    def _has_significant_changes(self, comp1: dict, comp2: dict) -> bool:
        """Check if component has significant changes."""
        # Check for changes beyond version and licenses
        significant_fields = ["hashes", "copyright", "description"]

        for field in significant_fields:
            if comp1.get(field) != comp2.get(field):
                return True

        return False

    def _get_component_changes(self, comp1: dict, comp2: dict) -> list[dict]:
        """Get list of changes between components."""
        changes = []

        all_keys = set(comp1.keys()) | set(comp2.keys())

        for key in all_keys:
            if key not in ["name", "version", "licenses"]:
                val1 = comp1.get(key)
                val2 = comp2.get(key)

                if val1 != val2:
                    changes.append({"field": key, "old_value": val1, "new_value": val2})

        return changes

    async def _perform_vulnerability_analysis(
        self, diff: SBOMDiffResult, sbom1: SBOM, sbom2: SBOM
    ) -> None:
        """Perform vulnerability analysis on SBOM differences."""
        # TODO: Integrate with security service to analyze vulnerability changes
        pass

    async def _assess_compliance_impact(
        self, diff: SBOMDiffResult, sbom1: SBOM, sbom2: SBOM
    ) -> None:
        """Assess compliance impact of SBOM changes."""
        # TODO: Integrate with compliance service
        diff.compliance_impact = {
            "license_compliance_changes": [],
            "policy_violations": [],
            "approval_required": False,
        }

    async def _calculate_risk_assessment(
        self, diff: SBOMDiffResult, sbom1: SBOM, sbom2: SBOM
    ) -> None:
        """Calculate risk assessment for SBOM changes."""
        # Simple risk calculation based on changes
        risk_score = 0

        # Added components increase risk
        risk_score += len(diff.added_components) * 2

        # Version changes increase risk
        risk_score += len(diff.version_changes) * 3

        # License changes increase risk
        risk_score += len(diff.license_changes) * 4

        # Vulnerability changes significantly increase risk
        risk_score += len(diff.vulnerability_changes) * 10

        diff.risk_assessment = {
            "risk_score": min(risk_score, 100),
            "risk_level": "low"
            if risk_score < 20
            else "medium"
            if risk_score < 50
            else "high",
            "factors": {
                "added_components": len(diff.added_components),
                "version_changes": len(diff.version_changes),
                "license_changes": len(diff.license_changes),
                "vulnerability_changes": len(diff.vulnerability_changes),
            },
        }

    async def _convert_sbom_format(
        self, sbom_data: dict[str, Any], from_format: str, to_format: str
    ) -> dict[str, Any]:
        """Convert SBOM from one format to another."""
        # TODO: Implement format conversion
        # For now, return as-is
        return sbom_data

    async def _convert_cyclonedx_to_xml(self, sbom_data: dict[str, Any]) -> str:
        """Convert CycloneDX JSON to XML."""
        # TODO: Implement XML conversion
        # For now, return JSON string
        return json.dumps(sbom_data, indent=2)
