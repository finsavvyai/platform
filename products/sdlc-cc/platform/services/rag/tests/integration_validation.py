#!/usr/bin/env python3
"""
Integration validation script for the SDLC.ai document processing pipeline.

This script performs comprehensive validation of the document processing system
including extraction accuracy, chunking quality, metadata preservation, and
performance benchmarks.
"""

import asyncio
import json
import logging
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Tuple

import asyncpg
import numpy as np
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class IntegrationValidator:
    """Comprehensive integration validator for document processing pipeline."""

    def __init__(self, database_url: str):
        self.database_url = database_url
        self.engine = None
        self.session_factory = None
        self.validation_results = {
            "timestamp": datetime.now().isoformat(),
            "tests": {},
            "summary": {
                "total_tests": 0,
                "passed_tests": 0,
                "failed_tests": 0,
                "success_rate": 0.0
            }
        }

    async def setup_database(self):
        """Setup database connection."""
        try:
            self.engine = create_async_engine(
                self.database_url,
                echo=False,
                pool_pre_ping=True
            )
            self.session_factory = sessionmaker(
                self.engine, class_=AsyncSession, expire_on_commit=False
            )
            logger.info("Database connection established")
        except Exception as e:
            logger.error(f"Failed to setup database: {e}")
            raise

    async def run_all_validations(self) -> Dict[str, Any]:
        """Run all validation tests."""
        logger.info("Starting comprehensive integration validation...")

        await self.setup_database()

        # Run validation tests
        await self.validate_pdf_processing()
        await self.validate_office_document_processing()
        await self.validate_html_processing()
        await self.validate_text_processing()
        await self.validate_chunking_strategies()
        await self.validate_metadata_extraction()
        await self.validate_batch_processing()
        await self.validate_quality_metrics()
        await self.validate_error_handling()
        await self.validate_performance_benchmarks()

        # Calculate summary
        self._calculate_summary()

        return self.validation_results

    async def validate_pdf_processing(self):
        """Validate PDF document processing."""
        logger.info("Validating PDF processing...")

        test_results = {
            "name": "PDF Processing Validation",
            "tests": []
        }

        try:
            # Import required modules
            from app.services.document_processor import DocumentProcessor, ProcessingOptions
            from app.models.document import Document, DataClassification

            # Create test document
            test_doc = Document(
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

            # Test with sample PDF content
            processor = DocumentProcessor()
            options = ProcessingOptions(
                chunking_strategy="hybrid",
                chunk_size=1024,
                quality_threshold=0.8
            )

            # Create sample PDF content
            sample_pdf = self._create_sample_pdf()

            # Process document
            chunks, metadata = await processor.process_document(
                test_doc, sample_pdf, options
            )

            # Validate results
            validations = [
                self._validate_condition(
                    len(chunks) > 0,
                    "PDF processing produces chunks",
                    "chunks_created"
                ),
                self._validate_condition(
                    metadata["total_processing_time_ms"] > 0,
                    "Processing time is recorded",
                    "processing_time_recorded"
                ),
                self._validate_condition(
                    metadata["quality_metrics"]["extraction_confidence"] > 0.7,
                    "Extraction confidence is above threshold",
                    "extraction_confidence_high"
                ),
                self._validate_condition(
                    all(chunk.checksum is not None for chunk in chunks),
                    "All chunks have checksums",
                    "chunks_have_checksums"
                ),
            ]

            test_results["tests"] = validations
            test_results["success"] = all(v["passed"] for v in validations)

        except Exception as e:
            test_results["success"] = False
            test_results["error"] = str(e)
            logger.error(f"PDF processing validation failed: {e}")

        self.validation_results["tests"]["pdf_processing"] = test_results
        logger.info(f"PDF processing validation completed: {'PASSED' if test_results['success'] else 'FAILED'}")

    async def validate_office_document_processing(self):
        """Validate Microsoft Office document processing."""
        logger.info("Validating Office document processing...")

        test_results = {
            "name": "Office Document Processing Validation",
            "tests": []
        }

        try:
            from app.services.extractors.office_extractors import DOCXExtractor, XLSXExtractor, PPTXExtractor
            from app.services.document_processor import ProcessingOptions

            extractors = {
                "docx": DOCXExtractor(),
                "xlsx": XLSXExtractor(),
                "pptx": PPTXExtractor(),
            }

            options = ProcessingOptions()

            for format_name, extractor in extractors.items():
                try:
                    # Create sample content
                    sample_content = self._create_sample_office_content(format_name)

                    if sample_content:
                        result = await extractor.extract(sample_content, options)

                        validations = [
                            self._validate_condition(
                                result.text is not None,
                                f"{format_name.upper()} extraction produces text",
                                f"{format_name}_text_extracted"
                            ),
                            self._validate_condition(
                                result.confidence > 0.8,
                                f"{format_name.upper()} extraction confidence is high",
                                f"{format_name}_confidence_high"
                            ),
                            self._validate_condition(
                                result.processing_time_ms > 0,
                                f"{format_name.upper()} processing time recorded",
                                f"{format_name}_processing_time"
                            ),
                        ]

                        test_results["tests"].extend(validations)

                except Exception as e:
                    logger.warning(f"Failed to validate {format_name} processing: {e}")
                    # Add failed validation
                    test_results["tests"].append({
                        "name": f"{format_name}_processing",
                        "description": f"{format_name.upper()} document processing",
                        "passed": False,
                        "error": str(e)
                    })

            test_results["success"] = all(t.get("passed", False) for t in test_results["tests"])

        except Exception as e:
            test_results["success"] = False
            test_results["error"] = str(e)
            logger.error(f"Office document processing validation failed: {e}")

        self.validation_results["tests"]["office_processing"] = test_results
        logger.info(f"Office document processing validation completed: {'PASSED' if test_results['success'] else 'FAILED'}")

    async def validate_html_processing(self):
        """Validate HTML and web content processing."""
        logger.info("Validating HTML processing...")

        test_results = {
            "name": "HTML Processing Validation",
            "tests": []
        }

        try:
            from app.services.extractors.web_extractors import HTMLExtractor, MarkdownExtractor
            from app.services.document_processor import ProcessingOptions

            extractors = {
                "html": HTMLExtractor(),
                "markdown": MarkdownExtractor(),
            }

            sample_contents = {
                "html": self._create_sample_html(),
                "markdown": self._create_sample_markdown(),
            }

            options = ProcessingOptions()

            for format_name, extractor in extractors.items():
                sample_content = sample_contents.get(format_name, "")
                if sample_content:
                    result = await extractor.extract(sample_content.encode('utf-8'), options)

                    validations = [
                        self._validate_condition(
                            len(result.text) > 0,
                            f"{format_name.upper()} extraction produces text",
                            f"{format_name}_text_extracted"
                        ),
                        self._validate_condition(
                            result.confidence > 0.8,
                            f"{format_name.upper()} extraction confidence is high",
                            f"{format_name}_confidence_high"
                        ),
                        self._validate_condition(
                            len(result.metadata) > 0,
                            f"{format_name.upper()} metadata extracted",
                            f"{format_name}_metadata_extracted"
                        ),
                    ]

                    test_results["tests"].extend(validations)

            test_results["success"] = all(t.get("passed", False) for t in test_results["tests"])

        except Exception as e:
            test_results["success"] = False
            test_results["error"] = str(e)
            logger.error(f"HTML processing validation failed: {e}")

        self.validation_results["tests"]["html_processing"] = test_results
        logger.info(f"HTML processing validation completed: {'PASSED' if test_results['success'] else 'FAILED'}")

    async def validate_text_processing(self):
        """Validate text cleaning and normalization."""
        logger.info("Validating text processing...")

        test_results = {
            "name": "Text Processing Validation",
            "tests": []
        }

        try:
            from app.services.text_processor import TextProcessor

            processor = TextProcessor()

            # Test cases with various text quality issues
            test_texts = [
                ("clean_text", "This is a clean, well-formatted text with proper structure."),
                ("messy_text", "This  is    a   messy   text with excessive whitespace and weird characters\x00\x08."),
                ("unicode_text", "This text has unicode: "smart quotes" and em-dash—characters."),
                ("repetitive_text", "This is repetitive. This is repetitive. This is repetitive."),
                ("short_text", "Short."),
                ("empty_text", ""),
            ]

            for test_name, text in test_texts:
                try:
                    result = await processor.process_text(text)

                    validations = [
                        self._validate_condition(
                            result["processed_text"] is not None,
                            f"Text processing produces output for {test_name}",
                            f"{test_name}_has_output"
                        ),
                        self._validate_condition(
                            len(result["processing_steps"]) > 0,
                            f"Processing steps recorded for {test_name}",
                            f"{test_name}_has_steps"
                        ),
                        self._validate_condition(
                            result["final_metrics"]["quality_score"] >= 0,
                            f"Quality score calculated for {test_name}",
                            f"{test_name}_has_quality_score"
                        ),
                    ]

                    test_results["tests"].extend(validations)

                except Exception as e:
                    logger.warning(f"Failed to process {test_name}: {e}")
                    test_results["tests"].append({
                        "name": f"{test_name}_processing",
                        "description": f"Text processing for {test_name}",
                        "passed": False,
                        "error": str(e)
                    })

            test_results["success"] = all(t.get("passed", False) for t in test_results["tests"])

        except Exception as e:
            test_results["success"] = False
            test_results["error"] = str(e)
            logger.error(f"Text processing validation failed: {e}")

        self.validation_results["tests"]["text_processing"] = test_results
        logger.info(f"Text processing validation completed: {'PASSED' if test_results['success'] else 'FAILED'}")

    async def validate_chunking_strategies(self):
        """Validate document chunking strategies."""
        logger.info("Validating chunking strategies...")

        test_results = {
            "name": "Chunking Strategies Validation",
            "tests": []
        }

        try:
            from app.services.chunking import ChunkingService, ChunkOptions

            service = ChunkingService()

            # Sample text for chunking
            sample_text = self._create_long_sample_text()

            strategies = ["fixed_size", "sentence", "paragraph", "hybrid"]

            for strategy in strategies:
                try:
                    options = ChunkOptions(
                        strategy=strategy,
                        chunk_size=512,
                        chunk_overlap=128,
                    )

                    result = await service.chunk_text(sample_text, options)

                    validations = [
                        self._validate_condition(
                            len(result.chunks) > 0,
                            f"{strategy} chunking produces chunks",
                            f"{strategy}_has_chunks"
                        ),
                        self._validate_condition(
                            all(len(chunk.content) <= options.chunk_size + 50 for chunk in result.chunks),
                            f"{strategy} chunks respect size limits",
                            f"{strategy}_size_limits"
                        ),
                        self._validate_condition(
                            result.quality_metrics["overall_quality"] > 0.5,
                            f"{strategy} chunking quality is acceptable",
                            f"{strategy}_quality_acceptable"
                        ),
                        self._validate_condition(
                            result.processing_time_ms > 0,
                            f"{strategy} processing time recorded",
                            f"{strategy}_processing_time"
                        ),
                    ]

                    test_results["tests"].extend(validations)

                except Exception as e:
                    logger.warning(f"Failed to validate {strategy} chunking: {e}")
                    test_results["tests"].append({
                        "name": f"{strategy}_chunking",
                        "description": f"{strategy} chunking strategy",
                        "passed": False,
                        "error": str(e)
                    })

            test_results["success"] = all(t.get("passed", False) for t in test_results["tests"])

        except Exception as e:
            test_results["success"] = False
            test_results["error"] = str(e)
            logger.error(f"Chunking strategies validation failed: {e}")

        self.validation_results["tests"]["chunking_strategies"] = test_results
        logger.info(f"Chunking strategies validation completed: {'PASSED' if test_results['success'] else 'FAILED'}")

    async def validate_metadata_extraction(self):
        """Validate metadata extraction capabilities."""
        logger.info("Validating metadata extraction...")

        test_results = {
            "name": "Metadata Extraction Validation",
            "tests": []
        }

        try:
            from app.services.metadata_extractor import MetadataExtractionService

            service = MetadataExtractionService()

            # Test different file types
            test_files = [
                ("text_file", b"Sample text content for testing.", "test.txt", "text/plain"),
                ("json_file", b'{"key": "value", "test": true}', "test.json", "application/json"),
                ("html_file", b"<html><body><h1>Test</h1></body></html>", "test.html", "text/html"),
            ]

            for test_name, content, filename, content_type in test_files:
                try:
                    metadata = await service.extract_metadata(content, filename, content_type)

                    validations = [
                        self._validate_condition(
                            metadata.filename == filename,
                            f"Filename preserved for {test_name}",
                            f"{test_name}_filename_preserved"
                        ),
                        self._validate_condition(
                            metadata.content_type == content_type,
                            f"Content type detected for {test_name}",
                            f"{test_name}_content_type_detected"
                        ),
                        self._validate_condition(
                            metadata.file_size == len(content),
                            f"File size calculated for {test_name}",
                            f"{test_name}_file_size_calculated"
                        ),
                        self._validate_condition(
                            metadata.checksum_sha256 != "",
                            f"Checksum calculated for {test_name}",
                            f"{test_name}_checksum_calculated"
                        ),
                    ]

                    test_results["tests"].extend(validations)

                except Exception as e:
                    logger.warning(f"Failed to extract metadata for {test_name}: {e}")
                    test_results["tests"].append({
                        "name": f"{test_name}_metadata",
                        "description": f"Metadata extraction for {test_name}",
                        "passed": False,
                        "error": str(e)
                    })

            test_results["success"] = all(t.get("passed", False) for t in test_results["tests"])

        except Exception as e:
            test_results["success"] = False
            test_results["error"] = str(e)
            logger.error(f"Metadata extraction validation failed: {e}")

        self.validation_results["tests"]["metadata_extraction"] = test_results
        logger.info(f"Metadata extraction validation completed: {'PASSED' if test_results['success'] else 'FAILED'}")

    async def validate_batch_processing(self):
        """Validate batch processing capabilities."""
        logger.info("Validating batch processing...")

        test_results = {
            "name": "Batch Processing Validation",
            "tests": []
        }

        try:
            from app.services.batch_processor import BatchProcessor, ProcessingMode
            from app.models.document import Document, DataClassification

            processor = BatchProcessor()

            # Create test documents
            documents = []
            for i in range(5):
                doc = Document(
                    id=uuid.uuid4(),
                    tenant_id=uuid.uuid4(),
                    filename=f"test_doc_{i}.txt",
                    original_filename=f"test_doc_{i}.txt",
                    content_type="text/plain",
                    file_size=100,
                    checksum=f"checksum_{i}",
                    storage_path=f"test/path/{i}",
                    storage_bucket="test-bucket",
                    storage_provider="r2",
                    created_by=uuid.uuid4(),
                    classification=DataClassification.INTERNAL,
                    language="en",
                )
                documents.append(doc)

            # Test batch job submission
            job_id = await processor.submit_batch_job(
                tenant_id=str(uuid.uuid4()),
                documents=documents,
                processing_mode=ProcessingMode.ASYNC_CONCURRENT,
                max_workers=2,
            )

            validations = [
                self._validate_condition(
                    job_id is not None,
                    "Batch job submission successful",
                    "batch_job_submitted"
                ),
                self._validate_condition(
                    job_id in processor.active_jobs,
                    "Job tracked in active jobs",
                    "job_tracked"
                ),
                self._validate_condition(
                    processor.active_jobs[job_id].total_count == len(documents),
                    "Correct document count in job",
                    "correct_document_count"
                ),
            ]

            # Test job cancellation
            cancelled = await processor.cancel_job(job_id)
            validations.append(
                self._validate_condition(
                    cancelled,
                    "Batch job cancellation successful",
                    "batch_job_cancelled"
                )
            )

            # Test statistics
            stats = await processor.get_job_statistics()
            validations.extend([
                self._validate_condition(
                    stats["total_jobs"] >= 0,
                    "Job statistics available",
                    "job_stats_available"
                ),
                self._validate_condition(
                    "success_rate" in stats,
                    "Success rate calculated",
                    "success_rate_calculated"
                ),
            ])

            test_results["tests"] = validations
            test_results["success"] = all(v["passed"] for v in validations)

        except Exception as e:
            test_results["success"] = False
            test_results["error"] = str(e)
            logger.error(f"Batch processing validation failed: {e}")

        self.validation_results["tests"]["batch_processing"] = test_results
        logger.info(f"Batch processing validation completed: {'PASSED' if test_results['success'] else 'FAILED'}")

    async def validate_quality_metrics(self):
        """Validate quality metrics and validation."""
        logger.info("Validating quality metrics...")

        test_results = {
            "name": "Quality Metrics Validation",
            "tests": []
        }

        try:
            # Test various quality metrics calculations
            validations = []

            # Test text quality calculation
            from app.services.text_processor import TextProcessor
            processor = TextProcessor()

            good_text = "This is a well-structured document with proper grammar and meaningful content."
            poor_text = "a b c d e f g h i j k l m n o p q r s t u v w x y z"

            good_metrics = processor._analyze_text(good_text)
            poor_metrics = processor._analyze_text(poor_text)

            validations.extend([
                self._validate_condition(
                    good_metrics["quality_score"] > poor_metrics["quality_score"],
                    "Good text scores higher than poor text",
                    "quality_score_discrimination"
                ),
                self._validate_condition(
                    0 <= good_metrics["quality_score"] <= 1,
                    "Quality score within valid range",
                    "quality_score_range_valid"
                ),
            ])

            # Test text acceptance criteria
            good_acceptable, _ = processor.is_text_acceptable(good_text, good_metrics)
            poor_acceptable, _ = processor.is_text_acceptable(poor_text, poor_metrics)

            validations.extend([
                self._validate_condition(
                    good_acceptable,
                    "Good text meets acceptance criteria",
                    "good_text_acceptable"
                ),
                self._validate_condition(
                    not poor_acceptable,
                    "Poor text fails acceptance criteria",
                    "poor_text_rejected"
                ),
            ])

            # Test chunking quality metrics
            from app.services.chunking import ChunkingService
            chunking_service = ChunkingService()

            sample_text = self._create_long_sample_text()
            chunk_result = await chunking_service.chunk_text(
                sample_text,
                ChunkOptions(strategy="fixed_size", chunk_size=512)
            )

            validations.append(
                self._validate_condition(
                    chunk_result.quality_metrics["overall_quality"] > 0.5,
                    "Chunking quality score is acceptable",
                    "chunking_quality_acceptable"
                )
            )

            test_results["tests"] = validations
            test_results["success"] = all(v["passed"] for v in validations)

        except Exception as e:
            test_results["success"] = False
            test_results["error"] = str(e)
            logger.error(f"Quality metrics validation failed: {e}")

        self.validation_results["tests"]["quality_metrics"] = test_results
        logger.info(f"Quality metrics validation completed: {'PASSED' if test_results['success'] else 'FAILED'}")

    async def validate_error_handling(self):
        """Validate error handling and resilience."""
        logger.info("Validating error handling...")

        test_results = {
            "name": "Error Handling Validation",
            "tests": []
        }

        try:
            validations = []

            # Test handling of invalid file data
            from app.services.document_processor import DocumentProcessor, ProcessingOptions
            from app.models.document import Document, DataClassification

            processor = DocumentProcessor()

            invalid_doc = Document(
                id=uuid.uuid4(),
                tenant_id=uuid.uuid4(),
                filename="invalid.txt",
                original_filename="invalid.txt",
                content_type="text/plain",
                file_size=10,
                checksum="invalid",
                storage_path="invalid",
                storage_bucket="test",
                storage_provider="r2",
                created_by=uuid.uuid4(),
                classification=DataClassification.INTERNAL,
                language="en",
            )

            try:
                chunks, metadata = await processor.process_document(
                    invalid_doc, b"Invalid content", ProcessingOptions()
                )
                # If it doesn't raise an exception, check if it handled gracefully
                validations.append(
                    self._validate_condition(
                        True,  # Reached here means no crash
                        "System handles invalid content gracefully",
                        "invalid_content_handled"
                    )
                )
            except Exception as e:
                # Should be a meaningful exception
                validations.append(
                    self._validate_condition(
                        len(str(e)) > 0,
                        "Meaningful error message provided",
                        "meaningful_error_message"
                    )
                )

            # Test handling of unsupported formats
            unsupported_content = b"This is not a valid PDF or Office document"

            try:
                result = await processor.extract_text(unsupported_content, ProcessingOptions())
                # Should still return a result, even if empty
                validations.append(
                    self._validate_condition(
                        result is not None,
                        "Unsupported format handled gracefully",
                        "unsupported_format_handled"
                    )
                )
            except Exception as e:
                # Should provide helpful error message
                validations.append(
                    self._validate_condition(
                        "unsupported" in str(e).lower() or "format" in str(e).lower(),
                        "Helpful error message for unsupported format",
                        "helpful_unsupported_error"
                    )
                )

            test_results["tests"] = validations
            test_results["success"] = all(v["passed"] for v in validations)

        except Exception as e:
            test_results["success"] = False
            test_results["error"] = str(e)
            logger.error(f"Error handling validation failed: {e}")

        self.validation_results["tests"]["error_handling"] = test_results
        logger.info(f"Error handling validation completed: {'PASSED' if test_results['success'] else 'FAILED'}")

    async def validate_performance_benchmarks(self):
        """Validate performance benchmarks."""
        logger.info("Validating performance benchmarks...")

        test_results = {
            "name": "Performance Benchmarks Validation",
            "tests": []
        }

        try:
            validations = []

            # Test text processing performance
            from app.services.text_processor import TextProcessor

            processor = TextProcessor()

            # Create moderately sized text
            large_text = " ".join([f"This is sentence {i}." for i in range(500)])

            start_time = time.time()
            result = await processor.process_text(large_text)
            processing_time = time.time() - start_time

            validations.append(
                self._validate_condition(
                    processing_time < 5.0,  # Should process within 5 seconds
                    f"Text processing performance: {processing_time:.2f}s < 5.0s",
                    "text_processing_performance"
                )
            )

            # Test chunking performance
            from app.services.chunking import ChunkingService, ChunkOptions

            chunking_service = ChunkingService()

            start_time = time.time()
            chunk_result = await chunking_service.chunk_text(
                large_text,
                ChunkOptions(strategy="hybrid", chunk_size=512)
            )
            chunking_time = time.time() - start_time

            validations.append(
                self._validate_condition(
                    chunking_time < 3.0,  # Should chunk within 3 seconds
                    f"Chunking performance: {chunking_time:.2f}s < 3.0s",
                    "chunking_performance"
                )
            )

            # Test metadata extraction performance
            from app.services.metadata_extractor import MetadataExtractionService

            metadata_service = MetadataExtractionService()

            start_time = time.time()
            metadata = await metadata_service.extract_metadata(
                large_text.encode('utf-8'), "large_text.txt", "text/plain"
            )
            metadata_time = time.time() - start_time

            validations.append(
                self._validate_condition(
                    metadata_time < 2.0,  # Should extract metadata within 2 seconds
                    f"Metadata extraction performance: {metadata_time:.2f}s < 2.0s",
                    "metadata_extraction_performance"
                )
            )

            # Test memory efficiency (basic check)
            import psutil
            process = psutil.Process()
            memory_mb = process.memory_info().rss / 1024 / 1024

            validations.append(
                self._validate_condition(
                    memory_mb < 500,  # Should use less than 500MB for these operations
                    f"Memory usage: {memory_mb:.1f}MB < 500MB",
                    "memory_efficiency"
                )
            )

            test_results["tests"] = validations
            test_results["success"] = all(v["passed"] for v in validations)

        except Exception as e:
            test_results["success"] = False
            test_results["error"] = str(e)
            logger.error(f"Performance benchmarks validation failed: {e}")

        self.validation_results["tests"]["performance_benchmarks"] = test_results
        logger.info(f"Performance benchmarks validation completed: {'PASSED' if test_results['success'] else 'FAILED'}")

    def _validate_condition(self, condition: bool, description: str, name: str) -> Dict[str, Any]:
        """Validate a condition and return test result."""
        return {
            "name": name,
            "description": description,
            "passed": condition,
            "timestamp": datetime.now().isoformat()
        }

    def _calculate_summary(self):
        """Calculate summary statistics."""
        total_tests = 0
        passed_tests = 0
        failed_tests = 0

        for test_category, test_results in self.validation_results["tests"].items():
            if isinstance(test_results, dict) and "tests" in test_results:
                for test in test_results["tests"]:
                    total_tests += 1
                    if test.get("passed", False):
                        passed_tests += 1
                    else:
                        failed_tests += 1

        success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0

        self.validation_results["summary"].update({
            "total_tests": total_tests,
            "passed_tests": passed_tests,
            "failed_tests": failed_tests,
            "success_rate": success_rate
        })

    def _create_sample_pdf(self) -> bytes:
        """Create a sample PDF for testing."""
        from pypdf import PdfWriter
        from pypdf.generic import RectangleObject

        buffer = io.BytesIO()
        pdf = PdfWriter()

        # Add a blank page
        page = PdfWriter()._create_page(RectangleObject([0, 0, 612, 792]))
        pdf.add_page(page)

        pdf.write(buffer)
        buffer.seek(0)
        return buffer.getvalue()

    def _create_sample_office_content(self, format_name: str) -> bytes:
        """Create sample Office document content."""
        if format_name == "docx":
            # Return minimal DOCX structure
            return b"PK\x03\x04"  # ZIP header
        elif format_name == "xlsx":
            return b"PK\x03\x04"  # ZIP header
        elif format_name == "pptx":
            return b"PK\x03\x04"  # ZIP header
        else:
            return b""

    def _create_sample_html(self) -> str:
        """Create sample HTML content."""
        return """
        <!DOCTYPE html>
        <html>
        <head>
            <title>Test Document</title>
            <meta name="description" content="Test HTML document for validation">
        </head>
        <body>
            <h1>Test HTML Document</h1>
            <p>This is a test HTML document for validation purposes.</p>
            <h2>Section 1</h2>
            <p>Content of section 1 with some meaningful text.</p>
            <h2>Section 2</h2>
            <p>Content of section 2 with additional information.</p>
            <table>
                <tr><th>Header 1</th><th>Header 2</th></tr>
                <tr><td>Data 1</td><td>Data 2</td></tr>
            </table>
        </body>
        </html>
        """

    def _create_sample_markdown(self) -> str:
        """Create sample Markdown content."""
        return """
        # Test Markdown Document

        This is a test Markdown document for validation purposes.

        ## Section 1

        Content of section 1 with some meaningful text.

        ### Subsection

        Additional content in a subsection.

        ## Section 2

        Content of section 2 with additional information.

        - Bullet point 1
        - Bullet point 2
        - Bullet point 3

        1. Numbered item 1
        2. Numbered item 2
        3. Numbered item 3

        `Inline code example`

        ```
        Block code example
        Multiple lines
        ```
        """

    def _create_long_sample_text(self) -> str:
        """Create a long sample text for chunking tests."""
        paragraphs = []
        for i in range(20):
            paragraph = f"This is paragraph {i + 1}. "
            paragraph += "It contains multiple sentences to test chunking strategies. "
            paragraph += "The content should be long enough to create meaningful chunks. "
            paragraph += "Each paragraph will have similar structure but different content."
            paragraphs.append(paragraph)

        return "\n\n".join(paragraphs)

    async def save_results(self, output_path: str = "integration_validation_results.json"):
        """Save validation results to file."""
        try:
            with open(output_path, 'w') as f:
                json.dump(self.validation_results, f, indent=2, default=str)
            logger.info(f"Validation results saved to {output_path}")
        except Exception as e:
            logger.error(f"Failed to save results: {e}")

    def print_summary(self):
        """Print validation summary."""
        summary = self.validation_results["summary"]

        print("\n" + "="*60)
        print("INTEGRATION VALIDATION SUMMARY")
        print("="*60)
        print(f"Total Tests: {summary['total_tests']}")
        print(f"Passed: {summary['passed_tests']}")
        print(f"Failed: {summary['failed_tests']}")
        print(f"Success Rate: {summary['success_rate']:.1f}%")
        print("="*60)

        # Print individual test results
        for category, results in self.validation_results["tests"].items():
            if isinstance(results, dict):
                status = "PASSED" if results.get("success", False) else "FAILED"
                print(f"{category}: {status}")

                if not results.get("success", False) and "error" in results:
                    print(f"  Error: {results['error']}")

        print("="*60)


async def main():
    """Main validation runner."""
    import argparse

    parser = argparse.ArgumentParser(description="Run SDLC.ai document processing integration validation")
    parser.add_argument("--database-url", default="postgresql+asyncpg://user:pass@localhost/sdlc_test",
                       help="Database connection URL")
    parser.add_argument("--output", default="integration_validation_results.json",
                       help="Output file for validation results")

    args = parser.parse_args()

    validator = IntegrationValidator(args.database_url)

    try:
        results = await validator.run_all_validations()
        await validator.save_results(args.output)
        validator.print_summary()

        # Exit with appropriate code
        summary = results["summary"]
        if summary["success_rate"] >= 90:
            print("\n✅ Integration validation PASSED")
            return 0
        elif summary["success_rate"] >= 70:
            print("\n⚠️  Integration validation PARTIALLY PASSED")
            return 1
        else:
            print("\n❌ Integration validation FAILED")
            return 2

    except Exception as e:
        logger.error(f"Validation failed with exception: {e}")
        print(f"\n❌ Validation failed: {e}")
        return 3


if __name__ == "__main__":
    import sys
    sys.exit(asyncio.run(main()))
