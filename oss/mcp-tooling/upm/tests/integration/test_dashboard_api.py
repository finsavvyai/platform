"""Integration tests for dashboard API endpoints."""

import pytest
from datetime import datetime
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.udp.core.models import User, Organization
from src.udp.core.security import create_access_token
from src.udp.main import app


@pytest.mark.asyncio
async def test_get_security_dashboard_success(
    async_client: AsyncClient, db_session: AsyncSession
):
    """Test successful security dashboard retrieval."""

    # Create test user and organization
    user = User(email="test@example.com", name="Test User", is_active=True)
    db_session.add(user)
    await db_session.commit()

    # Create access token
    token = create_access_token(subject=user.email)

    # Make API request
    response = await async_client.get(
        "/api/v1/dashboards/security",
        headers={"Authorization": f"Bearer {token}"},
        params={"time_range": "last_30_days", "severity_levels": "critical,high"},
    )

    # Assertions
    assert response.status_code == 200
    data = response.json()

    # Verify response structure
    assert "vulnerability_trends" in data
    assert "compliance_overview" in data
    assert "risk_metrics" in data
    assert "security_kpis" in data
    assert "critical_vulnerabilities" in data
    assert "policy_violations_summary" in data
    assert "project_security_scores" in data
    assert "vulnerability_severity_distribution" in data
    assert "remediation_progress" in data
    assert "generated_at" in data
    assert "time_range" in data
    assert "filters" in data

    # Verify data types
    assert isinstance(data["vulnerability_trends"], list)
    assert isinstance(data["compliance_overview"], dict)
    assert isinstance(data["risk_metrics"], dict)
    assert isinstance(data["security_kpis"], dict)

    # Verify KPIs have expected fields
    kpis = data["security_kpis"]
    assert "security_score" in kpis
    assert "mean_time_to_remediate_hours" in kpis
    assert "vulnerability_detection_rate" in kpis
    assert "security_coverage_percentage" in kpis
    assert "false_positive_rate" in kpis
    assert "automated_remediation_rate" in kpis


@pytest.mark.asyncio
async def test_get_vulnerability_trends(
    async_client: AsyncClient, db_session: AsyncSession
):
    """Test vulnerability trends endpoint."""

    # Create test user
    user = User(email="test2@example.com", name="Test User 2", is_active=True)
    db_session.add(user)
    await db_session.commit()

    # Create access token
    token = create_access_token(subject=user.email)

    # Make API request
    response = await async_client.get(
        "/api/v1/dashboards/vulnerabilities/trends",
        headers={"Authorization": f"Bearer {token}"},
        params={"time_range": "last_7_days", "severity_levels": "critical,high,medium"},
    )

    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)

    # Verify trend data structure if not empty
    if data:
        trend = data[0]
        assert "date" in trend
        assert "critical" in trend
        assert "high" in trend
        assert "medium" in trend
        assert "low" in trend
        assert "total" in trend
        assert isinstance(trend["critical"], int)
        assert isinstance(trend["total"], int)


@pytest.mark.asyncio
async def test_get_risk_heatmap(async_client: AsyncClient, db_session: AsyncSession):
    """Test risk heatmap endpoint."""

    # Create test user
    user = User(email="test3@example.com", name="Test User 3", is_active=True)
    db_session.add(user)
    await db_session.commit()

    # Create access token
    token = create_access_token(subject=user.email)

    # Test project severity heatmap
    response = await async_client.get(
        "/api/v1/dashboards/risk/heatmap",
        headers={"Authorization": f"Bearer {token}"},
        params={"heatmap_type": "project_severity"},
    )

    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert "x_axis" in data
    assert "y_axis" in data
    assert "data" in data
    assert "metadata" in data

    # Verify metadata
    assert data["metadata"]["type"] == "project_severity_risk"
    assert "generated_at" in data["metadata"]

    # Test compliance risk heatmap
    response = await async_client.get(
        "/api/v1/dashboards/risk/heatmap",
        headers={"Authorization": f"Bearer {token}"},
        params={"heatmap_type": "compliance_risk"},
    )

    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert "x_axis" in data
    assert "y_axis" in data
    assert "data" in data
    assert data["metadata"]["type"] == "compliance_risk"

    # Test invalid heatmap type
    response = await async_client.get(
        "/api/v1/dashboards/risk/heatmap",
        headers={"Authorization": f"Bearer {token}"},
        params={"heatmap_type": "invalid_type"},
    )

    # Should return 400 for invalid type
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_get_security_alerts(async_client: AsyncClient, db_session: AsyncSession):
    """Test security alerts endpoint."""

    # Create test user
    user = User(email="test4@example.com", name="Test User 4", is_active=True)
    db_session.add(user)
    await db_session.commit()

    # Create access token
    token = create_access_token(subject=user.email)

    # Make API request
    response = await async_client.get(
        "/api/v1/dashboards/alerts",
        headers={"Authorization": f"Bearer {token}"},
        params={"severity": "critical", "limit": 10},
    )

    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)

    # Verify alert structure if not empty
    if data:
        alert = data[0]
        assert "id" in alert
        assert "alert_type" in alert
        assert "severity" in alert
        assert "title" in alert
        assert "message" in alert
        assert "created_at" in alert
        assert "action_required" in alert
        assert isinstance(alert["action_required"], bool)


@pytest.mark.asyncio
async def test_export_dashboard_json(
    async_client: AsyncClient, db_session: AsyncSession
):
    """Test dashboard export to JSON format."""

    # Create test user
    user = User(email="test5@example.com", name="Test User 5", is_active=True)
    db_session.add(user)
    await db_session.commit()

    # Create access token
    token = create_access_token(subject=user.email)

    # Make API request for JSON export
    export_data = {
        "format": "json",
        "time_range": "last_30_days",
        "include_charts": True,
        "include_raw_data": False,
    }

    response = await async_client.post(
        "/api/v1/dashboards/export",
        headers={"Authorization": f"Bearer {token}"},
        json=export_data,
    )

    # Assertions
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/json"
    assert "content-disposition" in response.headers

    # Verify exported data structure
    data = response.json()
    assert "vulnerability_trends" in data
    assert "compliance_overview" in data
    assert "risk_metrics" in data
    assert "security_kpis" in data


@pytest.mark.asyncio
async def test_export_dashboard_csv(
    async_client: AsyncClient, db_session: AsyncSession
):
    """Test dashboard export to CSV format."""

    # Create test user
    user = User(email="test6@example.com", name="Test User 6", is_active=True)
    db_session.add(user)
    await db_session.commit()

    # Create access token
    token = create_access_token(subject=user.email)

    # Make API request for CSV export
    export_data = {
        "format": "csv",
        "time_range": "last_30_days",
        "include_charts": False,
        "include_raw_data": True,
    }

    response = await async_client.post(
        "/api/v1/dashboards/export",
        headers={"Authorization": f"Bearer {token}"},
        json=export_data,
    )

    # Assertions
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/csv; charset=utf-8"
    assert "content-disposition" in response.headers

    # Verify CSV content
    csv_content = response.text
    assert "Security Dashboard Export" in csv_content
    assert "Security KPIs" in csv_content
    assert "Risk Metrics" in csv_content


@pytest.mark.asyncio
async def test_export_dashboard_pdf(
    async_client: AsyncClient, db_session: AsyncSession
):
    """Test dashboard export to PDF format (queued)."""

    # Create test user
    user = User(email="test7@example.com", name="Test User 7", is_active=True)
    db_session.add(user)
    await db_session.commit()

    # Create access token
    token = create_access_token(subject=user.email)

    # Make API request for PDF export
    export_data = {
        "format": "pdf",
        "time_range": "last_30_days",
        "include_charts": True,
        "include_raw_data": False,
    }

    response = await async_client.post(
        "/api/v1/dashboards/export",
        headers={"Authorization": f"Bearer {token}"},
        json=export_data,
    )

    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert "export_id" in data
    assert "status" in data
    assert data["status"] == "queued"
    assert "message" in data


@pytest.mark.asyncio
async def test_share_dashboard(async_client: AsyncClient, db_session: AsyncSession):
    """Test dashboard sharing functionality."""

    # Create test user
    user = User(email="test8@example.com", name="Test User 8", is_active=True)
    db_session.add(user)
    await db_session.commit()

    # Create access token
    token = create_access_token(subject=user.email)

    # Make API request to share dashboard
    share_data = {
        "dashboard_id": "default",
        "share_type": "internal",
        "recipients": ["user@example.com", "admin@example.com"],
        "permissions": ["view"],
    }

    response = await async_client.post(
        "/api/v1/dashboards/share",
        headers={"Authorization": f"Bearer {token}"},
        json=share_data,
    )

    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert "share_id" in data
    assert "share_url" in data
    assert "permissions" in data
    assert data["permissions"] == ["view"]


@pytest.mark.asyncio
async def test_get_dashboard_layouts(
    async_client: AsyncClient, db_session: AsyncSession
):
    """Test dashboard layouts retrieval."""

    # Create test user
    user = User(email="test9@example.com", name="Test User 9", is_active=True)
    db_session.add(user)
    await db_session.commit()

    # Create access token
    token = create_access_token(subject=user.email)

    # Make API request
    response = await async_client.get(
        "/api/v1/dashboards/layouts", headers={"Authorization": f"Bearer {token}"}
    )

    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)

    # Verify default layout exists
    assert len(data) > 0
    layout = data[0]
    assert "id" in layout
    assert "name" in layout
    assert "widgets" in layout
    assert isinstance(layout["widgets"], list)

    # Verify widget structure
    if layout["widgets"]:
        widget = layout["widgets"][0]
        assert "id" in widget
        assert "title" in widget
        assert "widget_type" in widget
        assert "position_x" in widget
        assert "position_y" in widget
        assert "width" in widget
        assert "height" in widget


@pytest.mark.asyncio
async def test_create_dashboard_layout(
    async_client: AsyncClient, db_session: AsyncSession
):
    """Test creating a new dashboard layout."""

    # Create test user
    user = User(email="test10@example.com", name="Test User 10", is_active=True)
    db_session.add(user)
    await db_session.commit()

    # Create access token
    token = create_access_token(subject=user.email)

    # Make API request to create layout
    layout_data = {
        "id": "custom-layout",
        "name": "Custom Security Dashboard",
        "description": "My custom dashboard layout",
        "widgets": [
            {
                "id": "widget-1",
                "title": "Security Score",
                "widget_type": "gauge",
                "position_x": 0,
                "position_y": 0,
                "width": 4,
                "height": 2,
                "config": {"metric": "security_score"},
            }
        ],
        "is_default": False,
    }

    response = await async_client.post(
        "/api/v1/dashboards/layouts",
        headers={"Authorization": f"Bearer {token}"},
        json=layout_data,
    )

    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "custom-layout"
    assert data["name"] == "Custom Security Dashboard"
    assert "created_at" in data
    assert "updated_at" in data


@pytest.mark.asyncio
async def test_get_realtime_metrics(
    async_client: AsyncClient, db_session: AsyncSession
):
    """Test real-time metrics endpoint."""

    # Create test user
    user = User(email="test11@example.com", name="Test User 11", is_active=True)
    db_session.add(user)
    await db_session.commit()

    # Create access token
    token = create_access_token(subject=user.email)

    # Make API request
    response = await async_client.get(
        "/api/v1/dashboards/metrics/realtime",
        headers={"Authorization": f"Bearer {token}"},
        params={"metrics": "vulnerability_count,risk_score"},
    )

    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert "timestamp" in data
    assert "metrics" in data

    metrics = data["metrics"]
    assert "vulnerability_count" in metrics
    assert "risk_score" in metrics

    # Verify metric structure
    vuln_metric = metrics["vulnerability_count"]
    assert "value" in vuln_metric
    assert "timestamp" in vuln_metric


@pytest.mark.asyncio
async def test_get_project_security_score(
    async_client: AsyncClient, db_session: AsyncSession
):
    """Test project security score endpoint."""

    # Create test user and project
    user = User(email="test12@example.com", name="Test User 12", is_active=True)
    org = Organization(name="Test Org", slug="test-org")
    db_session.add(user)
    db_session.add(org)
    await db_session.commit()

    # Create access token
    token = create_access_token(subject=user.email)

    # Make API request
    response = await async_client.get(
        "/api/v1/dashboards/projects/test-project-id/security-score",
        headers={"Authorization": f"Bearer {token}"},
    )

    # May return 404 if project doesn't exist
    if response.status_code == 404:
        assert response.json()["detail"] == "Project not found"
    else:
        assert response.status_code == 200
        data = response.json()
        assert "project_id" in data
        assert "project_name" in data
        assert "overall_score" in data
        assert "components" in data
        assert "recommendations" in data


@pytest.mark.asyncio
async def test_get_compliance_summary(
    async_client: AsyncClient, db_session: AsyncSession
):
    """Test compliance summary endpoint."""

    # Create test user
    user = User(email="test13@example.com", name="Test User 13", is_active=True)
    db_session.add(user)
    await db_session.commit()

    # Create access token
    token = create_access_token(subject=user.email)

    # Make API request
    response = await async_client.get(
        "/api/v1/dashboards/compliance/SOX/summary",
        headers={"Authorization": f"Bearer {token}"},
    )

    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert "framework" in data
    assert data["framework"] == "SOX"
    assert "total_projects" in data
    assert "average_compliance_score" in data
    assert "controls" in data
    assert "compliance_trend" in data


@pytest.mark.asyncio
async def test_acknowledge_alert(async_client: AsyncClient, db_session: AsyncSession):
    """Test alert acknowledgment endpoint."""

    # Create test user
    user = User(email="test14@example.com", name="Test User 14", is_active=True)
    db_session.add(user)
    await db_session.commit()

    # Create access token
    token = create_access_token(subject=user.email)

    # Make API request
    response = await async_client.post(
        "/api/v1/dashboards/alerts/alert-123/acknowledge",
        headers={"Authorization": f"Bearer {token}"},
    )

    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert "alert_id" in data
    assert data["alert_id"] == "alert-123"
    assert "status" in data
    assert data["status"] == "acknowledged"
    assert "message" in data


@pytest.mark.asyncio
async def test_get_weekly_security_summary(
    async_client: AsyncClient, db_session: AsyncSession
):
    """Test weekly security summary endpoint."""

    # Create test user
    user = User(email="test15@example.com", name="Test User 15", is_active=True)
    db_session.add(user)
    await db_session.commit()

    # Create access token
    token = create_access_token(subject=user.email)

    # Make API request
    response = await async_client.get(
        "/api/v1/dashboards/reports/weekly-summary",
        headers={"Authorization": f"Bearer {token}"},
        params={
            "week_offset": 0  # Current week
        },
    )

    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert "week_start" in data
    assert "week_end" in data
    assert "executive_summary" in data
    assert "vulnerability_summary" in data
    assert "compliance_summary" in data
    assert "risk_metrics" in data
    assert "top_risks" in data
    assert "recommendations" in data
    assert "generated_at" in data

    # Verify executive summary
    exec_summary = data["executive_summary"]
    assert "overall_security_posture" in exec_summary
    assert "critical_issues" in exec_summary
    assert "risk_trend" in exec_summary
    assert "key_highlights" in exec_summary


@pytest.mark.asyncio
async def test_unauthorized_access(async_client: AsyncClient):
    """Test that unauthorized access is blocked."""

    # Test without token
    response = await async_client.get("/api/v1/dashboards/security")
    assert response.status_code == 401

    # Test with invalid token
    response = await async_client.get(
        "/api/v1/dashboards/security", headers={"Authorization": "Bearer invalid-token"}
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_invalid_parameters(async_client: AsyncClient, db_session: AsyncSession):
    """Test API with invalid parameters."""

    # Create test user
    user = User(email="test16@example.com", name="Test User 16", is_active=True)
    db_session.add(user)
    await db_session.commit()

    # Create access token
    token = create_access_token(subject=user.email)

    # Test invalid time range
    response = await async_client.get(
        "/api/v1/dashboards/security",
        headers={"Authorization": f"Bearer {token}"},
        params={"time_range": "invalid_range"},
    )
    # Should still work with default or return validation error

    # Test invalid export format
    export_data = {"format": "invalid_format", "time_range": "last_30_days"}
    response = await async_client.post(
        "/api/v1/dashboards/export",
        headers={"Authorization": f"Bearer {token}"},
        json=export_data,
    )
    assert response.status_code == 400

    # Test invalid risk score range
    response = await async_client.get(
        "/api/v1/dashboards/security",
        headers={"Authorization": f"Bearer {token}"},
        params={"min_risk_score": 15.0},  # Above max of 10
    )
    # Should return validation error


@pytest.mark.asyncio
async def test_rate_limiting(async_client: AsyncClient, db_session: AsyncSession):
    """Test rate limiting on dashboard endpoints."""

    # Create test user
    user = User(email="test17@example.com", name="Test User 17", is_active=True)
    db_session.add(user)
    await db_session.commit()

    # Create access token
    token = create_access_token(subject=user.email)

    # Make multiple rapid requests
    responses = []
    for _ in range(100):
        response = await async_client.get(
            "/api/v1/dashboards/security", headers={"Authorization": f"Bearer {token}"}
        )
        responses.append(response)
        if response.status_code == 429:
            break

    # Check if rate limiting was triggered
    if len(responses) < 100:
        assert responses[-1].status_code == 429
        assert "rate limit" in responses[-1].json()["detail"].lower()
