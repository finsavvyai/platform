"""
Universal Package Manager service for cross-ecosystem dependency management.

Provides unified package management capabilities across npm, PyPI, Maven, Cargo,
and other ecosystems with intelligent conflict resolution and bridge generation.
"""

from datetime import datetime
from typing import Any, Optional
from uuid import UUID, uuid4

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from udp.bridges import PythonBridgeRuntime
from udp.core.config import settings
from udp.core.database import get_async_session
from udp.domain.models import EcosystemType, Package
from udp.infrastructure.models import (
    AuditLogModel,
    PolyglotProjectModel,
    UniversalPackageModel,
)
from udp.tools.ecosystems import EcosystemFactory
from udp.workflows.state import (
    CrossLanguageDependency,
    PolyglotProjectState,
    UniversalPackageIdentifier,
    UniversalPackageManager,
)

logger = structlog.get_logger()


class UniversalPackageManagerService:
    """
    Service for Universal Package Manager operations.

    Handles cross-ecosystem dependency resolution, polyglot project management,
    and universal package tracking with comprehensive audit logging.
    """

    def __init__(self, organization_id: UUID):
        self.organization_id = organization_id
        self.upm = UniversalPackageManager()
        self._python_bridge_runtime: Optional[PythonBridgeRuntime] = None

    async def create_universal_package(
        self,
        ecosystem: EcosystemType,
        name: str,
        version: str,
        namespace: Optional[str] = None,
        session: Optional[AsyncSession] = None
    ) -> UniversalPackageIdentifier:
        """Create and register a universal package identifier."""

        # Create universal identifier
        universal_id = self.upm.create_universal_identifier(
            ecosystem, name, version, namespace
        )

        # Store in database
        if session is None:
            async with get_async_session() as session:
                return await self._store_universal_package(universal_id, session)
        else:
            return await self._store_universal_package(universal_id, session)

    async def _store_universal_package(
        self,
        universal_id: UniversalPackageIdentifier,
        session: AsyncSession
    ) -> UniversalPackageIdentifier:
        """Store universal package in database."""

        # Check if package already exists
        stmt = select(UniversalPackageModel).where(
            UniversalPackageModel.registry_key == universal_id["registry_key"],
            UniversalPackageModel.organization_id == self.organization_id
        )
        result = await session.execute(stmt)
        existing_package = result.scalar_one_or_none()

        if existing_package:
            logger.debug(
                "Universal package already exists",
                registry_key=universal_id["registry_key"],
                organization_id=self.organization_id
            )
            return universal_id

        # Create new universal package record
        universal_package = UniversalPackageModel(
            registry_key=universal_id["registry_key"],
            ecosystem=universal_id["ecosystem"],
            namespace=universal_id["namespace"],
            name=universal_id["name"],
            version=universal_id["version"],
            organization_id=self.organization_id,
            bridge_mechanisms=[],
            compatibility_scores={},
            interop_metadata={},
            last_resolved_at=datetime.utcnow()
        )

        session.add(universal_package)
        await session.commit()

        # Log audit trail
        await self._log_universal_package_audit(
            action="create_universal_package",
            universal_package_key=universal_id["registry_key"],
            success=True,
            session=session
        )

        logger.info(
            "Created universal package",
            registry_key=universal_id["registry_key"],
            ecosystem=universal_id["ecosystem"].value,
            organization_id=self.organization_id
        )

        return universal_id

    async def resolve_polyglot_dependencies(
        self,
        manifest_files: dict[EcosystemType, list[str]],
        manifest_contents: dict[str, str],
        session: Optional[AsyncSession] = None
    ) -> dict[str, Any]:
        """
        Resolve dependencies across multiple ecosystems for a polyglot project.

        Args:
            manifest_files: Mapping of ecosystem to manifest file paths
            manifest_contents: Mapping of file path to content
            session: Optional database session

        Returns:
            Cross-ecosystem resolution result
        """

        if session is None:
            async with get_async_session() as session:
                return await self._resolve_polyglot_dependencies_impl(
                    manifest_files, manifest_contents, session
                )
        else:
            return await self._resolve_polyglot_dependencies_impl(
                manifest_files, manifest_contents, session
            )

    async def _resolve_polyglot_dependencies_impl(
        self,
        manifest_files: dict[EcosystemType, list[str]],
        manifest_contents: dict[str, str],
        session: AsyncSession
    ) -> dict[str, Any]:
        """Implementation of polyglot dependency resolution."""

        resolution_result = {
            "ecosystems": list(manifest_files.keys()),
            "resolved_packages": {},
            "cross_language_dependencies": [],
            "conflicts": [],
            "compatibility_matrix": {},
            "bridge_recommendations": [],
            "universal_lockfile": None,
            "resolution_strategy": "cross_ecosystem_sat_solving"
        }

        # Parse manifests for each ecosystem
        parsed_manifests = {}
        for ecosystem, file_paths in manifest_files.items():
            ecosystem_packages = []

            for file_path in file_paths:
                if file_path in manifest_contents:
                    try:
                        # Create ecosystem adapter
                        adapter = EcosystemFactory.create_adapter(ecosystem, self.organization_id)

                        # Parse manifest
                        parsed_manifest = await adapter.parse_manifest(
                            manifest_contents[file_path], file_path
                        )

                        # Resolve dependencies
                        resolution = await adapter.resolve_dependencies(
                            parsed_manifest, self.organization_id
                        )

                        ecosystem_packages.extend(resolution.resolved_dependencies)

                        # Store universal packages
                        for package in resolution.resolved_dependencies:
                            universal_id = await self.create_universal_package(
                                ecosystem, package.name, package.version,
                                package.namespace, session
                            )

                        await adapter.close()

                    except Exception as e:
                        logger.error(
                            "Failed to parse manifest",
                            file_path=file_path,
                            ecosystem=ecosystem.value,
                            error=str(e)
                        )
                        continue

            parsed_manifests[ecosystem] = ecosystem_packages
            resolution_result["resolved_packages"][ecosystem.value] = [
                pkg.dict() for pkg in ecosystem_packages
            ]

        # Calculate ecosystem compatibility matrix
        ecosystems = list(manifest_files.keys())
        for i, eco1 in enumerate(ecosystems):
            for j, eco2 in enumerate(ecosystems):
                if i <= j:  # Only calculate upper triangle + diagonal
                    compatibility = self.upm.calculate_ecosystem_compatibility(eco1, eco2)
                    resolution_result["compatibility_matrix"][f"{eco1.value}-{eco2.value}"] = compatibility

        # Detect cross-language dependencies and conflicts
        cross_deps, conflicts = await self._detect_cross_language_dependencies(
            parsed_manifests, session
        )

        resolution_result["cross_language_dependencies"] = [
            {
                "source": dep["source_package"]["registry_key"],
                "target": dep["target_package"]["registry_key"],
                "relationship_type": dep["relationship_type"],
                "bridge_mechanism": dep["bridge_mechanism"],
                "compatibility_score": dep["compatibility_score"]
            }
            for dep in cross_deps
        ]

        resolution_result["conflicts"] = conflicts

        # Generate bridge recommendations
        bridge_recommendations = await self._generate_bridge_recommendations(
            cross_deps, parsed_manifests
        )
        resolution_result["bridge_recommendations"] = bridge_recommendations

        # Generate universal lockfile
        universal_lockfile = await self._generate_universal_lockfile(
            parsed_manifests, cross_deps
        )
        resolution_result["universal_lockfile"] = universal_lockfile

        # Log audit trail
        await self._log_universal_package_audit(
            action="resolve_polyglot_dependencies",
            success=True,
            cross_ecosystem_operation=True,
            resolution_strategy="cross_ecosystem_sat_solving",
            ecosystem_compatibility_data=resolution_result["compatibility_matrix"],
            session=session
        )

        logger.info(
            "Completed polyglot dependency resolution",
            ecosystems=[eco.value for eco in ecosystems],
            total_packages=sum(len(pkgs) for pkgs in parsed_manifests.values()),
            cross_dependencies=len(cross_deps),
            conflicts=len(conflicts),
            organization_id=self.organization_id
        )

        return resolution_result

    async def _detect_cross_language_dependencies(
        self,
        parsed_manifests: dict[EcosystemType, list[Package]],
        session: AsyncSession
    ) -> tuple[list[CrossLanguageDependency], list[dict[str, Any]]]:
        """Detect cross-language dependencies and conflicts."""

        cross_dependencies = []
        conflicts = []

        # Simple heuristic: packages with similar names across ecosystems
        # In production, this would use more sophisticated analysis

        ecosystem_packages = {}
        for ecosystem, packages in parsed_manifests.items():
            ecosystem_packages[ecosystem] = {pkg.name.lower(): pkg for pkg in packages}

        ecosystems = list(parsed_manifests.keys())

        for i, eco1 in enumerate(ecosystems):
            for j, eco2 in enumerate(ecosystems):
                if i < j:  # Avoid duplicates
                    packages1 = ecosystem_packages[eco1]
                    packages2 = ecosystem_packages[eco2]

                    # Find packages with similar names
                    for name1, pkg1 in packages1.items():
                        for name2, pkg2 in packages2.items():
                            similarity = self._calculate_name_similarity(name1, name2)

                            if similarity > 0.8:  # High similarity threshold
                                # Create cross-language dependency
                                source_id = self.upm.create_universal_identifier(
                                    eco1, pkg1.name, pkg1.version, pkg1.namespace
                                )
                                target_id = self.upm.create_universal_identifier(
                                    eco2, pkg2.name, pkg2.version, pkg2.namespace
                                )

                                compatibility = self.upm.calculate_ecosystem_compatibility(eco1, eco2)

                                cross_dep = self.upm.create_cross_language_dependency(
                                    source_id, target_id, "runtime", None, compatibility
                                )

                                cross_dependencies.append(cross_dep)

                                # Check for version conflicts
                                if pkg1.version != pkg2.version:
                                    conflicts.append({
                                        "type": "cross_ecosystem_version_conflict",
                                        "package_name": name1,
                                        "ecosystem1": eco1.value,
                                        "version1": pkg1.version,
                                        "ecosystem2": eco2.value,
                                        "version2": pkg2.version,
                                        "severity": "medium"
                                    })

        return cross_dependencies, conflicts

    def _calculate_name_similarity(self, name1: str, name2: str) -> float:
        """Calculate similarity between package names."""
        # Simple Jaccard similarity for demonstration
        # In production, would use more sophisticated algorithms

        set1 = set(name1.lower())
        set2 = set(name2.lower())

        intersection = len(set1.intersection(set2))
        union = len(set1.union(set2))

        return intersection / union if union > 0 else 0.0

    async def _generate_bridge_recommendations(
        self,
        cross_dependencies: list[CrossLanguageDependency],
        parsed_manifests: dict[EcosystemType, list[Package]]
    ) -> list[dict[str, Any]]:
        """Generate bridge mechanism recommendations."""

        recommendations = []

        for cross_dep in cross_dependencies:
            source_eco = cross_dep["source_package"]["ecosystem"]
            target_eco = cross_dep["target_package"]["ecosystem"]

            # Recommend bridge mechanisms based on ecosystem compatibility
            bridge_mechanisms = []
            runtime_hint: Optional[dict[str, Any]] = None

            if source_eco == EcosystemType.PYPI and target_eco == EcosystemType.CARGO:
                bridge_mechanisms = ["pyo3", "ffi", "subprocess"]
            elif source_eco == EcosystemType.CARGO and target_eco == EcosystemType.PYPI:
                bridge_mechanisms = ["pyo3", "ffi", "wasm"]
            elif source_eco == EcosystemType.NPM and target_eco == EcosystemType.PYPI:
                bridge_mechanisms = ["child_process", "rest_api", "grpc"]
            elif source_eco == EcosystemType.PYPI and target_eco == EcosystemType.NPM:
                bridge_mechanisms = ["subprocess", "rest_api", "grpc"]
            elif source_eco == EcosystemType.MAVEN and target_eco == EcosystemType.NPM:
                bridge_mechanisms = ["graalvm", "rest_api", "grpc"]
            else:
                bridge_mechanisms = ["rest_api", "grpc", "message_queue"]

            if settings.bridge.enabled and {
                source_eco,
                target_eco,
            } == {EcosystemType.MAVEN, EcosystemType.PYPI}:
                python_modules = []
                if source_eco == EcosystemType.PYPI:
                    python_modules.append(
                        self._guess_python_module_name(
                            cross_dep["source_package"]["name"]
                        )
                    )
                if target_eco == EcosystemType.PYPI:
                    python_modules.append(
                        self._guess_python_module_name(
                            cross_dep["target_package"]["name"]
                        )
                    )
                runtime_hint = self._ensure_python_bridge_runtime(python_modules)

            recommendations.append({
                "source_package": cross_dep["source_package"]["registry_key"],
                "target_package": cross_dep["target_package"]["registry_key"],
                "recommended_bridges": bridge_mechanisms,
                "compatibility_score": cross_dep["compatibility_score"],
                "runtime": runtime_hint,
                "implementation_complexity": "medium"
            })

        return recommendations

    def _ensure_python_bridge_runtime(self, module_names: list[str]) -> Optional[dict[str, Any]]:
        filtered_modules = [name for name in module_names if name]
        if not filtered_modules:
            return None

        bridge_config = settings.bridge
        if not bridge_config.enabled:
            return None

        unique_modules = tuple(dict.fromkeys(
            list(bridge_config.preload_modules) + filtered_modules
        ))

        if self._python_bridge_runtime is None:
            self._python_bridge_runtime = PythonBridgeRuntime(
                host=bridge_config.host,
                port=bridge_config.port,
                preload_modules=unique_modules,
            )

        connection = self._python_bridge_runtime.start()
        self._python_bridge_runtime.ensure_modules(unique_modules)
        refreshed = self._python_bridge_runtime.connection_info

        return {
            "type": "py4j_python_bridge",
            "host": refreshed.host,
            "port": refreshed.port,
            "preload_modules": list(refreshed.preload_modules),
        }

    @staticmethod
    def _guess_python_module_name(package_name: str) -> str:
        return package_name.replace("-", "_")

    async def _generate_universal_lockfile(
        self,
        parsed_manifests: dict[EcosystemType, list[Package]],
        cross_dependencies: list[CrossLanguageDependency]
    ) -> dict[str, Any]:
        """Generate universal lockfile for polyglot project."""

        lockfile = {
            "version": "1.0",
            "generated_at": datetime.utcnow().isoformat(),
            "ecosystems": {},
            "cross_language_dependencies": [],
            "bridge_configurations": {},
            "resolution_metadata": {
                "strategy": "cross_ecosystem_sat_solving",
                "total_packages": sum(len(pkgs) for pkgs in parsed_manifests.values()),
                "total_ecosystems": len(parsed_manifests)
            }
        }

        # Add ecosystem-specific packages
        for ecosystem, packages in parsed_manifests.items():
            lockfile["ecosystems"][ecosystem.value] = {
                "packages": {
                    pkg.name: {
                        "version": pkg.version,
                        "namespace": pkg.namespace,
                        "registry_key": f"{ecosystem.value}:{pkg.namespace + '/' if pkg.namespace else ''}{pkg.name}@{pkg.version}",
                        "checksum": pkg.checksum,
                        "license": pkg.license.value if pkg.license else "UNKNOWN"
                    }
                    for pkg in packages
                }
            }

        # Add cross-language dependencies
        for cross_dep in cross_dependencies:
            lockfile["cross_language_dependencies"].append({
                "source": cross_dep["source_package"]["registry_key"],
                "target": cross_dep["target_package"]["registry_key"],
                "relationship_type": cross_dep["relationship_type"],
                "bridge_mechanism": cross_dep["bridge_mechanism"],
                "compatibility_score": cross_dep["compatibility_score"]
            })

        return lockfile

    async def _log_universal_package_audit(
        self,
        action: str,
        success: bool = True,
        universal_package_key: Optional[str] = None,
        cross_ecosystem_operation: bool = False,
        polyglot_project_id: Optional[UUID] = None,
        bridge_mechanism_used: Optional[str] = None,
        resolution_strategy: Optional[str] = None,
        ecosystem_compatibility_data: Optional[dict[str, Any]] = None,
        session: Optional[AsyncSession] = None
    ) -> None:
        """Log universal package manager audit trail."""

        audit_log = AuditLogModel(
            organization_id=self.organization_id,
            entity_type="universal_package_manager",
            entity_id=None,
            action=action,
            user_id="system",  # System-initiated action
            success=success,
            request_id=str(uuid4()),
            universal_package_registry_key=universal_package_key,
            cross_ecosystem_operation=cross_ecosystem_operation,
            polyglot_project_id=polyglot_project_id,
            bridge_mechanism_used=bridge_mechanism_used,
            resolution_strategy=resolution_strategy,
            ecosystem_compatibility_data=ecosystem_compatibility_data
        )

        if session:
            session.add(audit_log)
            await session.commit()
        else:
            async with get_async_session() as new_session:
                new_session.add(audit_log)
                await new_session.commit()

    async def create_polyglot_project(
        self,
        project_name: str,
        languages: list[EcosystemType],
        manifest_files: dict[EcosystemType, list[str]],
        session: Optional[AsyncSession] = None
    ) -> PolyglotProjectState:
        """Create a new polyglot project configuration."""

        if session is None:
            async with get_async_session() as session:
                return await self._create_polyglot_project_impl(
                    project_name, languages, manifest_files, session
                )
        else:
            return await self._create_polyglot_project_impl(
                project_name, languages, manifest_files, session
            )

    async def _create_polyglot_project_impl(
        self,
        project_name: str,
        languages: list[EcosystemType],
        manifest_files: dict[EcosystemType, list[str]],
        session: AsyncSession
    ) -> PolyglotProjectState:
        """Implementation of polyglot project creation."""

        # Create polyglot project record
        polyglot_project = PolyglotProjectModel(
            project_name=project_name,
            organization_id=self.organization_id,
            project_languages=[lang.value for lang in languages],
            manifest_files={lang.value: files for lang, files in manifest_files.items()},
            lockfile_version="1.0",
            lockfile_updated_at=datetime.utcnow()
        )

        session.add(polyglot_project)
        await session.commit()

        # Initialize polyglot project state
        project_state = self.upm.initialize_polyglot_project(languages, manifest_files)

        # Log audit trail
        await self._log_universal_package_audit(
            action="create_polyglot_project",
            success=True,
            polyglot_project_id=polyglot_project.id,
            cross_ecosystem_operation=True,
            session=session
        )

        logger.info(
            "Created polyglot project",
            project_name=project_name,
            languages=[lang.value for lang in languages],
            organization_id=self.organization_id
        )

        return project_state

    async def get_universal_packages(
        self,
        ecosystem: Optional[EcosystemType] = None,
        session: Optional[AsyncSession] = None
    ) -> list[UniversalPackageIdentifier]:
        """Get universal packages for the organization."""

        if session is None:
            async with get_async_session() as session:
                return await self._get_universal_packages_impl(ecosystem, session)
        else:
            return await self._get_universal_packages_impl(ecosystem, session)

    async def _get_universal_packages_impl(
        self,
        ecosystem: Optional[EcosystemType],
        session: AsyncSession
    ) -> list[UniversalPackageIdentifier]:
        """Implementation of get universal packages."""

        stmt = select(UniversalPackageModel).where(
            UniversalPackageModel.organization_id == self.organization_id
        )

        if ecosystem:
            stmt = stmt.where(UniversalPackageModel.ecosystem == ecosystem)

        result = await session.execute(stmt)
        packages = result.scalars().all()

        return [
            self.upm.create_universal_identifier(
                pkg.ecosystem, pkg.name, pkg.version, pkg.namespace
            )
            for pkg in packages
        ]
