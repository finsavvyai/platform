"""
Query Understanding Service

Main service class for comprehensive query analysis.
"""

import asyncio
import logging
import re
from datetime import datetime
from typing import Dict, Any, List, Optional

from app.repositories.document import DocumentRepository

from .models import (
    QueryIntent, QueryComplexity, QueryType,
    QueryAnalysis, QueryContext,
)
from .classification import classify_intent, assess_complexity, classify_query_type
from .extraction import (
    extract_entities, extract_key_terms, extract_temporal_expressions,
    extract_numerical_values, analyze_sentiment, assess_urgency, detect_domain,
)
from .expansion import expand_query
from .structured_intent import maybe_classify_intent

logger = logging.getLogger(__name__)

DOMAIN_VOCABULARY = {
    "technology": ["software", "programming", "algorithm", "database", "api", "framework", "library", "cloud", "devops", "cybersecurity"],
    "business": ["strategy", "marketing", "finance", "revenue", "profit", "investment", "management", "leadership", "operations", "sales"],
    "science": ["research", "experiment", "hypothesis", "theory", "analysis", "methodology", "data", "statistics", "peer review", "publication"],
    "healthcare": ["patient", "treatment", "diagnosis", "therapy", "medical", "clinical", "healthcare", "medicine", "pharmaceutical", "wellness"],
    "legal": ["contract", "law", "regulation", "compliance", "litigation", "court", "judge", "attorney", "legal", "jurisdiction"],
}


class QueryUnderstandingService:
    """Advanced query understanding service"""

    def __init__(self, document_repository: DocumentRepository):
        self.document_repository = document_repository
        self._nlp = None
        self._cross_encoder = None
        self._synonym_cache: Dict[str, List[str]] = {}
        self._query_history: Dict[int, Dict[str, Any]] = {}
        self._initialize_nlp_models()
        logger.info("Query Understanding Service initialized")

    def _initialize_nlp_models(self):
        try:
            import spacy
            try:
                self._nlp = spacy.load("en_core_web_sm")
            except OSError:
                logger.warning("spaCy model not found, using basic processing")
            from sentence_transformers import CrossEncoder
            try:
                self._cross_encoder = CrossEncoder("ms-marco-MiniLM-L-6-v2")
            except Exception as e:
                logger.warning(f"Cross-encoder init failed: {e}")
        except Exception as e:
            logger.error(f"NLP model initialization failed: {e}")

    async def analyze_query(
        self, query: str,
        context: Optional[QueryContext] = None,
        use_expansion: bool = True,
    ) -> QueryAnalysis:
        start = datetime.now()
        try:
            cleaned = self._clean_query(query)
            entities = await extract_entities(cleaned, self._nlp)
            intent, confidence = classify_intent(cleaned)
            # Opt-in override: Instructor-backed structured classifier.
            structured_intent = maybe_classify_intent(cleaned)
            if structured_intent is not None:
                intent, confidence = structured_intent
            complexity = assess_complexity(cleaned, entities)
            query_type = classify_query_type(cleaned, intent)
            keywords, key_phrases = extract_key_terms(cleaned)
            temporal = extract_temporal_expressions(cleaned)
            numerical = extract_numerical_values(cleaned)
            sentiment = analyze_sentiment(cleaned)
            urgency = assess_urgency(cleaned)
            domain = detect_domain(cleaned, keywords, entities, DOMAIN_VOCABULARY)
            language = self._detect_language(cleaned)
            hints = self._generate_hints(cleaned, intent, entities, keywords)

            expanded = None
            if use_expansion:
                expanded = await expand_query(
                    cleaned, keywords, entities, domain, context, DOMAIN_VOCABULARY
                )

            t = (datetime.now() - start).total_seconds() * 1000
            analysis = QueryAnalysis(
                original_query=query, cleaned_query=cleaned,
                intent=intent, confidence=confidence, complexity=complexity,
                query_type=query_type, entities=entities, keywords=keywords,
                key_phrases=key_phrases, temporal_expressions=temporal,
                numerical_values=numerical, sentiment=sentiment, urgency=urgency,
                domain=domain, language=language, expanded_query=expanded,
                search_hints=hints, processing_time_ms=t,
            )
            self._cache(query, analysis)
            return analysis
        except Exception as e:
            logger.error(f"Query analysis failed: {e}")
            return QueryAnalysis(
                original_query=query, cleaned_query=self._clean_query(query),
                intent=QueryIntent.SEARCH, confidence=0.5,
                complexity=QueryComplexity.SIMPLE, query_type=QueryType.FACTUAL,
                entities=[], keywords=query.lower().split()[:10],
                key_phrases=[], temporal_expressions=[], numerical_values=[],
                sentiment="neutral", urgency="normal", domain=None, language="en",
                expanded_query=None, search_hints={}, processing_time_ms=0,
            )

    def _clean_query(self, query: str) -> str:
        cleaned = re.sub(r"\s+", " ", query.strip())
        cleaned = re.sub(r"[^\w\s\?\!\.\,\:\;\-\(\)]", " ", cleaned)
        if cleaned.isupper():
            cleaned = cleaned.title()
        return cleaned

    def _detect_language(self, query: str) -> str:
        english_words = ["the", "and", "is", "are", "was", "were", "have", "has"]
        words = query.lower().split()
        if not words:
            return "en"
        ratio = sum(1 for w in english_words if w in words) / len(words)
        return "en" if ratio > 0.1 else "en"

    def _generate_hints(self, query, intent, entities, keywords):
        hints = {
            "boost_recent": any(w in query.lower() for w in ["recent", "latest", "new"]),
            "boost_authoritative": any(w in query.lower() for w in ["research", "study", "scientific"]),
            "prefer_short_content": intent == QueryIntent.DEFINITION,
            "include_definitions": intent == QueryIntent.DEFINITION,
            "prefer_long_content": intent == QueryIntent.PROCEDURAL,
            "include_examples": intent == QueryIntent.PROCEDURAL,
        }
        return hints

    def _cache(self, query: str, analysis: QueryAnalysis):
        h = hash(query.lower())
        self._query_history[h] = {"analysis": analysis, "timestamp": datetime.now()}
        if len(self._query_history) > 1000:
            oldest = min(self._query_history, key=lambda k: self._query_history[k]["timestamp"])
            del self._query_history[oldest]

    async def get_query_suggestions(self, partial: str, max_suggestions: int = 5) -> List[str]:
        suggestions = []
        for _, data in self._query_history.items():
            q = data["analysis"].original_query
            if q.lower().startswith(partial.lower()):
                suggestions.append(q)
                if len(suggestions) >= max_suggestions:
                    break
        return suggestions

    async def analyze_query_batch(self, queries: List[str], context=None) -> List[QueryAnalysis]:
        return await asyncio.gather(*(self.analyze_query(q, context) for q in queries))

    def get_service_metrics(self) -> Dict[str, Any]:
        return {
            "cache_size": len(self._query_history),
            "nlp_model_loaded": self._nlp is not None,
            "cross_encoder_loaded": self._cross_encoder is not None,
            "supported_domains": list(DOMAIN_VOCABULARY.keys()),
        }
