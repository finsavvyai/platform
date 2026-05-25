"""
Unit tests for AI recommendation model.

Tests the AIRecommendation Pydantic model validation and properties.
"""

import pytest
from datetime import datetime, timedelta
from uuid import uuid4

from udp.domain.models import AIRecommendation, SecurityLevel, EcosystemType


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
        with pytest.raises(Exception):  # Pydantic ValidationError
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
        assert high_conf_rec.is_critical  # Priority <= 10 and action_required=True
        
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
    
    def test_ai_recommendation_serialization(self):
        """Test AIRecommendation serialization."""
        recommendation = AIRecommendation(
            recommendation_type="security_action",
            title="Update vulnerable package",
            description="Package has vulnerability",
            confidence_score=0.9,
            risk_level=SecurityLevel.HIGH,
            action_required=True,
            human_review_required=True,
            rationale="Security vulnerability detected"
        )
        
        # Test dict conversion
        rec_dict = recommendation.model_dump()
        assert rec_dict["recommendation_type"] == "security_action"
        assert rec_dict["confidence_score"] == 0.9
        assert rec_dict["risk_level"] == SecurityLevel.HIGH.value
        
        # Test JSON serialization
        rec_json = recommendation.model_dump_json()
        assert "security_action" in rec_json
        assert "0.9" in rec_json