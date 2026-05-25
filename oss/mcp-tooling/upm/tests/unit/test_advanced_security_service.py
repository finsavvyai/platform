"""
Unit tests for Advanced Security Service.

Tests the advanced security scanning capabilities including exploitability assessment,
contextual risk scoring, and attack path analysis.
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from uuid import uuid4
from typing import Dict, Any, List

from sqlalchemy.ext.asyncio import AsyncSession

from src.udp.services.advanced_security import AdvancedSecurityService
from src.udp.core.models.vulnerability import Vulnerability, ProjectVulnerability
from src.udp.core.models.project import Project
from src.udp.domain.models import EcosystemType


@pytest.fixture
def mock_db_session():
    """Create mock database session."""
    session = AsyncMock(spec=AsyncSession)
    return session


@pytest.fixture
def advanced_security_service(mock_db_session):
    """Create advanced security service instance."""
    return AdvancedSecurityService(mock_db_session)


@pytest.fixture
def sample_project():
    """Sample project data."""
    return Project(
        id=uuid4(),
        name="Test Project",
        description="Test project for security scanning",
        ecosystem=EcosystemType.NPM,
        metadata_json={
            "language": "javascript",
            "framework": "express",
            "exposure": "public",
            "data_sensitivity": "high",
        },
    )


@pytest.fixture
def sample_vulnerabilities():
    """Sample vulnerability data."""
    return [
        {
            "id": "CVE-2023-1001",
            "title": "Critical RCE in Auth Module",
            "description": "Remote code execution vulnerability allows complete system compromise",
            "severity": "critical",
            "score": 9.8,
            "vector": "AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H",
            "source": "nvd",
            "package_name": "auth-lib",
            "ecosystem": "npm",
            "fixed_versions": ["2.1.1"],
        },
        {
            "id": "CVE-2023-1002",
            "title": "SQL Injection in Database Layer",
            "description": "SQL injection allows unauthorized data access",
            "severity": "high",
            "score": 8.5,
            "vector": "AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N",
            "source": "nvd",
            "package_name": "db-lib",
            "ecosystem": "npm",
            "fixed_versions": ["1.5.2"],
        },
        {
            "id": "CVE-2023-1003",
            "title": "XSS in UI Components",
            "description": "Cross-site scripting vulnerability in user interface",
            "severity": "medium",
            "score": 6.1,
            "vector": "AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N",
            "source": "github",
            "package_name": "ui-lib",
            "ecosystem": "npm",
            "fixed_versions": ["3.0.1"],
        },
    ]


@pytest.fixture
def sample_dependencies():
    """Sample project dependencies."""
    return {
        "dependencies": [
            {
                "id": str(uuid4()),
                "package": {
                    "name": "auth-lib",
                    "version": "2.1.0",
                    "ecosystem": "npm",
                },
                "is_direct": True,
                "is_dev_dependency": False,
                "usage_count": 1000,
            },
            {
                "id": str(uuid4()),
                "package": {
                    "name": "db-lib",
                    "version": "1.5.1",
                    "ecosystem": "npm",
                },
                "is_direct": True,
                "is_dev_dependency": False,
                "usage_count": 500,
            },
            {
                "id": str(uuid4()),
                "package": {
                    "name": "ui-lib",
                    "version": "3.0.0",
                    "ecosystem": "npm",
                },
                "is_direct": False,
                "is_dev_dependency": False,
                "usage_count": 200,
            },
        ],
        "total_dependencies": 3,
    }


@pytest.fixture
def sample_scan_config():
    """Sample scan configuration."""
    return {
        "force_rescan": True,
        "include_attack_paths": True,
        "include_exploitability": True,
        "severity_threshold": "low",
    }


@pytest.fixture
def sample_contextual_factors():
    """Sample contextual factors."""
    return {
        "project_exposure": "public",
        "data_sensitivity": "high",
        "user_base_size": 50000,
        "internet_facing": True,
        "compliance_requirements": ["PCI-DSS", "GDPR", "SOX"],
        "business_criticality": "critical",
        "authentication_required": True,
        "monitoring_level": "advanced",
        "patch_frequency": "weekly",
        "third_party_integrations": ["payment-gateway", "analytics"],
    }


class TestAdvancedSecurityService:
    """Test cases for AdvancedSecurityService."""

    @pytest.mark.asyncio
    async def test_advanced_vulnerability_scan_success(
        self,
        advanced_security_service,
        sample_project,
        sample_vulnerabilities,
        sample_dependencies,
        sample_scan_config,
        sample_contextual_factors,
    ):
        """Test successful advanced vulnerability scan."""
        # Mock dependencies
        mock_project_service = AsyncMock()
        mock_project_service.get.return_value = sample_project

        mock_dependency_service = AsyncMock()
        mock_dependency_service.get_project_dependencies.return_value = (
            sample_dependencies
        )

        mock_base_security = AsyncMock()
        mock_base_security.scan_project_vulnerabilities.return_value = {
            "project_id": str(sample_project.id),
            "scan_id": str(uuid4()),
            "total_dependencies": 3,
            "vulnerabilities": sample_vulnerabilities,
            "summary": {
                "total": 3,
                "critical": 1,
                "high": 1,
                "medium": 1,
                "low": 0,
            },
        }

        advanced_security_service.base_security_service = mock_base_security

        with patch.object(advanced_security_service, "_get_dependency") as mock_get_dep:
            mock_get_dep.side_effect = lambda name: {
                "project_service": mock_project_service,
                "dependency_service": mock_dependency_service,
            }[name]

            # Perform scan
            result = await advanced_security_service.advanced_vulnerability_scan(
                project_id=str(sample_project.id),
                scan_config=sample_scan_config,
                include_attack_paths=True,
                include_exploitability=True,
                contextual_factors=sample_contextual_factors,
            )

            # Verify results
            assert result["project_id"] == str(sample_project.id)
            assert result["scan_type"] == "advanced"
            assert result["total_dependencies"] == 3
            assert "basic_summary" in result
            assert "advanced_statistics" in result
            assert "risk_assessments" in result
            assert "attack_path_analysis" in result
            assert "critical_vulnerabilities" in result
            assert "executive_summary" in result

            # Verify risk assessments
            risk_assessments = result["risk_assessments"]
            assert len(risk_assessments) == 3

            # Critical vulnerability should have highest risk
            critical_vuln = next(
                a for a in risk_assessments if a["vulnerability_id"] == "CVE-2023-1001"
            )
            assert critical_vuln["risk_level"] == "critical"
            assert critical_vuln["overall_risk_score"] > 80

            # Verify executive summary
            exec_summary = result["executive_summary"]
            assert exec_summary["overall_risk_level"] in [
                "critical",
                "high",
                "medium",
                "low",
            ]
            assert exec_summary["immediate_actions_required"] >= 1

    @pytest.mark.asyncio
    async def test_advanced_vulnerability_scan_no_vulnerabilities(
        self,
        advanced_security_service,
        sample_project,
        sample_dependencies,
        sample_scan_config,
    ):
        """Test advanced scan with no vulnerabilities found."""
        # Mock dependencies
        mock_project_service = AsyncMock()
        mock_project_service.get.return_value = sample_project

        mock_dependency_service = AsyncMock()
        mock_dependency_service.get_project_dependencies.return_value = (
            sample_dependencies
        )

        mock_base_security = AsyncMock()
        mock_base_security.scan_project_vulnerabilities.return_value = {
            "project_id": str(sample_project.id),
            "scan_id": str(uuid4()),
            "total_dependencies": 3,
            "vulnerabilities": [],
            "summary": {
                "total": 0,
                "critical": 0,
                "high": 0,
                "medium": 0,
                "low": 0,
            },
        }

        advanced_security_service.base_security_service = mock_base_security

        with patch.object(advanced_security_service, "_get_dependency") as mock_get_dep:
            mock_get_dep.side_effect = lambda name: {
                "project_service": mock_project_service,
                "dependency_service": mock_dependency_service,
            }[name]

            # Perform scan
            result = await advanced_security_service.advanced_vulnerability_scan(
                project_id=str(sample_project.id),
                scan_config=sample_scan_config,
            )

            # Verify results
            assert result["total_dependencies"] == 3
            assert len(result["risk_assessments"]) == 0
            assert result["attack_path_analysis"]["total_attack_paths"] == 0
            assert len(result["critical_vulnerabilities"]) == 0

    @pytest.mark.asyncio
    async def test_advanced_vulnerability_scan_project_not_found(
        self, advanced_security_service
    ):
        """Test advanced scan with non-existent project."""
        project_id = str(uuid4())

        mock_project_service = AsyncMock()
        mock_project_service.get.return_value = None

        with patch.object(advanced_security_service, "_get_dependency") as mock_get_dep:
            mock_get_dep.return_value = mock_project_service

            # Should raise NotFoundError
            with pytest.raises(NotFoundError) as exc_info:
                await advanced_security_service.advanced_vulnerability_scan(
                    project_id=project_id
                )

            assert f"Project {project_id} not found" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_assess_exploitability(
        self, advanced_security_service, sample_vulnerabilities
    ):
        """Test exploitability assessment for a vulnerability."""
        vulnerability = sample_vulnerabilities[0]  # Critical RCE

        additional_intelligence = {
            "metasploit_module": True,
            "exploitdb_id": "51234",
            "verified_exploit": True,
            "active_exploitation": True,
            "used_in_ransomware": True,
        }

        # Mock vulnerability lookup
        mock_vulnerability = Vulnerability(
            id=vulnerability["id"],
            title=vulnerability["title"],
            description=vulnerability["description"],
            severity=vulnerability["severity"],
            score=vulnerability["score"],
            vector=vulnerability["vector"],
            source=vulnerability["source"],
            metadata_json={
                "package_name": vulnerability["package_name"],
                "ecosystem": vulnerability["ecosystem"],
            },
        )

        with patch.object(
            advanced_security_service, "get_vulnerability_by_id"
        ) as mock_get:
            mock_get.return_value = mock_vulnerability

            with patch.object(
                advanced_security_service, "_gather_exploit_intelligence"
            ) as mock_intel:
                mock_intel.return_value = {vulnerability["id"]: additional_intelligence}

                # Perform assessment
                result = await advanced_security_service.assess_exploitability(
                    vulnerability_id=vulnerability["id"],
                    additional_intelligence=additional_intelligence,
                )

                # Verify results
                assert result["vulnerability_id"] == vulnerability["id"]
                assert "exploitability_assessment" in result
                assert "exploitability_score" in result
                assert "exploit_intelligence" in result
                assert "recommendations" in result
                assert "assessment_date" in result

                # Verify exploitability factors
                exploitability = result["exploitability_assessment"]
                assert exploitability["attack_vector"] == "NETWORK"
                assert exploitability["attack_complexity"] == "LOW"
                assert exploitability["privileges_required"] == "NONE"
                assert exploitability["user_interaction"] == "NONE"
                assert exploitability["scope"] == "CHANGED"
                assert exploitability["exploit_code_maturity"] >= 0.8
                assert exploitability["confidence"] >= 0.8

                # Verify score is high for critical vulnerability
                assert result["exploitability_score"] > 70

    @pytest.mark.asyncio
    async def test_assess_exploitability_vulnerability_not_found(
        self, advanced_security_service
    ):
        """Test exploitability assessment for non-existent vulnerability."""
        vulnerability_id = "CVE-2023-9999"

        with patch.object(
            advanced_security_service, "get_vulnerability_by_id"
        ) as mock_get:
            mock_get.return_value = None

            # Should raise NotFoundError
            with pytest.raises(NotFoundError) as exc_info:
                await advanced_security_service.assess_exploitability(
                    vulnerability_id=vulnerability_id
                )

            assert f"Vulnerability {vulnerability_id} not found" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_analyze_attack_paths(
        self,
        advanced_security_service,
        sample_project,
        sample_vulnerabilities,
        sample_dependencies,
    ):
        """Test attack path analysis."""
        # Mock dependencies
        mock_project_service = AsyncMock()
        mock_project_service.get.return_value = sample_project

        mock_dependency_service = AsyncMock()
        mock_dependency_service.get_project_dependencies.return_value = (
            sample_dependencies
        )

        # Mock project vulnerabilities
        mock_vulns = []
        for vuln in sample_vulnerabilities:
            mock_vuln = ProjectVulnerability(
                id=uuid4(),
                project_id=sample_project.id,
                vulnerability_id=vuln["id"],
                status="open",
                risk_score=80.0,
            )
            mock_vuln.vulnerability = Vulnerability(
                id=vuln["id"],
                title=vuln["title"],
                description=vuln["description"],
                severity=vuln["severity"],
                score=vuln["score"],
                package_name=vuln["package_name"],
                metadata_json={
                    "package_name": vuln["package_name"],
                    "ecosystem": vuln["ecosystem"],
                },
            )
            mock_vulns.append(mock_vuln)

        with patch.object(advanced_security_service, "_get_dependency") as mock_get_dep:
            mock_get_dep.return_value = mock_project_service

            with patch.object(
                advanced_security_service, "_get_project_vulnerabilities"
            ) as mock_get_vulns:
                mock_get_vulns.return_value = sample_vulnerabilities

                # Perform analysis
                result = await advanced_security_service.analyze_attack_paths(
                    project_id=str(sample_project.id),
                    max_paths=10,
                    min_impact_threshold=40.0,
                )

                # Verify results
                assert result["project_id"] == str(sample_project.id)
                assert "attack_paths" in result
                assert "attack_graph" in result
                assert "summary" in result
                assert "recommendations" in result
                assert "analysis_date" in result

                # Verify summary statistics
                summary = result["summary"]
                assert "total_paths" in summary
                assert "high_impact_paths" in summary
                assert "critical_paths" in summary
                assert "highest_impact" in summary
                assert "average_impact" in summary

    @pytest.mark.asyncio
    async def test_analyze_attack_paths_no_vulnerabilities(
        self, advanced_security_service, sample_project
    ):
        """Test attack path analysis with no vulnerabilities."""
        # Mock dependencies
        mock_project_service = AsyncMock()
        mock_project_service.get.return_value = sample_project

        with patch.object(advanced_security_service, "_get_dependency") as mock_get_dep:
            mock_get_dep.return_value = mock_project_service

            with patch.object(
                advanced_security_service, "_get_project_vulnerabilities"
            ) as mock_get_vulns:
                mock_get_vulns.return_value = []

                # Perform analysis
                result = await advanced_security_service.analyze_attack_paths(
                    project_id=str(sample_project.id)
                )

                # Verify empty results
                assert result["project_id"] == str(sample_project.id)
                assert len(result["attack_paths"]) == 0
                assert result["summary"]["total_paths"] == 0
                assert result["summary"]["high_impact_paths"] == 0
                assert result["summary"]["critical_paths"] == 0
                assert len(result["recommendations"]) > 0

    @pytest.mark.asyncio
    async def test_contextual_risk_assessment(
        self,
        advanced_security_service,
        sample_vulnerabilities,
        sample_contextual_factors,
    ):
        """Test contextual risk assessment for multiple vulnerabilities."""
        vulnerability_ids = [v["id"] for v in sample_vulnerabilities]

        # Mock vulnerability lookups
        mock_vulnerabilities = []
        for vuln in sample_vulnerabilities:
            mock_vuln = Vulnerability(
                id=vuln["id"],
                title=vuln["title"],
                description=vuln["description"],
                severity=vuln["severity"],
                score=vuln["score"],
                vector=vuln.get("vector"),
                source=vuln["source"],
                metadata_json={
                    "package_name": vuln["package_name"],
                    "ecosystem": vuln["ecosystem"],
                },
            )
            mock_vulnerabilities.append(mock_vuln)

        with patch.object(
            advanced_security_service, "get_vulnerability_by_id"
        ) as mock_get:
            mock_get.side_effect = lambda vuln_id: next(
                (v for v in mock_vulnerabilities if v.id == vuln_id), None
            )

            with patch.object(
                advanced_security_service, "_gather_exploit_intelligence"
            ) as mock_intel:
                mock_intel.return_value = {}

                # Perform assessment
                result = await advanced_security_service.contextual_risk_assessment(
                    vulnerability_ids=vulnerability_ids,
                    project_context=sample_contextual_factors,
                    prioritize_by="overall_risk",
                )

                # Verify results
                assert "contextual_factors" in result
                assert "assessments" in result
                assert "risk_distribution" in result
                assert "recommendations" in result
                assert "assessment_date" in result
                assert result["total_assessed"] == 3

                # Verify contextual factors
                context = result["contextual_factors"]
                assert context["project_exposure"] == "public"
                assert context["data_sensitivity"] == "high"
                assert context["business_criticality"] == "critical"
                assert len(context["compliance_requirements"]) == 3

                # Verify assessments
                assessments = result["assessments"]
                assert len(assessments) == 3

                # Should be sorted by overall risk (critical first)
                critical_assessment = assessments[0]
                assert critical_assessment["vulnerability_id"] == "CVE-2023-1001"
                assert critical_assessment["risk_level"] == "critical"

                # Verify risk distribution
                risk_dist = result["risk_distribution"]
                assert "critical" in risk_dist
                assert "high" in risk_dist
                assert "medium" in risk_dist
                assert "low" in risk_dist
                assert risk_dist["critical"]["count"] == 1
                assert risk_dist["high"]["count"] == 1
                assert risk_dist["medium"]["count"] == 1

    def test_build_contextual_factors(self, advanced_security_service, sample_project):
        """Test building contextual factors."""
        additional_factors = {
            "project_exposure": "external",
            "data_sensitivity": "medium",
            "user_base_size": 10000,
            "custom_field": "should_be_ignored",
        }

        context = advanced_security_service._build_contextual_factors(
            sample_project, additional_factors
        )

        assert context.project_exposure == "external"
        assert context.data_sensitivity == "medium"
        assert context.user_base_size == 10000
        assert context.internet_facing is False  # Default
        assert context.compliance_requirements == []  # Default
        assert context.business_criticality == "low"  # Default

    def test_gather_exploit_intelligence(
        self, advanced_security_service, sample_vulnerabilities
    ):
        """Test exploit intelligence gathering."""
        # Mock threat intelligence service
        mock_threat_service = AsyncMock()
        mock_threat_service.get_exploit_intelligence.return_value = {
            "metasploit_module": True,
            "active_exploitation": True,
        }

        with patch.object(advanced_security_service, "_get_dependency") as mock_get_dep:
            # First call fails (service not available)
            mock_get_dep.side_effect = Exception("Service not available")

            # Should still work with basic analysis
            intelligence = advanced_security_service._gather_exploit_intelligence(
                sample_vulnerabilities
            )

            assert isinstance(intelligence, dict)
            assert len(intelligence) == len(sample_vulnerabilities)

            for vuln in sample_vulnerabilities:
                vuln_id = vuln["id"]
                assert vuln_id in intelligence
                assert "exploit_available" in intelligence[vuln_id]
                assert "poc_available" in intelligence[vuln_id]
                assert "verified_exploit" in intelligence[vuln_id]
                assert "sources" in intelligence[vuln_id]

                # Critical vulnerability should be marked as having exploit
                if vuln["severity"] == "critical":
                    assert intelligence[vuln_id]["exploit_available"] is True

    def test_calculate_advanced_statistics(self, advanced_security_service):
        """Test advanced statistics calculation."""
        from src.udp.core.risk_assessment import (
            RiskAssessmentResult,
            ExploitabilityFactors,
            ContextualFactors,
        )

        # Create mock assessments
        assessments = [
            RiskAssessmentResult(
                vulnerability_id="CVE-2023-1001",
                base_score=9.8,
                exploitability_score=85.0,
                impact_score=95.0,
                contextual_risk_score=90.0,
                overall_risk_score=90.0,
                risk_level="critical",
                exploitability_factors=ExploitabilityFactors(
                    attack_vector="NETWORK",
                    attack_complexity="LOW",
                    privileges_required="NONE",
                    user_interaction="NONE",
                    scope="UNCHANGED",
                ),
                contextual_factors=ContextualFactors(),
                attack_vectors=[],
                potential_impacts=[],
                mitigation_strategies=[],
                chaining_potential=["CVE-2023-1002"],
                attack_paths=[],
                confidence=0.95,
                assessment_date=datetime.utcnow(),
            ),
            RiskAssessmentResult(
                vulnerability_id="CVE-2023-1002",
                base_score=8.5,
                exploitability_score=70.0,
                impact_score=80.0,
                contextual_risk_score=75.0,
                overall_risk_score=75.0,
                risk_level="high",
                exploitability_factors=ExploitabilityFactors(
                    attack_vector="NETWORK",
                    attack_complexity="LOW",
                    privileges_required="LOW",
                    user_interaction="NONE",
                    scope="UNCHANGED",
                ),
                contextual_factors=ContextualFactors(),
                attack_vectors=[],
                potential_impacts=[],
                mitigation_strategies=[],
                chaining_potential=[],
                attack_paths=[],
                confidence=0.85,
                assessment_date=datetime.utcnow(),
            ),
            RiskAssessmentResult(
                vulnerability_id="CVE-2023-1003",
                base_score=6.1,
                exploitability_score=50.0,
                impact_score=60.0,
                contextual_risk_score=55.0,
                overall_risk_score=55.0,
                risk_level="medium",
                exploitability_factors=ExploitabilityFactors(
                    attack_vector="NETWORK",
                    attack_complexity="LOW",
                    privileges_required="NONE",
                    user_interaction="REQUIRED",
                    scope="CHANGED",
                ),
                contextual_factors=ContextualFactors(),
                attack_vectors=[],
                potential_impacts=[],
                mitigation_strategies=[],
                chaining_potential=[],
                attack_paths=[],
                confidence=0.75,
                assessment_date=datetime.utcnow(),
            ),
        ]

        stats = advanced_security_service._calculate_advanced_statistics(assessments)

        assert stats["total_assessed"] == 3
        assert stats["average_overall_risk"] == pytest.approx(73.33, rel=1e-2)
        assert stats["highest_risk_score"] == 90.0

        # Verify risk distribution
        risk_dist = stats["risk_distribution"]
        assert risk_dist["critical"] == 1
        assert risk_dist["high"] == 1
        assert risk_dist["medium"] == 1
        assert risk_dist["low"] == 0

        # Verify exploitability distribution
        exploit_dist = stats["exploitability_distribution"]
        assert exploit_dist["high"] == 2  # critical and high
        assert exploit_dist["medium"] == 1  # medium
        assert exploit_dist["low"] == 0

        # Verify chaining potential
        assert stats["chaining_potential_count"] == 1
        assert stats["chaining_percentage"] == pytest.approx(33.33, rel=1e-2)

    def test_generate_prioritized_actions(self, advanced_security_service):
        """Test prioritized action generation."""
        from src.udp.core.risk_assessment import (
            RiskAssessmentResult,
            ExploitabilityFactors,
            ContextualFactors,
            VulnerabilityChain,
        )

        # Create mock assessments
        assessments = [
            RiskAssessmentResult(
                vulnerability_id="CVE-2023-1001",
                base_score=9.8,
                exploitability_score=95.0,
                impact_score=98.0,
                contextual_risk_score=92.0,
                overall_risk_score=95.0,
                risk_level="critical",
                exploitability_factors=ExploitabilityFactors(
                    attack_vector="NETWORK",
                    attack_complexity="LOW",
                    privileges_required="NONE",
                    user_interaction="NONE",
                    scope="UNCHANGED",
                ),
                contextual_factors=ContextualFactors(),
                attack_vectors=[],
                potential_impacts=["Complete system compromise"],
                mitigation_strategies=["Update to fixed version"],
                chaining_potential=[],
                attack_paths=[],
                confidence=0.98,
                assessment_date=datetime.utcnow(),
            )
        ]

        # Create mock attack chains
        chains = [
            VulnerabilityChain(
                chain_id="chain_001",
                vulnerabilities=["CVE-2023-1001", "CVE-2023-1002"],
                attack_path=["Step 1", "Step 2"],
                overall_impact=90.0,
                feasibility=80.0,
                required_privileges=["none", "user"],
                detection_difficulty="medium",
            )
        ]

        # Create context
        context = ContextualFactors(
            project_exposure="public",
            data_sensitivity="critical",
            internet_facing=True,
            monitoring_level="basic",
        )

        actions = advanced_security_service._generate_prioritized_actions(
            assessments, chains, context
        )

        assert isinstance(actions, list)
        assert len(actions) > 0

        # Should have critical vulnerability action
        critical_actions = [a for a in actions if a["priority"] == "critical"]
        assert len(critical_actions) > 0

        # Should have attack chain action
        chain_actions = [a for a in actions if a["type"] == "attack_chain_break"]
        assert len(chain_actions) > 0

        # Should have infrastructure action for internet-facing
        infra_actions = [a for a in actions if a["type"] == "infrastructure_hardening"]
        assert len(infra_actions) > 0

        # Should have monitoring action
        monitor_actions = [a for a in actions if a["type"] == "monitoring_enhancement"]
        assert len(monitor_actions) > 0

    def test_calculate_compliance_impact(self, advanced_security_service):
        """Test compliance impact calculation."""
        from src.udp.core.risk_assessment import (
            RiskAssessmentResult,
            ExploitabilityFactors,
            ContextualFactors,
        )

        # Create assessment with data exposure
        assessment = RiskAssessmentResult(
            vulnerability_id="CVE-2023-1001",
            base_score=9.8,
            exploitability_score=90.0,
            impact_score=95.0,
            contextual_risk_score=92.0,
            overall_risk_score=92.0,
            risk_level="critical",
            exploitability_factors=ExploitabilityFactors(
                attack_vector="NETWORK",
                attack_complexity="LOW",
                privileges_required="NONE",
                user_interaction="NONE",
                scope="UNCHANGED",
            ),
            contextual_factors=ContextualFactors(),
            attack_vectors=[],
            potential_impacts=[
                "Sensitive data exposure",
                "Personal information disclosure",
                "Financial data access",
            ],
            mitigation_strategies=[],
            chaining_potential=[],
            attack_paths=[],
            confidence=0.95,
            assessment_date=datetime.utcnow(),
        )

        assessments = [assessment]
        requirements = ["PCI-DSS", "GDPR", "HIPAA", "SOX"]

        impact = advanced_security_service._calculate_compliance_impact(
            assessments, requirements
        )

        assert impact["total_requirements"] == 4
        assert impact["affected_requirements"] > 0
        assert 0 <= impact["compliance_score"] <= 100
        assert isinstance(impact["violations"], list)

        # Should affect PCI-DSS due to financial data
        pci_violations = [v for v in impact["violations"] if "PCI" in v["requirement"]]
        assert len(pci_violations) > 0

        # Should affect GDPR due to personal information
        gdpr_violations = [
            v for v in impact["violations"] if "GDPR" in v["requirement"]
        ]
        assert len(ggdpr_violations) > 0

    def test_estimate_remediation_effort(self, advanced_security_service):
        """Test remediation effort estimation."""
        from src.udp.core.risk_assessment import (
            RiskAssessmentResult,
            ExploitabilityFactors,
            ContextualFactors,
        )

        # Test with simple fix
        assessment = RiskAssessmentResult(
            vulnerability_id="CVE-2023-1001",
            mitigation_strategies=["Update to fixed version", "Apply security patch"],
            exploitability_factors=ExploitabilityFactors(
                attack_vector="NETWORK",
                attack_complexity="LOW",
                privileges_required="NONE",
                user_interaction="NONE",
                scope="UNCHANGED",
            ),
            contextual_factors=ContextualFactors(),
            attack_vectors=[],
            potential_impacts=[],
            chaining_potential=[],
            attack_paths=[],
            confidence=0.95,
            assessment_date=datetime.utcnow(),
            base_score=9.8,
            exploitability_score=90.0,
            impact_score=95.0,
            contextual_risk_score=92.0,
            overall_risk_score=92.0,
            risk_level="critical",
        )

        effort = advanced_security_service._estimate_remediation_effort(assessment)
        assert effort == "Low"

        # Test with complex mitigation
        assessment.mitigation_strategies = [
            "Implement network segmentation",
            "Restrict network access with firewalls",
            "Add comprehensive monitoring",
        ]

        effort = advanced_security_service._estimate_remediation_effort(assessment)
        assert effort == "Medium"

    @pytest.mark.asyncio
    async def test_store_advanced_scan_results(self, advanced_security_service):
        """Test storing advanced scan results."""
        project_id = str(uuid4())

        report = {
            "project_id": project_id,
            "scan_type": "advanced",
            "total_dependencies": 10,
            "risk_assessments": [
                {
                    "risk_level": "critical",
                    "overall_risk_score": 95.0,
                },
                {
                    "risk_level": "high",
                    "overall_risk_score": 75.0,
                },
                {
                    "risk_level": "medium",
                    "overall_risk_score": 55.0,
                },
            ],
            "advanced_statistics": {
                "average_overall_risk": 75.0,
            },
            "executive_summary": {
                "overall_risk_level": "high",
            },
        }

        # Mock the _create method
        with patch.object(advanced_security_service, "_create") as mock_create:
            mock_create.return_value = None

            await advanced_security_service._store_advanced_scan_results(
                project_id, report
            )

            # Verify _create was called
            mock_create.assert_called_once()

            # Get the created object
            created_obj = mock_create.call_args[0][0]
            assert created_obj.project_id == UUID(project_id)
            assert created_obj.status == "completed"
            assert created_obj.total_dependencies == 10
            assert created_obj.total_vulnerabilities == 3
            assert created_obj.critical_vulnerabilities == 1
            assert created_obj.high_vulnerabilities == 1
            assert created_obj.medium_vulnerabilities == 1
            assert created_obj.overall_risk_score == 75.0
            assert created_obj.overall_risk_level == "high"
            assert created_obj.scan_results == report


@pytest.mark.asyncio
class TestAdvancedSecurityServiceIntegration:
    """Integration tests for AdvancedSecurityService."""

    async def test_end_to_end_advanced_scan_workflow(self):
        """Test complete advanced scan workflow."""
        # This would test the full integration with real database
        # For now, we'll mock the database components

        mock_db = AsyncMock(spec=AsyncSession)
        service = AdvancedSecurityService(mock_db)

        # Mock all dependencies
        project_id = str(uuid4())

        with patch.multiple(
            service,
            _get_dependency=AsyncMock(),
            base_security_service=AsyncMock(),
            _store_advanced_scan_results=AsyncMock(),
        ):
            # Configure mocks
            mock_project = Mock()
            mock_project.id = UUID(project_id)
            service._get_dependency.return_value.get.return_value = mock_project

            service._get_dependency.return_value.get_project_dependencies.return_value = {
                "dependencies": [],
                "total_dependencies": 0,
            }

            service.base_security_service.scan_project_vulnerabilities.return_value = {
                "project_id": project_id,
                "vulnerabilities": [],
                "summary": {"total": 0},
            }

            # Perform scan
            result = await service.advanced_vulnerability_scan(
                project_id=project_id,
                scan_config={"force_rescan": True},
            )

            # Verify workflow completed
            assert result["project_id"] == project_id
            assert result["scan_type"] == "advanced"

            # Verify storage was called
            service._store_advanced_scan_results.assert_called_once()
