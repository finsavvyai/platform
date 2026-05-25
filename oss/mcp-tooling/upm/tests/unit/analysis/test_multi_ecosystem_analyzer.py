"""
Tests for Multi-Ecosystem Dependency Analysis Core Engine.
"""

import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from udp.analysis.multi_ecosystem_analyzer import (
    MultiEcosystemAnalyzer,
    ConflictType,
    ResolutionStrategy,
    CrossEcosystemDependency,
    EcosystemConflict,
    CompatibilityMatrix,
    BridgeRecommendation,
    MultiEcosystemAnalysisResult,
)
from udp.domain.models import EcosystemType
from udp.tools.ecosystems.base import DependencyInfo, ParsedManifest


@pytest.fixture
def organization_id():
    """Fixture for organization ID."""
    return uuid4()


@pytest.fixture
def analyzer(organization_id):
    """Fixture for MultiEcosystemAnalyzer."""
    with patch("udp.analysis.multi_ecosystem_analyzer.EcosystemFactory"):
        analyzer = MultiEcosystemAnalyzer(organization_id)
        return analyzer


@pytest.fixture
def sample_manifests():
    """Fixture for sample manifest files and contents."""
    manifest_files = {
        "pom.xml": "maven",
        "package.json": "npm",
        "requirements.txt": "pypi",
    }

    manifest_contents = {
        "pom.xml": """<project>
            <groupId>com.example</groupId>
            <artifactId>test-app</artifactId>
            <version>1.0.0</version>
            <dependencies>
                <dependency>
                    <groupId>org.springframework</groupId>
                    <artifactId>spring-core</artifactId>
                    <version>5.3.0</version>
                </dependency>
            </dependencies>
        </project>""",
        "package.json": """{
            "name": "test-app",
            "version": "1.0.0",
            "dependencies": {
                "express": "^4.18.0",
                "lodash": "^4.17.21"
            }
        }""",
        "requirements.txt": """requests==2.28.0
numpy==1.24.0
fastapi==0.85.0""",
    }

    return manifest_files, manifest_contents


@pytest.fixture
def sample_dependencies():
    """Fixture for sample dependencies across ecosystems."""
    return {
        EcosystemType.MAVEN: [
            DependencyInfo(
                name="org.springframework:spring-core",
                version_constraint="5.3.0",
                ecosystem=EcosystemType.MAVEN,
            )
        ],
        EcosystemType.NPM: [
            DependencyInfo(
                name="express",
                version_constraint="^4.18.0",
                ecosystem=EcosystemType.NPM,
            ),
            DependencyInfo(
                name="lodash",
                version_constraint="^4.17.21",
                ecosystem=EcosystemType.NPM,
            ),
        ],
        EcosystemType.PYPI: [
            DependencyInfo(
                name="requests",
                version_constraint="2.28.0",
                ecosystem=EcosystemType.PYPI,
            ),
            DependencyInfo(
                name="numpy", version_constraint="1.24.0", ecosystem=EcosystemType.PYPI
            ),
        ],
    }


class TestMultiEcosystemAnalyzer:
    """Test cases for MultiEcosystemAnalyzer."""

    def test_init(self, organization_id):
        """Test analyzer initialization."""
        with patch("udp.analysis.multi_ecosystem_analyzer.EcosystemFactory"):
            analyzer = MultiEcosystemAnalyzer(organization_id)

            assert analyzer.organization_id == organization_id
            assert isinstance(analyzer.ecosystem_adapters, dict)
            assert analyzer.compatibility_mappings is not None
            assert analyzer.supported_features is not None
            assert analyzer.ecosystem_limitations is not None
            assert analyzer.resolution_patterns is not None

    def test_initialize_compatibility_mappings(self, analyzer):
        """Test compatibility mappings initialization."""
        # Check self-compatibility
        assert (
            analyzer.compatibility_mappings[(EcosystemType.MAVEN, EcosystemType.MAVEN)]
            == 1.0
        )
        assert (
            analyzer.compatibility_mappings[(EcosystemType.NPM, EcosystemType.NPM)]
            == 1.0
        )
        assert (
            analyzer.compatibility_mappings[(EcosystemType.PYPI, EcosystemType.PYPI)]
            == 1.0
        )

        # Check cross-compatibility
        assert (
            analyzer.compatibility_mappings[(EcosystemType.MAVEN, EcosystemType.NPM)]
            == 0.7
        )
        assert (
            analyzer.compatibility_mappings[(EcosystemType.NPM, EcosystemType.PYPI)]
            == 0.8
        )
        assert (
            analyzer.compatibility_mappings[(EcosystemType.PYPI, EcosystemType.MAVEN)]
            == 0.6
        )

    def test_normalize_package_name(self, analyzer):
        """Test package name normalization."""
        # Maven names
        assert (
            analyzer._normalize_package_name(
                "org.springframework:spring-core", EcosystemType.MAVEN
            )
            == "org.springframework.spring-core"
        )
        assert (
            analyzer._normalize_package_name("spring-core", EcosystemType.MAVEN)
            == "spring-core"
        )

        # NPM names
        assert (
            analyzer._normalize_package_name("@babel/core", EcosystemType.NPM)
            == "babel-core"
        )
        assert (
            analyzer._normalize_package_name("express", EcosystemType.NPM) == "express"
        )

        # PyPI names
        assert (
            analyzer._normalize_package_name(
                "django-rest-framework", EcosystemType.PYPI
            )
            == "django-rest-framework"
        )
        assert (
            analyzer._normalize_package_name(
                "django_rest_framework", EcosystemType.PYPI
            )
            == "django-rest-framework"
        )

    def test_create_universal_identifier(self, analyzer):
        """Test universal identifier creation."""
        uid = analyzer._create_universal_identifier("express")
        assert uid == "upm:express"

        uid = analyzer._create_universal_identifier("org.springframework.spring-core")
        assert uid == "upm:org.springframework.spring-core"

    def test_calculate_package_compatibility(self, analyzer):
        """Test package compatibility calculation."""
        # Single ecosystem
        ecosystems = [EcosystemType.NPM]
        versions = {EcosystemType.NPM: "1.0.0"}
        compatibility = analyzer._calculate_package_compatibility(ecosystems, versions)
        assert compatibility == 1.0

        # Multiple ecosystems with same version
        ecosystems = [EcosystemType.NPM, EcosystemType.PYPI]
        versions = {EcosystemType.NPM: "1.0.0", EcosystemType.PYPI: "1.0.0"}
        compatibility = analyzer._calculate_package_compatibility(ecosystems, versions)
        assert compatibility == 0.8  # NPM-PYPI base compatibility

        # Multiple ecosystems with different versions
        ecosystems = [EcosystemType.NPM, EcosystemType.PYPI]
        versions = {EcosystemType.NPM: "1.0.0", EcosystemType.PYPI: "2.0.0"}
        compatibility = analyzer._calculate_package_compatibility(ecosystems, versions)
        assert compatibility == 0.6  # 0.8 - 0.2 version penalty

    def test_identify_cross_ecosystem_dependencies(self, analyzer, sample_dependencies):
        """Test cross-ecosystem dependency identification."""
        # Add a cross-ecosystem dependency (same normalized name)
        sample_dependencies[EcosystemType.MAVEN].append(
            DependencyInfo(
                name="express",
                version_constraint="1.0.0",
                ecosystem=EcosystemType.MAVEN,
            )
        )

        cross_deps = analyzer._identify_cross_ecosystem_dependencies(
            sample_dependencies
        )

        # Should find express in both Maven and NPM
        express_deps = [dep for dep in cross_deps if dep.package_name == "express"]
        assert len(express_deps) == 1

        express_dep = express_deps[0]
        assert EcosystemType.MAVEN in express_dep.ecosystems
        assert EcosystemType.NPM in express_dep.ecosystems
        assert express_dep.versions[EcosystemType.MAVEN] == "1.0.0"
        assert express_dep.versions[EcosystemType.NPM] == "^4.18.0"
        assert express_dep.universal_identifier == "upm:express"

    @pytest.mark.asyncio
    async def test_parse_all_manifests(self, analyzer, sample_manifests):
        """Test parsing all manifests."""
        manifest_files, manifest_contents = sample_manifests

        # Mock ecosystem adapters
        maven_adapter = AsyncMock()
        maven_adapter.parse_manifest.return_value = ParsedManifest(
            ecosystem=EcosystemType.MAVEN,
            project_name="test-app",
            project_version="1.0.0",
            dependencies=[
                DependencyInfo(
                    name="org.springframework:spring-core",
                    version_constraint="5.3.0",
                    ecosystem=EcosystemType.MAVEN,
                )
            ],
        )

        npm_adapter = AsyncMock()
        npm_adapter.parse_manifest.return_value = ParsedManifest(
            ecosystem=EcosystemType.NPM,
            project_name="test-app",
            project_version="1.0.0",
            dependencies=[
                DependencyInfo(
                    name="express",
                    version_constraint="^4.18.0",
                    ecosystem=EcosystemType.NPM,
                )
            ],
        )

        pypi_adapter = AsyncMock()
        pypi_adapter.parse_manifest.return_value = ParsedManifest(
            ecosystem=EcosystemType.PYPI,
            project_name="test-app",
            project_version="1.0.0",
            dependencies=[
                DependencyInfo(
                    name="requests",
                    version_constraint="2.28.0",
                    ecosystem=EcosystemType.PYPI,
                )
            ],
        )

        analyzer.ecosystem_adapters = {
            EcosystemType.MAVEN: maven_adapter,
            EcosystemType.NPM: npm_adapter,
            EcosystemType.PYPI: pypi_adapter,
        }

        with patch(
            "udp.analysis.multi_ecosystem_analyzer.EcosystemFactory.get_ecosystem_for_file"
        ) as mock_get_eco:
            mock_get_eco.side_effect = lambda x: {
                "pom.xml": EcosystemType.MAVEN,
                "package.json": EcosystemType.NPM,
                "requirements.txt": EcosystemType.PYPI,
            }.get(x)

            parsed_manifests = await analyzer._parse_all_manifests(
                manifest_files, manifest_contents
            )

            assert len(parsed_manifests) == 3
            assert EcosystemType.MAVEN in parsed_manifests
            assert EcosystemType.NPM in parsed_manifests
            assert EcosystemType.PYPI in parsed_manifests

    @pytest.mark.asyncio
    async def test_detect_cross_ecosystem_conflicts(
        self, analyzer, sample_dependencies
    ):
        """Test conflict detection across ecosystems."""
        # Create cross-ecosystem dependencies with version mismatch
        cross_deps = [
            CrossEcosystemDependency(
                package_name="express",
                ecosystems=[EcosystemType.NPM, EcosystemType.MAVEN],
                versions={EcosystemType.NPM: "^4.18.0", EcosystemType.MAVEN: "5.0.0"},
                universal_identifier="upm:express",
            )
        ]

        conflicts = await analyzer._detect_cross_ecosystem_conflicts(
            sample_dependencies, cross_deps
        )

        # Should detect version mismatch
        assert len(conflicts) > 0
        version_conflicts = [
            c for c in conflicts if c.conflict_type == ConflictType.VERSION_MISMATCH
        ]
        assert len(version_conflicts) > 0

        conflict = version_conflicts[0]
        assert conflict.package_name == "express"
        assert conflict.severity == "medium"
        assert "Version mismatch" in conflict.description

    def test_calculate_compatibility_matrix(self, analyzer):
        """Test compatibility matrix calculation."""
        ecosystems = [EcosystemType.MAVEN, EcosystemType.NPM, EcosystemType.PYPI]

        matrix = analyzer._calculate_compatibility_matrix(ecosystems)

        assert isinstance(matrix, CompatibilityMatrix)
        assert matrix.overall_compatibility > 0
        assert len(matrix.supported_features) == 3
        assert len(matrix.limitations) > 0

        # Check matrix values
        assert matrix.matrix[(EcosystemType.MAVEN, EcosystemType.NPM)] == 0.7
        assert matrix.matrix[(EcosystemType.NPM, EcosystemType.PYPI)] == 0.8
        assert matrix.matrix[(EcosystemType.PYPI, EcosystemType.MAVEN)] == 0.6

    def test_generate_bridge_recommendations(self, analyzer):
        """Test bridge recommendation generation."""
        ecosystems = [EcosystemType.MAVEN, EcosystemType.PYPI]
        conflicts = [
            EcosystemConflict(
                conflict_id="test_conflict",
                conflict_type=ConflictType.VERSION_MISMATCH,
                affected_packages=["test"],
                ecosystems_involved=ecosystems,
                description="Test conflict",
                severity="medium",
            )
        ]

        matrix = analyzer._calculate_compatibility_matrix(ecosystems)

        recommendations = analyzer._generate_bridge_recommendations(
            ecosystems, conflicts, matrix
        )

        # Should recommend bridge due to low compatibility (0.6)
        assert len(recommendations) > 0

        rec = recommendations[0]
        assert isinstance(rec, BridgeRecommendation)
        assert rec.source_ecosystem == EcosystemType.MAVEN
        assert rec.target_ecosystem == EcosystemType.PYPI
        assert rec.bridge_type == "shared_library"
        assert rec.effort_estimate == "medium"
        assert "adapter_pattern" in rec.implementation["pattern"]

    def test_determine_bridge_type(self, analyzer):
        """Test bridge type determination."""
        # PyPI involved -> protocol_bridge
        assert (
            analyzer._determine_bridge_type(EcosystemType.PYPI, EcosystemType.NPM)
            == "protocol_bridge"
        )
        assert (
            analyzer._determine_bridge_type(EcosystemType.MAVEN, EcosystemType.PYPI)
            == "protocol_bridge"
        )

        # Maven involved -> shared_library
        assert (
            analyzer._determine_bridge_type(EcosystemType.MAVEN, EcosystemType.NPM)
            == "shared_library"
        )

        # Default -> api_wrapper
        assert (
            analyzer._determine_bridge_type(EcosystemType.NPM, EcosystemType.NPM)
            == "api_wrapper"
        )

    def test_estimate_bridge_effort(self, analyzer):
        """Test bridge effort estimation."""
        # High compatibility -> low effort
        assert (
            analyzer._estimate_bridge_effort(EcosystemType.NPM, EcosystemType.PYPI, 0.9)
            == "low"
        )

        # Medium compatibility -> medium effort
        assert (
            analyzer._estimate_bridge_effort(
                EcosystemType.MAVEN, EcosystemType.NPM, 0.7
            )
            == "medium"
        )

        # Low compatibility -> high effort
        assert (
            analyzer._estimate_bridge_effort(
                EcosystemType.PYPI, EcosystemType.MAVEN, 0.4
            )
            == "high"
        )

    def test_get_bridge_technologies(self, analyzer):
        """Test bridge technology recommendations."""
        # PyPI involved
        techs = analyzer._get_bridge_technologies(EcosystemType.PYPI, EcosystemType.NPM)
        assert "FastAPI" in techs
        assert "gRPC" in techs
        assert "REST" in techs

        # Maven involved
        techs = analyzer._get_bridge_technologies(
            EcosystemType.MAVEN, EcosystemType.NPM
        )
        assert "Spring Boot" in techs
        assert "Apache Camel" in techs

        # Default
        techs = analyzer._get_bridge_technologies(EcosystemType.NPM, EcosystemType.NPM)
        assert "REST" in techs
        assert "GraphQL" in techs

    def test_calculate_analysis_metrics(self, analyzer, sample_dependencies):
        """Test analysis metrics calculation."""
        conflicts = [
            EcosystemConflict(
                conflict_id="test1",
                conflict_type=ConflictType.VERSION_MISMATCH,
                affected_packages=["test"],
                ecosystems_involved=[EcosystemType.MAVEN, EcosystemType.NPM],
                description="Test conflict 1",
                severity="high",
            ),
            EcosystemConflict(
                conflict_id="test2",
                conflict_type=ConflictType.NAMING_CONFLICT,
                affected_packages=["test2"],
                ecosystems_involved=[EcosystemType.NPM],
                description="Test conflict 2",
                severity="low",
            ),
        ]

        metrics = analyzer._calculate_analysis_metrics(sample_dependencies, conflicts)

        assert (
            metrics["total_dependencies"] == 4
        )  # 1 Maven + 2 NPM + 1 PyPI (from fixture)
        assert len(metrics["ecosystem_distribution"]) == 3
        assert metrics["conflict_summary"]["total_conflicts"] == 2
        assert (
            metrics["conflict_summary"]["by_type"][ConflictType.VERSION_MISMATCH.value]
            == 1
        )
        assert (
            metrics["conflict_summary"]["by_type"][ConflictType.NAMING_CONFLICT.value]
            == 1
        )
        assert metrics["conflict_summary"]["by_severity"]["high"] == 1
        assert metrics["conflict_summary"]["by_severity"]["low"] == 1
        assert 0 <= metrics["complexity_score"] <= 10
        assert 0 <= metrics["maintainability_index"] <= 10

    @pytest.mark.asyncio
    async def test_apply_resolution_strategy(self, analyzer):
        """Test applying resolution strategy."""
        conflicts = [
            EcosystemConflict(
                conflict_id="test_conflict",
                conflict_type=ConflictType.NAMING_CONFLICT,
                affected_packages=["test"],
                ecosystems_involved=[EcosystemType.NPM, EcosystemType.MAVEN],
                description="Test conflict",
                severity="low",
            )
        ]

        cross_deps = []
        strategy = ResolutionStrategy.PREFER_STABLE

        resolved_conflicts = await analyzer._apply_resolution_strategy(
            conflicts, strategy, cross_deps
        )

        assert len(resolved_conflicts) == 1
        assert resolved_conflicts[0].metadata.get("resolved") is True
        assert (
            resolved_conflicts[0].metadata.get("resolution_strategy") == strategy.value
        )

    @pytest.mark.asyncio
    async def test_analyze_multi_ecosystem_project(self, analyzer, sample_manifests):
        """Test complete multi-ecosystem analysis."""
        manifest_files, manifest_contents = sample_manifests

        # Mock all the internal methods
        analyzer._parse_all_manifests = AsyncMock(
            return_value={
                EcosystemType.MAVEN: [
                    ParsedManifest(
                        ecosystem=EcosystemType.MAVEN,
                        project_name="test-app",
                        project_version="1.0.0",
                        dependencies=[
                            DependencyInfo(
                                name="org.springframework:spring-core",
                                version_constraint="5.3.0",
                                ecosystem=EcosystemType.MAVEN,
                            )
                        ],
                    )
                ],
                EcosystemType.NPM: [
                    ParsedManifest(
                        ecosystem=EcosystemType.NPM,
                        project_name="test-app",
                        project_version="1.0.0",
                        dependencies=[
                            DependencyInfo(
                                name="express",
                                version_constraint="^4.18.0",
                                ecosystem=EcosystemType.NPM,
                            )
                        ],
                    )
                ],
                EcosystemType.PYPI: [
                    ParsedManifest(
                        ecosystem=EcosystemType.PYPI,
                        project_name="test-app",
                        project_version="1.0.0",
                        dependencies=[
                            DependencyInfo(
                                name="requests",
                                version_constraint="2.28.0",
                                ecosystem=EcosystemType.PYPI,
                            )
                        ],
                    )
                ],
            }
        )

        analyzer._extract_all_dependencies = AsyncMock(
            return_value={
                EcosystemType.MAVEN: [
                    DependencyInfo(
                        name="org.springframework:spring-core",
                        version_constraint="5.3.0",
                        ecosystem=EcosystemType.MAVEN,
                    )
                ],
                EcosystemType.NPM: [
                    DependencyInfo(
                        name="express",
                        version_constraint="^4.18.0",
                        ecosystem=EcosystemType.NPM,
                    )
                ],
                EcosystemType.PYPI: [
                    DependencyInfo(
                        name="requests",
                        version_constraint="2.28.0",
                        ecosystem=EcosystemType.PYPI,
                    )
                ],
            }
        )

        analyzer._identify_cross_ecosystem_dependencies = MagicMock(return_value=[])
        analyzer._detect_cross_ecosystem_conflicts = AsyncMock(return_value=[])
        analyzer._calculate_compatibility_matrix = MagicMock(
            return_value=CompatibilityMatrix(
                matrix={(EcosystemType.MAVEN, EcosystemType.NPM): 0.7},
                overall_compatibility=0.7,
                supported_features={},
                limitations={},
            )
        )
        analyzer._generate_bridge_recommendations = MagicMock(return_value=[])
        analyzer._apply_resolution_strategy = AsyncMock(return_value=[])
        analyzer._calculate_analysis_metrics = MagicMock(
            return_value={
                "total_dependencies": 3,
                "complexity_score": 2.0,
                "maintainability_index": 8.0,
            }
        )

        result = await analyzer.analyze_multi_ecosystem_project(
            manifest_files, manifest_contents
        )

        assert isinstance(result, MultiEcosystemAnalysisResult)
        assert result.total_packages == 3
        assert result.unique_packages == 3
        assert len(result.ecosystems_detected) == 3
        assert result.resolution_strategy == ResolutionStrategy.PREFER_STABLE
        assert isinstance(result.timestamp, datetime)

    @pytest.mark.asyncio
    async def test_generate_universal_lockfile(self, analyzer):
        """Test universal lockfile generation."""
        # Create a sample analysis result
        analysis_result = MultiEcosystemAnalysisResult(
            total_packages=2,
            unique_packages=2,
            ecosystems_detected=[EcosystemType.NPM, EcosystemType.PYPI],
            cross_ecosystem_dependencies=[
                CrossEcosystemDependency(
                    package_name="requests",
                    ecosystems=[EcosystemType.NPM, EcosystemType.PYPI],
                    versions={EcosystemType.NPM: "2.0.0", EcosystemType.PYPI: "2.28.0"},
                    universal_identifier="upm:requests",
                    compatibility_score=0.8,
                )
            ],
            conflicts=[
                EcosystemConflict(
                    conflict_id="version_mismatch_requests",
                    conflict_type=ConflictType.VERSION_MISMATCH,
                    affected_packages=["requests"],
                    ecosystems_involved=[EcosystemType.NPM, EcosystemType.PYPI],
                    description="Version mismatch for requests",
                    severity="medium",
                )
            ],
            compatibility_matrix=CompatibilityMatrix(
                matrix={(EcosystemType.NPM, EcosystemType.PYPI): 0.8},
                overall_compatibility=0.8,
                supported_features={},
                limitations={},
            ),
            bridge_recommendations=[
                BridgeRecommendation(
                    source_ecosystem=EcosystemType.NPM,
                    target_ecosystem=EcosystemType.PYPI,
                    bridge_type="protocol_bridge",
                    implementation={"pattern": "adapter"},
                    effort_estimate="medium",
                    confidence=0.8,
                )
            ],
            resolution_strategy=ResolutionStrategy.PREFER_STABLE,
            analysis_metrics={"total_dependencies": 2},
            timestamp=datetime.utcnow(),
        )

        lockfile = await analyzer.generate_universal_lockfile(analysis_result)

        assert lockfile["version"] == "1.0"
        assert lockfile["format"] == "upm-universal-lockfile"
        assert "generated_at" in lockfile
        assert len(lockfile["ecosystems"]) == 2
        assert lockfile["resolution_strategy"] == "prefer_stable"
        assert len(lockfile["packages"]) == 1
        assert len(lockfile["conflicts"]) == 1
        assert len(lockfile["bridges"]) == 1

        # Check package entry
        package = lockfile["packages"][0]
        assert package["universal_id"] == "upm:requests"
        assert package["name"] == "requests"
        assert "npm" in package["ecosystems"]
        assert "pypi" in package["ecosystems"]
        assert package["compatibility_score"] == 0.8

    @pytest.mark.asyncio
    async def test_get_ecosystem_insights(self, analyzer):
        """Test ecosystem-specific insights."""
        # Create a sample analysis result
        analysis_result = MultiEcosystemAnalysisResult(
            total_packages=2,
            unique_packages=2,
            ecosystems_detected=[EcosystemType.NPM, EcosystemType.PYPI],
            cross_ecosystem_dependencies=[
                CrossEcosystemDependency(
                    package_name="requests",
                    ecosystems=[EcosystemType.NPM, EcosystemType.PYPI],
                    versions={EcosystemType.NPM: "2.0.0", EcosystemType.PYPI: "2.28.0"},
                    universal_identifier="upm:requests",
                    compatibility_score=0.8,
                )
            ],
            conflicts=[
                EcosystemConflict(
                    conflict_id="test_conflict",
                    conflict_type=ConflictType.VERSION_MISMATCH,
                    affected_packages=["requests"],
                    ecosystems_involved=[EcosystemType.NPM, EcosystemType.PYPI],
                    description="Test conflict",
                    severity="medium",
                )
            ],
            compatibility_matrix=CompatibilityMatrix(
                matrix={(EcosystemType.NPM, EcosystemType.PYPI): 0.8},
                overall_compatibility=0.8,
                supported_features={},
                limitations={},
            ),
            bridge_recommendations=[
                BridgeRecommendation(
                    source_ecosystem=EcosystemType.NPM,
                    target_ecosystem=EcosystemType.PYPI,
                    bridge_type="protocol_bridge",
                    implementation={"pattern": "adapter"},
                    effort_estimate="medium",
                    confidence=0.8,
                )
            ],
            resolution_strategy=ResolutionStrategy.PREFER_STABLE,
            analysis_metrics={},
            timestamp=datetime.utcnow(),
        )

        insights = await analyzer.get_ecosystem_insights(
            EcosystemType.NPM, analysis_result
        )

        assert insights["ecosystem"] == "npm"
        assert insights["package_count"] == 1
        assert insights["unique_packages"] == 1
        assert insights["conflicts_involving"] == 1
        assert len(insights["bridge_requirements"]) == 1
        assert "requests" in insights["compatibility_scores"]
        assert insights["compatibility_scores"]["requests"] == 0.8
        assert len(insights["recommendations"]) > 0
