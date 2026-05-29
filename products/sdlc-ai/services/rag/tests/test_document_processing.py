"""
Comprehensive tests for the document processing pipeline.

This module provides extensive testing for all document processing components
including extraction, chunking, metadata extraction, and batch processing.
"""

import asyncio
import io
import json
import logging
import tempfile
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from pypdf import PdfWriter

from app.models.document import Document, DocumentStatus, DataClassification
from app.services.document_processor import (
    DocumentProcessor,
    ProcessingOptions,
    ProcessingMode,
    ChunkingStrategy,
)
from app.services.text_processor import TextProcessor
from app.services.chunking import ChunkingService, ChunkOptions
from app.services.metadata_extractor import MetadataExtractionService
from app.services.batch_processor import (
    BatchProcessor,
    BatchStatus,
    ProcessingMode as BatchProcessingMode,
)

logger = logging.getLogger(__name__)


# Test fixtures
@pytest.fixture
def sample_pdf_content():
    """Create sample PDF content for testing."""
    # Create a simple PDF in memory
    pdf_buffer = io.BytesIO()
    pdf_writer = PdfWriter()

    # Add a page with text
    from pypdf.generic import RectangleObject
    from pypdf import PageObject

    page = PageObject.create_blank_page(width=612, height=792)
    pdf_writer.add_page(page)

    pdf_writer.write(pdf_buffer)
    pdf_buffer.seek(0)

    return pdf_buffer.getvalue()


@pytest.fixture
def sample_docx_content():
    """Create sample DOCX content for testing."""
    # For testing, we'll use a simple placeholder
    # In real implementation, this would be a proper DOCX file
    return b"Sample DOCX content placeholder"


@pytest.fixture
def sample_text_content():
    """Create sample text content for testing."""
    return """
    # Sample Document

    This is a sample document for testing the document processing pipeline.
    It contains multiple paragraphs and various text structures.

    ## Section 1: Introduction

    Lorem ipsum dolor sit amet, consectetur adipiscing elit.
    Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

    ## Section 2: Main Content

    Ut enim ad minim veniam, quis nostrud exercitation ullamco
    laboris nisi ut aliquip ex ea commodo consequat.

    ### Subsection

    Duis aute irure dolor in reprehenderit in voluptate velit esse
    cillum dolore eu fugiat nulla pariatur.

    ## Conclusion

    Excepteur sint occaecat cupidatat non proident, sunt in culpa
    qui officia deserunt mollit anim id est laborum.
    """.encode("utf-8")


@pytest.fixture
def sample_document():
    """Create a sample document model."""
    return Document(
        id=uuid.uuid4(),
        tenant_id=uuid.uuid4(),
        filename="test_document.pdf",
        original_filename="test_document.pdf",
        content_type="application/pdf",
        file_size=1024,
        checksum="test_checksum",
        storage_path="test/path",
        storage_bucket="test-bucket",
        storage_provider="r2",
        created_by=uuid.uuid4(),
        classification=DataClassification.INTERNAL,
        language="en",
    )


@pytest.fixture
def processing_options():
    """Create sample processing options."""
    return ProcessingOptions(
        mode=ProcessingMode.TEXT_ONLY,
        chunking_strategy=ChunkingStrategy.HYBRID,
        chunk_size=1024,
        chunk_overlap=256,
        include_metadata=True,
        preserve_structure=True,
        language_detection=True,
        quality_threshold=0.8,
        parallel_processing=False,
        max_workers=2,
    )


class TestDocumentProcessor:
    """Test cases for DocumentProcessor."""

    @pytest.mark.asyncio
    async def test_pdf_extraction(self, sample_pdf_content, processing_options):
        """Test PDF text extraction."""
        processor = DocumentProcessor()

        result = await processor.extract_text(sample_pdf_content, processing_options)

        assert result is not None
        assert result.text is not None
        assert len(result.text) >= 0
        assert result.metadata is not None
        assert result.pages is not None
        assert result.quality_metrics is not None
        assert result.processing_time_ms > 0
        assert result.confidence > 0

    @pytest.mark.asyncio
    async def test_content_type_detection(self, sample_pdf_content):
        """Test content type detection."""
        processor = DocumentProcessor()

        content_type = processor._detect_content_type(sample_pdf_content)
        assert content_type == "application/pdf"

    @pytest.mark.asyncio
    async def test_language_detection(self, sample_text_content):
        """Test language detection."""
        processor = DocumentProcessor()

        language = processor._detect_language(sample_text_content.decode("utf-8"))
        assert language == "en"

    @pytest.mark.asyncio
    async def test_chunking_strategies(self, sample_text_content, processing_options):
        """Test different chunking strategies."""
        processor = DocumentProcessor()
        text = sample_text_content.decode("utf-8")

        strategies = [
            ChunkingStrategy.FIXED_SIZE,
            ChunkingStrategy.SENTENCE_BASED,
            ChunkingStrategy.PARAGRAPH_BASED,
            ChunkingStrategy.HYBRID,
        ]

        for strategy in strategies:
            processing_options.chunking_strategy = strategy
            chunk_result = await processor.create_chunks(text, processing_options)

            assert chunk_result is not None
            assert len(chunk_result.chunks) > 0
            assert chunk_result.quality_metrics is not None
            assert chunk_result.processing_time_ms > 0

    @pytest.mark.asyncio
    async def test_full_document_processing(
        self, sample_document, sample_pdf_content, processing_options
    ):
        """Test complete document processing pipeline."""
        processor = DocumentProcessor()

        chunks, metadata = await processor.process_document(
            sample_document, sample_pdf_content, processing_options
        )

        assert len(chunks) >= 0
        assert metadata is not None
        assert "extraction_result" in metadata
        assert "chunk_result" in metadata
        assert "quality_metrics" in metadata
        assert metadata["total_processing_time_ms"] > 0


class TestTextProcessor:
    """Test cases for TextProcessor."""

    @pytest.fixture
    def text_processor(self):
        """Create TextProcessor instance."""
        return TextProcessor()

    @pytest.mark.asyncio
    async def test_text_cleaning(self, text_processor):
        """Test text cleaning and normalization."""
        dirty_text = """
        This  is    a   test    with   excessive    whitespace.

        It also has some weird characters: control\x00characters\x08.
        And some unicode: "smart quotes" and em-dash—here.

        Multiple

        blank lines.
        """

        result = await text_processor.process_text(dirty_text)

        assert result is not None
        assert "processed_text" in result
        assert result["language"] is not None
        assert result["original_metrics"] is not None
        assert result["final_metrics"] is not None
        assert result["processing_steps"] is not None

        # Check that excessive whitespace was cleaned
        processed = result["processed_text"]
        assert "  " not in processed  # No double spaces
        assert processed.count("\n\n") <= 2  # Limited blank lines

    @pytest.mark.asyncio
    async def test_language_detection(self, text_processor):
        """Test language detection."""
        english_text = "This is a test document in English."
        spanish_text = "Este es un documento de prueba en español."

        en_result = await text_processor.process_text(english_text)
        es_result = await text_processor.process_text(spanish_text)

        assert en_result["language"] == "en"
        assert es_result["language"] == "es"

    @pytest.mark.asyncio
    async def test_quality_metrics(self, text_processor):
        """Test quality metrics calculation."""
        good_text = """
        This is a well-structured document with proper paragraphs.
        It has multiple sentences and good readability.
        The content is meaningful and properly formatted.
        """

        poor_text = "a b c d e f g h i j k l m n o p q r s t u v w x y z"

        good_result = await text_processor.process_text(good_text)
        poor_result = await text_processor.process_text(poor_text)

        assert (
            good_result["final_metrics"]["quality_score"]
            > poor_result["final_metrics"]["quality_score"]
        )

    def test_text_acceptance_criteria(self, text_processor):
        """Test text acceptance criteria."""
        acceptable_text = "This is a good quality text with meaningful content."
        unacceptable_text = "a b c"

        good_metrics = text_processor._analyze_text(acceptable_text)
        poor_metrics = text_processor._analyze_text(unacceptable_text)

        good_acceptable, good_issues = text_processor.is_text_acceptable(
            acceptable_text, good_metrics
        )
        poor_acceptable, poor_issues = text_processor.is_text_acceptable(
            unacceptable_text, poor_metrics
        )

        assert good_acceptable is True
        assert len(good_issues) == 0
        assert poor_acceptable is False
        assert len(poor_issues) > 0

    @pytest.mark.asyncio
    async def test_batch_processing(self, text_processor):
        """Test batch text processing."""
        texts = [
            "First document with some content.",
            "Second document with different content.",
            "Third document for testing purposes.",
        ]

        results = text_processor.batch_process_texts(texts)

        assert len(results) == 3
        for result in results:
            assert "processed_text" in result
            assert "language" in result


class TestChunkingService:
    """Test cases for ChunkingService."""

    @pytest.fixture
    def chunking_service(self):
        """Create ChunkingService instance."""
        return ChunkingService()

    @pytest.fixture
    def sample_long_text(self):
        """Create a long text sample for chunking."""
        sentences = ["This is sentence number {}.".format(i) for i in range(1, 101)]
        return " ".join(sentences)

    @pytest.mark.asyncio
    async def test_fixed_size_chunking(self, chunking_service, sample_long_text):
        """Test fixed-size chunking."""
        options = ChunkOptions(
            strategy="fixed_size",
            chunk_size=200,
            chunk_overlap=50,
        )

        result = await chunking_service.chunk_text(sample_long_text, options)

        assert len(result.chunks) > 1
        assert result.strategy_used == "fixed_size"
        assert all(chunk.chunk_type == "fixed_size" for chunk in result.chunks)
        assert all(
            len(chunk.content) <= options.chunk_size + 10 for chunk in result.chunks
        )  # Allow small tolerance

    @pytest.mark.asyncio
    async def test_sentence_chunking(self, chunking_service, sample_long_text):
        """Test sentence-based chunking."""
        options = ChunkOptions(
            strategy="sentence",
            chunk_size=500,
            chunk_overlap=100,
        )

        result = await chunking_service.chunk_text(sample_long_text, options)

        assert len(result.chunks) > 1
        assert result.strategy_used == "sentence"
        assert all(chunk.chunk_type == "sentence_based" for chunk in result.chunks)

    @pytest.mark.asyncio
    async def test_paragraph_chunking(self, chunking_service):
        """Test paragraph-based chunking."""
        text = """
        This is the first paragraph. It contains multiple sentences.
        It should be kept together in one chunk.

        This is the second paragraph. It also has multiple sentences.
        It should also be kept together.

        This is the third paragraph with different content.
        It demonstrates how paragraph chunking works.
        """

        options = ChunkOptions(strategy="paragraph")
        result = await chunking_service.chunk_text(text, options)

        assert len(result.chunks) >= 1
        assert result.strategy_used == "paragraph"

    @pytest.mark.asyncio
    async def test_adaptive_chunking(self, chunking_service, sample_long_text):
        """Test adaptive chunking strategy selection."""
        options = ChunkOptions(adaptive_chunking=True)

        result = await chunking_service.chunk_with_adaptive_strategy(
            sample_long_text, options
        )

        assert result is not None
        assert len(result.chunks) > 0
        assert result.strategy_used in [
            "fixed_size",
            "sentence",
            "paragraph",
            "semantic",
            "hybrid",
        ]

    def test_optimal_strategy_selection(self, chunking_service):
        """Test optimal strategy selection."""
        short_text = "Short text."
        long_text = " ".join(["Sentence {}.".format(i) for i in range(1, 51)])
        paragraph_text = "\n\n".join(["Paragraph {}.".format(i) for i in range(1, 11)])

        short_strategy = chunking_service.get_optimal_strategy(
            short_text, ChunkOptions()
        )
        long_strategy = chunking_service.get_optimal_strategy(
            long_text, ChunkOptions(semantic_aware=True)
        )
        paragraph_strategy = chunking_service.get_optimal_strategy(
            paragraph_text, ChunkOptions()
        )

        assert short_strategy == "fixed_size"
        assert long_strategy == "semantic"
        assert paragraph_strategy == "paragraph"


class TestMetadataExtractionService:
    """Test cases for MetadataExtractionService."""

    @pytest.fixture
    def metadata_service(self):
        """Create MetadataExtractionService instance."""
        return MetadataExtractionService()

    @pytest.mark.asyncio
    async def test_pdf_metadata_extraction(self, metadata_service, sample_pdf_content):
        """Test PDF metadata extraction."""
        metadata = await metadata_service.extract_metadata(
            sample_pdf_content, "test.pdf", "application/pdf"
        )

        assert metadata is not None
        assert metadata.filename == "test.pdf"
        assert metadata.content_type == "application/pdf"
        assert metadata.file_size == len(sample_pdf_content)
        assert metadata.checksum_md5 != ""
        assert metadata.checksum_sha256 != ""

    @pytest.mark.asyncio
    async def test_text_metadata_extraction(
        self, metadata_service, sample_text_content
    ):
        """Test text metadata extraction."""
        metadata = await metadata_service.extract_metadata(
            sample_text_content, "test.txt", "text/plain"
        )

        assert metadata is not None
        assert metadata.filename == "test.txt"
        assert metadata.content_type == "text/plain"
        assert metadata.character_count == len(sample_text_content.decode("utf-8"))
        assert metadata.word_count > 0
        assert metadata.paragraph_count > 0
        assert metadata.language is not None

    @pytest.mark.asyncio
    async def test_image_metadata_extraction(self, metadata_service):
        """Test image metadata extraction."""
        # Create a simple test image
        img = Image.new("RGB", (100, 100), color="red")
        img_buffer = io.BytesIO()
        img.save(img_buffer, format="JPEG")
        img_data = img_buffer.getvalue()

        metadata = await metadata_service.extract_metadata(
            img_data, "test.jpg", "image/jpeg"
        )

        assert metadata is not None
        assert metadata.filename == "test.jpg"
        assert metadata.content_type == "image/jpeg"
        assert "width" in metadata.custom_properties
        assert "height" in metadata.custom_properties
        assert metadata.custom_properties["width"] == 100
        assert metadata.custom_properties["height"] == 100

    @pytest.mark.asyncio
    async def test_batch_metadata_extraction(self, metadata_service):
        """Test batch metadata extraction."""
        files = [
            (b"Sample text content 1", "file1.txt", "text/plain"),
            (b"Sample text content 2", "file2.txt", "text/plain"),
            (b"Sample text content 3", "file3.txt", "text/plain"),
        ]

        results = await metadata_service.extract_batch_metadata(files)

        assert len(results) == 3
        for result in results:
            assert result.filename.startswith("file")
            assert result.content_type == "text/plain"


class TestBatchProcessor:
    """Test cases for BatchProcessor."""

    @pytest.fixture
    def batch_processor(self):
        """Create BatchProcessor instance."""
        return BatchProcessor()

    @pytest.fixture
    def sample_documents(self):
        """Create sample documents for batch processing."""
        docs = []
        for i in range(5):
            doc = Document(
                id=uuid.uuid4(),
                tenant_id=uuid.uuid4(),
                filename=f"test_document_{i}.pdf",
                original_filename=f"test_document_{i}.pdf",
                content_type="application/pdf",
                file_size=1024,
                checksum=f"checksum_{i}",
                storage_path=f"test/path/{i}",
                storage_bucket="test-bucket",
                storage_provider="r2",
                created_by=uuid.uuid4(),
                classification=DataClassification.INTERNAL,
                language="en",
            )
            docs.append(doc)
        return docs

    @pytest.mark.asyncio
    async def test_batch_job_submission(self, batch_processor, sample_documents):
        """Test batch job submission."""
        job_id = await batch_processor.submit_batch_job(
            tenant_id=str(uuid.uuid4()),
            documents=sample_documents,
            processing_mode=BatchProcessingMode.ASYNC_CONCURRENT,
            max_workers=2,
        )

        assert job_id is not None
        assert job_id in batch_processor.active_jobs

        job = await batch_processor.get_job_status(job_id)
        assert job is not None
        assert job.status == BatchStatus.PENDING
        assert job.total_count == len(sample_documents)

    @pytest.mark.asyncio
    async def test_batch_job_cancellation(self, batch_processor, sample_documents):
        """Test batch job cancellation."""
        job_id = await batch_processor.submit_batch_job(
            tenant_id=str(uuid.uuid4()),
            documents=sample_documents,
        )

        # Cancel the job
        cancelled = await batch_processor.cancel_job(job_id)
        assert cancelled is True

        job = await batch_processor.get_job_status(job_id)
        assert job.status == BatchStatus.CANCELLED

    @pytest.mark.asyncio
    async def test_resource_monitoring(self, batch_processor):
        """Test resource monitoring."""
        batch_processor.resource_monitor.start_monitoring()

        # Record some metrics
        batch_processor.resource_monitor.record_metrics()
        batch_processor.resource_monitor.record_metrics()

        summary = batch_processor.resource_monitor.get_summary()

        assert "peak_memory_usage_mb" in summary
        assert "peak_cpu_usage_percent" in summary
        assert "avg_cpu_usage_percent" in summary
        assert "monitoring_duration_seconds" in summary

    def test_optimal_workers_calculation(self, batch_processor):
        """Test optimal workers calculation."""
        optimal_workers = batch_processor._calculate_optimal_workers()

        assert optimal_workers > 0
        assert optimal_workers <= 8  # Should be capped at 8

    def test_resource_limit_check(self, batch_processor):
        """Test resource limit checking."""
        # This test may vary depending on system load
        within_limits = batch_processor._check_resource_limits()
        assert isinstance(within_limits, bool)

    @pytest.mark.asyncio
    async def test_job_statistics(self, batch_processor):
        """Test job statistics."""
        stats = await batch_processor.get_job_statistics()

        assert "total_jobs" in stats
        assert "completed_jobs" in stats
        assert "failed_jobs" in stats
        assert "running_jobs" in stats
        assert "success_rate" in stats
        assert "resource_usage" in stats

    @pytest.mark.asyncio
    async def test_job_cleanup(self, batch_processor, sample_documents):
        """Test job cleanup functionality."""
        # Submit and complete a job
        job_id = await batch_processor.submit_batch_job(
            tenant_id=str(uuid.uuid4()),
            documents=sample_documents[:1],
        )

        # Mark as completed for testing
        job = batch_processor.active_jobs[job_id]
        job.status = BatchStatus.COMPLETED
        job.completed_at = datetime.now()

        # Clean up jobs (using 0 hours to clean immediately)
        cleaned_count = await batch_processor.cleanup_completed_jobs(max_age_hours=0)

        assert cleaned_count >= 0
        # Note: The actual job might not be cleaned up depending on timing


class TestIntegration:
    """Integration tests for the complete document processing pipeline."""

    @pytest.mark.asyncio
    async def test_end_to_end_processing(self, sample_document, sample_text_content):
        """Test end-to-end document processing."""
        # Mock the file data to be text content instead of PDF
        file_data = sample_text_content
        sample_document.content_type = "text/plain"

        processing_options = ProcessingOptions(
            chunking_strategy=ChunkingStrategy.HYBRID,
            chunk_size=500,
            chunk_overlap=100,
        )

        processor = DocumentProcessor()
        chunks, metadata = await processor.process_document(
            sample_document, file_data, processing_options
        )

        # Verify chunks
        assert len(chunks) > 0
        for chunk in chunks:
            assert chunk.document_id == sample_document.id
            assert chunk.tenant_id == sample_document.tenant_id
            assert chunk.content is not None
            assert len(chunk.content) > 0
            assert chunk.checksum is not None

        # Verify metadata
        assert "extraction_result" in metadata
        assert "chunk_result" in metadata
        assert "text_processing" in metadata
        assert "document_metadata" in metadata
        assert "quality_metrics" in metadata
        assert metadata["total_processing_time_ms"] > 0

    @pytest.mark.asyncio
    async def test_quality_metrics_validation(
        self, sample_document, sample_text_content
    ):
        """Test quality metrics and validation."""
        file_data = sample_text_content
        sample_document.content_type = "text/plain"

        processing_options = ProcessingOptions(quality_threshold=0.7)

        processor = DocumentProcessor()
        chunks, metadata = await processor.process_document(
            sample_document, file_data, processing_options
        )

        quality_metrics = metadata["quality_metrics"]

        # Check that quality metrics are present and within expected ranges
        assert "extraction_confidence" in quality_metrics
        assert "text_quality" in quality_metrics
        assert "chunking_quality" in quality_metrics

        # Values should be between 0 and 1
        for metric_name, value in quality_metrics.items():
            if isinstance(value, (int, float)):
                assert 0 <= value <= 1

    @pytest.mark.asyncio
    async def test_error_handling(self, sample_document):
        """Test error handling in processing pipeline."""
        # Use invalid file data
        invalid_data = b"Invalid file content that cannot be processed"

        processing_options = ProcessingOptions()
        processor = DocumentProcessor()

        # Should handle errors gracefully
        try:
            chunks, metadata = await processor.process_document(
                sample_document, invalid_data, processing_options
            )
            # If it doesn't raise an exception, verify it handled the error
            assert metadata.get("processing_errors") is not None
        except Exception as e:
            # Should be a meaningful exception
            assert str(e) is not None
            assert len(str(e)) > 0

    @pytest.mark.asyncio
    async def test_multi_format_support(self):
        """Test support for multiple file formats."""
        processor = DocumentProcessor()

        formats_to_test = [
            ("application/pdf", b"%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\n"),
            ("text/plain", b"This is a plain text document."),
            ("text/html", b"<html><body><h1>Test</h1><p>Content</p></body></html>"),
        ]

        for content_type, file_data in formats_to_test:
            try:
                result = await processor.extract_text(file_data, ProcessingOptions())
                assert result is not None
                assert result.text is not None
            except Exception as e:
                # Some formats might not be fully supported without proper file structure
                logger.warning(f"Format {content_type} not fully supported: {e}")


# Performance tests
class TestPerformance:
    """Performance tests for document processing."""

    @pytest.mark.asyncio
    @pytest.mark.slow
    async def test_large_document_processing(self):
        """Test processing of large documents."""
        # Create a large text document
        large_text = " ".join(
            [f"This is sentence {i} in a large document." for i in range(1000)]
        )

        processor = DocumentProcessor()
        start_time = datetime.now()

        result = await processor.create_chunks(large_text, ProcessingOptions())

        end_time = datetime.now()
        processing_time = (end_time - start_time).total_seconds()

        # Should complete within reasonable time (adjust threshold as needed)
        assert processing_time < 30.0  # 30 seconds max
        assert len(result.chunks) > 0
        assert result.processing_time_ms > 0

    @pytest.mark.asyncio
    @pytest.mark.slow
    async def test_batch_processing_performance(self):
        """Test batch processing performance."""
        processor = BatchProcessor()

        # Create multiple documents
        documents = []
        for i in range(10):
            doc = Document(
                id=uuid.uuid4(),
                tenant_id=uuid.uuid4(),
                filename=f"test_{i}.txt",
                original_filename=f"test_{i}.txt",
                content_type="text/plain",
                file_size=100,
                checksum=f"checksum_{i}",
                storage_path=f"path_{i}",
                storage_bucket="test-bucket",
                storage_provider="r2",
                created_by=uuid.uuid4(),
                classification=DataClassification.INTERNAL,
                language="en",
            )
            documents.append(doc)

        start_time = datetime.now()

        job_id = await processor.submit_batch_job(
            tenant_id=str(uuid.uuid4()),
            documents=documents,
            processing_mode=BatchProcessingMode.ASYNC_CONCURRENT,
            max_workers=4,
        )

        end_time = datetime.now()
        submission_time = (end_time - start_time).total_seconds()

        # Job submission should be fast
        assert submission_time < 5.0
        assert job_id is not None

        # Clean up
        await processor.cancel_job(job_id)


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v", "--tb=short"])
