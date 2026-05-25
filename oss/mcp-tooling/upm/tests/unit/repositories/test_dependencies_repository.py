"""Tests for DependencyRepository."""

import pytest
from datetime import datetime
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from udp.domain.models import EcosystemType, LicenseType, SecurityLevel
from udp.infrastructure.models import (
    DependencyGraphModel,
    LicenseModel,
    PackageModel,
    PackageVulnerabilityModel,
    PolicyModel,
    VulnerabilityModel,
)
from udp.infrastructure.repositories.dependencies import DependencyRepository


@pytest.fixture
def dependency_repository() -> DependencyRepository:
    """Create dependency repository fixture."""
    return DependencyRepository()


@pytest.fixture
async def sample_package(
    db_session: AsyncSession,
) -> PackageModel:
    """Create a sample package for testing."""
    package = PackageModel(
        name="test-package",
        version="1.0.0",
        ecosystem=EcosystemType.NPM,
        description="Test package",
        homepage="https://example.com",
        repository_url="https://github.com/example/test-package",
        license=LicenseType.MIT,
        author="Test Author",
        tags=["test", "example"],
        published_at=datetime.utcnow(),
    )
    db_session.add(package)
    await db_session.commit()
    await db_session.refresh(package)
    return package


@pytest.fixture
async def sample_vulnerability(
    db_session: AsyncSession,
) -> VulnerabilityModel:
    """Create a sample vulnerability for testing."""
    vulnerability = VulnerabilityModel(
        cve_id="CVE-2024-1234",
        advisory_id="ADV-1234",
        title="Test Vulnerability",
        description="A test vulnerability",
        severity=SecurityLevel.HIGH,
        cvss_score=8.5,
        published_at=datetime.utcnow(),
        affected_versions=["1.0.0", "1.1.0"],
        fixed_versions=["1.2.0"],
        source="TEST_SOURCE",
        references=["https://example.com/vuln"],
        cwe_ids=["CWE-123"],
    )
    db_session.add(vulnerability)
    await db_session.commit()
    await db_session.refresh(vulnerability)
    return vulnerability


@pytest.fixture
async def sample_license(
    db_session: AsyncSession,
) -> LicenseModel:
    """Create a sample license for testing."""
    license_obj = LicenseModel(
        name="MIT License",
        spdx_id="MIT",
        license_type=LicenseType.MIT,
        is_osi_approved=True,
        is_copyleft=False,
        allows_commercial_use=True,
        allows_modification=True,
        allows_distribution=True,
        requires_attribution=True,
        requires_source_disclosure=False,
    )
    db_session.add(license_obj)
    await db_session.commit()
    await db_session.refresh(license_obj)
    return license_obj


class TestDependencyRepository:
    """Test cases for DependencyRepository."""

    @pytest.mark.asyncio
    async def test_count_no_filters(
        self,
        db_session: AsyncSession,
        dependency_repository: DependencyRepository,
        sample_package: PackageModel,
    ):
        """Test counting packages without filters."""
        count = await dependency_repository.count(db_session)
        assert count >= 1

    @pytest.mark.asyncio
    async def test_count_with_ecosystem_filter(
        self,
        db_session: AsyncSession,
        dependency_repository: DependencyRepository,
        sample_package: PackageModel,
    ):
        """Test counting packages with ecosystem filter."""
        count = await dependency_repository.count(
            db_session, ecosystem=EcosystemType.NPM
        )
        assert count >= 1

        count_other = await dependency_repository.count(
            db_session, ecosystem=EcosystemType.PYPI
        )
        assert count_other == 0

    @pytest.mark.asyncio
    async def test_list_packages(
        self,
        db_session: AsyncSession,
        dependency_repository: DependencyRepository,
        sample_package: PackageModel,
    ):
        """Test listing packages."""
        packages = await dependency_repository.list(db_session)
        assert len(packages) >= 1
        assert any(p.name == "test-package" for p in packages)

    @pytest.mark.asyncio
    async def test_list_packages_with_pagination(
        self,
        db_session: AsyncSession,
        dependency_repository: DependencyRepository,
        sample_package: PackageModel,
    ):
        """Test listing packages with pagination."""
        packages = await dependency_repository.list(db_session, skip=0, limit=1)
        assert len(packages) >= 1

        packages_page2 = await dependency_repository.list(db_session, skip=10, limit=5)
        # May be empty depending on total packages

    @pytest.mark.asyncio
    async def test_list_packages_with_filters(
        self,
        db_session: AsyncSession,
        dependency_repository: DependencyRepository,
        sample_package: PackageModel,
    ):
        """Test listing packages with filters."""
        packages = await dependency_repository.list(
            db_session, ecosystem=EcosystemType.NPM
        )
        assert len(packages) >= 1
        assert all(p.ecosystem == EcosystemType.NPM for p in packages)

    @pytest.mark.asyncio
    async def test_get_package_by_id(
        self,
        db_session: AsyncSession,
        dependency_repository: DependencyRepository,
        sample_package: PackageModel,
    ):
        """Test getting a package by ID."""
        package = await dependency_repository.get(db_session, sample_package.id)
        assert package is not None
        assert package.name == "test-package"
        assert package.version == "1.0.0"

    @pytest.mark.asyncio
    async def test_get_package_by_id_not_found(
        self,
        db_session: AsyncSession,
        dependency_repository: DependencyRepository,
    ):
        """Test getting a non-existent package by ID."""
        package = await dependency_repository.get(db_session, uuid4())
        assert package is None

    @pytest.mark.asyncio
    async def test_get_package_by_name(
        self,
        db_session: AsyncSession,
        dependency_repository: DependencyRepository,
        sample_package: PackageModel,
    ):
        """Test getting a package by name."""
        package = await dependency_repository.get_by_name(
            db_session, "test-package", ecosystem=EcosystemType.NPM
        )
        assert package is not None
        assert package.name == "test-package"

    @pytest.mark.asyncio
    async def test_get_package_by_registry_key(
        self,
        db_session: AsyncSession,
        dependency_repository: DependencyRepository,
        sample_package: PackageModel,
    ):
        """Test getting a package by registry key."""
        registry_key = f"{sample_package.ecosystem.value}:{sample_package.name}@{sample_package.version}"
        package = await dependency_repository.get_by_registry_key(
            db_session, registry_key
        )
        assert package is not None
        assert package.name == "test-package"

    @pytest.mark.asyncio
    async def test_search_packages(
        self,
        db_session: AsyncSession,
        dependency_repository: DependencyRepository,
        sample_package: PackageModel,
    ):
        """Test searching packages."""
        # Search by name
        packages = await dependency_repository.search(db_session, "test")
        assert len(packages) >= 1
        assert any("test" in p.name.lower() for p in packages)

        # Search by description
        packages = await dependency_repository.search(db_session, "Test package")
        assert len(packages) >= 1

        # Search by tag
        packages = await dependency_repository.search(db_session, "example")
        assert len(packages) >= 1

    @pytest.mark.asyncio
    async def test_create_package(
        self,
        db_session: AsyncSession,
        dependency_repository: DependencyRepository,
    ):
        """Test creating a new package."""
        data = {
            "name": "new-package",
            "version": "1.0.0",
            "ecosystem": EcosystemType.PYPI,
            "description": "A new test package",
            "license": LicenseType.APACHE_2_0,
            "author": "Test Author",
            "tags": ["new", "test"],
        }
        package = await dependency_repository.create(db_session, data)
        assert package.name == "new-package"
        assert package.version == "1.0.0"
        assert package.ecosystem == EcosystemType.PYPI

    @pytest.mark.asyncio
    async def test_update_package(
        self,
        db_session: AsyncSession,
        dependency_repository: DependencyRepository,
        sample_package: PackageModel,
    ):
        """Test updating a package."""
        original_version = sample_package.version
        data = {
            "description": "Updated description",
            "version": "1.1.0",
        }
        package = await dependency_repository.update(db_session, sample_package, data)
        assert package.description == "Updated description"
        assert package.version == "1.1.0"
        assert package.updated_at is not None
        assert package.updated_at > sample_package.created_at

    @pytest.mark.asyncio
    async def test_soft_delete_package(
        self,
        db_session: AsyncSession,
        dependency_repository: DependencyRepository,
        sample_package: PackageModel,
    ):
        """Test soft deleting a package."""
        package = await dependency_repository.soft_delete(db_session, sample_package)
        assert package.is_deleted is True
        assert package.updated_at is not None

        # Verify it's not returned in regular queries
        found = await dependency_repository.get(db_session, sample_package.id)
        assert found is None

    @pytest.mark.asyncio
    async def test_get_vulnerabilities(
        self,
        db_session: AsyncSession,
        dependency_repository: DependencyRepository,
        sample_package: PackageModel,
        sample_vulnerability: VulnerabilityModel,
    ):
        """Test getting vulnerabilities for a package."""
        # Create package-vulnerability association
        association = PackageVulnerabilityModel(
            package_id=sample_package.id,
            vulnerability_id=sample_vulnerability.id,
            affected_version_range=">=1.0.0,<1.2.0",
            fixed_version="1.2.0",
        )
        db_session.add(association)
        await db_session.commit()

        # Get vulnerabilities
        vulnerabilities = await dependency_repository.get_vulnerabilities(
            db_session, sample_package.id
        )
        assert len(vulnerabilities) >= 1
        assert vulnerabilities[0][0].cve_id == "CVE-2024-1234"
        assert vulnerabilities[0][0].severity == SecurityLevel.HIGH

    @pytest.mark.asyncio
    async def test_get_vulnerability_summary(
        self,
        db_session: AsyncSession,
        dependency_repository: DependencyRepository,
        sample_package: PackageModel,
        sample_vulnerability: VulnerabilityModel,
    ):
        """Test getting vulnerability summary for packages."""
        # Create package-vulnerability association
        association = PackageVulnerabilityModel(
            package_id=sample_package.id,
            vulnerability_id=sample_vulnerability.id,
            affected_version_range=">=1.0.0,<1.2.0",
            fixed_version="1.2.0",
        )
        db_session.add(association)
        await db_session.commit()

        # Get summary
        summary = await dependency_repository.get_vulnerability_summary(
            db_session, [sample_package.id]
        )
        assert summary["total_vulnerabilities"] == 1
        assert summary["high_count"] == 1
        assert summary["critical_count"] == 0
        assert "HIGH" in summary["by_severity"]

    @pytest.mark.asyncio
    async def test_create_dependency_graph(
        self,
        db_session: AsyncSession,
        dependency_repository: DependencyRepository,
        sample_package: PackageModel,
    ):
        """Test creating a dependency graph."""
        data = {
            "root_package_id": sample_package.id,
            "organization_id": uuid4(),
            "dependencies": {
                "direct": [
                    {"name": "dep1", "version": "1.0.0"},
                    {"name": "dep2", "version": "2.0.0"},
                ],
                "transitive": [
                    {"name": "dep3", "version": "1.5.0", "parent": "dep1"},
                ],
            },
            "conflicts": [],
            "vulnerabilities": [],
            "license_issues": [],
            "total_packages": 3,
            "total_vulnerabilities": 0,
            "risk_score": 2.5,
            "is_resolved": True,
        }
        graph = await dependency_repository.create_dependency_graph(db_session, data)
        assert graph.root_package_id == sample_package.id
        assert graph.total_packages == 3
        assert graph.risk_score == 2.5
        assert graph.is_resolved is True

    @pytest.mark.asyncio
    async def test_get_dependency_graph(
        self,
        db_session: AsyncSession,
        dependency_repository: DependencyRepository,
        sample_package: PackageModel,
    ):
        """Test getting a dependency graph."""
        # First create a graph
        data = {
            "root_package_id": sample_package.id,
            "organization_id": uuid4(),
            "dependencies": {},
            "conflicts": [],
            "vulnerabilities": [],
            "license_issues": [],
            "total_packages": 1,
            "total_vulnerabilities": 0,
            "risk_score": 0.0,
            "is_resolved": True,
        }
        created_graph = await dependency_repository.create_dependency_graph(
            db_session, data
        )

        # Get the graph
        graph = await dependency_repository.get_dependency_graph(
            db_session, created_graph.id, created_graph.organization_id
        )
        assert graph is not None
        assert graph.id == created_graph.id
        assert graph.root_package_id == sample_package.id

    @pytest.mark.asyncio
    async def test_list_dependency_graphs(
        self,
        db_session: AsyncSession,
        dependency_repository: DependencyRepository,
        sample_package: PackageModel,
    ):
        """Test listing dependency graphs for an organization."""
        org_id = uuid4()

        # Create multiple graphs
        for i in range(3):
            data = {
                "root_package_id": sample_package.id,
                "organization_id": org_id,
                "dependencies": {},
                "conflicts": [],
                "vulnerabilities": [f"vuln-{i}"],
                "license_issues": [],
                "total_packages": 1,
                "total_vulnerabilities": i,
                "risk_score": float(i),
                "is_resolved": i % 2 == 0,
            }
            await dependency_repository.create_dependency_graph(db_session, data)

        # List graphs with vulnerabilities
        graphs = await dependency_repository.list_dependency_graphs(
            db_session, org_id, has_vulnerabilities=True
        )
        assert len(graphs) >= 2  # At least 2 graphs have vulnerabilities

        # List graphs with minimum risk score
        graphs = await dependency_repository.list_dependency_graphs(
            db_session, org_id, min_risk_score=1.0
        )
        assert len(graphs) >= 2  # At least 2 graphs have risk >= 1.0

    @pytest.mark.asyncio
    async def test_get_licenses(
        self,
        db_session: AsyncSession,
        dependency_repository: DependencyRepository,
        sample_license: LicenseModel,
    ):
        """Test getting licenses with filters."""
        # Get all licenses
        licenses = await dependency_repository.get_licenses(db_session)
        assert len(licenses) >= 1
        assert any(l.spdx_id == "MIT" for l in licenses)

        # Get OSI approved licenses only
        licenses = await dependency_repository.get_licenses(
            db_session, is_osi_approved=True
        )
        assert len(licenses) >= 1
        assert all(l.is_osi_approved for l in licenses)

        # Get commercial use licenses
        licenses = await dependency_repository.get_licenses(
            db_session, allows_commercial=True
        )
        assert len(licenses) >= 1
        assert all(l.allows_commercial_use for l in licenses)

    @pytest.mark.asyncio
    async def test_get_policies_for_organization(
        self,
        db_session: AsyncSession,
        dependency_repository: DependencyRepository,
    ):
        """Test getting policies for an organization."""
        org_id = uuid4()

        # Create sample policies
        policies_data = [
            {
                "name": "License Policy",
                "organization_id": org_id,
                "policy_type": "license",
                "rules": {"allowed_licenses": ["MIT", "Apache-2.0"]},
                "priority": 100,
            },
            {
                "name": "Security Policy",
                "organization_id": org_id,
                "policy_type": "security",
                "rules": {"max_cvss_score": 7.0},
                "priority": 90,
            },
            {
                "name": "Inactive Policy",
                "organization_id": org_id,
                "policy_type": "license",
                "rules": {"blocked_licenses": ["GPL-3.0"]},
                "is_active": False,
                "priority": 80,
            },
        ]

        for policy_data in policies_data:
            policy = PolicyModel(**policy_data)
            db_session.add(policy)
        await db_session.commit()

        # Get active policies
        policies = await dependency_repository.get_policies_for_organization(
            db_session, org_id
        )
        assert len(policies) == 2  # Only active policies
        assert all(p.is_active for p in policies)

        # Get license policies only
        license_policies = await dependency_repository.get_policies_for_organization(
            db_session, org_id, policy_type="license"
        )
        assert len(license_policies) == 1
        assert license_policies[0].policy_type == "license"

    @pytest.mark.asyncio
    async def test_bulk_create_or_update_packages(
        self,
        db_session: AsyncSession,
        dependency_repository: DependencyRepository,
        sample_package: PackageModel,
    ):
        """Test bulk creating or updating packages."""
        packages_data = [
            {
                "name": "bulk-package-1",
                "version": "1.0.0",
                "ecosystem": EcosystemType.NPM,
                "description": "Bulk package 1",
                "registry_key": "npm:bulk-package-1@1.0.0",
            },
            {
                "name": "bulk-package-2",
                "version": "1.0.0",
                "ecosystem": EcosystemType.PYPI,
                "description": "Bulk package 2",
                "registry_key": "pypi:bulk-package-2@1.0.0",
            },
            # Update existing package
            {
                "name": sample_package.name,
                "version": "2.0.0",
                "ecosystem": sample_package.ecosystem,
                "description": "Updated description",
                "registry_key": sample_package.registry_key,
            },
        ]

        packages = await dependency_repository.bulk_create_or_update_packages(
            db_session, packages_data
        )
        assert len(packages) == 3

        # Check new packages were created
        new_package_names = {p.name for p in packages}
        assert "bulk-package-1" in new_package_names
        assert "bulk-package-2" in new_package_names

    @pytest.mark.asyncio
    async def test_get_popular_packages(
        self,
        db_session: AsyncSession,
        dependency_repository: DependencyRepository,
        sample_package: PackageModel,
    ):
        """Test getting popular packages."""
        packages = await dependency_repository.get_popular_packages(
            db_session, ecosystem=EcosystemType.NPM, limit=10
        )
        assert len(packages) >= 1
        assert all(p.ecosystem == EcosystemType.NPM for p in packages)

    @pytest.mark.asyncio
    async def test_get_package_dependencies(
        self,
        db_session: AsyncSession,
        dependency_repository: DependencyRepository,
        sample_package: PackageModel,
    ):
        """Test getting package dependencies."""
        # Create a dependency graph for the package
        data = {
            "root_package_id": sample_package.id,
            "organization_id": uuid4(),
            "dependencies": {
                "direct": [
                    {"name": "dependency-1", "version": "1.0.0"},
                    {"name": "dependency-2", "version": "2.0.0"},
                ],
                "transitive": [
                    {
                        "name": "dependency-3",
                        "version": "1.5.0",
                        "parent": "dependency-1",
                    },
                ],
            },
            "conflicts": [],
            "vulnerabilities": [],
            "license_issues": [],
            "total_packages": 3,
            "total_vulnerabilities": 0,
            "risk_score": 1.0,
            "is_resolved": True,
        }
        await dependency_repository.create_dependency_graph(db_session, data)

        # Get dependencies
        deps = await dependency_repository.get_package_dependencies(
            db_session, sample_package.id
        )
        assert deps["package_id"] == str(sample_package.id)
        assert deps["total_packages"] == 3
        assert len(deps["dependencies"]["direct"]) == 2

    @pytest.mark.asyncio
    async def test_check_license_compatibility(
        self,
        db_session: AsyncSession,
        dependency_repository: DependencyRepository,
        sample_package: PackageModel,
        sample_license: LicenseModel,
    ):
        """Test checking license compatibility."""
        # Create packages with different licenses
        packages = []
        for i in range(3):
            package = PackageModel(
                name=f"compat-package-{i}",
                version="1.0.0",
                ecosystem=EcosystemType.NPM,
                license=sample_license if i < 2 else LicenseType.GPL_3_0,
            )
            db_session.add(package)
            packages.append(package)
        await db_session.commit()

        # Get package IDs
        package_ids = [p.id for p in packages]

        # Check compatibility
        result = await dependency_repository.check_license_compatibility(
            db_session, package_ids, uuid4()
        )

        assert result["total_packages"] == 3
        assert result["compatible_count"] >= 2  # MIT licenses are compatible
        assert len(result["compatible_packages"]) >= 2
        assert all(
            p["license"] in ["MIT", "Apache-2.0"] for p in result["compatible_packages"]
        )
