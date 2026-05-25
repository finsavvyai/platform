#!/usr/bin/env python3
"""
Test suite for enhanced DataAgent multi-format document processing capabilities.

Tests the new Task 1.4.1 features:
- Multi-format document processing with security validation
- Entity extraction and relationship mapping
- Knowledge graph construction
- Document summarization and content analysis
- Batch processing capabilities
"""

import asyncio
import json
import os
import tempfile
import pytest
from datetime import datetime
from pathlib import Path
from typing import Dict, Any
from uuid import uuid4

# Test dependencies
try:
    import pytest_asyncio
    HAS_PYTEST_ASYNCIO = True
except ImportError:
    HAS_PYTEST_ASYNCIO = False

try:
    import pandas as pd
    HAS_PANDAS = True
except ImportError:
    HAS_PANDAS = False

# Import DataAgent
try:
    from app.agents.data_agent import (
        DataAgent, DocumentProcessingTask, KnowledgeGraphNode,
        KnowledgeGraphEdge, DocumentSummary
    )
    HAS_DATA_AGENT = True
except ImportError:
    HAS_DATA_AGENT = False
    DataAgent = None

# Test configurations
TEST_DOCUMENTS_DIR = "test_documents"
SAMPLE_TEXT_CONTENT = """
# Advanced Document Processing Test Document

This is a test document designed to evaluate the enhanced document processing capabilities
of the UPM.Plus DataAgent. It contains various elements that should be processed:

## Key Features Test Coverage:

1. **Multi-format processing** - Support for PDF, Word, Excel, images
2. **Security validation** - Threat detection and malware scanning
3. **Entity extraction** - Identifying people, organizations, locations
4. **Knowledge graphs** - Building relationships between entities
5. **Content analysis** - Sentiment, topics, readability
6. **Summarization** - Intelligent document summaries

## Entity References:

- **People**: Dr. Sarah Chen (Lead Researcher), Prof. Michael Rodriguez (Project Advisor)
- **Organizations**: UPM.Plus Corporation, Advanced Research Institute, MIT
- **Locations**: San Francisco, California, USA
- **Events**: Annual Technology Conference 2024, Product Launch Meeting

## Technical Content:

The UPM.Plus platform integrates multiple AI agents including:
- Browser automation agents
- Infrastructure management agents
- Conversational AI agents
- Data processing agents (like this DataAgent)

The system uses vector embeddings for semantic search and knowledge management.

## Conclusion:

This test document demonstrates the comprehensive document processing capabilities required for Task 1.4.1 completion.
"""

class TestDataAgentDocumentProcessing:
    """Test suite for DataAgent multi-format document processing."""

    @pytest.fixture
    def data_agent(self):
        """Initialize DataAgent for testing."""
        if not HAS_DATA_AGENT:
            pytest.skip("DataAgent not available")

        agent = DataAgent()
        return agent

    @pytest.fixture
    def test_documents_dir(self):
        """Create test documents directory."""
        os.makedirs(TEST_DOCUMENTS_DIR, exist_ok=True)
        yield TEST_DOCUMENTS_DIR

        # Cleanup
        import shutil
        shutil.rmtree(TEST_DOCUMENTS_DIR, ignore_errors=True)

    @pytest.fixture
    def sample_text_file(self, test_documents_dir):
        """Create sample text file for testing."""
        file_path = os.path.join(test_documents_dir, "test_document.txt")
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(SAMPLE_TEXT_CONTENT)
        return file_path

    @pytest.fixture
    def sample_json_file(self, test_documents_dir):
        """Create sample JSON file for testing."""
        json_data = {
            "title": "UPM.Plus Test Data",
            "version": "1.0",
            "features": [
                "Multi-format document processing",
                "Entity extraction",
                "Knowledge graph construction",
                "Security validation"
            ],
            "metadata": {
                "author": "Test Author",
                "created": datetime.now().isoformat(),
                "document_type": "test_data"
            }
        }

        file_path = os.path.join(test_documents_dir, "test_data.json")
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(json_data, f, indent=2)
        return file_path

    @pytest.fixture
    def sample_csv_file(self, test_documents_dir):
        """Create sample CSV file for testing."""
        if not HAS_PANDAS:
            pytest.skip("Pandas not available for CSV test")

        csv_data = pd.DataFrame({
            'name': ['Alice Johnson', 'Bob Smith', 'Carol Davis', 'David Wilson'],
            'organization': ['UPM.Plus', 'Advanced Research', 'MIT', 'Test Corp'],
            'role': ['Research Lead', 'Project Advisor', 'Developer', 'Analyst'],
            'location': ['San Francisco', 'Boston', 'Cambridge', 'New York'],
            'years_experience': [8, 12, 3, 6]
        })

        file_path = os.path.join(test_documents_dir, "test_data.csv")
        csv_data.to_csv(file_path, index=False)
        return file_path

    class TestBasicDocumentProcessing:
        """Test basic document processing functionality."""

        @pytest.mark.asyncio
        async def test_agent_initialization(self, data_agent):
            """Test DataAgent initialization with document processing capabilities."""
            assert data_agent.name == "DataAgent"

            # Check that enhanced capabilities are present
            capability_names = [cap.name for cap in data_agent.capabilities]
            expected_caps = [
                "document_processing",
                "entity_extraction",
                "knowledge_graph_construction",
                "document_summarization",
                "content_analysis"
            ]

            for cap in expected_caps:
                assert cap in capability_names, f"Missing capability: {cap}"

        @pytest.mark.asyncio
        async def test_document_processor_integration(self, data_agent):
            """Test integration with document processor service."""
            # Check if document processor is available
            assert hasattr(data_agent, 'document_processor')
            # Note: May be None if dependencies missing

            # Check new data structures
            assert hasattr(data_agent, 'processing_tasks')
            assert hasattr(data_agent, 'document_summaries')
            assert hasattr(data_agent, 'knowledge_graph_nodes')
            assert hasattr(data_agent, 'knowledge_graph_edges')

        @pytest.mark.asyncio
        async def test_text_document_processing(self, data_agent, sample_text_file):
            """Test processing of text documents."""
            from app.agents.base import Task, ExecutionContext, TaskType

            # Create document processing task
            task = Task(
                id=uuid4(),
                name="Test Document Processing",
                type=TaskType.DATA_PROCESSING,
                parameters={
                    "task_type": "process_document",
                    "file_path": sample_text_file,
                    "security_level": "basic",
                    "auto_index": True,
                    "extract_entities": True
                }
            )

            context = ExecutionContext(user_id=uuid4())
            result = await data_agent.execute_task(task, context)

            # Validate result
            assert result.status.value == "completed"
            assert "content_length" in result.result
            assert "processing_id" in result.result
            assert result.result["content_length"] > 0

        @pytest.mark.asyncio
        async def test_json_document_processing(self, data_agent, sample_json_file):
            """Test processing of JSON documents."""
            from app.agents.base import Task, ExecutionContext, TaskType

            task = Task(
                id=uuid4(),
                name="Test JSON Processing",
                type=TaskType.DATA_PROCESSING,
                parameters={
                    "task_type": "process_document",
                    "file_path": sample_json_file,
                    "security_level": "basic"
                }
            )

            context = ExecutionContext(user_id=uuid4())
            result = await data_agent.execute_task(task, context)

            assert result.status.value == "completed"
            assert "metadata" in result.result

        @pytest.mark.asyncio
        async def test_data_extraction_task(self, data_agent, sample_csv_file):
            """Test data extraction from CSV files."""
            from app.agents.base import Task, ExecutionContext, TaskType

            task = Task(
                id=uuid4(),
                name="Test Data Extraction",
                type=TaskType.DATA_PROCESSING,
                parameters={
                    "task_type": "extract",
                    "source_type": "file",
                    "source_path": sample_csv_file
                }
            )

            context = ExecutionContext(user_id=uuid4())
            result = await data_agent.execute_task(task, context)

            assert result.status.value == "completed"
            assert "data_info" in result.result

    class TestEntityExtraction:
        """Test entity extraction and knowledge graph capabilities."""

        @pytest.mark.asyncio
        async def test_entity_extraction_from_text(self, data_agent, sample_text_file):
            """Test entity extraction from processed documents."""
            from app.agents.base import Task, ExecutionContext, TaskType

            # First process the document
            process_task = Task(
                id=uuid4(),
                name="Process for Entity Extraction",
                type=TaskType.DATA_PROCESSING,
                parameters={
                    "task_type": "process_document",
                    "file_path": sample_text_file,
                    "auto_index": False  # Don't auto-index for this test
                }
            )

            context = ExecutionContext(user_id=uuid4())
            process_result = await data_agent.execute_task(process_task, context)

            # Now extract entities
            extract_task = Task(
                id=uuid4(),
                name="Extract Entities",
                type=TaskType.DATA_PROCESSING,
                parameters={
                    "task_type": "extract_entities",
                    "cache_key": process_result.result["cache_key"],
                    "extraction_types": ["PERSON", "ORG", "GPE", "EVENT"]
                }
            )

            extract_result = await data_agent.execute_task(extract_task, context)

            assert extract_result.status.value == "completed"
            assert "entities_found" in extract_result.result
            assert "nodes_created" in extract_result.result
            assert extract_result.result["entities_found"] > 0

        @pytest.mark.asyncio
        async def test_knowledge_graph_construction(self, data_agent, sample_text_file):
            """Test knowledge graph construction from entities."""
            from app.agents.base import Task, ExecutionContext, TaskType

            # Process document and extract entities first
            process_task = Task(
                id=uuid4(),
                name="Process for Knowledge Graph",
                type=TaskType.DATA_PROCESSING,
                parameters={
                    "task_type": "process_document",
                    "file_path": sample_text_file
                }
            )

            context = ExecutionContext(user_id=uuid4())
            process_result = await data_agent.execute_task(process_task, context)

            extract_task = Task(
                id=uuid4(),
                name="Extract for Graph",
                type=TaskType.DATA_PROCESSING,
                parameters={
                    "task_type": "extract_entities",
                    "cache_key": process_result.result["cache_key"]
                }
            )

            extract_result = await data_agent.execute_task(extract_task, context)

            # Build knowledge graph
            graph_task = Task(
                id=uuid4(),
                name="Build Knowledge Graph",
                type=TaskType.DATA_PROCESSING,
                parameters={
                    "task_type": "build_knowledge_graph",
                    "source_nodes": extract_result.result["nodes_created"],
                    "build_relationships": True
                }
            )

            graph_result = await data_agent.execute_task(graph_task, context)

            assert graph_result.status.value == "completed"
            assert "edges_created" in graph_result.result
            assert "total_nodes" in graph_result.result
            assert "total_edges" in graph_result.result

    class TestDocumentSummarization:
        """Test document summarization capabilities."""

        @pytest.mark.asyncio
        async def test_document_summarization(self, data_agent, sample_text_file):
            """Test intelligent document summarization."""
            from app.agents.base import Task, ExecutionContext, TaskType

            # Process document first
            process_task = Task(
                id=uuid4(),
                name="Process for Summary",
                type=TaskType.DATA_PROCESSING,
                parameters={
                    "task_type": "process_document",
                    "file_path": sample_text_file
                }
            )

            context = ExecutionContext(user_id=uuid4())
            process_result = await data_agent.execute_task(process_task, context)

            # Generate summary
            summary_task = Task(
                id=uuid4(),
                name="Summarize Document",
                type=TaskType.DATA_PROCESSING,
                parameters={
                    "task_type": "summarize_document",
                    "cache_key": process_result.result["cache_key"],
                    "summary_length": "medium",
                    "extract_key_points": True,
                    "analyze_sentiment": True
                }
            )

            summary_result = await data_agent.execute_task(summary_task, context)

            assert summary_result.status.value == "completed"
            assert "summary" in summary_result.result
            assert "key_points" in summary_result.result
            assert "topics" in summary_result.result
            assert "sentiment" in summary_result.result
            assert "reading_time_minutes" in summary_result.result

            # Validate content
            assert len(summary_result.result["summary"]) > 10
            assert isinstance(summary_result.result["key_points"], list)
            assert isinstance(summary_result.result["topics"], list)

        @pytest.mark.asyncio
        async def test_content_analysis(self, data_agent, sample_text_file):
            """Test comprehensive content analysis."""
            from app.agents.base import Task, ExecutionContext, TaskType

            # Process document first
            process_task = Task(
                id=uuid4(),
                name="Process for Analysis",
                type=TaskType.DATA_PROCESSING,
                parameters={
                    "task_type": "process_document",
                    "file_path": sample_text_file
                }
            )

            context = ExecutionContext(user_id=uuid4())
            process_result = await data_agent.execute_task(process_task, context)

            # Analyze content
            analysis_task = Task(
                id=uuid4(),
                name="Analyze Content",
                type=TaskType.DATA_PROCESSING,
                parameters={
                    "task_type": "analyze_content",
                    "cache_key": process_result.result["cache_key"],
                    "analysis_types": ["sentiment", "topics", "readability"]
                }
            )

            analysis_result = await data_agent.execute_task(analysis_task, context)

            assert analysis_result.status.value == "completed"
            assert "analysis_results" in analysis_result.result

            results = analysis_result.result["analysis_results"]
            assert "sentiment" in results
            assert "topics" in results
            assert "readability" in results

            # Validate sentiment analysis
            if "sentiment" in results:
                assert "overall_sentiment" in results["sentiment"]

            # Validate readability analysis
            if "readability" in results:
                readability = results["readability"]
                assert "word_count" in readability
                assert "sentence_count" in readability

    class TestBatchProcessing:
        """Test batch document processing capabilities."""

        @pytest.mark.asyncio
        async def test_batch_document_processing(self, data_agent, test_documents_dir):
            """Test processing of multiple documents in batch."""
            from app.agents.base import Task, ExecutionContext, TaskType

            # Create multiple test files
            files_to_process = []
            for i in range(3):
                content = f"Test document {i+1} content. This is batch processing test {i+1}."
                file_path = os.path.join(test_documents_dir, f"batch_test_{i+1}.txt")
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                files_to_process.append(file_path)

            # Create batch processing task
            documents_config = []
            for file_path in files_to_process:
                documents_config.append({
                    "file_path": file_path,
                    "security_level": "basic",
                    "auto_index": False
                })

            batch_task = Task(
                id=uuid4(),
                name="Batch Process Documents",
                type=TaskType.DATA_PROCESSING,
                parameters={
                    "task_type": "batch_process_documents",
                    "documents": documents_config,
                    "parallel": True
                }
            )

            context = ExecutionContext(user_id=uuid4())
            batch_result = await data_agent.execute_task(batch_task, context)

            assert batch_result.status.value == "completed"
            assert "successful_count" in batch_result.result
            assert "failed_count" in batch_result.result
            assert "total_content_length" in batch_result.result

            # Validate all documents were processed
            assert batch_result.result["successful_count"] == len(files_to_process)
            assert batch_result.result["failed_count"] == 0

    class TestDocumentProcessingTools:
        """Test individual document processing tools."""

        @pytest.mark.asyncio
        async def test_document_processing_tool(self, data_agent, sample_text_file):
            """Test document processing tool directly."""
            result = await data_agent._process_document(
                file_path=sample_text_file,
                security_level="basic"
            )

            assert "success" in result
            assert "content_length" in result
            assert result["success"] == True
            assert result["content_length"] > 0

        @pytest.mark.asyncio
        async def test_entity_extraction_tool(self, data_agent):
            """Test entity extraction tool directly."""
            test_content = "Dr. Sarah Chen from UPM.Plus met with Prof. Rodriguez in San Francisco."

            result = await data_agent._extract_entities(
                content=test_content,
                extraction_types=["PERSON", "ORG", "GPE"]
            )

            assert "entities_found" in result
            assert "entities" in result
            assert result["entities_found"] > 0

        @pytest.mark.asyncio
        async def test_document_summarization_tool(self, data_agent):
            """Test document summarization tool directly."""
            test_content = SAMPLE_TEXT_CONTENT[:500]  # Use first 500 chars

            result = await data_agent._summarize_document(
                content=test_content,
                summary_length="short"
            )

            assert "summary" in result
            assert "reading_time" in result
            assert len(result["summary"]) > 0

        @pytest.mark.asyncio
        async def test_content_analysis_tool(self, data_agent):
            """Test content analysis tool directly."""
            test_content = SAMPLE_TEXT_CONTENT[:1000]  # Use first 1000 chars

            result = await data_agent._analyze_content(
                content=test_content,
                analysis_types=["sentiment", "readability"]
            )

            assert "basic_stats" in result
            assert result["basic_stats"]["word_count"] > 0
            assert result["basic_stats"]["sentence_count"] > 0

    @pytest.mark.asyncio
    async def test_data_agent_collaboration_contribution(self, data_agent):
        """Test DataAgent's collaboration contribution."""
        result = await data_agent._contribute_to_collaboration(
            objective="Process and analyze research documents for knowledge extraction"
        )

        assert "agent_id" in result
        assert "capabilities" in result
        assert "suggested_actions" in result

        # Verify document processing capabilities are included
        capabilities = result["capabilities"]
        expected_capabilities = [
            "document_processing",
            "entity_extraction",
            "knowledge_graph_construction",
            "document_summarization"
        ]

        for cap in expected_capabilities:
            assert cap in capabilities, f"Missing capability in collaboration: {cap}"


def run_comprehensive_tests():
    """Run comprehensive document processing tests."""
    print("🚀 Starting Task 1.4.1 - Multi-Format Document Processing Tests")

    # Check dependencies
    if not HAS_DATA_AGENT:
        print("❌ DataAgent not available - skipping tests")
        return False

    if not HAS_PANDAS:
        print("⚠️  Pandas not available - CSV tests will be skipped")

    # Run pytest with appropriate markers
    pytest_args = [
        __file__,
        "-v",
        "--tb=short",
        "-m", "asyncio"
    ]

    try:
        exit_code = pytest.main(pytest_args)
        return exit_code == 0
    except Exception as e:
        print(f"❌ Test execution failed: {e}")
        return False


if __name__ == "__main__":
    success = run_comprehensive_tests()
    if success:
        print("\n✅ All document processing tests passed!")
        exit(0)
    else:
        print("\n❌ Some document processing tests failed!")
        exit(1)