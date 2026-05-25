"""
Unit tests for Automated Remediation Service.

Tests the remediation suggestion generation, fix application,
and alternative package recommendation functionality.
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from src.udp.services.remediation_service import (
    AutomatedRemediationService,
    RemediationSuggestion,
    RemediationType,
    RemediationPriority,
    BreakingChangeRisk,
    VersionBumpSuggestion,
    AlternativePackageSuggestion,
    PatchSuggestion,
    MavenRemediationAdapter,
    NPMRemediationAdapter,
    PyPIRemediationAdapter,
)
from src.udp.core.models.vulnerability import (
    Vulnerability,
    ProjectVulnerabilityModel,
)
from src.udp.core.models.package import Package
from src.udp.core.models.project import ProjectModel
from src.udp.core.models.dependency import DependencyModel
from src.udp.domain.models import EcosystemType, SecurityLevel
from src.udp.core.services import NotFoundError, ValidationError


@pytest.fixture
def mock_db_session():
    """Create a mock database session."""
    session = AsyncMock(spec=AsyncSession)
    return session


@pytest.fixture
def remediation_service(mock_db_session):
    """Create remediation service with mocked dependencies."""
    service = AutomatedRemediationService(mock_db_session)
    return service


@pytest.fixture
def sample_project():
    """Create a sample project for testing."""
    return ProjectModel(
        id=uuid4(),
        name="test-project",
        slug="test-project",
        organization_id=uuid4(),
        primary_language="java",
        ecosystem="maven",
    )


@pytest.fixture
def sample_package():
    """Create a sample package for testing."""
    return Package(
        id=uuid4(),
        name="spring-boot-starter",
        ecosystem="maven",
        group_id="org.springframework.boot",
        artifact_id="spring-boot-starter",
        description="Spring Boot Starter",
        license="Apache-2.0",
        latest_version="2.7.0",
        security_score=0.8,
        maintenance_score=0.9,
        popularity_score=0.95,
    )


@pytest.fixture
def sample_dependency(sample_project, sample_package):
    """Create a sample dependency for testing."""
    return DependencyModel(
        id=uuid4(),
        project_id=sample_project.id,
        package_id=sample_package.id,
        version_constraint="2.6.0",
        is_direct=True,
        scope="compile",
        ecosystem="maven",
    )


@pytest.fixture
def sample_vulnerability():
    """Create a sample vulnerability for testing."""
    return ProjectVulnerabilityModel(
        id=uuid4(),
        project_id=uuid4(),
        vulnerability_id="CVE-2022-12345",
        dependency_id=uuid4(),
        status="open",
        risk_score=8.5,
        risk_level="high",
        first_detected_at=datetime.utcnow(),
    )


class TestAutomatedRemediationService:
    """Test cases for AutomatedRemediationService."""

    @pytest.mark.asyncio
    async def test_generate_remediation_suggestions(
        self, remediation_service, sample_project, mock_db_session
    ):
        """Test generating remediation suggestions for a project."""
        # Mock database queries
        mock_vulnerabilities = [
            ProjectVulnerabilityModel(
                id=uuid4(),
                project_id=sample_project.id,
                vulnerability_id="CVE-2022-12345",
                dependency_id=uuid4(),
                status="open",
                risk_score=8.5,
                risk_level="high",
            )
        ]

        # Mock the internal method to avoid complex setup
        remediation_service._get_project_vulnerabilities = AsyncMock(
            return_value=mock_vulnerabilities
        )
        remediation_service._generate_vulnerability_suggestions = AsyncMock(
            return_value=[
                RemediationSuggestion(
                    vulnerability_id="CVE-2022-12345",
                    dependency_id=str(uuid4()),
                    project_id=str(sample_project.id),
                    remediation_type=RemediationType.VERSION_BUMP,
                    priority=RemediationPriority.HIGH,
                    title="Upgrade package",
                    description="Upgrade to fix vulnerability",
                    confidence_score=0.9,
                )
            ]
        )

        # Generate suggestions
        suggestions = await remediation_service.generate_remediation_suggestions(
            project_id=str(sample_project.id)
        )

        # Assertions
        assert len(suggestions) > 0
        assert all(isinstance(s, RemediationSuggestion) for s in suggestions)
        remediation_service._get_project_vulnerabilities.assert_called_once_with(
            str(sample_project.id)
        )

    @pytest.mark.asyncio
    async def test_generate_version_bump_suggestion(
        self,
        remediation_service,
        sample_dependency,
        sample_package,
        sample_vulnerability,
    ):
        """Test generating version bump suggestions."""
        # Setup mocks
        remediation_service._get_package = AsyncMock(return_value=sample_package)
        remediation_service._get_available_versions = AsyncMock(
            return_value=["2.6.0", "2.6.1", "2.7.0", "2.7.1"]
        )
        remediation_service._get_vulnerability_fixed_versions = AsyncMock(
            return_value=["2.7.0", "2.7.1"]
        )
        remediation_service._analyze_breaking_changes = AsyncMock(
            return_value=BreakingChangeRisk.LOW
        )
        remediation_service._get_changelog_summary = AsyncMock(
            return_value="Security fixes and improvements"
        )
        remediation_service._generate_version_bump_script = AsyncMock(
            return_value="mvn versions:use-dep-version ..."
        )

        # Generate suggestion
        suggestion = await remediation_service._generate_version_bump_suggestion(
            sample_dependency, sample_vulnerability
        )

        # Assertions
        assert suggestion is not None
        assert suggestion.remediation_type == RemediationType.VERSION_BUMP
        assert suggestion.version_bump is not None
        assert suggestion.version_bump.suggested_version == "2.7.0"
        assert suggestion.automated_fix_available is True
        assert suggestion.confidence_score > 0

    @pytest.mark.asyncio
    async def test_generate_alternative_package_suggestions(
        self,
        remediation_service,
        sample_dependency,
        sample_package,
        sample_vulnerability,
    ):
        """Test generating alternative package suggestions."""
        # Create alternative package
        alt_package = Package(
            id=uuid4(),
            name="micronaut-core",
            ecosystem="maven",
            group_id="io.micronaut",
            artifact_id="micronaut-core",
            description="Micronaut Framework Core",
            license="Apache-2.0",
            security_score=0.9,
            maintenance_score=0.85,
            popularity_score=0.7,
        )

        # Setup mocks
        remediation_service._get_package = AsyncMock(return_value=sample_package)
        remediation_service._find_alternative_packages = AsyncMock(
            return_value=[alt_package]
        )
        remediation_service._analyze_package_compatibility = AsyncMock(return_value=0.8)
        remediation_service._analyze_api_similarity = AsyncMock(return_value=0.7)
        remediation_service._generate_migration_guide = AsyncMock(
            return_value="# Migration guide..."
        )

        # Generate suggestions
        suggestions = (
            await remediation_service._generate_alternative_package_suggestions(
                sample_dependency, sample_vulnerability
            )
        )

        # Assertions
        assert len(suggestions) > 0
        suggestion = suggestions[0]
        assert suggestion.remediation_type == RemediationType.ALTERNATIVE_PACKAGE
        assert suggestion.alternative_package is not None
        assert suggestion.alternative_package.alternative_package == "micronaut-core"
        assert suggestion.alternative_package.compatibility_score == 0.8
        assert suggestion.alternative_package.api_similarity_score == 0.7

    @pytest.mark.asyncio
    async def test_generate_patch_suggestions(
        self, remediation_service, sample_dependency, sample_vulnerability
    ):
        """Test generating patch suggestions."""
        # Setup mock patches
        patches = [
            {
                "patch_type": "security_patch",
                "patch_source": "upstream",
                "description": "Critical security patch",
                "application_instructions": "Apply patch using provided script",
                "confidence": 0.9,
            }
        ]

        remediation_service._find_available_patches = AsyncMock(return_value=patches)

        # Generate suggestions
        suggestions = await remediation_service._generate_patch_suggestions(
            sample_dependency, sample_vulnerability
        )

        # Assertions
        assert len(suggestions) > 0
        suggestion = suggestions[0]
        assert suggestion.remediation_type == RemediationType.PATCH_APPLICATION
        assert suggestion.patch is not None
        assert suggestion.patch.patch_type == "security_patch"
        assert suggestion.patch.confidence_score == 0.9

    @pytest.mark.asyncio
    async def test_apply_automated_fix_success(
        self, remediation_service, mock_db_session
    ):
        """Test successful application of automated fix."""
        # Setup mocks
        suggestion = RemediationSuggestion(
            id=str(uuid4()),
            vulnerability_id="CVE-2022-12345",
            dependency_id=str(uuid4()),
            project_id=str(uuid4()),
            remediation_type=RemediationType.VERSION_BUMP,
            priority=RemediationPriority.HIGH,
            automated_fix_available=True,
            automated_fix_script="echo 'Fix applied'",
        )

        remediation_service._get_remediation_suggestion = AsyncMock(
            return_value=suggestion
        )
        remediation_service._validate_fix = AsyncMock(
            return_value={"is_valid": True, "errors": []}
        )
        remediation_service._create_backup = AsyncMock(
            return_value={"backup_path": "/backup/test"}
        )
        remediation_service._execute_fix = AsyncMock(
            return_value={"success": True, "changes_made": ["Updated dependency"]}
        )
        remediation_service._verify_fix = AsyncMock(
            return_value={"verified": True, "issues": []}
        )

        # Apply fix
        result = await remediation_service.apply_automated_fix(
            suggestion_id=str(suggestion.id),
            project_id=suggestion.project_id,
            validate_before_apply=True,
            create_backup=True,
        )

        # Assertions
        assert result["success"] is True
        assert "backup_info" in result
        assert "apply_result" in result
        assert "verification_result" in result

    @pytest.mark.asyncio
    async def test_apply_automated_fix_validation_failure(
        self, remediation_service, mock_db_session
    ):
        """Test fix application failure due to validation."""
        # Setup mocks
        suggestion = RemediationSuggestion(
            id=str(uuid4()),
            automated_fix_available=True,
        )

        remediation_service._get_remediation_suggestion = AsyncMock(
            return_value=suggestion
        )
        remediation_service._validate_fix = AsyncMock(
            return_value={"is_valid": False, "errors": ["Test failed"]}
        )

        # Apply fix and expect error
        with pytest.raises(ValidationError, match="Fix validation failed"):
            await remediation_service.apply_automated_fix(
                suggestion_id=str(suggestion.id),
                project_id="test-project",
                validate_before_apply=True,
            )

    @pytest.mark.asyncio
    async def test_apply_automated_fix_no_automated_fix(
        self, remediation_service, mock_db_session
    ):
        """Test error when no automated fix is available."""
        # Setup mock
        suggestion = RemediationSuggestion(
            id=str(uuid4()),
            automated_fix_available=False,
        )

        remediation_service._get_remediation_suggestion = AsyncMock(
            return_value=suggestion
        )

        # Apply fix and expect error
        with pytest.raises(ValidationError, match="No automated fix available"):
            await remediation_service.apply_automated_fix(
                suggestion_id=str(suggestion.id),
                project_id="test-project",
            )

    def test_priority_score(self, remediation_service):
        """Test priority score conversion."""
        assert remediation_service._priority_score(RemediationPriority.CRITICAL) == 5
        assert remediation_service._priority_score(RemediationPriority.HIGH) == 4
        assert remediation_service._priority_score(RemediationPriority.MEDIUM) == 3
        assert remediation_service._priority_score(RemediationPriority.LOW) == 2
        assert remediation_service._priority_score(RemediationPriority.INFO) == 1

    def test_calculate_priority(self, remediation_service):
        """Test priority calculation from vulnerability."""
        vuln_critical = ProjectVulnerabilityModel(risk_level="critical")
        assert (
            remediation_service._calculate_priority(vuln_critical)
            == RemediationPriority.CRITICAL
        )

        vuln_high = ProjectVulnerabilityModel(risk_level="high")
        assert (
            remediation_service._calculate_priority(vuln_high)
            == RemediationPriority.HIGH
        )

        vuln_medium = ProjectVulnerabilityModel(risk_level="medium")
        assert (
            remediation_service._calculate_priority(vuln_medium)
            == RemediationPriority.MEDIUM
        )

        vuln_low = ProjectVulnerabilityModel(risk_level="low")
        assert (
            remediation_service._calculate_priority(vuln_low) == RemediationPriority.LOW
        )

    def test_estimate_effort(self, remediation_service):
        """Test effort estimation based on breaking change risk."""
        assert (
            remediation_service._estimate_effort(BreakingChangeRisk.NONE) == "5 minutes"
        )
        assert (
            remediation_service._estimate_effort(BreakingChangeRisk.LOW) == "30 minutes"
        )
        assert (
            remediation_service._estimate_effort(BreakingChangeRisk.MEDIUM) == "2 hours"
        )
        assert remediation_service._estimate_effort(BreakingChangeRisk.HIGH) == "1 day"

    def test_calculate_version_bump_confidence(self, remediation_service):
        """Test confidence score calculation for version bumps."""
        # Test with fixed version
        confidence = remediation_service._calculate_version_bump_confidence(
            fixed_versions=["2.0.0"],
            selected_version="2.0.0",
            breaking_change_risk=BreakingChangeRisk.NONE,
        )
        assert confidence == 0.8

        # Test with breaking change
        confidence = remediation_service._calculate_version_bump_confidence(
            fixed_versions=["2.0.0"],
            selected_version="2.1.0",
            breaking_change_risk=BreakingChangeRisk.HIGH,
        )
        assert confidence == 0.5  # 0.8 - 0.3 penalty

    def test_calculate_alternative_confidence(self, remediation_service):
        """Test confidence score calculation for alternatives."""
        # Create mock package
        alt_package = Package(
            maintenance_score=0.8,
            security_score=0.9,
        )

        confidence = remediation_service._calculate_alternative_confidence(
            compatibility_score=0.8,
            api_similarity=0.7,
            alternative_package=alt_package,
        )

        # Expected: (0.8 * 0.4) + (0.7 * 0.3) + (0.8 * 0.2) + (0.9 * 0.1) = 0.32 + 0.21 + 0.16 + 0.09 = 0.78
        assert abs(confidence - 0.78) < 0.01

    def test_estimate_migration_effort(self, remediation_service):
        """Test migration effort estimation."""
        # High compatibility
        effort = remediation_service._estimate_migration_effort(0.9, 0.9)
        assert effort == "30 minutes"

        # Medium compatibility
        effort = remediation_service._estimate_migration_effort(0.7, 0.7)
        assert effort == "2 hours"

        # Low compatibility
        effort = remediation_service._estimate_migration_effort(0.5, 0.5)
        assert effort == "1 day"

        # Very low compatibility
        effort = remediation_service._estimate_migration_effort(0.3, 0.3)
        assert effort == "3+ days"

    @pytest.mark.asyncio
    async def test_analyze_breaking_changes(self, remediation_service, sample_package):
        """Test breaking change analysis."""
        # Test major version bump
        risk = await remediation_service._analyze_breaking_changes(
            sample_package, "1.0.0", "2.0.0"
        )
        assert risk == BreakingChangeRisk.HIGH

        # Test minor version bump
        risk = await remediation_service._analyze_breaking_changes(
            sample_package, "1.0.0", "1.1.0"
        )
        assert risk == BreakingChangeRisk.MEDIUM

        # Test patch version bump
        risk = await remediation_service._analyze_breaking_changes(
            sample_package, "1.0.0", "1.0.1"
        )
        assert risk == BreakingChangeRisk.LOW

    @pytest.mark.asyncio
    async def test_generate_version_bump_script(self, remediation_service):
        """Test version bump script generation for different ecosystems."""
        # Test Maven
        dependency = Mock()
        dependency.version_constraint = "1.0.0"
        package = Mock()
        package.ecosystem = "maven"
        package.group_id = "org.example"
        package.artifact_id = "example-lib"

        script = await remediation_service._generate_version_bump_script(
            dependency, package, "2.0.0"
        )
        assert "mvn versions:use-dep-version" in script
        assert "2.0.0" in script

        # Test npm
        package.ecosystem = "npm"
        package.name = "example-lib"

        script = await remediation_service._generate_version_bump_script(
            dependency, package, "2.0.0"
        )
        assert "npm install" in script
        assert "example-lib@2.0.0" in script

        # Test PyPI
        package.ecosystem = "pypi"

        script = await remediation_service._generate_version_bump_script(
            dependency, package, "2.0.0"
        )
        assert "pip install" in script
        assert "example-lib==2.0.0" in script


class TestMavenRemediationAdapter:
    """Test cases for Maven remediation adapter."""

    def test_select_best_version_compatible(self):
        """Test selecting best compatible version."""
        adapter = MavenRemediationAdapter()

        version = adapter.select_best_version(
            current_version="1.0.0",
            available_versions=["1.0.0", "1.1.0", "2.0.0", "2.1.0"],
            fixed_versions=["1.1.0", "2.0.0"],
        )

        # Should select 1.1.0 as it's compatible and fixes vulnerability
        assert version == "1.1.0"

    def test_select_best_version_incompatible(self):
        """Test selecting version when only incompatible available."""
        adapter = MavenRemediationAdapter()

        version = adapter.select_best_version(
            current_version="1.0.0",
            available_versions=["1.0.0", "2.0.0", "2.1.0"],
            fixed_versions=["2.0.0", "2.1.0"],
        )

        # Should select 2.1.0 as it's the latest fixed version
        assert version == "2.1.0"

    def test_select_best_version_no_fix(self):
        """Test when no fixed versions are available."""
        adapter = MavenRemediationAdapter()

        version = adapter.select_best_version(
            current_version="1.0.0",
            available_versions=["1.0.0", "1.1.0", "2.0.0"],
            fixed_versions=[],
        )

        # Should return None
        assert version is None

    def test_clean_version(self):
        """Test version cleaning."""
        adapter = MavenRemediationAdapter()

        assert adapter._clean_version("[1.0.0,2.0.0)") == "1.0.0,2.0.0)"
        assert adapter._clean_version("^1.0.0") == "^1.0.0"
        assert adapter._clean_version("1.0.0@jar") == "1.0.0"

    def test_is_compatible(self):
        """Test version compatibility check."""
        adapter = MavenRemediationAdapter()

        # Same major version - compatible
        assert adapter._is_compatible("1.0.0", "1.1.0") is True

        # Different major version - incompatible
        assert adapter._is_compatible("1.0.0", "2.0.0") is False

        # Edge cases
        assert adapter._is_compatible("invalid", "1.0.0") is True

    def test_version_to_tuple(self):
        """Test version to tuple conversion."""
        adapter = MavenRemediationAdapter()

        assert adapter._version_to_tuple("1.0.0") == (1, 0, 0)
        assert adapter._version_to_tuple("2.1") == (2, 1, 0)
        assert adapter._version_to_tuple("invalid") == (0, 0, 0)


class TestNPMRemediationAdapter:
    """Test cases for npm remediation adapter."""

    def test_select_best_version_caret_range(self):
        """Test selecting best version for caret range."""
        adapter = NPMRemediationAdapter()

        version = adapter.select_best_version(
            current_version="^1.0.0",
            available_versions=["1.0.0", "1.1.0", "2.0.0"],
            fixed_versions=["1.1.0", "2.0.0"],
        )

        # Should select 1.1.0 as it's within the range
        assert version == "1.1.0"

    def test_select_best_version_tilde_range(self):
        """Test selecting best version for tilde range."""
        adapter = NPMRemediationAdapter()

        version = adapter.select_best_version(
            current_version="~1.0.0",
            available_versions=["1.0.0", "1.0.1", "1.1.0"],
            fixed_versions=["1.0.1", "1.1.0"],
        )

        # Should select 1.0.1 as it's within the tilde range
        assert version == "1.0.1"

    def test_satisfies_range_caret(self):
        """Test semver range satisfaction for caret."""
        adapter = NPMRemediationAdapter()

        assert adapter._satisfies_range("1.1.0", "^1.0.0") is True
        assert adapter._satisfies_range("2.0.0", "^1.0.0") is False

    def test_satisfies_range_tilde(self):
        """Test semver range satisfaction for tilde."""
        adapter = NPMRemediationAdapter()

        assert adapter._satisfies_range("1.0.1", "~1.0.0") is True
        assert adapter._satisfies_range("1.1.0", "~1.0.0") is False

    def test_satisfies_range_exact(self):
        """Test exact version match."""
        adapter = NPMRemediationAdapter()

        assert adapter._satisfies_range("1.0.0", "1.0.0") is True
        assert adapter._satisfies_range("1.0.1", "1.0.0") is False

    def test_compare_versions(self):
        """Test version comparison."""
        adapter = NPMRemediationAdapter()

        assert adapter._compare_versions("1.1.0", "1.0.0") > 0
        assert adapter._compare_versions("1.0.0", "1.1.0") < 0
        assert adapter._compare_versions("1.0.0", "1.0.0") == 0

    def test_semver_to_tuple(self):
        """Test semver to tuple conversion."""
        adapter = NPMRemediationAdapter()

        assert adapter._semver_to_tuple("1.0.0") == (1, 0, 0)
        assert adapter._semver_to_tuple("1.0.0-alpha") == (1, 0, 0)
        assert adapter._semver_to_tuple("1.0.0+build") == (1, 0, 0)


class TestPyPIRemediationAdapter:
    """Test cases for PyPI remediation adapter."""

    def test_select_best_version(self):
        """Test selecting best version for Python package."""
        adapter = PyPIRemediationAdapter()

        version = adapter.select_best_version(
            current_version="1.0.0",
            available_versions=["1.0.0", "1.1.0", "2.0.0"],
            fixed_versions=["1.1.0", "2.0.0"],
        )

        # Should select the highest version
        assert version == "2.0.0"

    def test_pep440_to_tuple(self):
        """Test PEP 440 version to tuple conversion."""
        adapter = PyPIRemediationAdapter()

        assert adapter._pep440_to_tuple("1.0.0") == (1, 0, 0)
        assert adapter._pep440_to_tuple("1.0.0rc1") == (1, 0, 0)
        assert adapter._pep440_to_tuple("1.0.0.post1") == (1, 0, 0)
        assert adapter._pep440_to_tuple("invalid") == (0, 0, 0)


class TestCargoRemediationAdapter:
    """Test cases for Cargo/Rust remediation adapter."""

    def test_select_best_version(self):
        """Test selecting best version for Cargo package."""
        adapter = CargoRemediationAdapter()

        # Should delegate to NPM adapter (semver)
        version = adapter.select_best_version(
            current_version="1.0.0",
            available_versions=["1.0.0", "1.1.0", "2.0.0"],
            fixed_versions=["1.1.0", "2.0.0"],
        )

        # Should select the highest compatible version
        assert version is not None


class TestNuGetRemediationAdapter:
    """Test cases for NuGet remediation adapter."""

    def test_select_best_version(self):
        """Test selecting best version for NuGet package."""
        adapter = NuGetRemediationAdapter()

        # Should delegate to NPM adapter (semver)
        version = adapter.select_best_version(
            current_version="1.0.0",
            available_versions=["1.0.0", "1.1.0", "2.0.0"],
            fixed_versions=["1.1.0", "2.0.0"],
        )

        # Should select the highest compatible version
        assert version is not None
