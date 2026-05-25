"""
Unit tests for dependency service functionality.
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from uuid import uuid4

from udp.services.dependency_service import DependencyService
from udp.core.schemas.dependency import (
    DependencyCreate,
    DependencyUpdate,
    DependencySearch,
    DependencyLanguage,
    DependencyFramework,
)


class TestDependencyService:
    """Test dependency service."""

    @pytest.fixture
    def mock_db(self):
        """Create mock database session."""
        return AsyncMock()

    @pytest.fixture
    def dependency_service(self, mock_db):
        """Create dependency service with mock database."""
        return DependencyService(mock_db)

    @pytest.fixture
    def sample_dependency_create(self):
        """Create sample dependency creation data."""
        return DependencyCreate(
            name="test-dependency",
            version="1.0.0",
            language=DependencyLanguage.PYTHON,
            framework=DependencyFramework.FASTAPI,
            description="Test dependency",
            repository_url="https://github.com/test/repo",
            metadata={"key": "value"},
        )

    @pytest.mark.asyncio
    async def test_create_dependency(
        self, dependency_service, mock_db, sample_dependency_create
    ):
        """Test dependency creation."""
        # Mock database commit and refresh
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()

        result = await dependency_service.create(sample_dependency_create)

        assert result is not None
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()
        mock_db.refresh.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_dependency_success(self, dependency_service, mock_db):
        """Test successful dependency retrieval."""
        dependency_id = str(uuid4())
        mock_dependency = MagicMock()
        mock_dependency.id = dependency_id

        mock_result = AsyncMock()
        mock_result.scalar_one_or_none.return_value = mock_dependency
        mock_db.execute.return_value = mock_result

        result = await dependency_service.get(dependency_id)

        assert result == mock_dependency
        mock_db.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_dependency_not_found(self, dependency_service, mock_db):
        """Test dependency retrieval when not found."""
        dependency_id = str(uuid4())

        mock_result = AsyncMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        result = await dependency_service.get(dependency_id)

        assert result is None

    @pytest.mark.asyncio
    async def test_get_dependency_invalid_uuid(self, dependency_service, mock_db):
        """Test dependency retrieval with invalid UUID."""
        invalid_id = "invalid-uuid"

        result = await dependency_service.get(invalid_id)

        assert result is None
        mock_db.execute.assert_not_called()

    @pytest.mark.asyncio
    async def test_list_dependencies(self, dependency_service, mock_db):
        """Test dependency listing."""
        mock_dependencies = [MagicMock(), MagicMock()]

        mock_result = AsyncMock()
        mock_result.scalars.return_value.all.return_value = mock_dependencies
        mock_db.execute.return_value = mock_result

        result = await dependency_service.list(skip=0, limit=10)

        assert result == mock_dependencies
        mock_db.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_list_dependencies_with_filters(self, dependency_service, mock_db):
        """Test dependency listing with filters."""
        filters = {"language": "python", "framework": "fastapi", "search": "test"}

        mock_result = AsyncMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db.execute.return_value = mock_result

        result = await dependency_service.list(skip=0, limit=10, filters=filters)

        assert result == []
        mock_db.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_dependency_success(self, dependency_service, mock_db):
        """Test successful dependency update."""
        dependency_id = str(uuid4())
        update_data = DependencyUpdate(name="updated-name")

        mock_dependency = MagicMock()
        mock_dependency.name = "old-name"

        # Mock get method
        with patch.object(dependency_service, "get", return_value=mock_dependency):
            # Mock database operations
            mock_db.commit = AsyncMock()
            mock_db.refresh = AsyncMock()

            result = await dependency_service.update(dependency_id, update_data)

            assert result == mock_dependency
            assert mock_dependency.name == "updated-name"
            mock_db.commit.assert_called_once()
            mock_db.refresh.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_dependency_not_found(self, dependency_service, mock_db):
        """Test dependency update when not found."""
        dependency_id = str(uuid4())
        update_data = DependencyUpdate(name="updated-name")

        with patch.object(dependency_service, "get", return_value=None):
            result = await dependency_service.update(dependency_id, update_data)

            assert result is None

    @pytest.mark.asyncio
    async def test_delete_dependency_success(self, dependency_service, mock_db):
        """Test successful dependency deletion."""
        dependency_id = str(uuid4())
        mock_dependency = MagicMock()

        with patch.object(dependency_service, "get", return_value=mock_dependency):
            mock_db.delete = AsyncMock()
            mock_db.commit = AsyncMock()

            result = await dependency_service.delete(dependency_id)

            assert result is True
            mock_db.delete.assert_called_once_with(mock_dependency)
            mock_db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_delete_dependency_not_found(self, dependency_service, mock_db):
        """Test dependency deletion when not found."""
        dependency_id = str(uuid4())

        with patch.object(dependency_service, "get", return_value=None):
            result = await dependency_service.delete(dependency_id)

            assert result is False
            mock_db.delete.assert_not_called()

    @pytest.mark.asyncio
    async def test_search_dependencies(self, dependency_service, mock_db):
        """Test dependency search."""
        search_query = DependencySearch(
            query="test",
            language=DependencyLanguage.PYTHON,
            framework=DependencyFramework.FASTAPI,
            limit=20,
            offset=0,
        )

        mock_dependencies = [MagicMock()]
        mock_result = AsyncMock()
        mock_result.scalars.return_value.all.return_value = mock_dependencies
        mock_db.execute.return_value = mock_result

        result = await dependency_service.search(search_query)

        assert result == mock_dependencies
        mock_db.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_popular_dependencies(self, dependency_service, mock_db):
        """Test getting popular dependencies."""
        language = "python"
        limit = 10

        mock_dependencies = [MagicMock()]
        mock_result = AsyncMock()
        mock_result.scalars.return_value.all.return_value = mock_dependencies
        mock_db.execute.return_value = mock_result

        result = await dependency_service.get_popular(language, limit)

        assert result == mock_dependencies
        mock_db.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_analyze_dependency_success(self, dependency_service, mock_db):
        """Test dependency analysis."""
        dependency_id = str(uuid4())
        mock_dependency = MagicMock()
        mock_dependency.id = uuid4()
        mock_dependency.updated_at = "2023-01-01T00:00:00Z"

        with patch.object(dependency_service, "get", return_value=mock_dependency):
            mock_db.add = AsyncMock()
            mock_db.commit = AsyncMock()

            result = await dependency_service.analyze(dependency_id)

            assert result is not None
            assert result.dependency_id == dependency_id
            assert len(result.vulnerabilities) > 0
            assert result.compatibility_score == 0.85
            mock_db.add.assert_called_once()
            mock_db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_analyze_dependency_not_found(self, dependency_service, mock_db):
        """Test dependency analysis when dependency not found."""
        dependency_id = str(uuid4())

        with patch.object(dependency_service, "get", return_value=None):
            with pytest.raises(ValueError, match="Dependency not found"):
                await dependency_service.analyze(dependency_id)
