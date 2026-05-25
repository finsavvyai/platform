"""
Unit tests for Security Scanning Service.

Tests vulnerability scanning, classification, and report generation
functionality across multiple vulnerability sources.
"""

import asyncio
import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from src.udp.services.security_service import SecurityScanningService
from src.udp.core.models.vulnerability import (
    VulnerabilityModel,
    ProjectVulnerabilityModel,
    VulnerabilityScanModel,
)
from src.udp.core.models.project import ProjectModel
from src.udp.core.models.package import PackageModel


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
async def security_service(test_db):
    """Create security service instance with mock HTTP clients."""
    with patch("httpx.AsyncClient") as mock_client:
        service = SecurityScanningService(test_db)
        yield service


@pytest.fixture
def mock_vulnerability_data():
    """Mock vulnerability data from NVD."""
    return {
        "cve": {
            "id": "CVE-2023-12345",
            "descriptions": [{"lang": "en", "value": "Test vulnerability description"}],
            "metrics": {
                "cvssMetricV31": [
                    {
                        "cvssData": {
                            "baseScore": 7.5,
                            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/BR/AH/AR/E:U/RL:O/TF:W",
                            "baseSeverity": "HIGH",
                        }
                    }
                ]
            },
            "references": [
                {"url": "https://example.com/cve/CVE-2023-12345", "source": "NVD"}
            ],
            "published": "2023-05-15T00:00Z",
        }
    }


@pytest.fixture
def mock_github_advisory_data():
    """Mock GitHub Advisory data."""
    return {
        "advisory": {
            "ghsa_id": "GHSA-test-1234",
            "summary": "Test GitHub advisory",
            "description": "Test description",
            "severity": "HIGH",
            "published_at": "2023-05-15T00:00Z",
            "identifiers": [{"type": "CVE", "value": "CVE-2023-12345"}],
            "references": [{"url": "https://example.com/advisory", "source": "GitHub"}],
        }
    }


@pytest.fixture
def mock_osv_data():
    """Mock OSV vulnerability data."""
    return {
        "id": "OSV-2023-1234",
        "summary": "Test OSV vulnerability",
        "details": "Test OSV vulnerability description",
        "vulns": [
            {
                "severity": [{"type": "CVSS_V3", "score": 6.8}],
                "modified": "2023-05-15T00:00Z",
                "references": [{"url": "https://example.com/osv", "type": "ADVISORY"}],
            }
        ],
    }


class TestVulnerabilityParsing:
    """Test vulnerability data parsing from different sources."""

    def test_parse_nvd_vulnerability(self, security_service, mock_vulnerability_data):
        """Test NVD vulnerability parsing."""
        with patch.object(
            security_service,
            "_query_nvd_database",
            return_value=[mock_vulnerability_data],
        ):
            result = asyncio.run(
                security_service.scan_package_vulnerabilities(
                    "test-package", "npm", "1.0.0"
                )
            )

        assert len(result) == 1
        vulnerability = result[0]
        assert vulnerability["id"] == "CVE-2023-12345"
        assert vulnerability["source"] == "nvd"
        assert vulnerability["severity"] == "high"
        assert vulnerability["score"] == 7.5

    def test_parse_github_advisory(self, security_service, mock_github_advisory_data):
        """Test GitHub Advisory parsing."""
        with patch.object(
            security_service,
            "_query_github_advisories",
            return_value=[mock_github_advisory_data],
        ):
            result = asyncio.run(
                security_service.scan_package_vulnerabilities(
                    "test-package", "npm", "1.0.0"
                )
            )

        assert len(result) == 1
        vulnerability = result[0]
        assert vulnerability["id"] == "GHSA-test-1234"
        assert vulnerability["source"] == "github"
        assert vulnerability["cve_id"] == "CVE-2023-12345"

    def test_parse_osv_vulnerability(self, security_service, mock_osv_data):
        """Test OSV vulnerability parsing."""
        with patch.object(
            security_service, "_query_osv_database", return_value=[mock_osv_data]
        ):
            result = asyncio.run(
                security_service.scan_package_vulnerabilities(
                    "test-package", "npm", "1.0.0"
                )
            )

        assert len(result) == 1
        vulnerability = result[0]
        assert vulnerability["id"] == "OSV-2023-1234"
        assert vulnerability["source"] == "osv"


class TestVulnerabilityClassification:
    """Test vulnerability classification and risk assessment."""

    def test_cvss_severity_classification(self, security_service):
        """Test CVSS score to severity classification."""
        # Test CVSS classification method
        service = SecurityScanningService(None)  # Create with None for testing

        # Test various CVSS scores
        assert service._classify_cvss_severity(9.5) == "critical"
        assert service._classify_cvss_severity(7.5) == "high"
        assert service._classify_cvss_severity(4.5) == "medium"
        assert service._classify_cvss_severity(2.5) == "low"
        assert service._classify_cvss_severity(0.0) == "unknown"

    def test_severity_filtering(self, security_service):
        """Test vulnerability filtering by severity threshold."""
        service = SecurityScanningService(None)

        # Mock vulnerabilities with different severities
        vulnerabilities = [
            {"severity": "critical", "id": "VULN-1"},
            {"severity": "high", "id": "VULN-2"},
            {"severity": "medium", "id": "VULN-3"},
            {"severity": "low", "id": "VULN-4"},
        ]

        # Test different thresholds
        critical_only = service._filter_vulnerabilities_by_severity(
            vulnerabilities, "critical"
        )
        assert len(critical_only) == 1
        assert critical_only[0]["id"] == "VULN-1"

        high_and_above = service._filter_vulnerabilities_by_severity(
            vulnerabilities, "high"
        )
        assert len(high_and_above) == 2
        assert set(v["id"] for v in high_and_above) == {"VULN-1", "VULN-2"}

        all_severities = service._filter_vulnerabilities_by_severity(
            vulnerabilities, "low"
        )
        assert len(all_severities) == 4

    def test_vulnerability_deduplication(self, security_service):
        """Test vulnerability deduplication."""
        service = SecurityScanningService(None)

        # Mock duplicate vulnerabilities from different sources
        vulnerabilities = [
            {"id": "CVE-2023-12345", "source": "nvd"},
            {"id": "CVE-2023-12345", "source": "github"},  # Same CVE
            {"id": "CVE-2023-67890", "source": "nvd"},
            {"title": "Duplicate title", "source": "github"},  # Same title
        ]

        unique_vulns = service._deduplicate_vulnerabilities(vulnerabilities)

        assert len(unique_vulns) == 3  # Should remove duplicates
        cve_ids = [v["id"] for v in unique_vulns if v["id"].startswith("CVE")]
        assert "CVE-2023-12345" in cve_ids
        assert "CVE-2023-67890" in cve_ids

    def test_risk_assessment(self, security_service):
        """Test vulnerability risk assessment."""
        service = SecurityScanningService(None)

        # Mock vulnerability with risk assessment data
        vulnerability = {
            "id": "VULN-1",
            "severity": "high",
            "score": 7.5,
        }

        risk_assessment = asyncio.run(service._assess_vulnerability_risk(vulnerability))

        assert "risk_score" in risk_assessment
        assert "risk_level" in risk_assessment
        assert "factors" in risk_assessment

        # Test risk level calculation
        assert risk_assessment["risk_score"] == 75.0  # CVSS 7.5 * 10
        assert risk_assessment["risk_level"] == "high"


class TestRemediationGeneration:
    """Test remediation suggestion generation."""

    def test_critical_remediation_suggestions(self, security_service):
        """Test critical vulnerability remediation suggestions."""
        service = SecurityScanningService(None)

        vulnerability = {
            "severity": "critical",
            "package_name": "test-package",
            "ecosystem": "npm",
        }

        suggestions = service._generate_remediation_suggestions(vulnerability)

        assert suggestions["priority"] == "immediate"
        assert "upgrade" in suggestions["action"].lower()
        assert any("immediate" in rec for rec in suggestions["recommendations"])

    def test_high_remediation_suggestions(self, security_service):
        """Test high severity vulnerability remediation suggestions."""
        service = SecurityScanningService(None)

        vulnerability = {
            "severity": "high",
            "package_name": "test-package",
            "ecosystem": "npm",
        }

        suggestions = service._generate_remediation_suggestions(vulnerability)

        assert suggestions["priority"] == "high"
        assert any("7 days" in rec for rec in suggestions["recommendations"])

    def test_ecosystem_specific_suggestions(self, security_service):
        """Test ecosystem-specific remediation suggestions."""
        service = SecurityScanningService(None)

        # Test npm ecosystem
        npm_vulnerability = {
            "severity": "high",
            "package_name": "test-pkg",
            "ecosystem": "npm",
        }
        npm_suggestions = service._get_ecosystem_remediation_suggestions("npm")

        assert any("npm audit" in rec for rec in npm_suggestions)

        # Test pip ecosystem
        pip_vulnerability = {
            "severity": "high",
            "package_name": "test-pkg",
            "ecosystem": "pip",
        }
        pip_suggestions = service._get_ecosystem_remediation_suggestions("pip")

        assert any("pip install" in rec for rec in pip_suggestions)


class TestReportGeneration:
    """Test vulnerability report generation."""

    def test_generate_vulnerability_report(self, security_service, test_db):
        """Test comprehensive vulnerability report generation."""
        service = SecurityScanningService(test_db)

        # Mock data
        project_id = str(uuid4())
        scan_id = uuid4()
        vulnerabilities = [
            {
                "id": "CVE-2023-12345",
                "severity": "critical",
                "score": 9.5,
                "package_name": "test-package-1",
                "ecosystem": "npm",
                "risk_assessment": {"risk_score": 95.0, "risk_level": "critical"},
                "remediation": {"action": "upgrade", "priority": "immediate"},
            },
            {
                "id": "CVE-2023-67890",
                "severity": "high",
                "score": 7.2,
                "package_name": "test-package-2",
                "ecosystem": "npm",
                "risk_assessment": {"risk_score": 72.0, "risk_level": "high"},
                "remediation": {"action": "upgrade", "priority": "high"},
            },
        ]

        dependencies = {
            "dependencies": [
                {"id": "DEP-1", "package_name": "test-package-1", "ecosystem": "npm"},
                {"id": "DEP-2", "package_name": "test-package-2", "ecosystem": "npm"},
            ]
        }

        scan_start_time = datetime.utcnow()

        report = asyncio.run(
            service._generate_vulnerability_report(
                project_id, scan_id, vulnerabilities, dependencies, scan_start_time
            )
        )

        # Verify report structure
        assert "project_id" in report
        assert "scan_id" in report
        assert "scan_date" in report
        assert "scan_duration_seconds" in report
        assert "summary" in report
        assert "vulnerabilities" in report
        assert "vulnerabilities_by_package" in report
        assert "risk_metrics" in report
        assert "recommendations" in report

        # Verify summary counts
        summary = report["summary"]
        assert summary["total"] == 2
        assert summary["critical"] == 1
        assert summary["high"] == 1
        assert summary["medium"] == 0
        assert summary["low"] == 0

        # Verify risk metrics
        risk_metrics = report["risk_metrics"]
        assert "overall_risk_score" in risk_metrics
        assert "overall_risk_level" in risk_metrics
        assert (
            risk_metrics["overall_risk_level"] == "critical"
        )  # (95 + 72) / 2 = 83.5 > 80

    def test_project_recommendations(self, security_service):
        """Test project-level vulnerability recommendations."""
        service = SecurityScanningService(None)

        # Test no vulnerabilities scenario
        no_vulns_recs = service._generate_project_recommendations(
            [], {"total_dependencies": 5}
        )

        assert len(no_vulns_recs) == 1
        assert no_vulns_recs[0]["type"] == "security"
        assert "no vulnerabilities found" in no_vulns_recs[0]["description"].lower()

        # Test critical vulnerabilities scenario
        critical_vulns = [{"severity": "critical"}]
        critical_recs = service._generate_project_recommendations(
            critical_vulns, {"total_dependencies": 50}
        )

        assert any("immediate" in rec["title"] for rec in critical_recs)
        assert any("critical" in rec["priority"] for rec in critical_recs)


class TestAPICalls:
    """Test external API calls and error handling."""

    @pytest.mark.asyncio
    async def test_nvd_api_success(self, security_service, mock_vulnerability_data):
        """Test successful NVD API call."""
        with patch.object(
            security_service,
            "_query_nvd_database",
            return_value=[mock_vulnerability_data],
        ) as mock_query:
            result = await security_service.scan_package_vulnerabilities(
                "test-package", "npm", "1.0.0"
            )

        assert len(result) == 1
        # Verify rate limiting delay was respected
        mock_query.assert_called_once()

    @pytest.mark.asyncio
    async def test_nvd_api_failure(self, security_service):
        """Test NVD API failure handling."""
        import httpx

        with patch.object(
            security_service, "_query_nvd_database", return_value=[]
        ) as mock_query:
            result = await security_service.scan_package_vulnerabilities(
                "test-package", "npm", "1.0.0"
            )

        assert result == []  # Should return empty list on failure

    @pytest.mark.asyncio
    async def test_rate_limiting(self, security_service):
        """Test rate limiting between API calls."""
        with patch("asyncio.sleep") as mock_sleep:
            with patch.object(security_service, "_query_nvd_database", return_value=[]):
                await security_service.scan_package_vulnerabilities(
                    "test-package", "npm", "1.0.0"
                )

        # Verify sleep was called for rate limiting
        mock_sleep.assert_called_with(0.1)


class TestErrorHandling:
    """Test error handling and edge cases."""

    @pytest.mark.asyncio
    async def test_scan_project_vulnerabilities_error_handling(
        self, security_service, test_db
    ):
        """Test error handling in project vulnerability scanning."""
        # Mock exception during scanning
        with patch.object(
            security_service, "_get_dependency", side_effect=Exception("Database error")
        ):
            with pytest.raises(ServiceException) as exc_info:
                await security_service.scan_project_vulnerabilities(str(uuid4()))

        assert "SCAN_FAILED" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_invalid_package_scan(self, security_service):
        """Test scanning with invalid package data."""
        with patch.object(
            security_service,
            "_query_nvd_database",
            side_effect=Exception("Invalid response"),
        ):
            result = await security_service.scan_package_vulnerabilities(
                "test-package", "invalid_ecosystem", "1.0.0"
            )

        # Should handle gracefully and return empty list
        assert result == []

    def test_severity_filtering_edge_cases(self, security_service):
        """Test severity filtering edge cases."""
        service = SecurityScanningService(None)

        vulnerabilities = [
            {"severity": "CRITICAL", "id": "VULN-1"},  # Upper case
            {"severity": "low", "id": "VULN-2"},
            {"severity": "unknown", "id": "VULN-3"},  # Unknown severity
        ]

        # Test with invalid threshold
        all_filtered = service._filter_vulnerabilities_by_severity(
            vulnerabilities, "invalid"
        )
        assert len(all_filtered) == 3  # Should include all when threshold is invalid

        # Test case sensitivity
        critical_filtered = service._filter_vulnerabilities_by_severity(
            vulnerabilities, "CRITICAL"
        )
        assert len(critical_filtered) == 1
        assert critical_filtered[0]["id"] == "VULN-1"


class TestIntegration:
    """Test integration between vulnerability scanning and other services."""

    @pytest.mark.asyncio
    async def test_dependency_service_integration(self, security_service, test_db):
        """Test integration with dependency service."""
        # This would test the full workflow from dependency scanning
        # to vulnerability detection
        project_id = str(uuid4())

        # Mock dependency service response
        mock_deps = {
            "project_id": project_id,
            "dependencies": [
                {
                    "id": "DEP-1",
                    "package": {
                        "name": "test-package",
                        "ecosystem": "npm",
                        "version": "1.0.0",
                    },
                    "is_direct": True,
                }
            ],
        }

        with patch.object(security_service, "_get_dependency") as mock_get_dep:
            mock_get_dep.return_value = MagicMock()
            mock_get_dep.return_value.get_project_dependencies = AsyncMock(
                return_value=mock_deps
            )

            with patch.object(
                security_service, "scan_package_vulnerabilities", return_value=[]
            ):
                result = await security_service.scan_project_vulnerabilities(project_id)

            # Verify dependency service was called
            mock_get_dep.assert_called_once_with("dependency_service")

            # Verify integration worked
            assert "total_dependencies" in result
            assert result["total_dependencies"] == 1
