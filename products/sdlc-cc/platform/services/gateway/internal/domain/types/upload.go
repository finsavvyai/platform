package types

import (
	"time"

	"github.com/google/uuid"
)

// MultiPartUploadConfig holds configuration for multipart uploads
type MultiPartUploadConfig struct {
	MaxFileSize         int64         `json:"max_file_size"`         // Maximum file size (100GB default)
	ChunkSize           int64         `json:"chunk_size"`            // Default chunk size (8MB)
	MaxConcurrentChunks int           `json:"max_concurrent_chunks"` // Max concurrent chunk uploads
	UploadTimeout       time.Duration `json:"upload_timeout"`        // Total upload timeout
	ChunkTimeout        time.Duration `json:"chunk_timeout"`         // Individual chunk timeout
	RetryAttempts       int           `json:"retry_attempts"`        // Retry attempts for failed chunks
	RetryDelay          time.Duration `json:"retry_delay"`           // Delay between retries
	TempDir             string        `json:"temp_dir"`              // Temporary directory for chunks
	EnableResume        bool          `json:"enable_resume"`         // Enable resumable uploads
	CleanupInterval     time.Duration `json:"cleanup_interval"`      // Cleanup interval for abandoned uploads
}

// DefaultMultiPartUploadConfig returns default configuration
func DefaultMultiPartUploadConfig() *MultiPartUploadConfig {
	return &MultiPartUploadConfig{
		MaxFileSize:         100 * 1024 * 1024 * 1024, // 100GB
		ChunkSize:           8 * 1024 * 1024,          // 8MB
		MaxConcurrentChunks: 5,
		UploadTimeout:       2 * time.Hour,
		ChunkTimeout:        5 * time.Minute,
		RetryAttempts:       3,
		RetryDelay:          time.Second,
		TempDir:             "/tmp/uploads",
		EnableResume:        true,
		CleanupInterval:     24 * time.Hour,
	}
}

// UploadSession represents an active multipart upload session
type UploadSession struct {
	ID              uuid.UUID              `json:"id"`
	TenantID        uuid.UUID              `json:"tenant_id"`
	UserID          uuid.UUID              `json:"user_id"`
	OriginalName    string                 `json:"original_name"`
	ContentType     string                 `json:"content_type"`
	FileSize        int64                  `json:"file_size"`
	Checksum        string                 `json:"checksum"`
	TotalChunks     int                    `json:"total_chunks"`
	UploadedChunks  map[int]bool           `json:"uploaded_chunks"`
	ChunkSize       int64                  `json:"chunk_size"`
	EncryptionKeyID string                 `json:"encryption_key_id"`
	Metadata        map[string]interface{} `json:"metadata"`
	Status          UploadSessionStatus    `json:"status"`
	CreatedAt       time.Time              `json:"created_at"`
	UpdatedAt       time.Time              `json:"updated_at"`
	ExpiresAt       time.Time              `json:"expires_at"`
	LastActivity    time.Time              `json:"last_activity"`
	UploadDuration  time.Duration          `json:"upload_duration"`
	BytesUploaded   int64                  `json:"bytes_uploaded"`
	Progress        float64                `json:"progress"`
	Error           string                 `json:"error,omitempty"`
}

// UploadSessionStatus represents the status of an upload session
type UploadSessionStatus string

const (
	UploadSessionStatusInitiated UploadSessionStatus = "initiated"
	UploadSessionStatusUploading UploadSessionStatus = "uploading"
	UploadSessionStatusPaused    UploadSessionStatus = "paused"
	UploadSessionStatusCompleted UploadSessionStatus = "completed"
	UploadSessionStatusFailed    UploadSessionStatus = "failed"
	UploadSessionStatusExpired   UploadSessionStatus = "expired"
	UploadSessionStatusAbandoned UploadSessionStatus = "abandoned"
)

// ChunkInfo represents information about a chunk
type ChunkInfo struct {
	Index      int        `json:"index"`
	Size       int64      `json:"size"`
	Checksum   string     `json:"checksum"`
	Uploaded   bool       `json:"uploaded"`
	UploadTime *time.Time `json:"upload_time,omitempty"`
	Retries    int        `json:"retries"`
	Error      string     `json:"error,omitempty"`
}

// UploadChunkRequest represents a request to upload a chunk
type UploadChunkRequest struct {
	SessionID  uuid.UUID `json:"session_id"`
	ChunkIndex int       `json:"chunk_index"`
	Size       int64     `json:"size"`
	Checksum   string    `json:"checksum"`
	Content    []byte    `json:"content"`
}

// UploadProgress represents upload progress information
type UploadProgress struct {
	SessionID      uuid.UUID `json:"session_id"`
	TotalChunks    int       `json:"total_chunks"`
	UploadedChunks int       `json:"uploaded_chunks"`
	BytesUploaded  int64     `json:"bytes_uploaded"`
	TotalBytes     int64     `json:"total_bytes"`
	Progress       float64   `json:"progress"`
	Speed          float64   `json:"speed"`         // bytes per second
	ETA            *int      `json:"eta,omitempty"` // estimated time remaining in seconds
	Status         string    `json:"status"`
	Error          string    `json:"error,omitempty"`
}
