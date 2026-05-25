"""
Integration tests for SBOM Service and API endpoints.

Tests end-to-end SBOM generation, management, comparison, and validation
through the API layer with database integration.
"""

import json
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from uuid import uuid4

from src.udp.main import app
from src.udp.core.models.base import Base
from src.udp.core.models import Project, Package, Dependency, SBOM, Analysis
from src.udp.services.sbom_service import SBOMService, SBOMFormat


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
async def client(test_db):
    """Create test client with database session."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        # Override database dependency
        app.dependency_overrides[get_db] = lambda: test_db
        yield ac
    app.dependency_overrides.clear()


@pytest.fixture
async def test_project(test_db):
    """Create test project."""
    project = Project(
        id=uuid4(),
        name="test-sbom-project",
        description="Test project for SBOM integration",
        primary_language="python",
        ecosystem="pypi",
        repository_url="https://github.com/test/sbom-project",
    )
    test_db.add(project)
    await test_db.commit()
    await test_db.refresh(project)
    return project


@pytest.fixture
async def test_packages(test_db):
    """Create test packages."""
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
        Package(
            id=uuid4(),
            name="pandas",
            ecosystem="pypi",
            version="2.0.0",
            description="Data analysis library",
            license="BSD-3-Clause",
            homepage="https://pandas.pydata.org/",
            repository_url="https://github.com/pandas-dev/pandas",
        ),
    ]

    for package in packages:
        test_db.add(package)

    await test_db.commit()

    for package in packages:
        await test_db.refresh(package)

    return packages


@pytest.fixture
async def test_dependencies(test_db, test_project, test_packages):
    """Create test dependencies."""
    dependencies = []
    for package in test_packages:
        dep = Dependency(
            id=uuid4(),
            project_id=test_project.id,
            package_id=package.id,
            version=package.version,
            is_direct=True,
            ecosystem="pypi",
        )
        dependencies.append(dep)
        test_db.add(dep)

    await test_db.commit()

    for dep in dependencies:
        await test_db.refresh(dep)

    return dependencies


@pytest.fixture
async def auth_headers():
    """Create authentication headers."""
    # Mock authentication - in real implementation, this would be JWT
    return {"Authorization": "Bearer test-token", "X-User-ID": str(uuid4())}


class TestSBOMIntegration:
    """Integration tests for SBOM functionality."""

    @pytest.mark.asyncio
    async def test_generate_cyclonedx_sbom_endpoint(
        self, client, test_project, test_dependencies, auth_headers
    ):
        """Test CycloneDX SBOM generation through API."""
        request_data = {
            "format": "cyclonedx",
            "include_transitive": True,
            "include_vulnerabilities": True,
            "include_licenses": True,
            "custom_metadata": {"environment": "test", "build_number": "123"},
        }

        response = await client.post(
            f"/api/v1/projects/{test_project.id}/sbom",
            json=request_data,
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert "data" in data
        assert data["data"]["format"] == "cyclonedx"
        assert data["data"]["version"] == "1.4"
        assert data["data"]["target_id"] == str(test_project.id)
        assert data["data"]["target_name"] == test_project.name
        assert data["data"]["total_components"] > 0

        # Verify SBOM was created in database
        sbom_id = data["data"]["id"]
        sbom = await test_db.get(SBOM, sbom_id)
        assert sbom is not None
        assert sbom.format == "cyclonedx"

    @pytest.mark.asyncio
    async def test_generate_spdx_sbom_endpoint(
        self, client, test_project, auth_headers
    ):
        """Test SPDX SBOM generation through API."""
        request_data = {
            "format": "spdx",
            "include_transitive": False,
            "include_vulnerabilities": False,
            "include_licenses": True,
        }

        response = await client.post(
            f"/api/v1/projects/{test_project.id}/sbom",
            json=request_data,
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert data["data"]["format"] == "spdx"
        assert data["data"]["version"] == "2.3"

    @pytest.mark.asyncio
    async def test_generate_swid_sbom_endpoint(
        self, client, test_project, auth_headers
    ):
        """Test SWID SBOM generation through API."""
        request_data = {"format": "swid", "include_transitive": True}

        response = await client.post(
            f"/api/v1/projects/{test_project.id}/sbom",
            json=request_data,
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert data["data"]["format"] == "swid"
        assert data["data"]["version"] == "1.0"

    @pytest.mark.asyncio
    async def test_generate_sbom_invalid_format(
        self, client, test_project, auth_headers
    ):
        """Test SBOM generation with invalid format."""
        request_data = {"format": "invalid-format"}

        response = await client.post(
            f"/api/v1/projects/{test_project.id}/sbom",
            json=request_data,
            headers=auth_headers,
        )

        assert response.status_code == 422  # Validation error

    @pytest.mark.asyncio
    async def test_generate_sbom_project_not_found(self, client, auth_headers):
        """Test SBOM generation for non-existent project."""
        request_data = {"format": "cyclonedx"}

        response = await client.post(
            f"/api/v1/projects/{uuid4()}/sbom", json=request_data, headers=auth_headers
        )

        assert response.status_code == 400
        data = response.json()
        assert "not found" in data["detail"].lower()

    @pytest.mark.asyncio
    async def test_get_sbom_endpoint(self, client, test_db, auth_headers):
        """Test retrieving SBOM through API."""
        # Create test SBOM
        sbom = SBOM(
            id=uuid4(),
            sbom_id="test-sbom-123",
            format="cyclonedx",
            version="1.4",
            target_type="project",
            target_id=uuid4(),
            target_name="test-project",
            sbom_data={
                "bomFormat": "CycloneDX",
                "components": [{"name": "requests", "version": "2.28.1"}],
            },
            raw_content='{"bomFormat": "CycloneDX"}',
            total_components=1,
            generated_at="2023-10-30T10:00:00Z",
            generator="UDP v1.0.0",
        )
        test_db.add(sbom)
        await test_db.commit()

        # Get SBOM
        response = await client.get(f"/api/v1/sbom/{sbom.id}", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert data["data"]["id"] == str(sbom.id)
        assert data["data"]["sbom_id"] == sbom.sbom_id
        assert data["data"]["format"] == "cyclonedx"

    @pytest.mark.asyncio
    async def test_get_sbom_with_raw_content(self, client, test_db, auth_headers):
        """Test retrieving SBOM with raw content."""
        # Create test SBOM
        sbom = SBOM(
            id=uuid4(),
            sbom_id="test-sbom-raw",
            format="cyclonedx",
            version="1.4",
            target_type="project",
            target_id=uuid4(),
            target_name="test-project",
            sbom_data={"bomFormat": "CycloneDX"},
            raw_content='{"bomFormat": "CycloneDX", "components": []}',
            total_components=0,
            generated_at="2023-10-30T10:00:00Z",
        )
        test_db.add(sbom)
        await test_db.commit()

        # Get SBOM with raw content
        response = await client.get(
            f"/api/v1/sbom/{sbom.id}?include_raw=true", headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert "raw_content" in data["data"]

    @pytest.mark.asyncio
    async def test_get_sbom_not_found(self, client, auth_headers):
        """Test retrieving non-existent SBOM."""
        response = await client.get(f"/api/v1/sbom/{uuid4()}", headers=auth_headers)

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_list_project_sboms(
        self, client, test_project, test_db, auth_headers
    ):
        """Test listing SBOMs for a project."""
        # Create multiple SBOMs
        sboms = []
        for i in range(3):
            sbom = SBOM(
                id=uuid4(),
                sbom_id=f"test-sbom-{i}",
                format="cyclonedx" if i % 2 == 0 else "spdx",
                version="1.4",
                target_type="project",
                target_id=test_project.id,
                target_name=test_project.name,
                sbom_data={"bomFormat": "CycloneDX"},
                total_components=i + 1,
                generated_at="2023-10-30T10:0{i}:00Z",
            )
            sboms.append(sbom)
            test_db.add(sbom)

        await test_db.commit()

        # List SBOMs
        response = await client.get(
            f"/api/v1/projects/{test_project.id}/sboms", headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert len(data["data"]["sboms"]) == 3
        assert data["data"]["pagination"]["total"] == 3

        # Test filtering by format
        response = await client.get(
            f"/api/v1/projects/{test_project.id}/sboms?format=cyclonedx",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]["sboms"]) == 2
        assert all(sbom["format"] == "cyclonedx" for sbom in data["data"]["sboms"])

    @pytest.mark.asyncio
    async def test_compare_sboms_endpoint(
        self, client, test_project, test_db, auth_headers
    ):
        """Test SBOM comparison through API."""
        # Create two SBOMs with different components
        sbom1 = SBOM(
            id=uuid4(),
            sbom_id="test-sbom-1",
            format="cyclonedx",
            version="1.4",
            target_type="project",
            target_id=test_project.id,
            target_name=test_project.name,
            sbom_data={
                "bomFormat": "CycloneDX",
                "components": [
                    {"name": "requests", "version": "2.28.1"},
                    {"name": "numpy", "version": "1.24.3"},
                ],
            },
            total_components=2,
            generated_at="2023-10-30T10:00:00Z",
        )

        sbom2 = SBOM(
            id=uuid4(),
            sbom_id="test-sbom-2",
            format="cyclonedx",
            version="1.4",
            target_type="project",
            target_id=test_project.id,
            target_name=test_project.name,
            sbom_data={
                "bomFormat": "CycloneDX",
                "components": [
                    {"name": "requests", "version": "2.28.2"},  # Version changed
                    {"name": "pandas", "version": "2.0.0"},  # New component
                ],
            },
            total_components=2,
            generated_at="2023-10-30T11:00:00Z",
        )

        test_db.add(sbom1)
        test_db.add(sbom2)
        await test_db.commit()

        # Compare SBOMs
        request_data = {
            "sbom_id1": str(sbom1.id),
            "sbom_id2": str(sbom2.id),
            "deep_analysis": True,
        }

        response = await client.post(
            "/api/v1/sbom/compare", json=request_data, headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert data["data"]["has_changes"] is True
        assert data["data"]["total_changes"] > 0
        assert "added_components" in data["data"]
        assert "removed_components" in data["data"]
        assert "version_changes" in data["data"]
        assert "risk_assessment" in data["data"]

    @pytest.mark.asyncio
    async def test_export_sbom_endpoint(
        self, client, test_project, test_db, auth_headers
    ):
        """Test SBOM export through API."""
        # Create test SBOM
        sbom = SBOM(
            id=uuid4(),
            sbom_id="test-export-sbom",
            format="cyclonedx",
            version="1.4",
            target_type="project",
            target_id=test_project.id,
            target_name=test_project.name,
            sbom_data={
                "bomFormat": "CycloneDX",
                "components": [{"name": "requests", "version": "2.28.1"}],
            },
            raw_content=json.dumps(
                {
                    "bomFormat": "CycloneDX",
                    "components": [{"name": "requests", "version": "2.28.1"}],
                }
            ),
            total_components=1,
            generated_at="2023-10-30T10:00:00Z",
        )
        test_db.add(sbom)
        await test_db.commit()

        # Export as JSON
        request_data = {"output_format": "json"}

        response = await client.post(
            f"/api/v1/sbom/{sbom.id}/export", json=request_data, headers=auth_headers
        )

        assert response.status_code == 200
        assert response.headers["content-type"] == "application/json"
        assert "attachment" in response.headers["content-disposition"]

        # Verify exported data
        exported_data = response.json()
        assert exported_data["bomFormat"] == "CycloneDX"

    @pytest.mark.asyncio
    async def test_delete_sbom_endpoint(self, client, test_db, auth_headers):
        """Test SBOM deletion through API."""
        # Create test SBOM
        sbom = SBOM(
            id=uuid4(),
            sbom_id="test-delete-sbom",
            format="cyclonedx",
            version="1.4",
            target_type="project",
            target_id=uuid4(),
            target_name="test-project",
            sbom_data={"bomFormat": "CycloneDX"},
            total_components=0,
            generated_at="2023-10-30T10:00:00Z",
        )
        test_db.add(sbom)
        await test_db.commit()

        # Delete SBOM
        response = await client.delete(f"/api/v1/sbom/{sbom.id}", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["deleted"] == "true"

        # Verify SBOM is deleted
        deleted_sbom = await test_db.get(SBOM, sbom.id)
        assert deleted_sbom is None

    @pytest.mark.asyncio
    async def test_validate_sbom_endpoint(self, client, auth_headers):
        """Test SBOM validation through API."""
        # Valid CycloneDX SBOM
        valid_sbom = {
            "bomFormat": "CycloneDX",
            "specVersion": "1.4",
            "serialNumber": f"urn:uuid:{uuid4()}",
            "version": 1,
            "metadata": {
                "timestamp": "2023-10-30T10:00:00Z",
                "component": {
                    "type": "application",
                    "name": "test-app",
                    "version": "1.0.0",
                },
            },
            "components": [
                {
                    "type": "library",
                    "name": "requests",
                    "version": "2.28.1",
                    "purl": "pkg:pypi/requests@2.28.1",
                }
            ],
        }

        response = await client.post(
            "/api/v1/sbom/validate?format=cyclonedx",
            json=valid_sbom,
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert "valid" in data["data"]
        assert "errors" in data["data"]
        assert "warnings" in data["data"]

    @pytest.mark.asyncio
    async def test_get_sbom_components_endpoint(
        self, client, test_project, test_db, auth_headers
    ):
        """Test getting SBOM components through API."""
        # Create test SBOM with components
        sbom = SBOM(
            id=uuid4(),
            sbom_id="test-components-sbom",
            format="cyclonedx",
            version="1.4",
            target_type="project",
            target_id=test_project.id,
            target_name=test_project.name,
            sbom_data={
                "bomFormat": "CycloneDX",
                "components": [
                    {
                        "type": "library",
                        "name": "requests",
                        "version": "2.28.1",
                        "description": "HTTP library",
                    },
                    {
                        "type": "library",
                        "name": "numpy",
                        "version": "1.24.3",
                        "description": "Array processing",
                    },
                    {
                        "type": "framework",
                        "name": "django",
                        "version": "4.2.0",
                        "description": "Web framework",
                    },
                ],
            },
            raw_content='{"bomFormat": "CycloneDX"}',
            total_components=3,
            generated_at="2023-10-30T10:00:00Z",
        )
        test_db.add(sbom)
        await test_db.commit()

        # Get all components
        response = await client.get(
            f"/api/v1/sbom/{sbom.id}/components", headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert len(data["data"]) == 3

        # Filter components by name
        response = await client.get(
            f"/api/v1/sbom/{sbom.id}/components?filter_by=requests",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]) == 1
        assert data["data"][0]["name"] == "requests"

        # Filter components by type
        response = await client.get(
            f"/api/v1/sbom/{sbom.id}/components?filter_by=library", headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]) == 2

    @pytest.mark.asyncio
    async def test_get_sbom_license_summary_endpoint(
        self, client, test_project, test_db, auth_headers
    ):
        """Test getting SBOM license summary through API."""
        # Create test SBOM with different licenses
        sbom = SBOM(
            id=uuid4(),
            sbom_id="test-licenses-sbom",
            format="cyclonedx",
            version="1.4",
            target_type="project",
            target_id=test_project.id,
            target_name=test_project.name,
            sbom_data={
                "bomFormat": "CycloneDX",
                "components": [
                    {"name": "requests", "licenses": [{"id": "MIT"}]},
                    {"name": "numpy", "licenses": [{"id": "BSD-3-Clause"}]},
                    {"name": "pandas", "licenses": [{"id": "BSD-3-Clause"}]},
                    {"name": "proprietary-lib", "licenses": [{"name": "Proprietary"}]},
                ],
            },
            raw_content='{"bomFormat": "CycloneDX"}',
            total_components=4,
            generated_at="2023-10-30T10:00:00Z",
        )
        test_db.add(sbom)
        await test_db.commit()

        # Get license summary
        response = await client.get(
            f"/api/v1/sbom/{sbom.id}/licenses", headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert data["data"]["total_components"] == 4
        assert data["data"]["components_with_licenses"] == 4
        assert data["data"]["licenses"]["MIT"] == 1
        assert data["data"]["licenses"]["BSD-3-Clause"] == 2
        assert data["data"]["licenses"]["Proprietary"] == 1

    @pytest.mark.asyncio
    async def test_unauthorized_access(self, client, test_project):
        """Test unauthorized access to SBOM endpoints."""
        # Try to generate SBOM without auth
        response = await client.post(
            f"/api/v1/projects/{test_project.id}/sbom", json={"format": "cyclonedx"}
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_complete_sbom_workflow(
        self, client, test_project, test_dependencies, auth_headers
    ):
        """Test complete SBOM workflow from generation to comparison."""
        # Step 1: Generate first SBOM
        response1 = await client.post(
            f"/api/v1/projects/{test_project.id}/sbom",
            json={"format": "cyclonedx", "include_licenses": True},
            headers=auth_headers,
        )

        assert response1.status_code == 200
        sbom1_id = response1.json()["data"]["id"]

        # Step 2: Generate second SBOM with different options
        response2 = await client.post(
            f"/api/v1/projects/{test_project.id}/sbom",
            json={"format": "cyclonedx", "include_vulnerabilities": True},
            headers=auth_headers,
        )

        assert response2.status_code == 200
        sbom2_id = response2.json()["data"]["id"]

        # Step 3: List project SBOMs
        response = await client.get(
            f"/api/v1/projects/{test_project.id}/sboms", headers=auth_headers
        )

        assert response.status_code == 200
        assert len(response.json()["data"]["sboms"]) >= 2

        # Step 4: Get SBOM details
        response = await client.get(f"/api/v1/sbom/{sbom1_id}", headers=auth_headers)

        assert response.status_code == 200

        # Step 5: Get components
        response = await client.get(
            f"/api/v1/sbom/{sbom1_id}/components", headers=auth_headers
        )

        assert response.status_code == 200

        # Step 6: Get license summary
        response = await client.get(
            f"/api/v1/sbom/{sbom1_id}/licenses", headers=auth_headers
        )

        assert response.status_code == 200

        # Step 7: Compare SBOMs
        response = await client.post(
            "/api/v1/sbom/compare",
            json={"sbom_id1": sbom1_id, "sbom_id2": sbom2_id, "deep_analysis": True},
            headers=auth_headers,
        )

        assert response.status_code == 200
        comparison_data = response.json()["data"]
        assert "risk_assessment" in comparison_data

        # Step 8: Export SBOM
        response = await client.post(
            f"/api/v1/sbom/{sbom1_id}/export",
            json={"output_format": "json"},
            headers=auth_headers,
        )

        assert response.status_code == 200

        # Step 9: Clean up - delete SBOMs
        await client.delete(f"/api/v1/sbom/{sbom1_id}", headers=auth_headers)
        await client.delete(f"/api/v1/sbom/{sbom2_id}", headers=auth_headers)
