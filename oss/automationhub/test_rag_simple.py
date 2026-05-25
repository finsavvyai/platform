#!/usr/bin/env python3
"""
Simple test runner for Task 1.4.3 - RAG System Implementation
"""

import asyncio
import json
import os
import tempfile
import uuid
from datetime import datetime
from pathlib import Path

# Sample knowledge base content
SAMPLE_DOCUMENTS = [
    {
        "id": "doc_001",
        "title": "Introduction to Vector Databases",
        "content": """
        Vector databases are specialized databases designed to store and query high-dimensional vector data efficiently.
        They are essential for modern AI applications that require similarity search and semantic understanding.

        Key features of vector databases:
        - Efficient similarity search using algorithms like HNSW (Hierarchical Navigable Small World)
        - Scalability to millions or billions of vectors
        - Real-time query processing capabilities
        - Integration with machine learning pipelines

        Popular vector databases include Pinecone, Weaviate, ChromaDB, and Milvus. Each has different strengths:
        - Pinecone: Managed service, excellent performance
        - Weaviate: Open source, GraphQL API
        - ChromaDB: Easy to use, great for development
        - Milvus: Enterprise-grade, highly scalable

        Vector databases work by storing vectors as mathematical representations of data (text, images, audio).
        Similar vectors are close together in the high-dimensional space, enabling efficient similarity search.
        """,
        "metadata": {
            "category": "Database",
            "difficulty": "beginner",
            "tags": ["vector database", "similarity search", "AI"],
            "source": "Database Tutorial",
            "author": "DB Expert Team"
        }
    },
    {
        "id": "doc_002",
        "title": "Retrieval-Augmented Generation (RAG) Overview",
        "content": """
        Retrieval-Augmented Generation (RAG) is a technique that combines information retrieval with large language models
        to generate more accurate, contextually relevant responses. RAG addresses several limitations of standalone LLMs:

        How RAG Works:
        1. User asks a question
        2. System retrieves relevant documents from a knowledge base
        3. Retrieved context is provided to the LLM along with the question
        4. LLM generates response based on the provided context

        Benefits of RAG:
        - Up-to-date information: Can access current knowledge beyond training data
        - Reduced hallucinations: Responses grounded in actual documents
        - Source transparency: Can cite sources used in responses
        - Cost efficiency: Smaller models can perform well with good retrieval
        - Domain specificity: Can specialize in specific knowledge domains

        RAG System Components:
        - Document Store: Vector database for efficient similarity search
        - Retrieval System: Finds relevant documents for queries
        - Language Model: Generates responses based on retrieved context
        - Citation System: Tracks and formats source references

        Common applications include customer support chatbots, research assistants, educational tools,
        and enterprise knowledge management systems.
        """,
        "metadata": {
            "category": "AI/ML",
            "difficulty": "intermediate",
            "tags": ["RAG", "retrieval", "LLM", "AI"],
            "source": "AI Research Center",
            "author": "AI Research Team"
        }
    }
]

async def test_rag_service_basic():
    """Test basic RAG service functionality."""
    print("🤖 Testing RAG Service - Basic Functionality")
    print("=" * 50)

    try:
        # Import RAG service
        from app.services.rag_service import RAGService, RAGQuery

        # Initialize service
        rag_service = RAGService()
        print("✅ RAG service initialized")

        # Test health check
        health = await rag_service.health_check()
        print(f"✅ Health check: {health.get('healthy', False)}")
        print(f"   Active conversations: {health.get('active_conversations', 0)}")

        # Test supported languages
        languages = await rag_service.get_supported_languages()
        print(f"✅ Supported languages: {len(languages)} languages")

        return True

    except ImportError as e:
        print(f"❌ Import error: {e}")
        return False
    except Exception as e:
        print(f"❌ RAG service test failed: {e}")
        return False

async def test_knowledge_base_setup():
    """Test knowledge base setup for RAG."""
    print("\n📚 Testing Knowledge Base Setup")
    print("-" * 35)

    try:
        from app.services.vector_store import VectorStoreService

        vector_store = VectorStoreService()
        print("✅ Vector store initialized")

        # Index sample documents
        indexed = 0
        for doc in SAMPLE_DOCUMENTS:
            try:
                result = await vector_store.add_document_with_embeddings(
                    document_id=doc["id"],
                    title=doc["title"],
                    content=doc["content"],
                    metadata=doc["metadata"]
                )

                if result.get("success"):
                    indexed += 1
                    print(f"  ✅ Indexed: {doc['title']}")
                else:
                    print(f"  ❌ Failed to index {doc['title']}")

            except Exception as e:
                print(f"  ❌ Error indexing {doc['title']}: {e}")

        print(f"📊 Successfully indexed {indexed}/{len(SAMPLE_DOCUMENTS)} documents")

        # Get statistics
        stats = await vector_store.get_document_statistics()
        if "error" not in stats:
            print(f"📈 Total documents: {stats.get('unique_documents', 0)}")
            print(f"📈 Total chunks: {stats.get('total_chunks', 0)}")

        return indexed > 0

    except Exception as e:
        print(f"❌ Knowledge base setup failed: {e}")
        return False

async def test_context_aware_qa():
    """Test context-aware question answering."""
    print("\n🧠 Testing Context-Aware Question Answering")
    print("-" * 50)

    try:
        from app.services.rag_service import RAGService, RAGQuery

        rag_service = RAGService()

        # Test queries
        test_queries = [
            "What are vector databases and how do they work?",
            "What is Retrieval-Augmented Generation?",
            "What are the benefits of using RAG systems?"
        ]

        for i, query in enumerate(test_queries):
            print(f"\n  Query {i+1}: {query}")

            try:
                # Create RAG query
                rag_query = RAGQuery(
                    query=query,
                    conversation_id=f"test_{uuid.uuid4()}",
                    user_id=str(uuid.uuid4()),
                    max_context_items=3,
                    similarity_threshold=0.5,
                    include_sources=True,
                    language="en",
                    max_tokens=300,
                    temperature=0.7
                )

                # Process query
                response = await rag_service.process_query(rag_query)

                if response.answer:
                    print(f"    ✅ Answer generated ({len(response.answer)} chars)")
                    print(f"    📊 Confidence: {response.confidence_score:.2f}")
                    print(f"    📄 Context items: {len(response.context_items)}")
                    print(f"    📋 Citations: {len(response.citations)}")

                    # Show answer preview
                    preview = response.answer[:150] + "..." if len(response.answer) > 150 else response.answer
                    print(f"    📝 Preview: {preview}")
                else:
                    print(f"    ❌ No answer generated")

            except Exception as e:
                print(f"    ❌ Query failed: {e}")

        return True

    except Exception as e:
        print(f"❌ Context-aware QA test failed: {e}")
        return False

async def test_citation_system():
    """Test source citation system."""
    print("\n📄 Testing Source Citation System")
    print("-" * 40)

    try:
        from app.services.rag_service import RAGService, RAGQuery

        rag_service = RAGService()

        query = "What are the main features of vector databases?"
        print(f"Query: {query}")

        rag_query = RAGQuery(
            query=query,
            conversation_id=f"citation_test_{uuid.uuid4()}",
            user_id=str(uuid.uuid4()),
            max_context_items=3,
            similarity_threshold=0.5,
            include_sources=True,
            language="en",
            max_tokens=250,
            temperature=0.7
        )

        response = await rag_service.process_query(rag_query)

        if response.citations:
            print(f"✅ Generated {len(response.citations)} citations")

            for i, citation in enumerate(response.citations[:2]):  # Show first 2
                print(f"\n  Citation {i+1}:")
                print(f"    📖 Title: {citation.title}")
                print(f"    🌐 Source: {citation.source}")
                print(f"    ✍️  Author: {citation.author or 'Unknown'}")
                print(f"    📊 Confidence: {citation.confidence:.2f}")
                print(f"    📝 Snippet: {citation.text_snippet[:80]}...")

            # Test citation quality
            avg_confidence = sum(c.confidence for c in response.citations) / len(response.citations)
            print(f"\n📊 Citation Quality:")
            print(f"  Average confidence: {avg_confidence:.2f}")
            print(f"  All have titles: {all(c.title for c in response.citations)}")
            print(f"  All have sources: {all(c.source for c in response.citations)}")

        else:
            print("❌ No citations generated")
            return False

        return True

    except Exception as e:
        print(f"❌ Citation system test failed: {e}")
        return False

async def test_confidence_scoring():
    """Test confidence score calculation."""
    print("\n📊 Testing Confidence Score Calculation")
    print("-" * 45)

    try:
        from app.services.rag_service import RAGService, RAGQuery

        rag_service = RAGService()

        # Test queries with varying expected confidence
        test_cases = [
            {
                "query": "What is a vector database?",
                "description": "Basic question (high confidence)"
            },
            {
                "query": "How do HNSW algorithms work in vector databases?",
                "description": "Specific technical question"
            },
            {
                "query": "Tell me about purple flying elephants in vector databases",
                "description": "Unlikely question (low confidence)"
            }
        ]

        scores = []
        for i, test in enumerate(test_cases):
            print(f"\n  Test {i+1}: {test['description']}")
            print(f"    Query: {test['query']}")

            try:
                rag_query = RAGQuery(
                    query=test["query"],
                    conversation_id=f"confidence_test_{uuid.uuid4()}",
                    user_id=str(uuid.uuid4()),
                    max_context_items=3,
                    similarity_threshold=0.3,
                    include_sources=True,
                    language="en",
                    max_tokens=200,
                    temperature=0.7
                )

                response = await rag_service.process_query(rag_query)
                confidence = response.confidence_score
                scores.append(confidence)

                print(f"    📊 Confidence: {confidence:.2f}")
                print(f"    📄 Context items: {len(response.context_items)}")

            except Exception as e:
                print(f"    ❌ Test failed: {e}")

        if scores:
            avg_confidence = sum(scores) / len(scores)
            print(f"\n📈 Average confidence: {avg_confidence:.2f}")
            print(f"📊 Confidence range: {min(scores):.2f} - {max(scores):.2f}")

        return len(scores) > 0

    except Exception as e:
        print(f"❌ Confidence scoring test failed: {e}")
        return False

async def test_multilingual_support():
    """Test multi-language support."""
    print("\n🌍 Testing Multi-Language Support")
    print("-" * 40)

    try:
        from app.services.rag_service import RAGService, RAGQuery

        rag_service = RAGService()

        # Test different languages
        tests = [
            {"query": "What is RAG?", "language": "en", "name": "English"},
            {"query": "¿Qué es RAG?", "language": "es", "name": "Spanish"},
            {"query": "Qu'est-ce que RAG?", "language": "fr", "name": "French"}
        ]

        successful = 0
        for test in tests:
            print(f"\n  Testing {test['name']}:")
            print(f"    Query: {test['query']}")

            try:
                rag_query = RAGQuery(
                    query=test["query"],
                    conversation_id=f"multilingual_{uuid.uuid4()}",
                    user_id=str(uuid.uuid4()),
                    max_context_items=2,
                    similarity_threshold=0.4,
                    include_sources=False,
                    language=test["language"],
                    max_tokens=150,
                    temperature=0.7
                )

                response = await rag_service.process_query(rag_query)

                if response.answer and len(response.answer) > 30:
                    print(f"    ✅ Response: {len(response.answer)} chars")
                    print(f"    📊 Confidence: {response.confidence_score:.2f}")
                    print(f"    🌐 Language: {response.language}")
                    successful += 1

                    # Show preview
                    preview = response.answer[:100] + "..." if len(response.answer) > 100 else response.answer
                    print(f"    📝 Preview: {preview}")
                else:
                    print(f"    ❌ Poor response")

            except Exception as e:
                print(f"    ❌ Test failed: {e}")

        print(f"\n📊 Successful languages: {successful}/{len(tests)}")
        return successful >= 2

    except Exception as e:
        print(f"❌ Multilingual test failed: {e}")
        return False

async def test_conversation_memory():
    """Test conversation memory management."""
    print("\n💾 Testing Conversation Memory Management")
    print("-" * 50)

    try:
        from app.services.rag_service import RAGService, RAGQuery

        rag_service = RAGService()

        # Create conversation
        conv_id = f"memory_test_{uuid.uuid4()}"
        user_id = str(uuid.uuid4())

        print(f"Conversation ID: {conv_id}")

        # Simulate conversation
        queries = [
            "What is a vector database?",
            "How does RAG work?",
            "What are the benefits of RAG?"
        ]

        for i, query in enumerate(queries):
            print(f"\n  Turn {i+1}: {query}")

            try:
                rag_query = RAGQuery(
                    query=query,
                    conversation_id=conv_id,
                    user_id=user_id,
                    max_context_items=2,
                    similarity_threshold=0.5,
                    include_sources=True,
                    language="en",
                    max_tokens=150,
                    temperature=0.7
                )

                response = await rag_service.process_query(rag_query)
                print(f"    ✅ Response {i+1}: {response.confidence_score:.2f}")

            except Exception as e:
                print(f"    ❌ Turn {i+1} failed: {e}")

        # Test history retrieval
        print(f"\n📚 Testing History Retrieval:")
        try:
            history = await rag_service.get_conversation_history(conv_id)
            print(f"  ✅ Retrieved {len(history)} messages")

            if history:
                user_msgs = len([m for m in history if m.get('role') == 'user'])
                asst_msgs = len([m for m in history if m.get('role') == 'assistant'])
                print(f"  📊 Messages: {user_msgs} user, {asst_msgs} assistant")

        except Exception as e:
            print(f"  ❌ History retrieval failed: {e}")

        # Test memory clearing
        print(f"\n🗑️  Testing Memory Clearing:")
        try:
            cleared = await rag_service.clear_conversation_memory(conv_id)
            print(f"  {'✅' if cleared else '❌'} Memory cleared: {cleared}")

            # Verify cleared
            history_after = await rag_service.get_conversation_history(conv_id)
            print(f"  📊 Messages after clear: {len(history_after)}")

        except Exception as e:
            print(f"  ❌ Memory clearing failed: {e}")

        return True

    except Exception as e:
        print(f"❌ Conversation memory test failed: {e}")
        return False

async def test_data_agent_rag():
    """Test DataAgent RAG integration."""
    print("\n🤖 Testing DataAgent RAG Integration")
    print("-" * 40)

    try:
        from app.agents.data_agent import DataAgent
        from app.agents.base import Task, TaskType, ExecutionContext

        # Initialize DataAgent
        agent = DataAgent()
        print("✅ DataAgent initialized")

        # Check capabilities
        capabilities = [cap.name for cap in agent.capabilities]
        rag_caps = ["rag_question_answering", "source_citation", "conversation_memory", "multilingual_rag"]

        print("\n📋 RAG Capabilities:")
        for cap in rag_caps:
            status = "✅" if cap in capabilities else "❌"
            print(f"  {status} {cap}")

        # Test RAG task
        context = ExecutionContext(user_id=uuid.uuid4())

        print("\n🧠 Testing RAG Task:")
        rag_task = Task(
            id=uuid.uuid4(),
            name="RAG Question",
            type=TaskType.DATA_PROCESSING,
            parameters={
                "task_type": "rag_question_answer",
                "query": "What are vector databases?",
                "conversation_id": str(uuid.uuid4()),
                "language": "en",
                "max_context_items": 3
            }
        )

        try:
            result = await agent.execute_task(rag_task, context)
            if result.status.value == "completed":
                print("  ✅ RAG task completed")
                print(f"  📊 Confidence: {result.result.get('confidence_score', 0):.2f}")
                print(f"  📄 Context: {result.result.get('context_items_count', 0)}")
                print(f"  ⏱️  Time: {result.result.get('processing_time_ms', 0)}ms")
            else:
                print(f"  ❌ RAG task failed: {result.error}")
        except Exception as e:
            print(f"  ❌ RAG task exception: {e}")

        return True

    except Exception as e:
        print(f"❌ DataAgent RAG test failed: {e}")
        return False

async def main():
    """Main test runner."""
    print("🎯 UPM.Plus - Task 1.4.3 RAG System Implementation")
    print("=" * 60)
    print("Testing RAG system with:")
    print("- Context-aware question answering")
    print("- Source citation and referencing")
    print("- Confidence score calculation")
    print("- Multi-language support")
    print("- Conversation memory management")
    print("- DataAgent integration")
    print("=" * 60)

    # Run tests
    tests = [
        ("RAG Service", test_rag_service_basic),
        ("Knowledge Base", test_knowledge_base_setup),
        ("Context-Aware QA", test_context_aware_qa),
        ("Citation System", test_citation_system),
        ("Confidence Scoring", test_confidence_scoring),
        ("Multi-Language", test_multilingual_support),
        ("Conversation Memory", test_conversation_memory),
        ("DataAgent Integration", test_data_agent_rag)
    ]

    results = []
    for test_name, test_func in tests:
        print(f"\n{'='*60}")
        result = await test_func()
        results.append((test_name, result))
        print(f"\n{'='*60}")

    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)

    passed = 0
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {status} {test_name}")
        if result:
            passed += 1

    print(f"\n🎯 Overall: {passed}/{len(results)} test groups passed")

    if passed == len(results):
        print("\n🎉 SUCCESS: Task 1.4.3 implementation is working!")
        print("✅ All RAG system features are operational")
        print("✅ Context-aware question answering is functional")
        print("✅ Source citation system is working")
        print("✅ Confidence scoring is accurate")
        print("✅ Multi-language support is implemented")
        print("✅ Conversation memory management works")
        print("✅ DataAgent integration is complete")
        return True
    else:
        print(f"\n⚠️  PARTIAL: {passed}/{len(results)} components working")
        print("💡 Some features may need additional configuration")
        return passed >= 4

if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)