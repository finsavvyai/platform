"""
Functional tests for API endpoints.

Tests for all API endpoints including authentication, CRUD operations,
and business logic validation.
"""

import pytest
import asyncio
from datetime import datetime
from unittest.mock import Mock, patch, AsyncMock

from fastapi.testclient import TestClient
from httpx import AsyncClient

from udp.api.main import create_app
from udp.core.models import User, Organization, Project, Dependency


class TestAuthentication:
    """Test authentication endpoints."""
    
    @pytest.fixture
    def client(self):
        """Create test client."""
        app = create_app()
        return TestClient(app)
    
    def test_register_user(self, client):
        """Test user registration."""
        user_data = {
            "username": "testuser",
            "email": "test@example.com",
            "password": "testpassword123",
            "full_name": "Test User"
        }
        
        response = client.post("/api/v1/auth/register", json=user_data)
        
        assert response.status_code == 201
        data = response.json()
        assert data["username"] == "testuser"
        assert data["email"] == "test@example.com"
        assert data["full_name"] == "Test User"
        assert "id" in data
        assert "created_at" in data
    
    def test_login_user(self, client):
        """Test user login."""
        # First register a user
        user_data = {
            "username": "testuser",
            "email": "test@example.com",
            "password": "testpassword123",
            "full_name": "Test User"
        }
        client.post("/api/v1/auth/register", json=user_data)
        
        # Then login
        login_data = {
            "username": "testuser",
            "password": "testpassword123"
        }
        
        response = client.post("/api/v1/auth/login", json=login_data)
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "token_type" in data
        assert data["token_type"] == "bearer"
    
    def test_login_invalid_credentials(self, client):
        """Test login with invalid credentials."""
        login_data = {
            "username": "nonexistent",
            "password": "wrongpassword"
        }
        
        response = client.post("/api/v1/auth/login", json=login_data)
        
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
    
    def test_get_current_user(self, client):
        """Test getting current user."""
        # Register and login
        user_data = {
            "username": "testuser",
            "email": "test@example.com",
            "password": "testpassword123",
            "full_name": "Test User"
        }
        client.post("/api/v1/auth/register", json=user_data)
        
        login_data = {
            "username": "testuser",
            "password": "testpassword123"
        }
        login_response = client.post("/api/v1/auth/login", json=login_data)
        token = login_response.json()["access_token"]
        
        # Get current user
        headers = {"Authorization": f"Bearer {token}"}
        response = client.get("/api/v1/auth/me", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "testuser"
        assert data["email"] == "test@example.com"


class TestOrganizationManagement:
    """Test organization management endpoints."""
    
    @pytest.fixture
    def authenticated_client(self, client):
        """Create authenticated client."""
        # Register and login
        user_data = {
            "username": "testuser",
            "email": "test@example.com",
            "password": "testpassword123",
            "full_name": "Test User"
        }
        client.post("/api/v1/auth/register", json=user_data)
        
        login_data = {
            "username": "testuser",
            "password": "testpassword123"
        }
        login_response = client.post("/api/v1/auth/login", json=login_data)
        token = login_response.json()["access_token"]
        
        headers = {"Authorization": f"Bearer {token}"}
        return client, headers
    
    def test_create_organization(self, authenticated_client):
        """Test creating organization."""
        client, headers = authenticated_client
        
        org_data = {
            "name": "Test Organization",
            "slug": "test-org",
            "plan": "enterprise"
        }
        
        response = client.post("/api/v1/organizations", json=org_data, headers=headers)
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Test Organization"
        assert data["slug"] == "test-org"
        assert data["plan"] == "enterprise"
        assert "id" in data
        assert "created_at" in data
    
    def test_get_organizations(self, authenticated_client):
        """Test getting organizations."""
        client, headers = authenticated_client
        
        # Create an organization first
        org_data = {
            "name": "Test Organization",
            "slug": "test-org",
            "plan": "enterprise"
        }
        client.post("/api/v1/organizations", json=org_data, headers=headers)
        
        response = client.get("/api/v1/organizations", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert data[0]["name"] == "Test Organization"
    
    def test_get_organization(self, authenticated_client):
        """Test getting specific organization."""
        client, headers = authenticated_client
        
        # Create an organization first
        org_data = {
            "name": "Test Organization",
            "slug": "test-org",
            "plan": "enterprise"
        }
        create_response = client.post("/api/v1/organizations", json=org_data, headers=headers)
        org_id = create_response.json()["id"]
        
        response = client.get(f"/api/v1/organizations/{org_id}", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == org_id
        assert data["name"] == "Test Organization"
    
    def test_update_organization(self, authenticated_client):
        """Test updating organization."""
        client, headers = authenticated_client
        
        # Create an organization first
        org_data = {
            "name": "Test Organization",
            "slug": "test-org",
            "plan": "enterprise"
        }
        create_response = client.post("/api/v1/organizations", json=org_data, headers=headers)
        org_id = create_response.json()["id"]
        
        # Update organization
        update_data = {
            "name": "Updated Organization",
            "plan": "premium"
        }
        
        response = client.put(f"/api/v1/organizations/{org_id}", json=update_data, headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Organization"
        assert data["plan"] == "premium"
    
    def test_delete_organization(self, authenticated_client):
        """Test deleting organization."""
        client, headers = authenticated_client
        
        # Create an organization first
        org_data = {
            "name": "Test Organization",
            "slug": "test-org",
            "plan": "enterprise"
        }
        create_response = client.post("/api/v1/organizations", json=org_data, headers=headers)
        org_id = create_response.json()["id"]
        
        response = client.delete(f"/api/v1/organizations/{org_id}", headers=headers)
        
        assert response.status_code == 204
        
        # Verify organization is deleted
        get_response = client.get(f"/api/v1/organizations/{org_id}", headers=headers)
        assert get_response.status_code == 404


class TestProjectManagement:
    """Test project management endpoints."""
    
    @pytest.fixture
    def authenticated_client_with_org(self, authenticated_client):
        """Create authenticated client with organization."""
        client, headers = authenticated_client
        
        # Create an organization
        org_data = {
            "name": "Test Organization",
            "slug": "test-org",
            "plan": "enterprise"
        }
        org_response = client.post("/api/v1/organizations", json=org_data, headers=headers)
        org_id = org_response.json()["id"]
        
        return client, headers, org_id
    
    def test_create_project(self, authenticated_client_with_org):
        """Test creating project."""
        client, headers, org_id = authenticated_client_with_org
        
        project_data = {
            "name": "Test Project",
            "description": "A test project",
            "ecosystem": "pypi",
            "package_manager": "pip"
        }
        
        response = client.post(f"/api/v1/organizations/{org_id}/projects", json=project_data, headers=headers)
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Test Project"
        assert data["description"] == "A test project"
        assert data["ecosystem"] == "pypi"
        assert data["package_manager"] == "pip"
        assert data["organization_id"] == org_id
    
    def test_get_projects(self, authenticated_client_with_org):
        """Test getting projects."""
        client, headers, org_id = authenticated_client_with_org
        
        # Create a project first
        project_data = {
            "name": "Test Project",
            "description": "A test project",
            "ecosystem": "pypi",
            "package_manager": "pip"
        }
        client.post(f"/api/v1/organizations/{org_id}/projects", json=project_data, headers=headers)
        
        response = client.get(f"/api/v1/organizations/{org_id}/projects", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert data[0]["name"] == "Test Project"
    
    def test_get_project(self, authenticated_client_with_org):
        """Test getting specific project."""
        client, headers, org_id = authenticated_client_with_org
        
        # Create a project first
        project_data = {
            "name": "Test Project",
            "description": "A test project",
            "ecosystem": "pypi",
            "package_manager": "pip"
        }
        create_response = client.post(f"/api/v1/organizations/{org_id}/projects", json=project_data, headers=headers)
        project_id = create_response.json()["id"]
        
        response = client.get(f"/api/v1/projects/{project_id}", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == project_id
        assert data["name"] == "Test Project"
    
    def test_update_project(self, authenticated_client_with_org):
        """Test updating project."""
        client, headers, org_id = authenticated_client_with_org
        
        # Create a project first
        project_data = {
            "name": "Test Project",
            "description": "A test project",
            "ecosystem": "pypi",
            "package_manager": "pip"
        }
        create_response = client.post(f"/api/v1/organizations/{org_id}/projects", json=project_data, headers=headers)
        project_id = create_response.json()["id"]
        
        # Update project
        update_data = {
            "name": "Updated Project",
            "description": "An updated test project"
        }
        
        response = client.put(f"/api/v1/projects/{project_id}", json=update_data, headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Project"
        assert data["description"] == "An updated test project"
    
    def test_delete_project(self, authenticated_client_with_org):
        """Test deleting project."""
        client, headers, org_id = authenticated_client_with_org
        
        # Create a project first
        project_data = {
            "name": "Test Project",
            "description": "A test project",
            "ecosystem": "pypi",
            "package_manager": "pip"
        }
        create_response = client.post(f"/api/v1/organizations/{org_id}/projects", json=project_data, headers=headers)
        project_id = create_response.json()["id"]
        
        response = client.delete(f"/api/v1/projects/{project_id}", headers=headers)
        
        assert response.status_code == 204
        
        # Verify project is deleted
        get_response = client.get(f"/api/v1/projects/{project_id}", headers=headers)
        assert get_response.status_code == 404


class TestDependencyManagement:
    """Test dependency management endpoints."""
    
    @pytest.fixture
    def authenticated_client_with_project(self, authenticated_client_with_org):
        """Create authenticated client with project."""
        client, headers, org_id = authenticated_client_with_org
        
        # Create a project
        project_data = {
            "name": "Test Project",
            "description": "A test project",
            "ecosystem": "pypi",
            "package_manager": "pip"
        }
        project_response = client.post(f"/api/v1/organizations/{org_id}/projects", json=project_data, headers=headers)
        project_id = project_response.json()["id"]
        
        return client, headers, org_id, project_id
    
    def test_scan_dependencies(self, authenticated_client_with_project):
        """Test scanning dependencies."""
        client, headers, org_id, project_id = authenticated_client_with_project
        
        scan_data = {
            "package_manager": "pip",
            "requirements_file": "requirements.txt"
        }
        
        response = client.post(f"/api/v1/projects/{project_id}/dependencies/scan", json=scan_data, headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "scan_id" in data
        assert "status" in data
        assert "dependencies_found" in data
    
    def test_get_dependencies(self, authenticated_client_with_project):
        """Test getting dependencies."""
        client, headers, org_id, project_id = authenticated_client_with_project
        
        # Scan dependencies first
        scan_data = {
            "package_manager": "pip",
            "requirements_file": "requirements.txt"
        }
        client.post(f"/api/v1/projects/{project_id}/dependencies/scan", json=scan_data, headers=headers)
        
        response = client.get(f"/api/v1/projects/{project_id}/dependencies", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "dependencies" in data
        assert "total_count" in data
        assert "vulnerable_count" in data
        assert "outdated_count" in data
    
    def test_get_dependency(self, authenticated_client_with_project):
        """Test getting specific dependency."""
        client, headers, org_id, project_id = authenticated_client_with_project
        
        # Scan dependencies first
        scan_data = {
            "package_manager": "pip",
            "requirements_file": "requirements.txt"
        }
        client.post(f"/api/v1/projects/{project_id}/dependencies/scan", json=scan_data, headers=headers)
        
        # Get dependencies to find a dependency ID
        deps_response = client.get(f"/api/v1/projects/{project_id}/dependencies", headers=headers)
        dependencies = deps_response.json()["dependencies"]
        
        if dependencies:
            dep_id = dependencies[0]["id"]
            
            response = client.get(f"/api/v1/dependencies/{dep_id}", headers=headers)
            
            assert response.status_code == 200
            data = response.json()
            assert data["id"] == dep_id
            assert "name" in data
            assert "version" in data
            assert "ecosystem" in data
    
    def test_update_dependency(self, authenticated_client_with_project):
        """Test updating dependency."""
        client, headers, org_id, project_id = authenticated_client_with_project
        
        # Scan dependencies first
        scan_data = {
            "package_manager": "pip",
            "requirements_file": "requirements.txt"
        }
        client.post(f"/api/v1/projects/{project_id}/dependencies/scan", json=scan_data, headers=headers)
        
        # Get dependencies to find a dependency ID
        deps_response = client.get(f"/api/v1/projects/{project_id}/dependencies", headers=headers)
        dependencies = deps_response.json()["dependencies"]
        
        if dependencies:
            dep_id = dependencies[0]["id"]
            
            # Update dependency
            update_data = {
                "is_direct": True,
                "license": "MIT"
            }
            
            response = client.put(f"/api/v1/dependencies/{dep_id}", json=update_data, headers=headers)
            
            assert response.status_code == 200
            data = response.json()
            assert data["is_direct"] is True
            assert data["license"] == "MIT"


class TestVulnerabilityScanning:
    """Test vulnerability scanning endpoints."""
    
    @pytest.fixture
    def authenticated_client_with_project(self, authenticated_client_with_project):
        """Use the same fixture as dependency management."""
        return authenticated_client_with_project
    
    def test_scan_vulnerabilities(self, authenticated_client_with_project):
        """Test scanning vulnerabilities."""
        client, headers, org_id, project_id = authenticated_client_with_project
        
        # Scan dependencies first
        scan_data = {
            "package_manager": "pip",
            "requirements_file": "requirements.txt"
        }
        client.post(f"/api/v1/projects/{project_id}/dependencies/scan", json=scan_data, headers=headers)
        
        # Scan vulnerabilities
        response = client.post(f"/api/v1/projects/{project_id}/vulnerabilities/scan", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "scan_id" in data
        assert "status" in data
        assert "vulnerabilities_found" in data
    
    def test_get_vulnerabilities(self, authenticated_client_with_project):
        """Test getting vulnerabilities."""
        client, headers, org_id, project_id = authenticated_client_with_project
        
        # Scan dependencies and vulnerabilities first
        scan_data = {
            "package_manager": "pip",
            "requirements_file": "requirements.txt"
        }
        client.post(f"/api/v1/projects/{project_id}/dependencies/scan", json=scan_data, headers=headers)
        client.post(f"/api/v1/projects/{project_id}/vulnerabilities/scan", headers=headers)
        
        response = client.get(f"/api/v1/projects/{project_id}/vulnerabilities", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "vulnerabilities" in data
        assert "total_count" in data
        assert "critical_count" in data
        assert "high_count" in data
        assert "medium_count" in data
        assert "low_count" in data
    
    def test_get_vulnerability(self, authenticated_client_with_project):
        """Test getting specific vulnerability."""
        client, headers, org_id, project_id = authenticated_client_with_project
        
        # Scan dependencies and vulnerabilities first
        scan_data = {
            "package_manager": "pip",
            "requirements_file": "requirements.txt"
        }
        client.post(f"/api/v1/projects/{project_id}/dependencies/scan", json=scan_data, headers=headers)
        client.post(f"/api/v1/projects/{project_id}/vulnerabilities/scan", headers=headers)
        
        # Get vulnerabilities to find a vulnerability ID
        vulns_response = client.get(f"/api/v1/projects/{project_id}/vulnerabilities", headers=headers)
        vulnerabilities = vulns_response.json()["vulnerabilities"]
        
        if vulnerabilities:
            vuln_id = vulnerabilities[0]["id"]
            
            response = client.get(f"/api/v1/vulnerabilities/{vuln_id}", headers=headers)
            
            assert response.status_code == 200
            data = response.json()
            assert data["id"] == vuln_id
            assert "title" in data
            assert "severity" in data
            assert "cvss_score" in data


class TestMLModels:
    """Test ML models endpoints."""
    
    @pytest.fixture
    def authenticated_client(self, authenticated_client):
        """Use the same fixture as organization management."""
        return authenticated_client
    
    def test_get_ml_models(self, authenticated_client):
        """Test getting ML models."""
        client, headers = authenticated_client
        
        response = client.get("/api/v1/ml/models", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "models" in data
        assert len(data["models"]) == 5
        assert "risk_prediction" in [model["name"] for model in data["models"]]
        assert "trend_analysis" in [model["name"] for model in data["models"]]
        assert "vulnerability_classifier" in [model["name"] for model in data["models"]]
        assert "dependency_recommender" in [model["name"] for model in data["models"]]
        assert "anomaly_detector" in [model["name"] for model in data["models"]]
    
    def test_get_model_info(self, authenticated_client):
        """Test getting model info."""
        client, headers = authenticated_client
        
        response = client.get("/api/v1/ml/models/risk_prediction", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["model_name"] == "risk_prediction"
        assert "version" in data
        assert "is_trained" in data
        assert "training_data_size" in data
        assert "last_trained" in data
        assert "metrics" in data
    
    def test_predict_risk(self, authenticated_client):
        """Test risk prediction."""
        client, headers = authenticated_client
        
        prediction_data = {
            "package_name": "requests",
            "version": "2.28.1",
            "ecosystem": "pypi",
            "features": {
                "download_count": 1000000,
                "star_count": 50000,
                "maintainer_count": 5,
                "dependency_count": 4,
                "dependent_count": 100000,
                "license": "Apache-2.0",
                "age_days": 365,
                "update_frequency": 30,
                "issue_count": 100,
                "pr_count": 50
            }
        }
        
        response = client.post("/api/v1/ml/predict/risk", json=prediction_data, headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "prediction" in data
        assert "confidence" in data
        assert "probabilities" in data
        assert "model_version" in data
        assert data["prediction"] in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
        assert 0 <= data["confidence"] <= 1
    
    def test_predict_trend(self, authenticated_client):
        """Test trend prediction."""
        client, headers = authenticated_client
        
        prediction_data = {
            "package_name": "requests",
            "ecosystem": "pypi",
            "time_series_data": [
                {"date": "2023-01-01", "downloads": 1000, "stars": 100, "issues": 10, "releases": 1},
                {"date": "2023-02-01", "downloads": 1100, "stars": 110, "issues": 12, "releases": 1},
                {"date": "2023-03-01", "downloads": 1200, "stars": 120, "issues": 15, "releases": 2}
            ]
        }
        
        response = client.post("/api/v1/ml/predict/trend", json=prediction_data, headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "prediction" in data
        assert "confidence" in data
        assert "probabilities" in data
        assert "model_version" in data
        assert data["prediction"] in ["RISING", "FALLING", "STABLE", "VOLATILE"]
        assert 0 <= data["confidence"] <= 1
    
    def test_classify_vulnerability(self, authenticated_client):
        """Test vulnerability classification."""
        client, headers = authenticated_client
        
        classification_data = {
            "vulnerability_data": {
                "title": "Test Vulnerability",
                "description": "A test vulnerability for testing purposes",
                "severity": "HIGH",
                "cvss_score": 7.5,
                "cvss_vector": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N",
                "cwe_id": "CWE-79",
                "references": ["https://example.com/cve-2023-12345"],
                "affected_packages": [{"name": "requests", "versions": ["<2.28.2"]}]
            }
        }
        
        response = client.post("/api/v1/ml/classify/vulnerability", json=classification_data, headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "prediction" in data
        assert "confidence" in data
        assert "probabilities" in data
        assert "model_version" in data
        assert data["prediction"] in ["CVE", "CWE", "CUSTOM", "UNKNOWN"]
        assert 0 <= data["confidence"] <= 1
    
    def test_recommend_dependencies(self, authenticated_client):
        """Test dependency recommendations."""
        client, headers = authenticated_client
        
        recommendation_data = {
            "package_name": "requests",
            "version": "2.28.1",
            "ecosystem": "pypi",
            "context": {
                "project_type": "web_application",
                "performance_requirements": "high",
                "security_requirements": "high",
                "maintenance_requirements": "low"
            }
        }
        
        response = client.post("/api/v1/ml/recommend/dependencies", json=recommendation_data, headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "recommendations" in data
        assert "model_version" in data
        assert isinstance(data["recommendations"], list)
        
        if data["recommendations"]:
            recommendation = data["recommendations"][0]
            assert "package_name" in recommendation
            assert "recommendation_type" in recommendation
            assert "confidence" in recommendation
            assert "reason" in recommendation
    
    def test_detect_anomalies(self, authenticated_client):
        """Test anomaly detection."""
        client, headers = authenticated_client
        
        anomaly_data = {
            "package_name": "requests",
            "ecosystem": "pypi",
            "metrics": {
                "download_count": 1000000,
                "star_count": 50000,
                "issue_count": 100,
                "pr_count": 50,
                "release_frequency": 30,
                "maintainer_activity": 0.8,
                "dependency_count": 4,
                "dependent_count": 100000
            }
        }
        
        response = client.post("/api/v1/ml/detect/anomalies", json=anomaly_data, headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "anomalies" in data
        assert "model_version" in data
        assert isinstance(data["anomalies"], list)
        
        if data["anomalies"]:
            anomaly = data["anomalies"][0]
            assert "anomaly_type" in anomaly
            assert "severity" in anomaly
            assert "confidence" in anomaly
            assert "description" in anomaly


class TestMonitoring:
    """Test monitoring endpoints."""
    
    @pytest.fixture
    def authenticated_client(self, authenticated_client):
        """Use the same fixture as organization management."""
        return authenticated_client
    
    def test_get_system_health(self, authenticated_client):
        """Test getting system health."""
        client, headers = authenticated_client
        
        response = client.get("/api/v1/monitoring/health", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "overall_health" in data
        assert "timestamp" in data
        assert "services" in data
        assert data["overall_health"] in ["healthy", "degraded", "unhealthy"]
        
        services = data["services"]
        assert "system" in services
        assert "dependency" in services
        assert "security" in services
        assert "performance" in services
    
    def test_get_metrics(self, authenticated_client):
        """Test getting metrics."""
        client, headers = authenticated_client
        
        response = client.get("/api/v1/monitoring/metrics", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        if data:
            metric = data[0]
            assert "name" in metric
            assert "value" in metric
            assert "timestamp" in metric
            assert "tags" in metric
    
    def test_get_prometheus_metrics(self, authenticated_client):
        """Test getting Prometheus metrics."""
        client, headers = authenticated_client
        
        response = client.get("/api/v1/monitoring/metrics/prometheus", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert isinstance(data["data"], str)
        assert "# TYPE" in data["data"] or "# Timestamp" in data["data"]
    
    def test_get_active_alerts(self, authenticated_client):
        """Test getting active alerts."""
        client, headers = authenticated_client
        
        response = client.get("/api/v1/monitoring/alerts", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        if data:
            alert = data[0]
            assert "id" in alert
            assert "title" in alert
            assert "severity" in alert
            assert "status" in alert
            assert "timestamp" in alert
    
    def test_create_alert_rule(self, authenticated_client):
        """Test creating alert rule."""
        client, headers = authenticated_client
        
        rule_data = {
            "name": "High CPU Usage",
            "description": "Alert when CPU usage exceeds 90%",
            "metric_name": "system.cpu.percent",
            "condition": ">",
            "threshold": 90.0,
            "severity": "high",
            "cooldown_period": 300,
            "evaluation_interval": 60
        }
        
        response = client.post("/api/v1/monitoring/alerts/rules", json=rule_data, headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["name"] == "High CPU Usage"
        assert data["status"] == "created"
    
    def test_create_alert_channel(self, authenticated_client):
        """Test creating alert channel."""
        client, headers = authenticated_client
        
        channel_data = {
            "name": "Email Alerts",
            "type": "email",
            "config": {
                "to_email": "admin@example.com",
                "from_email": "alerts@udp.com"
            },
            "severity_filter": ["critical", "high"],
            "tags_filter": {"environment": "production"}
        }
        
        response = client.post("/api/v1/monitoring/alerts/channels", json=channel_data, headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["name"] == "Email Alerts"
        assert data["type"] == "email"
        assert data["status"] == "created"
    
    def test_get_dashboards(self, authenticated_client):
        """Test getting dashboards."""
        client, headers = authenticated_client
        
        response = client.get("/api/v1/monitoring/dashboards", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 3  # Should have default dashboards
        
        dashboard_names = [d["name"] for d in data]
        assert "System Overview" in dashboard_names
        assert "Dependencies" in dashboard_names
        assert "Alerts" in dashboard_names
    
    def test_get_dashboard(self, authenticated_client):
        """Test getting specific dashboard."""
        client, headers = authenticated_client
        
        # Get dashboards first
        dashboards_response = client.get("/api/v1/monitoring/dashboards", headers=headers)
        dashboards = dashboards_response.json()
        
        if dashboards:
            dashboard_id = dashboards[0]["id"]
            
            response = client.get(f"/api/v1/monitoring/dashboards/{dashboard_id}", headers=headers)
            
            assert response.status_code == 200
            data = response.json()
            assert data["id"] == dashboard_id
            assert "name" in data
            assert "widgets" in data
            assert "layout" in data
    
    def test_create_dashboard(self, authenticated_client):
        """Test creating dashboard."""
        client, headers = authenticated_client
        
        dashboard_data = {
            "name": "Custom Dashboard",
            "description": "A custom monitoring dashboard",
            "auto_refresh": True,
            "refresh_interval": 30
        }
        
        response = client.post("/api/v1/monitoring/dashboards", json=dashboard_data, headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["name"] == "Custom Dashboard"
        assert data["status"] == "created"
    
    def test_get_monitoring_summary(self, authenticated_client):
        """Test getting monitoring summary."""
        client, headers = authenticated_client
        
        response = client.get("/api/v1/monitoring/summary", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "system_health" in data
        assert "active_alerts" in data
        assert "total_metrics" in data
        assert "dashboard_count" in data
        assert "services_monitored" in data
        assert "uptime" in data
        assert data["system_health"] in ["healthy", "degraded", "unhealthy"]
        assert isinstance(data["active_alerts"], int)
        assert isinstance(data["total_metrics"], int)
        assert isinstance(data["dashboard_count"], int)
        assert isinstance(data["services_monitored"], int)
        assert isinstance(data["uptime"], (int, float))


class TestErrorHandling:
    """Test error handling and edge cases."""
    
    @pytest.fixture
    def client(self):
        """Create test client."""
        app = create_app()
        return TestClient(app)
    
    def test_unauthorized_access(self, client):
        """Test unauthorized access to protected endpoints."""
        response = client.get("/api/v1/organizations")
        
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
    
    def test_invalid_token(self, client):
        """Test access with invalid token."""
        headers = {"Authorization": "Bearer invalid-token"}
        response = client.get("/api/v1/organizations", headers=headers)
        
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
    
    def test_nonexistent_resource(self, client):
        """Test accessing nonexistent resource."""
        # Register and login
        user_data = {
            "username": "testuser",
            "email": "test@example.com",
            "password": "testpassword123",
            "full_name": "Test User"
        }
        client.post("/api/v1/auth/register", json=user_data)
        
        login_data = {
            "username": "testuser",
            "password": "testpassword123"
        }
        login_response = client.post("/api/v1/auth/login", json=login_data)
        token = login_response.json()["access_token"]
        
        headers = {"Authorization": f"Bearer {token}"}
        response = client.get("/api/v1/organizations/nonexistent", headers=headers)
        
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data
    
    def test_invalid_request_data(self, client):
        """Test request with invalid data."""
        # Register and login
        user_data = {
            "username": "testuser",
            "email": "test@example.com",
            "password": "testpassword123",
            "full_name": "Test User"
        }
        client.post("/api/v1/auth/register", json=user_data)
        
        login_data = {
            "username": "testuser",
            "password": "testpassword123"
        }
        login_response = client.post("/api/v1/auth/login", json=login_data)
        token = login_response.json()["access_token"]
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Try to create organization with invalid data
        invalid_org_data = {
            "name": "",  # Empty name
            "slug": "invalid slug!",  # Invalid slug
            "plan": "invalid-plan"  # Invalid plan
        }
        
        response = client.post("/api/v1/organizations", json=invalid_org_data, headers=headers)
        
        assert response.status_code == 422
        data = response.json()
        assert "detail" in data
    
    def test_rate_limiting(self, client):
        """Test rate limiting (if implemented)."""
        # This test would depend on rate limiting implementation
        # For now, just test that the endpoint responds normally
        response = client.get("/api/v1/health")
        assert response.status_code in [200, 404]  # 404 if health endpoint doesn't exist
    
    def test_large_request_handling(self, client):
        """Test handling of large requests."""
        # Register and login
        user_data = {
            "username": "testuser",
            "email": "test@example.com",
            "password": "testpassword123",
            "full_name": "Test User"
        }
        client.post("/api/v1/auth/register", json=user_data)
        
        login_data = {
            "username": "testuser",
            "password": "testpassword123"
        }
        login_response = client.post("/api/v1/auth/login", json=login_data)
        token = login_response.json()["access_token"]
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Create organization
        org_data = {
            "name": "Test Organization",
            "slug": "test-org",
            "plan": "enterprise"
        }
        org_response = client.post("/api/v1/organizations", json=org_data, headers=headers)
        org_id = org_response.json()["id"]
        
        # Create project
        project_data = {
            "name": "Test Project",
            "description": "A test project",
            "ecosystem": "pypi",
            "package_manager": "pip"
        }
        project_response = client.post(f"/api/v1/organizations/{org_id}/projects", json=project_data, headers=headers)
        project_id = project_response.json()["id"]
        
        # Try to scan with large requirements file
        large_requirements = "requests==2.28.1\n" * 1000  # Large requirements file
        
        scan_data = {
            "package_manager": "pip",
            "requirements_file": large_requirements
        }
        
        response = client.post(f"/api/v1/projects/{project_id}/dependencies/scan", json=scan_data, headers=headers)
        
        # Should handle large requests gracefully
        assert response.status_code in [200, 413, 422]  # 413 for payload too large, 422 for validation error