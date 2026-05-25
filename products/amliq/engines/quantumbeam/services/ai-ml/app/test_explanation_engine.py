"""
Tests for the fraud explanation engine
"""

import pytest
from unittest.mock import Mock, AsyncMock
from datetime import datetime

from explanation_engine import (
    FraudExplanationEngine, ExplanationContext, FraudIndicator,
    ExplanationStyle, ConfidenceLevel
)


@pytest.fixture
def mock_llm_manager():
    """Mock LLM provider manager"""
    manager = Mock()
    manager.generate_with_failover = AsyncMock(return_value={
        "text": "This transaction shows elevated risk due to unusual patterns.",
        "provider": "openai",
        "cost": 0.001
    })
    return manager


@pytest.fixture
def sample_indicators():
    """Sample fraud indicators for testing"""
    return [
        FraudIndicator(
            name="velocity_1h",
            value=0.8,
            threshold=0.5,
            severity="high",
            description="High transaction velocity in last hour",
            impact_score=0.9
        ),
        FraudIndicator(
            name="amount_zscore",
            value=0.6,
            threshold=0.4,
            severity="medium",
            description="Transaction amount above normal",
            impact_score=0.7
        ),
        FraudIndicator(
            name="location_risk",
            value=0.3,
            threshold=0.5,
            severity="low",
            description="Location within normal range",
            impact_score=0.4
        )
    ]


@pytest.fixture
def sample_context(sample_indicators):
    """Sample explanation context"""
    return ExplanationContext(
        transaction_data={
            "transaction_id": "txn_123",
            "amount": "1000.00",
            "merchant_id": "merchant_456",
            "user_id": "user_789",
            "timestamp": "2024-01-15 10:30:00"
        },
        fraud_score=0.75,
        risk_level="HIGH",
        confidence=0.85,
        indicators=sample_indicators,
        ai_analysis={
            "risk_level": "HIGH",
            "confidence": 0.9,
            "provider": "openai"
        },
        text_analysis={
            "sentiment": "NEGATIVE",
            "confidence": 0.8
        },
        anomaly_detection={
            "anomaly_detected": True,
            "feature_count": 5
        }
    )


class TestFraudExplanationEngine:
    """Test cases for FraudExplanationEngine"""
    
    def test_init(self, mock_llm_manager):
        """Test engine initialization"""
        engine = FraudExplanationEngine(mock_llm_manager)
        
        assert engine.llm_manager == mock_llm_manager
        assert len(engine.explanation_templates) > 0
        assert len(engine.fraud_patterns) > 0
        assert ExplanationStyle.TECHNICAL in engine.explanation_templates
        assert ExplanationStyle.BUSINESS in engine.explanation_templates
        assert ExplanationStyle.CUSTOMER in engine.explanation_templates
    
    def test_determine_confidence_level(self, mock_llm_manager):
        """Test confidence level determination"""
        engine = FraudExplanationEngine(mock_llm_manager)
        
        assert engine._determine_confidence_level(0.95) == ConfidenceLevel.VERY_HIGH
        assert engine._determine_confidence_level(0.80) == ConfidenceLevel.HIGH
        assert engine._determine_confidence_level(0.60) == ConfidenceLevel.MEDIUM
        assert engine._determine_confidence_level(0.30) == ConfidenceLevel.LOW
        assert engine._determine_confidence_level(0.10) == ConfidenceLevel.VERY_LOW
    
    def test_analyze_indicators(self, mock_llm_manager, sample_indicators):
        """Test indicator analysis"""
        engine = FraudExplanationEngine(mock_llm_manager)
        analyzed = engine._analyze_indicators(sample_indicators)
        
        assert len(analyzed) == 3
        
        # Should be sorted by impact score (highest first)
        assert analyzed[0]["impact_score"] == 0.9  # velocity_1h
        assert analyzed[1]["impact_score"] == 0.7  # amount_zscore
        assert analyzed[2]["impact_score"] == 0.4  # location_risk
        
        # Check triggered status
        assert analyzed[0]["triggered"] == True   # 0.8 > 0.5
        assert analyzed[1]["triggered"] == True   # 0.6 > 0.4
        assert analyzed[2]["triggered"] == False  # 0.3 < 0.5
        
        # Check deviation calculation
        assert analyzed[0]["deviation"] == 0.3  # 0.8 - 0.5
        assert analyzed[1]["deviation"] == 0.2  # 0.6 - 0.4
        assert analyzed[2]["deviation"] == 0    # Not triggered
    
    def test_format_technical_factors(self, mock_llm_manager, sample_indicators):
        """Test technical factor formatting"""
        engine = FraudExplanationEngine(mock_llm_manager)
        analyzed = engine._analyze_indicators(sample_indicators)
        formatted = engine._format_technical_factors(analyzed)
        
        assert "velocity_1h" in formatted
        assert "0.800" in formatted  # Value
        assert "0.500" in formatted  # Threshold
        assert "high" in formatted   # Severity
        assert "0.90" in formatted   # Impact score
    
    def test_format_business_factors(self, mock_llm_manager, sample_indicators, sample_context):
        """Test business factor formatting"""
        engine = FraudExplanationEngine(mock_llm_manager)
        analyzed = engine._analyze_indicators(sample_indicators)
        formatted = engine._format_business_factors(analyzed, sample_context)
        
        # Should include business-friendly descriptions
        assert "transaction frequency" in formatted.lower() or "velocity" in formatted.lower()
        assert len(formatted) > 0
    
    def test_format_customer_factors(self, mock_llm_manager, sample_indicators):
        """Test customer factor formatting"""
        engine = FraudExplanationEngine(mock_llm_manager)
        analyzed = engine._analyze_indicators(sample_indicators)
        formatted = engine._format_customer_factors(analyzed)
        
        # Should be customer-friendly
        assert "multiple transactions" in formatted.lower() or "short time" in formatted.lower()
        assert len(formatted) > 0
    
    def test_analyze_fraud_patterns(self, mock_llm_manager, sample_context):
        """Test fraud pattern analysis"""
        engine = FraudExplanationEngine(mock_llm_manager)
        pattern_analysis = engine._analyze_fraud_patterns(sample_context)
        
        assert "detected_patterns" in pattern_analysis
        assert "pattern_count" in pattern_analysis
        assert isinstance(pattern_analysis["detected_patterns"], list)
        assert pattern_analysis["pattern_count"] >= 0
        
        # Should detect velocity fraud pattern
        pattern_names = [p["pattern"] for p in pattern_analysis["detected_patterns"]]
        assert "velocity_fraud" in pattern_names
    
    def test_calculate_pattern_severity(self, mock_llm_manager, sample_indicators):
        """Test pattern severity calculation"""
        engine = FraudExplanationEngine(mock_llm_manager)
        
        # High impact indicators
        high_impact_names = ["velocity_1h"]
        severity = engine._calculate_pattern_severity(high_impact_names, sample_indicators)
        assert severity in ["high", "critical"]
        
        # Low impact indicators
        low_impact_names = ["location_risk"]
        severity = engine._calculate_pattern_severity(low_impact_names, sample_indicators)
        assert severity in ["low", "medium"]
    
    def test_generate_confidence_breakdown(self, mock_llm_manager, sample_context):
        """Test confidence breakdown generation"""
        engine = FraudExplanationEngine(mock_llm_manager)
        breakdown = engine._generate_confidence_breakdown(sample_context)
        
        assert "overall_confidence" in breakdown
        assert "confidence_sources" in breakdown
        assert breakdown["overall_confidence"] == 0.85
        
        sources = breakdown["confidence_sources"]
        assert len(sources) > 0
        
        # Check for expected sources
        source_names = [s["source"] for s in sources]
        assert "AI Analysis" in source_names
        assert "Text Analysis" in source_names
        assert "Anomaly Detection" in source_names
    
    def test_generate_recommendations_high_risk(self, mock_llm_manager, sample_context):
        """Test recommendation generation for high risk"""
        engine = FraudExplanationEngine(mock_llm_manager)
        recommendations = engine._generate_recommendations(sample_context, ExplanationStyle.TECHNICAL)
        
        assert len(recommendations) > 0
        
        # Should include blocking recommendation for high risk
        actions = [r["action"] for r in recommendations]
        assert "block_transaction" in actions
        
        # Check priority levels
        priorities = [r["priority"] for r in recommendations]
        assert "immediate" in priorities
    
    def test_generate_recommendations_medium_risk(self, mock_llm_manager, sample_indicators):
        """Test recommendation generation for medium risk"""
        engine = FraudExplanationEngine(mock_llm_manager)
        
        medium_context = ExplanationContext(
            transaction_data={"amount": "500.00"},
            fraud_score=0.55,
            risk_level="MEDIUM",
            confidence=0.70,
            indicators=sample_indicators
        )
        
        recommendations = engine._generate_recommendations(medium_context, ExplanationStyle.TECHNICAL)
        
        assert len(recommendations) > 0
        
        # Should include verification recommendations for medium risk
        actions = [r["action"] for r in recommendations]
        assert "enhanced_verification" in actions
    
    @pytest.mark.asyncio
    async def test_generate_explanation_success(self, mock_llm_manager, sample_context):
        """Test successful explanation generation"""
        engine = FraudExplanationEngine(mock_llm_manager)
        
        explanation = await engine.generate_explanation(
            sample_context, 
            ExplanationStyle.TECHNICAL,
            include_recommendations=True
        )
        
        assert explanation is not None
        assert "summary" in explanation
        assert "ai_insights" in explanation
        assert "pattern_analysis" in explanation
        assert "confidence_breakdown" in explanation
        assert "risk_factors" in explanation
        assert "recommendations" in explanation
        assert "style" in explanation
        assert "confidence_level" in explanation
        assert "processing_time" in explanation
        
        assert explanation["style"] == ExplanationStyle.TECHNICAL
        assert explanation["processing_time"] > 0
        
        # Verify LLM was called for AI insights
        mock_llm_manager.generate_with_failover.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_generate_explanation_fallback(self, mock_llm_manager, sample_context):
        """Test explanation generation with fallback"""
        # Make LLM generation fail
        mock_llm_manager.generate_with_failover.side_effect = Exception("LLM failed")
        
        engine = FraudExplanationEngine(mock_llm_manager)
        
        explanation = await engine.generate_explanation(
            sample_context, 
            ExplanationStyle.BUSINESS
        )
        
        assert explanation is not None
        assert "summary" in explanation
        assert "ai_insights" in explanation
        assert explanation["ai_insights"] == "Advanced AI analysis completed - see detailed breakdown above"
    
    def test_generate_fallback_explanation(self, mock_llm_manager, sample_context):
        """Test fallback explanation generation"""
        engine = FraudExplanationEngine(mock_llm_manager)
        
        fallback = engine._generate_fallback_explanation(sample_context, ExplanationStyle.CUSTOMER)
        
        assert fallback is not None
        assert "summary" in fallback
        assert "fallback" in fallback
        assert fallback["fallback"] == True
        assert fallback["style"] == ExplanationStyle.CUSTOMER
        assert "HIGH" in fallback["summary"]
        assert "0.75" in fallback["summary"]
    
    def test_build_ai_insights_prompt(self, mock_llm_manager, sample_context):
        """Test AI insights prompt building"""
        engine = FraudExplanationEngine(mock_llm_manager)
        
        prompt = engine._build_ai_insights_prompt(sample_context, ExplanationStyle.TECHNICAL)
        
        assert "1000.00" in prompt  # Amount
        assert "HIGH" in prompt     # Risk level
        assert "0.75" in prompt     # Fraud score
        assert "85%" in prompt      # Confidence
        assert "velocity_1h" in prompt  # Top indicator
        assert "technical" in prompt.lower()
    
    @pytest.mark.asyncio
    async def test_different_explanation_styles(self, mock_llm_manager, sample_context):
        """Test different explanation styles"""
        engine = FraudExplanationEngine(mock_llm_manager)
        
        styles = [ExplanationStyle.TECHNICAL, ExplanationStyle.BUSINESS, ExplanationStyle.CUSTOMER]
        
        for style in styles:
            explanation = await engine.generate_explanation(sample_context, style)
            
            assert explanation["style"] == style
            assert len(explanation["summary"]) > 0
            
            # Different styles should produce different summaries
            if style == ExplanationStyle.CUSTOMER:
                assert "security" in explanation["summary"].lower() or "protect" in explanation["summary"].lower()
            elif style == ExplanationStyle.BUSINESS:
                assert "risk" in explanation["summary"].lower() or "fraud" in explanation["summary"].lower()


if __name__ == "__main__":
    pytest.main([__file__])