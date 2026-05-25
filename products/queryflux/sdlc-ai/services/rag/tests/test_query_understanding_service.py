"""
Tests for Query Understanding Service with NLP and Intent Analysis
"""

import pytest
import asyncio
import numpy as np
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from typing import List, Dict, Any

from app.services.query_understanding_service import (
    QueryUnderstandingService,
    QueryAnalysis,
    QueryIntent,
    QueryContext,
    QueryExpansion,
    EntityExtraction,
    SentimentAnalysis,
    QueryComplexity,
    QueryType,
    QueryScope,
    ConfidenceScore,
)
from app.models.document import DocumentChunk


@pytest.fixture
def query_understanding_service():
    """Query understanding service instance"""
    return QueryUnderstandingService()


@pytest.fixture
def sample_queries():
    """Sample queries for testing"""
    return {
        "simple_factual": "What is machine learning?",
        "complex_research": "Compare and contrast the performance of transformer architectures versus recurrent neural networks in natural language processing tasks",
        "procedural": "How do I implement a convolutional neural network in Python using TensorFlow?",
        "analytical": "Analyze the impact of AI on job displacement in the manufacturing sector over the past decade",
        "opinion": "Is artificial intelligence a threat to humanity?",
        "temporal": "What were the major breakthroughs in deep learning between 2015 and 2020?",
        "comparative": "Differences between supervised and unsupervised learning algorithms",
        "domain_specific": "Explain the backpropagation algorithm in neural networks",
        "ambiguous": "ML",
        "multilingual": "¿Qué es el aprendizaje automático?",
    }


@pytest.fixture
def sample_document_chunks():
    """Sample document chunks for context"""
    chunks = []
    topics = ["machine learning", "deep learning", "neural networks", "AI ethics"]

    for i in range(20):
        topic = topics[i % len(topics)]
        chunk = DocumentChunk(
            id=f"chunk_{i}",
            document_id=f"doc_{i % 5}",
            content=f"Comprehensive information about {topic} including definitions, applications, and recent developments. "
            * 3,
            chunk_index=i,
            token_count=100,
            metadata={
                "topic": topic,
                "source_type": "academic" if i % 3 == 0 else "blog",
                "date": datetime.now() - timedelta(days=i),
                "language": "en",
            },
            embedding=np.random.rand(384).tolist(),
        )
        chunks.append(chunk)

    return chunks


class TestQueryUnderstandingService:
    """Test cases for QueryUnderstandingService"""

    @pytest.mark.asyncio
    async def test_simple_query_analysis(
        self, query_understanding_service, sample_queries
    ):
        """Test analysis of simple factual queries"""
        # Setup
        query = sample_queries["simple_factual"]

        # Execute
        analysis = await query_understanding_service.analyze_query(query)

        # Verify
        assert isinstance(analysis, QueryAnalysis)
        assert analysis.original_query == query
        assert analysis.cleaned_query is not None
        assert analysis.intent in QueryIntent
        assert isinstance(analysis.entities, list)
        assert isinstance(analysis.keywords, list)
        assert isinstance(analysis.confidence, float)
        assert 0 <= analysis.confidence <= 1

    @pytest.mark.asyncio
    async def test_complex_query_analysis(
        self, query_understanding_service, sample_queries
    ):
        """Test analysis of complex research queries"""
        # Setup
        query = sample_queries["complex_research"]

        # Execute
        analysis = await query_understanding_service.analyze_query(query)

        # Verify
        assert isinstance(analysis, QueryAnalysis)
        assert analysis.complexity in ["low", "medium", "high"]
        assert analysis.complexity == "high"
        assert len(analysis.entities) > 2  # Should extract multiple entities
        assert len(analysis.expanded_queries) > 0
        assert analysis.query_type == QueryType.RESEARCH

    @pytest.mark.asyncio
    async def test_intent_classification(
        self, query_understanding_service, sample_queries
    ):
        """Test query intent classification"""
        # Test various intents
        test_cases = [
            ("What is X", QueryIntent.FACTUAL),
            ("How to Y", QueryIntent.PROCEDURAL),
            ("Compare A and B", QueryIntent.COMPARATIVE),
            ("Analyze Z", QueryIntent.ANALYTICAL),
            ("Is X good", QueryIntent.OPINION),
            ("Find recent papers on", QueryIntent.RESEARCH),
        ]

        for query, expected_intent in test_cases:
            analysis = await query_understanding_service.analyze_query(query)
            assert analysis.intent == expected_intent, f"Failed for query: {query}"

    @pytest.mark.asyncio
    async def test_entity_extraction(self, query_understanding_service):
        """Test entity extraction from queries"""
        # Setup
        query = "How does Google's BERT compare to OpenAI's GPT-3 for NLP tasks?"

        # Execute
        entities = await query_understanding_service.extract_entities(query)

        # Verify
        assert isinstance(entities, list)
        assert len(entities) > 0

        # Check for expected entities
        entity_texts = [e.get("text", "").lower() for e in entities]
        assert "bert" in entity_texts
        assert "gpt-3" in entity_texts or "gpt3" in entity_texts
        assert "google" in entity_texts
        assert "openai" in entity_texts

        # Check entity types
        for entity in entities:
            assert "text" in entity
            assert "type" in entity
            assert "confidence" in entity
            assert 0 <= entity["confidence"] <= 1

    @pytest.mark.asyncio
    async def test_keyword_extraction(self, query_understanding_service):
        """Test keyword extraction from queries"""
        # Setup
        query = "Deep learning algorithms for computer vision and image recognition"

        # Execute
        keywords = await query_understanding_service.extract_keywords(query)

        # Verify
        assert isinstance(keywords, list)
        assert len(keywords) > 0

        # Check for expected keywords
        assert "deep learning" in keywords
        assert "computer vision" in keywords
        assert "image recognition" in keywords

    @pytest.mark.asyncio
    async def test_query_expansion(
        self, query_understanding_service, sample_document_chunks
    ):
        """Test query expansion using contextual information"""
        # Setup
        query = "ML algorithms"
        context_chunks = sample_document_chunks[:5]

        # Execute
        expansion = await query_understanding_service.expand_query(
            query, context_chunks=context_chunks
        )

        # Verify
        assert isinstance(expansion, QueryExpansion)
        assert len(expansion.expanded_queries) > 0
        assert expansion.original_query == query

        # Check for sensible expansions
        expanded_texts = [q.lower() for q in expansion.expanded_queries]
        assert any("machine" in text for text in expanded_texts)
        assert any("learning" in text for text in expanded_texts)

    @pytest.mark.asyncio
    async def test_sentiment_analysis(self, query_understanding_service):
        """Test sentiment analysis of queries"""
        # Test various sentiments
        test_cases = [
            ("What are the benefits of AI?", "positive"),
            ("Why is AI dangerous?", "negative"),
            ("How does machine learning work?", "neutral"),
            ("AI is the worst technology ever", "negative"),
            ("AI is amazing and revolutionary", "positive"),
        ]

        for query, expected_sentiment in test_cases:
            sentiment = await query_understanding_service.analyze_sentiment(query)
            assert sentiment.get("sentiment") == expected_sentiment
            assert "confidence" in sentiment

    @pytest.mark.asyncio
    async def test_query_complexity_assessment(self, query_understanding_service):
        """Test assessment of query complexity"""
        # Test queries of varying complexity
        simple_query = "What is AI?"
        complex_query = "Analyze the socio-economic implications of deploying large-scale AI systems in developing nations, considering factors such as infrastructure, education, and regulatory frameworks"

        simple_analysis = await query_understanding_service.analyze_query(simple_query)
        complex_analysis = await query_understanding_service.analyze_query(
            complex_query
        )

        # Verify complexity scores
        assert simple_analysis.complexity in ["low", "medium"]
        assert complex_analysis.complexity == "high"

        # Complexity score should be higher for complex query
        assert complex_analysis.complexity_score > simple_analysis.complexity_score

    @pytest.mark.asyncio
    async def test_query_classification(self, query_understanding_service):
        """Test query type classification"""
        # Test various query types
        test_cases = [
            ("Define neural networks", QueryType.DEFINITIONAL),
            ("How to implement backpropagation", QueryType.PROCEDURAL),
            ("Compare CNN and RNN", QueryType.COMPARATIVE),
            ("Effects of AI on employment", QueryType.ANALYTICAL),
            ("Latest research on GPT", QueryType.RESEARCH),
            ("Is AI consciousness possible", QueryType.PHILOSOPHICAL),
            ("Best ML algorithm for classification", QueryType.RECOMMENDATION),
        ]

        for query, expected_type in test_cases:
            analysis = await query_understanding_service.analyze_query(query)
            assert analysis.query_type == expected_type, f"Failed for query: {query}"

    @pytest.mark.asyncio
    async def test_temporal_query_understanding(self, query_understanding_service):
        """Test understanding of temporal aspects in queries"""
        # Setup
        temporal_queries = [
            "Recent developments in AI",
            "AI breakthroughs in 2023",
            "Machine learning trends over the last 5 years",
            "Future of artificial intelligence",
        ]

        for query in temporal_queries:
            analysis = await query_understanding_service.analyze_query(query)

            # Check temporal context extraction
            if analysis.context:
                assert hasattr(analysis.context, "time_frame")
                assert hasattr(analysis.context, "recency_bias")
                assert hasattr(analysis.context, "temporal_scope")

    @pytest.mark.asyncio
    async def test_domain_identification(self, query_understanding_service):
        """Test identification of query domain"""
        # Test queries from different domains
        domain_test_cases = [
            ("Backpropagation in neural networks", "machine_learning"),
            ("SQL database optimization", "database"),
            ("React component lifecycle", "web_development"),
            ("TCP vs UDP protocols", "networking"),
            ("Quantum computing basics", "quantum_computing"),
        ]

        for query, expected_domain in domain_test_cases:
            analysis = await query_understanding_service.analyze_query(query)
            if analysis.context:
                assert analysis.context.domain == expected_domain

    @pytest.mark.asyncio
    async def test_query_ambiguity_detection(self, query_understanding_service):
        """Test detection of ambiguous queries"""
        # Test ambiguous queries
        ambiguous_queries = [
            "ML",
            "AI",
            "DB",
            "API",
            "JS",
        ]

        for query in ambiguous_queries:
            analysis = await query_understanding_service.analyze_query(query)

            # Should detect ambiguity
            assert analysis.is_ambiguous is True
            assert len(analysis.clarification_suggestions) > 0
            assert analysis.confidence < 0.7  # Lower confidence for ambiguous queries

    @pytest.mark.asyncio
    async def test_query_personalization(self, query_understanding_service):
        """Test query personalization based on user profile"""
        # Setup
        query = "Best algorithms for text classification"
        user_profile = {
            "expertise_level": "expert",
            "preferred_domains": ["nlp", "machine_learning"],
            "recent_queries": ["bert", "transformers", "attention"],
            "language": "en",
        }

        # Execute
        analysis = await query_understanding_service.analyze_query(
            query, user_profile=user_profile
        )

        # Verify personalization was applied
        assert analysis.personalization_applied is True
        assert len(analysis.personalized_expansions) > 0

        # Should include domain-specific terms
        personalized_terms = " ".join(analysis.personalized_expansions).lower()
        assert any(
            term in personalized_terms for term in ["transformer", "bert", "attention"]
        )

    @pytest.mark.asyncio
    async def test_multilingual_query_support(
        self, query_understanding_service, sample_queries
    ):
        """Test support for multilingual queries"""
        # Setup
        query = sample_queries["multilingual"]  # Spanish query

        # Execute
        analysis = await query_understanding_service.analyze_query(query)

        # Verify
        assert isinstance(analysis, QueryAnalysis)
        assert analysis.detected_language == "es"
        assert analysis.translated_query is not None
        assert "machine learning" in analysis.translated_query.lower()

    @pytest.mark.asyncio
    async def test_query_correction(self, query_understanding_service):
        """Test query spelling and grammar correction"""
        # Test misspelled queries
        misspelled_queries = [
            "wat is machin lerning",
            "how to implment neural netwroks",
            "deeep lerning algrithms",
        ]

        for query in misspelled_queries:
            analysis = await query_understanding_service.analyze_query(query)

            # Should detect and correct spelling
            assert analysis.corrected_query is not None
            assert analysis.corrected_query != query
            assert analysis.corrections_applied is True

    @pytest.mark.asyncio
    async def test_batch_query_analysis(
        self, query_understanding_service, sample_queries
    ):
        """Test batch analysis of multiple queries"""
        # Setup
        queries = list(sample_queries.values())[:5]

        # Execute
        results = await query_understanding_service.batch_analyze_queries(queries)

        # Verify
        assert isinstance(results, list)
        assert len(results) == len(queries)

        for result in results:
            assert isinstance(result, QueryAnalysis)
            assert result.original_query in queries

    @pytest.mark.asyncio
    async def test_query_similarity_calculation(self, query_understanding_service):
        """Test calculation of query similarity"""
        # Setup
        query1 = "What is deep learning?"
        query2 = "Explain deep learning concepts"
        query3 = "How to cook pasta"

        # Execute
        similarity_1_2 = await query_understanding_service.calculate_similarity(
            query1, query2
        )
        similarity_1_3 = await query_understanding_service.calculate_similarity(
            query1, query3
        )

        # Verify
        assert 0 <= similarity_1_2 <= 1
        assert 0 <= similarity_1_3 <= 1
        assert (
            similarity_1_2 > similarity_1_3
        )  # query1 and query2 should be more similar

    @pytest.mark.asyncio
    async def test_query_rewriting(self, query_understanding_service):
        """Test query rewriting for better retrieval"""
        # Setup
        original_query = "stuff about AI"

        # Execute
        rewritten_queries = await query_understanding_service.rewrite_query(
            original_query
        )

        # Verify
        assert isinstance(rewritten_queries, list)
        assert len(rewritten_queries) > 0

        # Rewritten queries should be more specific
        for rewritten in rewritten_queries:
            assert len(rewritten) > len(original_query)
            assert (
                "artificial intelligence" in rewritten.lower()
                or "ai" in rewritten.lower()
            )

    @pytest.mark.asyncio
    async def test_context_aware_understanding(
        self, query_understanding_service, sample_document_chunks
    ):
        """Test query understanding with context"""
        # Setup
        query = "It"
        context_chunks = sample_document_chunks[:3]

        # Execute with context
        analysis_with_context = await query_understanding_service.analyze_query(
            query, context_chunks=context_chunks
        )

        # Execute without context
        analysis_without_context = await query_understanding_service.analyze_query(
            query
        )

        # Verify
        assert analysis_with_context.context_resolution is not None
        assert analysis_with_context.resolved_query is not None
        assert len(analysis_with_context.resolved_query) > len(query)
        assert analysis_with_context.confidence > analysis_without_context.confidence

    @pytest.mark.asyncio
    async def test_query_caching(self, query_understanding_service):
        """Test query analysis caching"""
        # Setup
        query = "What is artificial intelligence?"

        # First analysis
        result1 = await query_understanding_service.analyze_query(query)

        # Second analysis (should use cache)
        result2 = await query_understanding_service.analyze_query(query)

        # Verify
        assert result1.original_query == result2.original_query
        assert result1.cleaned_query == result2.cleaned_query
        assert result1.confidence == result2.confidence

    @pytest.mark.asyncio
    async def test_query_intent_confidence_scoring(self, query_understanding_service):
        """Test confidence scoring for intent classification"""
        # Clear intent query
        clear_query = "What is the definition of machine learning?"

        # Ambiguous intent query
        ambiguous_query = "ML"

        clear_analysis = await query_understanding_service.analyze_query(clear_query)
        ambiguous_analysis = await query_understanding_service.analyze_query(
            ambiguous_query
        )

        # Clear query should have higher confidence
        assert clear_analysis.confidence > ambiguous_analysis.confidence

    @pytest.mark.asyncio
    async def test_error_handling_invalid_input(self, query_understanding_service):
        """Test error handling with invalid inputs"""
        # Test empty query
        with pytest.raises(ValueError):
            await query_understanding_service.analyze_query("")

        # Test None input
        with pytest.raises(ValueError):
            await query_understanding_service.analyze_query(None)

        # Test very long query
        very_long_query = "test " * 10000
        analysis = await query_understanding_service.analyze_query(very_long_query)
        assert analysis.truncated is True

    @pytest.mark.asyncio
    async def test_performance_metrics_collection(self, query_understanding_service):
        """Test collection of performance metrics"""
        # Setup
        query = "Test query for performance metrics"

        # Execute
        analysis = await query_understanding_service.analyze_query(
            query, collect_metrics=True
        )

        # Verify
        assert hasattr(analysis, "processing_time")
        assert analysis.processing_time > 0
        assert hasattr(analysis, "memory_usage")
        assert hasattr(analysis, "cache_hit")

    @pytest.mark.asyncio
    async def test_query_understanding_configuration(self, query_understanding_service):
        """Test query understanding service configuration"""
        # Setup
        config = {
            "max_query_length": 1000,
            "enable_spell_check": True,
            "enable_translation": True,
            "supported_languages": ["en", "es", "fr", "de"],
            "cache_ttl": 3600,
            "confidence_threshold": 0.7,
        }

        # Execute
        query_understanding_service.configure(config)

        # Verify
        assert query_understanding_service.config == config

    @pytest.mark.asyncio
    async def test_concurrent_query_processing(
        self, query_understanding_service, sample_queries
    ):
        """Test concurrent processing of multiple queries"""
        # Setup
        queries = list(sample_queries.values())

        # Execute concurrent analyses
        tasks = [query_understanding_service.analyze_query(query) for query in queries]
        results = await asyncio.gather(*tasks)

        # Verify
        assert len(results) == len(queries)
        for result in results:
            assert isinstance(result, QueryAnalysis)

    def test_query_analysis_serialization(self, query_understanding_service):
        """Test serialization of query analysis results"""
        # Create a sample analysis
        analysis = QueryAnalysis(
            original_query="test query",
            cleaned_query="test query",
            intent=QueryIntent.FACTUAL,
            entities=[{"text": "test", "type": "TOPIC", "confidence": 0.9}],
            keywords=["test", "query"],
            query_type=QueryType.DEFINITIONAL,
            sentiment="neutral",
            confidence=0.95,
            complexity="low",
            complexity_score=0.3,
        )

        # Test serialization
        serialized = analysis.to_dict()

        # Verify
        assert isinstance(serialized, dict)
        assert serialized["original_query"] == "test query"
        assert serialized["intent"] == QueryIntent.FACTUAL
        assert isinstance(serialized["entities"], list)

        # Test deserialization
        deserialized = QueryAnalysis.from_dict(serialized)
        assert deserialized.original_query == analysis.original_query
        assert deserialized.intent == analysis.intent

    @pytest.mark.asyncio
    async def test_query_intent_evolution(self, query_understanding_service):
        """Test tracking of query intent evolution over time"""
        # Setup
        query_history = [
            ("AI", QueryIntent.FACTUAL),
            ("What are the types of AI?", QueryIntent.FACTUAL),
            ("Compare AI and ML", QueryIntent.COMPARATIVE),
            ("Analyze AI impact", QueryIntent.ANALYTICAL),
        ]

        # Execute
        evolution = await query_understanding_service.track_intent_evolution(
            query_history
        )

        # Verify
        assert isinstance(evolution, list)
        assert len(evolution) == len(query_history)

        # Check for progression pattern
        intents = [item["intent"] for item in evolution]
        assert QueryIntent.FACTUAL in intents
        assert QueryIntent.COMPARATIVE in intents
        assert QueryIntent.ANALYTICAL in intents
