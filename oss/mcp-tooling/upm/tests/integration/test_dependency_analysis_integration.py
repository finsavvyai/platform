"""
Integration tests for Dependency Analysis Service.

Tests end-to-end dependency analysis workflows including
database operations, ecosystem adapters, and API integration.
"""

import pytest
import tempfile
import shutil
from pathlib import Path
from datetime import datetime
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from udp.services.dependency_service import DependencyAnalysisService
from udp.services.project_service import ProjectService
from udp.services.organization_service import OrganizationService
from udp.core.models.project import ProjectModel
from udp.core.models.dependency import (
    DependencyModel,
    DependencyGraphModel,
    AnalysisResultModel,
)
from udp.core.models.organization import OrganizationModel


@pytest.mark.integration
class TestDependencyAnalysisIntegration:
    """Integration tests for dependency analysis."""

    @pytest.fixture
    async def test_organization(self, db_session: AsyncSession):
        """Create test organization."""
        org_service = OrganizationService(db_session)
        organization = await org_service.create_organization(
            name="Test Organization",
            slug="test-org",
            domain="test.com",
        )
        return organization

    @pytest.fixture
    async def test_project(self, db_session: AsyncSession, test_organization):
        """Create test project."""
        project_service = ProjectService(db_session)
        project = await project_service.create_project(
            name="Test Project",
            slug="test-project",
            organization_id=str(test_organization.id),
            ecosystem="npm",
            repository_url="https://github.com/test/project.git",
        )
        return project

    @pytest.fixture
    async def dependency_service(self, db_session: AsyncSession):
        """Create dependency service with mocked dependencies."""
        service = DependencyAnalysisService(db_session)

        # Mock external dependencies that would require network calls
        # In real implementation, these would be actual service instances
        service._get_dependency = lambda name: self._get_mock_service(name)

        return service

    def _get_mock_service(self, name: str):
        """Get mock service for testing."""
        if name == "project_service":
            mock_service = AsyncMock()
            mock_service.get_project_by_id = AsyncMock()
            mock_service.update_last_analysis = AsyncMock()
            return mock_service
        elif name == "package_service":
            mock_service = AsyncMock()
            mock_service.enrich_package_metadata = AsyncMock()
            mock_service.get_or_create_package = AsyncMock()
            return mock_service
        elif name == "vulnerability_service":
            mock_service = AsyncMock()
            mock_service.get_package_vulnerabilities.return_value = []
            return mock_service
        return AsyncMock()

    @pytest.mark.asyncio
    async def test_full_dependency_analysis_workflow(
        self, db_session: AsyncSession, test_project, dependency_service
    ):
        """Test complete dependency analysis workflow."""
        # Setup project service mock
        project_service_mock = dependency_service._get_dependency("project_service")
        project_service_mock.get_project_by_id.return_value = test_project

        # Mock ecosystem adapter
        with patch.object(
            dependency_service, "_get_ecosystem_adapter"
        ) as mock_adapter_factory:
            mock_adapter = AsyncMock()
            mock_adapter_factory.return_value = mock_adapter

            # Mock dependency extraction
            with patch.object(
                dependency_service, "_extract_project_dependencies"
            ) as mock_extract:
                with patch.object(
                    dependency_service, "_resolve_dependencies"
                ) as mock_resolve:
                    with patch.object(
                        dependency_service, "_enrich_with_metadata"
                    ) as mock_enrich:
                        with patch.object(
                            dependency_service, "_build_dependency_graph"
                        ) as mock_graph:
                            with patch.object(
                                dependency_service, "_store_analysis_results"
                            ) as mock_store:
                                # Setup mock data
                                mock_extract.return_value = (
                                    self._create_sample_manifest()
                                )
                                mock_resolve.return_value = (
                                    self._create_sample_resolution()
                                )
                                mock_graph.return_value = self._create_sample_graph(
                                    test_project.id
                                )

                                # Perform analysis
                                analysis = await dependency_service.analyze_project_dependencies(
                                    str(test_project.id),
                                    analyzed_by=uuid4(),
                                )

                                # Verify analysis was created in database
                                query = select(AnalysisResultModel).where(
                                    AnalysisResultModel.project_id == test_project.id
                                )
                                result = await db_session.execute(query)
                                saved_analysis = result.scalar_one_or_none()

                                assert saved_analysis is not None
                                assert saved_analysis.status == "completed"
                                assert saved_analysis.total_dependencies > 0
                                assert saved_analysis.completed_at is not None

    @pytest.mark.asyncio
    async def test_dependency_storage_and_retrieval(
        self, db_session: AsyncSession, test_project, dependency_service
    ):
        """Test storing and retrieving dependency information."""
        # Create analysis result
        analysis = AnalysisResultModel(
            id=uuid4(),
            project_id=test_project.id,
            status="completed",
            total_dependencies=3,
            total_vulnerabilities=1,
            completed_at=datetime.utcnow(),
        )
        db_session.add(analysis)
        await db_session.commit()

        # Create sample dependencies
        dependencies = [
            DependencyModel(
                id=uuid4(),
                project_id=test_project.id,
                analysis_id=analysis.id,
                name="express",
                ecosystem="npm",
                version="4.18.2",
                is_direct=True,
                license="MIT",
            ),
            DependencyModel(
                id=uuid4(),
                project_id=test_project.id,
                analysis_id=analysis.id,
                name="lodash",
                ecosystem="npm",
                version="4.17.21",
                is_direct=True,
                license="MIT",
            ),
            DependencyModel(
                id=uuid4(),
                project_id=test_project.id,
                analysis_id=analysis.id,
                name="body-parser",
                ecosystem="npm",
                version="1.20.2",
                is_direct=False,
                license="MIT",
            ),
        ]

        for dep in dependencies:
            db_session.add(dep)

        await db_session.commit()

        # Test retrieval through service
        with patch.object(
            dependency_service, "_get_latest_analysis", return_value=analysis
        ):
            with patch.object(dependency_service, "_execute_query") as mock_query:
                # Mock query to return our dependencies
                mock_result = AsyncMock()
                mock_result.scalars.return_value.all.return_value = dependencies
                mock_query.return_value = mock_result

                # Retrieve dependencies
                result = await dependency_service.get_project_dependencies(
                    str(test_project.id)
                )

                # Verify results
                assert result["total_dependencies"] == 3
                assert len(result["dependencies"]) == 3

                # Check direct dependencies
                direct_deps = [
                    dep for dep in result["dependencies"] if dep["is_direct"]
                ]
                assert len(direct_deps) == 2

                # Check transitive dependencies
                transitive_deps = [
                    dep for dep in result["dependencies"] if not dep["is_direct"]
                ]
                assert len(transitive_deps) == 1

    @pytest.mark.asyncio
    async def test_dependency_graph_generation(
        self, db_session: AsyncSession, test_project, dependency_service
    ):
        """Test dependency graph generation and storage."""
        # Create analysis result
        analysis = AnalysisResultModel(
            id=uuid4(),
            project_id=test_project.id,
            status="completed",
            completed_at=datetime.utcnow(),
        )
        db_session.add(analysis)
        await db_session.commit()

        # Create dependency graph
        graph = DependencyGraphModel(
            id=uuid4(),
            project_id=test_project.id,
            analysis_id=analysis.id,
            ecosystem="npm",
            nodes=[
                {
                    "id": f"project:{test_project.id}",
                    "name": "test-project",
                    "version": "1.0.0",
                    "type": "project",
                    "ecosystem": "npm",
                },
                {
                    "id": "package:express:4.18.2",
                    "name": "express",
                    "version": "4.18.2",
                    "type": "package",
                    "ecosystem": "npm",
                    "license": "MIT",
                },
                {
                    "id": "package:lodash:4.17.21",
                    "name": "lodash",
                    "version": "4.17.21",
                    "type": "package",
                    "ecosystem": "npm",
                    "license": "MIT",
                },
            ],
            edges=[
                {
                    "from": f"project:{test_project.id}",
                    "to": "package:express:4.18.2",
                    "type": "direct",
                    "constraint": "^4.18.0",
                },
                {
                    "from": f"project:{test_project.id}",
                    "to": "package:lodash:4.17.21",
                    "type": "direct",
                    "constraint": "^4.17.0",
                },
            ],
        )
        db_session.add(graph)
        await db_session.commit()

        # Test graph retrieval
        with patch.object(
            dependency_service, "_get_latest_analysis", return_value=analysis
        ):
            with patch.object(dependency_service, "_execute_query") as mock_query:
                mock_result = AsyncMock()
                mock_result.scalar_one_or_none.return_value = graph
                mock_query.return_value = mock_result

                # Get graph
                result = await dependency_service.get_dependency_graph(
                    str(test_project.id)
                )

                # Verify graph structure
                assert "nodes" in result
                assert "edges" in result
                assert "metadata" in result

                assert len(result["nodes"]) == 3
                assert len(result["edges"]) == 2

                # Verify metadata
                metadata = result["metadata"]
                assert metadata["project_id"] == str(test_project.id)
                assert metadata["analysis_id"] == str(analysis.id)
                assert metadata["ecosystem"] == "npm"

    @pytest.mark.asyncio
    async def test_analysis_error_handling(
        self, db_session: AsyncSession, test_project, dependency_service
    ):
        """Test error handling in dependency analysis."""
        # Setup project service mock
        project_service_mock = dependency_service._get_dependency("project_service")
        project_service_mock.get_project_by_id.return_value = test_project

        # Mock ecosystem adapter to raise an error
        with patch.object(
            dependency_service, "_get_ecosystem_adapter"
        ) as mock_adapter_factory:
            mock_adapter = AsyncMock()
            mock_adapter_factory.return_value = mock_adapter

            # Mock dependency extraction to raise an exception
            with patch.object(
                dependency_service, "_extract_project_dependencies"
            ) as mock_extract:
                mock_extract.side_effect = Exception("Network error")

                # Perform analysis - should handle error gracefully
                with pytest.raises(Exception):
                    await dependency_service.analyze_project_dependencies(
                        str(test_project.id)
                    )

                # Verify analysis was marked as failed
                query = select(AnalysisResultModel).where(
                    AnalysisResultModel.project_id == test_project.id
                )
                result = await db_session.execute(query)
                failed_analysis = result.scalar_one_or_none()

                assert failed_analysis is not None
                assert failed_analysis.status == "failed"
                assert "Network error" in failed_analysis.error_message

    def _create_sample_manifest(self):
        """Create sample manifest for testing."""
        from udp.tools.ecosystems.base import ParsedManifest, DependencyInfo
        from udp.domain.models import EcosystemType

        return ParsedManifest(
            ecosystem=EcosystemType.NPM,
            project_name="test-project",
            project_version="1.0.0",
            dependencies=[
                DependencyInfo(
                    name="express",
                    version_constraint="^4.18.0",
                    ecosystem=EcosystemType.NPM,
                ),
                DependencyInfo(
                    name="lodash",
                    version_constraint="^4.17.0",
                    ecosystem=EcosystemType.NPM,
                ),
            ],
        )

    def _create_sample_resolution(self):
        """Create sample resolution result for testing."""
        from udp.tools.ecosystems.base import ResolutionResult
        from udp.domain.models import EcosystemType, Package as DomainPackage

        return ResolutionResult(
            resolved_dependencies=[
                DomainPackage(
                    name="express",
                    version="4.18.2",
                    ecosystem=EcosystemType.NPM,
                    is_direct=True,
                ),
                DomainPackage(
                    name="lodash",
                    version="4.17.21",
                    ecosystem=EcosystemType.NPM,
                    is_direct=True,
                ),
                DomainPackage(
                    name="body-parser",
                    version="1.20.2",
                    ecosystem=EcosystemType.NPM,
                    is_direct=False,
                    is_transitive=True,
                ),
            ],
            conflicts=[],
            warnings=[],
        )

    def _create_sample_graph(self, project_id):
        """Create sample dependency graph for testing."""
        return DependencyGraphModel(
            id=uuid4(),
            project_id=project_id,
            ecosystem="npm",
            nodes=[
                {
                    "id": f"project:{project_id}",
                    "name": "test-project",
                    "version": "1.0.0",
                    "type": "project",
                },
            ],
            edges=[],
        )


@pytest.mark.integration
class TestEcosystemIntegration:
    """Integration tests for ecosystem adapters."""

    @pytest.mark.asyncio
    async def test_npm_ecosystem_integration(self):
        """Test npm ecosystem adapter integration."""
        from udp.tools.ecosystems.factory import EcosystemAdapterFactory

        factory = EcosystemAdapterFactory()
        adapter = factory.get_adapter("npm")

        assert adapter is not None
        assert adapter.ecosystem_type.value == "npm"

    @pytest.mark.asyncio
    async def test_pypi_ecosystem_integration(self):
        """Test PyPI ecosystem adapter integration."""
        from udp.tools.ecosystems.factory import EcosystemAdapterFactory

        factory = EcosystemAdapterFactory()
        adapter = factory.get_adapter("pip")

        assert adapter is not None
        assert adapter.ecosystem_type.value == "pip"

    @pytest.mark.asyncio
    async def test_maven_ecosystem_integration(self):
        """Test Maven ecosystem adapter integration."""
        from udp.tools.ecosystems.factory import EcosystemAdapterFactory

        factory = EcosystemAdapterFactory()
        adapter = factory.get_adapter("maven")

        assert adapter is not None
        assert adapter.ecosystem_type.value == "maven"
