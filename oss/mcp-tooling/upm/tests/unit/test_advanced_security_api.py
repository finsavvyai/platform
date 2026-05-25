"""
Unit tests for Advanced Security API endpoints.
"""

import pytest
from unittest.mock import Mock, AsyncMock, patch
from fastapi.testclient import TestClient
from uuid import uuid4

from src.udp.main import app
from src.udp.core.models.user import User


class TestAdvancedSecurityAPI:
    """Test cases for Advanced Security API endpoints."""

    @pytest.fixture
    def client(self):
        """Create test client."""
        return TestClient(app)

    @pytest.fixture
    def mock_user(self):
        """Create mock user."""
        return User(
            id=uuid4(),
            email="test@example.com",
            full_name="Test User",
            is_active=True,
            is_superuser=True,
        )

    @pytest.fixture
    def mock_advanced_scan_result(self):
        """Mock advanced scan result."""
        return {
            "project_id": str(uuid4()),
            "scan_type": "advanced",
            "scan_date": "2023-11-15T10:00:00Z",
            "basic_summary": {
                "total": 5,
                "critical": 1,
                "high": 2,
                "medium": 1,
                "low": 1,
            },
            "total_dependencies": 150,
            "advanced_statistics": {
                "total_assessed": 5,
                "average_overall_risk": 72.5,
                "highest_risk_score": 95.0,
                "risk_distribution": {
                    "critical": {"count": 1, "percentage": 20.0},
                    "high": {"count": 2, "percentage": 40.0},
                    "medium": {"count": 1, "percentage": 20.0},
                    "low": {"count": 1, "percentage": 20.0},
                },
                "chaining_potential_count": 3,
                "chaining_percentage": 60.0,
            },
            "risk_assessments": [
                {
                    "vulnerability_id": "CVE-2023-1001",
                    "base_score": 9.8,
                    "exploitability_score": 85.0,
                    "impact_score": 95.0,
                    "contextual_risk_score": 88.0,
                    "overall_risk_score": 89.0,
                    "risk_level": "critical",
                    "confidence": 0.95,
                    "attack_vectors": [
                        "Network-based attack",
                        "No privileges required",
                    ],
                    "potential_impacts": ["Complete system compromise", "Data breach"],
                    "mitigation_strategies": [
                        "Update to fixed version",
                        "Implement WAF",
                    ],
                    "has_chaining_potential": True,
                }
            ],
            "attack_path_analysis": {
                "total_attack_paths": 2,
                "high_risk_paths": 1,
                "chain_summaries": [
                    {
                        "chain_id": "chain_001",
                        "vulnerability_count": 2,
                        "overall_impact": 85.0,
                        "feasibility": 75.0,
                        "risk_level": "critical",
                        "recommendations": ["Fix first vulnerability immediately"],
                    }
                ],
            },
            "critical_vulnerabilities": [
                {
                    "id": "CVE-2023-1001",
                    "overall_risk_score": 89.0,
                    "risk_level": "critical",
                    "primary_concerns": ["Remote code execution", "Data exposure"],
                }
            ],
            "executive_summary": {
                "overall_risk_level": "critical",
                "immediate_actions_required": 1,
                "attack_surface_reduction": {
                    "current_risk_score": 362.5,
                    "potential_reduction": 178.0,
                    "reduction_percentage": 49.1,
                    "vulnerabilities_to_address": 1,
                },
                "compliance_status": "Significant Issues",
            },
        }

    @pytest.fixture
    def mock_exploitability_result(self):
        """Mock exploitability assessment result."""
        return {
            "vulnerability_id": "CVE-2023-1001",
            "exploitability_assessment": {
                "attack_vector": "NETWORK",
                "attack_complexity": "LOW",
                "privileges_required": "NONE",
                "user_interaction": "NONE",
                "scope": "CHANGED",
                "exploit_code_maturity": 0.9,
                "remediation_level": 0.0,
                "confidence": 0.95,
                "weaponization": 0.8,
            },
            "exploitability_score": 92.5,
            "exploit_intelligence": {
                "metasploit_module": True,
                "exploitdb_id": "51234",
                "active_exploitation": True,
            },
            "recommendations": [
                "Active exploits detected - immediate patching required",
                "Network-based attack - implement network segmentation",
            ],
            "assessment_date": "2023-11-15T10:00:00Z",
        }

    @pytest.fixture
    def mock_attack_path_result(self):
        """Mock attack path analysis result."""
        return {
            "project_id": str(uuid4()),
            "attack_paths": [
                {
                    "chain_id": "chain_001",
                    "vulnerabilities": ["CVE-2023-1001", "CVE-2023-1002"],
                    "attack_steps": [
                        "Step 1: Exploit authentication bypass in auth-lib",
                        "Step 2: Perform SQL injection in database-driver",
                    ],
                    "overall_impact": 85.0,
                    "feasibility": 75.0,
                    "risk_level": "critical",
                    "required_privileges": ["none", "user"],
                    "detection_difficulty": "medium",
                }
            ],
            "attack_graph": {
                "nodes": [
                    {
                        "id": "CVE-2023-1001",
                        "label": "auth-lib\\nCVE-2023-1001",
                        "color": "#ff4444",
                        "size": 39.6,
                    },
                    {
                        "id": "CVE-2023-1002",
                        "label": "database-driver\\nCVE-2023-1002",
                        "color": "#ff8800",
                        "size": 37.0,
                    },
                ],
                "edges": [
                    {
                        "source": "CVE-2023-1001",
                        "target": "CVE-2023-1002",
                        "label": "Chain Impact: 85.0%",
                        "width": 4,
                        "color": "#ff0000",
                    }
                ],
            },
            "summary": {
                "total_paths": 1,
                "high_impact_paths": 1,
                "critical_paths": 1,
                "highest_impact": 85.0,
                "average_impact": 85.0,
            },
            "recommendations": [
                "Priority: Break 1 high-feasibility attack chain",
                "Review dependency graph to reduce multi-step attack paths",
            ],
            "analysis_date": "2023-11-15T10:00:00Z",
        }

    @patch("src.udp.api.v1.endpoints.advanced_security.get_current_user")
    @patch("src.udp.api.v1.endpoints.advanced_security.get_service")
    async def test_advanced_vulnerability_scan(
        self,
        mock_get_service,
        mock_get_user,
        client,
        mock_user,
        mock_advanced_scan_result,
    ):
        """Test advanced vulnerability scan endpoint."""
        # Setup mocks
        mock_get_user.return_value = mock_user
        mock_service = AsyncMock()
        mock_service.advanced_vulnerability_scan.return_value = (
            mock_advanced_scan_result
        )
        mock_get_service.return_value = mock_service

        # Make request
        project_id = str(uuid4())
        request_data = {
            "force_rescan": True,
            "include_attack_paths": True,
            "include_exploitability": True,
            "contextual_factors": {
                "project_exposure": "public",
                "data_sensitivity": "high",
                "user_base_size": 50000,
                "internet_facing": True,
            },
        }

        response = client.post(
            f"/api/v1/advanced-security/projects/{project_id}/scan",
            json=request_data,
        )

        # Assertions
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["project_id"] == project_id
        assert data["data"]["scan_type"] == "advanced"
        assert len(data["data"]["risk_assessments"]) > 0

        # Verify service was called with correct parameters
        mock_service.advanced_vulnerability_scan.assert_called_once_with(
            project_id=project_id,
            scan_config=None,
            include_attack_paths=True,
            include_exploitability=True,
            contextual_factors=request_data["contextual_factors"],
        )

    @patch("src.udp.api.v1.endpoints.advanced_security.get_current_user")
    @patch("src.udp.api.v1.endpoints.advanced_security.get_service")
    async def test_assess_vulnerability_exploitability(
        self,
        mock_get_service,
        mock_get_user,
        client,
        mock_user,
        mock_exploitability_result,
    ):
        """Test exploitability assessment endpoint."""
        # Setup mocks
        mock_get_user.return_value = mock_user
        mock_service = AsyncMock()
        mock_service.assess_exploitability.return_value = mock_exploitability_result
        mock_get_service.return_value = mock_service

        # Make request
        vulnerability_id = "CVE-2023-1001"
        request_data = {
            "vulnerability_id": vulnerability_id,
            "additional_intelligence": {
                "metasploit_module": True,
                "active_exploitation": True,
            },
        }

        response = client.post(
            f"/api/v1/advanced-security/vulnerabilities/{vulnerability_id}/exploitability",
            json=request_data,
        )

        # Assertions
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["vulnerability_id"] == vulnerability_id
        assert data["data"]["exploitability_score"] > 90
        assert len(data["data"]["recommendations"]) > 0

        # Verify service was called correctly
        mock_service.assess_exploitability.assert_called_once_with(
            vulnerability_id=vulnerability_id,
            additional_intelligence=request_data["additional_intelligence"],
        )

    @patch("src.udp.api.v1.endpoints.advanced_security.get_current_user")
    @patch("src.udp.api.v1.endpoints.advanced_security.get_service")
    async def test_analyze_attack_paths(
        self,
        mock_get_service,
        mock_get_user,
        client,
        mock_user,
        mock_attack_path_result,
    ):
        """Test attack path analysis endpoint."""
        # Setup mocks
        mock_get_user.return_value = mock_user
        mock_service = AsyncMock()
        mock_service.analyze_attack_paths.return_value = mock_attack_path_result
        mock_get_service.return_value = mock_service

        # Make request
        project_id = str(uuid4())
        request_data = {
            "max_paths": 5,
            "min_impact_threshold": 50.0,
        }

        response = client.post(
            f"/api/v1/advanced-security/projects/{project_id}/attack-paths",
            json=request_data,
        )

        # Assertions
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["project_id"] == project_id
        assert len(data["data"]["attack_paths"]) > 0
        assert data["data"]["summary"]["total_paths"] > 0
        assert "attack_graph" in data["data"]

        # Verify service was called correctly
        mock_service.analyze_attack_paths.assert_called_once_with(
            project_id=project_id,
            max_paths=5,
            min_impact_threshold=50.0,
        )

    @patch("src.udp.api.v1.endpoints.advanced_security.get_current_user")
    @patch("src.udp.api.v1.endpoints.advanced_security.get_service")
    async def test_contextual_risk_assessment(
        self, mock_get_service, mock_get_user, client, mock_user
    ):
        """Test contextual risk assessment endpoint."""
        # Setup mocks
        mock_get_user.return_value = mock_user
        mock_service = AsyncMock()
        mock_service.contextual_risk_assessment.return_value = {
            "contextual_factors": {
                "project_exposure": "public",
                "data_sensitivity": "high",
                "business_criticality": "critical",
            },
            "assessments": [
                {
                    "vulnerability_id": "CVE-2023-1001",
                    "overall_risk_score": 89.0,
                    "risk_level": "critical",
                }
            ],
            "risk_distribution": {
                "critical": {"count": 1, "percentage": 100.0},
                "high": {"count": 0, "percentage": 0.0},
            },
            "recommendations": [
                {
                    "priority": "critical",
                    "title": "Address Critical Vulnerabilities",
                }
            ],
            "total_assessed": 1,
        }
        mock_get_service.return_value = mock_service

        # Make request
        request_data = {
            "vulnerability_ids": ["CVE-2023-1001", "CVE-2023-1002"],
            "project_context": {
                "project_exposure": "public",
                "data_sensitivity": "high",
                "user_base_size": 100000,
                "internet_facing": True,
                "compliance_requirements": ["PCI-DSS", "GDPR"],
                "business_criticality": "critical",
            },
            "prioritize_by": "overall_risk",
        }

        response = client.post(
            "/api/v1/advanced-security/contextual-risk-assessment",
            json=request_data,
        )

        # Assertions
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert len(data["data"]["assessments"]) > 0
        assert data["data"]["total_assessed"] > 0
        assert "risk_distribution" in data["data"]
        assert len(data["data"]["recommendations"]) > 0

        # Verify service was called correctly
        mock_service.contextual_risk_assessment.assert_called_once_with(
            vulnerability_ids=request_data["vulnerability_ids"],
            project_context=request_data["project_context"],
            prioritize_by="overall_risk",
        )

    def test_advanced_scan_request_validation(self, client):
        """Test advanced scan request validation."""
        # Test invalid prioritize_by value
        request_data = {
            "contextual_factors": {
                "project_exposure": "invalid_value",  # Invalid
            },
        }

        response = client.post(
            f"/api/v1/advanced-security/projects/{uuid4()}/scan",
            json=request_data,
        )

        # Should fail validation
        assert response.status_code == 422

    def test_exploitability_request_validation(self, client):
        """Test exploitability request validation."""
        # Test missing vulnerability_id
        request_data = {
            "additional_intelligence": {},
        }

        response = client.post(
            f"/api/v1/advanced-security/vulnerabilities//exploitability",
            json=request_data,
        )

        # Should fail due to empty path
        assert response.status_code == 404

    def test_attack_path_request_validation(self, client):
        """Test attack path request validation."""
        # Test invalid max_paths value
        request_data = {
            "max_paths": 150,  # Exceeds maximum of 100
        }

        response = client.post(
            f"/api/v1/advanced-security/projects/{uuid4()}/attack-paths",
            json=request_data,
        )

        # Should fail validation
        assert response.status_code == 422

    @patch("src.udp.api.v1.endpoints.advanced_security.get_current_user")
    @patch("src.udp.api.v1.endpoints.advanced_security.get_service")
    async def test_error_handling(
        self, mock_get_service, mock_get_user, client, mock_user
    ):
        """Test error handling in endpoints."""
        # Setup mocks
        mock_get_user.return_value = mock_user
        mock_service = AsyncMock()
        mock_service.advanced_vulnerability_scan.side_effect = Exception(
            "Service error"
        )
        mock_get_service.return_value = mock_service

        # Make request
        response = client.post(
            f"/api/v1/advanced-security/projects/{uuid4()}/scan",
            json={},
        )

        # Should return error response
        assert response.status_code == 500
        data = response.json()
        assert "detail" in data
        assert "Advanced scan failed" in data["detail"]


class TestSecurityAPI:
    """Test cases for basic Security API endpoints."""

    @pytest.fixture
    def client(self):
        """Create test client."""
        return TestClient(app)

    @pytest.fixture
    def mock_user(self):
        """Create mock user."""
        return User(
            id=uuid4(),
            email="test@example.com",
            full_name="Test User",
            is_active=True,
            is_superuser=True,
        )

    @patch("src.udp.api.v1.endpoints.security.get_current_user")
    @patch("src.udp.api.v1.endpoints.security.get_service")
    async def test_scan_project_vulnerabilities(
        self, mock_get_service, mock_get_user, client, mock_user
    ):
        """Test basic vulnerability scan endpoint."""
        # Setup mocks
        mock_get_user.return_value = mock_user
        mock_service = AsyncMock()
        mock_service.scan_project_vulnerabilities.return_value = {
            "project_id": str(uuid4()),
            "scan_id": str(uuid4()),
            "total_dependencies": 50,
            "summary": {
                "total": 3,
                "critical": 0,
                "high": 1,
                "medium": 1,
                "low": 1,
            },
            "vulnerabilities": [
                {
                    "id": "CVE-2023-1001",
                    "severity": "high",
                    "score": 8.5,
                    "package_name": "example-package",
                }
            ],
        }
        mock_get_service.return_value = mock_service

        # Make request
        project_id = str(uuid4())
        request_data = {
            "force_rescan": False,
            "include_transitive": True,
            "severity_threshold": "medium",
        }

        response = client.post(
            f"/api/v1/security/projects/{project_id}/scan",
            json=request_data,
        )

        # Assertions
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["total_dependencies"] == 50
        assert data["data"]["summary"]["total"] == 3

    @patch("src.udp.api.v1.endpoints.security.get_current_user")
    @patch("src.udp.api.v1.endpoints.security.get_service")
    async def test_get_project_vulnerabilities(
        self, mock_get_service, mock_get_user, client, mock_user
    ):
        """Test get project vulnerabilities endpoint."""
        # Setup mocks
        mock_get_user.return_value = mock_user
        mock_service = AsyncMock()
        mock_service.scan_project_vulnerabilities.return_value = {
            "vulnerabilities": [
                {
                    "id": "CVE-2023-1001",
                    "severity": "high",
                    "score": 8.5,
                    "status": "open",
                },
                {
                    "id": "CVE-2023-1002",
                    "severity": "medium",
                    "score": 6.0,
                    "status": "open",
                },
            ]
        }
        mock_get_service.return_value = mock_service

        # Make request
        project_id = str(uuid4())
        response = client.get(
            f"/api/v1/security/projects/{project_id}/vulnerabilities?severity=high&status=open"
        )

        # Assertions
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert len(data["data"]) == 1  # Only high severity
        assert data["data"][0]["severity"] == "high"

    @patch("src.udp.api.v1.endpoints.security.get_current_user")
    @patch("src.udp.api.v1.endpoints.security.get_service")
    async def test_get_vulnerability_details(
        self, mock_get_service, mock_get_user, client, mock_user
    ):
        """Test get vulnerability details endpoint."""
        # Setup mocks
        mock_get_user.return_value = mock_user

        mock_vulnerability = Mock()
        mock_vulnerability.id = "CVE-2023-1001"
        mock_vulnerability.cve_id = "CVE-2023-1001"
        mock_vulnerability.title = "Test Vulnerability"
        mock_vulnerability.description = "A test vulnerability"
        mock_vulnerability.severity = "high"
        mock_vulnerability.score = 8.5
        mock_vulnerability.vector = "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"
        mock_vulnerability.source = "nvd"
        mock_vulnerability.published_at = None
        mock_vulnerability.modified_at = None
        mock_vulnerability.references = []
        mock_vulnerability.affected_packages = []

        mock_service = AsyncMock()
        mock_service.get_vulnerability_by_id.return_value = mock_vulnerability
        mock_get_service.return_value = mock_service

        # Make request
        vulnerability_id = "CVE-2023-1001"
        response = client.get(f"/api/v1/security/vulnerabilities/{vulnerability_id}")

        # Assertions
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["id"] == vulnerability_id
        assert data["data"]["severity"] == "high"
        assert data["data"]["score"] == 8.5
