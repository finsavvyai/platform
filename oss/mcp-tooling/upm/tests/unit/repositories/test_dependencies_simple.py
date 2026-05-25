"""Simple tests for DependencyRepository without full app context."""

import pytest
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

from udp.infrastructure.repositories.dependencies import DependencyRepository


@pytest.fixture
def dependency_repository():
    """Create dependency repository fixture."""
    return DependencyRepository()


@pytest.fixture
def mock_db_session():
    """Create mock database session."""
    session = AsyncMock()
    session.execute = AsyncMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    session.add = AsyncMock()
    return session


class TestDependencyRepositorySimple:
    """Simplified test cases for DependencyRepository."""

    @pytest.mark.asyncio
    async def test_count_calls_execute(self, dependency_repository, mock_db_session):
        """Test that count method calls execute."""
        # Mock the result
        mock_result = AsyncMock()
        mock_result.scalar.return_value = 5
        mock_db_session.execute.return_value = mock_result

        # Call the method
        count = await dependency_repository.count(mock_db_session)

        # Verify
        assert count == 5
        mock_db_session.execute.assert_called_once()
        mock_result.scalar.assert_called_once()

    @pytest.mark.asyncio
    async def test_count_with_filters(self, dependency_repository, mock_db_session):
        """Test count method with filters."""
        from udp.domain.models import EcosystemType

        # Mock the result
        mock_result = AsyncMock()
        mock_result.scalar.return_value = 3
        mock_db_session.execute.return_value = mock_result

        # Call with filters
        count = await dependency_repository.count(
            mock_db_session, ecosystem=EcosystemType.NPM, is_active=True
        )

        # Verify
        assert count == 3
        mock_db_session.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_list_calls_execute(self, dependency_repository, mock_db_session):
        """Test that list method calls execute."""
        # Mock the result
        mock_result = AsyncMock()
        mock_package = MagicMock()
        mock_package.name = "test-package"
        mock_result.scalars.return_value.all.return_value = [mock_package]
        mock_db_session.execute.return_value = mock_result

        # Call the method
        packages = await dependency_repository.list(mock_db_session, skip=0, limit=10)

        # Verify
        assert len(packages) == 1
        assert packages[0].name == "test-package"
        mock_db_session.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_calls_execute(self, dependency_repository, mock_db_session):
        """Test that get method calls execute."""
        package_id = uuid4()

        # Mock the result
        mock_result = AsyncMock()
        mock_package = MagicMock()
        mock_package.id = package_id
        mock_result.scalars.return_value.first.return_value = mock_package
        mock_db_session.execute.return_value = mock_result

        # Call the method
        package = await dependency_repository.get(mock_db_session, package_id)

        # Verify
        assert package is not None
        assert package.id == package_id
        mock_db_session.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_not_found(self, dependency_repository, mock_db_session):
        """Test getting a non-existent package."""
        # Mock empty result
        mock_result = AsyncMock()
        mock_result.scalars.return_value.first.return_value = None
        mock_db_session.execute.return_value = mock_result

        # Call the method
        package = await dependency_repository.get(mock_db_session, uuid4())

        # Verify
        assert package is None

    @pytest.mark.asyncio
    async def test_create_calls_add_and_commit(
        self, dependency_repository, mock_db_session
    ):
        """Test that create method calls add and commit."""
        data = {
            "name": "new-package",
            "version": "1.0.0",
            "ecosystem": "npm",
        }

        # Mock the package object
        mock_package = MagicMock()
        mock_package.id = uuid4()

        # Call the method
        result = await dependency_repository.create(mock_db_session, data)

        # The actual implementation creates a PackageModel instance
        # Since we can't easily mock that, we'll just verify the calls
        mock_db_session.add.assert_called_once()
        mock_db_session.commit.assert_called_once()
        mock_db_session.refresh.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_calls_commit(self, dependency_repository, mock_db_session):
        """Test that update method calls commit."""
        # Create a mock package
        mock_package = MagicMock()
        mock_package.name = "old-name"

        data = {"name": "new-name", "version": "2.0.0"}

        # Call the method
        result = await dependency_repository.update(mock_db_session, mock_package, data)

        # Verify the attributes were set
        assert mock_package.name == "new-name"
        assert mock_package.version == "2.0.0"

        # Verify database operations
        mock_db_session.commit.assert_called_once()
        mock_db_session.refresh.assert_called_once()

    @pytest.mark.asyncio
    async def test_soft_delete_sets_is_deleted(
        self, dependency_repository, mock_db_session
    ):
        """Test that soft delete sets is_deleted flag."""
        # Create a mock package
        mock_package = MagicMock()
        mock_package.is_deleted = False

        # Call the method
        result = await dependency_repository.soft_delete(mock_db_session, mock_package)

        # Verify
        assert mock_package.is_deleted is True
        mock_db_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_search_calls_execute(self, dependency_repository, mock_db_session):
        """Test that search method calls execute."""
        # Mock the result
        mock_result = AsyncMock()
        mock_package = MagicMock()
        mock_package.name = "search-result"
        mock_result.scalars.return_value.all.return_value = [mock_package]
        mock_db_session.execute.return_value = mock_result

        # Call the method
        packages = await dependency_repository.search(mock_db_session, "search-term")

        # Verify
        assert len(packages) == 1
        assert packages[0].name == "search-result"
        mock_db_session.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_vulnerabilities_calls_execute(
        self, dependency_repository, mock_db_session
    ):
        """Test that get_vulnerabilities method calls execute."""
        package_id = uuid4()

        # Mock the result
        mock_result = AsyncMock()
        mock_vuln = MagicMock()
        mock_vuln.cve_id = "CVE-2024-1234"
        mock_result.all.return_value = [(mock_vuln, MagicMock())]
        mock_db_session.execute.return_value = mock_result

        # Call the method
        vulnerabilities = await dependency_repository.get_vulnerabilities(
            mock_db_session, package_id
        )

        # Verify
        assert len(vulnerabilities) == 1
        assert vulnerabilities[0][0].cve_id == "CVE-2024-1234"
        mock_db_session.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_vulnerability_summary(
        self, dependency_repository, mock_db_session
    ):
        """Test vulnerability summary calculation."""
        package_ids = [uuid4(), uuid4()]

        # Mock severity count result
        mock_severity_result = AsyncMock()
        mock_row = MagicMock()
        mock_row.severity.value = "HIGH"
        mock_row.count = 2
        mock_severity_result.all.return_value = [mock_row]

        # Mock total count result
        mock_total_result = AsyncMock()
        mock_total_result.scalar.return_value = 2

        # Configure execute to return different results based on call
        execute_results = [mock_severity_result, mock_total_result]
        mock_db_session.execute.side_effect = execute_results

        # Call the method
        summary = await dependency_repository.get_vulnerability_summary(
            mock_db_session, package_ids
        )

        # Verify
        assert summary["total_vulnerabilities"] == 2
        assert summary["high_count"] == 2
        assert "HIGH" in summary["by_severity"]
        assert mock_db_session.execute.call_count == 2

    @pytest.mark.asyncio
    async def test_get_licenses_filters(self, dependency_repository, mock_db_session):
        """Test get_licenses with filters."""
        # Mock the result
        mock_result = AsyncMock()
        mock_license = MagicMock()
        mock_license.spdx_id = "MIT"
        mock_license.is_osi_approved = True
        mock_result.scalars.return_value.all.return_value = [mock_license]
        mock_db_session.execute.return_value = mock_result

        # Call with filters
        licenses = await dependency_repository.get_licenses(
            mock_db_session, is_osi_approved=True, allows_commercial=True
        )

        # Verify
        assert len(licenses) == 1
        assert licenses[0].spdx_id == "MIT"
        mock_db_session.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_check_license_compatibility(
        self, dependency_repository, mock_db_session
    ):
        """Test license compatibility checking."""
        package_ids = [uuid4(), uuid4()]
        organization_id = uuid4()

        # Mock packages result
        mock_packages_result = AsyncMock()
        mock_package = MagicMock()
        mock_package.id = package_ids[0]
        mock_package.name = "test-package"
        mock_license = MagicMock()
        mock_license.spdx_id = "MIT"
        mock_license.allows_commercial_use = True
        mock_package.license = mock_license
        mock_packages_result.scalars.return_value.all.return_value = [mock_package]

        # Mock policies result
        mock_policies_result = AsyncMock()
        mock_policies_result.scalars.return_value.all.return_value = []

        # Mock organization result
        mock_org_result = AsyncMock()
        mock_org_result.limit.return_value = mock_org_result

        # Configure execute
        execute_results = [mock_packages_result, mock_policies_result, mock_org_result]
        mock_db_session.execute.side_effect = execute_results

        # Call the method
        result = await dependency_repository.check_license_compatibility(
            mock_db_session, package_ids, organization_id
        )

        # Verify
        assert result["total_packages"] == 1
        assert result["compatible_count"] == 1
        assert len(result["compatible_packages"]) == 1
        assert result["compatible_packages"][0]["license"] == "MIT"
