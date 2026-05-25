"""
Integration tests for API endpoints.
"""

import pytest
from httpx import AsyncClient


class TestHealthEndpoints:
    """Test health check endpoints."""

    @pytest.mark.asyncio
    async def test_health_check(self, client: AsyncClient):
        """Test health check endpoint."""
        response = await client.get("/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "version" in data
        assert "environment" in data

    @pytest.mark.asyncio
    async def test_readiness_check(self, client: AsyncClient):
        """Test readiness check endpoint."""
        response = await client.get("/ready")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ready"
        assert "checks" in data

    @pytest.mark.asyncio
    async def test_root_endpoint(self, client: AsyncClient):
        """Test root endpoint."""
        response = await client.get("/")

        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "version" in data
        assert "docs" in data


class TestAuthenticationEndpoints:
    """Test authentication endpoints."""

    @pytest.mark.asyncio
    async def test_login_success(self, client: AsyncClient, test_user):
        """Test successful login."""
        login_data = {"username": test_user.email, "password": "secret"}

        response = await client.post("/api/v1/auth/login", data=login_data)

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "token_type" in data
        assert "expires_in" in data
        assert data["token_type"] == "bearer"

    @pytest.mark.asyncio
    async def test_login_invalid_credentials(self, client: AsyncClient):
        """Test login with invalid credentials."""
        login_data = {
            "username": "nonexistent@example.com",
            "password": "wrongpassword",
        }

        response = await client.post("/api/v1/auth/login", data=login_data)

        assert response.status_code == 401
        data = response.json()
        assert "detail" in data

    @pytest.mark.asyncio
    async def test_register_success(self, client: AsyncClient):
        """Test successful user registration."""
        user_data = {
            "email": "newuser@example.com",
            "password": "SecurePassword123",
            "full_name": "New User",
        }

        response = await client.post("/api/v1/auth/register", json=user_data)

        assert response.status_code == 200
        data = response.json()
        assert data["email"] == user_data["email"]
        assert data["full_name"] == user_data["full_name"]
        assert "id" in data
        assert "password" not in data

    @pytest.mark.asyncio
    async def test_register_duplicate_email(self, client: AsyncClient, test_user):
        """Test registration with duplicate email."""
        user_data = {
            "email": test_user.email,
            "password": "SecurePassword123",
            "full_name": "Duplicate User",
        }

        response = await client.post("/api/v1/auth/register", json=user_data)

        assert response.status_code == 400
        data = response.json()
        assert "already registered" in data["detail"].lower()

    @pytest.mark.asyncio
    async def test_get_current_user(self, client: AsyncClient, test_headers):
        """Test getting current user info."""
        response = await client.get("/api/v1/auth/me", headers=test_headers)

        assert response.status_code == 200
        data = response.json()
        assert "email" in data
        assert "id" in data
        assert "password" not in data

    @pytest.mark.asyncio
    async def test_get_current_user_unauthorized(self, client: AsyncClient):
        """Test getting current user without authentication."""
        response = await client.get("/api/v1/auth/me")

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_refresh_token(self, client: AsyncClient, test_headers):
        """Test token refresh."""
        response = await client.post("/api/v1/auth/refresh", headers=test_headers)

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "token_type" in data
        assert "expires_in" in data


class TestDependencyEndpoints:
    """Test dependency management endpoints."""

    @pytest.mark.asyncio
    async def test_list_dependencies(self, client: AsyncClient, test_headers):
        """Test listing dependencies."""
        response = await client.get("/api/v1/dependencies/", headers=test_headers)

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    @pytest.mark.asyncio
    async def test_create_dependency(self, client: AsyncClient, test_headers):
        """Test creating a dependency."""
        dependency_data = {
            "name": "test-lib",
            "version": "1.0.0",
            "language": "python",
            "framework": "fastapi",
            "description": "Test library",
        }

        response = await client.post(
            "/api/v1/dependencies/", json=dependency_data, headers=test_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == dependency_data["name"]
        assert data["version"] == dependency_data["version"]
        assert "id" in data

    @pytest.mark.asyncio
    async def test_create_dependency_unauthorized(self, client: AsyncClient):
        """Test creating dependency without authentication."""
        dependency_data = {"name": "test-lib", "version": "1.0.0", "language": "python"}

        response = await client.post("/api/v1/dependencies/", json=dependency_data)

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_dependency(
        self, client: AsyncClient, test_headers, test_dependency
    ):
        """Test getting a specific dependency."""
        response = await client.get(
            f"/api/v1/dependencies/{test_dependency.id}", headers=test_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(test_dependency.id)
        assert data["name"] == test_dependency.name

    @pytest.mark.asyncio
    async def test_get_dependency_not_found(self, client: AsyncClient, test_headers):
        """Test getting non-existent dependency."""
        fake_id = "00000000-0000-0000-0000-000000000000"

        response = await client.get(
            f"/api/v1/dependencies/{fake_id}", headers=test_headers
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_dependency(
        self, client: AsyncClient, test_headers, test_dependency
    ):
        """Test updating a dependency."""
        update_data = {"description": "Updated description"}

        response = await client.put(
            f"/api/v1/dependencies/{test_dependency.id}",
            json=update_data,
            headers=test_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["description"] == update_data["description"]

    @pytest.mark.asyncio
    async def test_delete_dependency(
        self, client: AsyncClient, test_headers, test_dependency
    ):
        """Test deleting a dependency."""
        response = await client.delete(
            f"/api/v1/dependencies/{test_dependency.id}", headers=test_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert "deleted successfully" in data["message"]

    @pytest.mark.asyncio
    async def test_analyze_dependency(
        self, client: AsyncClient, test_headers, test_dependency
    ):
        """Test dependency analysis."""
        response = await client.post(
            f"/api/v1/dependencies/{test_dependency.id}/analyze", headers=test_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert "vulnerabilities" in data
        assert "compatibility_score" in data
        assert "recommendations" in data

    @pytest.mark.asyncio
    async def test_search_dependencies(self, client: AsyncClient, test_headers):
        """Test dependency search."""
        search_data = {"query": "test", "language": "python", "limit": 10}

        response = await client.post(
            "/api/v1/dependencies/search", json=search_data, headers=test_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    @pytest.mark.asyncio
    async def test_get_popular_dependencies(self, client: AsyncClient, test_headers):
        """Test getting popular dependencies."""
        response = await client.get(
            "/api/v1/dependencies/languages/python/popular?limit=5",
            headers=test_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestWorkflowEndpoints:
    """Test workflow management endpoints."""

    @pytest.mark.asyncio
    async def test_list_workflows(self, client: AsyncClient, test_headers):
        """Test listing workflows."""
        response = await client.get("/api/v1/workflows/", headers=test_headers)

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    @pytest.mark.asyncio
    async def test_create_workflow(self, client: AsyncClient, test_headers):
        """Test creating a workflow."""
        workflow_data = {
            "name": "Test Workflow",
            "description": "Test workflow for integration testing",
            "workflow_type": "dependency_analysis",
            "definition": {
                "steps": [{"name": "analyze", "type": "analysis", "configuration": {}}]
            },
        }

        response = await client.post(
            "/api/v1/workflows/", json=workflow_data, headers=test_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == workflow_data["name"]
        assert "id" in data

    @pytest.mark.asyncio
    async def test_execute_workflow(self, client: AsyncClient, test_headers):
        """Test workflow execution."""
        # First create a workflow
        workflow_data = {
            "name": "Test Workflow",
            "workflow_type": "dependency_analysis",
            "definition": {"steps": []},
        }

        create_response = await client.post(
            "/api/v1/workflows/", json=workflow_data, headers=test_headers
        )
        workflow_id = create_response.json()["id"]

        # Execute the workflow
        execution_data = {"input_data": {"dependency_id": "test-id"}, "priority": 1}

        response = await client.post(
            f"/api/v1/workflows/{workflow_id}/execute",
            json=execution_data,
            headers=test_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert "status" in data
