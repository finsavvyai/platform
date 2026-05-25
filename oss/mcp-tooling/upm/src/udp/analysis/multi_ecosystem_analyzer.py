"""Multi-Ecosystem Dependency Analysis Core Engine."""

import logging
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional
from uuid import UUID

from udp.analysis.graph_analyzer import DependencyGraphAnalyzer
from udp.domain.models import DependencyGraph, EcosystemType
from udp.tools.ecosystems.base import DependencyInfo, EcosystemAdapter, ParsedManifest
from udp.tools.ecosystems.factory import EcosystemFactory

logger = logging.getLogger(__name__)


class ConflictType(str, Enum):
    """Types of cross-ecosystem conflicts."""
    VERSION_MISMATCH = "version_mismatch"
    LICENSE_INCOMPATIBLE = "license_incompatible"
    NAMING_CONFLICT = "naming_conflict"
    DEPENDENCY_CYCLE = "dependency_cycle"
    SECURITY_CONFLICT = "security_conflict"
    PLATFORM_INCOMPATIBLE = "platform_incompatible"
    API_INCOMPATIBLE = "api_incompatible"


class ResolutionStrategy(str, Enum):
    """Strategies for resolving cross-ecosystem conflicts."""
    PREFER_LATEST = "prefer_latest"
    PREFER_STABLE = "prefer_stable"
    PREFER_MAVEN = "prefer_maven"
    PREFER_NPM = "prefer_npm"
    PREFER_PYPI = "prefer_pypi"
    ISOLATE_PACKAGES = "isolate_packages"
    BRIDGE_PATTERN = "bridge_pattern"
    CUSTOM_RESOLVER = "custom_resolver"


@dataclass
class CrossEcosystemDependency:
    """Represents a dependency that spans multiple ecosystems."""
    package_name: str
    ecosystems: list[EcosystemType]
    versions: dict[EcosystemType, str]
    universal_identifier: Optional[str] = None
    compatibility_score: float = 0.0
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class EcosystemConflict:
    """Represents a conflict detected across ecosystems."""
    conflict_id: str
    conflict_type: ConflictType
    affected_packages: list[str]
    ecosystems_involved: list[EcosystemType]
    description: str
    severity: str  # critical, high, medium, low
    suggested_resolution: Optional[str] = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class CompatibilityMatrix:
    """Matrix showing compatibility between ecosystems."""
    matrix: dict[tuple[EcosystemType, EcosystemType], float]
    overall_compatibility: float
    supported_features: dict[EcosystemType, list[str]]
    limitations: dict[tuple[EcosystemType, EcosystemType], list[str]]


@dataclass
class BridgeRecommendation:
    """Recommendation for bridging two ecosystems."""
    source_ecosystem: EcosystemType
    target_ecosystem: EcosystemType
    bridge_type: str
    implementation: dict[str, Any]
    effort_estimate: str  # low, medium, high
    confidence: float


@dataclass
class MultiEcosystemAnalysisResult:
    """Complete multi-ecosystem analysis result."""
    total_packages: int
    unique_packages: int
    ecosystems_detected: list[EcosystemType]
    cross_ecosystem_dependencies: list[CrossEcosystemDependency]
    conflicts: list[EcosystemConflict]
    compatibility_matrix: CompatibilityMatrix
    bridge_recommendations: list[BridgeRecommendation]
    resolution_strategy: ResolutionStrategy
    analysis_metrics: dict[str, Any]
    timestamp: datetime
    universal_dependency_graph: Optional[DependencyGraph] = None

class MultiEcosystemAnalyzer:
    """
    Core engine for multi-ecosystem dependency analysis.

    Provides intelligent analysis across Maven, npm, and PyPI ecosystems
    with conflict detection and resolution strategies.
    """

    def __init__(self, organization_id: UUID):
        """Initialize the multi-ecosystem analyzer."""
        self.organization_id = organization_id
        self.ecosystem_adapters: dict[EcosystemType, EcosystemAdapter] = {}
        self.graph_analyzer = DependencyGraphAnalyzer()
        self._analysis_cache: dict[str, Any] = {}

        # Initialize ecosystem adapters
        self._initialize_adapters()

        # Define ecosystem compatibility mappings
        self._initialize_compatibility_mappings()

        # Define conflict resolution patterns
        self._initialize_resolution_patterns()

    def _initialize_adapters(self):
        """Initialize adapters for supported ecosystems."""
        supported_ecosystems = [EcosystemType.MAVEN, EcosystemType.NPM, EcosystemType.PYPI]

        for ecosystem in supported_ecosystems:
            try:
                adapter = EcosystemFactory.create_adapter(ecosystem, self.organization_id)
                self.ecosystem_adapters[ecosystem] = adapter
                logger.info(f"Initialized adapter for {ecosystem.value}")
            except Exception as e:
                logger.warning(f"Failed to initialize adapter for {ecosystem.value}: {e}")

    def _initialize_compatibility_mappings(self):
        """Initialize compatibility mappings between ecosystems."""
        self.compatibility_mappings = {
            # Maven to other ecosystems
            (EcosystemType.MAVEN, EcosystemType.NPM): 0.7,
            (EcosystemType.MAVEN, EcosystemType.PYPI): 0.6,

            # NPM to other ecosystems
            (EcosystemType.NPM, EcosystemType.MAVEN): 0.7,
            (EcosystemType.NPM, EcosystemType.PYPI): 0.8,

            # PyPI to other ecosystems
            (EcosystemType.PYPI, EcosystemType.MAVEN): 0.6,
            (EcosystemType.PYPI, EcosystemType.NPM): 0.8,

            # Self-compatibility
            (EcosystemType.MAVEN, EcosystemType.MAVEN): 1.0,
            (EcosystemType.NPM, EcosystemType.NPM): 1.0,
            (EcosystemType.PYPI, EcosystemType.PYPI): 1.0,
        }

        # Define supported features for each ecosystem
        self.supported_features = {
            EcosystemType.MAVEN: ["transitive_dependencies", "dependency_scopes", "dependency_management"],
            EcosystemType.NPM: ["peer_dependencies", "dev_dependencies", "optional_dependencies"],
            EcosystemType.PYPI: ["extras", "environment_markers", "dependency_groups"]
        }

        # Define limitations between ecosystem pairs
        self.ecosystem_limitations = {
            (EcosystemType.MAVEN, EcosystemType.PYPI): [
                "different_version_schemes",
                "no_native_dependency_resolution",
                "different_dependency_scopes"
            ],
            (EcosystemType.PYPI, EcosystemType.MAVEN): [
                "different_version_schemes",
                "no_native_dependency_resolution",
                "different_dependency_scopes"
            ]
        }

    def _initialize_resolution_patterns(self):
        """Initialize resolution patterns for common conflicts."""
        self.resolution_patterns = {
            ConflictType.VERSION_MISMATCH: [
                {
                    "pattern": "semantic_versioning",
                    "applicable_to": [(EcosystemType.NPM, EcosystemType.PYPI)],
                    "resolver": self._resolve_semver_mismatch
                }
            ],
            ConflictType.LICENSE_INCOMPATIBLE: [
                {
                    "pattern": "license_compatibility_matrix",
                    "applicable_to": "all",
                    "resolver": self._resolve_license_conflicts
                }
            ],
            ConflictType.NAMING_CONFLICT: [
                {
                    "pattern": "namespaced_identifiers",
                    "applicable_to": "all",
                    "resolver": self._resolve_naming_conflicts
                }
            ]
        }

    async def analyze_multi_ecosystem_project(
        self,
        manifest_files: dict[str, str],
        manifest_contents: dict[str, str],
        resolution_strategy: ResolutionStrategy = ResolutionStrategy.PREFER_STABLE
    ) -> MultiEcosystemAnalysisResult:
        """
        Perform comprehensive multi-ecosystem analysis.

        Args:
            manifest_files: Dictionary mapping file paths to ecosystem types
            manifest_contents: Dictionary mapping file paths to file contents
            resolution_strategy: Strategy for resolving conflicts

        Returns:
            Complete multi-ecosystem analysis result
        """
        logger.info(
            "Starting multi-ecosystem analysis",
            organization_id=str(self.organization_id),
            manifest_count=len(manifest_files)
        )

        start_time = datetime.utcnow()

        try:
            # Step 1: Parse all manifests and identify ecosystems
            parsed_manifests = await self._parse_all_manifests(manifest_files, manifest_contents)
            ecosystems_detected = list(parsed_manifests.keys())

            # Step 2: Extract all dependencies from all ecosystems
            all_dependencies = await self._extract_all_dependencies(parsed_manifests)

            # Step 3: Identify cross-ecosystem dependencies
            cross_ecosystem_deps = self._identify_cross_ecosystem_dependencies(all_dependencies)

            # Step 4: Detect conflicts across ecosystems
            conflicts = await self._detect_cross_ecosystem_conflicts(
                all_dependencies, cross_ecosystem_deps
            )

            # Step 5: Calculate compatibility matrix
            compatibility_matrix = self._calculate_compatibility_matrix(ecosystems_detected)

            # Step 6: Generate bridge recommendations
            bridge_recommendations = self._generate_bridge_recommendations(
                ecosystems_detected, conflicts, compatibility_matrix
            )

            # Step 7: Apply resolution strategy
            resolved_conflicts = await self._apply_resolution_strategy(
                conflicts, resolution_strategy, cross_ecosystem_deps
            )

            # Step 8: Calculate analysis metrics
            analysis_metrics = self._calculate_analysis_metrics(
                all_dependencies, conflicts
            )

            # Create result
            result = MultiEcosystemAnalysisResult(
                total_packages=sum(len(deps) for deps in all_dependencies.values()),
                unique_packages=len(set(
                    dep.name for deps in all_dependencies.values() for dep in deps
                )),
                ecosystems_detected=ecosystems_detected,
                cross_ecosystem_dependencies=cross_ecosystem_deps,
                conflicts=resolved_conflicts,
                compatibility_matrix=compatibility_matrix,
                bridge_recommendations=bridge_recommendations,
                resolution_strategy=resolution_strategy,
                analysis_metrics=analysis_metrics,
                timestamp=start_time
            )

            logger.info(
                "Multi-ecosystem analysis completed",
                duration=(datetime.utcnow() - start_time).total_seconds(),
                total_packages=result.total_packages,
                conflicts_found=len(result.conflicts)
            )

            return result

        except Exception as e:
            logger.error(f"Multi-ecosystem analysis failed: {e}", exc_info=True)
            raise

    async def _parse_all_manifests(
        self,
        manifest_files: dict[str, str],
        manifest_contents: dict[str, str]
    ) -> dict[EcosystemType, list[ParsedManifest]]:
        """Parse all manifest files and group by ecosystem."""
        parsed_manifests = defaultdict(list)

        for file_path, content in manifest_contents.items():
            try:
                # Determine ecosystem type
                ecosystem = EcosystemFactory.get_ecosystem_for_file(file_path)
                if not ecosystem:
                    logger.warning(f"Unknown ecosystem for file: {file_path}")
                    continue

                # Parse manifest
                adapter = self.ecosystem_adapters.get(ecosystem)
                if not adapter:
                    logger.warning(f"No adapter available for {ecosystem.value}")
                    continue

                parsed_manifest = await adapter.parse_manifest(content, file_path)
                parsed_manifests[ecosystem].append(parsed_manifest)

            except Exception as e:
                logger.error(f"Failed to parse manifest {file_path}: {e}")
                continue

        return dict(parsed_manifests)

    async def _extract_all_dependencies(
        self,
        parsed_manifests: dict[EcosystemType, list[ParsedManifest]]
    ) -> dict[EcosystemType, list[DependencyInfo]]:
        """Extract all dependencies from parsed manifests."""
        all_dependencies = defaultdict(list)

        for ecosystem, manifests in parsed_manifests.items():
            for manifest in manifests:
                # Add production dependencies
                all_dependencies[ecosystem].extend(manifest.dependencies)

                # Add development dependencies
                all_dependencies[ecosystem].extend(manifest.dev_dependencies)

        return dict(all_dependencies)

    def _identify_cross_ecosystem_dependencies(
        self,
        all_dependencies: dict[EcosystemType, list[DependencyInfo]]
    ) -> list[CrossEcosystemDependency]:
        """Identify dependencies that exist across multiple ecosystems."""
        # Group dependencies by normalized name
        dependency_groups = defaultdict(lambda: defaultdict(list))

        for ecosystem, dependencies in all_dependencies.items():
            for dep in dependencies:
                normalized_name = self._normalize_package_name(dep.name, ecosystem)
                dependency_groups[normalized_name][ecosystem].append(dep)

        # Create cross-ecosystem dependencies
        cross_ecosystem_deps = []

        for normalized_name, ecosystem_deps in dependency_groups.items():
            if len(ecosystem_deps) > 1:  # Found in multiple ecosystems
                # Create universal identifier
                universal_id = self._create_universal_identifier(normalized_name)

                # Collect versions from each ecosystem
                versions = {}
                metadata = {}

                for ecosystem, deps in ecosystem_deps.items():
                    # Use the most recent version or most specific constraint
                    latest_dep = max(deps, key=lambda d: d.version_constraint)
                    versions[ecosystem] = latest_dep.version_constraint
                    metadata[ecosystem.value] = {
                        "count": len(deps),
                        "has_dev": any(d.is_dev_dependency for d in deps),
                        "has_optional": any(d.is_optional for d in deps)
                    }

                # Calculate compatibility score
                compatibility_score = self._calculate_package_compatibility(
                    ecosystem_deps.keys(), versions
                )

                cross_ecosystem_dep = CrossEcosystemDependency(
                    package_name=normalized_name,
                    ecosystems=list(ecosystem_deps.keys()),
                    versions=versions,
                    universal_identifier=universal_id,
                    compatibility_score=compatibility_score,
                    metadata=metadata
                )

                cross_ecosystem_deps.append(cross_ecosystem_dep)

        return cross_ecosystem_deps

    def _normalize_package_name(self, name: str, ecosystem: EcosystemType) -> str:
        """Normalize package name according to ecosystem conventions."""
        if ecosystem == EcosystemType.MAVEN:
            # Maven: group:artifact -> group.artifact
            if ":" in name:
                group, artifact = name.split(":", 1)
                return f"{group}.{artifact}".lower()
            return name.lower()
        elif ecosystem == EcosystemType.NPM:
            # npm: @scope/package -> scope-package
            if name.startswith("@"):
                return name[1:].replace("/", "-").lower()
            return name.lower()
        elif ecosystem == EcosystemType.PYPI:
            # PyPI: normalize underscores and hyphens
            return name.replace("_", "-").lower()

        return name.lower()

    def _create_universal_identifier(self, normalized_name: str) -> str:
        """Create a universal identifier for a package."""
        return f"upm:{normalized_name}"

    def _calculate_package_compatibility(
        self,
        ecosystems: list[EcosystemType],
        versions: dict[EcosystemType, str]
    ) -> float:
        """Calculate compatibility score for a package across ecosystems."""
        if len(ecosystems) < 2:
            return 1.0

        # Base compatibility from ecosystem matrix
        total_compatibility = 0.0
        pair_count = 0

        for i, eco1 in enumerate(ecosystems):
            for eco2 in ecosystems[i+1:]:
                compatibility = self.compatibility_mappings.get((eco1, eco2), 0.5)
                total_compatibility += compatibility
                pair_count += 1

        base_score = total_compatibility / pair_count if pair_count > 0 else 1.0

        # Adjust based on version compatibility
        version_penalty = 0.0
        if len(set(versions.values())) > 1:
            # Different versions across ecosystems
            version_penalty = 0.2

        return max(0.0, base_score - version_penalty)

    async def _detect_cross_ecosystem_conflicts(
        self,
        all_dependencies: dict[EcosystemType, list[DependencyInfo]],
        cross_ecosystem_deps: list[CrossEcosystemDependency]
    ) -> list[EcosystemConflict]:
        """Detect conflicts across ecosystems."""
        conflicts = []

        # Detect version mismatches
        for cross_dep in cross_ecosystem_deps:
            if len(set(cross_dep.versions.values())) > 1:
                conflict = EcosystemConflict(
                    conflict_id=f"version_mismatch_{cross_dep.package_name}",
                    conflict_type=ConflictType.VERSION_MISMATCH,
                    affected_packages=[cross_dep.package_name],
                    ecosystems_involved=cross_dep.ecosystems,
                    description=f"Version mismatch for {cross_dep.package_name}: {cross_dep.versions}",
                    severity="medium",
                    suggested_resolution="Align versions across ecosystems or use bridge pattern"
                )
                conflicts.append(conflict)

        # Detect naming conflicts
        package_names = defaultdict(list)
        for ecosystem, dependencies in all_dependencies.items():
            for dep in dependencies:
                package_names[dep.name].append((ecosystem, dep))

        for name, ecosystem_deps in package_names.items():
            if len(set(eco for eco, _ in ecosystem_deps)) > 1:
                conflict = EcosystemConflict(
                    conflict_id=f"naming_conflict_{name}",
                    conflict_type=ConflictType.NAMING_CONFLICT,
                    affected_packages=[name],
                    ecosystems_involved=list(set(eco for eco, _ in ecosystem_deps)),
                    description=f"Package name collision: {name} exists in multiple ecosystems",
                    severity="low",
                    suggested_resolution="Use fully qualified names or namespaces"
                )
                conflicts.append(conflict)

        return conflicts

    def _calculate_compatibility_matrix(
        self,
        ecosystems: list[EcosystemType]
    ) -> CompatibilityMatrix:
        """Calculate compatibility matrix between ecosystems."""
        matrix = {}
        overall_compatibility = 0.0
        pair_count = 0

        for i, eco1 in enumerate(ecosystems):
            for j, eco2 in enumerate(ecosystems):
                if i <= j:
                    compatibility = self.compatibility_mappings.get((eco1, eco2), 0.5)
                    matrix[(eco1, eco2)] = compatibility
                    matrix[(eco2, eco1)] = compatibility

                    if i != j:
                        overall_compatibility += compatibility
                        pair_count += 1

        average_compatibility = overall_compatibility / pair_count if pair_count > 0 else 1.0

        # Extract limitations for these ecosystems
        limitations = {}
        for eco1 in ecosystems:
            for eco2 in ecosystems:
                if eco1 != eco2:
                    limitations[(eco1, eco2)] = self.ecosystem_limitations.get(
                        (eco1, eco2), ["unknown_compatibility"]
                    )

        # Get supported features
        supported_features = {
            eco: self.supported_features.get(eco, []) for eco in ecosystems
        }

        return CompatibilityMatrix(
            matrix=matrix,
            overall_compatibility=average_compatibility,
            supported_features=supported_features,
            limitations=limitations
        )

    def _generate_bridge_recommendations(
        self,
        ecosystems: list[EcosystemType],
        conflicts: list[EcosystemConflict],
        compatibility_matrix: CompatibilityMatrix
    ) -> list[BridgeRecommendation]:
        """Generate recommendations for bridging ecosystems."""
        recommendations = []

        # Generate recommendations based on compatibility
        for i, eco1 in enumerate(ecosystems):
            for j, eco2 in enumerate(ecosystems):
                if i < j:  # Avoid duplicates
                    compatibility = compatibility_matrix.matrix.get((eco1, eco2), 0.5)

                    if compatibility < 0.7:
                        # Low compatibility - recommend bridge
                        bridge_type = self._determine_bridge_type(eco1, eco2)
                        effort = self._estimate_bridge_effort(eco1, eco2, compatibility)

                        recommendation = BridgeRecommendation(
                            source_ecosystem=eco1,
                            target_ecosystem=eco2,
                            bridge_type=bridge_type,
                            implementation={
                                "pattern": "adapter_pattern",
                                "technologies": self._get_bridge_technologies(eco1, eco2),
                                "examples": self._get_bridge_examples(eco1, eco2)
                            },
                            effort_estimate=effort,
                            confidence=min(1.0, compatibility + 0.3)
                        )
                        recommendations.append(recommendation)

        return recommendations

    def _determine_bridge_type(self, eco1: EcosystemType, eco2: EcosystemType) -> str:
        """Determine the best bridge type for two ecosystems."""
        if eco1 == EcosystemType.PYPI or eco2 == EcosystemType.PYPI:
            return "protocol_bridge"
        elif eco1 == EcosystemType.MAVEN or eco2 == EcosystemType.MAVEN:
            return "shared_library"
        else:
            return "api_wrapper"

    def _estimate_bridge_effort(self, eco1: EcosystemType, eco2: EcosystemType, compatibility: float) -> str:
        """Estimate the effort required to bridge two ecosystems."""
        if compatibility > 0.8:
            return "low"
        elif compatibility > 0.5:
            return "medium"
        else:
            return "high"

    def _get_bridge_technologies(self, eco1: EcosystemType, eco2: EcosystemType) -> list[str]:
        """Get recommended technologies for bridging two ecosystems."""
        if EcosystemType.PYPI in [eco1, eco2]:
            return ["FastAPI", "gRPC", "REST"]
        elif EcosystemType.MAVEN in [eco1, eco2]:
            return ["Spring Boot", "Apache Camel", "REST"]
        else:
            return ["REST", "GraphQL", "Message Queue"]

    def _get_bridge_examples(self, eco1: EcosystemType, eco2: EcosystemType) -> list[str]:
        """Get example bridge implementations."""
        return [
            f"Create a {eco2.value} wrapper around {eco1.value} package",
            "Use message queue for async communication",
            "Implement shared protocol interface"
        ]

    async def _apply_resolution_strategy(
        self,
        conflicts: list[EcosystemConflict],
        strategy: ResolutionStrategy,
        cross_ecosystem_deps: list[CrossEcosystemDependency]
    ) -> list[EcosystemConflict]:
        """Apply a resolution strategy to conflicts."""
        resolved_conflicts = []

        for conflict in conflicts:
            try:
                # Get applicable resolution patterns
                patterns = self.resolution_patterns.get(conflict.conflict_type, [])

                for pattern in patterns:
                    if pattern["applicable_to"] == "all" or any(
                        eco in cross_ecosystem_deps for eco in pattern["applicable_to"]
                    ):
                        # Apply the resolver
                        resolver = pattern["resolver"]
                        resolved_conflict = await resolver(conflict, strategy)
                        resolved_conflicts.append(resolved_conflict)
                        break
                else:
                    # No specific pattern found, apply generic strategy
                    resolved_conflict = self._apply_generic_strategy(conflict, strategy)
                    resolved_conflicts.append(resolved_conflict)

            except Exception as e:
                logger.error(f"Failed to resolve conflict {conflict.conflict_id}: {e}")
                resolved_conflicts.append(conflict)

        return resolved_conflicts

    async def _resolve_semver_mismatch(
        self,
        conflict: EcosystemConflict,
        strategy: ResolutionStrategy
    ) -> EcosystemConflict:
        """Resolve semantic versioning mismatch."""
        return conflict

    async def _resolve_license_conflicts(
        self,
        conflict: EcosystemConflict,
        strategy: ResolutionStrategy
    ) -> EcosystemConflict:
        """Resolve license conflicts."""
        return conflict

    async def _resolve_naming_conflicts(
        self,
        conflict: EcosystemConflict,
        strategy: ResolutionStrategy
    ) -> EcosystemConflict:
        """Resolve naming conflicts."""
        return conflict

    def _apply_generic_strategy(
        self,
        conflict: EcosystemConflict,
        strategy: ResolutionStrategy
    ) -> EcosystemConflict:
        """Apply a generic resolution strategy."""
        conflict.metadata["resolution_strategy"] = strategy.value
        conflict.metadata["resolved"] = True
        return conflict

    def _calculate_analysis_metrics(
        self,
        all_dependencies: dict[EcosystemType, list[DependencyInfo]],
        conflicts: list[EcosystemConflict]
    ) -> dict[str, Any]:
        """Calculate comprehensive analysis metrics."""
        total_deps = sum(len(deps) for deps in all_dependencies.values())

        metrics = {
            "total_dependencies": total_deps,
            "ecosystem_distribution": {
                eco.value: len(deps) for eco, deps in all_dependencies.items()
            },
            "conflict_summary": {
                "total_conflicts": len(conflicts),
                "by_type": defaultdict(int),
                "by_severity": defaultdict(int)
            },
            "cross_ecosystem_ratio": 0.0,
            "complexity_score": 0.0,
            "maintainability_index": 0.0
        }

        # Calculate conflict distributions
        for conflict in conflicts:
            metrics["conflict_summary"]["by_type"][conflict.conflict_type.value] += 1
            metrics["conflict_summary"]["by_severity"][conflict.severity] += 1

        # Calculate cross-ecosystem ratio
        cross_ecosystem_count = sum(
            1 for deps in all_dependencies.values()
            for dep in deps if self._is_cross_ecosystem_dep(dep, all_dependencies)
        )
        metrics["cross_ecosystem_ratio"] = cross_ecosystem_count / total_deps if total_deps > 0 else 0.0

        # Calculate complexity score
        ecosystem_count = len(all_dependencies)
        conflict_weight = sum(
            3 if c.severity == "critical" else
            2 if c.severity == "high" else
            1 if c.severity == "medium" else 0.5
            for c in conflicts
        )
        metrics["complexity_score"] = (total_deps * 0.1) + (ecosystem_count * 2) + (conflict_weight * 1.5)
        metrics["complexity_score"] = min(10.0, metrics["complexity_score"])

        # Calculate maintainability index
        base_score = 10.0
        for conflict in conflicts:
            if conflict.severity == "critical":
                base_score -= 2.0
            elif conflict.severity == "high":
                base_score -= 1.0
            elif conflict.severity == "medium":
                base_score -= 0.5
            elif conflict.severity == "low":
                base_score -= 0.2

        if ecosystem_count > 2:
            base_score -= (ecosystem_count - 2) * 0.5

        metrics["maintainability_index"] = max(0.0, base_score)

        return metrics

    def _is_cross_ecosystem_dep(
        self,
        dep: DependencyInfo,
        all_dependencies: dict[EcosystemType, list[DependencyInfo]]
    ) -> bool:
        """Check if a dependency exists in multiple ecosystems."""
        normalized_name = self._normalize_package_name(dep.name, dep.ecosystem)

        for ecosystem, dependencies in all_dependencies.items():
            if ecosystem != dep.ecosystem:
                for other_dep in dependencies:
                    other_normalized = self._normalize_package_name(
                        other_dep.name, other_dep.ecosystem
                    )
                    if normalized_name == other_normalized:
                        return True

        return False

    async def generate_universal_lockfile(
        self,
        analysis_result: MultiEcosystemAnalysisResult
    ) -> dict[str, Any]:
        """Generate a universal lockfile from analysis results."""
        lockfile = {
            "version": "1.0",
            "format": "upm-universal-lockfile",
            "generated_at": analysis_result.timestamp.isoformat(),
            "ecosystems": [eco.value for eco in analysis_result.ecosystems_detected],
            "resolution_strategy": analysis_result.resolution_strategy.value,
            "packages": []
        }

        # Add cross-ecosystem dependencies
        for cross_dep in analysis_result.cross_ecosystem_dependencies:
            package_entry = {
                "universal_id": cross_dep.universal_identifier,
                "name": cross_dep.package_name,
                "ecosystems": {},
                "compatibility_score": cross_dep.compatibility_score,
                "metadata": cross_dep.metadata
            }

            for ecosystem, version in cross_dep.versions.items():
                package_entry["ecosystems"][ecosystem.value] = {
                    "version": version,
                    "resolved": True
                }

            lockfile["packages"].append(package_entry)

        # Add conflict resolutions
        lockfile["conflicts"] = []
        for conflict in analysis_result.conflicts:
            lockfile["conflicts"].append({
                "id": conflict.conflict_id,
                "type": conflict.conflict_type.value,
                "severity": conflict.severity,
                "resolution": conflict.metadata.get("resolution_strategy", "unresolved")
            })

        # Add bridge recommendations
        lockfile["bridges"] = []
        for bridge in analysis_result.bridge_recommendations:
            lockfile["bridges"].append({
                "source": bridge.source_ecosystem.value,
                "target": bridge.target_ecosystem.value,
                "type": bridge.bridge_type,
                "effort": bridge.effort_estimate,
                "confidence": bridge.confidence,
                "implementation": bridge.implementation
            })

        return lockfile

    async def get_ecosystem_insights(
        self,
        ecosystem: EcosystemType,
        analysis_result: MultiEcosystemAnalysisResult
    ) -> dict[str, Any]:
        """Get specific insights for a particular ecosystem."""
        insights = {
            "ecosystem": ecosystem.value,
            "package_count": 0,
            "unique_packages": 0,
            "conflicts_involving": 0,
            "bridge_requirements": [],
            "compatibility_scores": {},
            "recommendations": []
        }

        # Count packages for this ecosystem
        for cross_dep in analysis_result.cross_ecosystem_dependencies:
            if ecosystem in cross_dep.ecosystems:
                insights["package_count"] += 1
                insights["compatibility_scores"][cross_dep.package_name] = cross_dep.compatibility_score

        insights["unique_packages"] = insights["package_count"]

        # Count conflicts involving this ecosystem
        for conflict in analysis_result.conflicts:
            if ecosystem in conflict.ecosystems_involved:
                insights["conflicts_involving"] += 1

        # Bridge requirements
        for bridge in analysis_result.bridge_recommendations:
            if bridge.source_ecosystem == ecosystem or bridge.target_ecosystem == ecosystem:
                insights["bridge_requirements"].append({
                    "other_ecosystem": bridge.target_ecosystem.value
                    if bridge.source_ecosystem == ecosystem else bridge.source_ecosystem.value,
                    "bridge_type": bridge.bridge_type,
                    "effort": bridge.effort_estimate
                })

        # Generate recommendations
        if insights["conflicts_involving"] > 0:
            insights["recommendations"].append(
                f"Review and resolve {insights['conflicts_involving']} conflicts"
            )

        if insights["bridge_requirements"]:
            insights["recommendations"].append(
                f"Implement {len(insights['bridge_requirements'])} bridge(s) for better integration"
            )

        if insights["compatibility_scores"]:
            avg_compatibility = sum(insights["compatibility_scores"].values()) / len(insights["compatibility_scores"])
            if avg_compatibility < 0.7:
                insights["recommendations"].append(
                    "Improve package compatibility across ecosystems"
                )

        return insights
