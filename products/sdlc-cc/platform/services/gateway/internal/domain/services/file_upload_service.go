//go:build ignore

package services

import (
	"context"
	"crypto/sha256"
	"fmt"
	"math"
	"mime"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"

	"github.com/sdlc-ai/platform/services/gateway/internal/domain/models"
)

// FileUploadService handles file upload operations with security validation
type FileUploadService struct {
	virusScanner      VirusScanner
	encryptionService EncryptionService
	metadataExtractor MetadataExtractor
	logger            *logrus.Logger
	tracer            trace.Tracer
	maxFileSize       int64
	allowedTypes      map[string]bool
}

// VirusScanner defines the interface for virus scanning
type VirusScanner interface {
	Scan(ctx context.Context, content []byte) (*VirusScanResult, error)
}

// EncryptionService defines the interface for encryption operations
type EncryptionService interface {
	EncryptForTenant(ctx context.Context, tenantID string, data []byte) ([]byte, string, error)
}

// MetadataExtractor defines the interface for metadata extraction
type MetadataExtractor interface {
	Extract(ctx context.Context, content []byte, contentType string) (map[string]interface{}, error)
}

// NewFileUploadService creates a new file upload service instance
func NewFileUploadService(
	virusScanner VirusScanner,
	encryptionService EncryptionService,
	metadataExtractor MetadataExtractor,
	logger *logrus.Logger,
) *FileUploadService {
	return &FileUploadService{
		virusScanner:      virusScanner,
		encryptionService: encryptionService,
		metadataExtractor: metadataExtractor,
		logger:            logger,
		tracer:            otel.Tracer("file-upload-service"),
		maxFileSize:       100 * 1024 * 1024, // 100MB default
		allowedTypes: map[string]bool{
			"application/pdf": true,
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document": true,
			"text/plain":                    true,
			"text/html":                     true,
			"application/json":              true,
			"text/csv":                      true,
			"application/msword":            true,
			"application/vnd.ms-excel":      true,
			"application/vnd.ms-powerpoint": true,
			"text/markdown":                 true,
			"application/xml":               true,
			"text/xml":                      true,
			"image/jpeg":                    true,
			"image/png":                     true,
			"image/gif":                     true,
			"image/webp":                    true,
		},
	}
}

// UploadRequest represents a file upload request
type UploadRequest struct {
	TenantID        uuid.UUID               `json:"tenant_id" validate:"required"`
	UserID          uuid.UUID               `json:"user_id" validate:"required"`
	OriginalName    string                  `json:"original_name" validate:"required"`
	Content         []byte                  `json:"content" validate:"required"`
	ContentType     string                  `json:"content_type"`
	AccessLevel     string                  `json:"access_level"`
	Classification  string                  `json:"classification"`
	Tags            []string                `json:"tags"`
	RetentionPolicy *models.RetentionPolicy `json:"retention_policy"`
}

// UploadResponse represents the response from a file upload
type UploadResponse struct {
	DocumentID      uuid.UUID              `json:"document_id"`
	Filename        string                 `json:"filename"`
	ContentType     string                 `json:"content_type"`
	FileSize        int64                  `json:"file_size"`
	Checksum        string                 `json:"checksum"`
	Metadata        map[string]interface{} `json:"metadata"`
	Status          models.DocumentStatus  `json:"status"`
	UploadedAt      time.Time              `json:"uploaded_at"`
	ProcessingTime  time.Duration          `json:"processing_time"`
	VirusScanResult *VirusScanResult       `json:"virus_scan_result,omitempty"`
}

// VirusScanResult represents the result of a virus scan
type VirusScanResult struct {
	Infected   bool              `json:"infected"`
	Threats    []string          `json:"threats,omitempty"`
	ScanTime   time.Duration     `json:"scan_time"`
	Engine     string            `json:"engine"`
	Signatures map[string]string `json:"signatures,omitempty"`
}

// FileValidationError represents a file validation error
type FileValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
	Code    string `json:"code"`
}

// Error codes
const (
	ErrorCodeFileTooLarge    = "FILE_TOO_LARGE"
	ErrorCodeUnsupportedType = "UNSUPPORTED_TYPE"
	ErrorCodeInvalidName     = "INVALID_NAME"
	ErrorCodeVirusDetected   = "VIRUS_DETECTED"
	ErrorCodeCorruption      = "FILE_CORRUPTION"
	ErrorCodeStorageFailure  = "STORAGE_FAILURE"
	ErrorCodeMetadataFailure = "METADATA_EXTRACTION_FAILURE"
)

// UploadFile handles the complete file upload process
func (s *FileUploadService) UploadFile(ctx context.Context, req *UploadRequest) (*UploadResponse, error) {
	ctx, span := s.tracer.Start(ctx, "UploadFile")
	defer span.End()

	startTime := time.Now()
	s.logger.WithFields(logrus.Fields{
		"tenant_id":     req.TenantID,
		"user_id":       req.UserID,
		"original_name": req.OriginalName,
		"file_size":     len(req.Content),
	}).Info("Starting file upload")

	// Step 1: Validate file
	if err := s.validateFile(req); err != nil {
		s.logger.WithError(err).Error("File validation failed")
		return nil, fmt.Errorf("file validation failed: %w", err)
	}

	// Step 2: Generate secure filename and calculate checksum
	filename, checksum := s.generateFileMetadata(req.OriginalName, req.Content)

	// Step 3: Detect content type if not provided
	contentType := req.ContentType
	if contentType == "" {
		contentType = s.detectContentType(req.OriginalName, req.Content)
	}

	// Step 4: Perform virus scan
	virusResult, err := s.performVirusScan(ctx, req.Content)
	if err != nil {
		s.logger.WithError(err).Error("Virus scan failed")
		return nil, fmt.Errorf("virus scan failed: %w", err)
	}

	if virusResult.Infected {
		s.logger.WithFields(logrus.Fields{
			"tenant_id":     req.TenantID,
			"threats":       virusResult.Threats,
			"original_name": req.OriginalName,
		}).Warn("Virus detected in uploaded file")
		return nil, fmt.Errorf("virus detected: %v", virusResult.Threats)
	}

	// Step 5: Extract metadata
	metadata, err := s.extractFileMetadata(ctx, req.Content, contentType)
	if err != nil {
		s.logger.WithError(err).Error("Metadata extraction failed")
		// Don't fail the upload for metadata extraction failures
		metadata = make(map[string]interface{})
		metadata["extraction_error"] = err.Error()
	}

	// Step 6: Encrypt content
	encryptedContent, encryptionKeyID, err := s.encryptContent(ctx, req.TenantID, req.Content)
	if err != nil {
		s.logger.WithError(err).Error("Content encryption failed")
		return nil, fmt.Errorf("content encryption failed: %w", err)
	}

	// Step 7: Create document record
	document := s.createDocumentRecord(req, filename, contentType, checksum, "", encryptionKeyID, metadata)

	processingTime := time.Since(startTime)

	s.logger.WithFields(logrus.Fields{
		"tenant_id":       req.TenantID,
		"user_id":         req.UserID,
		"document_id":     document.ID,
		"filename":        filename,
		"file_size":       len(req.Content),
		"processing_time": processingTime,
		"virus_scan_time": virusResult.ScanTime,
	}).Info("File upload completed successfully")

	return &UploadResponse{
		DocumentID:      document.ID,
		Filename:        filename,
		ContentType:     contentType,
		FileSize:        int64(len(req.Content)),
		Checksum:        checksum,
		Metadata:        metadata,
		Status:          models.DocumentStatusPending,
		UploadedAt:      time.Now(),
		ProcessingTime:  processingTime,
		VirusScanResult: virusResult,
	}, nil
}

// validateFile performs comprehensive file validation
func (s *FileUploadService) validateFile(req *UploadRequest) error {
	var errors []FileValidationError

	// Validate file size
	if int64(len(req.Content)) > s.maxFileSize {
		errors = append(errors, FileValidationError{
			Field:   "content",
			Message: fmt.Sprintf("File size exceeds maximum allowed size of %d bytes", s.maxFileSize),
			Code:    ErrorCodeFileTooLarge,
		})
	}

	// Validate filename
	if err := s.validateFilename(req.OriginalName); err != nil {
		errors = append(errors, FileValidationError{
			Field:   "original_name",
			Message: err.Error(),
			Code:    ErrorCodeInvalidName,
		})
	}

	// Detect and validate content type
	contentType := req.ContentType
	if contentType == "" {
		contentType = s.detectContentType(req.OriginalName, req.Content)
	}

	if !s.allowedTypes[contentType] {
		errors = append(errors, FileValidationError{
			Field:   "content_type",
			Message: fmt.Sprintf("Content type %s is not allowed", contentType),
			Code:    ErrorCodeUnsupportedType,
		})
	}

	// Check for file corruption (basic integrity check)
	if err := s.validateFileIntegrity(req.Content); err != nil {
		errors = append(errors, FileValidationError{
			Field:   "content",
			Message: err.Error(),
			Code:    ErrorCodeCorruption,
		})
	}

	if len(errors) > 0 {
		return fmt.Errorf("validation failed: %+v", errors)
	}

	return nil
}

// validateFilename checks if the filename is safe
func (s *FileUploadService) validateFilename(filename string) error {
	// Check for empty filename
	if strings.TrimSpace(filename) == "" {
		return fmt.Errorf("filename cannot be empty")
	}

	// Check for dangerous characters
	dangerousChars := []string{"/", "\\", "..", "<", ">", ":", "\"", "|", "?", "*"}
	for _, char := range dangerousChars {
		if strings.Contains(filename, char) {
			return fmt.Errorf("filename contains dangerous character: %s", char)
		}
	}

	// Check filename length
	if len(filename) > 255 {
		return fmt.Errorf("filename too long (max 255 characters)")
	}

	// Check for suspicious extensions
	suspiciousExtensions := []string{".exe", ".bat", ".cmd", ".com", ".pif", ".scr", ".vbs", ".js", ".jar"}
	ext := strings.ToLower(filepath.Ext(filename))
	for _, suspicious := range suspiciousExtensions {
		if ext == suspicious {
			return fmt.Errorf("suspicious file extension: %s", ext)
		}
	}

	return nil
}

// detectContentType detects the content type of the file
func (s *FileUploadService) detectContentType(filename string, content []byte) string {
	// First try MIME type detection from file extension
	contentType := mime.TypeByExtension(filepath.Ext(filename))
	if contentType != "" {
		return contentType
	}

	// Fall back to content-based detection
	contentType = http.DetectContentType(content)

	// Sanitize content type
	if strings.Contains(contentType, "text/plain") {
		return "text/plain"
	}
	if strings.Contains(contentType, "application/json") {
		return "application/json"
	}
	if strings.Contains(contentType, "text/html") {
		return "text/html"
	}
	if strings.Contains(contentType, "text/xml") {
		return "text/xml"
	}

	return contentType
}

// validateFileIntegrity performs basic integrity checks
func (s *FileUploadService) validateFileIntegrity(content []byte) error {
	// Check if file is empty
	if len(content) == 0 {
		return fmt.Errorf("file content is empty")
	}

	// Check for null byte injection
	for i, b := range content {
		if b == 0 {
			return fmt.Errorf("null byte detected at position %d", i)
		}
	}

	// Basic entropy check to detect potential corruption or tampering
	if len(content) > 100 {
		entropy := s.calculateEntropy(content[:100])
		if entropy < 1.0 {
			return fmt.Errorf("low entropy detected, file may be corrupted")
		}
	}

	return nil
}

// calculateEntropy calculates the Shannon entropy of data
func (s *FileUploadService) calculateEntropy(data []byte) float64 {
	if len(data) == 0 {
		return 0
	}

	// Count frequency of each byte
	freq := make(map[byte]int)
	for _, b := range data {
		freq[b]++
	}

	// Calculate entropy
	var entropy float64
	length := float64(len(data))
	for _, count := range freq {
		if count > 0 {
			p := float64(count) / length
			entropy -= p * (log2(p))
		}
	}

	return entropy
}

// log2 is a helper function to calculate log base 2
func log2(x float64) float64 {
	return 0.6931471805599453 * math.Log(x) // ln(2) = 0.6931471805599453
}

// generateFileMetadata generates a secure filename and calculates checksum
func (s *FileUploadService) generateFileMetadata(originalName string, content []byte) (string, string) {
	// Generate unique filename with UUID
	ext := filepath.Ext(originalName)
	if ext == "" {
		ext = ".bin"
	}

	filename := fmt.Sprintf("%s%s", uuid.New().String(), ext)

	// Calculate SHA256 checksum
	hash := sha256.Sum256(content)
	checksum := fmt.Sprintf("%x", hash)

	return filename, checksum
}

// performVirusScan scans the file for viruses
func (s *FileUploadService) performVirusScan(ctx context.Context, content []byte) (*VirusScanResult, error) {
	if s.virusScanner == nil {
		// Return clean result if no scanner configured
		return &VirusScanResult{
			Infected: false,
			ScanTime: 0,
			Engine:   "none",
		}, nil
	}

	startTime := time.Now()

	result, err := s.virusScanner.Scan(ctx, content)
	if err != nil {
		return nil, fmt.Errorf("virus scan failed: %w", err)
	}

	scanTime := time.Since(startTime)

	return &VirusScanResult{
		Infected:   result.Infected,
		Threats:    result.Threats,
		ScanTime:   scanTime,
		Engine:     result.Engine,
		Signatures: result.Signatures,
	}, nil
}

// extractFileMetadata extracts metadata from the file content
func (s *FileUploadService) extractFileMetadata(ctx context.Context, content []byte, contentType string) (map[string]interface{}, error) {
	ctx, span := s.tracer.Start(ctx, "ExtractFileMetadata")
	defer span.End()

	metadata := make(map[string]interface{})

	// Add basic metadata
	metadata["content_length"] = len(content)
	metadata["content_type"] = contentType
	metadata["extraction_timestamp"] = time.Now().UTC().Format(time.RFC3339)
	metadata["processing_service"] = "file-upload-service"

	if s.metadataExtractor == nil {
		return metadata, nil
	}

	// Extract format-specific metadata
	extracted, err := s.metadataExtractor.Extract(ctx, content, contentType)
	if err != nil {
		s.logger.WithError(err).WithField("content_type", contentType).Warn("Metadata extraction failed")
		return metadata, err
	}

	// Merge extracted metadata
	for k, v := range extracted {
		metadata[k] = v
	}

	return metadata, nil
}

// encryptContent encrypts the file content
func (s *FileUploadService) encryptContent(ctx context.Context, tenantID uuid.UUID, content []byte) ([]byte, string, error) {
	ctx, span := s.tracer.Start(ctx, "EncryptContent")
	defer span.End()

	if s.encryptionService == nil {
		// Return content unencrypted if no encryption service configured
		return content, "", nil
	}

	encrypted, keyID, err := s.encryptionService.EncryptForTenant(ctx, tenantID.String(), content)
	if err != nil {
		return nil, "", fmt.Errorf("content encryption failed: %w", err)
	}

	return encrypted, keyID, nil
}

// createDocumentRecord creates a document model instance
func (s *FileUploadService) createDocumentRecord(
	req *UploadRequest,
	filename, contentType, checksum, storagePath, encryptionKeyID string,
	metadata map[string]interface{},
) *models.Document {
	document := models.NewDocument(
		req.TenantID,
		req.UserID,
		filename,
		req.OriginalName,
		contentType,
		int64(len(req.Content)),
	)

	document.Checksum = checksum
	document.StoragePath = storagePath
	document.EncryptionKeyID = encryptionKeyID
	document.Metadata = models.JSONB(metadata)

	// Set access level and classification
	if req.AccessLevel != "" {
		document.AccessLevel = req.AccessLevel
	}
	if req.Classification != "" {
		document.Classification = models.DataClassification(req.Classification)
	}

	// Add tags
	for _, tag := range req.Tags {
		document.AddTag(tag)
	}

	// Set retention policy
	if req.RetentionPolicy != nil {
		document.RetentionPolicy = models.JSONB(req.RetentionPolicy.ToMap())
	}

	return document
}

// GetSupportedFormats returns a list of supported file formats
func (s *FileUploadService) GetSupportedFormats() []string {
	formats := make([]string, 0, len(s.allowedTypes))
	for contentType := range s.allowedTypes {
		formats = append(formats, contentType)
	}
	return formats
}

// GetMaxFileSize returns the maximum allowed file size
func (s *FileUploadService) GetMaxFileSize() int64 {
	return s.maxFileSize
}

// SetMaxFileSize updates the maximum allowed file size
func (s *FileUploadService) SetMaxFileSize(size int64) {
	s.maxFileSize = size
}

// AddAllowedContentType adds a new allowed content type
func (s *FileUploadService) AddAllowedContentType(contentType string) {
	s.allowedTypes[contentType] = true
}

// RemoveAllowedContentType removes an allowed content type
func (s *FileUploadService) RemoveAllowedContentType(contentType string) {
	delete(s.allowedTypes, contentType)
}
