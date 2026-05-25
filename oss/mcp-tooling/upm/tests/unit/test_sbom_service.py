"""
Unit tests for SBOM Service.

Tests SBOM generation, management, comparison, and validation
functionality across multiple formats (CycloneDX, SPDX, SWID).
"""

import asyncio
import json
import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from src.udp.services.sbom_service import SBOMService, SBOMFormat, SBOMDiffResult
from src.udp.core.models import SBOM, Analysis, Project, Package, Dependency
from src.udp.core.models.base import Base
from src.udp.domain.models import (
    Package as DomainPackage,
    DependencyGraph,
    EcosystemType,
)


@pytest.fixture
async def test_db():
    """Create test database session."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield async_session

    # Cleanup
    await engine.dispose()


@pytest.fixture
async def sbom_service(test_db):
    """Create SBOM service instance."""
    organization_id = uuid4()
    return SBOMService(test_db, organization_id=organization_id)


@pytest.fixture
def mock_project():
    """Mock project entity."""
    return Project(
        id=uuid4(),
        name="test-project",
        description="Test project for SBOM generation",
        primary_language="python",
        ecosystem="pypi",
    )


@pytest.fixture
def mock_packages():
    """Mock package entities."""
    packages = [
        Package(
            id=uuid4(),
            name="requests",
            ecosystem="pypi",
            version="2.28.1",
            description="Python HTTP library",
            license="MIT",
            homepage="https://requests.readthedocs.io/",
            repository_url="https://github.com/psf/requests",
        ),
        Package(
            id=uuid4(),
            name="numpy",
            ecosystem="pypi",
            version="1.24.3",
            description="NumPy array processing",
            license="BSD-3-Clause",
            homepage="https://numpy.org/",
            repository_url="https://github.com/numpy/numpy",
        ),
    ]
    return packages


@pytest.fixture
def mock_dependency_graph(mock_packages):
    """Mock dependency graph."""
    domain_packages = [
        DomainPackage(
            id=pkg.id,
            name=pkg.name,
            version=pkg.version,
            ecosystem=EcosystemType.PYPI,
            description=pkg.description,
            homepage=pkg.homepage,
            repository_url=pkg.repository_url,
            license=pkg.license,
            metadata={},
        )
        for pkg in mock_packages
    ]

    return DependencyGraph(
        project_id=str(uuid4()),
        ecosystem=EcosystemType.PYPI,
        dependencies=domain_packages,
    )


@pytest.fixture
def mock_cyclonedx_sbom():
    """Mock CycloneDX SBOM data."""
    return {
        "bomFormat": "CycloneDX",
        "specVersion": "1.4",
        "serialNumber": f"urn:uuid:{uuid4()}",
        "version": 1,
        "metadata": {
            "timestamp": datetime.utcnow().isoformat(),
            "tools": [
                {
                    "vendor": "Universal Dependency Platform",
                    "name": "UDP SBOM Generator",
                    "version": "1.0.0",
                }
            ],
            "component": {
                "type": "application",
                "name": "test-project",
                "version": "1.0.0",
                "bom-ref": "app:test-project",
            },
        },
        "components": [
            {
                "type": "library",
                "name": "requests",
                "version": "2.28.1",
                "purl": "pkg:pypi/requests@2.28.1",
                "bom-ref": "pkg:pypi/requests@2.28.1",
                "description": "Python HTTP library",
                "licenses": [{"id": "MIT"}],
                "externalReferences": [
                    {"type": "website", "url": "https://requests.readthedocs.io/"},
                    {"type": "vcs", "url": "https://github.com/psf/requests"},
                ],
            },
            {
                "type": "library",
                "name": "numpy",
                "version": "1.24.3",
                "purl": "pkg:pypi/numpy@1.24.3",
                "bom-ref": "pkg:pypi/numpy@1.24.3",
                "description": "NumPy array processing",
                "licenses": [{"id": "BSD-3-Clause"}],
                "externalReferences": [
                    {"type": "website", "url": "https://numpy.org/"},
                    {"type": "vcs", "url": "https://github.com/numpy/numpy"},
                ],
            },
        ],
        "dependencies": [
            {
                "ref": "app:test-project",
                "dependsOn": ["pkg:pypi/requests@2.28.1", "pkg:pypi/numpy@1.24.3"],
            }
        ],
    }


@pytest.fixture
def mock_spdx_sbom():
    """Mock SPDX SBOM data."""
    return {
        "spdxVersion": "SPDX-2.3",
        "dataLicense": "CC0-1.0",
        "SPDXID": "SPDXRef-DOCUMENT",
        "name": "SPDX Document for test-project",
        "documentNamespace": f"https://udp.dev/spdx/{uuid4()}",
        "creationInfo": {
            "created": datetime.utcnow().isoformat(),
            "creators": ["Tool: Universal Dependency Platform SBOM Generator-1.0.0"],
            "licenseListVersion": "3.19",
        },
        "packages": [
            {
                "SPDXID": "SPDXRef-requests",
                "name": "requests",
                "versionInfo": "2.28.1",
                "downloadLocation": "NOASSERTION",
                "filesAnalyzed": False,
                "licenseConcluded": "MIT",
                "licenseDeclared": "MIT",
                "copyrightText": "NOASSERTION",
                "description": "Python HTTP library",
                "externalRefs": [
                    {
                        "referenceCategory": "PACKAGE-MANAGER",
                        "referenceType": "purl",
                        "referenceLocator": "pkg:pypi/requests@2.28.1",
                    }
                ],
            }
        ],
        "relationships": [
            {
                "spdxElementId": "SPDXRef-DOCUMENT",
                "relationshipType": "DESCRIBES",
                "relatedSpdxElement": "SPDXRef-test-project",
            }
        ],
    }


class TestSBOMService:
    """Test cases for SBOM Service."""

    @pytest.mark.asyncio
    async def test_generate_cyclonedx_sbom(
        self, sbom_service, mock_project, mock_dependency_graph, test_db
    ):
        """Test CycloneDX SBOM generation."""
        # Mock database queries
        with (
            patch.object(
                sbom_service,
                "_build_dependency_graph",
                return_value=mock_dependency_graph,
            ),
            patch("src.udp.services.sbom_service.SBOMGenerator") as mock_generator,
        ):
            # Setup mock generator
            mock_instance = mock_generator.return_value
            mock_instance.generate_sbom.return_value = {
                "bomFormat": "CycloneDX",
                "components": [
                    {"name": "requests", "version": "2.28.1"},
                    {"name": "numpy", "version": "1.24.3"},
                ],
            }

            # Mock project query
            mock_db_project = MagicMock()
            mock_db_project.id = mock_project.id
            mock_db_project.name = mock_project.name
            mock_db_project.dependencies = []

            test_db.get = AsyncMock(return_value=mock_db_project)

            # Generate SBOM
            sbom = await sbom_service.generate_sbom(
                project_id=mock_project.id,
                format_type=SBOMFormat.CYCLEDX,
                include_transitive=True,
                include_vulnerabilities=True,
                include_licenses=True,
            )

            # Assertions
            assert sbom is not None
            assert sbom.format == SBOMFormat.CYCLEDX
            assert sbom.version == "1.4"
            assert sbom.target_id == mock_project.id
            assert sbom.target_name == mock_project.name
            assert sbom.total_components == 2
            assert sbom.generator == "Universal Dependency Platform v1.0.0"

            # Verify generator was called
            mock_instance.generate_sbom.assert_called_once()

    @pytest.mark.asyncio
    async def test_generate_spdx_sbom(
        self, sbom_service, mock_project, mock_dependency_graph, test_db
    ):
        """Test SPDX SBOM generation."""
        with (
            patch.object(
                sbom_service,
                "_build_dependency_graph",
                return_value=mock_dependency_graph,
            ),
            patch("src.udp.services.sbom_service.SBOMGenerator") as mock_generator,
        ):
            # Setup mock generator
            mock_instance = mock_generator.return_value
            mock_instance.generate_sbom.return_value = {
                "spdxVersion": "SPDX-2.3",
                "packages": [{"name": "requests", "versionInfo": "2.28.1"}],
            }

            # Mock project query
            mock_db_project = MagicMock()
            mock_db_project.id = mock_project.id
            mock_db_project.name = mock_project.name
            mock_db_project.dependencies = []

            test_db.get = AsyncMock(return_value=mock_db_project)

            # Generate SBOM
            sbom = await sbom_service.generate_sbom(
                project_id=mock_project.id, format_type=SBOMFormat.SPDX
            )

            # Assertions
            assert sbom is not None
            assert sbom.format == SBOMFormat.SPDX
            assert sbom.version == "2.3"

    @pytest.mark.asyncio
    async def test_generate_swid_sbom(
        self, sbom_service, mock_project, mock_dependency_graph, test_db
    ):
        """Test SWID SBOM generation."""
        # Mock project query
        mock_db_project = MagicMock()
        mock_db_project.id = mock_project.id
        mock_db_project.name = mock_project.name
        mock_db_project.dependencies = []

        test_db.get = AsyncMock(return_value=mock_db_project)

        # Generate SWID SBOM
        sbom = await sbom_service.generate_sbom(
            project_id=mock_project.id, format_type=SBOMFormat.SWID
        )

        # Assertions
        assert sbom is not None
        assert sbom.format == SBOMFormat.SWID
        assert sbom.version == "1.0"
        assert "software_identity" in sbom.sbom_data

    @pytest.mark.asyncio
    async def test_generate_sbom_project_not_found(self, sbom_service):
        """Test SBOM generation with non-existent project."""
        with patch.object(sbom_service.db, "get", return_value=None):
            with pytest.raises(ValueError, match="Project .* not found"):
                await sbom_service.generate_sbom(
                    project_id=uuid4(), format_type=SBOMFormat.CYCLEDX
                )

    @pytest.mark.asyncio
    async def test_get_sbom(self, sbom_service, mock_cyclonedx_sbom, test_db):
        """Test retrieving SBOM by ID."""
        # Create test SBOM
        sbom_id = uuid4()
        test_sbom = SBOM(
            id=sbom_id,
            sbom_id="test-sbom-1",
            format=SBOMFormat.CYCLEDX,
            version="1.4",
            target_type="project",
            target_id=uuid4(),
            target_name="test-project",
            sbom_data=mock_cyclonedx_sbom,
            raw_content=json.dumps(mock_cyclonedx_sbom),
            total_components=2,
            generated_at=datetime.utcnow().isoformat(),
        )

        test_db.query = MagicMock()
        test_db.query.return_value.filter.return_value.first = AsyncMock(
            return_value=test_sbom
        )

        # Get SBOM
        result = await sbom_service.get_sbom(sbom_id)

        # Assertions
        assert result is not None
        assert result.id == sbom_id
        assert result.format == SBOMFormat.CYCLEDX

    @pytest.mark.asyncio
    async def test_get_sbom_not_found(self, sbom_service, test_db):
        """Test retrieving non-existent SBOM."""
        test_db.query = MagicMock()
        test_db.query.return_value.filter.return_value.first = AsyncMock(
            return_value=None
        )

        result = await sbom_service.get_sbom(uuid4())

        assert result is None

    @pytest.mark.asyncio
    async def test_list_sboms(self, sbom_service, test_db):
        """Test listing SBOMs with filters."""
        # Create mock SBOMs
        sboms = [
            SBOM(
                id=uuid4(),
                sbom_id=f"test-sbom-{i}",
                format=SBOMFormat.CYCLEDX,
                version="1.4",
                target_type="project",
                target_id=uuid4(),
                target_name=f"test-project-{i}",
                sbom_data={},
                total_components=i + 1,
                generated_at=datetime.utcnow().isoformat(),
            )
            for i in range(3)
        ]

        # Mock query
        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.offset.return_value = mock_query
        mock_query.limit.return_value = AsyncMock(return_value=sboms)

        mock_count_query = MagicMock()
        mock_count_query.filter.return_value = mock_count_query
        mock_count_query.scalar = AsyncMock(return_value=3)

        test_db.query = MagicMock(side_effect=[mock_count_query, mock_query])

        # List SBOMs
        result, total = await sbom_service.list_sboms(
            target_type="project", limit=10, offset=0
        )

        # Assertions
        assert len(result) == 3
        assert total == 3
        assert all(sbom.target_type == "project" for sbom in result)

    @pytest.mark.asyncio
    async def test_compare_sboms(self, sbom_service, mock_cyclonedx_sbom, test_db):
        """Test SBOM comparison."""
        # Create two SBOMs with different components
        sbom1_data = {
            "bomFormat": "CycloneDX",
            "components": [
                {"name": "requests", "version": "2.28.1"},
                {"name": "numpy", "version": "1.24.3"},
            ],
        }

        sbom2_data = {
            "bomFormat": "CycloneDX",
            "components": [
                {"name": "requests", "version": "2.28.2"},  # Version changed
                {"name": "pandas", "version": "2.0.0"},  # New component
            ],
        }

        sbom1 = SBOM(
            id=uuid4(),
            sbom_id="test-sbom-1",
            format=SBOMFormat.CYCLEDX,
            version="1.4",
            target_type="project",
            target_id=uuid4(),
            target_name="test-project",
            sbom_data=sbom1_data,
            raw_content=json.dumps(sbom1_data),
        )

        sbom2 = SBOM(
            id=uuid4(),
            sbom_id="test-sbom-2",
            format=SBOMFormat.CYCLEDX,
            version="1.4",
            target_type="project",
            target_id=uuid4(),
            target_name="test-project",
            sbom_data=sbom2_data,
            raw_content=json.dumps(sbom2_data),
        )

        # Mock get_sbom calls
        with patch.object(sbom_service, "get_sbom", side_effect=[sbom1, sbom]):
            # Compare SBOMs
            diff = await sbom_service.compare_sboms(
                sbom_id1=sbom1.id, sbom_id2=sbom2.id, deep_analysis=True
            )

            # Assertions
            assert isinstance(diff, SBOMDiffResult)
            assert diff.has_changes
            assert len(diff.added_components) == 1  # pandas
            assert len(diff.removed_components) == 1  # numpy
            assert len(diff.version_changes) == 1  # requests
            assert diff.total_changes > 0
            assert "risk_level" in diff.risk_assessment

    @pytest.mark.asyncio
    async def test_compare_sboms_not_found(self, sbom_service):
        """Test SBOM comparison with non-existent SBOM."""
        with patch.object(sbom_service, "get_sbom", return_value=None):
            with pytest.raises(ValueError, match="One or both SBOMs not found"):
                await sbom_service.compare_sboms(sbom_id1=uuid4(), sbom_id2=uuid4())

    @pytest.mark.asyncio
    async def test_delete_sbom(self, sbom_service, test_db):
        """Test SBOM deletion."""
        sbom_id = uuid4()
        test_sbom = SBOM(id=sbom_id, sbom_id="test")

        test_db.get = AsyncMock(return_value=test_sbom)
        test_db.delete = AsyncMock()
        test_db.commit = AsyncMock()

        # Delete SBOM
        result = await sbom_service.delete_sbom(sbom_id)

        # Assertions
        assert result is True
        test_db.delete.assert_called_once_with(test_sbom)

    @pytest.mark.asyncio
    async def test_delete_sbom_not_found(self, sbom_service, test_db):
        """Test deleting non-existent SBOM."""
        test_db.get = AsyncMock(return_value=None)

        result = await sbom_service.delete_sbom(uuid4())

        assert result is False

    @pytest.mark.asyncio
    async def test_export_sbom(self, sbom_service, mock_cyclonedx_sbom, test_db):
        """Test SBOM export."""
        sbom_id = uuid4()
        sbom = SBOM(
            id=sbom_id,
            sbom_id="test-sbom",
            format=SBOMFormat.CYCLEDX,
            target_name="test-project",
            sbom_data=mock_cyclonedx_sbom,
            raw_content=json.dumps(mock_cyclonedx_sbom),
        )

        with patch.object(sbom_service, "get_sbom", return_value=sbom):
            # Export as JSON
            result = await sbom_service.export_sbom(
                sbom_id=sbom_id, output_format="json"
            )

            assert isinstance(result, dict)
            assert result["bomFormat"] == "CycloneDX"

    @pytest.mark.asyncio
    async def test_export_sbom_not_found(self, sbom_service):
        """Test exporting non-existent SBOM."""
        with patch.object(sbom_service, "get_sbom", return_value=None):
            with pytest.raises(ValueError, match="SBOM .* not found"):
                await sbom_service.export_sbom(uuid4())

    @pytest.mark.asyncio
    async def test_validate_sbom(self, sbom_service, mock_cyclonedx_sbom):
        """Test SBOM validation."""
        with patch.object(
            sbom_service.sbom_generator, "validate_sbom"
        ) as mock_validate:
            mock_validate.return_value = {
                "valid": True,
                "errors": [],
                "warnings": [],
                "format": "cyclonedx",
            }

            # Validate SBOM
            result = await sbom_service.validate_sbom(
                sbom_data=mock_cyclonedx_sbom, format_type=SBOMFormat.CYCLEDX
            )

            # Assertions
            assert result["valid"] is True
            assert len(result["errors"]) == 0
            mock_validate.assert_called_once_with(
                mock_cyclonedx_sbom, SBOMFormat.CYCLEDX
            )

    @pytest.mark.asyncio
    async def test_validate_sbom_without_generator(self, sbom_service):
        """Test SBOM validation without initialized generator."""
        sbom_service.sbom_generator = None

        with pytest.raises(ValueError, match="SBOM generator not initialized"):
            await sbom_service.validate_sbom({}, SBOMFormat.CYCLEDX)

    def test_build_dependency_graph(self, sbom_service):
        """Test building dependency graph (synchronous test)."""
        # This is a placeholder - actual implementation would be async
        assert hasattr(sbom_service, "_build_dependency_graph")

    def test_generate_swid_sbom(
        self, sbom_service, mock_project, mock_dependency_graph
    ):
        """Test SWID SBOM generation (synchronous test)."""
        # This is a placeholder - actual implementation would be async
        assert hasattr(sbom_service, "_generate_swid_sbom")

    def test_enrich_with_vulnerabilities(self, sbom_service):
        """Test vulnerability enrichment (synchronous test)."""
        # This is a placeholder - actual implementation would be async
        assert hasattr(sbom_service, "_enrich_with_vulnerabilities")

    def test_get_format_version(self, sbom_service):
        """Test getting format version."""
        assert sbom_service._get_format_version(SBOMFormat.CYCLEDX) == "1.4"
        assert sbom_service._get_format_version(SBOMFormat.SPDX) == "2.3"
        assert sbom_service._get_format_version(SBOMFormat.SWID) == "1.0"
        assert sbom_service._get_format_version("unknown") == "1.0"

    def test_has_significant_changes(self, sbom_service):
        """Test checking for significant component changes."""
        comp1 = {
            "name": "test",
            "version": "1.0.0",
            "hashes": ["sha256:abc123"],
            "copyright": "Copyright 2023",
        }

        comp2 = {
            "name": "test",
            "version": "1.0.0",
            "hashes": ["sha256:def456"],
            "copyright": "Copyright 2023",
        }

        assert sbom_service._has_significant_changes(comp1, comp2) is True

        comp2["hashes"] = comp1["hashes"]
        assert sbom_service._has_significant_changes(comp1, comp2) is False

    def test_get_component_changes(self, sbom_service):
        """Test getting component changes."""
        comp1 = {"name": "test", "version": "1.0.0", "description": "Test component"}

        comp2 = {"name": "test", "version": "2.0.0", "description": "Updated component"}

        changes = sbom_service._get_component_changes(comp1, comp2)

        assert len(changes) == 2
        assert any(c["field"] == "version" for c in changes)
        assert any(c["field"] == "description" for c in changes)


class TestSBOMDiffResult:
    """Test cases for SBOMDiffResult."""

    def test_diff_result_initialization(self):
        """Test SBOMDiffResult initialization."""
        diff = SBOMDiffResult()

        assert diff.added_components == []
        assert diff.removed_components == []
        assert diff.modified_components == []
        assert diff.license_changes == []
        assert diff.version_changes == []
        assert diff.vulnerability_changes == []
        assert diff.compliance_impact == {}
        assert diff.risk_assessment == {}

    def test_has_changes_property(self):
        """Test has_changes property."""
        diff = SBOMDiffResult()
        assert diff.has_changes is False

        diff.added_components.append({"name": "test"})
        assert diff.has_changes is True

    def test_total_changes_property(self):
        """Test total_changes property."""
        diff = SBOMDiffResult()
        assert diff.total_changes == 0

        diff.added_components.append({"name": "test1"})
        diff.removed_components.append({"name": "test2"})
        diff.version_changes.append({"name": "test3"})

        assert diff.total_changes == 3
