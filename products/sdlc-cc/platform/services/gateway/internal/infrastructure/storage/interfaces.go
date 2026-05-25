package storage

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// StorageProvider defines the interface for file storage operations
type StorageProvider interface {
	// Store stores a file and returns the storage path
	Store(ctx context.Context, req StoreRequest) (string, error)

	// Retrieve retrieves a file from storage
	Retrieve(ctx context.Context, tenantID, documentID, filename string) ([]byte, error)

	// Delete deletes a file from storage
	Delete(ctx context.Context, tenantID, documentID, filename string) error

	// DeleteBatch deletes multiple files from storage
	DeleteBatch(ctx context.Context, req BatchDeleteRequest) error

	// Exists checks if a file exists in storage
	Exists(ctx context.Context, tenantID, documentID, filename string) (bool, error)

	// GetMetadata retrieves file metadata
	GetMetadata(ctx context.Context, tenantID, documentID, filename string) (map[string]interface{}, error)

	// ListFiles lists files for a tenant with optional filtering
	ListFiles(ctx context.Context, tenantID string, filter ListFilter) ([]FileInfo, error)

	// GetBucketName returns the name of the storage bucket
	GetBucketName() string

	// HealthCheck performs a health check on the storage provider
	HealthCheck(ctx context.Context) error
}

// StoreRequest represents a file storage request
type StoreRequest struct {
	TenantID    uuid.UUID              `json:"tenant_id"`
	DocumentID  uuid.UUID              `json:"document_id"`
	Filename    string                 `json:"filename"`
	Content     []byte                 `json:"content"`
	ContentType string                 `json:"content_type"`
	Metadata    map[string]interface{} `json:"metadata"`
	Tags        []string               `json:"tags"`
}

// BatchDeleteRequest represents a batch delete request
type BatchDeleteRequest struct {
	TenantID   uuid.UUID `json:"tenant_id"`
	DocumentID uuid.UUID `json:"document_id"`
	Filenames  []string  `json:"filenames"`
}

// ListFilter represents filters for listing files
type ListFilter struct {
	Prefix        string     `json:"prefix,omitempty"`
	Limit         int        `json:"limit,omitempty"`
	Offset        int        `json:"offset,omitempty"`
	CreatedAfter  *time.Time `json:"created_after,omitempty"`
	CreatedBefore *time.Time `json:"created_before,omitempty"`
	Tags          []string   `json:"tags,omitempty"`
	ContentType   *string    `json:"content_type,omitempty"`
}

// FileInfo represents information about a stored file
type FileInfo struct {
	Key          string                 `json:"key"`
	Size         int64                  `json:"size"`
	LastModified time.Time              `json:"last_modified"`
	ContentType  string                 `json:"content_type"`
	ETag         string                 `json:"etag"`
	Metadata     map[string]interface{} `json:"metadata"`
	Tags         []string               `json:"tags"`
}

// VirusScanner defines the interface for virus scanning operations
type VirusScanner interface {
	// Scan scans file content for viruses
	Scan(ctx context.Context, content []byte) (*ScanResult, error)

	// ScanBatch scans multiple files for viruses
	ScanBatch(ctx context.Context, files []BatchScanRequest) ([]*ScanResult, error)

	// UpdateSignatures updates virus signatures
	UpdateSignatures(ctx context.Context) error

	// GetEngineInfo returns information about the scanning engine
	GetEngineInfo(ctx context.Context) (*EngineInfo, error)

	// HealthCheck performs a health check on the virus scanner
	HealthCheck(ctx context.Context) error
}

// ScanResult represents the result of a virus scan
type ScanResult struct {
	Infected   bool                   `json:"infected"`
	Threats    []string               `json:"threats,omitempty"`
	Engine     string                 `json:"engine"`
	Version    string                 `json:"version"`
	Signatures map[string]string      `json:"signatures,omitempty"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
}

// BatchScanRequest represents a batch scan request
type BatchScanRequest struct {
	Content []byte `json:"content"`
	ID      string `json:"id"`
}

// EngineInfo represents information about the virus scanning engine
type EngineInfo struct {
	Name        string    `json:"name"`
	Version     string    `json:"version"`
	LastUpdate  time.Time `json:"last_update"`
	TotalSigs   int       `json:"total_signatures"`
	DatabaseVer string    `json:"database_version"`
}

// EncryptionService defines the interface for encryption operations
type EncryptionService interface {
	// EncryptForTenant encrypts data for a specific tenant
	EncryptForTenant(ctx context.Context, tenantID string, data []byte) ([]byte, string, error)

	// DecryptForTenant decrypts data for a specific tenant
	DecryptForTenant(ctx context.Context, tenantID string, encrypted []byte) ([]byte, error)

	// RotateTenantKey rotates the encryption key for a tenant
	RotateTenantKey(ctx context.Context, tenantID string) error

	// GetKeyInfo returns information about encryption keys
	GetKeyInfo(ctx context.Context, tenantID string) (*KeyInfo, error)

	// HealthCheck performs a health check on the encryption service
	HealthCheck(ctx context.Context) error
}

// KeyInfo represents information about encryption keys
type KeyInfo struct {
	KeyID         string    `json:"key_id"`
	Algorithm     string    `json:"algorithm"`
	KeySize       int       `json:"key_size"`
	CreatedAt     time.Time `json:"created_at"`
	LastRotated   time.Time `json:"last_rotated"`
	RotationAfter time.Time `json:"rotation_after"`
	Status        string    `json:"status"`
}

// MetadataExtractor defines the interface for metadata extraction
type MetadataExtractor interface {
	// Extract extracts metadata from file content
	Extract(ctx context.Context, content []byte, contentType string) (map[string]interface{}, error)

	// ExtractBatch extracts metadata from multiple files
	ExtractBatch(ctx context.Context, files []BatchExtractRequest) ([]map[string]interface{}, error)

	// GetSupportedTypes returns a list of supported content types
	GetSupportedTypes() []string

	// HealthCheck performs a health check on the metadata extractor
	HealthCheck(ctx context.Context) error
}

// BatchExtractRequest represents a batch metadata extraction request
type BatchExtractRequest struct {
	Content     []byte `json:"content"`
	ContentType string `json:"content_type"`
	ID          string `json:"id"`
}

// FileProcessor defines the interface for file processing operations
type FileProcessor interface {
	// ProcessDocument processes a document for RAG pipeline
	ProcessDocument(ctx context.Context, req ProcessRequest) (*ProcessResult, error)

	// ProcessBatch processes multiple documents
	ProcessBatch(ctx context.Context, requests []ProcessRequest) ([]*ProcessResult, error)

	// GetProcessingStatus gets the status of document processing
	GetProcessingStatus(ctx context.Context, documentID uuid.UUID) (*ProcessingStatus, error)

	// HealthCheck performs a health check on the file processor
	HealthCheck(ctx context.Context) error
}

// ProcessRequest represents a document processing request
type ProcessRequest struct {
	DocumentID  uuid.UUID      `json:"document_id"`
	TenantID    uuid.UUID      `json:"tenant_id"`
	StoragePath string         `json:"storage_path"`
	Options     ProcessOptions `json:"options"`
}

// ProcessOptions represents options for document processing
type ProcessOptions struct {
	EnableDLP        bool     `json:"enable_dlp"`
	ChunkingStrategy string   `json:"chunking_strategy"`
	MaxChunkSize     int      `json:"max_chunk_size"`
	ChunkOverlap     int      `json:"chunk_overlap"`
	ExtractImages    bool     `json:"extract_images"`
	ExtractTables    bool     `json:"extract_tables"`
	Language         string   `json:"language"`
	CustomFilters    []string `json:"custom_filters"`
}

// ProcessResult represents the result of document processing
type ProcessResult struct {
	DocumentID      uuid.UUID              `json:"document_id"`
	Status          string                 `json:"status"`
	ChunksGenerated int                    `json:"chunks_generated"`
	WordsExtracted  int                    `json:"words_extracted"`
	ProcessingTime  time.Duration          `json:"processing_time"`
	Errors          []string               `json:"errors,omitempty"`
	Warnings        []string               `json:"warnings,omitempty"`
	Metadata        map[string]interface{} `json:"metadata"`
}

// ProcessingStatus represents the status of document processing
type ProcessingStatus struct {
	DocumentID    uuid.UUID  `json:"document_id"`
	CurrentStage  string     `json:"current_stage"`
	Progress      float64    `json:"progress"`
	StartTime     time.Time  `json:"start_time"`
	EstimatedTime *time.Time `json:"estimated_time,omitempty"`
	Errors        []string   `json:"errors"`
}

// AccessControl defines the interface for file access control
type AccessControl interface {
	// CanAccess checks if a user can access a file
	CanAccess(ctx context.Context, tenantID, userID, documentID string, action string) (bool, error)

	// GrantAccess grants access to a file
	GrantAccess(ctx context.Context, req GrantAccessRequest) error

	// RevokeAccess revokes access to a file
	RevokeAccess(ctx context.Context, req RevokeAccessRequest) error

	// ListAccess lists access permissions for a file
	ListAccess(ctx context.Context, tenantID, documentID string) ([]AccessEntry, error)

	// HealthCheck performs a health check on the access control system
	HealthCheck(ctx context.Context) error
}

// GrantAccessRequest represents a request to grant file access
type GrantAccessRequest struct {
	TenantID   uuid.UUID              `json:"tenant_id"`
	DocumentID uuid.UUID              `json:"document_id"`
	UserID     uuid.UUID              `json:"user_id"`
	Role       string                 `json:"role"`
	ExpiresAt  *time.Time             `json:"expires_at,omitempty"`
	Conditions map[string]interface{} `json:"conditions,omitempty"`
}

// RevokeAccessRequest represents a request to revoke file access
type RevokeAccessRequest struct {
	TenantID   uuid.UUID `json:"tenant_id"`
	DocumentID uuid.UUID `json:"document_id"`
	UserID     uuid.UUID `json:"user_id"`
}

// AccessEntry represents an access control entry
type AccessEntry struct {
	ID         uuid.UUID              `json:"id"`
	TenantID   uuid.UUID              `json:"tenant_id"`
	DocumentID uuid.UUID              `json:"document_id"`
	UserID     uuid.UUID              `json:"user_id"`
	Role       string                 `json:"role"`
	GrantedAt  time.Time              `json:"granted_at"`
	ExpiresAt  *time.Time             `json:"expires_at,omitempty"`
	Conditions map[string]interface{} `json:"conditions,omitempty"`
	GrantedBy  uuid.UUID              `json:"granted_by"`
}

// CleanupManager defines the interface for file cleanup operations
type CleanupManager interface {
	// ScheduleCleanup schedules cleanup of expired files
	ScheduleCleanup(ctx context.Context, req ScheduleCleanupRequest) error

	// ExecuteCleanup executes cleanup of files based on policies
	ExecuteCleanup(ctx context.Context, tenantID string) (*CleanupResult, error)

	// GetCleanupStatus gets the status of cleanup operations
	GetCleanupStatus(ctx context.Context, tenantID string) (*CleanupStatus, error)

	// HealthCheck performs a health check on the cleanup manager
	HealthCheck(ctx context.Context) error
}

// ScheduleCleanupRequest represents a request to schedule cleanup
type ScheduleCleanupRequest struct {
	TenantID        uuid.UUID `json:"tenant_id"`
	RetentionPolicy string    `json:"retention_policy"`
	ScheduledAt     time.Time `json:"scheduled_at"`
	DryRun          bool      `json:"dry_run"`
}

// CleanupResult represents the result of a cleanup operation
type CleanupResult struct {
	TenantID      uuid.UUID     `json:"tenant_id"`
	FilesScanned  int           `json:"files_scanned"`
	FilesDeleted  int           `json:"files_deleted"`
	SpaceFreed    int64         `json:"space_freed"`
	Errors        []string      `json:"errors,omitempty"`
	ExecutionTime time.Duration `json:"execution_time"`
	DryRun        bool          `json:"dry_run"`
}

// CleanupStatus represents the status of cleanup operations
type CleanupStatus struct {
	TenantID        uuid.UUID  `json:"tenant_id"`
	LastCleanup     *time.Time `json:"last_cleanup,omitempty"`
	NextScheduled   *time.Time `json:"next_scheduled,omitempty"`
	FilesProcessed  int        `json:"files_processed"`
	SpaceFreed      int64      `json:"space_freed"`
	IsRunning       bool       `json:"is_running"`
	CurrentProgress float64    `json:"current_progress"`
}
