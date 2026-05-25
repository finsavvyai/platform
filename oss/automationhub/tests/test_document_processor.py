"""
Comprehensive Test Suite for Document Processing System

Tests the multi-format document processor including:
- PDF text extraction
- Office document processing
- Web content extraction
- Image OCR processing
- Security validation
- Batch processing
- API endpoints
- Error handling
- Dependency management
"""

import os
import tempfile
import asyncio
from io import BytesIO
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock, AsyncMock
from datetime import datetime
import pytest
from fastapi.testclient import TestClient
from fastapi import UploadFile, HTTPException

# Import the document processor components
import sys
sys.path.append("backend")

# Mock app.config first to avoid import issues
import pytest
@pytest.fixture(autouse=True)
def mock_config():
    """Mock configuration for all tests."""
    with patch.dict('sys.modules', {'app.core.config': Mock()}):
        yield

from app.services.document_processor import (
    DocumentProcessor,
    DocumentSecurityValidator,
    PDFExtractor,
    OfficeDocumentExtractor,
    WebContentExtractor,
    ImageExtractor,
    HAS_FITZ,
    HAS_PIL,
    HAS_PYTESSERACT,
    HAS_MAGIC,
    HAS_YARA,
    HAS_DOCPARSER,
    HAS_SOUP,
    HAS_SELENIUM
)

from app.api.v1.endpoints.documents import (
    process_document,
    process_url,
    validate_file,
    get_supported_formats,
    get_ocr_languages,
    cleanup_temp_files
)

from app.schemas.documents import (
    DocumentProcessingRequest,
    DocumentProcessingResponse,
    DocumentMetadata,
    SecurityValidationResult,
    ProcessingStatus,
    SecurityLevel,
    DocumentType,
    ExtractionOptions,
    BatchProcessingRequest,
    DocumentUploadRequest,
    DocumentInfo,
    ProcessingStats,
    HealthCheckResponse
)

from app.main import app


class TestDocumentSecurityValidator:
    """Test document security validation component."""

    @pytest.fixture
    def validator(self):
        """Create security validator instance."""
        return DocumentSecurityValidator()

    def test_validator_initialization(self, validator):
        """Test validator initialization."""
        assert validator is not None
        assert hasattr(validator, 'yara_rules')
        assert hasattr(validator, 'max_file_size')

    def test_validate_file_success(self, validator):
        """Test successful file validation."""
        # Create a temporary test file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write("This is a test file for security validation.")
            temp_file_path = f.name

        try:
            # Test file validation
            result = validator.validate_file(temp_file_path, security_level="basic")

            assert isinstance(result, SecurityValidationResult)
            assert result.is_safe is True
            assert result.threats_detected == []
            assert result.file_hash is not None
            assert result.scan_time is not None
        finally:
            os.unlink(temp_file_path)

    def test_validate_nonexistent_file(self, validator):
        """Test validation of nonexistent file."""
        with pytest.raises(FileNotFoundError):
            validator.validate_file("/nonexistent/file.txt")

    def test_validate_oversized_file(self, validator):
        """Test validation of oversized file."""
        # Mock file size check
        with patch('os.path.getsize', return_value=200 * 1024 * 1024):  # 200MB
            with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
                f.write("test")
                temp_file_path = f.name

            try:
                result = validator.validate_file(temp_file_path, security_level="basic")
                assert result.is_safe is False
                assert any("too large" in warning.lower() for warning in result.warnings)
            finally:
                os.unlink(temp_file_path)

    def test_validate_dangerous_extension(self, validator):
        """Test validation of file with dangerous extension."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.exe', delete=False) as f:
            f.write("fake executable content")
            temp_file_path = f.name

        try:
            result = validator.validate_file(temp_file_path, security_level="comprehensive")
            assert result.is_safe is False
            assert any("extension" in warning.lower() for warning in result.warnings)
        finally:
            os.unlink(temp_file_path)

    @pytest.mark.skipif(not HAS_YARA, reason="YARA library not available")
    def test_yara_scanning(self, validator):
        """Test YARA malware scanning."""
        # This test would require actual YARA rules and test samples
        # For now, we'll test that the method exists and returns expected format
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write("This is a safe test file.")
            temp_file_path = f.name

        try:
            result = validator.validate_file(temp_file_path, security_level="comprehensive")
            assert isinstance(result, SecurityValidationResult)
            # Most files should be safe in this test
            assert result.threats_detected == []
        finally:
            os.unlink(temp_file_path)


class TestPDFExtractor:
    """Test PDF extraction component."""

    @pytest.fixture
    def extractor(self):
        """Create PDF extractor instance."""
        return PDFExtractor()

    @pytest.mark.skipif(not HAS_FITZ, reason="PyMuPDF not available")
    def test_pdf_text_extraction(self, extractor):
        """Test PDF text extraction."""
        # Create a simple PDF for testing
        import fitz

        # Create a mock PDF document
        mock_doc = Mock()
        mock_doc.page_count = 1
        mock_page = Mock()
        mock_page.get_text.return_value = "This is test PDF content"
        mock_doc.__getitem__.return_value = mock_page

        with patch.object(fitz, 'open', return_value=mock_doc):
            content, metadata = extractor.extract_text("test.pdf")

            assert content == "This is test PDF content"
            assert isinstance(metadata, dict)
            assert 'page_count' in metadata

    @pytest.mark.skipif(not HAS_FITZ, reason="PyMuPDF not available")
    def test_pdf_metadata_extraction(self, extractor):
        """Test PDF metadata extraction."""
        import fitz

        mock_doc = Mock()
        mock_doc.page_count = 2
        mock_doc.metadata = {
            'title': 'Test PDF',
            'author': 'Test Author',
            'subject': 'Test Subject'
        }

        with patch.object(fitz, 'open', return_value=mock_doc):
            content, metadata = extractor.extract_text("test.pdf")

            assert metadata['title'] == 'Test PDF'
            assert metadata['author'] == 'Test Author'
            assert metadata['page_count'] == 2

    @pytest.mark.skipif(not HAS_FITZ, reason="PyMuPDF not available")
    def test_pdf_encryption_handling(self, extractor):
        """Test handling of encrypted PDFs."""
        import fitz

        mock_doc = Mock()
        mock_doc.is_encrypted = True
        mock_doc.authenticate.return_value = False

        with patch.object(fitz, 'open', return_value=mock_doc):
            with pytest.raises(Exception, match="encrypted"):
                extractor.extract_text("encrypted.pdf")


class TestOfficeDocumentExtractor:
    """Test Office document extraction component."""

    @pytest.fixture
    def extractor(self):
        """Create Office document extractor instance."""
        return OfficeDocumentExtractor()

    @pytest.mark.skipif(not HAS_DOCPARSER, reason="docparser not available")
    def test_docx_extraction(self, extractor):
        """Test DOCX file extraction."""
        # Mock docparser result
        mock_parser = Mock()
        mock_parser.parse.return_value = "This is DOCX content"

        with patch('docparser.Document', mock_parser):
            content, metadata = extractor.extract_text("test.docx")

            assert content == "This is DOCX content"
            assert isinstance(metadata, dict)

    def test_unsupported_format(self, extractor):
        """Test handling of unsupported formats."""
        with pytest.raises(ValueError, match="Unsupported format"):
            extractor.extract_text("test.unsupported")


class TestWebContentExtractor:
    """Test web content extraction component."""

    @pytest.fixture
    def extractor(self):
        """Create web content extractor instance."""
        return WebContentExtractor()

    @pytest.mark.asyncio
    @pytest.mark.skipif(not HAS_SOUP, reason="BeautifulSoup not available")
    async def test_html_extraction(self, extractor):
        """Test HTML content extraction."""
        # Mock HTTP response
        mock_response = Mock()
        mock_response.text = """
        <html>
            <head><title>Test Page</title></head>
            <body>
                <h1>Test Content</h1>
                <p>This is a test paragraph.</p>
                <script>var x = 1;</script>
                <style>body { margin: 0; }</style>
            </body>
        </html>
        """
        mock_response.status_code = 200

        with patch('aiohttp.ClientSession.get') as mock_get:
            mock_get.return_value.__aenter__.return_value = mock_response

            content, metadata = await extractor.extract_from_url(
                "http://example.com",
                extraction_options={"remove_elements": ["script", "style"]}
            )

            assert "Test Content" in content
            assert "This is a test paragraph" in content
            assert "var x = 1" not in content  # Script should be removed
            assert "margin: 0" not in content  # Style should be removed

    @pytest.mark.asyncio
    async def test_http_error_handling(self, extractor):
        """Test handling of HTTP errors."""
        with patch('aiohttp.ClientSession.get') as mock_get:
            mock_get.side_effect = Exception("HTTP Error")

            with pytest.raises(Exception, match="HTTP Error"):
                await extractor.extract_from_url("http://example.com")

    @pytest.mark.asyncio
    @pytest.mark.skipif(not HAS_SELENIUM, reason="Selenium not available")
    async def test_javascript_rendering(self, extractor):
        """Test JavaScript rendering with Selenium."""
        # Mock Selenium WebDriver
        mock_driver = Mock()
        mock_driver.page_source = "<html><body>JS rendered content</body></html>"

        with patch('selenium.webdriver.Chrome', return_value=mock_driver):
            content, metadata = await extractor.extract_with_selenium(
                "http://example.com",
                render_js=True
            )

            assert "JS rendered content" in content
            assert isinstance(metadata, dict)


class TestImageExtractor:
    """Test image extraction component."""

    @pytest.fixture
    def extractor(self):
        """Create image extractor instance."""
        return ImageExtractor()

    @pytest.mark.skipif(not HAS_PIL, reason="PIL not available")
    def test_image_basic_info(self, extractor):
        """Test basic image information extraction."""
        from PIL import Image

        # Create a simple test image
        img = Image.new('RGB', (100, 100), color='red')
        img_bytes = BytesIO()
        img.save(img_bytes, format='PNG')
        img_bytes.seek(0)

        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as f:
            f.write(img_bytes.getvalue())
            temp_file_path = f.name

        try:
            content, metadata = extractor.extract_text(temp_file_path)

            # Without OCR, should get basic info
            assert isinstance(metadata, dict)
            assert 'format' in metadata or 'width' in metadata
        finally:
            os.unlink(temp_file_path)

    @pytest.mark.skipif(not (HAS_PIL and HAS_PYTESSERACT), reason="OCR dependencies not available")
    def test_ocr_extraction(self, extractor):
        """Test OCR text extraction from images."""
        # This test requires a real image with text
        # For now, we'll test the OCR path exists

        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as f:
            f.write(b"fake image data")
            temp_file_path = f.name

        try:
            # Mock PIL Image.open and pytesseract
            with patch('PIL.Image.open') as mock_image:
                mock_img = Mock()
                mock_img.convert.return_value = mock_img
                mock_image.return_value = mock_img

                with patch('pytesseract.image_to_string', return_value="Extracted text"):
                    content, metadata = extractor.extract_text(
                        temp_file_path,
                        extraction_options={"use_ocr": True}
                    )

                    assert "Extracted text" in content
        finally:
            os.unlink(temp_file_path)


class TestDocumentProcessor:
    """Test main document processor component."""

    @pytest.fixture
    def processor(self):
        """Create document processor instance."""
        return DocumentProcessor()

    @pytest.fixture
    def sample_text_file(self):
        """Create a sample text file for testing."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write("This is a sample text file for testing document processing.")
            temp_file_path = f.name
        yield temp_file_path
        os.unlink(temp_file_path)

    def test_processor_initialization(self, processor):
        """Test processor initialization."""
        assert processor is not None
        assert hasattr(processor, 'temp_dir')
        assert hasattr(processor, 'security_validator')

    @pytest.mark.asyncio
    async def test_process_text_file(self, processor, sample_text_file):
        """Test processing a simple text file."""
        request = DocumentProcessingRequest(
            file_path=sample_text_file,
            security_level="none"  # Skip security for simple test
        )

        result = await processor.process_document(request)

        assert isinstance(result, DocumentProcessingResponse)
        assert result.success is True
        assert "sample text file" in result.content
        assert result.processing_status == ProcessingStatus.COMPLETED
        assert result.metadata is not None
        assert result.processing_time > 0

    @pytest.mark.asyncio
    async def test_process_nonexistent_file(self, processor):
        """Test processing nonexistent file."""
        request = DocumentProcessingRequest(
            file_path="/nonexistent/file.txt"
        )

        result = await processor.process_document(request)

        assert result.success is False
        assert result.processing_status == ProcessingStatus.FAILED
        assert "not found" in result.error.lower()

    @pytest.mark.asyncio
    async def test_security_validation_integration(self, processor, sample_text_file):
        """Test security validation integration."""
        request = DocumentProcessingRequest(
            file_path=sample_text_file,
            security_level="basic"
        )

        result = await processor.process_document(request)

        assert result.security_validation is not None
        assert isinstance(result.security_validation, SecurityValidationResult)

    @pytest.mark.asyncio
    async def test_batch_processing(self, processor):
        """Test batch document processing."""
        # Create multiple temporary files
        temp_files = []
        for i in range(3):
            with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
                f.write(f"Test content {i}")
                temp_files.append(f.name)

        try:
            documents = [
                DocumentProcessingRequest(
                    file_path=f,
                    security_level="none"
                ) for f in temp_files
            ]

            batch_request = BatchProcessingRequest(
                documents=documents,
                security_level="none"
            )

            result = await processor.process_batch(batch_request)

            assert result.batch_id is not None
            assert len(result.results) == 3
            assert result.total_processed == 3
            assert result.successful == 3
            assert result.failed == 0

        finally:
            for f in temp_files:
                os.unlink(f)

    @pytest.mark.asyncio
    async def test_web_content_processing(self, processor):
        """Test processing web content from URL."""
        # Mock the web content extractor
        with patch.object(processor.web_extractor, 'extract_from_url') as mock_extract:
            mock_extract.return_value = ("Web content extracted", {"source_url": "http://example.com"})

            request = DocumentProcessingRequest(
                source_url="http://example.com",
                security_level="none"
            )

            result = await processor.process_document(request)

            assert result.success is True
            assert "Web content extracted" in result.content
            assert result.source_url == "http://example.com"

    def test_get_supported_formats(self, processor):
        """Test getting supported file formats."""
        formats = processor.get_supported_formats()

        assert isinstance(formats, list)
        assert len(formats) > 0
        assert any('pdf' in fmt.lower() for fmt in formats)
        assert any('txt' in fmt.lower() for fmt in formats)

    def test_dependency_status(self, processor):
        """Test dependency status reporting."""
        status = processor.get_dependency_status()

        expected_keys = [
            'pymupdf', 'pil', 'pytesseract', 'magic',
            'yara', 'docparser', 'beautifulsoup4', 'selenium'
        ]

        for key in expected_keys:
            assert key in status
            assert isinstance(status[key], dict)
            assert 'available' in status[key]


class TestAPIEndpoints:
    """Test document processing API endpoints."""

    @pytest.fixture
    def client(self):
        """Create test client."""
        return TestClient(app)

    def test_health_check(self, client):
        """Test health check endpoint."""
        response = client.get("/api/v1/documents/health")
        assert response.status_code == 200

        data = response.json()
        assert data["status"] == "healthy"
        assert "version" in data
        assert "uptime" in data

    def test_get_supported_formats_endpoint(self, client):
        """Test supported formats endpoint."""
        response = client.get("/api/v1/documents/supported-formats")
        assert response.status_code == 200

        data = response.json()
        assert "formats" in data
        assert "dependencies" in data

    def test_validate_file_endpoint(self, client):
        """Test file validation endpoint."""
        # Create a test file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write("Test file content")
            temp_file_path = f.name

        try:
            with open(temp_file_path, 'rb') as test_file:
                files = {"file": ("test.txt", test_file, "text/plain")}
                data = {"security_level": "basic"}

                response = client.post(
                    "/api/v1/documents/validate",
                    files=files,
                    data=data
                )

                assert response.status_code == 200

                result = response.json()
                assert "is_safe" in result
                assert "threats_detected" in result
                assert "file_hash" in result
        finally:
            os.unlink(temp_file_path)

    @pytest.mark.asyncio
    async def test_process_url_endpoint(self, client):
        """Test URL processing endpoint."""
        # Mock the web extractor
        with patch('app.services.document_processor.WebContentExtractor.extract_from_url') as mock_extract:
            mock_extract.return_value = ("Web content", {"source_url": "http://example.com"})

            response = client.post(
                "/api/v1/documents/process-url?url=http://example.com&security_level=none"
            )

            assert response.status_code == 200

            data = response.json()
            assert data["success"] is True
            assert "Web content" in data["content"]
            assert data["source_url"] == "http://example.com"

    def test_upload_endpoint(self, client):
        """Test document upload endpoint."""
        # Create a test file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write("Test upload content")
            temp_file_path = f.name

        try:
            with open(temp_file_path, 'rb') as test_file:
                files = {"file": ("test.txt", test_file, "text/plain")}
                data = {
                    "filename": "test.txt",
                    "file_size": os.path.getsize(temp_file_path),
                    "mime_type": "text/plain",
                    "content_type": "document",
                    "tags": '["test"]',
                    "security_scan": "false"
                }

                response = client.post(
                    "/api/v1/documents/upload",
                    files=files,
                    data=data
                )

                assert response.status_code == 200

                result = response.json()
                assert "document_id" in result
                assert "upload_url" in result
        finally:
            os.unlink(temp_file_path)

    def test_ocr_languages_endpoint(self, client):
        """Test OCR languages endpoint."""
        response = client.get("/api/v1/documents/ocr-languages")
        assert response.status_code == 200

        data = response.json()
        assert "languages" in data
        assert isinstance(data["languages"], list)

    def test_cleanup_temp_files_endpoint(self, client):
        """Test temp files cleanup endpoint."""
        response = client.post("/api/v1/documents/cleanup-temp")
        assert response.status_code == 200

        data = response.json()
        assert "cleaned_files" in data
        assert "space_freed" in data


class TestErrorHandling:
    """Test error handling scenarios."""

    @pytest.fixture
    def processor(self):
        """Create document processor instance."""
        return DocumentProcessor()

    @pytest.mark.asyncio
    async def test_invalid_file_path(self, processor):
        """Test handling of invalid file paths."""
        request = DocumentProcessingRequest(
            file_path="",
            security_level="none"
        )

        result = await processor.process_document(request)

        assert result.success is False
        assert result.error is not None

    @pytest.mark.asyncio
    async def test_file_permission_error(self, processor):
        """Test handling of file permission errors."""
        # Use a path that likely doesn't exist or isn't readable
        request = DocumentProcessingRequest(
            file_path="/root/inaccessible.txt",
            security_level="none"
        )

        result = await processor.process_document(request)

        assert result.success is False
        assert "permission" in result.error.lower() or "not found" in result.error.lower()

    @pytest.mark.asyncio
    async def test_corrupted_file_handling(self, processor):
        """Test handling of corrupted files."""
        # Create a file with invalid content for its extension
        with tempfile.NamedTemporaryFile(mode='wb', suffix='.pdf', delete=False) as f:
            f.write(b"This is not a valid PDF file content")
            temp_file_path = f.name

        try:
            request = DocumentProcessingRequest(
                file_path=temp_file_path,
                security_level="none"
            )

            result = await processor.process_document(request)

            # Should handle gracefully
            assert isinstance(result, DocumentProcessingResponse)
            # May succeed with basic content or fail gracefully
        finally:
            os.unlink(temp_file_path)

    def test_dependency_missing_graceful_degradation(self):
        """Test graceful degradation when dependencies are missing."""
        # Test with all dependencies mocked as unavailable
        with patch.dict('sys.modules', {
            'fitz': None,
            'PIL': None,
            'pytesseract': None,
            'magic': None,
            'yara': None
        }):
            # Reimport to test dependency checking
            from importlib import reload
            import app.services.document_processor as dp_module
            reload(dp_module)

            processor = dp_module.DocumentProcessor()

            # Should still initialize without crashing
            assert processor is not None

            # Should get limited functionality
            formats = processor.get_supported_formats()
            assert isinstance(formats, list)


class TestPerformance:
    """Test performance and scalability."""

    @pytest.fixture
    def processor(self):
        """Create document processor instance."""
        return DocumentProcessor()

    @pytest.mark.asyncio
    async def test_large_file_processing(self, processor):
        """Test processing of larger files."""
        # Create a larger text file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            # Write substantial content
            content = "This is test line.\n" * 1000
            f.write(content)
            temp_file_path = f.name

        try:
            request = DocumentProcessingRequest(
                file_path=temp_file_path,
                security_level="none"
            )

            import time
            start_time = time.time()

            result = await processor.process_document(request)

            processing_time = time.time() - start_time

            assert result.success is True
            assert result.processing_time > 0
            # Should complete reasonably quickly (adjust threshold as needed)
            assert processing_time < 10.0  # 10 seconds max

        finally:
            os.unlink(temp_file_path)

    @pytest.mark.asyncio
    async def test_concurrent_processing(self, processor):
        """Test concurrent document processing."""
        # Create multiple files
        temp_files = []
        for i in range(5):
            with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
                f.write(f"Concurrent test content {i}")
                temp_files.append(f.name)

        try:
            # Create processing tasks
            tasks = []
            for file_path in temp_files:
                request = DocumentProcessingRequest(
                    file_path=file_path,
                    security_level="none"
                )
                task = processor.process_document(request)
                tasks.append(task)

            # Execute concurrently
            results = await asyncio.gather(*tasks)

            # All should succeed
            assert len(results) == 5
            assert all(result.success for result in results)

        finally:
            for f in temp_files:
                os.unlink(f)


class TestConfiguration:
    """Test configuration and settings."""

    def test_default_settings(self):
        """Test default configuration settings."""
        from app.services.document_processor import OCRSettings, WebExtractionSettings, ProcessingSettings

        ocr_settings = OCRSettings()
        assert ocr_settings.engine == "tesseract"
        assert ocr_settings.language == "eng"

        web_settings = WebExtractionSettings()
        assert web_settings.timeout == 30
        assert web_settings.user_agent == "UPM.Plus Document Processor"

        processing_settings = ProcessingSettings()
        assert processing_settings.max_file_size == 100 * 1024 * 1024  # 100MB
        assert processing_settings.chunk_size == 1000

    def test_settings_validation(self):
        """Test settings validation."""
        from app.schemas.documents import OCRSettings, ProcessingSettings

        # Test valid settings
        ocr_settings = OCRSettings(
            engine="tesseract",
            language="eng",
            confidence_threshold=0.8
        )
        assert ocr_settings.confidence_threshold == 0.8

        # Test invalid confidence threshold
        with pytest.raises(ValueError):
            OCRSettings(confidence_threshold=1.5)  # Above maximum

        with pytest.raises(ValueError):
            OCRSettings(confidence_threshold=-0.1)  # Below minimum


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])