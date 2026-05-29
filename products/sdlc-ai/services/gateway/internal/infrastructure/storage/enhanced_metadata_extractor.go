//go:build ignore

package storage

import (
	"context"
	"crypto/sha256"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/sirupsen/logrus"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"

	"github.com/dlclark/regexp2"
	"github.com/rwcarlsen/goexif/exif"
	"github.com/unidoc/unioffice/common/license"
	"github.com/unidoc/unioffice/document"
	"github.com/unidoc/unioffice/presentation"
	"github.com/unidoc/unioffice/spreadsheet"
	"github.com/unidoc/unipdf/v3/common/license"
	pdf "github.com/unidoc/unipdf/v3/model"

	"github.com/rsc/letsencrypt"
)

// EnhancedMetadataConfig holds configuration for enhanced metadata extraction
type EnhancedMetadataConfig struct {
	EnableEXIFExtraction   bool          `json:"enable_exif_extraction"`
	EnableDocumentMetadata bool          `json:"enable_document_metadata"`
	EnableTextPreview      bool          `json:"enable_text_preview"`
	PreviewMaxLength       int           `json:"preview_max_length"`
	EnableContentAnalysis  bool          `json:"enable_content_analysis"`
	LanguageDetection      bool          `json:"language_detection"`
	CacheEnabled           bool          `json:"cache_enabled"`
	CacheSize              int           `json:"cache_size"`
	CacheTTL               time.Duration `json:"cache_ttl"`
	Timeout                time.Duration `json:"timeout"`
}

// DefaultEnhancedMetadataConfig returns default configuration
func DefaultEnhancedMetadataConfig() *EnhancedMetadataConfig {
	return &EnhancedMetadataConfig{
		EnableEXIFExtraction:   true,
		EnableDocumentMetadata: true,
		EnableTextPreview:      true,
		PreviewMaxLength:       500,
		EnableContentAnalysis:  true,
		LanguageDetection:      true,
		CacheEnabled:           true,
		CacheSize:              1000,
		CacheTTL:               1 * time.Hour,
		Timeout:                30 * time.Second,
	}
}

// EnhancedMetadataExtractor provides comprehensive metadata extraction
type EnhancedMetadataExtractor struct {
	config *EnhancedMetadataConfig
	logger *logrus.Logger
	cache  *lru.Cache
	tracer trace.Tracer
}

// NewEnhancedMetadataExtractor creates a new enhanced metadata extractor
func NewEnhancedMetadataExtractor(config *EnhancedMetadataConfig, logger *logrus.Logger) (*EnhancedMetadataExtractor, error) {
	if config == nil {
		config = DefaultEnhancedMetadataConfig()
	}

	extractor := &EnhancedMetadataExtractor{
		config: config,
		logger: logger,
		tracer: otel.Tracer("enhanced-metadata-extractor"),
	}

	if config.CacheEnabled {
		extractor.cache = lru.New(config.CacheSize)
	}

	// Initialize unidoc license (free license for community)
	license.SetCommunityLicense()

	return extractor, nil
}

// Extract extracts comprehensive metadata from file content
func (e *EnhancedMetadataExtractor) Extract(ctx context.Context, content []byte, contentType string) (map[string]interface{}, error) {
	ctx, span := e.tracer.Start(ctx, "Extract")
	defer span.End()

	// Check cache first
	if e.config.CacheEnabled {
		if cached := e.getFromCache(content, contentType); cached != nil {
			e.logger.Debug("Returning cached metadata")
			return cached, nil
		}
	}

	metadata := make(map[string]interface{})

	// Add basic metadata
	e.addBasicMetadata(metadata, content, contentType)

	// Extract format-specific metadata
	var err error
	switch {
	case e.isImageType(contentType):
		err = e.extractImageMetadata(ctx, metadata, content)
	case e.isPDFType(contentType):
		err = e.extractPDFMetadata(ctx, metadata, content)
	case e.isOfficeDocumentType(contentType):
		err = e.extractOfficeMetadata(ctx, metadata, content, contentType)
	case e.isTextType(contentType):
		err = e.extractTextMetadata(ctx, metadata, content)
	}

	if err != nil {
		e.logger.WithFields(logrus.Fields{
			"content_type": contentType,
			"error":        err,
		}).Warn("Metadata extraction failed")
		// Don't fail completely, continue with basic metadata
	}

	// Add text preview
	if e.config.EnableTextPreview {
		e.addTextPreview(ctx, metadata, content, contentType)
	}

	// Add content analysis
	if e.config.EnableContentAnalysis {
		e.addContentAnalysis(ctx, metadata, content, contentType)
	}

	// Cache the result
	if e.config.CacheEnabled {
		e.addToCache(content, contentType, metadata)
	}

	return metadata, nil
}

// ExtractBatch extracts metadata from multiple files
func (e *EnhancedMetadataExtractor) ExtractBatch(ctx context.Context, files []BatchExtractRequest) ([]map[string]interface{}, error) {
	results := make([]map[string]interface{}, len(files))

	for i, file := range files {
		metadata, err := e.Extract(ctx, file.Content, file.ContentType)
		if err != nil {
			e.logger.WithFields(logrus.Fields{
				"file_id": file.ID,
				"error":   err,
			}).Error("Failed to extract metadata in batch")

			// Return error metadata
			results[i] = map[string]interface{}{
				"extraction_error": err.Error(),
				"file_id":          file.ID,
				"content_type":     file.ContentType,
			}
		} else {
			// Add file ID to metadata
			metadata["file_id"] = file.ID
			results[i] = metadata
		}
	}

	return results, nil
}

// GetSupportedTypes returns a list of supported content types
func (e *EnhancedMetadataExtractor) GetSupportedTypes() []string {
	return []string{
		// Images
		"image/jpeg",
		"image/png",
		"image/gif",
		"image/webp",
		"image/tiff",
		"image/bmp",

		// PDF
		"application/pdf",

		// Office documents
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		"application/vnd.openxmlformats-officedocument.presentationml.presentation",
		"application/msword",
		"application/vnd.ms-excel",
		"application/vnd.ms-powerpoint",

		// Text formats
		"text/plain",
		"text/csv",
		"text/html",
		"text/xml",
		"application/json",
		"text/markdown",
	}
}

// HealthCheck performs a health check on the metadata extractor
func (e *EnhancedMetadataExtractor) HealthCheck(ctx context.Context) error {
	// Test with a simple text file
	testContent := []byte("This is a test file for metadata extraction.")
	metadata, err := e.Extract(ctx, testContent, "text/plain")
	if err != nil {
		return fmt.Errorf("metadata extractor health check failed: %w", err)
	}

	if metadata == nil {
		return fmt.Errorf("metadata extraction returned nil")
	}

	return nil
}

// Helper methods

func (e *EnhancedMetadataExtractor) addBasicMetadata(metadata map[string]interface{}, content []byte, contentType string) {
	metadata["content_length"] = len(content)
	metadata["content_type"] = contentType
	metadata["extraction_timestamp"] = time.Now().UTC().Format(time.RFC3339)
	metadata["processing_service"] = "enhanced-metadata-extractor"
	metadata["file_size_category"] = e.categorizeFileSize(len(content))
}

func (e *EnhancedMetadataExtractor) extractImageMetadata(ctx context.Context, metadata map[string]interface{}, content []byte) error {
	if !e.config.EnableEXIFExtraction {
		return nil
	}

	// Try to extract EXIF data
	exifData, err := exif.Decode(strings.NewReader(string(content)))
	if err != nil {
		// Not all images have EXIF data, this is not necessarily an error
		metadata["exif_error"] = err.Error()
		return nil
	}

	exifMetadata := make(map[string]interface{})

	// Extract basic EXIF tags
	if dateTime, err := exifData.DateTime(); err == nil {
		exifMetadata["date_time"] = dateTime.Format(time.RFC3339)
	}

	if make, err := exifData.Get(exif.Make); err == nil {
		exifMetadata["make"] = strings.TrimSpace(make.StringVal)
	}

	if model, err := exifData.Get(exif.Model); err == nil {
		exifMetadata["model"] = strings.TrimSpace(model.StringVal)
	}

	if orientation, err := exifData.Get(exif.Orientation); err == nil {
		exifMetadata["orientation"] = orientation.StringVal
	}

	if software, err := exifData.Get(exif.Software); err == nil {
		exifMetadata["software"] = strings.TrimSpace(software.StringVal)
	}

	// Extract GPS information if available
	if lat, long, err := exifData.LatLong(); err == nil {
		exifMetadata["gps_coordinates"] = map[string]float64{
			"latitude":  lat,
			"longitude": long,
		}
	}

	// Extract image dimensions
	if xRes, err := exifData.Get(exif.PixelXDimension); err == nil {
		exifMetadata["width"] = xRes.Int(0)
	}

	if yRes, err := exifData.Get(exif.PixelYDimension); err == nil {
		exifMetadata["height"] = yRes.Int(0)
	}

	metadata["exif"] = exifMetadata
	return nil
}

func (e *EnhancedMetadataExtractor) extractPDFMetadata(ctx context.Context, metadata map[string]interface{}, content []byte) error {
	if !e.config.EnableDocumentMetadata {
		return nil
	}

	// Create PDF reader
	pdfReader, err := pdf.NewPdfReader(strings.NewReader(string(content)))
	if err != nil {
		return fmt.Errorf("failed to create PDF reader: %w", err)
	}

	// Get PDF information
	pdfInfo, err := pdfReader.GetPdfInfo()
	if err != nil {
		return fmt.Errorf("failed to get PDF info: %w", err)
	}

	pdfMetadata := make(map[string]interface{})

	// Extract PDF metadata
	if pdfInfo.Title != "" {
		pdfMetadata["title"] = pdfInfo.Title
	}

	if pdfInfo.Author != "" {
		pdfMetadata["author"] = pdfInfo.Author
	}

	if pdfInfo.Subject != "" {
		pdfMetadata["subject"] = pdfInfo.Subject
	}

	if pdfInfo.Creator != "" {
		pdfMetadata["creator"] = pdfInfo.Creator
	}

	if pdfInfo.Producer != "" {
		pdfMetadata["producer"] = pdfInfo.Producer
	}

	if !pdfInfo.CreationDate.IsZero() {
		pdfMetadata["creation_date"] = pdfInfo.CreationDate.Format(time.RFC3339)
	}

	if !pdfInfo.ModDate.IsZero() {
		pdfMetadata["modification_date"] = pdfInfo.ModDate.Format(time.RFC3339)
	}

	// Get page count
	numPages, err := pdfReader.GetNumPages()
	if err == nil {
		pdfMetadata["page_count"] = numPages
	}

	// Check for encryption
	isEncrypted, err := pdfReader.IsEncrypted()
	if err == nil {
		pdfMetadata["encrypted"] = isEncrypted
	}

	metadata["pdf"] = pdfMetadata
	return nil
}

func (e *EnhancedMetadataExtractor) extractOfficeMetadata(ctx context.Context, metadata map[string]interface{}, content []byte, contentType string) error {
	if !e.config.EnableDocumentMetadata {
		return nil
	}

	officeMetadata := make(map[string]interface{})

	switch contentType {
	case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
		return e.extractWordMetadata(ctx, content, officeMetadata)
	case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
		return e.extractExcelMetadata(ctx, content, officeMetadata)
	case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
		return e.extractPowerPointMetadata(ctx, content, officeMetadata)
	default:
		officeMetadata["unsupported_format"] = contentType
	}

	metadata["office"] = officeMetadata
	return nil
}

func (e *EnhancedMetadataExtractor) extractWordMetadata(ctx context.Context, content []byte, metadata map[string]interface{}) error {
	doc, err := document.Open(strings.NewReader(string(content)))
	if err != nil {
		return fmt.Errorf("failed to open Word document: %w", err)
	}
	defer doc.Close()

	// Extract basic document properties
	metadata["title"] = doc.AppProperties.Title
	metadata["subject"] = doc.AppProperties.Subject
	metadata["author"] = doc.AppProperties.Author
	metadata["creator"] = doc.AppProperties.Creator
	metadata["keywords"] = doc.AppProperties.Keywords
	metadata["comments"] = doc.AppProperties.Comments

	// Get document statistics
	paragraphs := doc.Paragraphs()
	metadata["paragraph_count"] = len(paragraphs)

	// Count words (simple approximation)
	wordCount := 0
	for _, para := range paragraphs {
		runs := para.Runs()
		for _, run := range runs {
			text := run.Text()
			wordCount += len(strings.Fields(text))
		}
	}
	metadata["word_count"] = wordCount

	return nil
}

func (e *EnhancedMetadataExtractor) extractExcelMetadata(ctx context.Context, content []byte, metadata map[string]interface{}) error {
	ss, err := spreadsheet.Open(strings.NewReader(string(content)))
	if err != nil {
		return fmt.Errorf("failed to open Excel spreadsheet: %w", err)
	}
	defer ss.Close()

	// Extract basic document properties
	metadata["title"] = ss.AppProperties.Title
	metadata["subject"] = ss.AppProperties.Subject
	metadata["author"] = ss.AppProperties.Author
	metadata["creator"] = ss.AppProperties.Creator

	// Get sheet information
	sheets := ss.Sheets()
	metadata["sheet_count"] = len(sheets)

	// Count rows and columns in first sheet
	if len(sheets) > 0 {
		rows := sheets[0].Rows()
		metadata["row_count"] = len(rows)

		if len(rows) > 0 {
			metadata["column_count"] = len(rows[0].Cells())
		}
	}

	return nil
}

func (e *EnhancedMetadataExtractor) extractPowerPointMetadata(ctx context.Context, content []byte, metadata map[string]interface{}) error {
	ppt, err := presentation.Open(strings.NewReader(string(content)))
	if err != nil {
		return fmt.Errorf("failed to open PowerPoint presentation: %w", err)
	}
	defer ppt.Close()

	// Extract basic document properties
	metadata["title"] = ppt.AppProperties.Title
	metadata["subject"] = ppt.AppProperties.Subject
	metadata["author"] = ppt.AppProperties.Author
	metadata["creator"] = ppt.AppProperties.Creator

	// Get slide information
	slides := ppt.Slides()
	metadata["slide_count"] = len(slides)

	return nil
}

func (e *EnhancedMetadataExtractor) extractTextMetadata(ctx context.Context, metadata map[string]interface{}, content []byte) error {
	text := string(content)

	// Basic text statistics
	metadata["character_count"] = len(text)
	metadata["word_count"] = len(strings.Fields(text))
	metadata["line_count"] = strings.Count(text, "\n") + 1

	// Detect if it's likely to be code
	if e.looksLikeCode(text) {
		metadata["content_type_hint"] = "source_code"
	}

	return nil
}

func (e *EnhancedMetadataExtractor) addTextPreview(ctx context.Context, metadata map[string]interface{}, content []byte, contentType string) {
	var previewText string

	switch {
	case e.isTextType(contentType):
		previewText = string(content)
	case e.isPDFType(contentType):
		previewText = e.extractPDFTextPreview(ctx, content)
	default:
		// For binary files, try to extract readable text
		previewText = e.extractBinaryTextPreview(content)
	}

	// Limit preview length
	if len(previewText) > e.config.PreviewMaxLength {
		previewText = previewText[:e.config.PreviewMaxLength] + "..."
	}

	metadata["text_preview"] = previewText
}

func (e *EnhancedMetadataExtractor) addContentAnalysis(ctx context.Context, metadata map[string]interface{}, content []byte, contentType string) {
	analysis := make(map[string]interface{})

	// Analyze content patterns
	text := string(content)

	// Detect URLs
	urlPattern := regexp2.MustCompile(`https?://[^\s<>"]+`, 0)
	if urls, _ := urlPattern.FindStringMatch(text); urls != nil {
		analysis["contains_urls"] = true
	}

	// Detect email addresses
	emailPattern := regexp2.MustCompile(`\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b`, 0)
	if emails, _ := emailPattern.FindStringMatch(text); emails != nil {
		analysis["contains_emails"] = true
	}

	// Detect phone numbers
	phonePattern := regexp2.MustCompile(`\b\d{3}[-.]?\d{3}[-.]?\d{4}\b`, 0)
	if phones, _ := phonePattern.FindStringMatch(text); phones != nil {
		analysis["contains_phone_numbers"] = true
	}

	// Content complexity analysis
	if len(text) > 0 {
		analysis["entropy"] = e.calculateEntropy(content)
		analysis["readability_score"] = e.calculateReadability(text)
	}

	metadata["content_analysis"] = analysis
}

// Utility methods

func (e *EnhancedMetadataExtractor) isImageType(contentType string) bool {
	imageTypes := []string{
		"image/jpeg", "image/png", "image/gif", "image/webp",
		"image/tiff", "image/bmp",
	}
	for _, t := range imageTypes {
		if contentType == t {
			return true
		}
	}
	return false
}

func (e *EnhancedMetadataExtractor) isPDFType(contentType string) bool {
	return contentType == "application/pdf"
}

func (e *EnhancedMetadataExtractor) isOfficeDocumentType(contentType string) bool {
	officeTypes := []string{
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		"application/vnd.openxmlformats-officedocument.presentationml.presentation",
		"application/msword",
		"application/vnd.ms-excel",
		"application/vnd.ms-powerpoint",
	}
	for _, t := range officeTypes {
		if contentType == t {
			return true
		}
	}
	return false
}

func (e *EnhancedMetadataExtractor) isTextType(contentType string) bool {
	textTypes := []string{
		"text/plain", "text/csv", "text/html", "text/xml",
		"application/json", "text/markdown",
	}
	for _, t := range textTypes {
		if contentType == t {
			return true
		}
	}
	return false
}

func (e *EnhancedMetadataExtractor) categorizeFileSize(size int) string {
	const (
		KB = 1024
		MB = KB * 1024
		GB = MB * 1024
	)

	switch {
	case size < KB:
		return "tiny"
	case size < MB:
		return "small"
	case size < GB:
		return "medium"
	default:
		return "large"
	}
}

func (e *EnhancedMetadataExtractor) calculateEntropy(data []byte) float64 {
	if len(data) == 0 {
		return 0
	}

	// Count frequency of each byte
	freq := make(map[byte]int)
	for _, b := range data {
		freq[b]++
	}

	// Calculate Shannon entropy
	var entropy float64
	length := float64(len(data))
	for _, count := range freq {
		if count > 0 {
			p := float64(count) / length
			entropy -= p * math.Log2(p)
		}
	}

	return entropy
}

func (e *EnhancedMetadataExtractor) calculateReadability(text string) float64 {
	// Simple readability score based on average word length and sentence length
	words := strings.Fields(text)
	if len(words) == 0 {
		return 0
	}

	totalWordLength := 0
	for _, word := range words {
		totalWordLength += len(word)
	}

	avgWordLength := float64(totalWordLength) / float64(len(words))

	// Normalize to 0-100 scale (rough approximation)
	score := math.Max(0, 100-(avgWordLength-4)*10)
	return math.Min(100, score)
}

func (e *EnhancedMetadataExtractor) looksLikeCode(text string) bool {
	// Simple heuristic to detect if text looks like source code
	indicators := []string{
		"function ", "def ", "class ", "import ", "package ",
		"if (", "for (", "while (", "{", "}", "/*", "*/",
		"//", "#", "print(", "console.log", "return ",
	}

	lowerText := strings.ToLower(text)
	for _, indicator := range indicators {
		if strings.Contains(lowerText, strings.ToLower(indicator)) {
			return true
		}
	}

	return false
}

func (e *EnhancedMetadataExtractor) extractPDFTextPreview(ctx context.Context, content []byte) string {
	// This would use unipdf to extract text from PDF
	// For now, return placeholder
	return "[PDF text preview not implemented]"
}

func (e *EnhancedMetadataExtractor) extractBinaryTextPreview(content []byte) string {
	// Extract readable text from binary files
	var text strings.Builder
	printableCount := 0

	for _, b := range content {
		if (b >= 32 && b <= 126) || b == '\n' || b == '\r' || b == '\t' {
			text.WriteByte(b)
			printableCount++
		} else if printableCount > 0 {
			// Replace non-printable with space
			text.WriteByte(' ')
		}

		if text.Len() >= e.config.PreviewMaxLength {
			break
		}
	}

	return text.String()
}

// Cache methods

func (e *EnhancedMetadataExtractor) getFromCache(content []byte, contentType string) map[string]interface{} {
	if !e.config.CacheEnabled || e.cache == nil {
		return nil
	}

	key := e.generateCacheKey(content, contentType)
	if cached, ok := e.cache.Get(key); ok {
		return cached.(map[string]interface{})
	}

	return nil
}

func (e *EnhancedMetadataExtractor) addToCache(content []byte, contentType string, metadata map[string]interface{}) {
	if !e.config.CacheEnabled || e.cache == nil {
		return
	}

	key := e.generateCacheKey(content, contentType)
	e.cache.Add(key, metadata)
}

func (e *EnhancedMetadataExtractor) generateCacheKey(content []byte, contentType string) string {
	hash := sha256.Sum256(content)
	return fmt.Sprintf("%x-%s", hash, contentType)
}
