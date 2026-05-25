"""
Integration tests for remediation API endpoints.

Tests the full API flow from request to response,
including authentication, validation, and error handling.
"""

import pytest
import json
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch
from uuid import uuid4

from fastapi.testclient import TestClient
from httpx import AsyncClient

from src.udp.api.main import app
from src.udp.core.models.user import UserModel
from src.udp.core.models.project import ProjectModel
from src.udp.services.remediation_service import (
    RemediationSuggestion,
    RemediationType,
    RemediationPriority,
    BreakingChangeRisk,
    VersionBumpSuggestion,
)
from src.udp.domain.models.remediation import (
    RemediationSuggestionModel,
    RemediationPlanModel,
)


@pytest.fixture
def test_client():
    """Create a test client for the API."""
    return TestClient(app)


@pytest.fixture
def mock_current_user():
    """Create a mock authenticated user."""
    return UserModel(
        id=uuid4(),
        email="test@example.com",
        username="testuser",
        is_active=True,
        is_verified=True,
    )


@pytest.fixture
def mock_project():
    """Create a mock project."""
    return ProjectModel(
        id=uuid4(),
        name="test-project",
        slug="test-project",
        organization_id=uuid4(),
        primary_language="java",
        ecosystem="maven",
    )


class TestRemediationAPIEndpoints:
    """Integration tests for remediation API endpoints."""

    @pytest.mark.asyncio
    async def test_get_remediation_suggestions_success(
        self, mock_current_user, mock_project
    ):
        """Test successful retrieval of remediation suggestions."""
        # Create mock suggestions
        mock_suggestions = [
            RemediationSuggestion(
                id=str(uuid4()),
                vulnerability_id="CVE-2022-12345",
                dependency_id=str(uuid4()),
                project_id=str(mock_project.id),
                remediation_type=RemediationType.VERSION_BUMP,
                priority=RemediationPriority.HIGH,
                title="Upgrade package",
                description="Upgrade to fix vulnerability",
                version_bump=VersionBumpSuggestion(
                    current_version="1.0.0",
                    suggested_version="2.0.0",
                    breaking_change_risk=BreakingChangeRisk.LOW,
                    confidence_score=0.9,
                ),
                automated_fix_available=True,
                confidence_score=0.9,
            ),
            RemediationSuggestion(
                id=str(uuid4()),
                vulnerability_id="CVE-2022-12346",
                dependency_id=str(uuid4()),
                project_id=str(mock_project.id),
                remediation_type=RemediationType.ALTERNATIVE_PACKAGE,
                priority=RemediationPriority.MEDIUM,
                title="Use alternative package",
                description="Consider using alternative package",
                confidence_score=0.7,
            ),
        ]

        # Mock the service
        with patch(
            "src.udp.services.remediation_service.AutomatedRemediationService"
        ) as mock_service_class:
            mock_service = AsyncMock()
            mock_service.generate_remediation_suggestions = AsyncMock(
                return_value=mock_suggestions
            )
            mock_service_class.return_value = mock_service

            # Mock authentication
            with patch(
                "src.udp.api.deps.get_current_user",
                return_value=mock_current_user,
            ):
                async with AsyncClient(app=app, base_url="http://test") as client:
                    response = await client.get(
                        f"/api/v1/projects/{mock_project.id}/remediation/suggestions"
                    )

        # Assertions
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert len(data["items"]) == 2
        assert data["total"] == 2

        # Check first suggestion
        suggestion = data["items"][0]
        assert suggestion["remediation_type"] == "version_bump"
        assert suggestion["priority"] == "high"
        assert suggestion["version_bump"] is not None
        assert suggestion["automated_fix_available"] is True

    @pytest.mark.asyncio
    async def test_get_remediation_suggestions_with_filters(
        self, mock_current_user, mock_project
    ):
        """Test retrieval with filters applied."""
        mock_suggestions = [
            RemediationSuggestion(
                id=str(uuid4()),
                vulnerability_id="CVE-2022-12345",
                dependency_id=str(uuid4()),
                project_id=str(mock_project.id),
                remediation_type=RemediationType.VERSION_BUMP,
                priority=RemediationPriority.HIGH,
                title="Upgrade package",
                automated_fix_available=True,
                confidence_score=0.9,
            ),
        ]

        with patch(
            "src.udp.services.remediation_service.AutomatedRemediationService"
        ) as mock_service_class:
            mock_service = AsyncMock()
            mock_service.generate_remediation_suggestions = AsyncMock(
                return_value=mock_suggestions
            )
            mock_service_class.return_value = mock_service

            with patch(
                "src.udp.api.deps.get_current_user",
                return_value=mock_current_user,
            ):
                async with AsyncClient(app=app, base_url="http://test") as client:
                    response = await client.get(
                        f"/api/v1/projects/{mock_project.id}/remediation/suggestions?"
                        f"remediation_type=version_bump&"
                        f"priority=high&"
                        f"automated_only=true"
                    )

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 1

    @pytest.mark.asyncio
    async def test_generate_remediation_suggestions_success(
        self, mock_current_user, mock_project
    ):
        """Test successful generation of remediation suggestions."""
        mock_suggestions = [
            RemediationSuggestion(
                id=str(uuid4()),
                vulnerability_id="CVE-2022-12345",
                dependency_id=str(uuid4()),
                project_id=str(mock_project.id),
                remediation_type=RemediationType.VERSION_BUMP,
                priority=RemediationPriority.CRITICAL,
                title="Upgrade critical package",
                automated_fix_available=True,
                confidence_score=0.95,
            ),
        ]

        with patch(
            "src.udp.services.remediation_service.AutomatedRemediationService"
        ) as mock_service_class:
            mock_service = AsyncMock()
            mock_service.generate_remediation_suggestions = AsyncMock(
                return_value=mock_suggestions
            )
            mock_service_class.return_value = mock_service

            with patch(
                "src.udp.api.deps.get_current_user",
                return_value=mock_current_user,
            ):
                async with AsyncClient(app=app, base_url="http://test") as client:
                    response = await client.post(
                        f"/api/v1/projects/{mock_project.id}/remediation/suggestions/generate",
                        params={
                            "include_alternatives": True,
                            "include_patches": True,
                            "max_suggestions_per_vuln": 5,
                        },
                    )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["priority"] == "critical"

    @pytest.mark.asyncio
    async def test_get_specific_remediation_suggestion(
        self, mock_current_user, mock_project
    ):
        """Test retrieving a specific remediation suggestion."""
        suggestion_id = str(uuid4())
        mock_suggestion = RemediationSuggestion(
            id=suggestion_id,
            vulnerability_id="CVE-2022-12345",
            dependency_id=str(uuid4()),
            project_id=str(mock_project.id),
            remediation_type=RemediationType.VERSION_BUMP,
            priority=RemediationPriority.HIGH,
            title="Upgrade package",
            description="Detailed description",
            version_bump=VersionBumpSuggestion(
                current_version="1.0.0",
                suggested_version="2.0.0",
                changelog_summary="Security fixes and improvements",
                breaking_change_risk=BreakingChangeRisk.LOW,
            ),
            automated_fix_available=True,
            automated_fix_script="echo 'Applying fix'",
            confidence_score=0.9,
        )

        with patch(
            "src.udp.services.remediation_service.AutomatedRemediationService"
        ) as mock_service_class:
            mock_service = AsyncMock()
            mock_service.generate_remediation_suggestions = AsyncMock(
                return_value=[mock_suggestion]
            )
            mock_service_class.return_value = mock_service

            with patch(
                "src.udp.api.deps.get_current_user",
                return_value=mock_current_user,
            ):
                async with AsyncClient(app=app, base_url="http://test") as client:
                    response = await client.get(
                        f"/api/v1/projects/{mock_project.id}/remediation/suggestions/{suggestion_id}"
                    )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == suggestion_id
        assert data["version_bump"]["current_version"] == "1.0.0"
        assert data["version_bump"]["suggested_version"] == "2.0.0"
        assert data["automated_fix_script"] == "echo 'Applying fix'"

    @pytest.mark.asyncio
    async def test_get_specific_suggestion_not_found(
        self, mock_current_user, mock_project
    ):
        """Test retrieving a non-existent suggestion."""
        with patch(
            "src.udp.services.remediation_service.AutomatedRemediationService"
        ) as mock_service_class:
            mock_service = AsyncMock()
            mock_service.generate_remediation_suggestions = AsyncMock(return_value=[])
            mock_service_class.return_value = mock_service

            with patch(
                "src.udp.api.deps.get_current_user",
                return_value=mock_current_user,
            ):
                async with AsyncClient(app=app, base_url="http://test") as client:
                    response = await client.get(
                        f"/api/v1/projects/{mock_project.id}/remediation/suggestions/{uuid4()}"
                    )

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_apply_remediation_suggestion_success(
        self, mock_current_user, mock_project
    ):
        """Test successful application of remediation suggestion."""
        suggestion_id = str(uuid4())

        mock_result = {
            "success": True,
            "suggestion_id": suggestion_id,
            "project_id": str(mock_project.id),
            "fix_applied_at": datetime.utcnow(),
            "backup_info": {"backup_path": "/backup/test"},
            "apply_result": {
                "success": True,
                "changes_made": ["Updated dependency version"],
                "artifacts": ["backup.tar.gz"],
            },
            "verification_result": {
                "verified": True,
                "issues": [],
            },
        }

        with patch(
            "src.udp.services.remediation_service.AutomatedRemediationService"
        ) as mock_service_class:
            mock_service = AsyncMock()
            mock_service.apply_automated_fix = AsyncMock(return_value=mock_result)
            mock_service.generate_remediation_suggestions = AsyncMock(
                return_value=[
                    RemediationSuggestion(
                        id=suggestion_id,
                        automated_fix_available=True,
                    )
                ]
            )
            mock_service_class.return_value = mock_service

            with patch(
                "src.udp.api.deps.get_current_user",
                return_value=mock_current_user,
            ):
                async with AsyncClient(app=app, base_url="http://test") as client:
                    response = await client.post(
                        f"/api/v1/projects/{mock_project.id}/remediation/suggestions/{suggestion_id}/apply",
                        params={
                            "validate_before_apply": True,
                            "create_backup": True,
                        },
                    )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["suggestion_id"] == suggestion_id
        assert data["backup_created"] is True
        assert "changes_made" in data

    @pytest.mark.asyncio
    async def test_apply_remediation_suggestion_no_automated_fix(
        self, mock_current_user, mock_project
    ):
        """Test applying suggestion without automated fix."""
        suggestion_id = str(uuid4())

        with patch(
            "src.udp.services.remediation_service.AutomatedRemediationService"
        ) as mock_service_class:
            mock_service = AsyncMock()
            mock_service.generate_remediation_suggestions = AsyncMock(
                return_value=[
                    RemediationSuggestion(
                        id=suggestion_id,
                        automated_fix_available=False,
                    )
                ]
            )
            mock_service_class.return_value = mock_service

            with patch(
                "src.udp.api.deps.get_current_user",
                return_value=mock_current_user,
            ):
                async with AsyncClient(app=app, base_url="http://test") as client:
                    response = await client.post(
                        f"/api/v1/projects/{mock_project.id}/remediation/suggestions/{suggestion_id}/apply"
                    )

        assert response.status_code == 400
        assert "no automated fix available" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_create_remediation_plan_success(
        self, mock_current_user, mock_project
    ):
        """Test successful creation of remediation plan."""
        plan_data = {
            "name": "Security Remediation Plan",
            "description": "Plan to fix all critical vulnerabilities",
            "suggestion_ids": [str(uuid4()), str(uuid4())],
            "dependencies": [],
        }

        with patch(
            "src.udp.services.remediation_service.AutomatedRemediationService"
        ) as mock_service_class:
            mock_service = AsyncMock()
            mock_service.generate_remediation_suggestions = AsyncMock(
                return_value=[
                    RemediationSuggestion(
                        id=str(uuid4()),
                        priority=RemediationPriority.CRITICAL,
                        estimated_effort="30 minutes",
                    ),
                    RemediationSuggestion(
                        id=str(uuid4()),
                        priority=RemediationPriority.HIGH,
                        estimated_effort="1 hour",
                    ),
                ]
            )
            mock_service_class.return_value = mock_service

            with patch(
                "src.udp.api.deps.get_current_user",
                return_value=mock_current_user,
            ):
                async with AsyncClient(app=app, base_url="http://test") as client:
                    response = await client.post(
                        f"/api/v1/projects/{mock_project.id}/remediation/plans",
                        json=plan_data,
                    )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Security Remediation Plan"
        assert data["project_id"] == str(mock_project.id)
        assert len(data["suggestions"]) == 2
        assert data["total_effort_estimate"] == "1.5 hours"

    @pytest.mark.asyncio
    async def test_create_remediation_plan_no_suggestions(
        self, mock_current_user, mock_project
    ):
        """Test creating plan with no valid suggestions."""
        plan_data = {
            "name": "Empty Plan",
            "description": "Plan with no suggestions",
            "suggestion_ids": [str(uuid4())],
        }

        with patch(
            "src.udp.services.remediation_service.AutomatedRemediationService"
        ) as mock_service_class:
            mock_service = AsyncMock()
            mock_service.generate_remediation_suggestions = AsyncMock(return_value=[])
            mock_service_class.return_value = mock_service

            with patch(
                "src.udp.api.deps.get_current_user",
                return_value=mock_current_user,
            ):
                async with AsyncClient(app=app, base_url="http://test") as client:
                    response = await client.post(
                        f"/api/v1/projects/{mock_project.id}/remediation/plans",
                        json=plan_data,
                    )

        assert response.status_code == 400
        assert "no valid suggestions" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_get_remediation_analytics(self, mock_current_user, mock_project):
        """Test retrieving remediation analytics."""
        with patch(
            "src.udp.api.deps.get_current_user",
            return_value=mock_current_user,
        ):
            async with AsyncClient(app=app, base_url="http://test") as client:
                response = await client.get(
                    f"/api/v1/projects/{mock_project.id}/remediation/analytics",
                    params={"time_period": "30d"},
                )

        assert response.status_code == 200
        data = response.json()
        assert data["project_id"] == str(mock_project.id)
        assert data["time_period"] == "30d"
        assert "total_suggestions_generated" in data
        assert "success_rate" in data
        assert "vulnerabilities_fixed" in data

    @pytest.mark.asyncio
    async def test_accept_vulnerability_risk_success(
        self, mock_current_user, mock_project
    ):
        """Test accepting vulnerability risk."""
        suggestion_id = str(uuid4())
        acceptance_data = {
            "justification": "Risk accepted for business reasons",
            "expires_at": "2024-12-31T23:59:59Z",
            "requires_approval": False,
        }

        with patch(
            "src.udp.api.deps.get_current_user",
            return_value=mock_current_user,
        ):
            async with AsyncClient(app=app, base_url="http://test") as client:
                response = await client.post(
                    f"/api/v1/projects/{mock_project.id}/remediation/suggestions/{suggestion_id}/accept",
                    json=acceptance_data,
                )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "accepted"
        assert data["justification"] == acceptance_data["justification"]
        assert data["accepted_by"] == str(mock_current_user.id)

    @pytest.mark.asyncio
    async def test_accept_vulnerability_risk_no_justification(
        self, mock_current_user, mock_project
    ):
        """Test accepting risk without justification."""
        suggestion_id = str(uuid4())
        acceptance_data = {}  # No justification provided

        with patch(
            "src.udp.api.deps.get_current_user",
            return_value=mock_current_user,
        ):
            async with AsyncClient(app=app, base_url="http://test") as client:
                response = await client.post(
                    f"/api/v1/projects/{mock_project.id}/remediation/suggestions/{suggestion_id}/accept",
                    json=acceptance_data,
                )

        assert response.status_code == 400
        assert "justification is required" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_dismiss_remediation_suggestion_success(
        self, mock_current_user, mock_project
    ):
        """Test dismissing a remediation suggestion."""
        suggestion_id = str(uuid4())
        dismissal_data = {
            "reason": "False positive - vulnerability not applicable",
            "category": "false_positive",
        }

        with patch(
            "src.udp.api.deps.get_current_user",
            return_value=mock_current_user,
        ):
            async with AsyncClient(app=app, base_url="http://test") as client:
                response = await client.post(
                    f"/api/v1/projects/{mock_project.id}/remediation/suggestions/{suggestion_id}/dismiss",
                    json=dismissal_data,
                )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "dismissed"
        assert data["reason"] == dismissal_data["reason"]
        assert data["dismissed_by"] == str(mock_current_user.id)

    @pytest.mark.asyncio
    async def test_dismiss_remediation_suggestion_no_reason(
        self, mock_current_user, mock_project
    ):
        """Test dismissing suggestion without reason."""
        suggestion_id = str(uuid4())
        dismissal_data = {}  # No reason provided

        with patch(
            "src.udp.api.deps.get_current_user",
            return_value=mock_current_user,
        ):
            async with AsyncClient(app=app, base_url="http://test") as client:
                response = await client.post(
                    f"/api/v1/projects/{mock_project.id}/remediation/suggestions/{suggestion_id}/dismiss",
                    json=dismissal_data,
                )

        assert response.status_code == 400
        assert "reason is required" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_get_remediation_suggestions_unauthenticated(
        self,
        mock_project,
    ):
        """Test accessing suggestions without authentication."""
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get(
                f"/api/v1/projects/{mock_project.id}/remediation/suggestions"
            )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_remediation_suggestions_invalid_project_id(
        self,
        mock_current_user,
    ):
        """Test accessing suggestions with invalid project ID."""
        with patch(
            "src.udp.api.deps.get_current_user",
            return_value=mock_current_user,
        ):
            async with AsyncClient(app=app, base_url="http://test") as client:
                response = await client.get(
                    "/api/v1/projects/invalid-id/remediation/suggestions"
                )

        # Should return validation error for invalid UUID
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_generate_suggestions_invalid_params(
        self, mock_current_user, mock_project
    ):
        """Test generating suggestions with invalid parameters."""
        with patch(
            "src.udp.api.deps.get_current_user",
            return_value=mock_current_user,
        ):
            async with AsyncClient(app=app, base_url="http://test") as client:
                response = await client.post(
                    f"/api/v1/projects/{mock_project.id}/remediation/suggestions/generate",
                    params={"max_suggestions_per_vuln": 20},  # Exceeds max of 10
                )

        assert response.status_code == 422
        assert (
            "ensure this value is less than or equal to 10"
            in response.json()["detail"][0]["msg"]
        )

    @pytest.mark.asyncio
    async def test_pagination_parameters(self, mock_current_user, mock_project):
        """Test pagination parameters."""
        with patch(
            "src.udp.services.remediation_service.AutomatedRemediationService"
        ) as mock_service_class:
            mock_service = AsyncMock()
            # Generate many suggestions for pagination test
            mock_service.generate_remediation_suggestions = AsyncMock(
                return_value=[
                    RemediationSuggestion(
                        id=str(uuid4()),
                        vulnerability_id=f"CVE-2022-{i:05d}",
                        dependency_id=str(uuid4()),
                        project_id=str(mock_project.id),
                        remediation_type=RemediationType.VERSION_BUMP,
                        priority=RemediationPriority.HIGH,
                        title=f"Suggestion {i}",
                    )
                    for i in range(50)
                ]
            )
            mock_service_class.return_value = mock_service

            with patch(
                "src.udp.api.deps.get_current_user",
                return_value=mock_current_user,
            ):
                async with AsyncClient(app=app, base_url="http://test") as client:
                    response = await client.get(
                        f"/api/v1/projects/{mock_project.id}/remediation/suggestions",
                        params={"page": 2, "size": 10},
                    )

        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 2
        assert data["size"] == 10
        assert len(data["items"]) == 10
        assert data["total"] == 50
        assert data["pages"] == 5
