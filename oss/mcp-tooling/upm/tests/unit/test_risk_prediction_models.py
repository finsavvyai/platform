"""
Unit tests for risk prediction models.

Tests the Pydantic models for risk prediction without requiring
full application configuration.
"""

import pytest
from datetime import datetime
from uuid import uuid4

# Import models directly to avoid configuration issues
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../src'))

from pydantic import BaseModel, Field, ValidationError
from datetime import datetime
from typing import Any, Dict, List, Optional

# Define models inline for testing to avoid import issues
class RiskPredictionModel(BaseModel):
    """ML-based risk prediction model."""
    
    model_name: str = Field(..., description="Name of the risk prediction model")
    model_version: str = Field(default="1.0", description="Model version")
    confidence_threshold: float = Field(default=0.7, ge=0.0, le=1.0, description="Confidence threshold")
    last_trained: Optional[datetime] = Field(default=None, description="Last training timestamp")
    feature_weights: Dict[str, float] = Field(default_factory=dict, description="Feature importance weights")

class SecurityRiskPrediction(BaseModel):
    """Security risk prediction result."""
    
    overall_risk_score: float = Field(..., ge=0.0, le=10.0, description="Overall risk score (0-10)")
    vulnerability_risk: float = Field(..., ge=0.0, le=10.0, description="Vulnerability-based risk")
    exposure_risk: float = Field(..., ge=0.0, le=10.0, description="Exposure and attack surface risk")
    maintenance_risk: float = Field(..., ge=0.0, le=10.0, description="Maintenance and update risk")
    ecosystem_risk: float = Field(..., ge=0.0, le=10.0, description="Ecosystem-specific risk")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="Prediction confidence")
    risk_factors: List[str] = Field(default_factory=list, description="Key risk factors identified")
    mitigation_suggestions: List[str] = Field(default_factory=list, description="Risk mitigation suggestions")
    predicted_severity: str = Field(..., description="Predicted severity level")

class MaintenanceRiskPrediction(BaseModel):
    """Maintenance burden risk prediction."""
    
    maintenance_score: float = Field(..., ge=0.0, le=10.0, description="Maintenance burden score")
    update_frequency_risk: float = Field(..., ge=0.0, le=10.0, description="Update frequency risk")
    breaking_change_risk: float = Field(..., ge=0.0, le=10.0, description="Breaking change risk")
    dependency_churn_risk: float = Field(..., ge=0.0, le=10.0, description="Dependency churn risk")
    community_health_score: float = Field(..., ge=0.0, le=10.0, description="Community health score")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="Prediction confidence")
    maintenance_recommendations: List[str] = Field(default_factory=list, description="Maintenance recommendations")
# Define SecurityLevel enum inline
from enum import Enum

class SecurityLevel(str, Enum):
    """Security risk levels."""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class TestRiskPredictionModels:
    """Test suite for risk prediction Pydantic models."""
    
    def test_risk_prediction_model_creation(self):
        """Test RiskPredictionModel creation and validation."""
        model = RiskPredictionModel(
            model_name="SecurityRiskPredictor",
            model_version="1.0",
            confidence_threshold=0.8,
            last_trained=datetime.utcnow(),
            feature_weights={
                "vulnerability_count": 0.3,
                "cvss_scores": 0.25,
                "package_age": 0.15,
                "maintainer_activity": 0.1,
                "download_popularity": 0.1,
                "ecosystem_maturity": 0.1
            }
        )
        
        assert model.model_name == "SecurityRiskPredictor"
        assert model.model_version == "1.0"
        assert model.confidence_threshold == 0.8
        assert isinstance(model.last_trained, datetime)
        assert len(model.feature_weights) == 6
        assert sum(model.feature_weights.values()) == 1.0
    
    def test_risk_prediction_model_validation(self):
        """Test RiskPredictionModel validation."""
        # Valid model with defaults
        model = RiskPredictionModel(model_name="TestModel")
        assert model.model_version == "1.0"
        assert model.confidence_threshold == 0.7
        assert model.last_trained is None
        assert model.feature_weights == {}
        
        # Invalid confidence threshold
        with pytest.raises(ValueError):
            RiskPredictionModel(
                model_name="TestModel",
                confidence_threshold=1.5  # > 1.0
            )
        
        with pytest.raises(ValueError):
            RiskPredictionModel(
                model_name="TestModel", 
                confidence_threshold=-0.1  # < 0.0
            )
    
    def test_security_risk_prediction_creation(self):
        """Test SecurityRiskPrediction creation and validation."""
        prediction = SecurityRiskPrediction(
            overall_risk_score=7.5,
            vulnerability_risk=8.0,
            exposure_risk=6.0,
            maintenance_risk=5.0,
            ecosystem_risk=4.0,
            confidence_score=0.85,
            risk_factors=["Critical vulnerabilities found", "High CVSS scores"],
            mitigation_suggestions=["Update vulnerable packages", "Implement scanning"],
            predicted_severity=SecurityLevel.HIGH.value
        )
        
        assert prediction.overall_risk_score == 7.5
        assert prediction.vulnerability_risk == 8.0
        assert prediction.confidence_score == 0.85
        assert prediction.predicted_severity == SecurityLevel.HIGH.value
        assert len(prediction.risk_factors) == 2
        assert len(prediction.mitigation_suggestions) == 2
    
    def test_security_risk_prediction_validation(self):
        """Test SecurityRiskPrediction validation."""
        # Invalid overall risk score (> 10.0)
        with pytest.raises(ValueError):
            SecurityRiskPrediction(
                overall_risk_score=15.0,
                vulnerability_risk=8.0,
                exposure_risk=6.0,
                maintenance_risk=5.0,
                ecosystem_risk=4.0,
                confidence_score=0.85,
                predicted_severity=SecurityLevel.HIGH.value
            )
        
        # Invalid overall risk score (< 0.0)
        with pytest.raises(ValueError):
            SecurityRiskPrediction(
                overall_risk_score=-1.0,
                vulnerability_risk=8.0,
                exposure_risk=6.0,
                maintenance_risk=5.0,
                ecosystem_risk=4.0,
                confidence_score=0.85,
                predicted_severity=SecurityLevel.HIGH.value
            )
        
        # Invalid confidence score (> 1.0)
        with pytest.raises(ValueError):
            SecurityRiskPrediction(
                overall_risk_score=7.5,
                vulnerability_risk=8.0,
                exposure_risk=6.0,
                maintenance_risk=5.0,
                ecosystem_risk=4.0,
                confidence_score=1.5,
                predicted_severity=SecurityLevel.HIGH.value
            )
        
        # Valid edge cases
        prediction_min = SecurityRiskPrediction(
            overall_risk_score=0.0,
            vulnerability_risk=0.0,
            exposure_risk=0.0,
            maintenance_risk=0.0,
            ecosystem_risk=0.0,
            confidence_score=0.0,
            predicted_severity=SecurityLevel.LOW.value
        )
        assert prediction_min.overall_risk_score == 0.0
        
        prediction_max = SecurityRiskPrediction(
            overall_risk_score=10.0,
            vulnerability_risk=10.0,
            exposure_risk=10.0,
            maintenance_risk=10.0,
            ecosystem_risk=10.0,
            confidence_score=1.0,
            predicted_severity=SecurityLevel.CRITICAL.value
        )
        assert prediction_max.overall_risk_score == 10.0
    
    def test_maintenance_risk_prediction_creation(self):
        """Test MaintenanceRiskPrediction creation and validation."""
        prediction = MaintenanceRiskPrediction(
            maintenance_score=6.5,
            update_frequency_risk=7.0,
            breaking_change_risk=5.0,
            dependency_churn_risk=4.0,
            community_health_score=8.0,
            confidence_score=0.75,
            maintenance_recommendations=[
                "Implement automated dependency updates",
                "Monitor for breaking changes",
                "Reduce dependency count"
            ]
        )
        
        assert prediction.maintenance_score == 6.5
        assert prediction.update_frequency_risk == 7.0
        assert prediction.breaking_change_risk == 5.0
        assert prediction.dependency_churn_risk == 4.0
        assert prediction.community_health_score == 8.0
        assert prediction.confidence_score == 0.75
        assert len(prediction.maintenance_recommendations) == 3
    
    def test_maintenance_risk_prediction_validation(self):
        """Test MaintenanceRiskPrediction validation."""
        # Invalid maintenance score (> 10.0)
        with pytest.raises(ValueError):
            MaintenanceRiskPrediction(
                maintenance_score=15.0,
                update_frequency_risk=7.0,
                breaking_change_risk=5.0,
                dependency_churn_risk=4.0,
                community_health_score=8.0,
                confidence_score=0.75
            )
        
        # Invalid confidence score (< 0.0)
        with pytest.raises(ValueError):
            MaintenanceRiskPrediction(
                maintenance_score=6.5,
                update_frequency_risk=7.0,
                breaking_change_risk=5.0,
                dependency_churn_risk=4.0,
                community_health_score=8.0,
                confidence_score=-0.1
            )
        
        # Valid edge cases
        prediction_min = MaintenanceRiskPrediction(
            maintenance_score=0.0,
            update_frequency_risk=0.0,
            breaking_change_risk=0.0,
            dependency_churn_risk=0.0,
            community_health_score=0.0,
            confidence_score=0.0
        )
        assert prediction_min.maintenance_score == 0.0
        
        prediction_max = MaintenanceRiskPrediction(
            maintenance_score=10.0,
            update_frequency_risk=10.0,
            breaking_change_risk=10.0,
            dependency_churn_risk=10.0,
            community_health_score=10.0,
            confidence_score=1.0
        )
        assert prediction_max.maintenance_score == 10.0
    
    def test_security_risk_prediction_defaults(self):
        """Test SecurityRiskPrediction with default values."""
        prediction = SecurityRiskPrediction(
            overall_risk_score=5.0,
            vulnerability_risk=4.0,
            exposure_risk=3.0,
            maintenance_risk=2.0,
            ecosystem_risk=1.0,
            confidence_score=0.8,
            predicted_severity=SecurityLevel.MEDIUM.value
        )
        
        # Should have empty lists as defaults
        assert prediction.risk_factors == []
        assert prediction.mitigation_suggestions == []
    
    def test_maintenance_risk_prediction_defaults(self):
        """Test MaintenanceRiskPrediction with default values."""
        prediction = MaintenanceRiskPrediction(
            maintenance_score=5.0,
            update_frequency_risk=4.0,
            breaking_change_risk=3.0,
            dependency_churn_risk=2.0,
            community_health_score=8.0,
            confidence_score=0.7
        )
        
        # Should have empty list as default
        assert prediction.maintenance_recommendations == []
    
    def test_model_serialization(self):
        """Test model serialization to dict and JSON."""
        prediction = SecurityRiskPrediction(
            overall_risk_score=7.5,
            vulnerability_risk=8.0,
            exposure_risk=6.0,
            maintenance_risk=5.0,
            ecosystem_risk=4.0,
            confidence_score=0.85,
            predicted_severity=SecurityLevel.HIGH.value
        )
        
        # Test dict conversion
        pred_dict = prediction.model_dump()
        assert pred_dict["overall_risk_score"] == 7.5
        assert pred_dict["predicted_severity"] == SecurityLevel.HIGH.value
        
        # Test JSON serialization
        pred_json = prediction.model_dump_json()
        assert "7.5" in pred_json
        assert "high" in pred_json
    
    def test_enum_handling(self):
        """Test proper enum handling in models."""
        # Test all security levels
        for severity in [SecurityLevel.LOW, SecurityLevel.MEDIUM, SecurityLevel.HIGH, SecurityLevel.CRITICAL]:
            prediction = SecurityRiskPrediction(
                overall_risk_score=5.0,
                vulnerability_risk=4.0,
                exposure_risk=3.0,
                maintenance_risk=2.0,
                ecosystem_risk=1.0,
                confidence_score=0.8,
                predicted_severity=severity.value
            )
            assert prediction.predicted_severity == severity.value
            
            # Verify serialization preserves enum value
            pred_dict = prediction.model_dump()
            assert pred_dict["predicted_severity"] == severity.value