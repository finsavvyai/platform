//go:build ignore

package storage

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/sirupsen/logrus"
	"go.opentelemetry.io/otel"
)

// MetadataExtractor extracts metadata from various file formats
type MetadataExtractor struct {
	extractors map[string]FormatExtractor
	logger     *logrus.Logger
}

// FormatExtractor defines the interface for format-specific metadata extraction
type FormatExtractor interface {
	// Extract extracts metadata from content
	Extract(ctx context.Context, content []byte) (map[string]interface{}, error)

	// GetSupportedTypes returns the content types this extractor supports
	GetSupportedTypes() []string

	// ValidateContent checks if the content is valid for this format
	ValidateContent(content []byte) error
}

// NewMetadataExtractor creates a new metadata extractor instance
func NewMetadataExtractor(logger *logrus.Logger) *MetadataExtractor {
	extractor := &MetadataExtractor{
		extractors: make(map[string]FormatExtractor),
		logger:     logger,
	}

	// Register format extractors
	extractor.registerExtractor(NewPDFExtractor(logger))
	extractor.registerExtractor(NewDOCXExtractor(logger))
	extractor.registerExtractor(NewTXTExtractor(logger))
	extractor.registerExtractor(NewJSONExtractor(logger))
	extractor.registerExtractor(NewCSVExtractor(logger))
	extractor.registerExtractor(NewHTMLExtractor(logger))
	extractor.registerExtractor(NewImageExtractor(logger))

	return extractor
}

// Extract extracts metadata from file content
func (e *MetadataExtractor) Extract(ctx context.Context, content []byte, contentType string) (map[string]interface{}, error) {
	ctx, span := otel.Tracer("metadata-extractor").Start(ctx, "Extract")
	defer span.End()

	metadata := make(map[string]interface{})

	// Add basic metadata
	metadata["extraction_timestamp"] = time.Now().UTC().Format(time.RFC3339)
	metadata["content_length"] = len(content)
	metadata["content_type"] = contentType
	metadata["extraction_service"] = "metadata-extractor"

	// Find appropriate extractor
	extractor, exists := e.extractors[contentType]
	if !exists {
		// Try to find extractor by content type pattern
		for ct, ext := range e.extractors {
			if strings.Contains(contentType, ct) || strings.Contains(ct, contentType) {
				extractor = ext
				break
			}
		}
	}

	if extractor == nil {
		// No specific extractor found, return basic metadata
		e.logger.WithField("content_type", contentType).Debug("No specific extractor found, returning basic metadata")
		return metadata, nil
	}

	// Extract format-specific metadata
	formatMetadata, err := extractor.Extract(ctx, content)
	if err != nil {
		e.logger.WithFields(logrus.Fields{
			"content_type": contentType,
			"error":        err,
		}).Warn("Format-specific metadata extraction failed")
		metadata["extraction_error"] = err.Error()
		return metadata, nil
	}

	// Merge metadata
	for k, v := range formatMetadata {
		metadata[k] = v
	}

	e.logger.WithFields(logrus.Fields{
		"content_type":  contentType,
		"metadata_keys": len(metadata),
	}).Debug("Metadata extraction completed")

	return metadata, nil
}

// ExtractBatch extracts metadata from multiple files
func (e *MetadataExtractor) ExtractBatch(ctx context.Context, files []BatchExtractRequest) ([]map[string]interface{}, error) {
	ctx, span := otel.Tracer("metadata-extractor").Start(ctx, "ExtractBatch")
	defer span.End()

	results := make([]map[string]interface{}, len(files))

	for i, file := range files {
		metadata, err := e.Extract(ctx, file.Content, file.ContentType)
		if err != nil {
			e.logger.WithFields(logrus.Fields{
				"file_id": file.ID,
				"error":   err,
			}).Error("Failed to extract metadata from file in batch")

			// Return error metadata
			results[i] = map[string]interface{}{
				"extraction_error":     err.Error(),
				"file_id":              file.ID,
				"content_type":         file.ContentType,
				"extraction_timestamp": time.Now().UTC().Format(time.RFC3339),
			}
		} else {
			results[i] = metadata
		}
	}

	return results, nil
}

// GetSupportedTypes returns a list of supported content types
func (e *MetadataExtractor) GetSupportedTypes() []string {
	types := make([]string, 0, len(e.extractors))
	for contentType := range e.extractors {
		types = append(types, contentType)
	}
	return types
}

// HealthCheck performs a health check on the metadata extractor
func (e *MetadataExtractor) HealthCheck(ctx context.Context) error {
	ctx, span := otel.Tracer("metadata-extractor").Start(ctx, "HealthCheck")
	defer span.End()

	// Test with a simple text content
	testContent := []byte("Test content for metadata extraction")
	_, err := e.Extract(ctx, testContent, "text/plain")
	if err != nil {
		return fmt.Errorf("metadata extractor health check failed: %w", err)
	}

	e.logger.Debug("Metadata extractor health check passed")
	return nil
}

// registerExtractor registers a format extractor
func (e *MetadataExtractor) registerExtractor(extractor FormatExtractor) {
	for _, contentType := range extractor.GetSupportedTypes() {
		e.extractors[contentType] = extractor
	}
}

// PDFExtractor extracts metadata from PDF files
type PDFExtractor struct {
	logger *logrus.Logger
}

// NewPDFExtractor creates a new PDF metadata extractor
func NewPDFExtractor(logger *logrus.Logger) *PDFExtractor {
	return &PDFExtractor{logger: logger}
}

func (e *PDFExtractor) Extract(ctx context.Context, content []byte) (map[string]interface{}, error) {
	metadata := make(map[string]interface{})

	// Basic PDF analysis
	metadata["file_format"] = "PDF"
	metadata["extractable"] = true

	// Check for PDF header
	if len(content) > 4 && string(content[:4]) == "%PDF" {
		metadata["valid_pdf"] = true

		// Try to extract basic PDF info (simplified version)
		contentStr := string(content)

		// Look for common PDF metadata fields
		if strings.Contains(contentStr, "/Title") {
			metadata["has_title"] = true
		}
		if strings.Contains(contentStr, "/Author") {
			metadata["has_author"] = true
		}
		if strings.Contains(contentStr, "/Creator") {
			metadata["has_creator"] = true
		}
		if strings.Contains(contentStr, "/Producer") {
			metadata["has_producer"] = true
		}

		// Count pages (simplified - looks for "count" patterns)
		pageCount := strings.Count(contentStr, "/Type /Page")
		if pageCount > 0 {
			metadata["estimated_pages"] = pageCount
		}

		// Check for encryption
		if strings.Contains(contentStr, "/Encrypt") {
			metadata["encrypted"] = true
		} else {
			metadata["encrypted"] = false
		}

	} else {
		metadata["valid_pdf"] = false
		metadata["extractable"] = false
	}

	return metadata, nil
}

func (e *PDFExtractor) GetSupportedTypes() []string {
	return []string{"application/pdf"}
}

func (e *PDFExtractor) ValidateContent(content []byte) error {
	if len(content) < 4 {
		return fmt.Errorf("content too short to be a PDF")
	}

	if string(content[:4]) != "%PDF" {
		return fmt.Errorf("invalid PDF header")
	}

	return nil
}

// DOCXExtractor extracts metadata from DOCX files
type DOCXExtractor struct {
	logger *logrus.Logger
}

// NewDOCXExtractor creates a new DOCX metadata extractor
func NewDOCXExtractor(logger *logrus.Logger) *DOCXExtractor {
	return &DOCXExtractor{logger: logger}
}

func (e *DOCXExtractor) Extract(ctx context.Context, content []byte) (map[string]interface{}, error) {
	metadata := make(map[string]interface{})

	metadata["file_format"] = "DOCX"
	metadata["extractable"] = true

	// Check for DOCX signature (ZIP file)
	if len(content) > 4 {
		signature := string(content[:4])
		if signature == "PK\x03\x04" || signature == "PK\x05\x06" || signature == "PK\x07\x08" {
			metadata["valid_docx"] = true
			metadata["zip_container"] = true

			// Look for DOCX-specific content
			contentStr := string(content)
			if strings.Contains(contentStr, "word/document.xml") {
				metadata["has_document"] = true
			}
			if strings.Contains(contentStr, "docProps/core.xml") {
				metadata["has_metadata"] = true
			}

		} else {
			metadata["valid_docx"] = false
			metadata["extractable"] = false
		}
	}

	return metadata, nil
}

func (e *DOCXExtractor) GetSupportedTypes() []string {
	return []string{
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		"application/msword",
	}
}

func (e *DOCXExtractor) ValidateContent(content []byte) error {
	if len(content) < 4 {
		return fmt.Errorf("content too short to be a DOCX file")
	}

	signature := string(content[:4])
	if signature != "PK\x03\x04" && signature != "PK\x05\x06" && signature != "PK\x07\x08" {
		return fmt.Errorf("invalid DOCX signature (not a ZIP file)")
	}

	return nil
}

// TXTExtractor extracts metadata from text files
type TXTExtractor struct {
	logger *logrus.Logger
}

// NewTXTExtractor creates a new text metadata extractor
func NewTXTExtractor(logger *logrus.Logger) *TXTExtractor {
	return &TXTExtractor{logger: logger}
}

func (e *TXTExtractor) Extract(ctx context.Context, content []byte) (map[string]interface{}, error) {
	metadata := make(map[string]interface{})
	contentStr := string(content)

	metadata["file_format"] = "TXT"
	metadata["extractable"] = true

	// Basic text statistics
	metadata["character_count"] = len(contentStr)
	metadata["line_count"] = strings.Count(contentStr, "\n") + 1
	metadata["word_count"] = len(strings.Fields(contentStr))

	// Check for different types of content
	if strings.Contains(contentStr, "{") && strings.Contains(contentStr, "}") {
		metadata["likely_json"] = true
	}
	if strings.Contains(contentStr, "<") && strings.Contains(contentStr, ">") {
		metadata["likely_xml"] = true
	}
	if strings.Contains(contentStr, "#") {
		metadata["likely_markdown"] = true
	}

	// Language detection (very basic)
	if strings.Contains(contentStr, "the ") && strings.Contains(contentStr, "and ") {
		metadata["likely_english"] = true
	}

	// Check for PII patterns (basic)
	if strings.Contains(contentStr, "@") && strings.Contains(contentStr, ".") {
		metadata["contains_email"] = true
	}

	return metadata, nil
}

func (e *TXTExtractor) GetSupportedTypes() []string {
	return []string{"text/plain", "text/markdown"}
}

func (e *TXTExtractor) ValidateContent(content []byte) error {
	// Text files can contain any content, so just check for readability
	if len(content) == 0 {
		return fmt.Errorf("empty text file")
	}
	return nil
}

// JSONExtractor extracts metadata from JSON files
type JSONExtractor struct {
	logger *logrus.Logger
}

// NewJSONExtractor creates a new JSON metadata extractor
func NewJSONExtractor(logger *logrus.Logger) *JSONExtractor {
	return &JSONExtractor{logger: logger}
}

func (e *JSONExtractor) Extract(ctx context.Context, content []byte) (map[string]interface{}, error) {
	metadata := make(map[string]interface{})

	metadata["file_format"] = "JSON"
	metadata["extractable"] = true

	// Try to parse JSON
	var jsonData interface{}
	if err := json.Unmarshal(content, &jsonData); err != nil {
		metadata["valid_json"] = false
		metadata["parse_error"] = err.Error()
		return metadata, nil
	}

	metadata["valid_json"] = true

	// Analyze JSON structure
	switch v := jsonData.(type) {
	case map[string]interface{}:
		metadata["json_type"] = "object"
		metadata["property_count"] = len(v)

		// Look for common JSON patterns
		for key := range v {
			if strings.Contains(strings.ToLower(key), "id") {
				metadata["has_id_field"] = true
			}
			if strings.Contains(strings.ToLower(key), "timestamp") || strings.Contains(strings.ToLower(key), "date") {
				metadata["has_timestamp"] = true
			}
		}

	case []interface{}:
		metadata["json_type"] = "array"
		metadata["array_length"] = len(v)

	default:
		metadata["json_type"] = "primitive"
	}

	return metadata, nil
}

func (e *JSONExtractor) GetSupportedTypes() []string {
	return []string{"application/json", "text/json"}
}

func (e *JSONExtractor) ValidateContent(content []byte) error {
	contentStr := strings.TrimSpace(string(content))
	if contentStr == "" {
		return fmt.Errorf("empty JSON content")
	}

	if !strings.HasPrefix(contentStr, "{") && !strings.HasPrefix(contentStr, "[") {
		return fmt.Errorf("content does not appear to be JSON")
	}

	var jsonData interface{}
	return json.Unmarshal(content, &jsonData)
}

// CSVExtractor extracts metadata from CSV files
type CSVExtractor struct {
	logger *logrus.Logger
}

// NewCSVExtractor creates a new CSV metadata extractor
func NewCSVExtractor(logger *logrus.Logger) *CSVExtractor {
	return &CSVExtractor{logger: logger}
}

func (e *CSVExtractor) Extract(ctx context.Context, content []byte) (map[string]interface{}, error) {
	metadata := make(map[string]interface{})
	contentStr := string(content)

	metadata["file_format"] = "CSV"
	metadata["extractable"] = true

	// Basic CSV analysis
	lines := strings.Split(contentStr, "\n")
	if len(lines) > 0 {
		// Remove empty lines
		var nonEmptyLines []string
		for _, line := range lines {
			if strings.TrimSpace(line) != "" {
				nonEmptyLines = append(nonEmptyLines, line)
			}
		}
		lines = nonEmptyLines

		metadata["line_count"] = len(lines)

		if len(lines) > 0 {
			// Count columns in first line
			firstLine := lines[0]
			columns := strings.Split(firstLine, ",")
			metadata["column_count"] = len(columns)
			metadata["has_header"] = len(lines) > 1 // Assume first line is header if more lines exist

			// Try to detect delimiter
			commaCount := strings.Count(firstLine, ",")
			semicolonCount := strings.Count(firstLine, ";")
			tabCount := strings.Count(firstLine, "\t")

			if semicolonCount > commaCount && semicolonCount > tabCount {
				metadata["delimiter"] = ";"
			} else if tabCount > commaCount {
				metadata["delimiter"] = "\t"
			} else {
				metadata["delimiter"] = ","
			}
		}
	}

	return metadata, nil
}

func (e *CSVExtractor) GetSupportedTypes() []string {
	return []string{"text/csv", "application/csv"}
}

func (e *CSVExtractor) ValidateContent(content []byte) error {
	contentStr := strings.TrimSpace(string(content))
	if contentStr == "" {
		return fmt.Errorf("empty CSV content")
	}

	// Basic CSV validation - should contain commas or other delimiters
	if !strings.Contains(contentStr, ",") && !strings.Contains(contentStr, ";") && !strings.Contains(contentStr, "\t") {
		return fmt.Errorf("content does not appear to be CSV format")
	}

	return nil
}

// HTMLExtractor extracts metadata from HTML files
type HTMLExtractor struct {
	logger *logrus.Logger
}

// NewHTMLExtractor creates a new HTML metadata extractor
func NewHTMLExtractor(logger *logrus.Logger) *HTMLExtractor {
	return &HTMLExtractor{logger: logger}
}

func (e *HTMLExtractor) Extract(ctx context.Context, content []byte) (map[string]interface{}, error) {
	metadata := make(map[string]interface{})
	contentStr := string(content)

	metadata["file_format"] = "HTML"
	metadata["extractable"] = true

	// Check for HTML structure
	if strings.Contains(contentStr, "<html") || strings.Contains(contentStr, "<HTML") {
		metadata["valid_html"] = true

		// Look for common HTML elements
		metadata["has_title"] = strings.Contains(contentStr, "<title")
		metadata["has_head"] = strings.Contains(contentStr, "<head")
		metadata["has_body"] = strings.Contains(contentStr, "<body")
		metadata["has_meta"] = strings.Contains(contentStr, "<meta")

		// Count some elements
		metadata["paragraph_count"] = strings.Count(strings.ToLower(contentStr), "<p")
		metadata["link_count"] = strings.Count(strings.ToLower(contentStr), "<a")
		metadata["image_count"] = strings.Count(strings.ToLower(contentStr), "<img")

		// Check for forms
		metadata["has_forms"] = strings.Contains(strings.ToLower(contentStr), "<form")

	} else {
		metadata["valid_html"] = false
		metadata["extractable"] = false
	}

	return metadata, nil
}

func (e *HTMLExtractor) GetSupportedTypes() []string {
	return []string{"text/html", "application/xhtml+xml"}
}

func (e *HTMLExtractor) ValidateContent(content []byte) error {
	contentStr := strings.TrimSpace(string(content))
	if contentStr == "" {
		return fmt.Errorf("empty HTML content")
	}

	if !strings.Contains(strings.ToLower(contentStr), "<html") && !strings.Contains(strings.ToLower(contentStr), "<!doctype") {
		return fmt.Errorf("content does not appear to be HTML")
	}

	return nil
}

// ImageExtractor extracts metadata from image files
type ImageExtractor struct {
	logger *logrus.Logger
}

// NewImageExtractor creates a new image metadata extractor
func NewImageExtractor(logger *logrus.Logger) *ImageExtractor {
	return &ImageExtractor{logger: logger}
}

func (e *ImageExtractor) Extract(ctx context.Context, content []byte) (map[string]interface{}, error) {
	metadata := make(map[string]interface{})

	metadata["file_format"] = "IMAGE"
	metadata["extractable"] = true
	metadata["file_size"] = len(content)

	// Detect image type by signatures
	if len(content) >= 8 {
		// JPEG
		if content[0] == 0xFF && content[1] == 0xD8 && content[2] == 0xFF {
			metadata["image_type"] = "JPEG"
			metadata["valid_image"] = true
		} else if len(content) >= 8 && string(content[1:4]) == "PNG" {
			// PNG
			metadata["image_type"] = "PNG"
			metadata["valid_image"] = true
		} else if len(content) >= 6 && (string(content[0:6]) == "GIF87a" || string(content[0:6]) == "GIF89a") {
			// GIF
			metadata["image_type"] = "GIF"
			metadata["valid_image"] = true
		} else if len(content) >= 12 && string(content[0:4]) == "RIFF" && string(content[8:12]) == "WEBP" {
			// WebP
			metadata["image_type"] = "WebP"
			metadata["valid_image"] = true
		} else {
			metadata["valid_image"] = false
			metadata["extractable"] = false
		}
	} else {
		metadata["valid_image"] = false
		metadata["extractable"] = false
	}

	return metadata, nil
}

func (e *ImageExtractor) GetSupportedTypes() []string {
	return []string{"image/jpeg", "image/png", "image/gif", "image/webp"}
}

func (e *ImageExtractor) ValidateContent(content []byte) error {
	if len(content) < 8 {
		return fmt.Errorf("content too short to be an image")
	}

	// Check for valid image signatures
	validSignatures := []string{
		"\xFF\xD8\xFF",      // JPEG
		"\x89PNG\r\n\x1a\n", // PNG
		"GIF87a",            // GIF87a
		"GIF89a",            // GIF89a
		"RIFF",              // WebP (needs additional check)
	}

	for _, sig := range validSignatures {
		if strings.HasPrefix(string(content), sig) {
			return nil
		}
	}

	return fmt.Errorf("unrecognized image format")
}
