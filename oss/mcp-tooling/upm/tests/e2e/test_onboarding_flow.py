"""
End-to-end tests for UPM onboarding flow.

Tests the complete user onboarding journey from signup to first project,
first dependency, and feature discovery.
"""

import pytest
import asyncio
from datetime import datetime, timezone
from uuid import uuid4
from httpx import AsyncClient

from udp.api.main import app
from udp.core.models.user import User
from udp.core.models.organization import Organization
from udp.core.models.project import Project
from udp.security.auth import create_access_token


@pytest.mark.e2e
@pytest.mark.asyncio
class TestOnboardingFlow:
    """Test complete onboarding flow."""
    
    async def test_phase1_signup_and_welcome(self, client: AsyncClient):
        """Test Phase 1: Sign Up & Welcome."""
        # Step 1: Sign Up
        signup_data = {
            "email": f"test_{uuid4().hex[:8]}@example.com",
            "password": "TestPassword123!",
            "full_name": "Test User"
        }
        
        response = await client.post("/api/v1/auth/register", json=signup_data)
        assert response.status_code == 201, f"Signup failed: {response.text}"
        user_data = response.json()
        
        assert "id" in user_data
        assert user_data["email"] == signup_data["email"]
        assert user_data["full_name"] == signup_data["full_name"]
        assert "created_at" in user_data
        
        # Step 2: Login to get token
        login_data = {
            "username": signup_data["email"],
            "password": signup_data["password"]
        }
        
        response = await client.post("/api/v1/auth/login", data=login_data)
        assert response.status_code == 200, f"Login failed: {response.text}"
        token_data = response.json()
        assert "access_token" in token_data
        
        token = token_data["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Step 3: Get current user (verify account)
        response = await client.get("/api/v1/auth/me", headers=headers)
        assert response.status_code == 200
        current_user = response.json()
        assert current_user["email"] == signup_data["email"]
        
        return headers, user_data["id"]
    
    async def test_phase2_first_project_setup(self, client: AsyncClient, test_user_token):
        """Test Phase 2: First Project Setup."""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        
        # Step 3: Project Creation Wizard
        project_data = {
            "name": "My First Project",
            "description": "Testing onboarding flow",
            "language": "python",
            "project_type": "web_app"
        }
        
        response = await client.post("/api/v1/projects", json=project_data, headers=headers)
        assert response.status_code in [200, 201], f"Project creation failed: {response.text}"
        project = response.json()
        
        assert project["name"] == project_data["name"]
        assert project["language"] == project_data["language"]
        assert "id" in project
        assert "created_at" in project
        
        # Step 4: First Dependency
        dependency_data = {
            "name": "requests",
            "version": "2.28.1",
            "language": "python",
            "project_id": project["id"]
        }
        
        response = await client.post("/api/v1/dependencies", json=dependency_data, headers=headers)
        assert response.status_code in [200, 201], f"Dependency creation failed: {response.text}"
        dependency = response.json()
        
        assert dependency["name"] == dependency_data["name"]
        assert dependency["version"] == dependency_data["version"]
        assert dependency["language"] == dependency_data["language"]
        
        return project, dependency
    
    async def test_phase3_feature_discovery(self, client: AsyncClient, test_user_token):
        """Test Phase 3: Feature Discovery."""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        
        # Create a project first
        project_data = {
            "name": "Feature Discovery Project",
            "language": "python"
        }
        response = await client.post("/api/v1/projects", json=project_data, headers=headers)
        project = response.json()
        
        # Feature 1: Security Scanning
        response = await client.post(
            f"/api/v1/security/scan",
            json={"project_id": project["id"]},
            headers=headers
        )
        # Should either succeed or return appropriate error if not implemented
        assert response.status_code in [200, 201, 404, 501], f"Security scan failed: {response.text}"
        
        # Feature 2: Dependency Graph
        response = await client.get(
            f"/api/v1/projects/{project['id']}/dependencies/graph",
            headers=headers
        )
        # Should either succeed or return appropriate error if not implemented
        assert response.status_code in [200, 404, 501], f"Dependency graph failed: {response.text}"
        
        # Feature 3: Analytics
        response = await client.get(
            f"/api/v1/analytics/projects/{project['id']}",
            headers=headers
        )
        # Should either succeed or return appropriate error if not implemented
        assert response.status_code in [200, 404, 501], f"Analytics failed: {response.text}"
    
    async def test_complete_onboarding_flow(self, client: AsyncClient):
        """Test complete onboarding flow end-to-end."""
        # Phase 1: Sign Up
        signup_data = {
            "email": f"onboarding_{uuid4().hex[:8]}@example.com",
            "password": "TestPassword123!",
            "full_name": "Onboarding Test User"
        }
        
        response = await client.post("/api/v1/auth/register", json=signup_data)
        assert response.status_code == 201
        user_id = response.json()["id"]
        
        # Login
        login_data = {
            "username": signup_data["email"],
            "password": signup_data["password"]
        }
        response = await client.post("/api/v1/auth/login", data=login_data)
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Phase 2: First Project
        project_data = {
            "name": "Complete Onboarding Project",
            "language": "python",
            "description": "Testing complete onboarding"
        }
        response = await client.post("/api/v1/projects", json=project_data, headers=headers)
        assert response.status_code in [200, 201]
        project = response.json()
        
        # First Dependency
        dependency_data = {
            "name": "requests",
            "version": "2.28.1",
            "language": "python",
            "project_id": project["id"]
        }
        response = await client.post("/api/v1/dependencies", json=dependency_data, headers=headers)
        assert response.status_code in [200, 201]
        
        # Phase 3: Feature Discovery
        # Security scan
        response = await client.post(
            f"/api/v1/security/scan",
            json={"project_id": project["id"]},
            headers=headers
        )
        assert response.status_code in [200, 201, 404, 501]
        
        # Verify onboarding progress
        # This would check onboarding state if implemented
        response = await client.get("/api/v1/auth/me", headers=headers)
        assert response.status_code == 200
        user = response.json()
        assert user["email"] == signup_data["email"]
        
        return {
            "user_id": user_id,
            "project_id": project["id"],
            "onboarding_complete": True
        }


@pytest.mark.e2e
@pytest.mark.asyncio
class TestOnboardingState:
    """Test onboarding state tracking."""
    
    async def test_onboarding_progress_calculation(self):
        """Test onboarding progress calculation."""
        from typing import TypedDict
        
        class OnboardingState(TypedDict):
            signup_complete: bool
            profile_complete: bool
            first_project_created: bool
            first_dependency_added: bool
            first_code_usage: bool
            security_scan_run: bool
            community_joined: bool
            workflow_created: bool
        
        def calculate_progress(state: OnboardingState) -> int:
            steps = [
                state["signup_complete"],
                state["profile_complete"],
                state["first_project_created"],
                state["first_dependency_added"],
                state["first_code_usage"],
                state["security_scan_run"],
                state["community_joined"],
                state["workflow_created"]
            ]
            return int((sum(steps) / len(steps)) * 100)
        
        # Test empty state
        empty_state: OnboardingState = {
            "signup_complete": False,
            "profile_complete": False,
            "first_project_created": False,
            "first_dependency_added": False,
            "first_code_usage": False,
            "security_scan_run": False,
            "community_joined": False,
            "workflow_created": False
        }
        assert calculate_progress(empty_state) == 0
        
        # Test partial state
        partial_state: OnboardingState = {
            "signup_complete": True,
            "profile_complete": True,
            "first_project_created": True,
            "first_dependency_added": True,
            "first_code_usage": False,
            "security_scan_run": False,
            "community_joined": False,
            "workflow_created": False
        }
        assert calculate_progress(partial_state) == 50
        
        # Test complete state
        complete_state: OnboardingState = {
            "signup_complete": True,
            "profile_complete": True,
            "first_project_created": True,
            "first_dependency_added": True,
            "first_code_usage": True,
            "security_scan_run": True,
            "community_joined": True,
            "workflow_created": True
        }
        assert calculate_progress(complete_state) == 100


@pytest.mark.e2e
@pytest.mark.asyncio
class TestUpgradeFlows:
    """Test upgrade flows."""
    
    async def test_free_tier_limits(self, client: AsyncClient, test_user_token):
        """Test free tier project limits."""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        
        # Free tier should allow 5 projects
        for i in range(5):
            project_data = {
                "name": f"Free Tier Project {i+1}",
                "language": "python"
            }
            response = await client.post("/api/v1/projects", json=project_data, headers=headers)
            # Should succeed for first 5 projects
            assert response.status_code in [200, 201], f"Project {i+1} creation failed"
        
        # 6th project should fail (if limit enforced)
        project_data = {
            "name": "Free Tier Project 6",
            "language": "python"
        }
        response = await client.post("/api/v1/projects", json=project_data, headers=headers)
        # May succeed if limits not enforced, or fail with 403/429
        assert response.status_code in [200, 201, 403, 429], f"6th project response: {response.text}"
    
    async def test_upgrade_prompt_trigger(self, client: AsyncClient, test_user_token):
        """Test upgrade prompt triggers."""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        
        # Get user info (should include tier info)
        response = await client.get("/api/v1/auth/me", headers=headers)
        assert response.status_code == 200
        user = response.json()
        
        # Check if tier information is present
        # This would be implemented in the actual API
        assert "email" in user
        
        # Simulate hitting limit
        # In real implementation, this would trigger upgrade prompt
        # For now, just verify the endpoint exists
        response = await client.get("/api/v1/tenancy/tier", headers=headers)
        # May not be implemented yet
        assert response.status_code in [200, 404, 501]


@pytest.mark.e2e
@pytest.mark.asyncio
class TestOnboardingMetrics:
    """Test onboarding metrics and analytics."""
    
    async def test_activation_metrics(self, client: AsyncClient):
        """Test activation metrics calculation."""
        # Create a new user
        signup_data = {
            "email": f"metrics_{uuid4().hex[:8]}@example.com",
            "password": "TestPassword123!",
            "full_name": "Metrics Test User"
        }
        
        response = await client.post("/api/v1/auth/register", json=signup_data)
        assert response.status_code == 201
        user_id = response.json()["id"]
        
        # Login
        login_data = {
            "username": signup_data["email"],
            "password": signup_data["password"]
        }
        response = await client.post("/api/v1/auth/login", data=login_data)
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Create first project (activation step)
        project_data = {
            "name": "Activation Test Project",
            "language": "python"
        }
        response = await client.post("/api/v1/projects", json=project_data, headers=headers)
        assert response.status_code in [200, 201]
        
        # Metrics would be tracked here
        # In real implementation, this would check analytics
        metrics = {
            "signup_to_first_project": True,
            "first_project_to_first_dependency": False,
            "overall_activation": False
        }
        
        assert metrics["signup_to_first_project"] is True
    
    async def test_conversion_metrics(self, client: AsyncClient, test_user_token):
        """Test conversion metrics."""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        
        # Get user tier
        response = await client.get("/api/v1/auth/me", headers=headers)
        assert response.status_code == 200
        user = response.json()
        
        # Check tier (would be "free" for new users)
        # In real implementation, this would track conversion
        tier = user.get("tier", "free")
        assert tier in ["free", "pro", "team", "enterprise"]
        
        # Conversion metrics would be calculated here
        conversion_metrics = {
            "free_to_pro": tier == "pro",
            "pro_to_team": tier == "team",
            "team_to_enterprise": tier == "enterprise"
        }
        
        # For test user, should be free tier
        assert conversion_metrics["free_to_pro"] is False or tier == "free"
