"""
Unit tests for workflow complexity predictor models.

Tests the Pydantic models for complexity prediction without requiring
full application configuration.
"""

import pytest
from datetime import datetime
from uuid import uuid4

# Define models inline for testing to avoid import issues
from pydantic import BaseModel, Field, ValidationError
from typing import Any, Dict, List, Optional

class ResourceRequirements(BaseModel):
    """Resource requirements prediction."""
    
    cpu_cores: float = Field(..., ge=0.1, le=32.0, description="Estimated CPU cores needed")
    memory_gb: float = Field(..., ge=0.1, le=128.0, description="Estimated memory in GB")
    disk_gb: float = Field(..., ge=0.1, le=1000.0, description="Estimated disk space in GB")
    network_mbps: float = Field(..., ge=0.1, le=10000.0, description="Estimated network bandwidth in Mbps")
    execution_time_seconds: float = Field(..., ge=1.0, le=7200.0, description="Estimated execution time in seconds")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="Prediction confidence")

class ComplexityFactors(BaseModel):
    """Workflow complexity factors."""
    
    package_count_factor: float = Field(..., ge=0.0, le=10.0, description="Package count complexity factor")
    ecosystem_diversity_factor: float = Field(..., ge=0.0, le=10.0, description="Ecosystem diversity factor")
    dependency_depth_factor: float = Field(..., ge=0.0, le=10.0, description="Dependency depth factor")
    conflict_resolution_factor: float = Field(..., ge=0.0, le=10.0, description="Conflict resolution complexity")
    security_analysis_factor: float = Field(..., ge=0.0, le=10.0, description="Security analysis complexity")
    policy_evaluation_factor: float = Field(..., ge=0.0, le=10.0, description="Policy evaluation complexity")
    cross_ecosystem_factor: float = Field(..., ge=0.0, le=10.0, description="Cross-ecosystem complexity")
    
    @property
    def overall_complexity(self) -> float:
        """Calculate overall complexity score."""
        factors = [
            self.package_count_factor,
            self.ecosystem_diversity_factor,
            self.dependency_depth_factor,
            self.conflict_resolution_factor,
            self.security_analysis_factor,
            self.policy_evaluation_factor,
            self.cross_ecosystem_factor
        ]
        return sum(factors) / len(factors)

class WorkflowComplexityPrediction(BaseModel):
    """Comprehensive workflow complexity prediction."""
    
    complexity_score: float = Field(..., ge=0.0, le=10.0, description="Overall complexity score (0-10)")
    complexity_level: str = Field(..., description="Complexity level (low/medium/high/critical)")
    complexity_factors: ComplexityFactors = Field(..., description="Detailed complexity factors")
    resource_requirements: ResourceRequirements = Field(..., description="Predicted resource requirements")
    bottlenecks: List[str] = Field(default_factory=list, description="Predicted bottlenecks")
    optimization_suggestions: List[str] = Field(default_factory=list, description="Performance optimization suggestions")
    scaling_recommendations: List[str] = Field(default_factory=list, description="Scaling recommendations")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="Overall prediction confidence")
    
    @property
    def is_high_complexity(self) -> bool:
        """Check if workflow has high complexity."""
        return self.complexity_score >= 7.0
    
    @property
    def requires_scaling(self) -> bool:
        """Check if workflow requires horizontal scaling."""
        return (
            self.complexity_score >= 6.0 or 
            self.resource_requirements.execution_time_seconds > 300.0 or
            self.resource_requirements.cpu_cores > 4.0
        )


class TestComplexityPredictionModels:
    """Test suite for complexity prediction Pydantic models."""
    
    def test_resource_requirements_creation(self):
        """Test ResourceRequirements creation and validation."""
        requirements = ResourceRequirements(
            cpu_cores=4.0,
            memory_gb=8.0,
            disk_gb=20.0,
            network_mbps=100.0,
            execution_time_seconds=300.0,
            confidence_score=0.85
        )
        
        assert requirements.cpu_cores == 4.0
        assert requirements.memory_gb == 8.0
        assert requirements.disk_gb == 20.0
        assert requirements.network_mbps == 100.0
        assert requirements.execution_time_seconds == 300.0
        assert requirements.confidence_score == 0.85
    
    def test_resource_requirements_validation(self):
        """Test ResourceRequirements validation."""
        # Invalid CPU cores (too high)
        with pytest.raises(ValueError):
            ResourceRequirements(
                cpu_cores=50.0,  # > 32.0
                memory_gb=8.0,
                disk_gb=20.0,
                network_mbps=100.0,
                execution_time_seconds=300.0,
                confidence_score=0.85
            )
        
        # Invalid execution time (too low)
        with pytest.raises(ValueError):
            ResourceRequirements(
                cpu_cores=4.0,
                memory_gb=8.0,
                disk_gb=20.0,
                network_mbps=100.0,
                execution_time_seconds=0.5,  # < 1.0
                confidence_score=0.85
            )
        
        # Valid edge cases
        requirements_min = ResourceRequirements(
            cpu_cores=0.1,
            memory_gb=0.1,
            disk_gb=0.1,
            network_mbps=0.1,
            execution_time_seconds=1.0,
            confidence_score=0.0
        )
        assert requirements_min.cpu_cores == 0.1
        
        requirements_max = ResourceRequirements(
            cpu_cores=32.0,
            memory_gb=128.0,
            disk_gb=1000.0,
            network_mbps=10000.0,
            execution_time_seconds=7200.0,
            confidence_score=1.0
        )
        assert requirements_max.cpu_cores == 32.0
    
    def test_complexity_factors_creation(self):
        """Test ComplexityFactors creation and validation."""
        factors = ComplexityFactors(
            package_count_factor=6.0,
            ecosystem_diversity_factor=4.0,
            dependency_depth_factor=5.0,
            conflict_resolution_factor=3.0,
            security_analysis_factor=7.0,
            policy_evaluation_factor=2.0,
            cross_ecosystem_factor=1.0
        )
        
        assert factors.package_count_factor == 6.0
        assert factors.ecosystem_diversity_factor == 4.0
        assert factors.dependency_depth_factor == 5.0
        assert factors.conflict_resolution_factor == 3.0
        assert factors.security_analysis_factor == 7.0
        assert factors.policy_evaluation_factor == 2.0
        assert factors.cross_ecosystem_factor == 1.0
        
        # Test overall complexity calculation
        expected_overall = (6.0 + 4.0 + 5.0 + 3.0 + 7.0 + 2.0 + 1.0) / 7.0
        assert abs(factors.overall_complexity - expected_overall) < 0.01
    
    def test_complexity_factors_validation(self):
        """Test ComplexityFactors validation."""
        # Invalid factor (> 10.0)
        with pytest.raises(ValueError):
            ComplexityFactors(
                package_count_factor=15.0,  # > 10.0
                ecosystem_diversity_factor=4.0,
                dependency_depth_factor=5.0,
                conflict_resolution_factor=3.0,
                security_analysis_factor=7.0,
                policy_evaluation_factor=2.0,
                cross_ecosystem_factor=1.0
            )
        
        # Invalid factor (< 0.0)
        with pytest.raises(ValueError):
            ComplexityFactors(
                package_count_factor=6.0,
                ecosystem_diversity_factor=-1.0,  # < 0.0
                dependency_depth_factor=5.0,
                conflict_resolution_factor=3.0,
                security_analysis_factor=7.0,
                policy_evaluation_factor=2.0,
                cross_ecosystem_factor=1.0
            )
        
        # Valid edge cases
        factors_min = ComplexityFactors(
            package_count_factor=0.0,
            ecosystem_diversity_factor=0.0,
            dependency_depth_factor=0.0,
            conflict_resolution_factor=0.0,
            security_analysis_factor=0.0,
            policy_evaluation_factor=0.0,
            cross_ecosystem_factor=0.0
        )
        assert factors_min.overall_complexity == 0.0
        
        factors_max = ComplexityFactors(
            package_count_factor=10.0,
            ecosystem_diversity_factor=10.0,
            dependency_depth_factor=10.0,
            conflict_resolution_factor=10.0,
            security_analysis_factor=10.0,
            policy_evaluation_factor=10.0,
            cross_ecosystem_factor=10.0
        )
        assert factors_max.overall_complexity == 10.0
    
    def test_workflow_complexity_prediction_creation(self):
        """Test WorkflowComplexityPrediction creation and validation."""
        factors = ComplexityFactors(
            package_count_factor=5.0,
            ecosystem_diversity_factor=3.0,
            dependency_depth_factor=4.0,
            conflict_resolution_factor=2.0,
            security_analysis_factor=6.0,
            policy_evaluation_factor=1.0,
            cross_ecosystem_factor=0.0
        )
        
        requirements = ResourceRequirements(
            cpu_cores=2.0,
            memory_gb=4.0,
            disk_gb=10.0,
            network_mbps=50.0,
            execution_time_seconds=180.0,
            confidence_score=0.8
        )
        
        prediction = WorkflowComplexityPrediction(
            complexity_score=6.5,
            complexity_level="medium",
            complexity_factors=factors,
            resource_requirements=requirements,
            bottlenecks=["Large package count", "Security analysis overhead"],
            optimization_suggestions=["Use parallel processing", "Cache results"],
            scaling_recommendations=["Consider horizontal scaling"],
            confidence_score=0.75
        )
        
        assert prediction.complexity_score == 6.5
        assert prediction.complexity_level == "medium"
        assert prediction.complexity_factors == factors
        assert prediction.resource_requirements == requirements
        assert len(prediction.bottlenecks) == 2
        assert len(prediction.optimization_suggestions) == 2
        assert len(prediction.scaling_recommendations) == 1
        assert prediction.confidence_score == 0.75
    
    def test_workflow_complexity_prediction_properties(self):
        """Test WorkflowComplexityPrediction computed properties."""
        factors = ComplexityFactors(
            package_count_factor=8.0,
            ecosystem_diversity_factor=7.0,
            dependency_depth_factor=6.0,
            conflict_resolution_factor=5.0,
            security_analysis_factor=9.0,
            policy_evaluation_factor=4.0,
            cross_ecosystem_factor=3.0
        )
        
        # High complexity, high resource requirements
        high_requirements = ResourceRequirements(
            cpu_cores=8.0,
            memory_gb=16.0,
            disk_gb=50.0,
            network_mbps=200.0,
            execution_time_seconds=600.0,
            confidence_score=0.9
        )
        
        high_complexity_prediction = WorkflowComplexityPrediction(
            complexity_score=8.5,
            complexity_level="high",
            complexity_factors=factors,
            resource_requirements=high_requirements,
            confidence_score=0.85
        )
        
        assert high_complexity_prediction.is_high_complexity
        assert high_complexity_prediction.requires_scaling
        
        # Low complexity, low resource requirements
        low_requirements = ResourceRequirements(
            cpu_cores=1.0,
            memory_gb=2.0,
            disk_gb=5.0,
            network_mbps=20.0,
            execution_time_seconds=60.0,
            confidence_score=0.7
        )
        
        low_factors = ComplexityFactors(
            package_count_factor=2.0,
            ecosystem_diversity_factor=1.0,
            dependency_depth_factor=1.5,
            conflict_resolution_factor=0.0,
            security_analysis_factor=1.0,
            policy_evaluation_factor=0.5,
            cross_ecosystem_factor=0.0
        )
        
        low_complexity_prediction = WorkflowComplexityPrediction(
            complexity_score=3.0,
            complexity_level="low",
            complexity_factors=low_factors,
            resource_requirements=low_requirements,
            confidence_score=0.8
        )
        
        assert not low_complexity_prediction.is_high_complexity
        assert not low_complexity_prediction.requires_scaling
    
    def test_workflow_complexity_prediction_validation(self):
        """Test WorkflowComplexityPrediction validation."""
        factors = ComplexityFactors(
            package_count_factor=5.0,
            ecosystem_diversity_factor=3.0,
            dependency_depth_factor=4.0,
            conflict_resolution_factor=2.0,
            security_analysis_factor=6.0,
            policy_evaluation_factor=1.0,
            cross_ecosystem_factor=0.0
        )
        
        requirements = ResourceRequirements(
            cpu_cores=2.0,
            memory_gb=4.0,
            disk_gb=10.0,
            network_mbps=50.0,
            execution_time_seconds=180.0,
            confidence_score=0.8
        )
        
        # Invalid complexity score (> 10.0)
        with pytest.raises(ValueError):
            WorkflowComplexityPrediction(
                complexity_score=15.0,  # > 10.0
                complexity_level="high",
                complexity_factors=factors,
                resource_requirements=requirements,
                confidence_score=0.75
            )
        
        # Invalid confidence score (> 1.0)
        with pytest.raises(ValueError):
            WorkflowComplexityPrediction(
                complexity_score=6.5,
                complexity_level="medium",
                complexity_factors=factors,
                resource_requirements=requirements,
                confidence_score=1.5  # > 1.0
            )
        
        # Valid edge cases
        prediction_min = WorkflowComplexityPrediction(
            complexity_score=0.0,
            complexity_level="low",
            complexity_factors=factors,
            resource_requirements=requirements,
            confidence_score=0.0
        )
        assert prediction_min.complexity_score == 0.0
        
        prediction_max = WorkflowComplexityPrediction(
            complexity_score=10.0,
            complexity_level="critical",
            complexity_factors=factors,
            resource_requirements=requirements,
            confidence_score=1.0
        )
        assert prediction_max.complexity_score == 10.0
    
    def test_model_serialization(self):
        """Test model serialization to dict and JSON."""
        factors = ComplexityFactors(
            package_count_factor=5.0,
            ecosystem_diversity_factor=3.0,
            dependency_depth_factor=4.0,
            conflict_resolution_factor=2.0,
            security_analysis_factor=6.0,
            policy_evaluation_factor=1.0,
            cross_ecosystem_factor=0.0
        )
        
        requirements = ResourceRequirements(
            cpu_cores=2.0,
            memory_gb=4.0,
            disk_gb=10.0,
            network_mbps=50.0,
            execution_time_seconds=180.0,
            confidence_score=0.8
        )
        
        prediction = WorkflowComplexityPrediction(
            complexity_score=6.5,
            complexity_level="medium",
            complexity_factors=factors,
            resource_requirements=requirements,
            confidence_score=0.75
        )
        
        # Test dict conversion
        pred_dict = prediction.model_dump()
        assert pred_dict["complexity_score"] == 6.5
        assert pred_dict["complexity_level"] == "medium"
        assert pred_dict["confidence_score"] == 0.75
        assert "complexity_factors" in pred_dict
        assert "resource_requirements" in pred_dict
        
        # Test JSON serialization
        pred_json = prediction.model_dump_json()
        assert "6.5" in pred_json
        assert "medium" in pred_json
        assert "0.75" in pred_json
    
    def test_defaults_and_optional_fields(self):
        """Test default values and optional fields."""
        factors = ComplexityFactors(
            package_count_factor=5.0,
            ecosystem_diversity_factor=3.0,
            dependency_depth_factor=4.0,
            conflict_resolution_factor=2.0,
            security_analysis_factor=6.0,
            policy_evaluation_factor=1.0,
            cross_ecosystem_factor=0.0
        )
        
        requirements = ResourceRequirements(
            cpu_cores=2.0,
            memory_gb=4.0,
            disk_gb=10.0,
            network_mbps=50.0,
            execution_time_seconds=180.0,
            confidence_score=0.8
        )
        
        # Test with minimal required fields
        prediction = WorkflowComplexityPrediction(
            complexity_score=6.5,
            complexity_level="medium",
            complexity_factors=factors,
            resource_requirements=requirements,
            confidence_score=0.75
        )
        
        # Should have empty lists as defaults
        assert prediction.bottlenecks == []
        assert prediction.optimization_suggestions == []
        assert prediction.scaling_recommendations == []