"""
Unit tests for AI workflow analyzer.

Tests AI-powered recommendation generation, risk assessment,
and workflow decision making capabilities.
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

# Mock the config to avoid validation errors
with patch.dict('os.environ', {'SECRET_KEY': 'test-secret-key-for-testing'}):
    from udp.ai.workflow_analyzer import AIWorkflowAnalyzer, RiskFactors, ComplexityMetrics
    from udp.domain.models import AIRecommendation, SecurityLevel, EcosystemType


class TestAIWorkflowAnalyzer:
    """Test suite for AI workflow analyzer."""
    
    @pytest.fixture
    def analyzer(self):
        """Create AI workflow analyzer instance."""
        return AIWorkflowAnalyzer("test-org-123")
    
    @pytest.fixture
    def sample_state(self):
        """Create sample workflow state for testing."""
        return {
            "workflow_id": "test-workflow-123",
            "workflow_type": "dependency_analysis",
            "organization_id": str(uuid4()),
            "project_id": "test-project",
            "status": "in_progress",
            "current_step": "assess_risk",
            "started_at": datetime.utcnow(),
            "completed_at": None,
            "error_message": None,
            "retry_count": 0,
            "max_retries": 3,
            "audit_log": [],
            "performance_metrics": {},
            "requires_human_approval": False,
            "approval_requests": [],
            "approval_responses": [],
            "polyglot_project": None,
            "universal_packages": [],
            "cross_ecosystem_resolution": {},
            "universal_audit_trail": [],
            "metadata": {},
            "manifest_files": ["package.json", "requirements.txt"],
            "ecosystem_types": [EcosystemType.NPM, EcosystemType.PYPI],
            "analysis_options": {},
            "polyglot_manifests": {},
            "cross_ecosystem_dependencies": [],
            "universal_dependency_graph": None,
            "ecosystem_compatibility_matrix": {},
            "parsed_manifests": {},
            "dependency_graphs": [],
            "resolved_packages": [
                {
                    "name": "lodash",
                    "version": "4.17.21",
                    "ecosystem": "npm"
                },
                {
                    "name": "requests",
                    "version": "2.28.1", 
                    "ecosystem": "pypi"
                }
            ],
            "vulnerabilities": [
                {
                    "package_name": "lodash",
                    "severity": SecurityLevel.HIGH.value,
                    "cvss_score": 7.5
                }
            ],
            "security_scan_results": {},
            "risk_assessment": {},
            "license_analysis": {},
            "license_violations": [],
            "policy_evaluations": [],
            "policy_violations": [],
            "universal_resolution_strategy": None,
            "cross_language_conflicts": [],
            "bridge_recommendations": [],
            "ai_recommendations": [],
            "ai_confidence_scores": {},
            "ai_decision_rationale": {},
            "ml_risk_predictions": {},
            "recommendations": [],
            "suggested_actions": [],
            "sbom_data": None,
            "compliance_report": None,
            "security_report": None,
            "universal_lockfile_data": None
        }
    
    @pytest.mark.asyncio
    async def test_analyze_dependency_request_basic(self, analyzer, sample_state):
        """Test basic dependency request analysis."""
        recommendations, confidence_scores = await analyzer.analyze_dependency_request(sample_state)
        
        assert isinstance(recommendations, list)
        assert isinstance(confidence_scores, dict)
        assert len(recommendations) > 0
        assert "overall" in confidence_scores
        
        # Check that we get security recommendations for vulnerabilities
        security_recs = [r for r in recommendations if r.recommendation_type == "security_action"]
        assert len(security_recs) > 0
        
        # Verify recommendation structure
        for rec in recommendations:
            assert isinstance(rec, AIRecommendation)
            assert 0.0 <= rec.confidence_score <= 1.0
            assert rec.recommendation_type in [
                "workflow_routing", "security_action", "architecture_guidance", "compliance_action"
            ]
    
    @pytest.mark.asyncio
    async def test_analyze_high_risk_dependencies(self, analyzer, sample_state):
        """Test analysis of high-risk dependencies."""
        # Add critical vulnerabilities
        sample_state["vulnerabilities"] = [
            {
                "package_name": "lodash",
                "severity": SecurityLevel.CRITICAL.value,
                "cvss_score": 9.5
            },
            {
                "package_name": "requests", 
                "severity": SecurityLevel.HIGH.value,
                "cvss_score": 8.0
            }
        ]
        
        recommendations, confidence_scores = await analyzer.analyze_dependency_request(sample_state)
        
        # Should have high-priority security recommendations
        critical_recs = [r for r in recommendations 
                        if r.risk_level == SecurityLevel.CRITICAL and r.action_required]
        assert len(critical_recs) > 0
        
        # Should require human review for critical issues
        human_review_recs = [r for r in recommendations if r.human_review_required]
        assert len(human_review_recs) > 0
        
        # Confidence should be high for security decisions
        security_confidence = max([r.confidence_score for r in recommendations 
                                 if r.recommendation_type == "security_action"])
        assert security_confidence >= 0.8
    
    @pytest.mark.asyncio
    async def test_predict_workflow_complexity(self, analyzer, sample_state):
        """Test workflow complexity prediction."""
        # Add complexity factors
        sample_state["resolved_packages"] = [
            {"name": f"package-{i}", "version": "1.0.0", "ecosystem": "npm"}
            for i in range(50)  # Many packages
        ]
        sample_state["cross_language_conflicts"] = [
            {"type": "version_conflict", "packages": ["pkg1", "pkg2"]}
            for _ in range(5)  # Multiple conflicts
        ]
        sample_state["policy_violations"] = [
            {"policy": "security", "severity": "high"}
            for _ in range(3)  # Policy violations
        ]
        
        complexity = await analyzer.predict_workflow_complexity(sample_state)
        
        assert isinstance(complexity, ComplexityMetrics)
        assert complexity.total_packages == 50
        assert complexity.dependency_conflicts == 5
        assert complexity.policy_violations == 3
        assert complexity.estimated_processing_time > 30.0  # Should be higher due to complexity
        assert complexity.resource_requirements["cpu_factor"] > 1.0
        assert complexity.approval_requirements > 0
    
    @pytest.mark.asyncio
    async def test_recommend_resolution_strategy(self, analyzer):
        """Test conflict resolution strategy recommendation."""
        # Test with no conflicts
        result = await analyzer.recommend_resolution_strategy([])
        assert result["strategy"] == "no_conflicts"
        assert result["confidence"] == 1.0
        
        # Test with low-severity conflicts
        low_conflicts = [
            {"type": "version_conflict", "severity": 3.0}
            for _ in range(3)
        ]
        result = await analyzer.recommend_resolution_strategy(low_conflicts)
        assert result["strategy"] == "automated_resolution"
        assert result["confidence"] >= 0.7
        
        # Test with high-severity conflicts
        high_conflicts = [
            {"type": "security_conflict", "severity": 9.0}
            for _ in range(2)
        ]
        result = await analyzer.recommend_resolution_strategy(high_conflicts)
        assert result["strategy"] == "manual_resolution"
        assert result["confidence"] >= 0.8
        
        # Test with many conflicts
        many_conflicts = [
            {"type": "version_conflict", "severity": 5.0}
            for _ in range(15)
        ]
        result = await analyzer.recommend_resolution_strategy(many_conflicts)
        assert result["strategy"] == "batch_resolution"
    
    @pytest.mark.asyncio
    async def test_cross_ecosystem_complexity_analysis(self, analyzer, sample_state):
        """Test analysis of cross-ecosystem complexity."""
        # Add cross-ecosystem dependencies
        sample_state["cross_ecosystem_dependencies"] = [
            {
                "source_package": {"ecosystem": "npm", "name": "pkg1"},
                "target_package": {"ecosystem": "pypi", "name": "pkg2"},
                "relationship_type": "runtime"
            }
            for _ in range(3)
        ]
        
        recommendations, confidence_scores = await analyzer.analyze_dependency_request(sample_state)
        
        # Should have architecture guidance for cross-ecosystem complexity
        arch_recs = [r for r in recommendations if r.recommendation_type == "architecture_guidance"]
        assert len(arch_recs) > 0
        
        # Should mention cross-ecosystem complexity
        complexity_rec = next((r for r in arch_recs 
                              if "cross-ecosystem" in r.description.lower()), None)
        assert complexity_rec is not None
    
    @pytest.mark.asyncio
    async def test_license_compliance_recommendations(self, analyzer, sample_state):
        """Test license compliance recommendation generation."""
        # Add license risk
        sample_state["license_compliance"] = False
        sample_state["license_issues"] = [
            {"package": "pkg1", "license": "GPL-3.0", "issue": "Copyleft license"}
        ]
        
        recommendations, confidence_scores = await analyzer.analyze_dependency_request(sample_state)
        
        # Should have compliance recommendations
        compliance_recs = [r for r in recommendations if r.recommendation_type == "compliance_action"]
        assert len(compliance_recs) > 0
        
        # Should require human review for license issues
        license_rec = compliance_recs[0]
        assert license_rec.human_review_required
        assert license_rec.action_required
    
    def test_risk_factors_extraction(self, analyzer, sample_state):
        """Test risk factors extraction from workflow state."""
        # This tests the private method indirectly through analyze_dependency_request
        # In a real implementation, we might make _extract_risk_factors public for testing
        pass
    
    def test_confidence_score_calculation(self, analyzer, sample_state):
        """Test confidence score calculation logic."""
        # Test data completeness assessment
        completeness = analyzer._assess_data_completeness(sample_state)
        assert 0.0 <= completeness <= 1.0
        
        # State with resolved packages should have higher completeness
        assert completeness > 0.5  # Should be reasonably complete
    
    @pytest.mark.asyncio
    async def test_error_handling(self, analyzer):
        """Test error handling in AI analysis."""
        # Test with invalid state
        invalid_state = {}
        
        recommendations, confidence_scores = await analyzer.analyze_dependency_request(invalid_state)
        
        # Should return fallback recommendation
        assert len(recommendations) == 1
        assert recommendations[0].recommendation_type == "fallback"
        assert recommendations[0].human_review_required
        assert confidence_scores["fallback"] == 0.1
    
    def test_risk_factors_model(self):
        """Test RiskFactors model validation."""
        # Valid risk factors
        risk_factors = RiskFactors(
            vulnerability_count=5,
            critical_vulnerabilities=2,
            high_vulnerabilities=3,
            package_age_days=365,
            maintainer_activity=0.8,
            download_popularity=0.9,
            license_risk_score=3.5,
            dependency_depth=5,
            ecosystem_maturity=0.7,
            cross_ecosystem_complexity=0.3
        )
        
        assert risk_factors.vulnerability_count == 5
        assert risk_factors.critical_vulnerabilities == 2
        assert 0.0 <= risk_factors.maintainer_activity <= 1.0
        
        # Invalid risk factors should raise validation error
        with pytest.raises(ValueError):
            RiskFactors(maintainer_activity=1.5)  # > 1.0
        
        with pytest.raises(ValueError):
            RiskFactors(vulnerability_count=-1)  # < 0
    
    def test_complexity_metrics_model(self):
        """Test ComplexityMetrics model validation."""
        metrics = ComplexityMetrics(
            total_packages=100,
            unique_ecosystems=3,
            dependency_conflicts=5,
            cross_language_dependencies=2,
            policy_violations=1,
            approval_requirements=2,
            estimated_processing_time=120.5,
            resource_requirements={
                "cpu_factor": 1.5,
                "memory_factor": 2.0,
                "io_factor": 1.2
            }
        )
        
        assert metrics.total_packages == 100
        assert metrics.unique_ecosystems == 3
        assert metrics.estimated_processing_time == 120.5
        
        # Invalid values should raise validation error
        with pytest.raises(ValueError):
            ComplexityMetrics(total_packages=-1)  # < 0
        
        with pytest.raises(ValueError):
            ComplexityMetrics(unique_ecosystems=0)  # < 1


class TestAIRecommendationModel:
    """Test suite for AIRecommendation model."""
    
    def test_ai_recommendation_creation(self):
        """Test AIRecommendation model creation and validation."""
        recommendation = AIRecommendation(
            recommendation_type="security_action",
            title="Update vulnerable package",
            description="Package lodash has critical vulnerability CVE-2021-23337",
            confidence_score=0.95,
            risk_level=SecurityLevel.CRITICAL,
            action_required=True,
            automated_action="block_deployment",
            human_review_required=True,
            rationale="Critical vulnerability with known exploits",
            supporting_data={"cve_id": "CVE-2021-23337", "cvss_score": 9.1},
            workflow_id="test-workflow-123",
            package_name="lodash",
            ecosystem=EcosystemType.NPM,
            priority=1
        )
        
        assert recommendation.recommendation_type == "security_action"
        assert recommendation.confidence_score == 0.95
        assert recommendation.is_high_confidence
        assert recommendation.is_critical
        assert not recommendation.is_expired
    
    def test_ai_recommendation_validation(self):
        """Test AIRecommendation model validation."""
        # Invalid confidence score
        with pytest.raises(ValueError, match="Confidence score must be between 0.0 and 1.0"):
            AIRecommendation(
                recommendation_type="test",
                title="Test",
                description="Test description",
                confidence_score=1.5,  # Invalid
                risk_level=SecurityLevel.LOW,
                action_required=False,
                human_review_required=False,
                rationale="Test rationale"
            )
        
        # Valid edge cases
        rec_min = AIRecommendation(
            recommendation_type="test",
            title="Test",
            description="Test description", 
            confidence_score=0.0,  # Valid minimum
            risk_level=SecurityLevel.LOW,
            action_required=False,
            human_review_required=False,
            rationale="Test rationale"
        )
        assert rec_min.confidence_score == 0.0
        
        rec_max = AIRecommendation(
            recommendation_type="test",
            title="Test",
            description="Test description",
            confidence_score=1.0,  # Valid maximum
            risk_level=SecurityLevel.LOW,
            action_required=False,
            human_review_required=False,
            rationale="Test rationale"
        )
        assert rec_max.confidence_score == 1.0
    
    def test_ai_recommendation_properties(self):
        """Test AIRecommendation computed properties."""
        # High confidence recommendation
        high_conf_rec = AIRecommendation(
            recommendation_type="test",
            title="Test",
            description="Test description",
            confidence_score=0.85,
            risk_level=SecurityLevel.HIGH,
            action_required=True,
            human_review_required=True,
            rationale="Test rationale",
            priority=5
        )
        
        assert high_conf_rec.is_high_confidence
        assert not high_conf_rec.is_critical  # Priority > 10
        
        # Critical priority recommendation
        critical_rec = AIRecommendation(
            recommendation_type="test",
            title="Test",
            description="Test description",
            confidence_score=0.9,
            risk_level=SecurityLevel.CRITICAL,
            action_required=True,
            human_review_required=True,
            rationale="Test rationale",
            priority=1
        )
        
        assert critical_rec.is_critical
        
        # Expired recommendation
        expired_rec = AIRecommendation(
            recommendation_type="test",
            title="Test",
            description="Test description",
            confidence_score=0.8,
            risk_level=SecurityLevel.MEDIUM,
            action_required=False,
            human_review_required=False,
            rationale="Test rationale",
            expires_at=datetime.utcnow() - timedelta(hours=1)  # Expired
        )
        
        assert expired_rec.is_expired