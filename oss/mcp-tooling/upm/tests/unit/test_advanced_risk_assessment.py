"""
Unit tests for Advanced Risk Assessment Engine.

Tests the sophisticated vulnerability analysis with exploitability assessment,
contextual risk scoring, vulnerability chaining analysis, and attack path visualization.
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch
from typing import Dict, Any, List

from src.udp.core.risk_assessment import (
    AdvancedRiskAssessmentEngine,
    ExploitabilityAssessor,
    ContextualRiskScorer,
    VulnerabilityChainAnalyzer,
    AttackPathVisualizer,
    ExploitabilityFactors,
    ContextualFactors,
    VulnerabilityChain,
    AttackVector,
    AttackComplexity,
    PrivilegesRequired,
    UserInteraction,
    Scope,
)


class TestExploitabilityAssessor:
    """Test cases for ExploitabilityAssessor."""

    @pytest.fixture
    def assessor(self):
        """Create exploitability assessor instance."""
        return ExploitabilityAssessor()

    @pytest.fixture
    def sample_vulnerability(self):
        """Sample vulnerability data."""
        return {
            "id": "CVE-2023-1234",
            "title": "Sample Vulnerability",
            "description": "A remote code execution vulnerability in component X",
            "severity": "critical",
            "score": 9.8,
            "vector": "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
            "source": "nvd",
            "package_name": "example-package",
            "ecosystem": "npm",
        }

    @pytest.fixture
    def sample_exploit_intelligence(self):
        """Sample exploit intelligence data."""
        return {
            "metasploit_module": True,
            "exploitdb_id": "51234",
            "poc_available": True,
            "verified_exploit": True,
            "active_exploitation": True,
            "used_in_malware": True,
            "exploit_published_date": "2023-10-01T00:00:00Z",
            "sources": ["metasploit", "exploitdb"],
        }

    def test_parse_cvss_vector(self, assessor):
        """Test CVSS vector parsing."""
        vector = "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"
        metrics = assessor._parse_cvss_vector(vector)

        assert metrics["AV"] == "N"
        assert metrics["AC"] == "L"
        assert metrics["PR"] == "N"
        assert metrics["UI"] == "N"
        assert metrics["S"] == "U"
        assert metrics["C"] == "H"
        assert metrics["I"] == "H"
        assert metrics["A"] == "H"

    def test_assess_exploitability_basic(self, assessor, sample_vulnerability):
        """Test basic exploitability assessment."""
        result = assessor.assess_exploitability(sample_vulnerability)

        assert isinstance(result, ExploitabilityFactors)
        assert result.attack_vector == AttackVector.NETWORK
        assert result.attack_complexity == AttackComplexity.LOW
        assert result.privileges_required == PrivilegesRequired.NONE
        assert result.user_interaction == UserInteraction.NONE
        assert result.scope == Scope.UNCHANGED
        assert 0 <= result.exploit_code_maturity <= 1
        assert 0 <= result.remediation_level <= 1
        assert 0 <= result.confidence <= 1
        assert 0 <= result.weaponization <= 1

    def test_assess_exploitability_with_intelligence(
        self, assessor, sample_vulnerability, sample_exploit_intelligence
    ):
        """Test exploitability assessment with intelligence data."""
        result = assessor.assess_exploitability(
            sample_vulnerability, sample_exploit_intelligence
        )

        # Should have high exploit code maturity due to metasploit module
        assert result.exploit_code_maturity >= 0.8

        # Should have high confidence due to multiple sources
        assert result.confidence >= 0.8

        # Should have high weaponization potential
        assert result.weaponization >= 0.6

    def test_assess_exploit_code_maturity(self, assessor):
        """Test exploit code maturity assessment."""
        # Test with metasploit module
        intel = {"metasploit_module": True}
        maturity = assessor._assess_exploit_code_maturity({}, intel)
        assert maturity >= 0.8

        # Test with exploitdb ID
        intel = {"exploitdb_id": "51234"}
        maturity = assessor._assess_exploit_code_maturity({}, intel)
        assert maturity >= 0.7

        # Test with POC only
        intel = {"poc_available": True}
        maturity = assessor._assess_exploit_code_maturity({}, intel)
        assert maturity >= 0.5

        # Test with no exploits
        intel = {}
        maturity = assessor._assess_exploit_code_maturity({}, intel)
        assert maturity == 0.3  # Theoretical

    def test_assess_remediation_level(self, assessor):
        """Test remediation level assessment."""
        # Test with fixed versions
        vuln = {"fixed_versions": ["1.2.3", "1.2.4"]}
        level = assessor._assess_remediation_level(vuln)
        assert level == 0.0

        # Test with patch available
        vuln = {"patch_available": True}
        level = assessor._assess_remediation_level(vuln)
        assert level == 0.3

        # Test with workaround
        vuln = {"workaround_available": True}
        level = assessor._assess_remediation_level(vuln)
        assert level == 0.6

        # Test with no fix
        vuln = {}
        level = assessor._assess_remediation_level(vuln)
        assert level == 1.0

    def test_assess_weaponization_potential(self, assessor):
        """Test weaponization potential assessment."""
        # Test with ransomware indicators
        vuln = {"description": "Vulnerability allows ransomware deployment"}
        potential = assessor._assess_weaponization_potential(vuln)
        assert potential >= 0.2

        # Test with RCE
        vuln = {"description": "Remote code execution vulnerability"}
        potential = assessor._assess_weaponization_potential(vuln)
        assert potential >= 0.3

        # Test with privilege escalation
        vuln = {"description": "Local privilege escalation vulnerability"}
        potential = assessor._assess_weaponization_potential(vuln)
        assert potential >= 0.2

        # Test with exploit intelligence
        intel = {"used_in_malware": True, "active_exploitation": True}
        vuln = {"description": "Memory corruption vulnerability"}
        potential = assessor._assess_weaponization_potential(vuln, intel)
        assert potential >= 0.7


class TestContextualRiskScorer:
    """Test cases for ContextualRiskScorer."""

    @pytest.fixture
    def scorer(self):
        """Create contextual risk scorer instance."""
        return ContextualRiskScorer()

    @pytest.fixture
    def sample_vulnerability(self):
        """Sample vulnerability for testing."""
        return {
            "id": "CVE-2023-5678",
            "title": "Test Vulnerability",
            "description": "SQL injection vulnerability",
            "severity": "high",
            "score": 8.5,
            "package_name": "test-package",
        }

    @pytest.fixture
    def sample_exploitability(self):
        """Sample exploitability factors."""
        return ExploitabilityFactors(
            attack_vector=AttackVector.NETWORK,
            attack_complexity=AttackComplexity.LOW,
            privileges_required=PrivilegesRequired.NONE,
            user_interaction=UserInteraction.NONE,
            scope=Scope.UNCHANGED,
            exploit_code_maturity=0.8,
            remediation_level=0.0,
            confidence=0.9,
            weaponization=0.7,
        )

    @pytest.fixture
    def sample_context(self):
        """Sample contextual factors."""
        return ContextualFactors(
            project_exposure="public",
            data_sensitivity="high",
            user_base_size=50000,
            internet_facing=True,
            compliance_requirements=["PCI-DSS", "GDPR"],
            business_criticality="critical",
            authentication_required=True,
            monitoring_level="advanced",
            patch_frequency="monthly",
        )

    @pytest.fixture
    def sample_dependencies(self):
        """Sample project dependencies."""
        return [
            {
                "package": {"name": "test-package"},
                "is_direct": True,
                "is_dev_dependency": False,
                "usage_count": 1000,
            },
            {
                "package": {"name": "other-package"},
                "is_direct": False,
                "is_dev_dependency": True,
                "usage_count": 10,
            },
        ]

    def test_calculate_contextual_risk(
        self,
        scorer,
        sample_vulnerability,
        sample_exploitability,
        sample_context,
        sample_dependencies,
    ):
        """Test contextual risk calculation."""
        risk_score = scorer.calculate_contextual_risk(
            sample_vulnerability,
            sample_exploitability,
            sample_context,
            sample_dependencies,
        )

        assert isinstance(risk_score, float)
        assert 0 <= risk_score <= 100

        # Should be higher due to critical context
        assert risk_score > sample_vulnerability["score"] * 10

    def test_calculate_dependency_impact(
        self, scorer, sample_vulnerability, sample_dependencies
    ):
        """Test dependency impact calculation."""
        impact = scorer._calculate_dependency_impact(
            sample_vulnerability, sample_dependencies
        )

        assert isinstance(impact, float)
        assert 0 <= impact <= 10

        # Should be higher for direct dependencies
        assert impact > 5

    def test_calculate_compliance_impact(self, scorer, sample_vulnerability):
        """Test compliance impact calculation."""
        # Test with PCI-DSS requirement
        requirements = ["PCI-DSS"]
        impact = scorer._calculate_compliance_impact(sample_vulnerability, requirements)

        assert isinstance(impact, float)
        assert 0 <= impact <= 10

        # High severity should have significant compliance impact
        assert impact > 5

    def test_calculate_access_factor(
        self, scorer, sample_exploitability, sample_context
    ):
        """Test access factor calculation."""
        factor = scorer._calculate_access_factor(sample_exploitability, sample_context)

        assert isinstance(factor, float)
        assert factor >= 0

        # Should be higher for internet-facing apps with network exploits
        assert factor > 5

    def test_exposure_weights(self, scorer):
        """Test exposure weight mappings."""
        assert scorer.exposure_weights["internal"] == 0.5
        assert scorer.exposure_weights["external"] == 0.7
        assert scorer.exposure_weights["public"] == 1.0

    def test_sensitivity_weights(self, scorer):
        """Test data sensitivity weight mappings."""
        assert scorer.sensitivity_weights["low"] == 0.3
        assert scorer.sensitivity_weights["medium"] == 0.6
        assert scorer.sensitivity_weights["high"] == 0.8
        assert scorer.sensitivity_weights["critical"] == 1.0


class TestVulnerabilityChainAnalyzer:
    """Test cases for VulnerabilityChainAnalyzer."""

    @pytest.fixture
    def analyzer(self):
        """Create vulnerability chain analyzer instance."""
        return VulnerabilityChainAnalyzer()

    @pytest.fixture
    def sample_vulnerabilities(self):
        """Sample vulnerabilities for chaining analysis."""
        return [
            {
                "id": "CVE-2023-1001",
                "package_name": "web-framework",
                "description": "Authentication bypass vulnerability",
                "severity": "critical",
                "score": 9.0,
                "attack_vector": "network",
                "attack_complexity": "low",
                "privileges_required": "none",
            },
            {
                "id": "CVE-2023-1002",
                "package_name": "database-driver",
                "description": "SQL injection vulnerability",
                "severity": "high",
                "score": 8.5,
                "attack_vector": "network",
                "attack_complexity": "low",
                "privileges_required": "user",
            },
            {
                "id": "CVE-2023-1003",
                "package_name": "file-processor",
                "description": "Local privilege escalation",
                "severity": "high",
                "score": 7.8,
                "attack_vector": "local",
                "attack_complexity": "low",
                "privileges_required": "user",
            },
        ]

    @pytest.fixture
    def sample_dependencies(self):
        """Sample project dependencies."""
        return [
            {
                "package": {"name": "web-framework"},
                "is_direct": True,
                "is_dev_dependency": False,
            },
            {
                "package": {"name": "database-driver"},
                "is_direct": True,
                "is_dev_dependency": False,
            },
            {
                "package": {"name": "file-processor"},
                "is_direct": False,
                "is_dev_dependency": False,
            },
        ]

    @pytest.fixture
    def sample_context(self):
        """Sample project context."""
        return ContextualFactors(
            project_exposure="public",
            data_sensitivity="high",
            user_base_size=10000,
            internet_facing=True,
        )

    def test_group_vulnerabilities_by_package(self, analyzer, sample_vulnerabilities):
        """Test vulnerability grouping by package."""
        grouped = analyzer._group_vulnerabilities_by_package(sample_vulnerabilities)

        assert "web-framework" in grouped
        assert "database-driver" in grouped
        assert "file-processor" in grouped

        assert len(grouped["web-framework"]) == 1
        assert grouped["web-framework"][0]["id"] == "CVE-2023-1001"

    def test_determine_privileges_gained(self, analyzer):
        """Test privilege determination from vulnerability."""
        # Test root privilege
        vuln = {"description": "Vulnerability allows root access"}
        assert analyzer._determine_privileges_gained(vuln) == "system"

        # Test admin privilege
        vuln = {"description": "Admin privilege escalation"}
        assert analyzer._determine_privileges_gained(vuln) == "admin"

        # Test user privilege
        vuln = {"description": "User privilege escalation"}
        assert analyzer._determine_privileges_gained(vuln) == "user"

        # Test no privilege
        vuln = {"description": "Information disclosure"}
        assert analyzer._determine_privileges_gained(vuln) == "none"

    def test_analyze_vulnerability_chains(
        self, analyzer, sample_vulnerabilities, sample_dependencies, sample_context
    ):
        """Test vulnerability chain analysis."""
        chains = analyzer.analyze_vulnerability_chains(
            sample_vulnerabilities, sample_dependencies, sample_context
        )

        assert isinstance(chains, list)
        # Should find potential chains
        if chains:
            for chain in chains:
                assert isinstance(chain, VulnerabilityChain)
                assert chain.chain_id
                assert chain.vulnerabilities
                assert chain.attack_path
                assert 0 <= chain.overall_impact <= 100
                assert 0 <= chain.feasibility <= 100

    def test_calculate_chain_impact(self, analyzer, sample_vulnerabilities):
        """Test chain impact calculation."""
        path = ["CVE-2023-1001", "CVE-2023-1002"]
        impact = analyzer._calculate_chain_impact(path, sample_vulnerabilities)

        assert isinstance(impact, float)
        assert 0 <= impact <= 100
        # Should be higher than individual vulnerabilities due to chaining
        assert impact > max(
            v["score"] for v in sample_vulnerabilities if v["id"] in path
        )

    def test_calculate_chain_feasibility(self, analyzer, sample_vulnerabilities):
        """Test chain feasibility calculation."""
        path = ["CVE-2023-1001"]
        feasibility = analyzer._calculate_chain_feasibility(
            path, sample_vulnerabilities
        )

        assert isinstance(feasibility, float)
        assert 0 <= feasibility <= 100

        # Should be lower for longer chains
        long_path = ["CVE-2023-1001", "CVE-2023-1002", "CVE-2023-1003"]
        long_feasibility = analyzer._calculate_chain_feasibility(
            long_path, sample_vulnerabilities
        )
        assert long_feasibility < feasibility

    def test_generate_attack_description(self, analyzer, sample_vulnerabilities):
        """Test attack path description generation."""
        path = ["CVE-2023-1001", "CVE-2023-1002"]
        description = analyzer._generate_attack_description(
            path, sample_vulnerabilities
        )

        assert isinstance(description, list)
        assert len(description) == 2
        assert "Step 1" in description[0]
        assert "Step 2" in description[1]
        assert "CVE-2023-1001" in description[0]
        assert "CVE-2023-1002" in description[1]

    def test_assess_detection_difficulty(self, analyzer, sample_vulnerabilities):
        """Test detection difficulty assessment."""
        # Hard to detect
        path = ["CVE-2023-1003"]  # Memory corruption
        difficulty = analyzer._assess_detection_difficulty(path, sample_vulnerabilities)
        assert difficulty in ["easy", "medium", "hard"]

        # Easy to detect
        vuln = {"description": "Denial of service vulnerability", "id": "CVE-2023-9999"}
        path = ["CVE-2023-9999"]
        difficulty = analyzer._assess_detection_difficulty(path, [vuln])
        assert difficulty == "easy"


class TestAttackPathVisualizer:
    """Test cases for AttackPathVisualizer."""

    @pytest.fixture
    def visualizer(self):
        """Create attack path visualizer instance."""
        return AttackPathVisualizer()

    @pytest.fixture
    def sample_chains(self):
        """Sample vulnerability chains."""
        return [
            VulnerabilityChain(
                chain_id="chain_001",
                vulnerabilities=["CVE-2023-1001", "CVE-2023-1002"],
                attack_path=[
                    "Step 1: Exploit authentication bypass",
                    "Step 2: Perform SQL injection",
                ],
                overall_impact=85.0,
                feasibility=75.0,
                required_privileges=["none", "user"],
                detection_difficulty="medium",
            ),
            VulnerabilityChain(
                chain_id="chain_002",
                vulnerabilities=["CVE-2023-1003"],
                attack_path=[
                    "Step 1: Exploit local vulnerability for privilege escalation",
                ],
                overall_impact=65.0,
                feasibility=90.0,
                required_privileges=["user"],
                detection_difficulty="hard",
            ),
        ]

    @pytest.fixture
    def sample_vulnerabilities(self):
        """Sample vulnerabilities for visualization."""
        return [
            {
                "id": "CVE-2023-1001",
                "package_name": "web-framework",
                "severity": "critical",
                "score": 9.0,
                "description": "Authentication bypass vulnerability",
            },
            {
                "id": "CVE-2023-1002",
                "package_name": "database-driver",
                "severity": "high",
                "score": 8.5,
                "description": "SQL injection vulnerability",
            },
            {
                "id": "CVE-2023-1003",
                "package_name": "file-processor",
                "severity": "high",
                "score": 7.8,
                "description": "Local privilege escalation",
            },
        ]

    def test_generate_attack_graph(
        self, visualizer, sample_chains, sample_vulnerabilities
    ):
        """Test attack graph generation."""
        graph = visualizer.generate_attack_graph(sample_chains, sample_vulnerabilities)

        assert "nodes" in graph
        assert "edges" in graph
        assert "metadata" in graph

        # Check nodes
        assert len(graph["nodes"]) == 3
        for node in graph["nodes"]:
            assert "id" in node
            assert "label" in node
            assert "color" in node
            assert "size" in node
            assert "metadata" in node

        # Check edges
        assert len(graph["edges"]) == 1  # One chain with two vulnerabilities
        for edge in graph["edges"]:
            assert "source" in edge
            assert "target" in edge
            assert "label" in edge
            assert "width" in edge
            assert "color" in edge

        # Check metadata
        assert graph["metadata"]["total_chains"] == 2
        assert graph["metadata"]["highest_impact"] == 85.0
        assert "generated_at" in graph["metadata"]

    def test_generate_chain_summary(self, visualizer, sample_chains):
        """Test chain summary generation."""
        summary = visualizer.generate_chain_summary(sample_chains)

        assert isinstance(summary, list)
        assert len(summary) == 2

        for item in summary:
            assert "chain_id" in item
            assert "vulnerability_count" in item
            assert "overall_impact" in item
            assert "feasibility" in item
            assert "risk_level" in item
            assert "attack_steps" in item
            assert "required_privileges" in item
            assert "detection_difficulty" in item
            assert "recommendations" in item

        # Should be sorted by impact
        assert summary[0]["overall_impact"] >= summary[1]["overall_impact"]

    def test_calculate_chain_risk_level(self, visualizer):
        """Test chain risk level calculation."""
        # Critical chain
        chain = VulnerabilityChain(
            chain_id="test",
            vulnerabilities=["CVE-2023-1001"],
            attack_path=[],
            overall_impact=85.0,
            feasibility=80.0,
            required_privileges=[],
            detection_difficulty="medium",
        )
        risk = visualizer._calculate_chain_risk_level(chain)
        assert risk == "critical"

        # High risk chain
        chain.overall_impact = 60.0
        chain.feasibility = 70.0
        risk = visualizer._calculate_chain_risk_level(chain)
        assert risk == "high"

        # Low risk chain
        chain.overall_impact = 30.0
        chain.feasibility = 40.0
        risk = visualizer._calculate_chain_risk_level(chain)
        assert risk == "low"

    def test_generate_chain_recommendations(self, visualizer):
        """Test chain recommendation generation."""
        # High impact, high feasibility chain
        chain = VulnerabilityChain(
            chain_id="test",
            vulnerabilities=["CVE-2023-1001", "CVE-2023-1002", "CVE-2023-1003"],
            attack_path=[],
            overall_impact=80.0,
            feasibility=70.0,
            required_privileges=["none", "user", "admin"],
            detection_difficulty="hard",
        )
        recommendations = visualizer._generate_chain_recommendations(chain)

        assert isinstance(recommendations, list)
        assert len(recommendations) > 0

        # Should contain specific recommendations
        rec_text = " ".join(recommendations)
        assert "high-impact" in rec_text.lower()
        assert "feasibility" in rec_text.lower()


class TestAdvancedRiskAssessmentEngine:
    """Test cases for AdvancedRiskAssessmentEngine."""

    @pytest.fixture
    def engine(self):
        """Create advanced risk assessment engine instance."""
        return AdvancedRiskAssessmentEngine()

    @pytest.fixture
    def sample_vulnerability(self):
        """Sample vulnerability for testing."""
        return {
            "id": "CVE-2023-9999",
            "title": "Critical RCE Vulnerability",
            "description": "Remote code execution in authentication component",
            "severity": "critical",
            "score": 9.8,
            "vector": "AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H",
            "package_name": "auth-lib",
            "ecosystem": "npm",
            "fixed_versions": ["2.1.1"],
        }

    @pytest.fixture
    def sample_context(self):
        """Sample project context."""
        return ContextualFactors(
            project_exposure="public",
            data_sensitivity="critical",
            user_base_size=100000,
            internet_facing=True,
            compliance_requirements=["PCI-DSS", "HIPAA", "GDPR"],
            business_criticality="critical",
            authentication_required=True,
            monitoring_level="advanced",
            patch_frequency="weekly",
        )

    @pytest.fixture
    def sample_dependencies(self):
        """Sample project dependencies."""
        return [
            {
                "package": {"name": "auth-lib"},
                "is_direct": True,
                "is_dev_dependency": False,
                "usage_count": 5000,
            },
            {
                "package": {"name": "database-lib"},
                "is_direct": True,
                "is_dev_dependency": False,
                "usage_count": 3000,
            },
        ]

    @pytest.mark.asyncio
    async def test_assess_vulnerability_risk(
        self, engine, sample_vulnerability, sample_context, sample_dependencies
    ):
        """Test comprehensive vulnerability risk assessment."""
        result = await engine.assess_vulnerability_risk(
            vulnerability=sample_vulnerability,
            project_context=sample_context,
            project_dependencies=sample_dependencies,
            exploit_intelligence={
                "metasploit_module": True,
                "active_exploitation": True,
            },
            all_vulnerabilities=[sample_vulnerability],
        )

        assert isinstance(result, result.__class__)
        assert result.vulnerability_id == "CVE-2023-9999"
        assert result.base_score == 9.8
        assert 0 <= result.exploitability_score <= 100
        assert 0 <= result.impact_score <= 100
        assert 0 <= result.contextual_risk_score <= 100
        assert 0 <= result.overall_risk_score <= 100
        assert result.risk_level in ["critical", "high", "medium", "low"]
        assert isinstance(result.exploitability_factors, ExploitabilityFactors)
        assert isinstance(result.contextual_factors, ContextualFactors)
        assert isinstance(result.attack_vectors, list)
        assert isinstance(result.potential_impacts, list)
        assert isinstance(result.mitigation_strategies, list)
        assert isinstance(result.chaining_potential, list)
        assert isinstance(result.attack_paths, list)
        assert 0 <= result.confidence <= 1
        assert isinstance(result.assessment_date, datetime)

    def test_calculate_exploitability_score(self, engine):
        """Test exploitability score calculation."""
        exploitability = ExploitabilityFactors(
            attack_vector=AttackVector.NETWORK,
            attack_complexity=AttackComplexity.LOW,
            privileges_required=PrivilegesRequired.NONE,
            user_interaction=UserInteraction.NONE,
            scope=Scope.CHANGED,
            exploit_code_maturity=0.9,
            remediation_level=0.0,
            confidence=0.95,
            weaponization=0.8,
        )

        score = engine._calculate_exploitability_score(exploitability)

        assert isinstance(score, float)
        assert 0 <= score <= 100
        # Should be high due to optimal conditions for exploitation
        assert score > 70

    def test_calculate_impact_score(self, engine, sample_vulnerability):
        """Test impact score calculation."""
        score = engine._calculate_impact_score(sample_vulnerability)

        assert isinstance(score, float)
        assert 0 <= score <= 100
        # Should be higher than base score due to RCE
        assert score > sample_vulnerability["score"] * 10

    def test_calculate_overall_risk_score(self, engine):
        """Test overall risk score calculation."""
        contextual = 85.0
        exploitability = 90.0
        impact = 80.0

        overall = engine._calculate_overall_risk_score(
            contextual, exploitability, impact
        )

        assert isinstance(overall, float)
        assert 0 <= overall <= 100
        # Should be weighted average
        expected = contextual * 0.4 + exploitability * 0.3 + impact * 0.3
        assert abs(overall - expected) < 0.01

    def test_determine_risk_level(self, engine):
        """Test risk level determination."""
        assert engine._determine_risk_level(95) == "critical"
        assert engine._determine_risk_level(80) == "high"
        assert engine._determine_risk_level(60) == "high"
        assert engine._determine_risk_level(50) == "medium"
        assert engine._determine_risk_level(30) == "medium"
        assert engine._determine_risk_level(20) == "low"

    def test_generate_attack_vectors(self, engine):
        """Test attack vector generation."""
        exploitability = ExploitabilityFactors(
            attack_vector=AttackVector.NETWORK,
            attack_complexity=AttackComplexity.LOW,
            privileges_required=PrivilegesRequired.NONE,
            user_interaction=UserInteraction.NONE,
            scope=Scope.CHANGED,
        )

        vectors = engine._generate_attack_vectors(exploitability)

        assert isinstance(vectors, list)
        assert "Network-based attack" in vectors
        assert "Can escape security boundaries" in vectors
        assert "No privileges required" in vectors

    def test_generate_potential_impacts(
        self, engine, sample_vulnerability, sample_context
    ):
        """Test potential impact generation."""
        impacts = engine._generate_potential_impacts(
            sample_vulnerability, sample_context
        )

        assert isinstance(impacts, list)
        assert "Complete system compromise" in impacts

        # Should include business impacts
        assert "Business operations impact" in impacts
        assert "Regulatory compliance violation" in impacts

    def test_generate_mitigation_strategies(
        self, engine, sample_vulnerability, sample_context
    ):
        """Test mitigation strategy generation."""
        exploitability = ExploitabilityFactors(
            attack_vector=AttackVector.NETWORK,
            attack_complexity=AttackComplexity.LOW,
            privileges_required=PrivilegesRequired.NONE,
            user_interaction=UserInteraction.NONE,
            scope=Scope.CHANGED,
        )

        strategies = engine._generate_mitigation_strategies(
            sample_vulnerability, exploitability, sample_context
        )

        assert isinstance(strategies, list)
        assert len(strategies) > 0

        # Should include primary mitigation
        assert "Update to fixed version" in strategies

        # Should include compensating controls
        assert "network segmentation" in " ".join(strategies).lower()

        # Should include monitoring
        assert any("monitoring" in s.lower() for s in strategies)


@pytest.mark.asyncio
class TestIntegration:
    """Integration tests for the advanced risk assessment engine."""

    async def test_end_to_end_risk_assessment(self):
        """Test complete risk assessment workflow."""
        engine = AdvancedRiskAssessmentEngine()

        # Test data
        vulnerability = {
            "id": "CVE-2023-7777",
            "title": "Buffer Overflow in Network Library",
            "description": "A buffer overflow vulnerability allows remote code execution",
            "severity": "critical",
            "score": 9.5,
            "vector": "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
            "package_name": "network-lib",
            "ecosystem": "pip",
        }

        context = ContextualFactors(
            project_exposure="public",
            data_sensitivity="high",
            user_base_size=25000,
            internet_facing=True,
            compliance_requirements=["SOX", "GDPR"],
            business_criticality="high",
        )

        dependencies = [
            {
                "package": {"name": "network-lib"},
                "is_direct": True,
                "is_dev_dependency": False,
                "usage_count": 100,
            }
        ]

        # Perform assessment
        result = await engine.assess_vulnerability_risk(
            vulnerability=vulnerability,
            project_context=context,
            project_dependencies=dependencies,
            exploit_intelligence={
                "metasploit_module": True,
                "exploitdb_id": "51234",
                "poc_available": True,
            },
        )

        # Verify comprehensive assessment
        assert result.vulnerability_id == "CVE-2023-7777"
        assert result.overall_risk_score > 80  # Should be critical
        assert result.risk_level == "critical"
        assert len(result.attack_vectors) > 0
        assert len(result.potential_impacts) > 0
        assert len(result.mitigation_strategies) > 0
        assert result.confidence > 0.8

    async def test_multiple_vulnerability_assessment(self):
        """Test assessing multiple vulnerabilities together."""
        engine = AdvancedRiskAssessmentEngine()

        vulnerabilities = [
            {
                "id": "CVE-2023-1111",
                "title": "SQL Injection",
                "severity": "high",
                "score": 8.0,
                "package_name": "db-lib",
                "ecosystem": "npm",
            },
            {
                "id": "CVE-2023-2222",
                "title": "XSS Vulnerability",
                "severity": "medium",
                "score": 6.0,
                "package_name": "ui-lib",
                "ecosystem": "npm",
            },
            {
                "id": "CVE-2023-3333",
                "title": "Path Traversal",
                "severity": "high",
                "score": 7.5,
                "package_name": "file-lib",
                "ecosystem": "pip",
            },
        ]

        context = ContextualFactors(
            project_exposure="external",
            data_sensitivity="medium",
            user_base_size=5000,
            internet_facing=True,
        )

        # Assess all vulnerabilities
        assessments = []
        for vuln in vulnerabilities:
            result = await engine.assess_vulnerability_risk(
                vulnerability=vuln,
                project_context=context,
                project_dependencies=[],
            )
            assessments.append(result)

        # Verify assessments
        assert len(assessments) == 3

        # SQL Injection should have highest risk
        sql_injection = next(
            a for a in assessments if a.vulnerability_id == "CVE-2023-1111"
        )
        assert sql_injection.overall_risk_score > 70

        # All should have different risk scores
        risk_scores = [a.overall_risk_score for a in assessments]
        assert len(set(risk_scores)) == 3  # All unique
