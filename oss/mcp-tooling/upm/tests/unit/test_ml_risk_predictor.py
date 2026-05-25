"""
Unit tests for ML-based risk predictor.

Tests machine learning risk prediction, dynamic threshold calculation,
and enhanced risk assessment capabilities.
"""

import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from udp.ai.risk_predictor import (
    MLRiskPredictor, 
    SecurityRiskPrediction, 
    MaintenanceRiskPrediction,
    RiskPredictionModel
)
from udp.domain.models import SecurityLevel, EcosystemType


class TestMLRiskPredictor:
    """Test suite for ML risk predictor."""
    
    @pytest.fixture
    def predictor(self):
        """Create ML risk predictor instance."""
        return MLRiskPredictor("test-org-123")
    
    @pytest.fixture
    def sample_state(self):
        """Create sample workflow state for testing."""
        return {
            "workflow_id": "test-workflow-123",
            "organization_id": str(uuid4()),
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
            "cross_ecosystem_dependencies": [],
            "cross_language_conflicts": [],
            "policy_violations": []
        }
    
    @pytest.mark.asyncio
    async def test_predict_security_risk_basic(self, predictor, sample_state):
        """Test basic security risk prediction."""
        prediction = await predictor.predict_security_risk(sample_state)
        
        assert isinstance(prediction, SecurityRiskPrediction)
        assert 0.0 <= prediction.overall_risk_score <= 10.0
        assert 0.0 <= prediction.confidence_score <= 1.0
        assert prediction.predicted_severity in [
            SecurityLevel.LOW, SecurityLevel.MEDIUM, SecurityLevel.HIGH, SecurityLevel.CRITICAL
        ]
        assert isinstance(prediction.risk_factors, list)
        assert isinstance(prediction.mitigation_suggestions, list)
    
    @pytest.mark.asyncio
    async def test_predict_security_risk_high_vulnerability(self, predictor, sample_state):
        """Test security risk prediction with high vulnerabilities."""
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
        
        prediction = await predictor.predict_security_risk(sample_state)
        
        # Should have high risk score due to critical vulnerabilities
        assert prediction.overall_risk_score >= 6.0
        assert prediction.vulnerability_risk >= 5.0
        assert prediction.predicted_severity in [SecurityLevel.HIGH, SecurityLevel.CRITICAL]
        
        # Should identify vulnerability-related risk factors
        risk_factors_text = " ".join(prediction.risk_factors).lower()
        assert "critical" in risk_factors_text or "vulnerabilities" in risk_factors_text
        
        # Should suggest vulnerability mitigations
        mitigations_text = " ".join(prediction.mitigation_suggestions).lower()
        assert "update" in mitigations_text or "patch" in mitigations_text
    
    @pytest.mark.asyncio
    async def test_predict_security_risk_cross_ecosystem(self, predictor, sample_state):
        """Test security risk prediction with cross-ecosystem complexity."""
        # Add cross-ecosystem dependencies
        sample_state["cross_ecosystem_dependencies"] = [
            {
                "source_package": {"ecosystem": "npm", "name": "pkg1"},
                "target_package": {"ecosystem": "pypi", "name": "pkg2"}
            }
        ]
        
        prediction = await predictor.predict_security_risk(sample_state)
        
        # Should account for cross-ecosystem complexity
        assert prediction.exposure_risk > 0.0
        
        # Should mention cross-ecosystem risks
        risk_factors_text = " ".join(prediction.risk_factors).lower()
        mitigations_text = " ".join(prediction.mitigation_suggestions).lower()
        
        cross_ecosystem_mentioned = (
            "cross-ecosystem" in risk_factors_text or 
            "cross-ecosystem" in mitigations_text or
            "ecosystem" in risk_factors_text
        )
        assert cross_ecosystem_mentioned
    
    @pytest.mark.asyncio
    async def test_predict_maintenance_risk_basic(self, predictor, sample_state):
        """Test basic maintenance risk prediction."""
        prediction = await predictor.predict_maintenance_risk(sample_state)
        
        assert isinstance(prediction, MaintenanceRiskPrediction)
        assert 0.0 <= prediction.maintenance_score <= 10.0
        assert 0.0 <= prediction.confidence_score <= 1.0
        assert 0.0 <= prediction.update_frequency_risk <= 10.0
        assert 0.0 <= prediction.breaking_change_risk <= 10.0
        assert 0.0 <= prediction.dependency_churn_risk <= 10.0
        assert 0.0 <= prediction.community_health_score <= 10.0
        assert isinstance(prediction.maintenance_recommendations, list)
    
    @pytest.mark.asyncio
    async def test_predict_maintenance_risk_high_complexity(self, predictor, sample_state):
        """Test maintenance risk prediction with high complexity."""
        # Add many packages and cross-language conflicts
        sample_state["resolved_packages"] = [
            {"name": f"package-{i}", "version": "1.0.0", "ecosystem": "npm"}
            for i in range(100)  # Many packages
        ]
        sample_state["cross_language_conflicts"] = [
            {"type": "version_conflict", "packages": ["pkg1", "pkg2"]}
            for _ in range(5)  # Multiple conflicts
        ]
        sample_state["polyglot_complexity"] = True
        
        prediction = await predictor.predict_maintenance_risk(sample_state)
        
        # Should have higher maintenance risk
        assert prediction.maintenance_score >= 4.0
        assert prediction.dependency_churn_risk > 0.0
        
        # Should provide relevant recommendations
        recommendations_text = " ".join(prediction.maintenance_recommendations).lower()
        assert any(keyword in recommendations_text for keyword in [
            "dependency", "reduce", "consolidate", "standardize", "automated"
        ])
    
    @pytest.mark.asyncio
    async def test_calculate_dynamic_thresholds_basic(self, predictor, sample_state):
        """Test basic dynamic threshold calculation."""
        base_thresholds = {
            "low": (0.0, 3.0),
            "medium": (3.0, 6.0),
            "high": (6.0, 8.0),
            "critical": (8.0, 10.0)
        }
        
        adjusted_thresholds = await predictor.calculate_dynamic_thresholds(
            sample_state, base_thresholds
        )
        
        assert isinstance(adjusted_thresholds, dict)
        assert len(adjusted_thresholds) == len(base_thresholds)
        
        # Check that all thresholds are valid
        for level, (min_score, max_score) in adjusted_thresholds.items():
            assert 0.0 <= min_score < max_score <= 10.0
            assert level in base_thresholds
    
    @pytest.mark.asyncio
    async def test_calculate_dynamic_thresholds_high_risk_context(self, predictor, sample_state):
        """Test dynamic threshold calculation with high-risk context."""
        # Add high-risk context
        sample_state["vulnerabilities"] = [
            {"severity": SecurityLevel.CRITICAL.value, "cvss_score": 9.0}
        ]
        sample_state["policy_violations"] = [
            {"policy": "security", "severity": "high"}
        ]
        
        base_thresholds = {
            "low": (0.0, 3.0),
            "medium": (3.0, 6.0),
            "high": (6.0, 8.0),
            "critical": (8.0, 10.0)
        }
        
        adjusted_thresholds = await predictor.calculate_dynamic_thresholds(
            sample_state, base_thresholds
        )
        
        # Thresholds should be adjusted for higher sensitivity
        # (exact adjustment depends on implementation, but should be reasonable)
        for level in base_thresholds:
            base_min, base_max = base_thresholds[level]
            adj_min, adj_max = adjusted_thresholds[level]
            
            # Adjusted thresholds should be within reasonable bounds
            assert 0.0 <= adj_min <= 10.0
            assert 0.0 <= adj_max <= 10.0
            assert adj_min < adj_max
    
    @pytest.mark.asyncio
    async def test_error_handling_security_prediction(self, predictor):
        """Test error handling in security risk prediction."""
        # Test with invalid/empty state
        invalid_state = {}
        
        prediction = await predictor.predict_security_risk(invalid_state)
        
        # Should return conservative high-risk prediction
        assert isinstance(prediction, SecurityRiskPrediction)
        assert prediction.overall_risk_score >= 6.0  # Conservative estimate
        assert prediction.confidence_score <= 0.5  # Low confidence
        assert prediction.predicted_severity in [SecurityLevel.HIGH, SecurityLevel.CRITICAL]
    
    @pytest.mark.asyncio
    async def test_error_handling_maintenance_prediction(self, predictor):
        """Test error handling in maintenance risk prediction."""
        # Test with invalid/empty state
        invalid_state = {}
        
        prediction = await predictor.predict_maintenance_risk(invalid_state)
        
        # Should return conservative prediction
        assert isinstance(prediction, MaintenanceRiskPrediction)
        assert prediction.maintenance_score >= 4.0  # Conservative estimate
        assert prediction.confidence_score <= 0.5  # Low confidence
    
    @pytest.mark.asyncio
    async def test_error_handling_dynamic_thresholds(self, predictor):
        """Test error handling in dynamic threshold calculation."""
        base_thresholds = {
            "low": (0.0, 3.0),
            "medium": (3.0, 6.0),
            "high": (6.0, 8.0),
            "critical": (8.0, 10.0)
        }
        
        # Test with invalid state
        invalid_state = {}
        
        adjusted_thresholds = await predictor.calculate_dynamic_thresholds(
            invalid_state, base_thresholds
        )
        
        # Should return original thresholds on error
        assert adjusted_thresholds == base_thresholds
    
    def test_risk_prediction_model_validation(self):
        """Test RiskPredictionModel validation."""
        # Valid model
        model = RiskPredictionModel(
            model_name="TestModel",
            model_version="1.0",
            confidence_threshold=0.8,
            feature_weights={"feature1": 0.5, "feature2": 0.5}
        )
        
        assert model.model_name == "TestModel"
        assert model.confidence_threshold == 0.8
        
        # Invalid confidence threshold
        with pytest.raises(ValueError):
            RiskPredictionModel(
                model_name="TestModel",
                confidence_threshold=1.5  # > 1.0
            )
    
    def test_security_risk_prediction_validation(self):
        """Test SecurityRiskPrediction model validation."""
        # Valid prediction
        prediction = SecurityRiskPrediction(
            overall_risk_score=7.5,
            vulnerability_risk=8.0,
            exposure_risk=6.0,
            maintenance_risk=5.0,
            ecosystem_risk=4.0,
            confidence_score=0.85,
            predicted_severity=SecurityLevel.HIGH
        )
        
        assert prediction.overall_risk_score == 7.5
        assert prediction.predicted_severity == SecurityLevel.HIGH
        
        # Invalid risk score
        with pytest.raises(ValueError):
            SecurityRiskPrediction(
                overall_risk_score=15.0,  # > 10.0
                vulnerability_risk=8.0,
                exposure_risk=6.0,
                maintenance_risk=5.0,
                ecosystem_risk=4.0,
                confidence_score=0.85,
                predicted_severity=SecurityLevel.HIGH
            )
    
    def test_maintenance_risk_prediction_validation(self):
        """Test MaintenanceRiskPrediction model validation."""
        # Valid prediction
        prediction = MaintenanceRiskPrediction(
            maintenance_score=6.5,
            update_frequency_risk=7.0,
            breaking_change_risk=5.0,
            dependency_churn_risk=4.0,
            community_health_score=8.0,
            confidence_score=0.75
        )
        
        assert prediction.maintenance_score == 6.5
        assert prediction.community_health_score == 8.0
        
        # Invalid confidence score
        with pytest.raises(ValueError):
            MaintenanceRiskPrediction(
                maintenance_score=6.5,
                update_frequency_risk=7.0,
                breaking_change_risk=5.0,
                dependency_churn_risk=4.0,
                community_health_score=8.0,
                confidence_score=1.5  # > 1.0
            )


class TestRiskPredictionIntegration:
    """Integration tests for risk prediction with workflow."""
    
    @pytest.fixture
    def predictor(self):
        """Create ML risk predictor instance."""
        return MLRiskPredictor("test-org-123")
    
    @pytest.mark.asyncio
    async def test_comprehensive_risk_analysis(self, predictor):
        """Test comprehensive risk analysis workflow."""
        # Complex state with multiple risk factors
        complex_state = {
            "workflow_id": "test-workflow-complex",
            "organization_id": str(uuid4()),
            "resolved_packages": [
                {"name": f"pkg-{i}", "version": "1.0.0", "ecosystem": "npm"}
                for i in range(50)
            ] + [
                {"name": f"py-pkg-{i}", "version": "2.0.0", "ecosystem": "pypi"}
                for i in range(30)
            ],
            "vulnerabilities": [
                {
                    "package_name": "pkg-1",
                    "severity": SecurityLevel.CRITICAL.value,
                    "cvss_score": 9.2
                },
                {
                    "package_name": "pkg-2",
                    "severity": SecurityLevel.HIGH.value,
                    "cvss_score": 7.8
                }
            ],
            "cross_ecosystem_dependencies": [
                {
                    "source_package": {"ecosystem": "npm", "name": "pkg-1"},
                    "target_package": {"ecosystem": "pypi", "name": "py-pkg-1"}
                }
            ],
            "cross_language_conflicts": [
                {"type": "version_conflict", "packages": ["pkg-1", "py-pkg-1"]}
            ],
            "policy_violations": [
                {"policy": "security", "severity": "high"},
                {"policy": "license", "severity": "medium"}
            ]
        }
        
        # Run all predictions
        security_prediction = await predictor.predict_security_risk(complex_state)
        maintenance_prediction = await predictor.predict_maintenance_risk(complex_state)
        
        base_thresholds = {
            "low": (0.0, 3.0),
            "medium": (3.0, 6.0), 
            "high": (6.0, 8.0),
            "critical": (8.0, 10.0)
        }
        dynamic_thresholds = await predictor.calculate_dynamic_thresholds(
            complex_state, base_thresholds
        )
        
        # Verify comprehensive analysis
        assert security_prediction.overall_risk_score > 5.0  # Should be high due to critical vuln
        assert maintenance_prediction.maintenance_score > 4.0  # Should be elevated due to complexity
        assert len(security_prediction.risk_factors) > 0
        assert len(security_prediction.mitigation_suggestions) > 0
        assert len(maintenance_prediction.maintenance_recommendations) > 0
        
        # Dynamic thresholds should be adjusted
        assert dynamic_thresholds != base_thresholds
        
        # Confidence should be reasonable
        assert security_prediction.confidence_score > 0.5
        assert maintenance_prediction.confidence_score > 0.5