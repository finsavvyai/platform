package models

import (
	"time"

	"github.com/google/uuid"
)

// DocumentStatus represents the processing lifecycle of a document.
type DocumentStatus string

const (
	DocumentStatusPending    DocumentStatus = "pending"
	DocumentStatusProcessing DocumentStatus = "processing"
	DocumentStatusCompleted  DocumentStatus = "completed"
	DocumentStatusFailed     DocumentStatus = "failed"
	DocumentStatusArchived   DocumentStatus = "archived"
)

// DataClassification indicates the sensitivity level of a document.
type DataClassification string

const (
	ClassificationPublic       DataClassification = "public"
	ClassificationInternal     DataClassification = "internal"
	ClassificationConfidential DataClassification = "confidential"
	ClassificationRestricted   DataClassification = "restricted"
)

// Document represents an uploaded file managed by the platform.
//
// Schema-wise this is a superset of the storage row: it carries
// processing/DLP/storage metadata that the HTTP handlers surface.
// Backends that only know the lean columns leave the extra fields zero.
type Document struct {
	ID                  uuid.UUID          `json:"id"                    db:"id"`
	TenantID            uuid.UUID          `json:"tenant_id"             db:"tenant_id"`
	CreatedBy           uuid.UUID          `json:"created_by"            db:"created_by"`
	OriginalName        string             `json:"original_name"         db:"original_name"`
	OriginalFilename    string             `json:"original_filename"     db:"original_filename"`
	Filename            string             `json:"filename"              db:"filename"`
	ContentType         string             `json:"content_type"          db:"content_type"`
	FileSize            int64              `json:"file_size"             db:"file_size"`
	Checksum            string             `json:"checksum"              db:"checksum"`
	StoragePath         string             `json:"storage_path"          db:"storage_path"`
	StorageBucket       string             `json:"storage_bucket"        db:"storage_bucket"`
	StorageProvider     string             `json:"storage_provider"      db:"storage_provider"`
	EncryptionKeyID     string             `json:"encryption_key_id"     db:"encryption_key_id"`
	EncryptionAlgorithm string             `json:"encryption_algorithm"  db:"encryption_algorithm"`
	AccessLevel         string             `json:"access_level"          db:"access_level"`
	Classification      DataClassification `json:"classification"        db:"classification"`
	Status              DocumentStatus     `json:"status"                db:"status"`
	ExtractionStatus    DocumentStatus     `json:"extraction_status"     db:"extraction_status"`
	ProcessingStatus    DocumentStatus     `json:"processing_status"     db:"processing_status"`
	DLPStatus           DocumentStatus     `json:"dlp_status"            db:"dlp_status"`
	ProcessingDurationMs int64             `json:"processing_duration_ms" db:"processing_duration_ms"`
	ContentHash         string             `json:"content_hash"          db:"content_hash"`
	Language            string             `json:"language"              db:"language"`
	Tags                JSONB              `json:"tags"                  db:"tags"`
	Metadata            JSONB              `json:"metadata"              db:"metadata"`
	RetentionPolicy     JSONB              `json:"retention_policy"      db:"retention_policy"`
	CreatedAt           time.Time          `json:"created_at"            db:"created_at"`
	UpdatedAt           time.Time          `json:"updated_at"            db:"updated_at"`
}

// NewDocument creates a new Document in pending state.
func NewDocument(tenantID, createdBy uuid.UUID, filename, originalName, contentType string, fileSize int64) *Document {
	return &Document{
		ID:           uuid.New(),
		TenantID:     tenantID,
		CreatedBy:    createdBy,
		Filename:     filename,
		OriginalName: originalName,
		ContentType:  contentType,
		FileSize:     fileSize,
		Status:       DocumentStatusPending,
		Tags:         JSONB{"tags": []interface{}{}},
		Metadata:     JSONB{},
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}
}

// AddTag appends a tag to the document. Tags are stored under the
// "tags" key inside the JSONB blob to keep room for tag metadata.
func (d *Document) AddTag(tag string) {
	if d.Tags == nil {
		d.Tags = JSONB{}
	}
	tags, _ := d.Tags["tags"].([]interface{})
	d.Tags["tags"] = append(tags, tag)
}

// IsProcessingComplete reports whether every pipeline stage finished
// successfully. Failed/pending stages return false; HasFailed
// surfaces the failure case independently.
func (d *Document) IsProcessingComplete() bool {
	if d == nil {
		return false
	}
	return d.ExtractionStatus == DocumentStatusCompleted &&
		d.ProcessingStatus == DocumentStatusCompleted &&
		d.DLPStatus == DocumentStatusCompleted
}

// HasFailed reports whether any pipeline stage failed.
func (d *Document) HasFailed() bool {
	if d == nil {
		return false
	}
	return d.ExtractionStatus == DocumentStatusFailed ||
		d.ProcessingStatus == DocumentStatusFailed ||
		d.DLPStatus == DocumentStatusFailed ||
		d.Status == DocumentStatusFailed
}

// GetProcessingProgress returns a 0-100 progress estimate based on
// which pipeline stages are complete (extraction / processing / DLP).
// Each stage contributes 1/3 of total; returns float so callers can
// distinguish 33.33 (one of three) from 66.67 (two of three).
func (d *Document) GetProcessingProgress() float64 {
	if d == nil {
		return 0
	}
	const stages = 3.0
	done := 0.0
	if d.ExtractionStatus == DocumentStatusCompleted {
		done++
	}
	if d.ProcessingStatus == DocumentStatusCompleted {
		done++
	}
	if d.DLPStatus == DocumentStatusCompleted {
		done++
	}
	return (done / stages) * 100
}

// CanAccess returns true when the given role is permitted to read the
// document. Permissive defaults: admins always see; non-admins see
// public/tenant-scoped docs. Hardened by the policy engine; this is
// the model-level shortcut used by HTTP handlers for pre-auth filtering.
func (d *Document) CanAccess(role UserRole) bool {
	if d == nil {
		return false
	}
	if role == RoleAdmin || role == RoleSuperAdmin || role == RoleTenantAdmin {
		return true
	}
	if d.AccessLevel == "public" || d.AccessLevel == "tenant" || d.AccessLevel == "" {
		return true
	}
	return false
}

// DocumentFilter holds optional filter criteria for document queries.
type DocumentFilter struct {
	TenantID         *uuid.UUID          `json:"tenant_id,omitempty"`
	Status           *DocumentStatus     `json:"status,omitempty"`
	Classification   *DataClassification `json:"classification,omitempty"`
	ContentType      *string             `json:"content_type,omitempty"`
	ExtractionStatus *DocumentStatus     `json:"extraction_status,omitempty"`
	Search           *string             `json:"search,omitempty"`
	Tags             []string            `json:"tags,omitempty"`
	CreatedAfter     *time.Time          `json:"created_after,omitempty"`
	CreatedBefore    *time.Time          `json:"created_before,omitempty"`
	Limit            *int                `json:"limit,omitempty"`
	Offset           *int                `json:"offset,omitempty"`
}

// DocumentChunk is a semantically chunked fragment of a Document used
// for embedding and retrieval.
type DocumentChunk struct {
	ID         uuid.UUID      `json:"id"          db:"id"`
	DocumentID uuid.UUID      `json:"document_id" db:"document_id"`
	TenantID   uuid.UUID      `json:"tenant_id"   db:"tenant_id"`
	Content    string         `json:"content"     db:"content"`
	Embedding  []float32      `json:"embedding"   db:"embedding"`
	ChunkIndex int            `json:"chunk_index" db:"chunk_index"`
	Status     DocumentStatus `json:"status"      db:"status"`
	Metadata   JSONB          `json:"metadata"    db:"metadata"`
	CreatedAt  time.Time      `json:"created_at"  db:"created_at"`
}

// DocumentChunkFilter holds filter criteria for chunk queries.
type DocumentChunkFilter struct {
	DocumentID *uuid.UUID     `json:"document_id,omitempty"`
	Status     *DocumentStatus `json:"status,omitempty"`
	Limit      int             `json:"limit,omitempty"`
	Offset     int             `json:"offset,omitempty"`
}
