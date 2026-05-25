"""
Query Understanding Service

Advanced query processing with intent detection, entity extraction,
query expansion, and multi-modal query understanding for enhanced RAG performance.
"""

import asyncio
import logging
import re
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple, Set
from enum import Enum
from dataclasses import dataclass, field
import json
import math
from collections import Counter

import numpy as np
from sentence_transformers import CrossEncoder
import spacy
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from app.core.config import get_settings
from app.models.document import DocumentChunk
from app.repositories.document import DocumentRepository

logger = logging.getLogger(__name__)
settings = get_settings()


class QueryIntent(str, Enum):
    """Query intent classification"""

    QUESTION = "question"  # Asking for information
    COMMAND = "command"  # Instruction to perform action
    SEARCH = "search"  # General information retrieval
    COMPARISON = "comparison"  # Compare items or concepts
    DEFINITION = "definition"  # Define terms or concepts
    PROCEDURAL = "procedural"  # How-to or process steps
    ANALYSIS = "analysis"  # Analyze or evaluate
    SUMMARIZATION = "summarization"  # Summarize information
    RECOMMENDATION = "recommendation"  # Seek recommendations
    EXPLANATION = "explanation"  # Explain concepts


class QueryComplexity(str, Enum):
    """Query complexity levels"""

    SIMPLE = "simple"  # Single concept, straightforward
    MODERATE = "moderate"  # Multiple concepts, some constraints
    COMPLEX = "complex"  # Many concepts, complex relationships
    EXPERT = "expert"  # Domain-specific, technical language


class QueryType(str, Enum):
    """Query type classification"""

    FACTUAL = "factual"  # Seeking facts
    OPINION = "opinion"  # Seeking opinions or subjective info
    PROCEDURAL = "procedural"  # Step-by-step processes
    CONCEPTUAL = "conceptual"  # Understanding concepts
    TEMPORAL = "temporal"  # Time-based queries
    SPATIAL = "spatial"  # Location-based queries
    CAUSAL = "causal"  # Cause-and-effect relationships
    COMPARATIVE = "comparative"  # Comparing items


@dataclass
class QueryEntity:
    """Extracted entity from query"""

    text: str
    label: str  # PERSON, ORG, GPE, PRODUCT, etc.
    start: int
    end: int
    confidence: float
    canonical_form: Optional[str] = None
    synonyms: List[str] = field(default_factory=list)
    context: str = ""


@dataclass
class QueryTerm:
    """Processed query term with weighting"""

    term: str
    weight: float
    term_type: str  # keyword, entity, concept, etc.
    importance: float
    synonyms: List[str] = field(default_factory=list)
    related_terms: List[str] = field(default_factory=list)


@dataclass
class ExpandedQuery:
    """Expanded query with additional terms and concepts"""

    original_query: str
    expanded_terms: List[QueryTerm]
    related_concepts: List[str]
    synonyms: List[str]
    boolean_query: str
    weighted_terms: List[Tuple[str, float]]
    expansion_method: str
    expansion_confidence: float


@dataclass
class QueryAnalysis:
    """Complete query analysis results"""

    original_query: str
    cleaned_query: str
    intent: QueryIntent
    confidence: float
    complexity: QueryComplexity
    query_type: QueryType
    entities: List[QueryEntity]
    keywords: List[str]
    key_phrases: List[str]
    temporal_expressions: List[str]
    numerical_values: List[Dict[str, Any]]
    sentiment: str
    urgency: str
    domain: Optional[str]
    language: str
    expanded_query: Optional[ExpandedQuery]
    search_hints: Dict[str, Any]
    processing_time_ms: float


@dataclass
class QueryContext:
    """Context from previous queries for personalization"""

    user_id: str
    session_id: str
    previous_queries: List[str]
    successful_results: List[Dict[str, Any]]
    user_preferences: Dict[str, Any]
    domain_expertise: Dict[str, float]
    recent_topics: List[str]
    conversation_history: List[Dict[str, Any]]


class QueryUnderstandingService:
    """Advanced query understanding service"""

    def __init__(self, document_repository: DocumentRepository):
        self.document_repository = document_repository
        self._nlp = None
        self._cross_encoder = None
        self._tfidf_vectorizer = None
        self._domain_vocabulary = {}
        self._entity_cache = {}
        self._synonym_cache = {}
        self._query_history = {}
        self._intent_classifier = None

        # Initialize NLP models
        self._initialize_nlp_models()

        # Load domain knowledge
        self._load_domain_knowledge()

        logger.info("Query Understanding Service initialized")

    def _initialize_nlp_models(self) -> None:
        """Initialize NLP models for query processing"""
        try:
            # Load spaCy model (fallback to basic if not available)
            try:
                self._nlp = spacy.load("en_core_web_sm")
            except OSError:
                logger.warning("spaCy model not found, using basic processing")
                self._nlp = None

            # Initialize cross-encoder for query-document relevance
            try:
                self._cross_encoder = CrossEncoder("ms-marco-MiniLM-L-6-v2")
            except Exception as e:
                logger.warning(f"Cross-encoder initialization failed: {e}")
                self._cross_encoder = None

            # Initialize TF-IDF vectorizer for keyword extraction
            self._tfidf_vectorizer = TfidfVectorizer(
                max_features=1000,
                stop_words="english",
                ngram_range=(1, 2),
                min_df=2,
                max_df=0.8,
            )

        except Exception as e:
            logger.error(f"NLP model initialization failed: {e}")

    def _load_domain_knowledge(self) -> None:
        """Load domain-specific vocabulary and knowledge"""
        # Technical domains
        self._domain_vocabulary = {
            "technology": [
                "software",
                "programming",
                "algorithm",
                "database",
                "api",
                "framework",
                "library",
                "cloud",
                "devops",
                "cybersecurity",
            ],
            "business": [
                "strategy",
                "marketing",
                "finance",
                "revenue",
                "profit",
                "investment",
                "management",
                "leadership",
                "operations",
                "sales",
            ],
            "science": [
                "research",
                "experiment",
                "hypothesis",
                "theory",
                "analysis",
                "methodology",
                "data",
                "statistics",
                "peer review",
                "publication",
            ],
            "healthcare": [
                "patient",
                "treatment",
                "diagnosis",
                "therapy",
                "medical",
                "clinical",
                "healthcare",
                "medicine",
                "pharmaceutical",
                "wellness",
            ],
            "legal": [
                "contract",
                "law",
                "regulation",
                "compliance",
                "litigation",
                "court",
                "judge",
                "attorney",
                "legal",
                "jurisdiction",
            ],
        }

    async def analyze_query(
        self,
        query: str,
        context: Optional[QueryContext] = None,
        use_expansion: bool = True,
    ) -> QueryAnalysis:
        """
        Perform comprehensive query analysis

        Args:
            query: Input query text
            context: Query context for personalization
            use_expansion: Whether to perform query expansion

        Returns:
            Complete query analysis
        """
        start_time = datetime.now()

        try:
            # Clean and preprocess query
            cleaned_query = self._clean_query(query)

            # Extract entities
            entities = await self._extract_entities(cleaned_query)

            # Classify intent
            intent, intent_confidence = await self._classify_intent(cleaned_query)

            # Determine complexity
            complexity = self._assess_complexity(cleaned_query, entities)

            # Classify query type
            query_type = self._classify_query_type(cleaned_query, intent)

            # Extract keywords and phrases
            keywords, key_phrases = self._extract_key_terms(cleaned_query)

            # Extract temporal expressions
            temporal_expressions = self._extract_temporal_expressions(cleaned_query)

            # Extract numerical values
            numerical_values = self._extract_numerical_values(cleaned_query)

            # Analyze sentiment
            sentiment = self._analyze_sentiment(cleaned_query)

            # Assess urgency
            urgency = self._assess_urgency(cleaned_query)

            # Detect domain
            domain = self._detect_domain(cleaned_query, keywords, entities)

            # Detect language
            language = self._detect_language(cleaned_query)

            # Generate search hints
            search_hints = self._generate_search_hints(
                cleaned_query, intent, entities, keywords
            )

            # Perform query expansion if requested
            expanded_query = None
            if use_expansion:
                expanded_query = await self._expand_query(
                    cleaned_query, keywords, entities, domain, context
                )

            # Calculate processing time
            processing_time = (datetime.now() - start_time).total_seconds() * 1000

            analysis = QueryAnalysis(
                original_query=query,
                cleaned_query=cleaned_query,
                intent=intent,
                confidence=intent_confidence,
                complexity=complexity,
                query_type=query_type,
                entities=entities,
                keywords=keywords,
                key_phrases=key_phrases,
                temporal_expressions=temporal_expressions,
                numerical_values=numerical_values,
                sentiment=sentiment,
                urgency=urgency,
                domain=domain,
                language=language,
                expanded_query=expanded_query,
                search_hints=search_hints,
                processing_time_ms=processing_time,
            )

            # Cache analysis for similar queries
            self._cache_query_analysis(query, analysis)

            logger.info(
                f"Query analyzed: intent={intent}, complexity={complexity}, "
                f"entities={len(entities)}, time={processing_time:.2f}ms"
            )

            return analysis

        except Exception as e:
            logger.error(f"Query analysis failed: {e}")
            # Return basic analysis on error
            return QueryAnalysis(
                original_query=query,
                cleaned_query=self._clean_query(query),
                intent=QueryIntent.SEARCH,
                confidence=0.5,
                complexity=QueryComplexity.SIMPLE,
                query_type=QueryType.FACTUAL,
                entities=[],
                keywords=self._extract_basic_keywords(query),
                key_phrases=[],
                temporal_expressions=[],
                numerical_values=[],
                sentiment="neutral",
                urgency="normal",
                domain=None,
                language="en",
                expanded_query=None,
                search_hints={},
                processing_time_ms=0.0,
            )

    def _clean_query(self, query: str) -> str:
        """
        Clean and normalize query text

        Args:
            query: Original query text

        Returns:
            Cleaned query text
        """
        # Remove extra whitespace
        cleaned = re.sub(r"\s+", " ", query.strip())

        # Remove special characters but keep important punctuation
        cleaned = re.sub(r"[^\w\s\?\!\.\,\:\;\-\(\)]", " ", cleaned)

        # Normalize case (keep original for some cases)
        if cleaned.isupper():
            cleaned = cleaned.title()
        elif cleaned.islower():
            cleaned = cleaned

        return cleaned

    async def _extract_entities(self, query: str) -> List[QueryEntity]:
        """
        Extract named entities from query

        Args:
            query: Query text

        Returns:
            List of extracted entities
        """
        entities = []

        try:
            # Use spaCy for entity extraction if available
            if self._nlp:
                doc = self._nlp(query)
                for ent in doc.ents:
                    entity = QueryEntity(
                        text=ent.text,
                        label=ent.label_,
                        start=ent.start_char,
                        end=ent.end_char,
                        confidence=0.8,  # spaCy doesn't provide confidence
                        canonical_form=ent.text.lower(),
                        context=query[max(0, ent.start_char - 20) : ent.end_char + 20],
                    )
                    entities.append(entity)

            # Fallback to pattern-based entity extraction
            if not entities:
                entities = self._extract_entities_patterns(query)

            # Enhance entities with domain knowledge
            entities = await self._enhance_entities(entities)

        except Exception as e:
            logger.warning(f"Entity extraction failed: {e}")

        return entities

    def _extract_entities_patterns(self, query: str) -> List[QueryEntity]:
        """
        Fallback pattern-based entity extraction

        Args:
            query: Query text

        Returns:
            List of extracted entities
        """
        entities = []

        # Email pattern
        email_pattern = r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"
        for match in re.finditer(email_pattern, query):
            entities.append(
                QueryEntity(
                    text=match.group(),
                    label="EMAIL",
                    start=match.start(),
                    end=match.end(),
                    confidence=0.9,
                )
            )

        # Phone pattern
        phone_pattern = r"\b\d{3}[-.]?\d{3}[-.]?\d{4}\b"
        for match in re.finditer(phone_pattern, query):
            entities.append(
                QueryEntity(
                    text=match.group(),
                    label="PHONE",
                    start=match.start(),
                    end=match.end(),
                    confidence=0.9,
                )
            )

        # URL pattern
        url_pattern = r"https?://[^\s]+"
        for match in re.finditer(url_pattern, query):
            entities.append(
                QueryEntity(
                    text=match.group(),
                    label="URL",
                    start=match.start(),
                    end=match.end(),
                    confidence=0.95,
                )
            )

        # Date pattern
        date_pattern = (
            r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b\d{4}[/-]\d{1,2}[/-]\d{1,2}\b"
        )
        for match in re.finditer(date_pattern, query):
            entities.append(
                QueryEntity(
                    text=match.group(),
                    label="DATE",
                    start=match.start(),
                    end=match.end(),
                    confidence=0.8,
                )
            )

        return entities

    async def _enhance_entities(self, entities: List[QueryEntity]) -> List[QueryEntity]:
        """
        Enhance entities with additional information

        Args:
            entities: Basic extracted entities

        Returns:
            Enhanced entities
        """
        enhanced_entities = []

        for entity in entities:
            # Add synonyms for common entities
            if entity.label == "PERSON":
                entity.synonyms = ["person", "individual", "user", "people"]
            elif entity.label == "ORG":
                entity.synonyms = ["organization", "company", "business", "firm"]
            elif entity.label == "GPE":  # Geopolitical Entity
                entity.synonyms = ["location", "place", "country", "city"]

            # Add canonical form
            if entity.canonical_form is None:
                entity.canonical_form = entity.text.lower().strip()

            enhanced_entities.append(entity)

        return enhanced_entities

    async def _classify_intent(self, query: str) -> Tuple[QueryIntent, float]:
        """
        Classify query intent

        Args:
            query: Query text

        Returns:
            Tuple of (intent, confidence)
        """
        # Simple rule-based intent classification
        query_lower = query.lower()

        # Question patterns
        question_patterns = [
            r"\b(what|who|where|when|why|how|which|whose)\b",
            r"\?$",
            r"\b(can|could|would|should|is|are|do|does|did)\b.*\?$",
        ]

        # Command patterns
        command_patterns = [
            r"\b(show|find|get|list|search|look for|give me)\b",
            r"\b(create|update|delete|modify|change)\b",
            r"\b(start|stop|run|execute)\b",
        ]

        # Comparison patterns
        comparison_patterns = [
            r"\b(compare|versus|vs|difference|better|worse)\b",
            r"\b(although|however|while|whereas)\b",
        ]

        # Definition patterns
        definition_patterns = [
            r"\b(define|definition|meaning|what is|what are)\b",
            r"\b(explain|explanation)\b",
        ]

        # Procedural patterns
        procedural_patterns = [
            r"\b(how to|steps|process|procedure|guide)\b",
            r"\b(first|then|next|finally)\b",
        ]

        # Calculate scores for each intent
        intent_scores = {}

        # Question intent
        question_score = sum(
            1
            for pattern in question_patterns
            if re.search(pattern, query_lower, re.IGNORECASE)
        )
        intent_scores[QueryIntent.QUESTION] = question_score

        # Command intent
        command_score = sum(
            1
            for pattern in command_patterns
            if re.search(pattern, query_lower, re.IGNORECASE)
        )
        intent_scores[QueryIntent.COMMAND] = command_score

        # Comparison intent
        comparison_score = sum(
            1
            for pattern in comparison_patterns
            if re.search(pattern, query_lower, re.IGNORECASE)
        )
        intent_scores[QueryIntent.COMPARISON] = comparison_score

        # Definition intent
        definition_score = sum(
            1
            for pattern in definition_patterns
            if re.search(pattern, query_lower, re.IGNORECASE)
        )
        intent_scores[QueryIntent.DEFINITION] = definition_score

        # Procedural intent
        procedural_score = sum(
            1
            for pattern in procedural_patterns
            if re.search(pattern, query_lower, re.IGNORECASE)
        )
        intent_scores[QueryIntent.PROCEDURAL] = procedural_score

        # Default search intent
        intent_scores[QueryIntent.SEARCH] = 0.1

        # Find best intent
        best_intent = max(intent_scores, key=intent_scores.get)
        confidence = min(intent_scores[best_intent] / 3.0, 1.0)  # Normalize to 0-1

        # If no strong intent detected, default to search
        if confidence < 0.3:
            best_intent = QueryIntent.SEARCH
            confidence = 0.5

        return best_intent, confidence

    def _assess_complexity(
        self, query: str, entities: List[QueryEntity]
    ) -> QueryComplexity:
        """
        Assess query complexity

        Args:
            query: Query text
            entities: Extracted entities

        Returns:
            Complexity level
        """
        complexity_score = 0

        # Length-based complexity
        word_count = len(query.split())
        if word_count > 20:
            complexity_score += 3
        elif word_count > 10:
            complexity_score += 2
        elif word_count > 5:
            complexity_score += 1

        # Entity-based complexity
        complexity_score += min(len(entities), 3)

        # Question-based complexity
        if "?" in query:
            complexity_score += 1

        # Conjunction-based complexity
        conjunctions = ["and", "or", "but", "while", "although", "however"]
        conjunction_count = sum(1 for conj in conjunctions if conj in query.lower())
        complexity_score += conjunction_count

        # Technical terms complexity
        technical_terms = [
            "algorithm",
            "implementation",
            "architecture",
            "framework",
            "methodology",
            "optimization",
        ]
        technical_count = sum(1 for term in technical_terms if term in query.lower())
        complexity_score += technical_count

        # Determine complexity level
        if complexity_score <= 2:
            return QueryComplexity.SIMPLE
        elif complexity_score <= 5:
            return QueryComplexity.MODERATE
        elif complexity_score <= 8:
            return QueryComplexity.COMPLEX
        else:
            return QueryComplexity.EXPERT

    def _classify_query_type(self, query: str, intent: QueryIntent) -> QueryType:
        """
        Classify query type

        Args:
            query: Query text
            intent: Query intent

        Returns:
            Query type
        """
        query_lower = query.lower()

        # Temporal indicators
        temporal_words = [
            "when",
            "time",
            "date",
            "duration",
            "before",
            "after",
            "recent",
            "latest",
            "old",
            "new",
        ]
        if any(word in query_lower for word in temporal_words):
            return QueryType.TEMPORAL

        # Spatial indicators
        spatial_words = [
            "where",
            "location",
            "place",
            "area",
            "region",
            "near",
            "far",
            "distance",
        ]
        if any(word in query_lower for word in spatial_words):
            return QueryType.SPATIAL

        # Causal indicators
        causal_words = [
            "why",
            "because",
            "cause",
            "reason",
            "result",
            "effect",
            "impact",
            "influence",
        ]
        if any(word in query_lower for word in causal_words):
            return QueryType.CAUSAL

        # Comparative indicators
        comparative_words = [
            "compare",
            "versus",
            "vs",
            "difference",
            "better",
            "worse",
            "best",
            "worst",
            "ranking",
        ]
        if any(word in query_lower for word in comparative_words):
            return QueryType.COMPARATIVE

        # Factual indicators
        if intent in [QueryIntent.QUESTION, QueryIntent.DEFINITION, QueryIntent.SEARCH]:
            return QueryType.FACTUAL

        # Conceptual indicators
        conceptual_words = [
            "concept",
            "theory",
            "principle",
            "understand",
            "explain",
            "meaning",
        ]
        if any(word in query_lower for word in conceptual_words):
            return QueryType.CONCEPTUAL

        # Default based on intent
        intent_type_mapping = {
            QueryIntent.PROCEDURAL: QueryType.PROCEDURAL,
            QueryIntent.ANALYSIS: QueryType.CONCEPTUAL,
            QueryIntent.RECOMMENDATION: QueryType.OPINION,
        }

        return intent_type_mapping.get(intent, QueryType.FACTUAL)

    def _extract_key_terms(self, query: str) -> Tuple[List[str], List[str]]:
        """
        Extract keywords and key phrases from query

        Args:
            query: Query text

        Returns:
            Tuple of (keywords, key_phrases)
        """
        # Remove stop words
        stop_words = {
            "the",
            "a",
            "an",
            "and",
            "or",
            "but",
            "in",
            "on",
            "at",
            "to",
            "for",
            "of",
            "with",
            "by",
            "is",
            "are",
            "was",
            "were",
            "be",
            "been",
            "have",
            "has",
            "had",
            "do",
            "does",
            "did",
            "will",
            "would",
            "could",
            "should",
            "may",
            "might",
            "can",
            "this",
            "that",
            "these",
            "those",
            "i",
            "you",
            "he",
            "she",
            "it",
            "we",
            "they",
            "me",
            "him",
            "her",
            "us",
            "them",
        }

        words = [
            word.lower()
            for word in query.split()
            if word.lower() not in stop_words and len(word) > 2
        ]

        # Get word frequencies
        word_freq = Counter(words)

        # Extract keywords (most frequent words)
        keywords = [word for word, freq in word_freq.most_common(10)]

        # Extract key phrases (2-3 word combinations)
        words_list = query.split()
        phrases = []

        for i in range(len(words_list) - 1):
            # 2-word phrases
            phrase = " ".join(words_list[i : i + 2]).lower()
            if all(word not in stop_words for word in phrase.split()):
                phrases.append(phrase)

        for i in range(len(words_list) - 2):
            # 3-word phrases
            phrase = " ".join(words_list[i : i + 3]).lower()
            if all(word not in stop_words for word in phrase.split()):
                phrases.append(phrase)

        # Get most common phrases
        phrase_freq = Counter(phrases)
        key_phrases = [phrase for phrase, freq in phrase_freq.most_common(5)]

        return keywords, key_phrases

    def _extract_temporal_expressions(self, query: str) -> List[str]:
        """
        Extract temporal expressions from query

        Args:
            query: Query text

        Returns:
            List of temporal expressions
        """
        temporal_patterns = [
            r"\b\d{4}\b",  # Years
            r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b",  # Dates
            r"\b(january|february|march|april|may|june|july|august|september|october|november|december)\b",
            r"\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b",
            r"\b(yesterday|today|tomorrow|now|soon|later)\b",
            r"\b(last|this|next)\s+(week|month|year|decade)\b",
            r"\b(\d+|a|few|several)\s+(days|weeks|months|years)\s+(ago|from now)\b",
        ]

        temporal_expressions = []
        for pattern in temporal_patterns:
            matches = re.findall(pattern, query, re.IGNORECASE)
            temporal_expressions.extend(matches)

        return temporal_expressions

    def _extract_numerical_values(self, query: str) -> List[Dict[str, Any]]:
        """
        Extract numerical values and their contexts

        Args:
            query: Query text

        Returns:
            List of numerical values with context
        """
        # Pattern to find numbers with optional units
        number_pattern = r"(\d+(?:\.\d+)?)\s*([a-zA-Z%]+)?"

        numerical_values = []
        for match in re.finditer(number_pattern, query):
            value = float(match.group(1))
            unit = match.group(2)

            # Get context (surrounding words)
            start = max(0, match.start() - 20)
            end = min(len(query), match.end() + 20)
            context = query[start:end].strip()

            numerical_values.append(
                {
                    "value": value,
                    "unit": unit,
                    "context": context,
                    "position": match.start(),
                }
            )

        return numerical_values

    def _analyze_sentiment(self, query: str) -> str:
        """
        Analyze query sentiment

        Args:
            query: Query text

        Returns:
            Sentiment classification
        """
        positive_words = [
            "good",
            "great",
            "excellent",
            "amazing",
            "wonderful",
            "perfect",
            "love",
            "best",
            "awesome",
            "fantastic",
        ]
        negative_words = [
            "bad",
            "terrible",
            "awful",
            "horrible",
            "worst",
            "hate",
            "poor",
            "disappointing",
            "frustrating",
        ]

        query_lower = query.lower()

        positive_count = sum(1 for word in positive_words if word in query_lower)
        negative_count = sum(1 for word in negative_words if word in query_lower)

        if positive_count > negative_count:
            return "positive"
        elif negative_count > positive_count:
            return "negative"
        else:
            return "neutral"

    def _assess_urgency(self, query: str) -> str:
        """
        Assess query urgency

        Args:
            query: Query text

        Returns:
            Urgency level
        """
        urgent_words = [
            "urgent",
            "emergency",
            "immediately",
            "asap",
            "critical",
            "important",
            "priority",
            "quickly",
            "fast",
            "soon",
        ]

        query_lower = query.lower()
        urgent_count = sum(1 for word in urgent_words if word in query_lower)

        if urgent_count >= 2:
            return "high"
        elif urgent_count == 1:
            return "medium"
        else:
            return "normal"

    def _detect_domain(
        self, query: str, keywords: List[str], entities: List[QueryEntity]
    ) -> Optional[str]:
        """
        Detect query domain based on vocabulary and entities

        Args:
            query: Query text
            keywords: Extracted keywords
            entities: Extracted entities

        Returns:
            Detected domain or None
        """
        query_lower = query.lower()
        all_terms = keywords + [entity.text.lower() for entity in entities]

        domain_scores = {}
        for domain, vocabulary in self._domain_vocabulary.items():
            score = sum(1 for term in vocabulary if term in query_lower)
            score += sum(1 for term in vocabulary if term in all_terms)
            domain_scores[domain] = score

        # Return domain with highest score if significant
        best_domain = max(domain_scores, key=domain_scores.get)
        if domain_scores[best_domain] >= 2:
            return best_domain

        return None

    def _detect_language(self, query: str) -> str:
        """
        Detect query language

        Args:
            query: Query text

        Returns:
            Language code
        """
        # Simple language detection based on common words
        english_words = ["the", "and", "is", "are", "was", "were", "have", "has"]
        query_lower = query.lower()
        words = query_lower.split()

        if len(words) == 0:
            return "en"

        english_ratio = sum(1 for word in english_words if word in words) / len(words)

        if english_ratio > 0.1:
            return "en"
        else:
            # Default to English for now
            return "en"

    def _generate_search_hints(
        self,
        query: str,
        intent: QueryIntent,
        entities: List[QueryEntity],
        keywords: List[str],
    ) -> Dict[str, Any]:
        """
        Generate search hints for better retrieval

        Args:
            query: Query text
            intent: Query intent
            entities: Extracted entities
            keywords: Extracted keywords

        Returns:
            Search hints dictionary
        """
        hints = {
            "boost_recent": False,
            "boost_authoritative": False,
            "prefer_long_content": False,
            "prefer_short_content": False,
            "include_definitions": False,
            "include_examples": False,
            "filter_by_date": None,
            "filter_by_entity_types": [],
            "suggested_result_types": [],
        }

        query_lower = query.lower()

        # Time-based hints
        if any(word in query_lower for word in ["recent", "latest", "new", "current"]):
            hints["boost_recent"] = True

        # Authority hints
        if any(
            word in query_lower
            for word in ["research", "study", "scientific", "academic"]
        ):
            hints["boost_authoritative"] = True

        # Content length hints
        if intent == QueryIntent.DEFINITION:
            hints["prefer_short_content"] = True
            hints["include_definitions"] = True
        elif intent == QueryIntent.PROCEDURAL:
            hints["prefer_long_content"] = True
            hints["include_examples"] = True

        # Entity type filters
        if entities:
            hints["filter_by_entity_types"] = [entity.label for entity in entities]

        # Result type suggestions
        if intent == QueryIntent.QUESTION:
            hints["suggested_result_types"] = ["answer", "explanation"]
        elif intent == QueryIntent.PROCEDURAL:
            hints["suggested_result_types"] = ["tutorial", "guide", "steps"]
        elif intent == QueryIntent.COMPARISON:
            hints["suggested_result_types"] = ["comparison", "analysis"]

        return hints

    async def _expand_query(
        self,
        query: str,
        keywords: List[str],
        entities: List[QueryEntity],
        domain: Optional[str],
        context: Optional[QueryContext],
    ) -> ExpandedQuery:
        """
        Expand query with related terms and concepts

        Args:
            query: Original query
            keywords: Extracted keywords
            entities: Extracted entities
            domain: Detected domain
            context: Query context

        Returns:
            Expanded query information
        """
        try:
            # Generate synonyms
            synonyms = await self._generate_synonyms(keywords)

            # Generate related concepts
            related_concepts = await self._generate_related_concepts(keywords, domain)

            # Create weighted terms
            weighted_terms = []
            for keyword in keywords:
                weight = 1.0
                # Boost weight for entities
                if any(entity.text.lower() == keyword.lower() for entity in entities):
                    weight = 1.5
                weighted_terms.append((keyword, weight))

            # Create boolean query
            boolean_query = self._create_boolean_query(keywords, synonyms, entities)

            # Create expanded terms list
            expanded_terms = []
            for keyword in keywords:
                term = QueryTerm(
                    term=keyword,
                    weight=1.0,
                    term_type="keyword",
                    importance=0.8,
                    synonyms=self._get_term_synonyms(keyword),
                    related_terms=self._get_related_terms(keyword, domain),
                )
                expanded_terms.append(term)

            # Determine expansion method and confidence
            if len(synonyms) > len(keywords) * 0.5:
                expansion_method = "semantic_expansion"
                expansion_confidence = 0.8
            elif len(related_concepts) > 0:
                expansion_method = "conceptual_expansion"
                expansion_confidence = 0.7
            else:
                expansion_method = "basic_expansion"
                expansion_confidence = 0.6

            return ExpandedQuery(
                original_query=query,
                expanded_terms=expanded_terms,
                related_concepts=related_concepts,
                synonyms=synonyms,
                boolean_query=boolean_query,
                weighted_terms=weighted_terms,
                expansion_method=expansion_method,
                expansion_confidence=expansion_confidence,
            )

        except Exception as e:
            logger.warning(f"Query expansion failed: {e}")
            # Return basic expansion
            return ExpandedQuery(
                original_query=query,
                expanded_terms=[],
                related_concepts=[],
                synonyms=[],
                boolean_query=query,
                weighted_terms=[],
                expansion_method="basic",
                expansion_confidence=0.5,
            )

    async def _generate_synonyms(self, keywords: List[str]) -> List[str]:
        """
        Generate synonyms for keywords

        Args:
            keywords: List of keywords

        Returns:
            List of synonyms
        """
        synonyms = []

        # Basic synonym dictionary
        synonym_dict = {
            "get": ["obtain", "retrieve", "fetch", "acquire"],
            "show": ["display", "present", "reveal", "demonstrate"],
            "find": ["locate", "search", "discover", "identify"],
            "create": ["make", "build", "generate", "develop"],
            "help": ["assist", "support", "aid", "guide"],
            "information": ["data", "details", "facts", "knowledge"],
            "problem": ["issue", "challenge", "difficulty", "obstacle"],
            "solution": ["answer", "resolution", "fix", "approach"],
        }

        for keyword in keywords:
            if keyword in synonym_dict:
                synonyms.extend(synonym_dict[keyword])

        return list(set(synonyms))

    async def _generate_related_concepts(
        self, keywords: List[str], domain: Optional[str]
    ) -> List[str]:
        """
        Generate related concepts based on domain knowledge

        Args:
            keywords: List of keywords
            domain: Detected domain

        Returns:
            List of related concepts
        """
        related_concepts = []

        # Domain-specific related concepts
        if domain and domain in self._domain_vocabulary:
            domain_vocabulary = self._domain_vocabulary[domain]
            for keyword in keywords:
                # Find conceptually related terms in domain vocabulary
                for term in domain_vocabulary:
                    if term != keyword and self._are_concepts_related(keyword, term):
                        related_concepts.append(term)

        return related_concepts

    def _are_concepts_related(self, term1: str, term2: str) -> bool:
        """
        Check if two concepts are related

        Args:
            term1: First term
            term2: Second term

        Returns:
            True if concepts are related
        """
        # Simple heuristic based on common prefixes/suffixes
        if term1.startswith(term2[:3]) or term2.startswith(term1[:3]):
            return True

        # Could be enhanced with word embeddings in a real implementation
        return False

    def _create_boolean_query(
        self, keywords: List[str], synonyms: List[str], entities: List[QueryEntity]
    ) -> str:
        """
        Create boolean query for search engines

        Args:
            keywords: Keywords
            synonyms: Synonyms
            entities: Entities

        Returns:
            Boolean query string
        """
        boolean_terms = []

        # Add original keywords
        boolean_terms.extend(keywords)

        # Add entity terms (with OR for synonyms)
        for entity in entities:
            entity_terms = [entity.text]
            entity_terms.extend(entity.synonyms)
            if len(entity_terms) > 1:
                boolean_terms.append(f"({' OR '.join(entity_terms)})")
            else:
                boolean_terms.append(entity.text)

        # Combine with AND operators
        return " AND ".join(boolean_terms)

    def _get_term_synonyms(self, term: str) -> List[str]:
        """
        Get synonyms for a specific term

        Args:
            term: Term to find synonyms for

        Returns:
            List of synonyms
        """
        # Check cache first
        if term in self._synonym_cache:
            return self._synonym_cache[term]

        # Basic synonym mapping
        synonym_map = {
            "get": ["obtain", "retrieve", "fetch"],
            "show": ["display", "present", "reveal"],
            "find": ["locate", "search", "discover"],
            "help": ["assist", "support", "aid"],
            "information": ["data", "details", "facts"],
            "problem": ["issue", "challenge", "difficulty"],
            "solution": ["answer", "resolution", "fix"],
        }

        synonyms = synonym_map.get(term.lower(), [])

        # Cache the result
        self._synonym_cache[term] = synonyms

        return synonyms

    def _get_related_terms(self, term: str, domain: Optional[str]) -> List[str]:
        """
        Get related terms for a specific term

        Args:
            term: Term to find related terms for
            domain: Domain context

        Returns:
            List of related terms
        """
        related_terms = []

        if domain and domain in self._domain_vocabulary:
            domain_terms = self._domain_vocabulary[domain]
            for domain_term in domain_terms:
                if self._are_concepts_related(term, domain_term):
                    related_terms.append(domain_term)

        return related_terms

    def _extract_basic_keywords(self, query: str) -> List[str]:
        """
        Basic keyword extraction as fallback

        Args:
            query: Query text

        Returns:
            List of keywords
        """
        stop_words = {
            "the",
            "a",
            "an",
            "and",
            "or",
            "but",
            "in",
            "on",
            "at",
            "to",
            "for",
            "of",
            "with",
            "by",
            "is",
            "are",
            "was",
            "were",
        }

        words = [
            word.lower()
            for word in query.split()
            if word.lower() not in stop_words and len(word) > 2
        ]

        return words[:10]  # Return top 10 words

    def _cache_query_analysis(self, query: str, analysis: QueryAnalysis) -> None:
        """
        Cache query analysis for similar queries

        Args:
            query: Original query
            analysis: Query analysis results
        """
        # Simple caching based on query hash
        query_hash = hash(query.lower())
        self._query_history[query_hash] = {
            "analysis": analysis,
            "timestamp": datetime.now(),
        }

        # Keep cache size manageable
        if len(self._query_history) > 1000:
            # Remove oldest entries
            oldest_key = min(
                self._query_history.keys(),
                key=lambda k: self._query_history[k]["timestamp"],
            )
            del self._query_history[oldest_key]

    async def get_query_suggestions(
        self, partial_query: str, max_suggestions: int = 5
    ) -> List[str]:
        """
        Get query suggestions based on partial input

        Args:
            partial_query: Partial query text
            max_suggestions: Maximum number of suggestions

        Returns:
            List of query suggestions
        """
        suggestions = []

        # Simple completion based on query history
        for cached_hash, cached_data in self._query_history.items():
            cached_query = cached_data["analysis"].original_query
            if cached_query.lower().startswith(partial_query.lower()):
                suggestions.append(cached_query)
                if len(suggestions) >= max_suggestions:
                    break

        # Add common query patterns
        common_patterns = [
            f"{partial_query} best practices",
            f"{partial_query} tutorial",
            f"{partial_query} examples",
            f"how to {partial_query}",
            f"what is {partial_query}",
        ]

        for pattern in common_patterns:
            if len(suggestions) < max_suggestions:
                suggestions.append(pattern)

        return suggestions

    async def analyze_query_batch(
        self, queries: List[str], context: Optional[QueryContext] = None
    ) -> List[QueryAnalysis]:
        """
        Analyze multiple queries in batch

        Args:
            queries: List of queries to analyze
            context: Query context

        Returns:
            List of query analyses
        """
        tasks = []
        for query in queries:
            task = self.analyze_query(query, context)
            tasks.append(task)

        return await asyncio.gather(*tasks)

    def get_service_metrics(self) -> Dict[str, Any]:
        """
        Get service performance metrics

        Returns:
            Service metrics dictionary
        """
        return {
            "cache_size": len(self._query_history),
            "entity_cache_size": len(self._entity_cache),
            "synonym_cache_size": len(self._synonym_cache),
            "nlp_model_loaded": self._nlp is not None,
            "cross_encoder_loaded": self._cross_encoder is not None,
            "supported_domains": list(self._domain_vocabulary.keys()),
            "total_queries_analyzed": len(self._query_history),
        }
