"""
Integration tests for AI Security Service API endpoints
"""

import pytest
import json
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.udp.api.main import app
from src.udp.services.ai_security import (
    VulnerabilityPriority,
    PrioritizationMethod,
    RiskTrend,
)


client = TestClient(app)


@pytest.fixture
def mock_current_user():
    """Create mock current user."""
    user = MagicMock()
    user.id = "user-123"
    user.email = "test@example.com"
    user.permissions = ["project:read", "project:write", "security:read"]
    return user


@pytest.fixture
def mock_prioritized_vulnerabilities():
    """Create mock prioritized vulnerabilities."""
    return [
        VulnerabilityPriority(
            vulnerability_id="CVE-2024-0001",
            project_id="project-123",
            priority_score=95.0,
            risk_tier="critical",
            urgency=timedelta(days=1),
            cvss_score=95.0,
            contextual_score=90.0,
            threat_intelligence_score=95.0,
            ai_prediction_score=95.0,
            exploitability=0.95,
            business_impact=0.9,
            exposure_level=0.85,
            compliance_impact=0.8,
            time_to_exploitation=timedelta(days=3),
            risk_trend=RiskTrend.INCREASING,
            trend_confidence=0.9,
            prioritization_method=PrioritizationMethod.HYBRID,
            confidence=0.95,
            recommended_actions=[
                "Immediate remediation required - patch within 24 hours",
                "Consider temporary system shutdown",
            ],
        ),
        VulnerabilityPriority(
            vulnerability_id="CVE-2024-0002",
            project_id="project-123",
            priority_score=75.0,
            risk_tier="high",
            urgency=timedelta(days=7),
            cvss_score=80.0,
            contextual_score=70.0,
            threat_intelligence_score=75.0,
            ai_prediction_score=75.0,
            exploitability=0.7,
            business_impact=0.6,
            exposure_level=0.5,
            compliance_impact=0.4,
            time_to_exploitation=timedelta(days=14),
            risk_trend=RiskTrend.STABLE,
            trend_confidence=0.7,
            prioritization_method=PrioritizationMethod.HYBRID,
            confidence=0.8,
            recommended_actions=[
                "Patch within 7 days",
                "Implement compensating controls",
            ],
        ),
    ]


class TestSecurityAPI:
    """Test security API endpoints."""

    @patch("src.udp.api.v1.security.get_current_user")
    @patch("src.udp.api.v1.security.require_permission")
    @patch("src.udp.api.v1.security.prioritizer")
    def test_prioritize_vulnerabilities(
        self,
        mock_prioritizer,
        mock_require_permission,
        mock_get_current_user,
        mock_current_user,
        mock_prioritized_vulnerabilities,
    ):
        """Test vulnerability prioritization endpoint."""
        mock_get_current_user.return_value = mock_current_user
        mock_require_permission.return_value = None
        mock_prioritizer.prioritize_vulnerabilities = AsyncMock(
            return_value=mock_prioritized_vulnerabilities
        )

        response = client.get(
            "/api/v1/security/projects/project-123/vulnerabilities/prioritize"
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

        # Check first vulnerability
        vuln1 = data[0]
        assert vuln1["vulnerability_id"] == "CVE-2024-0001"
        assert vuln1["project_id"] == "project-123"
        assert vuln1["priority_score"] == 95.0
        assert vuln1["risk_tier"] == "critical"
        assert vuln1["urgency_days"] == 1
        assert vuln1["component_scores"]["cvss_score"] == 95.0
        assert vuln1["component_scores"]["threat_intelligence_score"] == 95.0
        assert vuln1["risk_factors"]["exploitability"] == 0.95
        assert vuln1["temporal_factors"]["risk_trend"] == "increasing"
        assert vuln1["metadata"]["confidence"] == 0.95
        assert (
            "Immediate remediation required"
            in vuln1["metadata"]["recommended_actions"][0]
        )

    @patch("src.udp.api.v1.security.get_current_user")
    @patch("src.udp.api.v1.security.require_permission")
    @patch("src.udp.api.v1.security.prioritizer")
    def test_prioritize_vulnerabilities_with_filters(
        self,
        mock_prioritizer,
        mock_require_permission,
        mock_get_current_user,
        mock_current_user,
        mock_prioritized_vulnerabilities,
    ):
        """Test vulnerability prioritization with filters."""
        mock_get_current_user.return_value = mock_current_user
        mock_require_permission.return_value = None
        mock_prioritizer.prioritize_vulnerabilities = AsyncMock(
            return_value=[mock_prioritized_vulnerabilities[0]]
        )

        response = client.get(
            "/api/v1/security/projects/project-123/vulnerabilities/prioritize?"
            "vulnerability_ids=CVE-2024-0001,CVE-2024-0002&"
            "method=ai_predictive&"
            "include_predictions=true&"
            "limit=10"
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1

        # Verify the prioritizer was called with correct parameters
        mock_prioritizer.prioritize_vulnerabilities.assert_called_once_with(
            project_id="project-123",
            vulnerability_ids=["CVE-2024-0001", "CVE-2024-0002"],
            method=PrioritizationMethod.AI_PREDICTIVE,
            include_predictions=True,
        )

    @patch("src.udp.api.v1.security.get_current_user")
    @patch("src.udp.api.v1.security.require_permission")
    @patch("src.udp.api.v1.security.prioritizer")
    def test_get_vulnerability_risk_analysis(
        self,
        mock_prioritizer,
        mock_require_permission,
        mock_get_current_user,
        mock_current_user,
        mock_prioritized_vulnerabilities,
    ):
        """Test get vulnerability risk analysis endpoint."""
        mock_get_current_user.return_value = mock_current_user
        mock_require_permission.return_value = None
        mock_prioritizer.prioritize_vulnerabilities = AsyncMock(
            return_value=[mock_prioritized_vulnerabilities[0]]
        )

        response = client.get(
            "/api/v1/security/projects/project-123/vulnerabilities/CVE-2024-0001/risk-analysis"
        )

        assert response.status_code == 200
        data = response.json()

        # Check vulnerability section
        assert "vulnerability" in data
        vuln = data["vulnerability"]
        assert vuln["vulnerability_id"] == "CVE-2024-0001"
        assert vuln["risk_tier"] == "critical"
        assert vuln["urgency"]["days"] == 1
        assert vuln["urgency"]["human_readable"] == "1 days"

        # Check scores section
        assert "scores" in data
        scores = data["scores"]
        assert scores["overall"] == 95.0
        assert scores["cvss"] == 95.0
        assert scores["threat_intelligence"] == 95.0

        # Check risk factors section
        assert "risk_factors" in data
        risk_factors = data["risk_factors"]
        assert risk_factors["exploitability"]["score"] == 0.95
        assert risk_factors["exploitability"]["level"] == "high"

        # Check timeline section
        assert "timeline" in data
        timeline = data["timeline"]
        assert timeline["time_to_exploitation"]["days"] == 3
        assert timeline["trend"]["direction"] == "increasing"
        assert timeline["trend"]["confidence"] == 0.9

        # Check recommendations section
        assert "recommendations" in data
        recommendations = data["recommendations"]
        assert len(recommendations["immediate_actions"]) > 0
        assert (
            "Immediate remediation required" in recommendations["immediate_actions"][0]
        )

        # Check metadata section
        assert "metadata" in data
        metadata = data["metadata"]
        assert metadata["prioritization_method"] == PrioritizationMethod.HYBRID
        assert metadata["confidence_level"] == "high"

    @patch("src.udp.api.v1.security.get_current_user")
    @patch("src.udp.api.v1.security.require_permission")
    @patch("src.udp.api.v1.security.prioritizer")
    def test_get_vulnerability_risk_analysis_with_predictions(
        self,
        mock_prioritizer,
        mock_require_permission,
        mock_get_current_user,
        mock_current_user,
        mock_prioritized_vulnerabilities,
    ):
        """Test get vulnerability risk analysis with predictions."""
        mock_get_current_user.return_value = mock_current_user
        mock_require_permission.return_value = None
        mock_prioritizer.prioritize_vulnerabilities = AsyncMock(
            return_value=[mock_prioritized_vulnerabilities[0]]
        )

        response = client.get(
            "/api/v1/security/projects/project-123/vulnerabilities/CVE-2024-0001/risk-analysis?"
            "include_predictions=true"
        )

        assert response.status_code == 200
        data = response.json()

        # Check predictions section
        assert "predictions" in data
        predictions = data["predictions"]

        # Check risk projection
        assert "risk_projection" in predictions
        projection = predictions["risk_projection"]
        assert "7_days" in projection
        assert "30_days" in projection
        assert "90_days" in projection
        assert projection["7_days"]["predicted_score"] > 95.0  # Should increase

        # Check exploitation probability
        assert "exploitation_probability" in predictions
        exploit_prob = predictions["exploitation_probability"]
        assert exploit_prob["current"] == 0.95
        assert exploit_prob["30_days"] > exploit_prob["current"]

    @patch("src.udp.api.v1.security.get_current_user")
    @patch("src.udp.api.v1.security.require_permission")
    @patch("src.udp.api.v1.security.prioritizer")
    def test_get_risk_dashboard(
        self,
        mock_prioritizer,
        mock_require_permission,
        mock_get_current_user,
        mock_current_user,
        mock_prioritized_vulnerabilities,
    ):
        """Test get risk dashboard endpoint."""
        mock_get_current_user.return_value = mock_current_user
        mock_require_permission.return_value = None
        mock_prioritizer.prioritize_vulnerabilities = AsyncMock(
            return_value=mock_prioritized_vulnerabilities
        )

        response = client.get("/api/v1/security/projects/project-123/risk-dashboard")

        assert response.status_code == 200
        data = response.json()

        # Check summary section
        assert "summary" in data
        summary = data["summary"]
        assert summary["total_vulnerabilities"] == 2
        assert summary["risk_distribution"]["critical"] == 1
        assert summary["risk_distribution"]["high"] == 1
        assert summary["average_scores"]["priority_score"] == 85.0
        assert summary["average_scores"]["cvss_score"] == 87.5

        # Check risk trend distribution
        assert "risk_trend_distribution" in summary
        trends = summary["risk_trend_distribution"]
        assert trends["increasing"]["count"] == 1
        assert trends["stable"]["count"] == 1

        # Check urgency distribution
        assert "urgency_distribution" in summary
        urgency = summary["urgency_distribution"]
        assert urgency["immediate"] == 1
        assert urgency["1-7_days"] == 1

        # Check top vulnerabilities
        assert "top_vulnerabilities" in data
        top_vulns = data["top_vulnerabilities"]
        assert len(top_vulns) == 2
        assert top_vulns[0]["vulnerability_id"] == "CVE-2024-0001"
        assert top_vulns[0]["priority_score"] == 95.0

        # Check recommendations
        assert "recommendations" in data
        recommendations = data["recommendations"]
        assert "immediate_actions" in recommendations
        assert "short_term_goals" in recommendations
        assert "long_term_goals" in recommendations
        assert (
            "Address 1 critical vulnerabilities immediately"
            in recommendations["immediate_actions"]
        )

    @patch("src.udp.api.v1.security.get_current_user")
    @patch("src.udp.api.v1.security.require_permission")
    @patch("src.udp.api.v1.security.get_async_session")
    def test_acknowledge_vulnerability(
        self,
        mock_get_session,
        mock_require_permission,
        mock_get_current_user,
        mock_current_user,
    ):
        """Test acknowledge vulnerability endpoint."""
        mock_get_current_user.return_value = mock_current_user
        mock_require_permission.return_value = None
        mock_session = AsyncMock(spec=AsyncSession)
        mock_get_session.return_value = mock_session

        ack_data = {
            "reason": "Business critical - cannot patch immediately",
            "accepted_risk": True,
            "remediation_plan": "Will patch in next maintenance window",
        }

        response = client.post(
            "/api/v1/security/projects/project-123/vulnerabilities/CVE-2024-0001/acknowledge",
            json=ack_data,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["vulnerability_id"] == "CVE-2024-0001"
        assert "acknowledged_by" in data
        assert "acknowledged_at" in data

    @patch("src.udp.api.v1.security.get_current_user")
    @patch("src.udp.api.v1.security.require_permission")
    def test_get_threat_intelligence_summary(
        self,
        mock_require_permission,
        mock_get_current_user,
        mock_current_user,
    ):
        """Test get threat intelligence summary endpoint."""
        mock_get_current_user.return_value = mock_current_user
        mock_require_permission.return_value = None

        response = client.get("/api/v1/security/threat-intelligence/summary")

        assert response.status_code == 200
        data = response.json()

        # Check active threats
        assert "active_threats" in data
        threats = data["active_threats"]
        assert threats["total"] == 127
        assert threats["critical"] == 8
        assert threats["high"] == 23

        # Check recent exploits
        assert "recent_exploits" in data
        exploits = data["recent_exploits"]
        assert len(exploits) > 0
        assert "cve_id" in exploits[0]
        assert "exploit_maturity" in exploits[0]

        # Check threat actors
        assert "threat_actors" in data
        actors = data["threat_actors"]
        assert len(actors) > 0
        assert "name" in actors[0]
        assert "activity" in actors[0]

        # Check trends
        assert "trends" in data
        trends = data["trends"]
        assert "exploit_development" in trends
        assert "ransomware_activity" in trends

        # Check metadata
        assert "metadata" in data
        metadata = data["metadata"]
        assert "generated_at" in metadata
        assert "data_sources" in metadata

    def test_prioritize_vulnerabilities_unauthorized(self):
        """Test prioritize vulnerabilities without authentication."""
        response = client.get(
            "/api/v1/security/projects/project-123/vulnerabilities/prioritize"
        )
        assert response.status_code == 401

    def test_prioritize_vulnerabilities_insufficient_permissions(self):
        """Test prioritize vulnerabilities without sufficient permissions."""
        mock_user = MagicMock()
        mock_user.permissions = ["project:read"]  # Missing required permission

        with patch("src.udp.api.v1.security.get_current_user", return_value=mock_user):
            with patch("src.udp.api.v1.security.require_permission") as mock_require:
                from fastapi import HTTPException

                mock_require.side_effect = HTTPException(
                    status_code=403, detail="Forbidden"
                )

                response = client.get(
                    "/api/v1/security/projects/project-123/vulnerabilities/prioritize"
                )
                assert response.status_code == 403

    def test_get_vulnerability_not_found(self):
        """Test getting risk analysis for non-existent vulnerability."""
        mock_user = MagicMock()
        mock_user.permissions = ["project:read"]

        with patch("src.udp.api.v1.security.get_current_user", return_value=mock_user):
            with patch("src.udp.api.v1.security.require_permission"):
                with patch("src.udp.api.v1.security.prioritizer") as mock_prioritizer:
                    mock_prioritizer.prioritize_vulnerabilities = AsyncMock(
                        return_value=[]
                    )

                    response = client.get(
                        "/api/v1/security/projects/project-123/vulnerabilities/CVE-9999-9999/risk-analysis"
                    )
                    assert response.status_code == 404
                    assert "not found" in response.json()["detail"]

    def test_interpret_trend_function(self):
        """Test the trend interpretation function."""
        from src.udp.api.v1.security import _interpret_trend

        # Test increasing trend with high confidence
        result = _interpret_trend(RiskTrend.INCREASING, 0.8)
        assert "increasing" in result.lower()
        assert "immediate attention" in result.lower()

        # Test stable trend with moderate confidence
        result = _interpret_trend(RiskTrend.STABLE, 0.6)
        assert "stable" in result.lower()
        assert "monitoring" in result.lower()

        # Test decreasing trend
        result = _interpret_trend(RiskTrend.DECREASING, 0.7)
        assert "decreasing" in result.lower()
        assert "mitigations" in result.lower()

        # Test unknown trend with low confidence
        result = _interpret_trend(RiskTrend.UNKNOWN, 0.2)
        assert "insufficient data" in result.lower()


class TestSecurityAPIErrorHandling:
    """Test security API error handling."""

    @patch("src.udp.api.v1.security.get_current_user")
    @patch("src.udp.api.v1.security.require_permission")
    @patch("src.udp.api.v1.security.prioritizer")
    def test_prioritizer_error_handling(
        self,
        mock_prioritizer,
        mock_require_permission,
        mock_get_current_user,
        mock_current_user,
    ):
        """Test API error handling when prioritizer fails."""
        mock_get_current_user.return_value = mock_current_user
        mock_require_permission.return_value = None
        mock_prioritizer.prioritize_vulnerabilities = AsyncMock(
            side_effect=Exception("Database connection failed")
        )

        response = client.get(
            "/api/v1/security/projects/project-123/vulnerabilities/prioritize"
        )

        assert response.status_code == 500
        data = response.json()
        assert "detail" in data
        assert "Failed to prioritize vulnerabilities" in data["detail"]

    @patch("src.udp.api.v1.security.get_current_user")
    @patch("src.udp.api.v1.security.require_permission")
    def test_threat_intelligence_error(
        self,
        mock_require_permission,
        mock_get_current_user,
        mock_current_user,
    ):
        """Test threat intelligence endpoint error handling."""
        mock_get_current_user.return_value = mock_current_user
        mock_require_permission.return_value = None

        with patch(
            "src.udp.api.v1.security.get_current_user",
            side_effect=Exception("Auth service error"),
        ):
            response = client.get("/api/v1/security/threat-intelligence/summary")
            assert response.status_code == 500
