// Package storage provides specialized storage functionality for QuantumBeam.io
package storage

import (
	"context"
	"encoding/json"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// QuantumBeamStorage provides specialized storage operations for QuantumBeam
type QuantumBeamStorage struct {
	client *Client
	config *QuantumBeamConfig
}

// QuantumBeamConfig holds QuantumBeam-specific storage configuration
type QuantumBeamConfig struct {
	OrganizationBuckets map[string]string
	EncryptionEnabled   bool
	RetentionPolicies   map[string]time.Duration
	AutoVersioning      bool
	CompressLargeFiles  bool
	MaxFileSize         int64
	AllowedExtensions   []string
	BlockedExtensions   []string
}

// DocumentType represents different types of documents stored in QuantumBeam
type DocumentType string

const (
	DocumentTypeFraudReport   DocumentType = "fraud_report"
	DocumentTypeQuantumModel  DocumentType = "quantum_model"
	DocumentTypeMLModel       DocumentType = "ml_model"
	DocumentTypeTransaction   DocumentType = "transaction"
	DocumentTypeAuditLog      DocumentType = "audit_log"
	DocumentTypeUserDocument  DocumentType = "user_document"
	DocumentTypeSystemBackup  DocumentType = "system_backup"
	DocumentTypeAnalyticsData DocumentType = "analytics_data"
)

// DocumentMetadata represents metadata for stored documents
type DocumentMetadata struct {
	ID             string                 `json:"id"`
	Type           DocumentType           `json:"type"`
	Name           string                 `json:"name"`
	Size           int64                  `json:"size"`
	ContentType    string                 `json:"content_type"`
	Organization   string                 `json:"organization"`
	UserID         string                 `json:"user_id"`
	UploadedBy     string                 `json:"uploaded_by"`
	UploadedAt     time.Time              `json:"uploaded_at"`
	ExpiresAt      *time.Time             `json:"expires_at,omitempty"`
	Version        int                    `json:"version"`
	Tags           []string               `json:"tags,omitempty"`
	Classification string                 `json:"classification,omitempty"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
	Checksum       string                 `json:"checksum"`
	Encrypted      bool                   `json:"encrypted"`
}

// StorageStats provides statistics about storage usage
type StorageStats struct {
	TotalObjects  int64            `json:"total_objects"`
	TotalSize     int64            `json:"total_size"`
	ObjectsByType map[string]int64 `json:"objects_by_type"`
	SizeByType    map[string]int64 `json:"size_by_type"`
	ObjectsByOrg  map[string]int64 `json:"objects_by_org"`
	SizeByOrg     map[string]int64 `json:"size_by_org"`
	OldestObject  *time.Time       `json:"oldest_object"`
	NewestObject  *time.Time       `json:"newest_object"`
}

// NewQuantumBeamStorage creates a new QuantumBeam storage client
func NewQuantumBeamStorage(client *Client, config *QuantumBeamConfig) *QuantumBeamStorage {
	if config == nil {
		config = defaultQuantumBeamConfig()
	}

	return &QuantumBeamStorage{
		client: client,
		config: config,
	}
}

// defaultQuantumBeamConfig returns default QuantumBeam storage configuration
func defaultQuantumBeamConfig() *QuantumBeamConfig {
	return &QuantumBeamConfig{
		OrganizationBuckets: map[string]string{
			"quantumbeam": "quantumbeam-documents",
			"customer1":   "customer1-documents",
			"customer2":   "customer2-documents",
		},
		EncryptionEnabled: true,
		RetentionPolicies: map[string]time.Duration{
			string(DocumentTypeFraudReport):   7 * 365 * 24 * time.Hour, // 7 years
			string(DocumentTypeQuantumModel):  3 * 365 * 24 * time.Hour, // 3 years
			string(DocumentTypeMLModel):       2 * 365 * 24 * time.Hour, // 2 years
			string(DocumentTypeTransaction):   90 * 24 * time.Hour,      // 90 days
			string(DocumentTypeAuditLog):      7 * 365 * 24 * time.Hour, // 7 years
			string(DocumentTypeUserDocument):  2 * 365 * 24 * time.Hour, // 2 years
			string(DocumentTypeSystemBackup):  30 * 24 * time.Hour,      // 30 days
			string(DocumentTypeAnalyticsData): 1 * 365 * 24 * time.Hour, // 1 year
		},
		AutoVersioning:     true,
		CompressLargeFiles: true,
		MaxFileSize:        5 * 1024 * 1024 * 1024, // 5GB
		AllowedExtensions: []string{
			".pdf", ".doc", ".docx", ".txt", ".csv", ".json", ".xml",
			".png", ".jpg", ".jpeg", ".gif", ".bmp", ".svg",
			".zip", ".tar", ".gz", ".model", ".pkl", ".h5",
		},
		BlockedExtensions: []string{
			".exe", ".bat", ".cmd", ".scr", ".msi", ".deb", ".rpm",
			".js", ".vbs", ".jar", ".app", ".dll", ".so",
		},
	}
}

// StoreDocument stores a document with full metadata
func (qbs *QuantumBeamStorage) StoreDocument(ctx context.Context, docType DocumentType, organization, userID, fileName string, content []byte, options *StorageOptions) (*DocumentMetadata, error) {
	if organization == "" || userID == "" || fileName == "" {
		return nil, fmt.Errorf("organization, user ID, and filename cannot be empty")
	}

	// Validate file type
	if err := qbs.validateFileType(fileName); err != nil {
		return nil, fmt.Errorf("file validation failed: %w", err)
	}

	// Check file size
	if int64(len(content)) > qbs.config.MaxFileSize {
		return nil, fmt.Errorf("file size exceeds maximum allowed size of %d bytes", qbs.config.MaxFileSize)
	}

	// Get bucket for organization
	bucketName, exists := qbs.config.OrganizationBuckets[organization]
	if !exists {
		bucketName = fmt.Sprintf("%s-documents", organization)
		qbs.config.OrganizationBuckets[organization] = bucketName
	}

	// Ensure bucket exists
	if err := qbs.ensureBucket(ctx, bucketName); err != nil {
		return nil, fmt.Errorf("failed to ensure bucket exists: %w", err)
	}

	// Generate document metadata
	metadata := &DocumentMetadata{
		ID:           uuid.New().String(),
		Type:         docType,
		Name:         fileName,
		Size:         int64(len(content)),
		ContentType:  getContentType(fileName),
		Organization: organization,
		UserID:       userID,
		UploadedBy:   userID,
		UploadedAt:   time.Now(),
		Version:      1,
		Tags:         []string{},
		Metadata:     make(map[string]interface{}),
		Encrypted:    qbs.config.EncryptionEnabled,
	}

	// Set expiration if specified
	if retention, exists := qbs.config.RetentionPolicies[string(docType)]; exists {
		expiresAt := time.Now().Add(retention)
		metadata.ExpiresAt = &expiresAt
	}

	// Apply options
	if options != nil {
		if options.Tags != nil {
			metadata.Tags = options.Tags
		}
		if options.Classification != "" {
			metadata.Classification = options.Classification
		}
		if options.Metadata != nil {
			for k, v := range options.Metadata {
				metadata.Metadata[k] = v
			}
		}
	}

	// Calculate checksum
	metadata.Checksum = calculateChecksum(content)

	// Create object path
	objectPath := qbs.createObjectPath(docType, metadata.ID, fileName)

	// Store metadata JSON
	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal metadata: %w", err)
	}

	// Upload content
	uploadOpts := &UploadOptions{
		ContentType: metadata.ContentType,
		Metadata: map[string]string{
			"document-id":     metadata.ID,
			"document-type":   string(docType),
			"organization":    organization,
			"user-id":         userID,
			"checksum":        metadata.Checksum,
			"version":         fmt.Sprintf("%d", metadata.Version),
			"uploaded-by":     userID,
			"quantumbeam-doc": "true",
		},
		Tags: map[string]string{
			"document-type": string(docType),
			"organization":  organization,
			"user-id":       userID,
		},
	}

	// Store the actual document
	_, err = qbs.client.PutObject(ctx, bucketName, objectPath, strings.NewReader(string(content)), metadata.Size, uploadOpts)
	if err != nil {
		return nil, fmt.Errorf("failed to store document: %w", err)
	}

	// Store metadata alongside the document
	metadataPath := filepath.Join(filepath.Dir(objectPath), ".metadata", metadata.ID+".json")
	_, err = qbs.client.PutObject(ctx, bucketName, metadataPath, strings.NewReader(string(metadataJSON)), int64(len(metadataJSON)), &UploadOptions{
		ContentType: "application/json",
	})
	if err != nil {
		log.Warn().Err(err).Str("document_id", metadata.ID).Msg("Failed to store document metadata")
	}

	log.Info().
		Str("document_id", metadata.ID).
		Str("type", string(docType)).
		Str("organization", organization).
		Str("user_id", userID).
		Str("filename", fileName).
		Int64("size", metadata.Size).
		Msg("Document stored successfully")

	return metadata, nil
}

// GetDocument retrieves a document by ID
func (qbs *QuantumBeamStorage) GetDocument(ctx context.Context, organization, documentID string) ([]byte, *DocumentMetadata, error) {
	if organization == "" || documentID == "" {
		return nil, nil, fmt.Errorf("organization and document ID cannot be empty")
	}

	// Get bucket for organization
	bucketName, exists := qbs.config.OrganizationBuckets[organization]
	if !exists {
		return nil, nil, ErrObjectNotFound
	}

	// Find the document object
	objects, err := qbs.client.ListObjects(ctx, bucketName, documentID)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to list objects: %w", err)
	}

	var documentObject *ObjectInfo
	var metadataObject *ObjectInfo

	for _, obj := range objects {
		if strings.Contains(obj.Key, documentID) {
			if strings.Contains(obj.Key, ".metadata/") {
				metadataObject = obj
			} else {
				documentObject = obj
			}
		}
	}

	if documentObject == nil {
		return nil, nil, ErrObjectNotFound
	}

	// Download document content
	content, _, err := qbs.client.GetObject(ctx, bucketName, documentObject.Key)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to download document: %w", err)
	}
	defer content.Close()

	// Read content
	documentContent := make([]byte, documentObject.Size)
	_, err = content.Read(documentContent)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to read document content: %w", err)
	}

	// Get metadata
	var metadata *DocumentMetadata
	if metadataObject != nil {
		metadataContent, _, err := qbs.client.GetObject(ctx, bucketName, metadataObject.Key)
		if err == nil {
			defer metadataContent.Close()
			metadataBytes := make([]byte, metadataObject.Size)
			metadataContent.Read(metadataBytes)

			err = json.Unmarshal(metadataBytes, &metadata)
			if err != nil {
				log.Warn().Err(err).Str("document_id", documentID).Msg("Failed to unmarshal stored metadata")
			}
		}
	}

	// If no stored metadata, create basic metadata from object info
	if metadata == nil {
		// Convert metadata map[string]string to map[string]interface{}
		metadataMap := make(map[string]interface{})
		for k, v := range documentObject.Metadata {
			metadataMap[k] = v
		}

		metadata = &DocumentMetadata{
			ID:           documentID,
			Name:         filepath.Base(documentObject.Key),
			Size:         documentObject.Size,
			ContentType:  documentObject.ContentType,
			Organization: organization,
			UploadedAt:   documentObject.LastModified,
			Metadata:     metadataMap,
			Tags:         []string{}, // Tags is []string, not map
		}
	}

	log.Debug().
		Str("document_id", documentID).
		Str("organization", organization).
		Int64("size", metadata.Size).
		Msg("Document retrieved successfully")

	return documentContent, metadata, nil
}

// ListDocuments lists documents for an organization with optional filtering
func (qbs *QuantumBeamStorage) ListDocuments(ctx context.Context, organization string, filters *DocumentFilters) ([]*DocumentMetadata, error) {
	if organization == "" {
		return nil, fmt.Errorf("organization cannot be empty")
	}

	// Get bucket for organization
	bucketName, exists := qbs.config.OrganizationBuckets[organization]
	if !exists {
		return []*DocumentMetadata{}, nil
	}

	// List all objects
	objects, err := qbs.client.ListObjects(ctx, bucketName, "")
	if err != nil {
		return nil, fmt.Errorf("failed to list objects: %w", err)
	}

	var documents []*DocumentMetadata

	for _, obj := range objects {
		// Skip metadata objects
		if strings.Contains(obj.Key, ".metadata/") {
			continue
		}

		// Extract document info from metadata
		docType := DocumentType(obj.Metadata["document-type"])
		userID := obj.Metadata["user-id"]
		documentID := obj.Metadata["document-id"]

		if docType == "" || userID == "" || documentID == "" {
			continue
		}

		// Apply filters
		if filters != nil {
			if filters.DocumentType != "" && docType != filters.DocumentType {
				continue
			}
			if filters.UserID != "" && userID != filters.UserID {
				continue
			}
			if filters.StartDate != nil && obj.LastModified.Before(*filters.StartDate) {
				continue
			}
			if filters.EndDate != nil && obj.LastModified.After(*filters.EndDate) {
				continue
			}
			if filters.MinSize > 0 && obj.Size < filters.MinSize {
				continue
			}
			if filters.MaxSize > 0 && obj.Size > filters.MaxSize {
				continue
			}
		}

		metadata := &DocumentMetadata{
			ID:           documentID,
			Type:         docType,
			Name:         filepath.Base(obj.Key),
			Size:         obj.Size,
			ContentType:  obj.ContentType,
			Organization: organization,
			UserID:       userID,
			UploadedBy:   obj.Metadata["uploaded-by"],
			UploadedAt:   obj.LastModified,
			Metadata:     make(map[string]interface{}),
		}

		// Convert string metadata to appropriate types
		for k, v := range obj.Metadata {
			metadata.Metadata[k] = v
		}

		documents = append(documents, metadata)
	}

	log.Debug().
		Str("organization", organization).
		Int("count", len(documents)).
		Msg("Documents listed successfully")

	return documents, nil
}

// DeleteDocument deletes a document and its metadata
func (qbs *QuantumBeamStorage) DeleteDocument(ctx context.Context, organization, documentID string) error {
	if organization == "" || documentID == "" {
		return fmt.Errorf("organization and document ID cannot be empty")
	}

	// Get bucket for organization
	bucketName, exists := qbs.config.OrganizationBuckets[organization]
	if !exists {
		return ErrObjectNotFound
	}

	// Find and delete the document
	objects, err := qbs.client.ListObjects(ctx, bucketName, documentID)
	if err != nil {
		return fmt.Errorf("failed to list objects: %w", err)
	}

	var objectsToDelete []string
	for _, obj := range objects {
		if strings.Contains(obj.Key, documentID) {
			objectsToDelete = append(objectsToDelete, obj.Key)
		}
	}

	if len(objectsToDelete) == 0 {
		return ErrObjectNotFound
	}

	// Delete objects
	err = qbs.client.DeleteObjects(ctx, bucketName, objectsToDelete)
	if err != nil {
		return fmt.Errorf("failed to delete document: %w", err)
	}

	log.Info().
		Str("document_id", documentID).
		Str("organization", organization).
		Int("deleted_objects", len(objectsToDelete)).
		Msg("Document deleted successfully")

	return nil
}

// GetStorageStats returns storage statistics for an organization
func (qbs *QuantumBeamStorage) GetStorageStats(ctx context.Context, organization string) (*StorageStats, error) {
	stats := &StorageStats{
		ObjectsByType: make(map[string]int64),
		SizeByType:    make(map[string]int64),
		ObjectsByOrg:  make(map[string]int64),
		SizeByOrg:     make(map[string]int64),
	}

	// If organization specified, only scan that bucket
	buckets := []string{}
	if organization != "" {
		if bucket, exists := qbs.config.OrganizationBuckets[organization]; exists {
			buckets = append(buckets, bucket)
		}
	} else {
		// Scan all organization buckets
		for _, bucket := range qbs.config.OrganizationBuckets {
			buckets = append(buckets, bucket)
		}
	}

	for _, bucket := range buckets {
		objects, err := qbs.client.ListObjects(ctx, bucket, "")
		if err != nil {
			log.Warn().Err(err).Str("bucket", bucket).Msg("Failed to list objects for stats")
			continue
		}

		for _, obj := range objects {
			// Skip metadata objects
			if strings.Contains(obj.Key, ".metadata/") {
				continue
			}

			stats.TotalObjects++
			stats.TotalSize += obj.Size

			// Update stats by type
			docType := obj.Metadata["document-type"]
			if docType != "" {
				stats.ObjectsByType[docType]++
				stats.SizeByType[docType] += obj.Size
			}

			// Update stats by organization
			org := obj.Metadata["organization"]
			if org != "" {
				stats.ObjectsByOrg[org]++
				stats.SizeByOrg[org] += obj.Size
			}

			// Track oldest and newest objects
			if stats.OldestObject == nil || obj.LastModified.Before(*stats.OldestObject) {
				stats.OldestObject = &obj.LastModified
			}
			if stats.NewestObject == nil || obj.LastModified.After(*stats.NewestObject) {
				stats.NewestObject = &obj.LastModified
			}
		}
	}

	return stats, nil
}

// StorageOptions provides options for storing documents
type StorageOptions struct {
	Tags           []string               `json:"tags,omitempty"`
	Classification string                 `json:"classification,omitempty"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
	ExpiresAt      *time.Time             `json:"expires_at,omitempty"`
}

// DocumentFilters provides filters for listing documents
type DocumentFilters struct {
	DocumentType DocumentType `json:"document_type,omitempty"`
	UserID       string       `json:"user_id,omitempty"`
	StartDate    *time.Time   `json:"start_date,omitempty"`
	EndDate      *time.Time   `json:"end_date,omitempty"`
	MinSize      int64        `json:"min_size,omitempty"`
	MaxSize      int64        `json:"max_size,omitempty"`
	Tags         []string     `json:"tags,omitempty"`
}

// Helper functions

func (qbs *QuantumBeamStorage) validateFileType(fileName string) error {
	ext := strings.ToLower(filepath.Ext(fileName))

	// Check against blocked extensions
	for _, blockedExt := range qbs.config.BlockedExtensions {
		if ext == blockedExt {
			return fmt.Errorf("file type %s is not allowed", ext)
		}
	}

	// If allowed extensions are specified, check against them
	if len(qbs.config.AllowedExtensions) > 0 {
		allowed := false
		for _, allowedExt := range qbs.config.AllowedExtensions {
			if ext == allowedExt {
				allowed = true
				break
			}
		}
		if !allowed {
			return fmt.Errorf("file type %s is not in allowed list", ext)
		}
	}

	return nil
}

func (qbs *QuantumBeamStorage) ensureBucket(ctx context.Context, bucketName string) error {
	exists, err := qbs.client.BucketExists(ctx, bucketName)
	if err != nil {
		return err
	}

	if !exists {
		err = qbs.client.CreateBucket(ctx, bucketName)
		if err != nil {
			return err
		}

		// Set bucket policy for organization access
		policy := fmt.Sprintf(`{
			"Version": "2012-10-17",
			"Statement": [
				{
					"Effect": "Allow",
					"Principal": {"AWS": ["*"]},
					"Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
					"Resource": ["arn:aws:s3:::%s/*"]
				}
			]
		}`, bucketName)

		err = qbs.client.SetBucketPolicy(ctx, bucketName, policy)
		if err != nil {
			log.Warn().Err(err).Str("bucket", bucketName).Msg("Failed to set bucket policy")
		}
	}

	return nil
}

func (qbs *QuantumBeamStorage) createObjectPath(docType DocumentType, documentID, fileName string) string {
	// Create path structure: document-type/year/month/document-id/filename
	now := time.Now()
	return filepath.Join(
		string(docType),
		now.Format("2006"),
		now.Format("01"),
		documentID,
		fileName,
	)
}

func calculateChecksum(content []byte) string {
	hash := fmt.Sprintf("%x", content)[:16] // Simple checksum for demo
	return hash
}
