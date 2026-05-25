"""
Query Understanding Models

Data models, enums, and types for query understanding.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Dict, Any, Optional, Tuple


class QueryIntent(str, Enum):
    """Query intent classification"""

    QUESTION = "question"
    COMMAND = "command"
    SEARCH = "search"
    COMPARISON = "comparison"
    DEFINITION = "definition"
    PROCEDURAL = "procedural"
    ANALYSIS = "analysis"
    SUMMARIZATION = "summarization"
    RECOMMENDATION = "recommendation"
    EXPLANATION = "explanation"


class QueryComplexity(str, Enum):
    """Query complexity levels"""

    SIMPLE = "simple"
    MODERATE = "moderate"
    COMPLEX = "complex"
    EXPERT = "expert"


class QueryType(str, Enum):
    """Query type classification"""

    FACTUAL = "factual"
    OPINION = "opinion"
    PROCEDURAL = "procedural"
    CONCEPTUAL = "conceptual"
    TEMPORAL = "temporal"
    SPATIAL = "spatial"
    CAUSAL = "causal"
    COMPARATIVE = "comparative"


@dataclass
class QueryEntity:
    """Extracted entity from query"""

    text: str
    label: str
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
    term_type: str
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
