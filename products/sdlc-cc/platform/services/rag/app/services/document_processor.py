"""
Comprehensive document processing service for SDLC.ai platform.

This module provides high-precision text extraction, document structure analysis,
and intelligent chunking capabilities for multiple document formats.
"""

import io
import logging
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

import cv2
import easyocr
import numpy as np
import pytesseract
from nltk import sent_tokenize
from pdf2image import convert_from_bytes
from pdfplumber import PDF
from pypdf import PdfReader
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.document import Document, DocumentChunk

logger = logging.getLogger(__name__)

# Configure OCR
pytesseract.pytesseract.tesseract_cmd = "/usr/bin/tesseract"


class ProcessingMode(Enum):
    """Document processing modes."""

    TEXT_ONLY = "text_only"
    OCR_FALLBACK = "ocr_fallback"
    OCR_FORCE = "ocr_force"
    STRUCTURE_ANALYSIS = "structure_analysis"


class ChunkingStrategy(Enum):
    """Document chunking strategies."""

    FIXED_SIZE = "fixed_size"
    SENTENCE_BASED = "sentence_based"
    PARAGRAPH_BASED = "paragraph_based"
    SEMANTIC = "semantic"
    HYBRID = "hybrid"


@dataclass
class ProcessingOptions:
    """Options for document processing."""

    mode: ProcessingMode = ProcessingMode.TEXT_ONLY
    chunking_strategy: ChunkingStrategy = ChunkingStrategy.HYBRID
    chunk_size: int = 1024
    chunk_overlap: int = 256
    min_chunk_size: int = 100
    max_chunk_size: int = 2048
    include_metadata: bool = True
    preserve_structure: bool = True
    extract_tables: bool = True
    extract_images: bool = False
    language_detection: bool = True
    quality_threshold: float = 0.95
    ocr_languages: List[str] = field(default_factory=lambda: ["eng"])
    parallel_processing: bool = True
    max_workers: int = 4


@dataclass
class ExtractionResult:
    """Result of text extraction from a document."""

    text: str
    metadata: Dict[str, Any]
    pages: List[Dict[str, Any]]
    tables: List[Dict[str, Any]]
    images: List[Dict[str, Any]]
    structure: Dict[str, Any]
    quality_metrics: Dict[str, float]
    processing_time_ms: int
    language: Optional[str] = None
    confidence: float = 1.0


@dataclass
class ChunkResult:
    """Result of document chunking."""

    chunks: List[Dict[str, Any]]
    metadata: Dict[str, Any]
    quality_metrics: Dict[str, float]
    processing_time_ms: int


class BaseExtractor(ABC):
    """Abstract base class for document extractors."""

    @abstractmethod
    async def extract(
        self, file_data: bytes, options: ProcessingOptions
    ) -> ExtractionResult:
        """Extract text and metadata from a document."""
        pass

    @abstractmethod
    def supports_format(self, content_type: str) -> bool:
        """Check if the extractor supports the given content type."""
        pass


class PDFExtractor(BaseExtractor):
    """High-precision PDF text extraction with OCR support."""

    def __init__(self):
        self.ocr_reader = None
        self.settings = get_settings()

    def supports_format(self, content_type: str) -> bool:
        """Check if PDF format is supported."""
        return content_type.lower() in [
            "application/pdf",
            "application/x-pdf",
        ]

    async def extract(
        self, file_data: bytes, options: ProcessingOptions
    ) -> ExtractionResult:
        """Extract text from PDF with high precision."""
        start_time = datetime.now()

        try:
            # Initialize OCR reader if needed
            if (
                options.mode in [ProcessingMode.OCR_FALLBACK, ProcessingMode.OCR_FORCE]
                and not self.ocr_reader
            ):
                self.ocr_reader = easyocr.Reader(options.ocr_languages)

            # Extract text using multiple methods
            text_results = []
            metadata = {}
            pages = []
            tables = []
            images = []
            structure = {}

            # Method 1: Direct text extraction
            pdf_reader = PdfReader(io.BytesIO(file_data))
            direct_text = self._extract_direct_text(pdf_reader)
            text_results.append(("direct", direct_text, 1.0))

            # Method 2: Advanced PDF processing with pdfplumber
            plumber_text, plumber_tables = await self._extract_with_pdfplumber(
                file_data, options
            )
            text_results.append(("plumber", plumber_text, 0.95))
            tables.extend(plumber_tables)

            # Method 3: OCR if needed
            if options.mode == ProcessingMode.OCR_FORCE or (
                options.mode == ProcessingMode.OCR_FALLBACK
                and len(direct_text.strip()) < 100
            ):
                ocr_text, ocr_images = await self._extract_with_ocr(file_data, options)
                text_results.append(("ocr", ocr_text, 0.85))
                images.extend(ocr_images)

            # Select best extraction result
            best_text, best_method, confidence = self._select_best_extraction(
                text_results
            )

            # Extract metadata
            metadata = self._extract_pdf_metadata(pdf_reader)
            metadata["extraction_method"] = best_method
            metadata["extraction_confidence"] = confidence

            # Analyze document structure
            structure = await self._analyze_pdf_structure(pdf_reader, best_text)

            # Create page-level information
            pages = self._create_page_info(pdf_reader, best_text)

            # Calculate quality metrics
            quality_metrics = self._calculate_quality_metrics(best_text, metadata)

            processing_time = (datetime.now() - start_time).total_seconds() * 1000

            return ExtractionResult(
                text=best_text,
                metadata=metadata,
                pages=pages,
                tables=tables,
                images=images,
                structure=structure,
                quality_metrics=quality_metrics,
                processing_time_ms=int(processing_time),
                confidence=confidence,
            )

        except Exception as e:
            logger.error(f"PDF extraction failed: {e}")
            raise

    def _extract_direct_text(self, pdf_reader: PdfReader) -> str:
        """Extract text directly from PDF."""
        text_parts = []
        for page in pdf_reader.pages:
            try:
                page_text = page.extract_text()
                if page_text and len(page_text.strip()) > 10:
                    text_parts.append(page_text)
            except Exception as e:
                logger.warning(f"Failed to extract text from page: {e}")
                continue
        return "\n\n".join(text_parts)

    async def _extract_with_pdfplumber(
        self, file_data: bytes, options: ProcessingOptions
    ) -> Tuple[str, List[Dict]]:
        """Extract text and tables using pdfplumber."""
        text_parts = []
        tables = []

        try:
            with PDF.open(io.BytesIO(file_data)) as pdf:
                for page_num, page in enumerate(pdf.pages):
                    # Extract text
                    try:
                        page_text = page.extract_text()
                        if page_text and len(page_text.strip()) > 10:
                            text_parts.append(page_text)
                    except Exception as e:
                        logger.warning(
                            f"pdfplumber text extraction failed for page {page_num}: {e}"
                        )

                    # Extract tables if requested
                    if options.extract_tables:
                        try:
                            page_tables = page.extract_tables()
                            for table_idx, table in enumerate(page_tables):
                                if table and len(table) > 1:  # At least header + 1 row
                                    table_data = {
                                        "page": page_num + 1,
                                        "table_index": table_idx,
                                        "rows": table,
                                        "row_count": len(table),
                                        "col_count": len(table[0]) if table else 0,
                                        "confidence": 0.9,
                                    }
                                    tables.append(table_data)
                        except Exception as e:
                            logger.warning(
                                f"Table extraction failed for page {page_num}: {e}"
                            )

        except Exception as e:
            logger.error(f"pdfplumber processing failed: {e}")

        return "\n\n".join(text_parts), tables

    async def _extract_with_ocr(
        self, file_data: bytes, options: ProcessingOptions
    ) -> Tuple[str, List[Dict]]:
        """Extract text using OCR."""
        if not self.ocr_reader:
            self.ocr_reader = easyocr.Reader(options.ocr_languages)

        text_parts = []
        images = []

        try:
            # Convert PDF to images
            images_data = convert_from_bytes(file_data, dpi=300)

            for page_num, image in enumerate(images_data):
                # Convert PIL image to numpy array
                image_array = np.array(image)

                # Preprocess image for better OCR
                processed_image = self._preprocess_image(image_array)

                # Perform OCR
                try:
                    results = self.ocr_reader.readtext(processed_image)

                    # Process OCR results
                    page_text = []
                    for bbox, text, confidence in results:
                        if confidence > 0.5:  # Filter low-confidence results
                            page_text.append(text)

                    if page_text:
                        text_parts.append(" ".join(page_text))

                    # Store image information
                    image_info = {
                        "page": page_num + 1,
                        "width": image.width,
                        "height": image.height,
                        "format": "RGB",
                        "ocr_confidence": np.mean([r[2] for r in results])
                        if results
                        else 0.0,
                    }
                    images.append(image_info)

                except Exception as e:
                    logger.warning(f"OCR failed for page {page_num}: {e}")
                    continue

        except Exception as e:
            logger.error(f"OCR processing failed: {e}")

        return "\n\n".join(text_parts), images

    def _preprocess_image(self, image: np.ndarray) -> np.ndarray:
        """Preprocess image for better OCR accuracy."""
        # Convert to grayscale
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
        else:
            gray = image

        # Apply adaptive thresholding
        binary = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
        )

        # Denoise
        denoised = cv2.fastNlMeansDenoising(binary)

        return denoised

    def _select_best_extraction(
        self, text_results: List[Tuple[str, str, float]]
    ) -> Tuple[str, str, float]:
        """Select the best extraction result based on quality metrics."""
        if not text_results:
            return "", "none", 0.0

        # Sort by confidence
        text_results.sort(key=lambda x: x[2], reverse=True)

        # Additional quality checks
        for method, text, base_confidence in text_results:
            if not text or len(text.strip()) < 50:
                continue

            # Calculate text quality metrics
            quality_score = self._calculate_text_quality(text)
            final_confidence = base_confidence * quality_score

            if final_confidence >= 0.8:  # Accept good quality results
                return text, method, final_confidence

        # Fallback to the highest confidence result
        return text_results[0][1], text_results[0][0], text_results[0][2]

    def _calculate_text_quality(self, text: str) -> float:
        """Calculate quality score for extracted text."""
        if not text:
            return 0.0

        # Check for common OCR/extraction artifacts
        artifacts = [
            r"\s{3,}",  # Excessive whitespace
            r"[^\w\s\.\,\;\:\!\?\-\(\)\[\]\{\}\"\']+",  # Special characters
            r"[^\x00-\x7F]+",  # Non-ASCII characters (might indicate encoding issues)
        ]

        artifact_score = 1.0
        for pattern in artifacts:
            matches = len(re.findall(pattern, text))
            artifact_score -= min(matches * 0.1, 0.5)

        # Check for meaningful content (words, sentences)
        words = text.split()
        if len(words) < 10:
            artifact_score *= 0.5

        # Check for readable text ratio
        readable_chars = sum(1 for c in text if c.isalnum() or c.isspace())
        readable_ratio = readable_chars / len(text) if text else 0
        artifact_score *= readable_ratio

        return max(0.0, min(1.0, artifact_score))

    def _extract_pdf_metadata(self, pdf_reader: PdfReader) -> Dict[str, Any]:
        """Extract metadata from PDF."""
        metadata = {}

        if pdf_reader.metadata:
            metadata.update(
                {
                    "title": pdf_reader.metadata.get("/Title", ""),
                    "author": pdf_reader.metadata.get("/Author", ""),
                    "subject": pdf_reader.metadata.get("/Subject", ""),
                    "creator": pdf_reader.metadata.get("/Creator", ""),
                    "producer": pdf_reader.metadata.get("/Producer", ""),
                    "creation_date": pdf_reader.metadata.get("/CreationDate", ""),
                    "modification_date": pdf_reader.metadata.get("/ModDate", ""),
                }
            )

        metadata.update(
            {
                "page_count": len(pdf_reader.pages),
                "is_encrypted": pdf_reader.is_encrypted,
                "has_forms": any("/AcroForm" in page for page in pdf_reader.pages),
            }
        )

        return metadata

    async def _analyze_pdf_structure(
        self, pdf_reader: PdfReader, text: str
    ) -> Dict[str, Any]:
        """Analyze document structure."""
        structure = {
            "has_headers": False,
            "has_footers": False,
            "has_toc": False,
            "sections": [],
            "layout_type": "unknown",
        }

        # Analyze text for structural elements
        lines = text.split("\n")

        # Detect potential headers (short lines at top of pages)
        header_candidates = [
            line.strip()
            for line in lines[:20]
            if len(line.strip()) < 100 and len(line.strip()) > 10
        ]
        structure["has_headers"] = len(header_candidates) > 0

        # Detect potential footers
        footer_candidates = [
            line.strip() for line in lines[-20:] if len(line.strip()) < 100
        ]
        structure["has_footers"] = len(footer_candidates) > 0

        # Detect table of contents
        toc_patterns = [
            r"contents?",
            r"table of contents",
            r"index",
            r"contents\s+page",
        ]
        structure["has_toc"] = any(
            re.search(pattern, text, re.IGNORECASE) for pattern in toc_patterns
        )

        # Detect sections
        section_patterns = [
            r"^(chapter|section|part)\s+\d+",
            r"^\d+\.\s+[A-Z]",
            r"^[A-Z][A-Z\s]+$",
        ]

        for i, line in enumerate(lines):
            for pattern in section_patterns:
                if re.match(pattern, line.strip(), re.IGNORECASE):
                    structure["sections"].append(
                        {
                            "line_number": i,
                            "title": line.strip(),
                            "level": self._estimate_section_level(line.strip()),
                        }
                    )

        return structure

    def _estimate_section_level(self, title: str) -> int:
        """Estimate the hierarchical level of a section."""
        if re.match(r"^(chapter|part)\s+", title, re.IGNORECASE):
            return 1
        elif re.match(r"^\d+\.", title):
            return 2
        elif re.match(r"^[A-Z][A-Z\s]+$", title):
            return 3
        else:
            return 4

    def _create_page_info(
        self, pdf_reader: PdfReader, text: str
    ) -> List[Dict[str, Any]]:
        """Create page-level information."""
        pages = []
        total_pages = len(pdf_reader.pages)

        # Roughly estimate text per page
        text_lines = text.split("\n")
        lines_per_page = max(1, len(text_lines) // total_pages)

        for i in range(total_pages):
            start_line = i * lines_per_page
            end_line = min((i + 1) * lines_per_page, len(text_lines))
            page_text = "\n".join(text_lines[start_line:end_line])

            try:
                page = pdf_reader.pages[i]
                page_info = {
                    "page_number": i + 1,
                    "text_length": len(page_text),
                    "rotation": getattr(page, "rotation", 0),
                    "media_box": page.mediabox,
                    "has_text": len(page_text.strip()) > 10,
                    "estimated_words": len(page_text.split()),
                }
                pages.append(page_info)
            except Exception as e:
                logger.warning(f"Failed to create info for page {i + 1}: {e}")
                continue

        return pages

    def _calculate_quality_metrics(
        self, text: str, metadata: Dict[str, Any]
    ) -> Dict[str, float]:
        """Calculate comprehensive quality metrics."""
        if not text:
            return {"overall_quality": 0.0}

        metrics = {
            "text_length": len(text),
            "word_count": len(text.split()),
            "readability_score": self._calculate_readability(text),
            "structure_score": self._calculate_structure_score(text),
            "completeness_score": self._calculate_completeness_score(text, metadata),
        }

        # Calculate overall quality
        metrics["overall_quality"] = (
            metrics["readability_score"] * 0.3
            + metrics["structure_score"] * 0.3
            + metrics["completeness_score"] * 0.4
        )

        return metrics

    def _import_extractor(self, module_name: str, class_name: str):
        """Dynamically import extractor class."""
        try:
            module = __import__(
                f"app.services.extractors.{module_name}", fromlist=[class_name]
            )
            return getattr(module, class_name)
        except ImportError as e:
            logger.warning(f"Failed to import {class_name} from {module_name}: {e}")

            # Return a placeholder extractor that doesn't support any format
            class PlaceholderExtractor:
                def supports_format(self, content_type: str) -> bool:
                    return False

                async def extract(
                    self, file_data: bytes, options: ProcessingOptions
                ) -> ExtractionResult:
                    return ExtractionResult(
                        text="",
                        metadata={},
                        pages=[],
                        tables=[],
                        images=[],
                        structure={},
                        quality_metrics={},
                        processing_time_ms=0,
                    )

            return PlaceholderExtractor

    async def process_document(
        self,
        document: Document,
        file_data: bytes,
        options: Optional[ProcessingOptions] = None,
        db: Optional[AsyncSession] = None,
    ) -> Tuple[List[DocumentChunk], Dict[str, Any]]:
        """Process a document completely: extract text and create chunks."""

        if options is None:
            options = ProcessingOptions()

        start_time = datetime.now()

        try:
            # Step 1: Extract text and metadata
            extraction_result = await self.extract_text(file_data, options)

            # Step 2: Clean and normalize text
            from app.services.text_processor import TextProcessor

            text_processor = TextProcessor()
            processed_text_info = await text_processor.process_text(
                extraction_result.text
            )
            cleaned_text = processed_text_info["processed_text"]

            # Update extraction result with cleaned text
            extraction_result.text = cleaned_text
            extraction_result.metadata.update(processed_text_info["final_metrics"])

            # Step 3: Create chunks
            from app.services.chunking import ChunkingService, ChunkOptions

            chunking_service = ChunkingService()
            chunk_options = ChunkOptions(
                strategy=options.chunking_strategy.value,
                chunk_size=options.chunk_size,
                chunk_overlap=options.chunk_overlap,
                min_chunk_size=options.min_chunk_size,
                max_chunk_size=options.max_chunk_size,
                respect_sentence_boundaries=True,
                respect_paragraph_boundaries=True,
                preserve_structure=options.preserve_structure,
                adaptive_chunking=True,
                semantic_aware=True,
                include_metadata=options.include_metadata,
                language=extraction_result.language or "en",
            )

            chunk_result = await chunking_service.chunk_text(
                cleaned_text, chunk_options
            )

            # Step 4: Create document chunk objects
            chunks = []
            for chunk_data in chunk_result.chunks:
                chunk = DocumentChunk(
                    document_id=document.id,
                    tenant_id=document.tenant_id,
                    chunk_index=chunk_data.index,
                    content=chunk_data.content,
                    content_length=len(chunk_data.content),
                    chunk_type=chunk_data.chunk_type,
                    source_page_number=chunk_data.metadata.get("page_number"),
                    source_section=chunk_data.metadata.get("section"),
                    metadata=chunk_data.metadata,
                    language=extraction_result.language or document.language,
                )
                chunk.set_checksum()
                chunks.append(chunk)

            # Step 5: Extract comprehensive metadata
            from app.services.metadata_extractor import MetadataExtractionService

            metadata_service = MetadataExtractionService()
            document_metadata = await metadata_service.extract_metadata(
                file_data, document.filename
            )

            # Step 6: Compile processing results
            processing_metadata = {
                "extraction_result": extraction_result.__dict__,
                "chunk_result": chunk_result.__dict__,
                "text_processing": processed_text_info,
                "document_metadata": document_metadata.__dict__,
                "total_processing_time_ms": int(
                    (datetime.now() - start_time).total_seconds() * 1000
                ),
                "total_chunks": len(chunks),
                "options": options.__dict__,
                "quality_metrics": {
                    "extraction_confidence": extraction_result.confidence,
                    "text_quality": processed_text_info["final_metrics"].get(
                        "quality_score", 0.0
                    ),
                    "chunking_quality": chunk_result.quality_metrics.get(
                        "overall_quality", 0.0
                    ),
                },
            }

            return chunks, processing_metadata

        except Exception as e:
            logger.error(f"Document processing failed for document {document.id}: {e}")
            raise

    def _calculate_readability(self, text: str) -> float:
        """Calculate readability score."""
        try:
            import textstat

            # Normalize score to 0-1 range (higher is better)
            flesch_score = textstat.flesch_reading_ease(text)
            # Flesch scores typically range from 0-100, normalize to 0-1
            return min(1.0, max(0.0, flesch_score / 100))
        except:
            return 0.5  # Default middle score if calculation fails

    def _calculate_structure_score(self, text: str) -> float:
        """Calculate document structure quality score."""
        score = 0.0

        # Check for paragraphs
        paragraphs = text.split("\n\n")
        if len(paragraphs) > 1:
            score += 0.3

        # Check for sentences
        sentences = text.split(". ")
        if len(sentences) > 3:
            score += 0.3

        # Check for reasonable line breaks
        lines = text.split("\n")
        avg_line_length = sum(len(line) for line in lines) / len(lines) if lines else 0
        if 20 <= avg_line_length <= 200:
            score += 0.2

        # Check for word distribution
        words = text.split()
        if len(words) > 50:
            score += 0.2

        return min(1.0, score)

    def _calculate_completeness_score(
        self, text: str, metadata: Dict[str, Any]
    ) -> float:
        """Calculate completeness score based on extracted information."""
        score = 0.0

        # Check if we have substantial text
        if len(text) > 500:
            score += 0.4
        elif len(text) > 100:
            score += 0.2

        # Check metadata completeness
        metadata_fields = ["title", "author", "creation_date"]
        filled_fields = sum(1 for field in metadata_fields if metadata.get(field))
        score += (filled_fields / len(metadata_fields)) * 0.3

        # Check for content indicators
        if any(
            keyword in text.lower()
            for keyword in ["chapter", "section", "abstract", "introduction"]
        ):
            score += 0.3

        return min(1.0, score)


class DocumentProcessor:
    """Main document processing service."""

    def __init__(self):
        self.extractors = {
            "pdf": PDFExtractor(),
            "docx": self._import_extractor("office_extractors", "DOCXExtractor")(),
            "xlsx": self._import_extractor("office_extractors", "XLSXExtractor")(),
            "pptx": self._import_extractor("office_extractors", "PPTXExtractor")(),
            "html": self._import_extractor("web_extractors", "HTMLExtractor")(),
            "markdown": self._import_extractor("web_extractors", "MarkdownExtractor")(),
        }
        self.chunkers = {
            ChunkingStrategy.FIXED_SIZE: self._chunk_fixed_size,
            ChunkingStrategy.SENTENCE_BASED: self._chunk_sentence_based,
            ChunkingStrategy.PARAGRAPH_BASED: self._chunk_paragraph_based,
            ChunkingStrategy.HYBRID: self._chunk_hybrid,
        }
        self.settings = get_settings()

    async def process_document(
        self,
        document: Document,
        file_data: bytes,
        options: Optional[ProcessingOptions] = None,
        db: Optional[AsyncSession] = None,
    ) -> Tuple[List[DocumentChunk], Dict[str, Any]]:
        """Process a document completely: extract text and create chunks."""

        if options is None:
            options = ProcessingOptions()

        start_time = datetime.now()

        try:
            # Step 1: Extract text and metadata
            extraction_result = await self.extract_text(file_data, options)

            # Step 2: Create chunks
            chunk_result = await self.create_chunks(extraction_result.text, options)

            # Step 3: Create document chunk objects
            chunks = []
            for chunk_data in chunk_result.chunks:
                chunk = DocumentChunk(
                    document_id=document.id,
                    tenant_id=document.tenant_id,
                    chunk_index=chunk_data["index"],
                    content=chunk_data["content"],
                    content_length=len(chunk_data["content"]),
                    chunk_type=chunk_data.get("type", "text"),
                    source_page_number=chunk_data.get("page_number"),
                    source_section=chunk_data.get("section"),
                    metadata=chunk_data.get("metadata", {}),
                    language=extraction_result.language or document.language,
                )
                chunk.set_checksum()
                chunks.append(chunk)

            # Step 4: Compile processing results
            processing_metadata = {
                "extraction_result": extraction_result.__dict__,
                "chunk_result": chunk_result.__dict__,
                "total_processing_time_ms": int(
                    (datetime.now() - start_time).total_seconds() * 1000
                ),
                "total_chunks": len(chunks),
                "options": options.__dict__,
            }

            return chunks, processing_metadata

        except Exception as e:
            logger.error(f"Document processing failed for document {document.id}: {e}")
            raise

    async def extract_text(
        self, file_data: bytes, options: ProcessingOptions
    ) -> ExtractionResult:
        """Extract text from document using appropriate extractor."""

        # Detect file type
        content_type = self._detect_content_type(file_data)

        # Find appropriate extractor
        extractor = None
        for ext in self.extractors.values():
            if ext.supports_format(content_type):
                extractor = ext
                break

        if not extractor:
            raise ValueError(f"Unsupported file type: {content_type}")

        # Extract text
        result = await extractor.extract(file_data, options)

        # Detect language if requested
        if options.language_detection and not result.language:
            result.language = self._detect_language(result.text)

        return result

    async def create_chunks(self, text: str, options: ProcessingOptions) -> ChunkResult:
        """Create chunks from extracted text."""
        start_time = datetime.now()

        try:
            # Select chunking strategy
            chunker = self.chunkers.get(options.chunking_strategy, self._chunk_hybrid)

            # Create chunks
            chunks = chunker(text, options)

            # Calculate quality metrics
            quality_metrics = self._calculate_chunk_quality_metrics(chunks)

            processing_time = int((datetime.now() - start_time).total_seconds() * 1000)

            return ChunkResult(
                chunks=chunks,
                metadata={"chunking_strategy": options.chunking_strategy.value},
                quality_metrics=quality_metrics,
                processing_time_ms=processing_time,
            )

        except Exception as e:
            logger.error(f"Chunking failed: {e}")
            raise

    def _detect_content_type(self, file_data: bytes) -> str:
        """Detect content type from file data."""
        import magic

        try:
            mime = magic.Magic(mime=True)
            return mime.from_buffer(file_data)
        except:
            # Fallback to basic detection
            if file_data.startswith(b"%PDF"):
                return "application/pdf"
            elif file_data.startswith(b"PK\x03\x04"):
                return "application/zip"  # Could be DOCX, XLSX, PPTX
            else:
                return "application/octet-stream"

    def _detect_language(self, text: str) -> Optional[str]:
        """Detect document language."""
        try:
            from langdetect import detect

            return detect(text[:1000])  # Use first 1000 characters for detection
        except:
            return "en"  # Default to English

    def _chunk_fixed_size(
        self, text: str, options: ProcessingOptions
    ) -> List[Dict[str, Any]]:
        """Create fixed-size chunks."""
        chunks = []

        for i in range(0, len(text), options.chunk_size - options.chunk_overlap):
            chunk_text = text[i : i + options.chunk_size]
            if len(chunk_text) >= options.min_chunk_size:
                chunks.append(
                    {
                        "index": len(chunks),
                        "content": chunk_text,
                        "type": "text",
                        "metadata": {"strategy": "fixed_size"},
                    }
                )

        return chunks

    def _chunk_sentence_based(
        self, text: str, options: ProcessingOptions
    ) -> List[Dict[str, Any]]:
        """Create sentence-based chunks."""
        chunks = []
        sentences = sent_tokenize(text)

        current_chunk = ""
        current_length = 0

        for sentence in sentences:
            sentence_length = len(sentence)

            # Check if adding sentence would exceed chunk size
            if (
                current_length + sentence_length + 1 > options.chunk_size
                and current_chunk
            ):
                # Save current chunk
                if len(current_chunk) >= options.min_chunk_size:
                    chunks.append(
                        {
                            "index": len(chunks),
                            "content": current_chunk.strip(),
                            "type": "text",
                            "metadata": {
                                "strategy": "sentence_based",
                                "sentence_count": current_chunk.count(".") + 1,
                            },
                        }
                    )

                # Start new chunk with overlap
                overlap_sentences = current_chunk.split(". ")
                overlap_text = (
                    ". ".join(overlap_sentences[-2:]) + ". "
                    if len(overlap_sentences) > 1
                    else ""
                )
                current_chunk = overlap_text + sentence
                current_length = len(current_chunk)
            else:
                current_chunk += sentence + " "
                current_length += sentence_length + 1

        # Add final chunk
        if (
            current_chunk.strip()
            and len(current_chunk.strip()) >= options.min_chunk_size
        ):
            chunks.append(
                {
                    "index": len(chunks),
                    "content": current_chunk.strip(),
                    "type": "text",
                    "metadata": {
                        "strategy": "sentence_based",
                        "sentence_count": current_chunk.count(".") + 1,
                    },
                }
            )

        return chunks

    def _chunk_paragraph_based(
        self, text: str, options: ProcessingOptions
    ) -> List[Dict[str, Any]]:
        """Create paragraph-based chunks."""
        chunks = []
        paragraphs = text.split("\n\n")

        current_chunk = ""
        current_length = 0

        for paragraph in paragraphs:
            paragraph = paragraph.strip()
            if not paragraph:
                continue

            paragraph_length = len(paragraph)

            # Check if adding paragraph would exceed chunk size
            if (
                current_length + paragraph_length + 2 > options.chunk_size
                and current_chunk
            ):
                # Save current chunk
                if len(current_chunk) >= options.min_chunk_size:
                    chunks.append(
                        {
                            "index": len(chunks),
                            "content": current_chunk.strip(),
                            "type": "text",
                            "metadata": {
                                "strategy": "paragraph_based",
                                "paragraph_count": current_chunk.count("\n\n") + 1,
                            },
                        }
                    )

                # Start new chunk
                current_chunk = paragraph
                current_length = paragraph_length
            else:
                current_chunk += "\n\n" + paragraph if current_chunk else paragraph
                current_length += paragraph_length + (2 if current_chunk else 0)

        # Add final chunk
        if (
            current_chunk.strip()
            and len(current_chunk.strip()) >= options.min_chunk_size
        ):
            chunks.append(
                {
                    "index": len(chunks),
                    "content": current_chunk.strip(),
                    "type": "text",
                    "metadata": {
                        "strategy": "paragraph_based",
                        "paragraph_count": current_chunk.count("\n\n") + 1,
                    },
                }
            )

        return chunks

    def _chunk_hybrid(
        self, text: str, options: ProcessingOptions
    ) -> List[Dict[str, Any]]:
        """Create hybrid chunks combining multiple strategies."""
        chunks = []

        # First try paragraph-based chunking
        paragraph_chunks = self._chunk_paragraph_based(text, options)

        # For chunks that are too small, merge them
        merged_chunks = []
        current_merge = ""
        current_length = 0

        for chunk in paragraph_chunks:
            chunk_text = chunk["content"]
            chunk_length = len(chunk_text)

            if current_length + chunk_length < options.min_chunk_size:
                current_merge += "\n\n" + chunk_text if current_merge else chunk_text
                current_length += chunk_length
            else:
                if current_merge:
                    merged_chunks.append(
                        {
                            "index": len(merged_chunks),
                            "content": current_merge,
                            "type": "text",
                            "metadata": {"strategy": "hybrid", "merged": True},
                        }
                    )
                current_merge = chunk_text
                current_length = chunk_length

        if current_merge:
            merged_chunks.append(
                {
                    "index": len(merged_chunks),
                    "content": current_merge,
                    "type": "text",
                    "metadata": {"strategy": "hybrid", "merged": False},
                }
            )

        # For chunks that are too large, split them
        final_chunks = []
        for chunk in merged_chunks:
            if len(chunk["content"]) > options.max_chunk_size:
                # Split large chunk
                sub_chunks = self._chunk_fixed_size(chunk["content"], options)
                for sub_chunk in sub_chunks:
                    sub_chunk["metadata"]["strategy"] = "hybrid_split"
                    sub_chunk["index"] = len(final_chunks)
                    final_chunks.append(sub_chunk)
            else:
                chunk["index"] = len(final_chunks)
                final_chunks.append(chunk)

        return final_chunks if final_chunks else chunks

    def _calculate_chunk_quality_metrics(
        self, chunks: List[Dict[str, Any]]
    ) -> Dict[str, float]:
        """Calculate quality metrics for chunks."""
        if not chunks:
            return {"overall_quality": 0.0}

        metrics = {
            "chunk_count": len(chunks),
            "avg_chunk_size": sum(len(chunk["content"]) for chunk in chunks)
            / len(chunks),
            "min_chunk_size": min(len(chunk["content"]) for chunk in chunks),
            "max_chunk_size": max(len(chunk["content"]) for chunk in chunks),
            "size_variance": 0.0,
            "content_completeness": 0.0,
        }

        # Calculate size variance
        avg_size = metrics["avg_chunk_size"]
        variance = sum(
            (len(chunk["content"]) - avg_size) ** 2 for chunk in chunks
        ) / len(chunks)
        metrics["size_variance"] = variance / (avg_size**2) if avg_size > 0 else 0

        # Calculate content completeness
        chunks_with_sentences = sum(1 for chunk in chunks if "." in chunk["content"])
        metrics["content_completeness"] = chunks_with_sentences / len(chunks)

        # Overall quality score
        metrics["overall_quality"] = (
            1.0 - min(1.0, metrics["size_variance"])
        ) * 0.4 + metrics["content_completeness"] * 0.6

        return metrics
