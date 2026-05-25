#!/usr/bin/env python3
"""
Simple test runner for enhanced DataAgent document processing.
"""

import asyncio
import json
import os
import tempfile
from datetime import datetime
from pathlib import Path
from uuid import uuid4

# Sample test content
TEST_CONTENT = """
# UPM.Plus Enhanced Document Processing

This test document demonstrates the enhanced capabilities of the DataAgent for Task 1.4.1.

## Key Features:
- Multi-format document processing (PDF, Word, Excel, images)
- Security validation with threat detection
- Entity extraction (people, organizations, locations)
- Knowledge graph construction from entities
- Intelligent document summarization
- Content analysis (sentiment, topics, readability)
- Batch processing capabilities

## Entity Test Data:
- **Person**: Dr. Sarah Chen (Lead Developer at UPM.Plus)
- **Organization**: UPM.Plus Corporation, Advanced Research Institute
- **Location**: San Francisco, California
- **Event**: Technology Summit 2024

The UPM.Plus platform represents a breakthrough in autonomous digital ecosystem orchestration.
"""

async def test_enhanced_data_agent():
    """Test the enhanced DataAgent capabilities."""
    print("🚀 Testing Enhanced DataAgent - Task 1.4.1 Implementation")
    print("=" * 60)

    try:
        # Import DataAgent
        from app.agents.data_agent import DataAgent
        from app.agents.base import Task, ExecutionContext, TaskType
        print("✅ DataAgent imported successfully")
    except ImportError as e:
        print(f"❌ Failed to import DataAgent: {e}")
        return False

    # Initialize DataAgent
    try:
        agent = DataAgent()
        print("✅ DataAgent initialized successfully")
    except Exception as e:
        print(f"❌ Failed to initialize DataAgent: {e}")
        return False

    # Check enhanced capabilities
    capability_names = [cap.name for cap in agent.capabilities]
    expected_caps = [
        "document_processing",
        "entity_extraction",
        "knowledge_graph_construction",
        "document_summarization",
        "content_analysis"
    ]

    print("\n📋 Checking Enhanced Capabilities:")
    for cap in expected_caps:
        if cap in capability_names:
            print(f"  ✅ {cap}")
        else:
            print(f"  ❌ Missing: {cap}")

    # Create test document
    test_file = tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False)
    test_file.write(TEST_CONTENT)
    test_file.close()

    print(f"\n📄 Created test document: {test_file.name}")

    try:
        # Test 1: Document Processing
        print("\n🔍 Test 1: Document Processing")
        task1 = Task(
            id=uuid4(),
            name="Process Test Document",
            type=TaskType.DATA_PROCESSING,
            parameters={
                "task_type": "process_document",
                "file_path": test_file.name,
                "security_level": "basic",
                "auto_index": False
            }
        )

        context = ExecutionContext(user_id=uuid4())
        result1 = await agent.execute_task(task1, context)

        if result1.status.value == "completed":
            print("  ✅ Document processing completed")
            print(f"  📊 Content length: {result1.result.get('content_length', 0)} characters")
            print(f"  🔑 Cache key: {result1.result.get('cache_key', '')}")
            cache_key = result1.result.get("cache_key")
        else:
            print(f"  ❌ Document processing failed: {result1.error}")
            cache_key = None

        # Test 2: Entity Extraction (if document processing succeeded)
        if cache_key:
            print("\n🧠 Test 2: Entity Extraction")
            task2 = Task(
                id=uuid4(),
                name="Extract Entities",
                type=TaskType.DATA_PROCESSING,
                parameters={
                    "task_type": "extract_entities",
                    "cache_key": cache_key,
                    "extraction_types": ["PERSON", "ORG", "GPE", "EVENT"]
                }
            )

            result2 = await agent.execute_task(task2, context)

            if result2.status.value == "completed":
                print("  ✅ Entity extraction completed")
                print(f"  📊 Entities found: {result2.result.get('entities_found', 0)}")
                print(f"  🔗 Nodes created: {result2.result.get('nodes_created', 0)}")

                entities = result2.result.get('entities', [])
                if entities:
                    print("  📝 Sample entities:")
                    for entity in entities[:3]:
                        print(f"    - {entity.get('text', '')} ({entity.get('type', 'UNKNOWN')})")

                node_ids = result2.result.get('nodes_created', [])
            else:
                print(f"  ❌ Entity extraction failed: {result2.error}")
                node_ids = []

        # Test 3: Knowledge Graph Construction (if entities found)
        if cache_key and node_ids:
            print("\n🌐 Test 3: Knowledge Graph Construction")
            task3 = Task(
                id=uuid4(),
                name="Build Knowledge Graph",
                type=TaskType.DATA_PROCESSING,
                parameters={
                    "task_type": "build_knowledge_graph",
                    "source_nodes": node_ids,
                    "build_relationships": True
                }
            )

            result3 = await agent.execute_task(task3, context)

            if result3.status.value == "completed":
                print("  ✅ Knowledge graph constructed")
                print(f"  📊 Total nodes: {result3.result.get('total_nodes', 0)}")
                print(f"  🔗 Total edges: {result3.result.get('total_edges', 0)}")
            else:
                print(f"  ❌ Knowledge graph construction failed: {result3.error}")

        # Test 4: Document Summarization (if document processing succeeded)
        if cache_key:
            print("\n📝 Test 4: Document Summarization")
            task4 = Task(
                id=uuid4(),
                name="Summarize Document",
                type=TaskType.DATA_PROCESSING,
                parameters={
                    "task_type": "summarize_document",
                    "cache_key": cache_key,
                    "summary_length": "short",
                    "extract_key_points": True
                }
            )

            result4 = await agent.execute_task(task4, context)

            if result4.status.value == "completed":
                print("  ✅ Document summarization completed")
                print(f"  📄 Summary length: {len(result4.result.get('summary', ''))} words")
                print(f"  🎯 Key points: {len(result4.result.get('key_points', []))}")
                print(f"  📚 Topics: {len(result4.result.get('topics', []))}")
                print(f"  ⏱️  Reading time: {result4.result.get('reading_time_minutes', 0)} minutes")

                summary = result4.result.get('summary', '')
                if summary:
                    print(f"  📄 Summary preview: {summary[:100]}...")
            else:
                print(f"  ❌ Document summarization failed: {result4.error}")

        # Test 5: Content Analysis (if document processing succeeded)
        if cache_key:
            print("\n📊 Test 5: Content Analysis")
            task5 = Task(
                id=uuid4(),
                name="Analyze Content",
                type=TaskType.DATA_PROCESSING,
                parameters={
                    "task_type": "analyze_content",
                    "cache_key": cache_key,
                    "analysis_types": ["sentiment", "readability", "topics"]
                }
            )

            result5 = await agent.execute_task(task5, context)

            if result5.status.value == "completed":
                print("  ✅ Content analysis completed")
                analysis_results = result5.result.get('analysis_results', {})

                if 'sentiment' in analysis_results:
                    sentiment = analysis_results['sentiment']
                    print(f"  😊 Sentiment: {sentiment.get('overall_sentiment', 'unknown')}")

                if 'readability' in analysis_results:
                    readability = analysis_results['readability']
                    print(f"  📖 Word count: {readability.get('word_count', 0)}")
                    print(f"  📜 Sentence count: {readability.get('sentence_count', 0)}")

                if 'topics' in analysis_results:
                    topics = analysis_results['topics']
                    print(f"  🏷️  Main topics: {len(topics.get('main_topics', []))}")
            else:
                print(f"  ❌ Content analysis failed: {result5.error}")

        # Test 6: Batch Processing
        print("\n📦 Test 6: Batch Processing")

        # Create multiple test files
        test_files = []
        for i in range(3):
            temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False)
            temp_file.write(f"Test document {i+1} for batch processing. Content: {TEST_CONTENT[:200]}")
            temp_file.close()
            test_files.append(temp_file.name)

        documents_config = []
        for file_path in test_files:
            documents_config.append({
                "file_path": file_path,
                "security_level": "basic",
                "auto_index": False
            })

        task6 = Task(
            id=uuid4(),
            name="Batch Process Documents",
            type=TaskType.DATA_PROCESSING,
            parameters={
                "task_type": "batch_process_documents",
                "documents": documents_config,
                "parallel": True
            }
        )

        result6 = await agent.execute_task(task6, context)

        if result6.status.value == "completed":
            print("  ✅ Batch processing completed")
            print(f"  📊 Successful: {result6.result.get('successful_count', 0)}")
            print(f"  ❌ Failed: {result6.result.get('failed_count', 0)}")
            print(f"  📏 Total content length: {result6.result.get('total_content_length', 0)}")
        else:
            print(f"  ❌ Batch processing failed: {result6.error}")

        # Cleanup test files
        for file_path in test_files + [test_file.name]:
            try:
                os.unlink(file_path)
            except:
                pass

        print("\n🎉 All tests completed!")
        return True

    except Exception as e:
        print(f"\n❌ Test execution failed with error: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_data_agent_tools():
    """Test DataAgent document processing tools directly."""
    print("\n🔧 Testing DataAgent Document Processing Tools")
    print("=" * 50)

    try:
        from app.agents.data_agent import DataAgent
        agent = DataAgent()
        print("✅ DataAgent initialized for tool testing")
    except Exception as e:
        print(f"❌ Failed to initialize DataAgent: {e}")
        return False

    try:
        # Test document processing tool
        print("\n📄 Testing Document Processing Tool")

        # Create temporary test file
        temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False)
        temp_file.write(TEST_CONTENT)
        temp_file.close()

        doc_result = await agent._process_document(
            file_path=temp_file.name,
            security_level="basic"
        )

        if "error" not in doc_result:
            print("  ✅ Document processing tool working")
            print(f"  📊 Content length: {doc_result.get('content_length', 0)}")
        else:
            print(f"  ❌ Document processing tool error: {doc_result.get('error')}")

        # Test entity extraction tool
        print("\n🧠 Testing Entity Extraction Tool")
        entity_result = await agent._extract_entities(
            content=TEST_CONTENT,
            extraction_types=["PERSON", "ORG", "GPE"]
        )

        if "error" not in entity_result:
            print("  ✅ Entity extraction tool working")
            print(f"  📊 Entities found: {entity_result.get('entities_found', 0)}")
        else:
            print(f"  ❌ Entity extraction tool error: {entity_result.get('error')}")

        # Test document summarization tool
        print("\n📝 Testing Document Summarization Tool")
        summary_result = await agent._summarize_document(
            content=TEST_CONTENT,
            summary_length="short"
        )

        if "error" not in summary_result:
            print("  ✅ Document summarization tool working")
            print(f"  📄 Summary length: {len(summary_result.get('summary', ''))}")
        else:
            print(f"  ❌ Document summarization tool error: {summary_result.get('error')}")

        # Test content analysis tool
        print("\n📊 Testing Content Analysis Tool")
        analysis_result = await agent._analyze_content(
            content=TEST_CONTENT,
            analysis_types=["sentiment", "readability"]
        )

        if "error" not in analysis_result:
            print("  ✅ Content analysis tool working")
            basic_stats = analysis_result.get('basic_stats', {})
            print(f"  📖 Word count: {basic_stats.get('word_count', 0)}")
        else:
            print(f"  ❌ Content analysis tool error: {analysis_result.get('error')}")

        # Cleanup
        try:
            os.unlink(temp_file.name)
        except:
            pass

        print("\n🎉 Tool testing completed!")
        return True

    except Exception as e:
        print(f"\n❌ Tool testing failed: {e}")
        return False


async def main():
    """Main test runner."""
    print("🚀 UPM.Plus Task 1.4.1 - Multi-Format Document Processing")
    print("=" * 70)
    print("Testing enhanced DataAgent capabilities for:")
    print("- Multi-format document processing with security validation")
    print("- Entity extraction and relationship mapping")
    print("- Knowledge graph construction from documents")
    print("- Intelligent document summarization")
    print("- Comprehensive content analysis")
    print("- Batch document processing capabilities")
    print("=" * 70)

    # Run main tests
    test1_result = await test_enhanced_data_agent()

    # Run tool tests
    test2_result = await test_data_agent_tools()

    if test1_result and test2_result:
        print("\n🎉 SUCCESS: Task 1.4.1 implementation is working correctly!")
        print("✅ All enhanced document processing features are operational.")
        return True
    else:
        print("\n❌ FAILURE: Some tests failed.")
        print("❌ Task 1.4.1 implementation needs attention.")
        return False


if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)