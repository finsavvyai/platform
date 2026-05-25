"""
API endpoints for AI/ML service
"""

import logging
from typing import Dict, List, Optional, Any
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
import numpy as np
from .explanation_engine import (
    FraudExplanationEngine, ExplanationContext, FraudIndicator, 
    ExplanationStyle, ConfidenceLevel
)

logger = logging.getLogger(__name__)

router = APIRouter()


# Request/Response models
class TransactionAnalysisRequest(BaseModel):
    text: str = Field(..., description="Transaction text to analyze")
    model_name: Optional[str] = Field(None, description="Specific model to use")


class FraudAnalysisRequest(BaseModel):
    transaction_data: Dict[str, Any] = Field(..., description="Transaction data to analyze")
    use_consensus: bool = Field(False, description="Use multiple providers for consensus")
    prefer_local: bool = Field(False, description="Prefer local models")


class EmbeddingRequest(BaseModel):
    texts: List[str] = Field(..., description="Texts to generate embeddings for")
    model_name: Optional[str] = Field(None, description="Embedding model to use")


class AnomalyDetectionRequest(BaseModel):
    features: List[float] = Field(..., description="Feature vector for anomaly detection")
    threshold: float = Field(0.5, description="Anomaly threshold")


class TextGenerationRequest(BaseModel):
    prompt: str = Field(..., description="Text prompt for generation")
    max_tokens: int = Field(500, description="Maximum tokens to generate")
    temperature: float = Field(0.7, description="Generation temperature")
    provider: Optional[str] = Field(None, description="Specific provider to use")


class FraudExplanationRequest(BaseModel):
    transaction_data: Dict[str, Any] = Field(..., description="Transaction data")
    fraud_score: float = Field(..., description="Fraud score (0-1)")
    risk_level: str = Field(..., description="Risk level (LOW/MEDIUM/HIGH)")
    confidence: float = Field(..., description="Confidence score (0-1)")
    indicators: List[Dict[str, Any]] = Field(..., description="Fraud indicators")
    ai_analysis: Optional[Dict[str, Any]] = Field(None, description="AI analysis results")
    text_analysis: Optional[Dict[str, Any]] = Field(None, description="Text analysis results")
    anomaly_detection: Optional[Dict[str, Any]] = Field(None, description="Anomaly detection results")
    style: str = Field("technical", description="Explanation style")
    include_recommendations: bool = Field(True, description="Include recommendations")


# Dependency injection
def get_model_manager():
    from main import model_manager
    if not model_manager:
        raise HTTPException(status_code=503, detail="Model manager not available")
    return model_manager


def get_llm_provider_manager():
    from main import llm_provider_manager
    if not llm_provider_manager:
        raise HTTPException(status_code=503, detail="LLM provider manager not available")
    return llm_provider_manager


@router.post("/analyze/text")
async def analyze_transaction_text(
    request: TransactionAnalysisRequest,
    model_manager=Depends(get_model_manager)
):
    """Analyze transaction text for fraud indicators"""
    try:
        result = await model_manager.analyze_transaction_text(
            request.text, 
            request.model_name
        )
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Text analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze/fraud")
async def analyze_fraud_patterns(
    request: FraudAnalysisRequest,
    llm_manager=Depends(get_llm_provider_manager)
):
    """Analyze transaction data for fraud patterns using LLMs"""
    try:
        if request.use_consensus:
            result = await llm_manager.analyze_fraud_with_consensus(
                request.transaction_data
            )
        else:
            provider = llm_manager.select_provider(request.prefer_local)
            if not provider:
                raise HTTPException(status_code=503, detail="No providers available")
            
            result = await provider.analyze_fraud_patterns(request.transaction_data)
        
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Fraud analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/embeddings")
async def generate_embeddings(
    request: EmbeddingRequest,
    model_manager=Depends(get_model_manager)
):
    """Generate embeddings for text data"""
    try:
        embeddings = await model_manager.generate_embeddings(
            request.texts, 
            request.model_name
        )
        return {
            "success": True, 
            "data": {
                "embeddings": embeddings.tolist(),
                "shape": embeddings.shape,
                "model_used": request.model_name
            }
        }
    except Exception as e:
        logger.error(f"Embedding generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/anomaly/detect")
async def detect_anomalies(
    request: AnomalyDetectionRequest,
    model_manager=Depends(get_model_manager)
):
    """Detect anomalies in feature data"""
    try:
        features = np.array(request.features)
        result = await model_manager.detect_anomalies(features, request.threshold)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Anomaly detection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate/text")
async def generate_text(
    request: TextGenerationRequest,
    llm_manager=Depends(get_llm_provider_manager)
):
    """Generate text using LLM providers"""
    try:
        if request.provider:
            provider = llm_manager.providers.get(request.provider)
            if not provider:
                raise HTTPException(status_code=404, detail=f"Provider {request.provider} not found")
            result = await provider.generate_text(
                request.prompt,
                max_tokens=request.max_tokens,
                temperature=request.temperature
            )
        else:
            result = await llm_manager.generate_with_failover(
                request.prompt,
                max_tokens=request.max_tokens,
                temperature=request.temperature
            )
        
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Text generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/models/stats")
async def get_model_stats(model_manager=Depends(get_model_manager)):
    """Get statistics about loaded models"""
    try:
        stats = model_manager.get_model_stats()
        return {"success": True, "data": stats}
    except Exception as e:
        logger.error(f"Model stats error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/providers/stats")
async def get_provider_stats(llm_manager=Depends(get_llm_provider_manager)):
    """Get statistics about LLM providers"""
    try:
        stats = llm_manager.get_provider_stats()
        return {"success": True, "data": stats}
    except Exception as e:
        logger.error(f"Provider stats error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/models/load")
async def load_model(
    model_name: str,
    task: Optional[str] = None,
    model_manager=Depends(get_model_manager)
):
    """Load a specific model"""
    try:
        success = await model_manager.load_model(model_name, task)
        if success:
            return {"success": True, "message": f"Model {model_name} loaded successfully"}
        else:
            raise HTTPException(status_code=500, detail=f"Failed to load model {model_name}")
    except Exception as e:
        logger.error(f"Model loading error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/providers/initialize")
async def initialize_providers(llm_manager=Depends(get_llm_provider_manager)):
    """Initialize LLM providers"""
    try:
        await llm_manager.initialize_providers()
        return {"success": True, "message": "Providers initialized successfully"}
    except Exception as e:
        logger.error(f"Provider initialization error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cost/analytics")
async def get_cost_analytics(llm_manager=Depends(get_llm_provider_manager)):
    """Get detailed cost analytics"""
    try:
        analytics = llm_manager.get_cost_analytics()
        return {"success": True, "data": analytics}
    except Exception as e:
        logger.error(f"Cost analytics error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cost/optimization")
async def get_cost_optimization(llm_manager=Depends(get_llm_provider_manager)):
    """Get cost optimization recommendations"""
    try:
        recommendations = llm_manager.get_cost_optimization_recommendations()
        return {"success": True, "data": recommendations}
    except Exception as e:
        logger.error(f"Cost optimization error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cost/limits")
async def set_cost_limits(
    provider: str,
    daily_limit: float,
    monthly_limit: float,
    llm_manager=Depends(get_llm_provider_manager)
):
    """Set cost limits for a provider"""
    try:
        llm_manager.set_cost_limits(provider, daily_limit, monthly_limit)
        return {"success": True, "message": f"Cost limits updated for {provider}"}
    except Exception as e:
        logger.error(f"Cost limits error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/providers/{provider_name}/status")
async def get_provider_status(
    provider_name: str,
    llm_manager=Depends(get_llm_provider_manager)
):
    """Get detailed status for a specific provider"""
    try:
        if provider_name not in llm_manager.providers:
            raise HTTPException(status_code=404, detail=f"Provider {provider_name} not found")
        
        provider = llm_manager.providers[provider_name]
        daily_check = llm_manager.cost_tracker.check_daily_limit(provider_name)
        monthly_check = llm_manager.cost_tracker.check_monthly_limit(provider_name)
        summary = llm_manager.cost_tracker.get_provider_summary(provider_name)
        trends = llm_manager.cost_tracker.get_cost_trends(provider_name)
        
        status = {
            "provider": provider_name,
            "status": provider.status,
            "health_score": provider.get_health_score(),
            "request_count": provider.request_count,
            "error_count": provider.error_count,
            "error_rate": provider.error_count / max(provider.request_count, 1),
            "avg_response_time": provider.avg_response_time,
            "total_cost": provider.total_cost,
            "daily_cost_status": daily_check,
            "monthly_cost_status": monthly_check,
            "cost_summary": summary.__dict__,
            "cost_trends": trends
        }
        
        return {"success": True, "data": status}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Provider status error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/explain/fraud")
async def explain_fraud_decision(
    request: FraudExplanationRequest,
    llm_manager=Depends(get_llm_provider_manager)
):
    """Generate comprehensive fraud explanation"""
    try:
        # Create explanation engine
        explanation_engine = FraudExplanationEngine(llm_manager)
        
        # Convert request to indicators
        indicators = []
        for indicator_data in request.indicators:
            indicator = FraudIndicator(
                name=indicator_data.get("name", "unknown"),
                value=indicator_data.get("value", 0.0),
                threshold=indicator_data.get("threshold", 0.5),
                severity=indicator_data.get("severity", "medium"),
                description=indicator_data.get("description", ""),
                impact_score=indicator_data.get("impact_score", 0.5)
            )
            indicators.append(indicator)
        
        # Create explanation context
        context = ExplanationContext(
            transaction_data=request.transaction_data,
            fraud_score=request.fraud_score,
            risk_level=request.risk_level,
            confidence=request.confidence,
            indicators=indicators,
            ai_analysis=request.ai_analysis,
            text_analysis=request.text_analysis,
            anomaly_detection=request.anomaly_detection
        )
        
        # Generate explanation
        style = ExplanationStyle(request.style)
        explanation = await explanation_engine.generate_explanation(
            context, style, request.include_recommendations
        )
        
        return {"success": True, "data": explanation}
        
    except Exception as e:
        logger.error(f"Fraud explanation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/explain/patterns")
async def get_fraud_patterns():
    """Get available fraud patterns and their descriptions"""
    try:
        # Create temporary explanation engine to access patterns
        explanation_engine = FraudExplanationEngine(None)
        patterns = explanation_engine.fraud_patterns
        
        return {"success": True, "data": {"patterns": patterns}}
        
    except Exception as e:
        logger.error(f"Fraud patterns error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/explain/styles")
async def get_explanation_styles():
    """Get available explanation styles"""
    try:
        styles = {
            "technical": "Detailed technical analysis for fraud analysts",
            "business": "Business-focused insights for stakeholders", 
            "customer": "Customer-friendly explanations",
            "regulatory": "Compliance and regulatory reporting"
        }
        
        confidence_levels = {
            "very_high": "90-100% confidence",
            "high": "75-89% confidence",
            "medium": "50-74% confidence", 
            "low": "25-49% confidence",
            "very_low": "0-24% confidence"
        }
        
        return {
            "success": True, 
            "data": {
                "explanation_styles": styles,
                "confidence_levels": confidence_levels
            }
        }
        
    except Exception as e:
        logger.error(f"Explanation styles error: {e}")
        raise HTTPException(status_code=500, detail=str(e))