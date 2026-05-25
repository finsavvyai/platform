"""
Natural Language Processing API Endpoints
Advanced NLP with multi-language support and technical understanding
"""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
import logging

from app.services.nlp_engine import (
    NLPEngine,
    NLPAnalysis,
    TranslationResult,
    IntentPrediction,
    Language,
    Domain,
    IntentType,
    SentimentType,
    nlp_engine
)
from app.core.auth import get_current_user
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()


# Pydantic models for API
class TextAnalysisRequest(BaseModel):
    """Request for text analysis"""
    text: str = Field(..., description="Text to analyze")
    context: Optional[dict] = Field(None, description="Additional context")


class EntityResponse(BaseModel):
    """Named entity response"""
    text: str
    label: str
    confidence: float
    start: int
    end: int


class TechnicalTermResponse(BaseModel):
    """Technical term response"""
    term: str
    domain: str
    definition: str


class NLPAnalysisResponse(BaseModel):
    """Comprehensive NLP analysis response"""
    original_text: str
    detected_language: str
    confidence_score: float
    normalized_text: str
    intent: str
    intent_confidence: float
    sentiment: str
    sentiment_score: float
    entities: List[EntityResponse]
    technical_terms: List[TechnicalTermResponse]
    domain: str
    key_phrases: List[str]
    complexity_level: int
    urgency_level: int
    action_items: List[str]
    suggested_responses: List[str]

    @classmethod
    def from_analysis(cls, analysis: NLPAnalysis):
        return cls(
            original_text=analysis.original_text,
            detected_language=analysis.detected_language.value,
            confidence_score=analysis.confidence_score,
            normalized_text=analysis.normalized_text,
            intent=analysis.intent.value,
            intent_confidence=analysis.intent_confidence,
            sentiment=analysis.sentiment.value,
            sentiment_score=analysis.sentiment_score,
            entities=[
                EntityResponse(
                    text=e['text'],
                    label=e['label'],
                    confidence=e['confidence'],
                    start=e['start'],
                    end=e['end']
                ) for e in analysis.entities
            ],
            technical_terms=[
                TechnicalTermResponse(
                    term=t['term'],
                    domain=t['domain'],
                    definition=t['definition']
                ) for t in analysis.technical_terms
            ],
            domain=analysis.domain.value,
            key_phrases=analysis.key_phrases,
            complexity_level=analysis.complexity_level,
            urgency_level=analysis.urgency_level,
            action_items=analysis.action_items,
            suggested_responses=analysis.suggested_responses
        )


class TranslationRequest(BaseModel):
    """Request for translation"""
    text: str = Field(..., description="Text to translate")
    target_language: str = Field(..., description="Target language code")
    preserve_technical_terms: bool = Field(default=True, description="Preserve technical terms")


class TranslationResponse(BaseModel):
    """Translation response"""
    original_text: str
    source_language: str
    target_language: str
    translated_text: str
    technical_terms_preserved: List[str]
    confidence_score: float
    cultural_adaptations: List[str]

    @classmethod
    def from_result(cls, result: TranslationResult):
        return cls(
            original_text=result.original_text,
            source_language=result.source_language.value,
            target_language=result.target_language.value,
            translated_text=result.translated_text,
            technical_terms_preserved=result.technical_terms_preserved,
            confidence_score=result.confidence_score,
            cultural_adaptations=result.cultural_adaptations
        )


class IntentPredictionRequest(BaseModel):
    """Request for intent prediction"""
    conversation_history: List[str] = Field(..., description="Recent conversation messages")
    current_context: Optional[dict] = Field(None, description="Current context")


class IntentPredictionResponse(BaseModel):
    """Intent prediction response"""
    predicted_intent: str
    confidence: float
    context_clues: List[str]
    next_likely_intents: List[dict]
    suggested_actions: List[str]

    @classmethod
    def from_prediction(cls, prediction: IntentPrediction):
        return cls(
            predicted_intent=prediction.predicted_intent.value,
            confidence=prediction.confidence,
            context_clues=prediction.context_clues,
            next_likely_intents=[
                {"intent": intent.value, "probability": prob}
                for intent, prob in prediction.next_likely_intents
            ],
            suggested_actions=prediction.suggested_actions
        )


class SentimentAnalysisResponse(BaseModel):
    """Sentiment analysis response"""
    text: str
    sentiment: str
    confidence: float
    emotional_indicators: List[str]
    recommendations: List[str]


@router.get("/health")
async def health_check():
    """Health check for NLP service"""
    return {
        "status": "healthy",
        "service": "nlp_engine",
        "features": [
            "multi_language_support",
            "technical_jargon_understanding",
            "intent_prediction",
            "sentiment_analysis",
            "entity_extraction",
            "context_aware_translation"
        ],
        "supported_languages": [lang.value for lang in Language],
        "supported_domains": [domain.value for domain in Domain]
    }


@router.post("/analyze", response_model=NLPAnalysisResponse)
async def analyze_text(
    request: TextAnalysisRequest,
    current_user: User = Depends(get_current_user)
):
    """Perform comprehensive NLP analysis on text"""
    try:
        logger.info(f"User {current_user.email} analyzing text: {request.text[:50]}...")

        analysis = await nlp_engine.analyze_text(
            text=request.text,
            context=request.context
        )

        return NLPAnalysisResponse.from_analysis(analysis)

    except Exception as e:
        logger.error(f"Text analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Text analysis failed: {str(e)}")


@router.post("/translate", response_model=TranslationResponse)
async def translate_text(
    request: TranslationRequest,
    current_user: User = Depends(get_current_user)
):
    """Translate text with context preservation"""
    try:
        logger.info(f"User {current_user.email} translating to {request.target_language}")

        # Validate target language
        try:
            target_lang = Language(request.target_language)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Unsupported language: {request.target_language}")

        result = await nlp_engine.translate_with_context(
            text=request.text,
            target_language=target_lang,
            preserve_technical_terms=request.preserve_technical_terms
        )

        return TranslationResponse.from_result(result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Translation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")


@router.post("/intent/predict", response_model=IntentPredictionResponse)
async def predict_intent(
    request: IntentPredictionRequest,
    current_user: User = Depends(get_current_user)
):
    """Predict user's next intent based on conversation history"""
    try:
        logger.info(f"User {current_user.email} predicting intent from {len(request.conversation_history)} messages")

        prediction = await nlp_engine.predict_intent_sequence(
            conversation_history=request.conversation_history,
            current_context=request.current_context
        )

        return IntentPredictionResponse.from_prediction(prediction)

    except Exception as e:
        logger.error(f"Intent prediction failed: {e}")
        raise HTTPException(status_code=500, detail=f"Intent prediction failed: {str(e)}")


@router.post("/sentiment", response_model=SentimentAnalysisResponse)
async def analyze_sentiment(
    text: str,
    current_user: User = Depends(get_current_user)
):
    """Analyze sentiment of text with emotional indicators"""
    try:
        logger.info(f"User {current_user.email} analyzing sentiment")

        # Use the sentiment analysis from comprehensive analysis
        analysis = await nlp_engine.analyze_text(text)

        # Generate emotional indicators
        emotional_indicators = []
        if analysis.sentiment == SentimentType.FRUSTRATED:
            emotional_indicators.extend(["frustration", "impatience", "difficulty"])
        elif analysis.sentiment == SentimentType.EXCITED:
            emotional_indicators.extend(["enthusiasm", "anticipation", "positivity"])
        elif analysis.sentiment == SentimentType.CONFUSED:
            emotional_indicators.extend(["uncertainty", "need for clarification", "learning"])

        # Generate recommendations based on sentiment
        recommendations = []
        if analysis.sentiment == SentimentType.NEGATIVE:
            recommendations.append("Provide additional support and guidance")
            recommendations.append("Check for blockers or issues")
        elif analysis.sentiment == SentimentType.CONFUSED:
            recommendations.append("Offer clearer explanations")
            recommendations.append("Provide step-by-step guidance")
        elif analysis.sentiment == SentimentType.POSITIVE:
            recommendations.append("Continue with current approach")
            recommendations.append("Consider advanced features")

        return SentimentAnalysisResponse(
            text=text,
            sentiment=analysis.sentiment.value,
            confidence=analysis.sentiment_score,
            emotional_indicators=emotional_indicators,
            recommendations=recommendations
        )

    except Exception as e:
        logger.error(f"Sentiment analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Sentiment analysis failed: {str(e)}")


@router.post("/entities/extract")
async def extract_entities(
    text: str,
    current_user: User = Depends(get_current_user)
):
    """Extract named entities from text"""
    try:
        logger.info(f"User {current_user.email} extracting entities")

        analysis = await nlp_engine.analyze_text(text)

        return {
            "text": text,
            "entities": [
                {
                    "text": e['text'],
                    "label": e['label'],
                    "confidence": e['confidence'],
                    "start": e['start'],
                    "end": e['end']
                } for e in analysis.entities
            ],
            "entity_count": len(analysis.entities)
        }

    except Exception as e:
        logger.error(f"Entity extraction failed: {e}")
        raise HTTPException(status_code=500, detail=f"Entity extraction failed: {str(e)}")


@router.post("/technical-terms/identify")
async def identify_technical_terms(
    text: str,
    current_user: User = Depends(get_current_user)
):
    """Identify technical terms and domain"""
    try:
        logger.info(f"User {current_user.email} identifying technical terms")

        analysis = await nlp_engine.analyze_text(text)

        return {
            "text": text,
            "domain": analysis.domain.value,
            "technical_terms": [
                {
                    "term": t['term'],
                    "domain": t['domain'],
                    "definition": t['definition']
                } for t in analysis.technical_terms
            ],
            "complexity_level": analysis.complexity_level
        }

    except Exception as e:
        logger.error(f"Technical term identification failed: {e}")
        raise HTTPException(status_code=500, detail=f"Technical term identification failed: {str(e)}")


@router.get("/languages")
async def get_supported_languages():
    """Get list of supported languages"""
    return {
        "languages": [
            {
                "code": lang.value,
                "name": lang.name.replace('_', ' ').title(),
                "supported_features": [
                    "translation",
                    "sentiment_analysis",
                    "entity_extraction"
                ]
            }
            for lang in Language
        ]
    }


@router.get("/domains")
async def get_supported_domains():
    """Get list of supported technical domains"""
    return {
        "domains": [
            {
                "code": domain.value,
                "name": domain.name.replace('_', ' ').title(),
                "description": f"Technical terms and concepts related to {domain.value.replace('_', ' ')}"
            }
            for domain in Domain
        ]
    }


@router.get("/intents")
async def get_supported_intents():
    """Get list of supported intent types"""
    return {
        "intents": [
            {
                "code": intent.value,
                "name": intent.name.replace('_', ' ').title(),
                "description": f"User wants to {intent.value.replace('_', ' ')}"
            }
            for intent in IntentType
        ]
    }


@router.post("/batch/analyze")
async def batch_analyze_texts(
    texts: List[str],
    context: Optional[dict] = None,
    current_user: User = Depends(get_current_user)
):
    """Analyze multiple texts in batch"""
    try:
        if len(texts) > 50:
            raise HTTPException(status_code=400, detail="Maximum 50 texts allowed in batch")

        logger.info(f"User {current_user.email} batch analyzing {len(texts)} texts")

        results = []
        for i, text in enumerate(texts):
            try:
                analysis = await nlp_engine.analyze_text(text, context)
                results.append({
                    "index": i,
                    "success": True,
                    "analysis": NLPAnalysisResponse.from_analysis(analysis)
                })
            except Exception as e:
                results.append({
                    "index": i,
                    "success": False,
                    "error": str(e)
                })

        return {
            "total_texts": len(texts),
            "successful_analyses": len([r for r in results if r["success"]]),
            "results": results
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Batch analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Batch analysis failed: {str(e)}")


@router.post("/conversation/analyze")
async def analyze_conversation(
    messages: List[str],
    current_user: User = Depends(get_current_user)
):
    """Analyze conversation flow and patterns"""
    try:
        logger.info(f"User {current_user.email} analyzing conversation with {len(messages)} messages")

        # Analyze each message
        message_analyses = []
        for i, message in enumerate(messages):
            analysis = await nlp_engine.analyze_text(message)
            message_analyses.append({
                "index": i,
                "message": message,
                "intent": analysis.intent.value,
                "sentiment": analysis.sentiment.value,
                "complexity": analysis.complexity_level,
                "urgency": analysis.urgency_level
            })

        # Analyze conversation patterns
        intents = [a["intent"] for a in message_analyses]
        sentiments = [a["sentiment"] for a in message_analyses]

        # Calculate conversation metrics
        avg_complexity = sum(a["complexity"] for a in message_analyses) / len(message_analyses)
        avg_urgency = sum(a["urgency"] for a in message_analyses) / len(message_analyses)

        # Determine conversation trend
        sentiment_trend = "stable"
        if len(sentiments) >= 3:
            recent_sentiments = sentiments[-3:]
            if all(s in ["positive", "excited"] for s in recent_sentiments):
                sentiment_trend = "improving"
            elif all(s in ["negative", "frustrated"] for s in recent_sentiments):
                sentiment_trend = "declining"

        return {
            "message_count": len(messages),
            "message_analyses": message_analyses,
            "conversation_metrics": {
                "average_complexity": round(avg_complexity, 2),
                "average_urgency": round(avg_urgency, 2),
                "sentiment_trend": sentiment_trend,
                "dominant_intent": max(set(intents), key=intents.count),
                "intent_variety": len(set(intents))
            },
            "recommendations": [
                "Continue current conversation approach" if sentiment_trend == "improving"
                else "Consider adjusting communication style",
                "Provide additional context" if avg_complexity > 7
                else "Current complexity level is appropriate",
                "Address urgency indicators" if avg_urgency > 6
                else "No urgent issues detected"
            ]
        }

    except Exception as e:
        logger.error(f"Conversation analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Conversation analysis failed: {str(e)}")


@router.get("/statistics")
async def get_nlp_statistics(current_user: User = Depends(get_current_user)):
    """Get NLP usage statistics for the current user"""
    # Mock statistics for demonstration
    return {
        "user_id": str(current_user.id),
        "total_analyses": 156,
        "this_month": 23,
        "most_used_language": "english",
        "dominant_domain": "devops",
        "average_complexity": 6.2,
        "sentiment_distribution": {
            "positive": 45,
            "neutral": 30,
            "negative": 15,
            "confused": 10
        },
        "intent_distribution": {
            "query": 40,
            "create": 25,
            "execute": 20,
            "help": 15
        },
        "translation_count": 12,
        "accuracy_score": 0.94
    }