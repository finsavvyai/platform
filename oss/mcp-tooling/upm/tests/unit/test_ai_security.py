"""
Tests for AI Security Service - Risk-Based Vulnerability Prioritization
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
import numpy as np

from src.udp.services.ai_security import (
    VulnerabilityPrioritizer,
    ThreatIntelligenceAggregator,
    RiskTrendAnalyzer,
    PrioritizationMethod,
    RiskTrend,
    VulnerabilityPriority,
    ThreatIntelligenceData,
    AssetContext,
    AssetCriticality,
    DataSensitivity,
    ExposureLevel,
)


class TestThreatIntelligenceAggregator:
    """Test threat intelligence aggregation."""

    @pytest.fixture
    def aggregator(self):
        """Create threat intelligence aggregator."""
        return ThreatIntelligenceAggregator()

    @pytest.mark.asyncio
    async def test_initialize(self, aggregator):
        """Test aggregator initialization."""
        with patch("src.udp.services.ai_security.redis.from_url") as mock_redis:
            mock_redis.return_value = AsyncMock()
            await aggregator.initialize()
            mock_redis.assert_called_once()

    @pytest.mark.asyncio
    async def test_gather_threat_intelligence(self, aggregator):
        """Test gathering threat intelligence."""
        aggregator.redis_client = AsyncMock()
        aggregator.redis_client.get.return_value = None

        with patch.object(
            aggregator, "_gather_from_sources", return_value={}
        ) as mock_gather:
            with patch.object(aggregator, "_parse_threat_intel") as mock_parse:
                mock_parse.return_value = ThreatIntelligenceData(
                    vulnerability_id="CVE-2024-0001",
                    exploit_available=True,
                    exploit_maturity="poc",
                )

                result = await aggregator.gather_threat_intelligence(["CVE-2024-0001"])

                assert "CVE-2024-0001" in result
                assert result["CVE-2024-0001"].exploit_available is True
                mock_gather.assert_called_once_with("CVE-2024-0001")
                mock_parse.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_cached_threat_data(self, aggregator):
        """Test getting cached threat data."""
        aggregator.redis_client = AsyncMock()
        mock_data = {
            "vulnerability_id": "CVE-2024-0001",
            "exploit_available": True,
            "first_seen": "2024-01-01T00:00:00",
        }
        aggregator.redis_client.get.return_value = '{"vulnerability_id": "CVE-2024-0001", "exploit_available": true, "first_seen": "2024-01-01T00:00:00"}'

        result = await aggregator._get_cached_threat_data("CVE-2024-0001")

        assert result is not None
        assert result.vulnerability_id == "CVE-2024-0001"
        assert result.exploit_available is True
        assert isinstance(result.first_seen, datetime)

    def test_extract_cve_id(self, aggregator):
        """Test CVE ID extraction."""
        # Test direct CVE ID
        assert aggregator._extract_cve_id("CVE-2024-0001") == "CVE-2024-0001"

        # Test CVE ID in string
        assert aggregator._extract_cve_id("VULN-CVE-2024-0001-INFO") == "CVE-2024-0001"

        # Test no CVE ID
        assert aggregator._extract_cve_id("VULN-12345") is None

    @pytest.mark.asyncio
    async def test_query_cisa(self, aggregator):
        """Test CISA KEV catalog query."""
        with patch("numpy.random.random") as mock_random:
            mock_random.side_effect = [
                0.05,
                0.1,
            ]  # 5% chance of KEV, 10% chance of exploit

            result = await aggregator._query_cisa("CVE-2024-0001")

            assert "in_kev" in result
            assert "due_date" in result
            assert "known_exploit" in result
            assert result["in_kev"] is False
            assert result["known_exploit"] is False

    def test_parse_threat_intel(self, aggregator):
        """Test parsing threat intelligence data."""
        intel_data = {
            "cisa": {"known_exploit": True},
            "exploitdb": {"exploit_count": 2},
            "metasploit": {"has_module": True},
            "github": {"repo_count": 5},
        }

        threat_data = aggregator._parse_threat_intel("CVE-2024-0001", intel_data)

        assert threat_data.vulnerability_id == "CVE-2024-0001"
        assert threat_data.active_exploitation is True
        assert threat_data.exploit_available is True
        assert threat_data.exploit_maturity == "widespread"
        assert threat_data.github_exploits == 5
        assert threat_data.exploitation_trend == RiskTrend.INCREASING


class TestRiskTrendAnalyzer:
    """Test risk trend analysis."""

    @pytest.fixture
    def analyzer(self):
        """Create risk trend analyzer."""
        return RiskTrendAnalyzer()

    @pytest.mark.asyncio
    async def test_analyze_risk_trend_increasing(self, analyzer):
        """Test analyzing increasing risk trend."""
        historical_data = [
            {"risk_score": 50, "timestamp": datetime.utcnow() - timedelta(days=30)},
            {"risk_score": 60, "timestamp": datetime.utcnow() - timedelta(days=20)},
            {"risk_score": 70, "timestamp": datetime.utcnow() - timedelta(days=10)},
            {"risk_score": 80, "timestamp": datetime.utcnow() - timedelta(days=5)},
            {"risk_score": 85, "timestamp": datetime.utcnow()},
        ]

        trend, confidence = await analyzer.analyze_risk_trend(
            "CVE-2024-0001", historical_data
        )

        assert trend == RiskTrend.INCREASING
        assert confidence > 0.5

    @pytest.mark.asyncio
    async def test_analyze_risk_trend_decreasing(self, analyzer):
        """Test analyzing decreasing risk trend."""
        historical_data = [
            {"risk_score": 85, "timestamp": datetime.utcnow() - timedelta(days=30)},
            {"risk_score": 70, "timestamp": datetime.utcnow() - timedelta(days=20)},
            {"risk_score": 60, "timestamp": datetime.utcnow() - timedelta(days=10)},
            {"risk_score": 50, "timestamp": datetime.utcnow() - timedelta(days=5)},
            {"risk_score": 45, "timestamp": datetime.utcnow()},
        ]

        trend, confidence = await analyzer.analyze_risk_trend(
            "CVE-2024-0001", historical_data
        )

        assert trend == RiskTrend.DECREASING
        assert confidence > 0.5

    @pytest.mark.asyncio
    async def test_analyze_risk_trend_insufficient_data(self, analyzer):
        """Test analyzing trend with insufficient data."""
        historical_data = [
            {"risk_score": 50, "timestamp": datetime.utcnow()},
            {"risk_score": 55, "timestamp": datetime.utcnow()},
        ]

        trend, confidence = await analyzer.analyze_risk_trend(
            "CVE-2024-0001", historical_data
        )

        assert trend == RiskTrend.UNKNOWN
        assert confidence == 0.0

    @pytest.mark.asyncio
    async def test_predict_future_risk(self, analyzer):
        """Test predicting future risk."""
        current_risk = 75.0

        # Test increasing trend
        predictions = await analyzer.predict_future_risk(
            "CVE-2024-0001", current_risk, RiskTrend.INCREASING
        )

        assert "7_days" in predictions
        assert "30_days" in predictions
        assert "90_days" in predictions
        assert predictions["7_days"] > current_risk
        assert predictions["30_days"] > predictions["7_days"]
        assert predictions["90_days"] > predictions["30_days"]

        # Test decreasing trend
        predictions = await analyzer.predict_future_risk(
            "CVE-2024-0001", current_risk, RiskTrend.DECREASING
        )

        assert predictions["7_days"] < current_risk
        assert predictions["30_days"] < predictions["7_days"]
        assert predictions["90_days"] < predictions["30_days"]


class TestVulnerabilityPrioritizer:
    """Test vulnerability prioritization."""

    @pytest.fixture
    def prioritizer(self):
        """Create vulnerability prioritizer."""
        return VulnerabilityPrioritizer()

    @pytest.fixture
    def mock_project_context(self):
        """Create mock project context."""
        project = MagicMock()
        project.id = "project-123"
        project.settings = {
            "criticality": "high",
            "data_sensitivity": "sensitive",
            "exposure": "external",
            "compliance_frameworks": ["PCI-DSS", "SOX"],
        }

        return {
            "project": project,
            "total_dependencies": 150,
            "severity_counts": {"critical": 5, "high": 20, "medium": 50, "low": 100},
            "asset_criticality": AssetCriticality.HIGH,
            "data_sensitivity": DataSensitivity.SENSITIVE,
            "exposure_level": ExposureLevel.EXTERNAL,
        }

    @pytest.fixture
    def mock_vulnerability(self):
        """Create mock vulnerability."""
        return {
            "id": "CVE-2024-0001",
            "cve_id": "CVE-2024-0001",
            "title": "Test vulnerability",
            "description": "A test vulnerability with remote code execution",
            "severity": "critical",
            "cvss_score": 9.5,
            "cvss_vector": "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
            "published_at": datetime.utcnow() - timedelta(days=30),
            "risk_score": 95,
            "status": "open",
        }

    @pytest.mark.asyncio
    async def test_initialize(self, prioritizer):
        """Test prioritizer initialization."""
        with patch.object(prioritizer.threat_aggregator, "initialize") as mock_init:
            await prioritizer.initialize()
            mock_init.assert_called_once()

    @pytest.mark.asyncio
    async def test_prioritize_vulnerabilities_hybrid(
        self, prioritizer, mock_project_context, mock_vulnerability
    ):
        """Test hybrid vulnerability prioritization."""
        with patch.object(
            prioritizer, "_get_project_vulnerabilities", return_value=["CVE-2024-0001"]
        ):
            with patch.object(
                prioritizer, "_get_project_context", return_value=mock_project_context
            ):
                with patch.object(
                    prioritizer.threat_aggregator,
                    "gather_threat_intelligence",
                    return_value={"CVE-2024-0001": ThreatIntelligenceData()},
                ):
                    with patch.object(
                        prioritizer,
                        "_get_vulnerability_details",
                        return_value=mock_vulnerability,
                    ):
                        priorities = await prioritizer.prioritize_vulnerabilities(
                            project_id="project-123",
                            method=PrioritizationMethod.HYBRID,
                        )

                        assert len(priorities) == 1
                        priority = priorities[0]
                        assert priority.vulnerability_id == "CVE-2024-0001"
                        assert priority.project_id == "project-123"
                        assert priority.priority_score > 0
                        assert (
                            priority.prioritization_method
                            == PrioritizationMethod.HYBRID
                        )

    @pytest.mark.asyncio
    async def test_calculate_contextual_score(
        self, prioritizer, mock_project_context, mock_vulnerability
    ):
        """Test contextual score calculation."""
        score = await prioritizer._calculate_contextual_score(
            mock_vulnerability, mock_project_context
        )

        assert score > 0
        assert score <= 100
        # Should be higher than base CVSS due to high criticality, sensitivity, and exposure
        assert score > mock_vulnerability["cvss_score"] * 10

    @pytest.mark.asyncio
    async def test_calculate_threat_score(self, prioritizer):
        """Test threat score calculation."""
        # Test with no threat data
        score = await prioritizer._calculate_threat_score("CVE-2024-0001", None)
        assert score == 30.0

        # Test with widespread exploit
        threat_data = ThreatIntelligenceData(
            vulnerability_id="CVE-2024-0001",
            exploit_available=True,
            exploit_maturity="widespread",
            active_exploitation=True,
            github_exploits=10,
        )
        score = await prioritizer._calculate_threat_score("CVE-2024-0001", threat_data)
        assert score > 30.0
        assert score <= 100.0

    def test_determine_asset_criticality(self, prioritizer):
        """Test asset criticality determination."""
        project = MagicMock()

        # Test critical
        project.settings = {"criticality": "critical"}
        assert (
            prioritizer._determine_asset_criticality(project)
            == AssetCriticality.CRITICAL
        )

        # Test high
        project.settings = {"criticality": "high"}
        assert (
            prioritizer._determine_asset_criticality(project) == AssetCriticality.HIGH
        )

        # Test default
        project.settings = {}
        assert (
            prioritizer._determine_asset_criticality(project) == AssetCriticality.MEDIUM
        )

    def test_determine_data_sensitivity(self, prioritizer):
        """Test data sensitivity determination."""
        project = MagicMock()

        # Test highly sensitive
        project.settings = {"data_sensitivity": "highly_sensitive"}
        assert (
            prioritizer._determine_data_sensitivity(project)
            == DataSensitivity.HIGHLY_SENSITIVE
        )

        # Test public
        project.settings = {"data_sensitivity": "public"}
        assert (
            prioritizer._determine_data_sensitivity(project) == DataSensitivity.PUBLIC
        )

        # Test default
        project.settings = {}
        assert (
            prioritizer._determine_data_sensitivity(project) == DataSensitivity.INTERNAL
        )

    def test_determine_exposure_level(self, prioritizer):
        """Test exposure level determination."""
        project = MagicMock()

        # Test external
        project.settings = {"exposure": "external"}
        assert prioritizer._determine_exposure_level(project) == ExposureLevel.EXTERNAL

        # Test isolated
        project.settings = {"exposure": "isolated"}
        assert prioritizer._determine_exposure_level(project) == ExposureLevel.ISOLATED

        # Test default
        project.settings = {}
        assert prioritizer._determine_exposure_level(project) == ExposureLevel.INTERNAL

    def test_calculate_business_impact(self, prioritizer, mock_project_context):
        """Test business impact calculation."""
        impact = prioritizer._calculate_business_impact(mock_project_context)

        assert impact >= 0
        assert impact <= 1.0
        # Should be high due to HIGH criticality and SENSITIVE data
        assert impact > 0.7

    def test_calculate_exposure_factor(self, prioritizer, mock_project_context):
        """Test exposure factor calculation."""
        exposure = prioritizer._calculate_exposure_factor(mock_project_context)

        assert exposure >= 0
        assert exposure <= 1.0
        # Should be high due to EXTERNAL exposure
        assert exposure > 0.8

    def test_calculate_compliance_impact(self, prioritizer, mock_project_context):
        """Test compliance impact calculation."""
        impact = prioritizer._calculate_compliance_impact(mock_project_context)

        assert impact >= 0
        assert impact <= 1.0
        # Should be non-zero due to PCI-DSS and SOX frameworks
        assert impact > 0.4

    @pytest.mark.asyncio
    async def test_generate_recommendations(self, prioritizer, mock_vulnerability):
        """Test recommendation generation."""
        # Test critical vulnerability
        recommendations = await prioritizer._generate_recommendations(
            mock_vulnerability, 85, "critical"
        )

        assert len(recommendations) > 0
        assert any("24 hours" in r for r in recommendations)
        assert any("emergency" in r.lower() for r in recommendations)

        # Test low vulnerability
        recommendations = await prioritizer._generate_recommendations(
            mock_vulnerability, 25, "low"
        )

        assert len(recommendations) > 0
        assert any("patch cycle" in r.lower() for r in recommendations)

    @pytest.mark.asyncio
    async def test_create_priority(
        self, prioritizer, mock_project_context, mock_vulnerability
    ):
        """Test creating vulnerability priority object."""
        threat_data = ThreatIntelligenceData(
            vulnerability_id="CVE-2024-0001",
            exploit_available=True,
            exploit_maturity="poc",
        )

        priority = await prioritizer._create_priority(
            vuln_id="CVE-2024-0001",
            project_id="project-123",
            vulnerability=mock_vulnerability,
            project_context=mock_project_context,
            threat_data=threat_data,
            priority_score=85.0,
            component_scores={"cvss": 95, "contextual": 80, "threat": 85, "ai": 82},
            method=PrioritizationMethod.HYBRID,
        )

        assert isinstance(priority, VulnerabilityPriority)
        assert priority.vulnerability_id == "CVE-2024-0001"
        assert priority.project_id == "project-123"
        assert priority.priority_score == 85.0
        assert priority.risk_tier == "critical"
        assert priority.urgency == timedelta(days=1)
        assert priority.prioritization_method == PrioritizationMethod.HYBRID
        assert len(priority.recommended_actions) > 0


class TestVulnerabilityPriority:
    """Test VulnerabilityPriority data class."""

    def test_vulnerability_priority_creation(self):
        """Test creating VulnerabilityPriority."""
        priority = VulnerabilityPriority(
            vulnerability_id="CVE-2024-0001",
            project_id="project-123",
            priority_score=85.0,
            risk_tier="critical",
            urgency=timedelta(days=1),
            cvss_score=95.0,
            contextual_score=80.0,
            threat_intelligence_score=85.0,
            ai_prediction_score=82.0,
            exploitability=0.9,
            business_impact=0.8,
            exposure_level=0.7,
            compliance_impact=0.6,
            time_to_exploitation=timedelta(days=5),
            risk_trend=RiskTrend.INCREASING,
            trend_confidence=0.85,
            prioritization_method=PrioritizationMethod.HYBRID,
            confidence=0.9,
            recommended_actions=["Patch immediately"],
            alternative_packages=["package-v2.0"],
        )

        assert priority.vulnerability_id == "CVE-2024-0001"
        assert priority.project_id == "project-123"
        assert priority.priority_score == 85.0
        assert priority.risk_tier == "critical"
        assert priority.urgency.days == 1
        assert priority.exploitability == 0.9
        assert priority.risk_trend == RiskTrend.INCREASING
        assert priority.prioritization_method == PrioritizationMethod.HYBRID
        assert len(priority.recommended_actions) == 1
        assert len(priority.alternative_packages) == 1


class TestThreatIntelligenceData:
    """Test ThreatIntelligenceData data class."""

    def test_threat_intelligence_data_creation(self):
        """Test creating ThreatIntelligenceData."""
        threat_data = ThreatIntelligenceData(
            vulnerability_id="CVE-2024-0001",
            exploit_available=True,
            exploit_maturity="weaponized",
            active_exploitation=True,
            threat_actors=["APT-28"],
            attack_patterns=["remote_code_execution"],
            dark_web_mentions=5,
            github_exploits=10,
            first_seen=datetime.utcnow() - timedelta(days=30),
            last_seen=datetime.utcnow(),
            exploitation_trend=RiskTrend.INCREASING,
            industry_targeting=["technology", "finance"],
            geography_focus=["US", "EU"],
            malware_associations=["ransomware"],
        )

        assert threat_data.vulnerability_id == "CVE-2024-0001"
        assert threat_data.exploit_available is True
        assert threat_data.exploit_maturity == "weaponized"
        assert threat_data.active_exploitation is True
        assert threat_data.threat_actors == ["APT-28"]
        assert threat_data.dark_web_mentions == 5
        assert threat_data.github_exploits == 10
        assert threat_data.exploitation_trend == RiskTrend.INCREASING
        assert isinstance(threat_data.first_seen, datetime)
        assert isinstance(threat_data.last_seen, datetime)


class TestIntegration:
    """Integration tests for the AI security service."""

    @pytest.mark.asyncio
    async def test_end_to_end_prioritization(self):
        """Test end-to-end vulnerability prioritization."""
        prioritizer = VulnerabilityPrioritizer()

        # Mock all external dependencies
        with patch.object(
            prioritizer,
            "_get_project_vulnerabilities",
            return_value=["CVE-2024-0001", "CVE-2024-0002"],
        ):
            with patch.object(prioritizer, "_get_project_context") as mock_context:
                mock_context.return_value = {
                    "project": MagicMock(id="project-123"),
                    "asset_criticality": AssetCriticality.HIGH,
                    "data_sensitivity": DataSensitivity.SENSITIVE,
                    "exposure_level": ExposureLevel.EXTERNAL,
                }

                with patch.object(
                    prioritizer.threat_aggregator,
                    "gather_threat_intelligence",
                    return_value={
                        "CVE-2024-0001": ThreatIntelligenceData(exploit_available=True),
                        "CVE-2024-0002": ThreatIntelligenceData(
                            exploit_available=False
                        ),
                    },
                ):
                    with patch.object(
                        prioritizer, "_get_vulnerability_details"
                    ) as mock_vuln:
                        mock_vuln.side_effect = [
                            {
                                "id": "CVE-2024-0001",
                                "cvss_score": 9.5,
                                "description": "Remote code execution",
                            },
                            {
                                "id": "CVE-2024-0002",
                                "cvss_score": 5.5,
                                "description": "Information disclosure",
                            },
                        ]

                        priorities = await prioritizer.prioritize_vulnerabilities(
                            project_id="project-123",
                            method=PrioritizationMethod.HYBRID,
                        )

                        assert len(priorities) == 2
                        # CVE-2024-0001 should be higher priority due to higher CVSS and exploit available
                        assert priorities[0].vulnerability_id == "CVE-2024-0001"
                        assert (
                            priorities[0].priority_score > priorities[1].priority_score
                        )
